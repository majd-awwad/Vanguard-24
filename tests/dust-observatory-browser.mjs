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
    await page.locator("#observatory-terrain").uncheck();
    assert.equal(await page.locator("#observatory-terrain-image").isVisible(), false);
    assert.equal(await page.locator("#observatory-values rect").count(), 1000);
    await page.locator("#observatory-terrain").check();
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
    const history = page.locator("#observatory-history");
    await history.locator("summary").focus();
    await page.keyboard.press("Enter");
    await page.locator("#observatory-history-content").waitFor();
    const rows = page.locator("#observatory-history-rows tr");
    assert.equal(await rows.count(), catalog.snapshots.length);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
    const chart = page.locator("#observatory-history-chart");
    const model = catalog.snapshots.find(entry => entry.id === first).modelSource;
    const matching = catalog.snapshots.filter(entry => entry.modelSource === model);
    assert.equal(await chart.locator("circle").count(), matching.filter(entry => snapshots.get(entry.id).values[0] !== null).length);
    const alternate = catalog.snapshots.find(entry => entry.modelSource !== model);
    let alternateRow = rows.filter({ has: page.locator(`[data-open-date="${alternate.id}"]`) });
    assert.equal(await alternateRow.getByRole("button").count(), 1);
    const selectedRow = rows.filter({ has: page.locator(`[data-open-date="${second}"]`) });
    const expectedWindow = await page.evaluate(({ lang, start, end }) => {
      const format = new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
      return format.format(new Date(start)) + "–" + format.format(new Date(end)) + " UTC";
    }, { lang, ...snapshots.get(second).time });
    assert.equal(await selectedRow.locator("td").first().textContent(), expectedWindow);
    assert.ok((await selectedRow.locator("td").nth(1).textContent()).includes(formatted.format(snapshots.get(second).values[0])));
    await page.locator(`[data-open-date="${alternate.id}"]`).click();
    await page.locator("#observatory-history-rows [data-active-sample=historySelected]").waitFor();
    assert.equal(await page.locator("#observatory-first").inputValue(), alternate.id);
    assert.equal(await page.locator("#observatory-mode").inputValue(), "snapshot");
    const firstPosition = await page.evaluate(lang => {
      const one = new Intl.NumberFormat(lang).format(1);
      return lang === "ar" ? `الصف ${one}، العمود ${one}` : `Row ${one}, column ${one}`;
    }, lang);
    assert.ok((await inspector.textContent()).includes(firstPosition));
    const newComparison = catalog.snapshots.find(entry => entry.modelSource === alternate.modelSource && entry.id !== alternate.id);
    await page.locator(`[data-compare-date="${newComparison.id}"]`).click();
    await page.locator("#observatory-history-rows [data-active-sample=historyComparison]").waitFor();
    assert.equal(await page.locator("#observatory-mode").inputValue(), "comparison");
    assert.equal(await page.locator("#observatory-second").inputValue(), newComparison.id);
    assert.deepEqual(errors, []);
    console.log(`Dust Observatory keyboard and compatible-date journey: ${lang}, ${width}px passed.`);
  } finally {
    await page.close();
  }
}

async function shareJourney() {
  const page = await browser.newPage({ viewport: { width: 375, height: 900 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const matching = catalog.snapshots.filter(entry => entry.modelSource === reference.modelSource && entry.id !== reference.id);
  const comparison = matching.at(-1);
  const incompatible = catalog.snapshots.find(entry => entry.modelSource !== reference.modelSource);
  const firstId = reference.id;
  const secondId = comparison.id;
  const url = new URL("dust-observatory.html", base);
  const compareValue = snapshots.get(secondId).values[3 * 40 + 7] - snapshots.get(firstId).values[3 * 40 + 7];
  try {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: value => {
          window.copiedView = value;
          if (window.holdClipboard) {
            return new Promise((_resolve, reject) => { window.rejectClipboard = reject; });
          }
          return new URL(location.href).searchParams.get("lang") === "ar"
            ? Promise.reject(new Error("Clipboard denied")) : Promise.resolve();
        } },
      });
    });
    url.search = new URLSearchParams({ lang: "en", first: firstId, second: secondId, row: "3", col: "7" });
    await page.goto(url.href);
    const field = page.locator("#observatory-field");
    await field.waitFor();
    assert.equal(await page.locator("#observatory-first").inputValue(), firstId);
    assert.equal(await page.locator("#observatory-second").inputValue(), secondId);
    assert.equal(await page.locator("#observatory-mode").inputValue(), "comparison");
    assert.match(await page.locator("#observatory-cell-position").textContent(), /Row 4, column 8/);
    assert.ok((await page.locator("#observatory-cell-value").textContent())
      .includes(new Intl.NumberFormat("en", { maximumSignificantDigits: 5 }).format(compareValue)));
    const share = page.locator("#observatory-share");
    await share.click();
    assert.equal(await page.locator("#observatory-share-status").textContent(), "Link copied.");
    assert.equal(await page.evaluate(() => window.copiedView), page.url());
    assert.equal(await page.locator("#observatory-share-fallback").isVisible(), false);

    await page.locator("#observatory-language").click();
    await field.waitFor();
    const shared = new URL(page.url());
    assert.deepEqual(Object.fromEntries(shared.searchParams),
      { lang: "ar", first: firstId, second: secondId, row: "3", col: "7" });
    await share.click();
    const fallback = page.locator("#observatory-share-url");
    await fallback.waitFor();
    assert.equal(await fallback.inputValue(), shared.href);
    assert.equal(await fallback.getAttribute("readonly"), "");
    assert.equal(await page.locator(":focus").getAttribute("id"), "observatory-share-url");
    assert.equal(await fallback.evaluate(input => input.selectionEnd - input.selectionStart), shared.href.length);

    await page.evaluate(() => { window.holdClipboard = true; });
    await share.click();
    await page.locator(".observatory-map-area").focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(new URL(page.url()).searchParams.get("col"), "8");
    await page.evaluate(() => window.rejectClipboard(new Error("Clipboard denied")));
    assert.equal(await fallback.isVisible(), false);
    assert.equal(await page.locator(".observatory-map-area").evaluate(node => document.activeElement === node), true);
    await page.reload();
    await field.waitFor();
    assert.equal(new URL(page.url()).searchParams.get("col"), "8");

    for (const invalid of [incompatible.id, firstId, "../catalog"]) {
      url.search = new URLSearchParams({ first: firstId, second: invalid, row: "25", col: "-1" });
      await page.goto(url.href);
      await field.waitFor();
      assert.equal(await page.locator("#observatory-mode").inputValue(), "snapshot");
      const normalized = new URL(page.url()).searchParams;
      assert.equal(normalized.get("second"), null);
      assert.equal(normalized.get("row"), "14");
      assert.equal(normalized.get("col"), "15");
    }
    url.search = new URLSearchParams({ first: "../unknown", second: secondId, row: "24", col: "39" });
    await page.goto(url.href);
    await field.waitFor();
    const boundary = new URL(page.url()).searchParams;
    assert.equal(boundary.get("first"), firstId);
    assert.equal(boundary.get("second"), null);
    assert.equal(boundary.get("row"), "24");
    assert.equal(boundary.get("col"), "39");

    let release;
    let notify;
    const requested = new Promise(resolve => { notify = resolve; });
    const delayed = new Promise(resolve => { release = resolve; });
    await page.route(`**/${comparison.path}`, async route => {
      notify();
      await delayed;
      await route.fulfill({ json: snapshots.get(secondId) });
    });
    const firstChoice = page.locator("#observatory-first");
    await firstChoice.selectOption(secondId);
    await requested;
    await firstChoice.selectOption(incompatible.id);
    await field.waitFor();
    assert.equal(new URL(page.url()).searchParams.get("first"), incompatible.id);
    const olderFinished = page.waitForResponse(response => response.url().endsWith(comparison.path));
    release();
    await olderFinished;
    await page.locator("#observatory-share").click();
    const latestCopied = new URL(await page.evaluate(() => window.copiedView));
    assert.equal(latestCopied.searchParams.get("first"), incompatible.id);
    assert.equal(latestCopied.searchParams.get("row"), "24");
    assert.equal(latestCopied.searchParams.get("col"), "39");
    assert.deepEqual(errors, []);
    console.log("Dust Observatory link restores the exact comparison and cell across reloads and languages; clipboard fallback and invalid-link normalization passed.");
  } finally {
    await page.close();
  }
}

try {
  await shareJourney();
  for (const lang of ["en", "ar"]) {
    for (const width of [1440, 375]) await journey(lang, width);
  }
} finally {
  await browser.close();
}
