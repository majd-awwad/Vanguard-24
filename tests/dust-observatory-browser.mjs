import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const localModule = process.env.EARTHPULSE_PLAYWRIGHT;
const { chromium } = await import(localModule ? pathToFileURL(localModule).href : "playwright");
const base = process.env.EARTHPULSE_URL ?? "http://127.0.0.1:4173/";
const browser = await chromium.launch({ executablePath: process.env.EARTHPULSE_BROWSER });
const dataRoot = new URL("../web/assets/decode/dust-v2/", import.meta.url);
const catalog = JSON.parse(await readFile(new URL("catalog.json", dataRoot)));
const snapshots = new Map(await Promise.all(catalog.snapshots.map(async entry => [
  entry.id, JSON.parse(await readFile(new URL(entry.path, dataRoot))),
])));
const reference = catalog.snapshots.find(entry => entry.phase === "reference");

async function journey(lang, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.addInitScript(() => {
      window.observatoryTones = [];
      const start = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function (...args) {
        window.observatoryTones.push(this.frequency.value);
        return start.apply(this, args);
      };
    });
    await page.goto(new URL("?lang=" + lang, base).href);
    await page.locator("#dust-path-observatory").click();
    await page.locator("#observatory-field").waitFor();
    assert.equal(await page.locator("html").getAttribute("lang"), lang);
    assert.equal(await page.locator("html").getAttribute("dir"), lang === "ar" ? "rtl" : "ltr");
    assert.equal(await page.locator(".observatory-map-area").getAttribute("dir"), "ltr");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
    assert.equal(await page.locator("#observatory-first option").count(), catalog.snapshots.length);
    assert.equal(await page.locator("#observatory-first").inputValue(), reference.id);
    assert.equal(await page.locator("#observatory-context a").getAttribute("href"), snapshots.get(reference.id).visualLink.svs);
    assert.equal(await page.locator("#observatory-coast .dust-basemap-land").count(), 1);
    assert.equal(await page.locator("#observatory-values rect").count(), 1000);

    const inspector = page.locator("#observatory-cell-position");
    const value = page.locator("#observatory-cell-value");
    const initial = await inspector.textContent();
    const map = page.locator(".observatory-map-area");
    await map.focus();
    await page.keyboard.press("ArrowRight");
    assert.notEqual(await inspector.textContent(), initial);
    await page.keyboard.press("ArrowLeft");
    assert.equal(await inspector.textContent(), initial);
    const bounds = await map.boundingBox();
    await map.click({ position: { x: bounds.width / 80, y: bounds.height / 50 } });
    const firstCell = snapshots.get(reference.id).values[0];
    const formatted = new Intl.NumberFormat(lang, { maximumSignificantDigits: 5 });
    assert.ok((await value.textContent()).includes(formatted.format(firstCell)));
    await page.locator("#observatory-listen").click();
    await page.waitForFunction(() => window.observatoryTones.length === 1);

    await page.locator("#observatory-mode").selectOption("comparison");
    await page.locator("#observatory-field").waitFor();
    const first = await page.locator("#observatory-first").inputValue();
    const second = await page.locator("#observatory-second").inputValue();
    assert.notEqual(first, second);
    assert.equal(snapshots.get(first).source.modelSource, snapshots.get(second).source.modelSource);
    assert.equal(await page.locator("#observatory-values rect").count(), 1000);
    const change = snapshots.get(second).values[0] - snapshots.get(first).values[0];
    assert.ok((await value.textContent()).includes(formatted.format(change)));
    await page.locator("#observatory-listen").click();
    await page.waitForFunction(() => window.observatoryTones.length === 3);
    const notes = await page.evaluate(() => window.observatoryTones.slice(-2));
    assert.equal(Math.sign(notes[1] - notes[0]), Math.sign(change));
    assert.equal(await page.locator("#observatory-granules a").count(), 2);
    assert.deepEqual(await page.locator("#observatory-granules a").evaluateAll(links => links.map(link => link.href)),
      [snapshots.get(first).source.url, snapshots.get(second).source.url]);
    assert.doesNotMatch(await page.locator("#observatory-context").textContent() ?? "", /SVS 5669/);
    assert.deepEqual(errors, []);
    console.log(`Dust Observatory keyboard and compatible-date journey: ${lang}, ${width}px passed.`);
  } finally {
    await page.close();
  }
}

try {
  for (const lang of ["en", "ar"]) {
    for (const width of [1440, 375]) await journey(lang, width);
  }
} finally {
  await browser.close();
}
