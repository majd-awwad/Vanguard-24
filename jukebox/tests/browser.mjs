import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const { chromium } = await import(process.env.EARTHPULSE_PLAYWRIGHT
  ? pathToFileURL(process.env.EARTHPULSE_PLAYWRIGHT).href : "playwright");
const base = process.env.EARTHPULSE_URL ?? "http://127.0.0.1:4206/";
const release = "release/screens";
await mkdir(release, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.EARTHPULSE_BROWSER });
try {
  for (const [lang, width, height] of [["en", 1440, 960], ["ar", 1440, 960], ["en", 390, 844], ["ar", 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      window.notes = [];
      const start = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function (when) {
        window.notes.push({ when, hz: this.frequency.value });
        return start.apply(this, arguments);
      };
    });
    await page.goto(new URL("?lang=" + lang, base).href);
    await page.locator("#instrument").waitFor();
    await page.locator("#nasa-frame").evaluate(image => image.decode());
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator("html").getAttribute("dir"), lang === "ar" ? "rtl" : "ltr");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
    assert.equal(await page.evaluate(() => window.notes.length), 0);
    await page.screenshot({ path: `${release}/opening-${lang}-${width}.png` });

    await page.locator("#listen").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(":focus").getAttribute("id"), "lab-title");
    await page.waitForFunction(() => document.querySelector("#frame").dataset.event === "europe:2");
    assert.equal(await page.locator("#inset").getAttribute("data-event"), "europe:2");
    assert.equal(await page.locator("#bright-value").getAttribute("data-event"), "europe:2");
    assert.equal(await page.locator("#slice").inputValue(), "2");
    const notes = await page.evaluate(() => window.notes);
    assert.ok(notes.some(note => note.hz === 392) && notes.some(note => Math.abs(note.hz - 261.626) < 0.001));
    assert.ok(notes.at(-1).when > notes[0].when);
    await page.locator("#pause").click();
    await page.locator("#mute").click();
    assert.equal(await page.locator("#mute").getAttribute("aria-pressed"), "true");
    await page.locator("#region-targets [data-region='india']").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#region").inputValue(), "india");
    await page.locator("#slice").focus();
    await page.keyboard.press("End");
    assert.equal(await page.locator("#frame").getAttribute("data-event"), "india:12");
    await page.locator("#previous").click();
    assert.equal(await page.locator("#frame").getAttribute("data-event"), "india:11");
    await page.locator("[data-band='india:5']").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#frame").getAttribute("data-event"), "india:6");
    assert.equal(await page.locator("#inset-image").evaluate(image => image.decode().then(() => image.naturalWidth)), 1000);
    await page.locator("#lab").evaluate(node => node.scrollIntoView());
    await page.screenshot({ path: `${release}/canvas-${lang}-${width}.png` });
    await page.locator("#compare-title").evaluate(node => node.scrollIntoView());
    await page.screenshot({ path: `${release}/comparison-${lang}-${width}.png` });

    await page.locator("#values summary").click();
    assert.equal(await page.locator("#data-rows tr").count(), 12);
    assert.match(await page.locator("#table-caption").textContent(), lang === "en" ? /India/ : /الهند/);
    assert.ok((await page.locator("#data-rows tr").nth(5).ariaSnapshot()).includes("rowheader"));
    if (lang === "en" && width === 1440) {
      await page.locator("#mute").click();
      await page.locator(".acoustic summary").click();
      await page.locator("#speed").selectOption("1.5");
      await page.locator("#compare").click();
      await page.waitForFunction(() => document.querySelector("#frame").dataset.event === "india:1");
      assert.equal(await page.locator("#inset").getAttribute("data-event"), "india:1");
      assert.match(await page.locator("#play-status").textContent(), /Listening scan in progress/);
      await page.locator("#pause").click();
      await page.locator("#replay").click();
      assert.equal(await page.locator("#frame").getAttribute("data-event"), "europe:1");
      await page.locator("#pause").click();
    }
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`Audio, clock-synchronized image and evidence, keyboard and layout passed (${lang}, ${width}px).`);
  }

  const page = await browser.newPage({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", { value: class { constructor() { throw new Error("Unavailable"); } } });
    Object.defineProperty(window, "webkitAudioContext", { value: undefined });
  });
  await page.goto(base);
  await page.locator("#listen").click();
  await page.waitForFunction(() => document.querySelector("#play-status").textContent.includes("Audio is unavailable"));
  await page.locator("#pause").click();
  await page.locator("#silent-entry").click();
  await page.locator(".acoustic summary").click();
  await page.locator("#speed").selectOption("1.5");
  await page.locator("#compare").click();
  await page.waitForFunction(() => document.querySelector("#frame").dataset.event === "india:1");
  assert.equal(await page.locator("#inset").getAttribute("data-event"), "india:1");
  assert.match(await page.locator("#play-status").textContent(), /Visual scan/);
  await page.locator("#pause").click();
  await page.locator("#second").selectOption("europe");
  assert.ok(await page.locator("#compare").isDisabled());
  console.log("Audio failure recovery, silent comparison command, synchronized region boundary and same-region validation passed.");
} finally { await browser.close(); }
