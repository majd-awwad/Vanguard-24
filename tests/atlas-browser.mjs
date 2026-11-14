import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const { chromium } = await import(process.env.EARTHPULSE_PLAYWRIGHT ? pathToFileURL(process.env.EARTHPULSE_PLAYWRIGHT).href : "playwright");
const browser = await chromium.launch({ executablePath: process.env.EARTHPULSE_BROWSER, headless: true });
const url = process.env.EARTHPULSE_URL ?? "http://127.0.0.1:4173/";
const issues = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  page.on("pageerror", (error) => issues.push(error.message));
  await page.addInitScript(() => {
    window.tones = [];
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args) {
      window.tones.push([this.frequency.value, this.type]);
      return start.apply(this, args);
    };
  });
  await page.goto(url);
  await page.locator("#instrument").waitFor();
  assert.equal(await page.locator(".world").count(), 4);
  assert.equal(await page.locator("#reading-value").textContent(), "27.82 °C");
  await page.locator("#preview").click();
  await page.waitForFunction(() => window.tones.length === 7);
  assert.equal(await page.locator("#preview").textContent(), "Stop preview");
  await page.locator("#preview").click();
  assert.equal(await page.locator("#preview").textContent(), "Listen");
  await page.locator("#date-scrub").focus();
  await page.keyboard.press("End");
  assert.match(await page.locator("#map-date").textContent(), /Sep 12/);
  assert.equal(await page.locator("#data-map").getAttribute("data-event"), await page.locator("#reading-value").getAttribute("data-event"));
  await page.locator("#compare-site").selectOption("north");
  await page.locator("#hear-comparison").click();
  await page.waitForFunction(() => document.querySelector("#reading-location").textContent.includes("Northern"));
  await page.locator("#open-evidence").click();
  assert.match(await page.locator("#evidence-body").textContent(), /2024-09-12T09:00:00Z/);
  assert.match(await page.locator("#evidence-body").textContent(), /Analysis error/);
  assert.match(await page.locator('#evidence-body a[href*="cmr.earthdata"]').getAttribute("href"), /G3237231780-POCLOUD/);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(":focus").getAttribute("id"), "open-evidence");

  await page.locator("#signal").selectOption("rain");
  await page.waitForFunction(() => document.querySelector("#lens").dataset.signal === "rain");
  const beforeRain = await page.evaluate(() => window.tones.length);
  await page.locator('#date-labels [data-index="2"]').click();
  await page.waitForFunction((count) => window.tones.length === count + 6, beforeRain);
  assert.equal(await page.locator("#reading-value").textContent(), "106.56 mm/day");
  await page.locator("#reveal-mission").click();
  assert.match(await page.locator("#mission-result").textContent(), /Sep 26.*Sep 27/);
  await page.locator("#open-evidence").click();
  assert.match(await page.locator("#evidence-body").textContent(), /Valid half-hour retrievals48/);
  assert.match(await page.locator("#evidence-body").textContent(), /Scheduled pulses6/);
  await page.keyboard.press("Escape");

  await page.locator("#signal").selectOption("fires");
  await page.waitForFunction(() => document.querySelector("#lens").dataset.signal === "fires");
  assert.equal(await page.locator("#reading-value").textContent(), "17.37 MW");
  assert.match(await page.locator("#reading-detail").textContent(), /130/);
  await page.locator('#date-labels [data-index="1"]').click();
  assert.match(await page.locator("#reading-detail").textContent(), /98/);
  await page.locator("#open-evidence").click();
  assert.match(await page.locator("#evidence-body").textContent(), /2026-11-08T00:00:00Z.*2026-11-13T00:00:00Z/);
  await page.keyboard.press("Escape");
  await page.locator("#studio summary").click();
  const prior = await page.evaluate(() => window.tones.length);
  await page.locator("#visual-only").check();
  await page.locator("#timbre").selectOption("triangle");
  await page.locator("#replay").click();
  assert.equal(await page.evaluate(() => window.tones.length), prior);
  await page.locator("#language").click();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), `Overflow at ${width}px`);
  }
  assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
  await page.locator("#signal").selectOption("forest");
  await page.locator("#experience").waitFor();
  assert.match(page.url(), /forest\.html\?lang=ar/);
  assert.equal(await page.locator("html").getAttribute("lang"), "ar");
  assert.deepEqual(issues, []);
  console.log("Atlas browser passed: four cases, live preview, SST scrub and comparison, IMERG pulses, VIIRS windows, evidence, RTL and Forest navigation.");

  const retryPage = await browser.newPage({ reducedMotion: "reduce" });
  await retryPage.route("**/assets/atlas/mur-sst.csv", (route) => route.fulfill({ status: 503 }), { times: 1 });
  await retryPage.addInitScript(() => {
    window.AudioContext = class { constructor() { throw new Error("Audio unavailable for test"); } };
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: undefined });
  });
  await retryPage.goto(url);
  await retryPage.locator("#retry-lens").click();
  await retryPage.locator("#instrument").waitFor();
  await retryPage.locator("#play").click();
  await retryPage.waitForFunction(() => document.querySelector("#playback").textContent.includes("Audio unavailable"));
  await retryPage.locator("#read-measurement").click();
  await retryPage.waitForFunction(() => document.querySelector("#announcer").textContent.includes("°C"));
  await retryPage.locator("#open-evidence").click();
  assert.match(await retryPage.locator("#evidence-body").textContent(), /Scientific time/);
  console.log("Atlas retry passed: failed data load, retry and visual audio fallback with evidence.");
} finally {
  await browser.close();
}
