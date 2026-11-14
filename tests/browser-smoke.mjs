import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const browserModule = process.env.EARTHPULSE_PLAYWRIGHT;
const { chromium } = browserModule
  ? await import(pathToFileURL(browserModule).href)
  : await import("playwright");
const browser = await chromium.launch({
  executablePath: process.env.EARTHPULSE_BROWSER,
  headless: true,
});
const url = new URL("forest.html", process.env.EARTHPULSE_URL ?? "http://127.0.0.1:4173/").href;

async function press(page, selector) {
  await page.locator(selector).focus();
  await page.keyboard.press("Enter");
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, reducedMotion: "reduce" });
  const problems = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("response", (response) => { if (!response.ok()) problems.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(() => {
    const native = AudioScheduledSourceNode.prototype.start;
    window.startedTones = 0;
    AudioScheduledSourceNode.prototype.start = function (...args) {
      window.startedTones++;
      return native.apply(this, args);
    };
  });
  await page.goto(url);
  await page.locator("#experience").waitFor();
  assert.equal(await page.locator("#plot").getAttribute("data-axis"), "vertical");
  assert.equal(await page.locator("#plot .waveform").count(), 1);
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").textContent(), "Skip to exploration");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(":focus").getAttribute("id"), "lens");
  await press(page, "#begin");
  await page.waitForFunction(() => document.querySelector("#playback-status").textContent === "Playing");
  assert.equal(await page.locator(":focus").getAttribute("id"), "lens");
  await page.waitForFunction(() => window.startedTones > 6);
  assert.match(await page.locator("#plot").getAttribute("data-event"), /^19640520300108404:/);
  await press(page, "#guide-track");
  assert.equal(await page.locator("#current-value").textContent(), "0.15%");
  assert.equal(await page.locator("#plot .site-button").count(), 6);
  assert.equal(await page.locator("#reveal").isVisible(), false);
  await press(page, "#replay");
  await page.waitForFunction(() => document.querySelector("#playback-status").textContent.includes("Between footprints"));
  assert.equal(await page.locator("#reading-title").textContent(), "Last sampled return share");
  assert.equal(await page.locator("#plot .playhead").evaluate((line) => getComputedStyle(line).display), "inline");
  await press(page, "#pause");
  assert.equal(await page.locator("#playback-status").textContent(), "Paused");

  const beforePreview = await page.evaluate(() => window.startedTones);
  await press(page, "#plot .site-button:last-child");
  assert.equal(await page.evaluate(() => window.startedTones), beforePreview + 1);
  assert.equal(await page.locator("#plot .site-button:last-child").getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("#current-value").textContent(), "17.32%");
  assert.equal(await page.locator("#plot").getAttribute("data-event"),
    await page.locator("#current-value").getAttribute("data-event"));
  await press(page, "#reveal");
  assert.equal(await page.locator(":focus").getAttribute("id"), "guide-result-heading");
  assert.match(await page.locator("#guide-result").textContent(), /8.41 percentage points/);
  await press(page, "#evidence-low");
  assert.equal(await page.locator("#evidence-content").getAttribute("data-shot"), "19640519500108400");
  assert.match(await page.locator("#evidence-content").textContent(), /0\.0015310089/);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(":focus").getAttribute("id"), "evidence-low");
  await press(page, "#guide-vertical");
  assert.equal(await page.locator(":focus").getAttribute("id"), "vertical");
  assert.equal(await page.locator("#vertical").getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("#footprint").inputValue(), "19640520300108404");
  await press(page, "#pause");
  await press(page, "#discovery-open");
  assert.equal(await page.locator(":focus").getAttribute("id"), "vertical");
  assert.equal(await page.locator("#guide").isVisible(), false);

  await press(page, "#horizontal");
  await press(page, "#vertical");
  assert.equal(await page.locator("#vertical").getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("#footprint").inputValue(), "19640520300108404");
  await page.locator("#height-step").selectOption("12");
  assert.equal(await page.locator("#height-step").inputValue(), "12");
  await page.locator("#height-step").focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.locator("#height-step").inputValue(), "13");
  await press(page, "#next");
  assert.equal(await page.locator("#height-step").inputValue(), "14");
  await press(page, "#inspect");
  assert.equal(await page.locator(":focus").getAttribute("id"), "evidence-content");
  assert.equal(await page.locator("#evidence-content").getAttribute("data-shot"), "19640520300108404");
  const tree = await page.locator("#observation").ariaSnapshot();
  assert.match(tree, /19640520300108404/);
  assert.match(tree, /GEDI01_B_2019108080338_O01964_T05337_02_003_01.h5/);
  assert.match(tree, /GEDI02_A_2019108080338_O01964_T05337_02_001_01.h5/);
  assert.match(tree, /Provenance manifest and checksums/);

  await press(page, "#studio summary");
  await page.locator("#mute").focus();
  await page.keyboard.press("Space");
  assert.equal(await page.locator("#mute").isChecked(), true);
  await page.locator("#speed").selectOption("2");
  await press(page, "#silent");
  assert.match(await page.locator("#playback-status").textContent(), /^Visual playback/);
  const priorTones = await page.evaluate(() => window.startedTones);
  await press(page, "#replay");
  await page.waitForFunction(() => document.querySelector("#playback-status").textContent === "Scan complete");
  assert.equal(await page.evaluate(() => window.startedTones), priorTones);
  await press(page, "#play");
  await page.waitForFunction(() => document.querySelector("#playback-status").textContent === "Visual playback");
  assert.equal(await page.evaluate(() => window.startedTones), priorTones);
  await press(page, "#sound");
  await page.waitForFunction(() => document.querySelector("#playback-status").textContent === "Playing");
  assert.ok(await page.evaluate((count) => window.startedTones > count, priorTones));
  assert.equal(await page.locator("#mute").isChecked(), false);
  await press(page, "#pause");
  await press(page, "#locale");
  assert.equal(await page.locator("html").getAttribute("lang"), "ar");
  assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
  assert.equal(await page.locator(":focus").getAttribute("id"), "locale");
  assert.match(await page.locator("#evidence-content").textContent(), /صف L1B \/ L2A/);
  assert.equal(await page.locator("#evidence-content").getAttribute("data-shot"), "19640520300108404");
  assert.match(await page.locator("#plot svg").textContent(), / م/);
  assert.match(await page.locator("#position-text").textContent(), /البصمة/);
  await press(page, "#horizontal");
  await page.locator("#band-min").selectOption("6");
  assert.match(await page.locator("#plot").getAttribute("data-event"), /:6:10$/);
  assert.equal(await page.locator("#plot").getAttribute("data-event"),
    await page.locator("#current-value").getAttribute("data-event"));
  await page.locator("#science img").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector("#science img").naturalWidth === 1024);

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), `Overflow at ${width}px`);
  }
  await press(page, "#locale");
  assert.equal(await page.locator("html").getAttribute("dir"), "ltr");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth));
  await press(page, "#vertical");
  await page.locator("#plot .wave-hit").scrollIntoViewIfNeeded();
  const wave = await page.locator("#plot .wave-hit").boundingBox();
  await page.mouse.click(wave.x + wave.width * 0.5, wave.y + wave.height * 0.61);
  assert.equal(await page.locator("#height-step").inputValue(), "12");
  assert.match(await page.locator("#plot").getAttribute("data-event"), /:2:3$/);
  assert.equal(await page.locator("#plot").getAttribute("data-event"),
    await page.locator("#current-value").getAttribute("data-event"));
  assert.deepEqual(problems, []);
  console.log("Browser journey passed: keyboard focus, guided previews, gap and event sync, exact evidence, studio, bilingual mobile layout.");

  const errorPage = await browser.newPage();
  await errorPage.route("**/assets/gedi/sample.json", (route) => route.fulfill({ status: 500 }), { times: 1 });
  await errorPage.goto(url);
  await errorPage.locator("#load-error").waitFor();
  assert.equal(await errorPage.locator("#begin").isDisabled(), true);
  assert.equal(await errorPage.locator("#begin-silent").isDisabled(), true);
  assert.equal(await errorPage.locator("#experience").isVisible(), false);
  await press(errorPage, "#locale");
  assert.match(await errorPage.locator("#load-error").textContent(), /تعذّر/);
  await press(errorPage, "#retry");
  await errorPage.locator("#experience").waitFor();
  assert.equal(await errorPage.locator(":focus").getAttribute("id"), "lens");
  await press(errorPage, "#begin-silent");
  assert.match(await errorPage.locator("#playback-status").textContent(), /تشغيل مرئي/);
  console.log("Browser retry passed: failed data load, Arabic error, successful retry and silent entry.");

  const silentPage = await browser.newPage();
  await silentPage.addInitScript(() => {
    window.AudioContext = class { constructor() { throw new Error("Audio disabled for this test"); } };
  });
  await silentPage.goto(url);
  await silentPage.locator("#experience").waitFor();
  await press(silentPage, "#begin");
  await silentPage.waitForFunction(() => document.querySelector("#playback-status").textContent.startsWith("Audio unavailable"));
  await press(silentPage, "#inspect");
  assert.match(await silentPage.locator("#evidence-content").textContent(), /GEDI shot number/);
  console.log("Browser audio fallback passed: visual scan and evidence remain available after audio failure.");
} finally {
  await browser.close();
}
