import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const browserModule = process.env.EARTHPULSE_PLAYWRIGHT;
const { chromium } = await import(browserModule ? pathToFileURL(browserModule).href : "playwright");
const url = new URL("decode.html", process.env.EARTHPULSE_URL ?? "http://127.0.0.1:4173/").href;
const browser = await chromium.launch({ executablePath: process.env.EARTHPULSE_BROWSER });
try {
  for (const language of ["en", "ar"]) {
    const page = await browser.newPage({ viewport: { width: 375, height: 700 }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    // This fixture mounts its own session and isolates it from page bootstrap.
    await page.route("**/audio/spatial-plan.js", route => route.fulfill({ status: 404, body: "" }));
    await page.goto(url);
    await page.waitForFunction(() => /waiting for/.test(document.querySelector("#decode-state").textContent));
    await page.evaluate(async lang => {
      const { mountDecodeAccessibility } = await import("./decode.js");
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
      const { decodeMessage } = await import("./i18n/decode-messages.js");
      const stage = document.querySelector("#decode-stage");
      const fixtureNotice = document.createElement("p");
      fixtureNotice.id = "test-data-notice";
      fixtureNotice.textContent = decodeMessage(lang, "explore.fixtureDisclaimer");
      stage.before(fixtureNotice);
      const root = document.querySelector("#decode-grid");
      // Roaa's production stylesheet is a separate module. Use a neutral test layout.
      root.dir = "ltr";
      const listeners = new Set();
      let snapshot = {
        phase: "decode", caseId: "fixture-browser", mode: "discovery", condition: "sound",
        behavior: "continuous", level: "quick", focus: [0, 0], guesses: [], expectedCount: 1,
        grid: { rows: 3, cols: 4, cells: Array.from({ length: 12 }, (_, i) => ({
          row: Math.floor(i / 4), col: i % 4, lat: 3 - Math.floor(i / 4) - 0.5, lon: i % 4 + 0.5,
        })) },
        lastProbe: null, score: null, visualLink: null, planRevision: 0,
        transport: { status: "idle", positionS: 0, activeEventId: null, planRevision: 0,
          awaitingOnset: false, speed: 1, volume: 1, muted: true, playback: "silent", audioUnavailable: false },
      };
      const actions = [];
      const session = {
        getState: () => snapshot,
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        dispatch(intent) {
          actions.push(intent.type);
          if (intent.type === "focus") snapshot = { ...snapshot, focus: [intent.row, intent.col] };
          if (intent.type === "toggle") {
            const already = snapshot.guesses.some(([row, col]) => row === intent.row && col === intent.col);
            snapshot = { ...snapshot, guesses: already ? [] : [[intent.row, intent.col]] };
          }
          if (intent.type === "probe") snapshot = { ...snapshot, lastProbe: { row: intent.row, col: intent.col, heard: "high" } };
          if (intent.type === "submit") snapshot = { ...snapshot, phase: "reveal",
            score: { hits: 1, misses: 0, falseAlarms: 0, precision: 1, recall: 1, f1: 1, nearHits: 0 },
            visualLink: { svs: "", image: "", relation: "RELATED_CONTEXT", note: "Fixture only" } };
          for (const listener of listeners) listener(snapshot);
        },
      };
      window.fixtureActions = actions;
      window.fixtureMount = mountDecodeAccessibility(root, session, { language: lang });
    }, language);

    assert.match(await page.locator("#test-data-notice").textContent(), language === "ar" ? /اصطناعية/ : /synthetic/);
    const grid = page.getByRole("grid");
    assert.equal(await grid.count(), 1);
    assert.equal(await grid.getByRole("gridcell").count(), 12);
    assert.equal(await grid.locator('[tabindex="0"]').count(), 1);
    const before = await grid.ariaSnapshot();
    assert.match(before, language === "ar" ? /الصف/ : /Row/i);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").getAttribute("data-col"), "0");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator(":focus").getAttribute("data-col"), "1");
    await page.keyboard.press("Space");
    assert.deepEqual(await page.evaluate(() => window.fixtureActions), ["focus", "toggle"]);
    assert.equal(await page.locator(":focus").getAttribute("aria-pressed"), "true");
    await page.keyboard.press("Enter");
    await page.keyboard.press("r");
    assert.match(await page.locator("#decode-status").textContent(), language === "ar" ? /مرتفع/ : /high/i);
    assert.doesNotMatch(await page.locator("#decode-status").textContent(), /Fixture only/);
    await page.keyboard.press("s");
    assert.match(await page.locator("#decode-status").textContent(), /Fixture only/);
    await page.keyboard.press("Space");
    assert.deepEqual(await page.evaluate(() => window.fixtureActions), ["focus", "toggle", "probe", "submit"]);
    await page.evaluate(() => window.fixtureMount.dispose());
    assert.equal(await page.getByRole("grid").count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Decode accessibility fixture passed in Chromium (English and Arabic).");
} finally {
  await browser.close();
}
