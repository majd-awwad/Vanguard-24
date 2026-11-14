import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const browserModule = process.env.EARTHPULSE_PLAYWRIGHT;
const { chromium } = await import(browserModule ? pathToFileURL(browserModule).href : "playwright");
const root = process.env.EARTHPULSE_URL ?? "http://127.0.0.1:4173/";
const data = JSON.parse(await readFile(new URL(
  "../web/assets/decode/data/dust-geos-fp-20250819-1930-north-africa-med.json", import.meta.url,
), "utf8"));
const means = [0, 1, 2].map(row => {
  const cells = data.levels.quick.cells.filter(cell => cell.row === row && cell.status !== "missing");
  return cells.reduce((sum, cell) => sum + cell.value, 0) / cells.length;
});
const winningRow = means.indexOf(Math.max(...means));
const browser = await chromium.launch({ executablePath: process.env.EARTHPULSE_BROWSER });

async function journey(lang, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto(new URL("?lang=" + lang, root).href);
    await page.locator("#dust-discovery").click();
    await page.locator("#guided-interface").waitFor();
    assert.equal(await page.locator("html").getAttribute("dir"), lang === "ar" ? "rtl" : "ltr");
    assert.equal(await page.locator(".guided-map-stage").getAttribute("dir"), "ltr");
    assert.equal(await page.locator("#guided-coast path").count(), 1);
    assert.equal(await page.locator("#guided-zones .guided-zone").count(), 3);
    assert.equal(await page.locator("#guided-readings dd, [data-strongest]").count(), 0);
    assert.equal(await page.locator("#guided-note").textContent(), "");
    assert.equal(await page.locator("#guided-context-image").getAttribute("src"), null);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);

    await page.locator("#guided-mute").click();
    assert.equal(await page.locator("#guided-mute").getAttribute("aria-pressed"), "true");
    await page.locator("#guided-example").click();
    assert.match(await page.locator("#guided-status").textContent(), lang === "ar" ? /تدريبي/ : /Practice/);
    assert.equal(await page.locator("#guided-zones [data-active]").count(), 0);
    await page.locator("#guided-compare").click();
    await page.locator("#guided-zones .guided-zone").first().locator(":scope[data-active]").waitFor();
    await page.locator("#guided-pulses i").first().waitFor();
    await page.locator("#guided-replay").click();
    await page.locator("#guided-transcript summary").click();
    await page.locator("#guided-transcript li").nth(2).waitFor();
    assert.equal(await page.locator("#guided-transcript li").count(), 3);
    await page.locator("#guided-listen-bands button").nth(2).click();
    await page.locator("#guided-zones .guided-zone").nth(2).locator(":scope[data-active]").waitFor();
    assert.equal(await page.locator("#guided-transcript li").count(), 1);
    const guessed = page.locator("#guided-options input").nth(winningRow);
    await guessed.focus();
    await page.keyboard.press("Space");
    assert.equal(await guessed.isChecked(), true);
    await page.locator("#guided-guess button").focus();
    await page.keyboard.press("Enter");
    await page.locator("#guided-result").waitFor();
    assert.equal(await page.locator(":focus").getAttribute("id"), "guided-result-title");
    const names = lang === "ar" ? ["الشمال", "الوسط", "الجنوب"] : ["North", "Middle", "South"];
    assert.ok((await page.locator("#guided-result-title").textContent()).endsWith(names[winningRow]));
    assert.equal(await page.locator("#guided-zones [data-strongest]").count(), 1);
    assert.equal(await page.locator(".guided-bar").count(), 3);
    assert.equal(await page.locator(".guided-bar div").nth(winningRow).evaluate(bar => bar.style.inlineSize), "100%");
    const formatter = new Intl.NumberFormat(lang, { maximumSignificantDigits: 6 });
    for (const [row, mean] of means.entries()) {
      assert.ok((await page.locator("#guided-readings dd").nth(row).textContent()).includes(formatter.format(mean)));
    }
    await page.locator("#guided-note").waitFor();
    await page.locator("#guided-context-image").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector("#guided-context-image").naturalWidth === 1920);
    assert.match(await page.locator("#guided-note").textContent(), lang === "ar" ? /تشغيل منفصل/ : /separate GEOS-FP 2 km Replay/);
    assert.equal(await page.locator("#guided-sources a").last().getAttribute("href"), data.visualLink.svs);
    await page.locator("#guided-reset").click();
    assert.equal(await page.locator("#guided-readings dd, [data-strongest]").count(), 0);
    assert.equal(await page.locator("#guided-note").textContent(), "");
    assert.equal(await page.locator("#guided-context-image").getAttribute("src"), null);

    for (const [level, count] of [["quick", 12], ["advanced", 48]]) {
      await page.locator("#guided-" + level).click();
      await page.locator("#decode-interface").waitFor();
      assert.equal(await page.locator("html").getAttribute("lang"), lang);
      for (let step = 0; step < 3; step++) await page.locator("#decode-next").click();
      const cells = page.getByRole("gridcell");
      assert.equal(await cells.count(), count);
      await cells.first().focus();
      await page.keyboard.press("Space");
      assert.equal(await cells.first().getAttribute("aria-selected"), "true");
      await page.keyboard.press("s");
      await page.locator("#decode-evidence").waitFor();
      assert.equal(await page.locator("#decode-readings tr").count(), count);
      await page.locator("#decode-guide").click();
      await page.locator("#guided-interface").waitFor();
    }
    assert.deepEqual(errors, []);
    console.log(`Guided Discovery and both Decode grids: ${lang}, ${width}px passed.`);
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
