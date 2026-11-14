import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const modulePath = process.env.EARTHPULSE_PLAYWRIGHT;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const base = process.env.EARTHPULSE_URL ?? "http://127.0.0.1:4174/";
const browser = await chromium.launch({
  executablePath: process.env.EARTHPULSE_BROWSER,
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});

async function checkDesktopLayout(page) {
  const layout = await page.evaluate(() => {
    const cards = document.querySelector("#cine-steps").getBoundingClientRect();
    const bar = document.querySelector("#cine-bar").getBoundingClientRect();
    return { cardsBottom: cards.bottom, barTop: bar.top, waveWidth: document.querySelector(".cine-signal").getBoundingClientRect().width };
  });
  assert.ok(layout.cardsBottom + 10 <= layout.barTop, "Step cards remain clear of the case bar");
  assert.ok(layout.waveWidth > 50 && layout.waveWidth <= 250, "Waveform stays beside its button");
}

try {
  const page = await browser.newPage({ viewport: { width: 1837, height: 876 } });
  const errors = [];
  const failedAssets = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", response => {
    if (response.url().startsWith(base) && response.status() >= 400) failedAssets.push(response.url());
  });
  const inspectionUrl = new URL(base);
  inspectionUrl.searchParams.set("cine-debug", "");
  await page.goto(inspectionUrl.href);
  await page.waitForSelector('body[data-case-ready][data-renderer="webgl"]');
  assert.equal(await page.locator("html").getAttribute("lang"), "ar");
  assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
  assert.equal(await page.locator(".cine-canvas").count(), 1);
  assert.equal(await page.locator("#cine-title-lead").textContent(), "اسمع");
  await page.waitForFunction(() => window.__cineDebug?.scene);
  const sky = await page.evaluate(() => window.__cineDebug.scene.stats);
  assert.ok(sky.stars > 400);
  assert.equal(sky.moonVisible, true);
  await page.evaluate(() => document.fonts.ready);
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/earthpulse-ar.png", animations: "disabled" });
  await checkDesktopLayout(page);
  assert.equal(await page.locator(".cine-icon-steps li p").count(), 3);
  const comet = page.locator(".cine-comet").first();
  await comet.evaluate(element => {
    const animation = element.getAnimations()[0];
    animation.pause();
    animation.currentTime = 5000;
  });
  assert.ok(await comet.evaluate(element => Number(getComputedStyle(element).opacity) > 0));
  await comet.evaluate(element => { element.getAnimations()[0].currentTime = 11000; });
  assert.equal(await comet.evaluate(element => Number(getComputedStyle(element).opacity)), 0);

  for (const section of ["about", "science", "dataset"]) {
    await page.locator(`#cine-nav-${section}`).click();
    assert.equal(await page.locator("#site-info").evaluate(dialog => dialog.open), true);
    assert.ok((await page.locator("#site-info-body").textContent()).length > 40);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#site-info").evaluate(dialog => dialog.open), false);
  }
  await page.locator("#cine-play-guide").click();
  await page.waitForFunction(() => document.querySelector("#cine-play-guide").getAttribute("aria-pressed") === "true");
  await page.locator("#cine-play-guide").click();
  await page.locator("#cine-start").click();
  await page.waitForSelector('body[data-view="decode"][data-flight="done"]');
  assert.equal(await page.locator(".cine-sky").isVisible(), false);
  assert.equal(await page.evaluate(() => window.__cineDebug.scene.stats.moonVisible), false);
  assert.equal(await page.locator('#decode-grid [role="gridcell"]').count(), 12);
  await page.locator("#decode-next").click();
  await page.locator(".dg-cell").first().click();
  assert.equal(await page.locator('.dg-cell[aria-pressed="true"]').count(), 1);
  await page.locator("#decode-submit").click();
  await page.waitForSelector("#decode-evidence:visible");
  assert.ok((await page.locator("#decode-score").textContent()).length > 0);
  await page.locator("#decode-restart").click();
  await page.waitForSelector('body[data-view="hero"]');

  await page.locator("#cine-lang-en").click();
  await page.waitForSelector('html[lang="en"] body[data-case-ready]');
  assert.equal(await page.locator("#cine-title-accent").textContent(), "UNSEEN");
  await page.screenshot({ path: "test-results/earthpulse-en.png", animations: "disabled" });
  await checkDesktopLayout(page);
  for (const [width, height] of [[1672, 941], [1366, 768]]) {
    await page.setViewportSize({ width, height });
    const url = new URL(base);
    url.searchParams.set("lang", "en");
    await page.goto(url.href);
    await page.waitForSelector("body[data-case-ready]");
    await page.screenshot({ path: `test-results/earthpulse-${width}.png`, animations: "disabled" });
    await checkDesktopLayout(page);
  }
  for (const language of ["ar", "en"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    const url = new URL(base);
    url.searchParams.set("lang", language);
    await page.goto(url.href);
    await page.waitForSelector("body[data-case-ready]");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language}: no horizontal overflow`);
    assert.equal(await page.locator("#cine-start").isVisible(), true);
    await page.screenshot({ path: `test-results/earthpulse-mobile-${language}.png`, fullPage: true, animations: "disabled" });
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(failedAssets, []);

  const fallback = await browser.newPage();
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return /webgl/i.test(type) ? null : original.call(this, type, ...args);
    };
  });
  await fallback.goto(base);
  await fallback.waitForSelector('body[data-case-ready][data-renderer="svg"]');
  await fallback.locator("#cine-start").click();
  await fallback.waitForSelector('#decode-stage[data-renderer="svg"]');
  assert.equal(await fallback.locator("#decode-visual svg").count(), 1);
  assert.equal(await fallback.locator(".dg-cell").count(), 12);
  await fallback.close();

  const quiet = await browser.newPage({ reducedMotion: "reduce" });
  await quiet.goto(inspectionUrl.href);
  await quiet.waitForSelector('body[data-case-ready][data-renderer="webgl"]');
  assert.equal(await quiet.evaluate(() => document.getAnimations().filter(animation => animation.effect.getTiming().iterations === Infinity).length), 0);
  await quiet.locator("#cine-start").click();
  await quiet.waitForSelector('body[data-view="decode"][data-flight="done"]');
  await quiet.close();

  for (const legacy of ["decode-3d.html?lang=ar", "decode.html", "forest.html"]) {
    const response = await page.request.get(new URL(legacy, base).href, { maxRedirects: 0 });
    assert.equal(response.status(), 302);
    assert.equal(response.headers().location, legacy.includes("?") ? "/?lang=ar" : "/");
  }
  console.log("Browser checks passed: Earth, stars, moon, occasional comets, glass layout at desktop/mobile sizes, Arabic/English, navigation, sound guide, decoding/reveal, reduced motion, fallback and redirects.");
} finally {
  await browser.close();
}
