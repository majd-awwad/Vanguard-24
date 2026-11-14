import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const browserModule = process.env.EARTHPULSE_PLAYWRIGHT;
const { chromium } = await import(browserModule ? pathToFileURL(browserModule).href : "playwright");
const base = new URL("decode.html", process.env.EARTHPULSE_URL ?? "http://127.0.0.1:4173/");
const browser = await chromium.launch({ executablePath: process.env.EARTHPULSE_BROWSER });
const fixture = new URL("./fixtures/decode-fixture.json", import.meta.url);

function hideSoundModule(page) {
  return page.route("**/audio/spatial-plan.js", route => route.fulfill({ status: 404, body: "" }));
}

try {
  for (const language of ["en", "ar"]) {
    const url = new URL(base);
    url.searchParams.set("lang", language);
    const page = await browser.newPage({ viewport: { width: 375, height: 700 }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("https://svs.gsfc.nasa.gov/**", route => route.abort());
    await hideSoundModule(page);
    await page.goto(url.href);
    await page.waitForFunction(() => /waiting for|بانتظار/.test(document.querySelector("#decode-state").textContent));
    assert.equal(await page.getByRole("grid").count(), 0);
    assert.equal(await page.locator("#decode-frame").getAttribute("href"), null);

    await page.evaluate(async language => {
      const { mountDecode } = await import("./decode.js");
      const { createTransport } = await import("./audio/transport.js");
      const { mountDecodeVisual } = await import("./visual/decode-visual.js");
      let seconds = 0;
      window.advanceDecodeClock = () => { seconds += 61; };
      const transport = createTransport({
        now: () => seconds,
        createContext() { throw new Error("Unexpected audio in test"); },
      });
      function makePlan(data, { level, mode }) {
        return {
          caseId: data.id, level, mode, mappingVersion: "test-only", durationS: 60,
          events: [{ id: "silent-slot", row: 0, col: 0, onsetS: 0, tone: null }],
        };
      }
      window.decodeOptions = {
        language, makePlan, heardClass: () => "silent", testPlayback: true,
        transport: { ...transport, play: () => transport.play("silent") },
        mountVisual(root, session, { geography }) {
          window.testGeography = geography;
          const stop = session.subscribe(({ activeCell }) => {
            root.dataset.testActiveCell = activeCell?.join(",") ?? "";
          });
          const visual = mountDecodeVisual(root, session, { t: (key) => key, geography });
          window.clearRevealCalls = 0;
          return {
            ...visual,
            clearReveal() {
              window.clearRevealCalls++;
              visual.clearReveal();
            },
            dispose() {
              stop();
              visual.dispose();
            },
          };
        },
      };
      window.decodeTest = await mountDecode(document.querySelector("#decode-page"), window.decodeOptions);
    }, language);

    const visible = selector => page.locator(selector).isVisible();
    const click = id => page.locator("#decode-" + id).click();
    assert.match(await page.locator("#decode-notice").textContent(), language === "ar" ? /محاكى/ : /simulated playback/);
    assert.equal(await page.locator("html").getAttribute("dir"), language === "ar" ? "rtl" : "ltr");
    assert.equal(await page.locator("#decode-stage").getAttribute("dir"), "ltr");
    assert.deepEqual(await page.evaluate(() => window.testGeography), {
      caseId: "dust-geos-fp-20250819-1930-north-africa-med", projection: "plate-carree",
      bounds: { north: 45, south: 15, east: 50, west: -20 },
    });
    assert.equal(await visible("#decode-evidence"), false);
    assert.equal(await page.locator("#decode-readings tr").count(), 0);
    assert.equal(await page.locator("#decode-context-image").getAttribute("src"), null);
    assert.equal(await page.locator("#decode-steps [aria-current='step']").count(), 1);
    await click("next");
    assert.equal(await page.locator("#decode-legend li:visible").count(), 3);
    assert.equal(await page.locator(":focus").getAttribute("id"), "decode-phase");
    await click("play");
    assert.equal(await page.locator("#decode-visual").getAttribute("data-test-active-cell"), "");
    await click("next");
    assert.equal(await page.locator("#decode-replay").isEnabled(), false);
    await click("play");
    assert.equal(await page.locator("#decode-visual").getAttribute("data-test-active-cell"), "0,0");
    assert.equal(await page.locator(".dg-cell[data-playing]").count(), 1);
    assert.equal(await page.locator(".dg-cell[data-playing]").getAttribute("data-col"), "0");
    assert.equal(await page.locator("[data-evidence]").count(), 0);
    await click("pause");
    assert.equal(await page.locator(".dg-cell[data-playing]").count(), 0);
    assert.equal(await page.locator("#decode-visual").getAttribute("data-test-active-cell"), "");
    await click("mute");
    assert.equal(await page.locator("#decode-mute").getAttribute("aria-pressed"), "true");
    await click("replay");
    assert.equal(await page.locator("#decode-visual").getAttribute("data-test-active-cell"), "0,0");
    assert.equal(await page.locator(".dg-cell[data-playing]").count(), 1);
    await click("next");
    assert.equal(await page.locator(".dg-cell[data-playing]").count(), 0);

    const grid = page.getByRole("grid");
    const cells = grid.getByRole("gridcell");
    assert.equal(await grid.count(), 1);
    assert.equal(await grid.getAttribute("aria-multiselectable"), "true");
    assert.equal(await cells.count(), 12);
    assert.equal(await grid.locator('[tabindex="0"]').count(), 1);
    const a11yBefore = await grid.ariaSnapshot();
    assert.match(a11yBefore, language === "ar" ? /الصف/ : /Row/i);
    assert.doesNotMatch(a11yBefore, /below|missing|measurement|القراءة|التخمينات الصحيحة/i);
    assert.equal(await page.locator("#decode-context").getAttribute("href"), null);
    assert.equal(await page.locator(".decode-reveal-markers, .decode-reveal-labels").count(), 0);
    assert.equal(await visible("#decode-evidence"), false);
    for (const id of ["decode-play", "decode-replay", "decode-mute", "decode-submit", null]) {
      await page.keyboard.press("Tab");
      assert.equal(await page.locator(":focus").getAttribute("id"), id);
    }
    assert.equal(await page.locator(":focus").getAttribute("data-col"), "0");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator(":focus").getAttribute("data-col"), "1");
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.locator(":focus").getAttribute("data-row"), "1");
    await page.keyboard.press("Space");
    assert.equal(await page.locator(":focus").getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator(":focus").getAttribute("aria-selected"), "true");
    assert.match(await page.locator("#decode-selections").textContent(), /1|١/);
    await page.keyboard.press("Enter");
    assert.match(await page.locator("#decode-probe-reading").textContent(), language === "ar" ? /صامت/ : /Silent/);
    assert.equal(await page.locator(":focus").getAttribute("data-col"), "1");
    await page.keyboard.press("l");
    await page.evaluate(() => window.advanceDecodeClock());
    const completedLegend = language === "ar" ? "اكتملت معايرة الصوت." : "Sound calibration complete.";
    await page.waitForFunction(message => document.querySelector("#decode-status").textContent === message, completedLegend);
    await page.keyboard.press("p");
    await page.evaluate(() => window.advanceDecodeClock());
    const completedSweep = language === "ar" ? "اكتمل المسح الصوتي." : "Spatial sweep complete.";
    await page.waitForFunction(message => document.querySelector("#decode-status").textContent === message, completedSweep);
    await page.keyboard.press("s");
    await page.locator("#decode-evidence").waitFor({ state: "visible" });
    assert.equal(await page.locator("#decode-readings tr").count(), 12);
    assert.equal(await page.locator('.dg-cell[data-evidence="measured"]').count(), 5);
    const finding = await page.locator("#decode-finding").textContent();
    assert.match(finding, /(?:5|٥)/);
    assert.match(finding, /(?:12|١٢)/);
    assert.match(await page.locator("#decode-context-image").getAttribute("src"), /svs-5669-context\.webp$/);
    await page.locator("#decode-context-image").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector("#decode-context-image").naturalWidth === 1920);
    await page.locator("#decode-details-title").click();
    assert.equal(await page.locator("#decode-readings tr").first().isVisible(), true);
    await page.locator("#decode-details-title").click();
    await page.locator(".dg-cell[data-row='1'][data-col='1']").focus();
    assert.match(await page.locator("#decode-source").getAttribute("href"), /^https:\/\/portal\.nccs\.nasa\.gov\//);
    assert.equal(await page.locator("#decode-context").getAttribute("href"), "https://svs.gsfc.nasa.gov/5669/");
    const selectedCell = await page.locator(":focus").ariaSnapshot();
    assert.match(selectedCell, /\[selected\]/);
    const sourceNote = await page.locator("#decode-context-note").textContent();
    assert.match(sourceNote, language === "ar" ? /تشغيل منفصل/ : /separate/);
    const announcement = await page.locator("#decode-status").textContent();
    assert.match(announcement, language === "ar" ? /النتيجة/ : /Results:/);
    if (language === "ar") {
      const relationOffset = announcement.indexOf("سياق علمي مرتبط");
      assert.ok(relationOffset >= 0 && announcement.indexOf(sourceNote) > relationOffset);
      assert.doesNotMatch(announcement, /Numerical data/);
    }
    assert.equal(await page.locator(".decode-map-geography path").count(), 0);
    assert.deepEqual(await page.locator(".decode-reveal-markers > text").allTextContents(), ["–", "✓", "–", "–", "–"]);
    const outcomes = page.locator("#decode-outcome-labels li");
    assert.equal(await outcomes.count(), 5);
    assert.match(await outcomes.nth(1).textContent(), language === "ar" ? /اختيار صحيح/ : /Correct selection/);
    assert.equal(await page.locator("#decode-visual").getAttribute("aria-hidden"), "true");
    assert.equal(await outcomes.nth(1).isVisible(), true);
    assert.equal(await page.locator("#decode-outcome-labels").evaluate(element =>
      element.closest('[inert], [aria-hidden="true"]') === null), true);
    const layout = await page.evaluate(() => {
      const selected = document.querySelector('.dg-cell[data-row="1"][data-col="1"]').getBoundingClientRect();
      const marker = document.querySelector(".decode-reveal-correct");
      const origin = new DOMPoint(marker.x.baseVal[0].value, marker.y.baseVal[0].value)
        .matrixTransform(marker.getScreenCTM());
      const error = Math.max(Math.abs(origin.x - (selected.left + selected.width / 2)),
        Math.abs(origin.y - (selected.top + selected.height / 2)));
      return { error, overlay: getComputedStyle(document.querySelector("#decode-visual")).zIndex,
        fits: document.documentElement.scrollWidth === innerWidth };
    });
    assert.ok(layout.error < 0.5, JSON.stringify(layout));
    assert.equal(layout.overlay, "1");
    assert.equal(layout.fits, true);
    await page.keyboard.press("Space");
    assert.equal(await page.locator(":focus").getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator(":focus").getAttribute("aria-selected"), "true");
    await click("restart");
    assert.equal(await page.evaluate(() => window.clearRevealCalls), 1);
    assert.equal(await page.locator("[data-evidence]").count(), 0);
    assert.equal(await page.locator("#decode-context-image").getAttribute("src"), null);
    assert.equal(await page.locator(".decode-reveal-markers, .decode-reveal-labels").count(), 0);
    assert.equal(await visible("#decode-evidence"), false);
    assert.equal(await page.locator("#decode-readings tr").count(), 0);
    assert.equal(await page.locator("#decode-frame").getAttribute("href"), null);
    await click("next");
    await click("next");
    await click("next");
    await cells.first().click();
    await click("submit");
    assert.equal(await page.locator(".decode-reveal-correct").count(), 0);
    assert.equal(await page.locator(".decode-reveal-incorrect").count(), 1);
    assert.equal(await page.locator(".decode-reveal-missed").count(), 5);
    assert.equal(await outcomes.count(), 6);
    assert.match(await outcomes.first().textContent(), language === "ar" ? /اختيار خاطئ/ : /False selection/);
    assert.deepEqual(errors, []);
    await page.close();
    console.log("Decode production case with simulated transport, reduced motion and keyboard: " + language + " passed.");
  }

  const { readFile } = await import("node:fs/promises");
  const [data] = JSON.parse(await readFile(fixture, "utf8"));
  const parent = data.levels.quick.cells[0];
  const child = data.levels.advanced.cells[0];
  parent.value = child.value = null;
  parent.status = child.status = "missing";
  for (const level of Object.values(data.levels)) {
    level.truth.present = level.truth.present.filter(([row, col]) => row !== 0 || col !== 0);
  }
  for (const language of ["en", "ar"]) {
    const page = await browser.newPage();
    const url = new URL(base);
    url.searchParams.set("lang", language);
    await hideSoundModule(page);
    await page.goto(url.href);
    await page.waitForFunction(() => /waiting for|بانتظار/.test(document.querySelector("#decode-state").textContent));
    await page.evaluate(async ({ data, language }) => {
      const { mountDecode } = await import("./decode.js");
      const { validateDecodeCase } = await import("./contracts/validate.js");
      await mountDecode(document.querySelector("#decode-page"), {
        language, caseId: data.id, loadCase: async () => validateDecodeCase(data),
        makePlan: (data, { level, mode }) => ({ caseId: data.id, level, mode, durationS: 0, events: [] }),
        heardClass: () => "silent", testPlayback: true,
      });
    }, { data, language });
    assert.match(await page.locator("#decode-notice").textContent(), language === "ar" ? /اصطناعية/ : /synthetic demonstration data/i);
    for (let step = 0; step < 3; step++) await page.locator("#decode-next").click();
    await page.locator("#decode-submit").click();
    assert.equal(await page.locator("#decode-source").getAttribute("href"), null);
    assert.equal(await page.locator("#decode-frame").getAttribute("href"), null);
    assert.equal(await page.locator("#decode-context-image").getAttribute("src"), null);
    assert.match(await page.locator("#decode-readings").textContent(), language === "ar" ? /القراءة مفقودة/ : /Missing reading/);
    const announcement = await page.locator("#decode-status").textContent();
    assert.match(announcement, language === "ar" ? /الحالة ما فيها صورة أو قياسات من ناسا/ : /No NASA frame or measurements/i);
    if (language === "ar") assert.doesNotMatch(announcement, /Synthetic test data/i);
    assert.doesNotMatch(announcement, /provides related context|سياق علمي مرتبط/);
    assert.equal(await page.locator("#decode-status [lang=en]").count(), 0);
    await page.close();
    console.log("Decode fixture provenance, missing readings and localized Reveal: " + language + " passed.");
  }

  const bootstrap = await browser.newPage();
  await bootstrap.route("**/audio/spatial-plan.js", route => route.fulfill({
    contentType: "text/javascript",
    body: 'export const heardClass = () => "silent"; export const makeSpatialPlan = ({ id }, { level, mode }) => ({ caseId: id, level, mode, durationS: 0, events: [] });',
  }));

  const missing = "**/assets/decode/data/*.json";
  await bootstrap.route(missing, route => route.fulfill({ status: 404, body: "" }));
  await bootstrap.goto(base.href);
  await bootstrap.locator("#decode-retry").waitFor({ state: "visible" });
  assert.equal(await bootstrap.getByRole("grid").count(), 0);
  await bootstrap.unroute(missing);
  await bootstrap.locator("#decode-retry").click();
  await bootstrap.locator("#decode-next").waitFor({ state: "visible" });
  assert.match(await bootstrap.locator("#decode-method").textContent(), /dust aerosol optical depth/);
  assert.equal(await bootstrap.locator("#decode-retry").isVisible(), false);
  assert.equal(await bootstrap.locator("#decode-visual svg").count(), 1);
  console.log("Decode production bootstrap and failed-case recovery passed (test sound module).");
  await bootstrap.close();

  const live = await browser.newPage({ viewport: { width: 375, height: 700 }, reducedMotion: "reduce" });
  const liveErrors = [];
  live.on("pageerror", error => liveErrors.push(error.message));
  await live.addInitScript(() => {
    window.scheduledOscillators = 0;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args) {
      const result = start.apply(this, args);
      window.scheduledOscillators++;
      return result;
    };
  });
  await live.goto(base.href);
  await live.locator("#decode-next").click();
  await live.locator("#decode-play").click();
  await live.waitForFunction(() => window.scheduledOscillators === 6);
  await live.locator("#decode-next").click();
  await live.locator("#decode-play").click();
  await live.waitForFunction(() => window.scheduledOscillators === 11);
  await live.locator(".dg-cell[data-playing]").first().waitFor({ state: "visible" });
  assert.equal(await live.locator(".dg-cell[data-playing]").evaluate(cell =>
    cell.getAnimations({ subtree: true }).length), 0);
  await live.locator("#decode-pause").click();
  assert.equal(await live.locator(".dg-cell[data-playing]").count(), 0);
  assert.equal(await live.locator("#decode-state").textContent(), "");
  assert.equal(await live.locator("#decode-notice").isVisible(), false);
  await live.locator("#decode-next").click();
  await live.locator(".dg-cell[data-row='1'][data-col='1']").click();
  await live.locator("#decode-submit").click();
  assert.equal(await live.locator(".decode-reveal-correct").count(), 1);
  await live.locator("#decode-language").click();
  await live.locator("#decode-next").waitFor({ state: "visible" });
  assert.equal(await live.locator("html").getAttribute("dir"), "rtl");
  assert.equal(await live.locator("#decode-evidence").isVisible(), false);
  assert.deepEqual(liveErrors, []);
  console.log("Decode production modules scheduled six calibration tones and five dust tones through Web Audio.");
  await live.close();
} finally {
  await browser.close();
}
