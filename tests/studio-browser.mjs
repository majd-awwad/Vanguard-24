import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const { chromium } = await import(process.env.EARTHPULSE_PLAYWRIGHT ? pathToFileURL(process.env.EARTHPULSE_PLAYWRIGHT).href : "playwright");
const browser = await chromium.launch({ executablePath: process.env.EARTHPULSE_BROWSER, headless: true });
const base = process.env.EARTHPULSE_URL ?? "http://127.0.0.1:4173/";

async function exercise(width, language) {
  const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 940 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => { if (!response.ok()) errors.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(() => {
    window.studioOscillators = 0;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args) {
      window.studioOscillators++;
      return start.apply(this, args);
    };
  });
  await page.goto(new URL(`studio.html?lang=${language}`, base).href, { waitUntil: "networkidle" });
  await page.locator("#studio-interface").waitFor({ state: "visible" });
  assert.equal(await page.locator("html").getAttribute("dir"), language === "ar" ? "rtl" : "ltr");
  assert.equal(await page.locator("#studio-map canvas").count(), 1);
  assert.equal(await page.locator("#inspect-2012").textContent(), language === "ar" ? "غير متاح في وضع الصورة المرجعية" : "Unavailable in reference-image mode");
  assert.match(await page.locator("#inspect-quality").textContent(), language === "ar" ? /ليست قياسًا عدديًا/ : /not quantitative/);
  await page.locator("#enable-sound").click();
  await page.waitForFunction(() => window.studioOscillators === 2);
  const mapBox = await page.locator("#studio-map").boundingBox();
  await page.mouse.move(mapBox.x + mapBox.width * 0.46, mapBox.y + mapBox.height * 0.42);
  await page.waitForTimeout(80);
  assert.match(await page.locator("#inspect-pixel").textContent(), /^RGB /);
  await page.locator("#play-visible").click();
  await page.waitForFunction(() => document.querySelector("#playback-progress").value !== "0");
  assert.equal(await page.evaluate(() => window.studioOscillators), 2, "persistent hover/scan graph must not add oscillators");
  await page.locator("#transport-pause").click();
  await page.locator("#draw-path").click();
  await page.mouse.move(mapBox.x + mapBox.width * 0.36, mapBox.y + mapBox.height * 0.42);
  await page.mouse.down();
  await page.mouse.move(mapBox.x + mapBox.width * 0.56, mapBox.y + mapBox.height * 0.55, { steps: 18 });
  await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector("#path-tools").hidden);
  assert.equal(await page.locator("#path-profile").evaluate((canvas) => canvas.width > 0), true);
  await page.locator("#transport-play").click();
  await page.waitForFunction(() => document.querySelector("#playback-progress").value !== "0");
  await page.locator("#transport-pause").click();
  await page.locator("#compare-mode").click();
  await page.mouse.click(mapBox.x + mapBox.width * 0.42, mapBox.y + mapBox.height * 0.45);
  await page.mouse.click(mapBox.x + mapBox.width * 0.56, mapBox.y + mapBox.height * 0.48);
  assert.equal(await page.locator("#compare-table").isVisible(), width >= 900);
  assert.equal(await page.locator("#compare-a-value").textContent().then(Boolean), true);
  await page.locator('[data-layer="2012"]').click();
  assert.equal(await page.locator("#studio-map").getAttribute("data-layer"), "2012");
  assert.equal(errors.length, 0, errors.join("\n"));
  await page.close();
}

try {
  await exercise(1440, "en");
  await exercise(390, "ar");
  console.log("Earth Sound Studio map, persistent audio, scan, path, comparison, layers and responsive Arabic passed.");
} finally {
  await browser.close();
}
