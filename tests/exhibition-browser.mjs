import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const { chromium } = await import(process.env.EARTHPULSE_PLAYWRIGHT
  ? pathToFileURL(process.env.EARTHPULSE_PLAYWRIGHT).href : "playwright");
const base = process.env.EARTHPULSE_URL ?? "http://127.0.0.1:4173/";

for (const webgl of [true, false]) {
  const browser = await chromium.launch({ executablePath: process.env.EARTHPULSE_BROWSER,
    args: webgl ? ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] : ["--disable-webgl"] });
  try {
    const page = await browser.newPage({ reducedMotion: "reduce", viewport: webgl ? { width: 1440, height: 960 } : { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(new URL(webgl ? "?lang=en" : "?lang=ar", base).href);
    const globe = page.locator("#reception-globe");
    await globe.scrollIntoViewIfNeeded();
    await page.waitForFunction((mode) => document.querySelector("#reception-globe").dataset.renderer === mode, webgl ? "webgl" : "image");
    const forest = globe.locator('[data-region="forest"]');
    await forest.focus();
    await page.keyboard.press("Enter");
    assert.equal(await forest.getAttribute("aria-pressed"), "true");
    assert.match(await globe.locator("#reception-coordinates").textContent(), /13\.74° S/);
    assert.match(await page.locator("#reception-open").getAttribute("href"), /forest\.html/);
    await globe.locator('[data-region="rain"]').click();
    await page.locator("#reception-open").click();
    await page.waitForFunction(() => document.querySelector("#lens").dataset.signal === "rain");
    assert.match(await page.locator("#reading-geo").textContent(), /27\.05° N · 84\.95° W/);

    await page.locator("#forest-entry").click();
    await page.locator("#begin-silent").click();
    await page.locator("#guide-track").click();
    const profiles = page.locator(".profile-panel");
    assert.equal(await profiles.count(), 6);
    assert.equal(await page.locator(".profile-panel.current").count(), 1);
    assert.equal(new Set(await page.locator(".profile-band").evaluateAll(elements => elements.map(el => el.getAttribute("height")))).size, 1);
    if (!webgl) assert.match(await page.locator("#profiles .eyebrow").textContent(), /البصمات/);
    await page.locator("#vertical").click();
    await page.locator("#height-step").selectOption("0");
    assert.equal(await page.locator(".beam-point").getAttribute("visibility"), "hidden");
    assert.ok(await page.locator(".waveform").isVisible());
    await page.locator(".field-navigation a").filter({ hasText: webgl ? "Text cues" : "الإشارات النصيّة" }).click();
    await page.locator("#decode-next").waitFor();
    assert.equal(new URL(page.url()).searchParams.get("condition"), "text");
    assert.deepEqual(errors, []);
    console.log(`Exhibition discovery, case routing, GEDI profiles and text access passed (${webgl ? "WebGL/English" : "fallback/Arabic"}).`);
  } finally { await browser.close(); }
}
