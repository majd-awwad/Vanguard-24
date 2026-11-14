import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const { chromium } = await import(process.env.EARTHPULSE_PLAYWRIGHT
  ? pathToFileURL(process.env.EARTHPULSE_PLAYWRIGHT).href : "playwright");
const base = process.env.EARTHPULSE_URL ?? "http://127.0.0.1:4173/";

async function journey(flat) {
  const browser = await chromium.launch({
    executablePath: process.env.EARTHPULSE_BROWSER,
    args: flat ? ["--disable-webgl"] : ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  try {
    const page = await browser.newPage({ viewport: flat ? { width: 390, height: 844 } : { width: 1440, height: 960 },
      reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(new URL("?lang=ar", base).href);
    assert.equal(new URL(await page.locator("#forest-entry").getAttribute("href"), page.url()).searchParams.get("lang"), "ar");
    await page.locator("#cinematic-entry").click();
    await page.waitForFunction(() => document.body.dataset.caseReady !== undefined);
    assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
    assert.equal(await page.locator("body").getAttribute("data-renderer"), flat ? "svg" : "webgl");
    if (flat) assert.equal(await page.locator(".cine-rail").isVisible(), false);
    const guide = page.locator("#cine-play-guide");
    await guide.click();
    await page.waitForFunction(() => {
      const canvas = document.querySelector("#cine-wave");
      const context = canvas.getContext("2d");
      const upperHalf = context.getImageData(0, 0, canvas.width, Math.floor(canvas.height / 2) - 1);
      return upperHalf.data.some((channel, index) => index % 4 === 3 && channel > 0);
    });
    assert.equal(await guide.getAttribute("aria-pressed"), "true");
    await guide.click();
    await page.locator(flat ? "#cine-skip" : "#cine-start").focus();
    await page.keyboard.press("Enter");
    await page.locator("#decode-play").waitFor();
    assert.equal(await page.locator(":focus").getAttribute("id"), "decode-phase");
    assert.match(await page.locator("#decode-phase").textContent(), /استماع/);
    assert.ok(await page.locator("#decode-grid button").count() > 0);
    const next = page.locator("#decode-next");
    await next.focus();
    await page.keyboard.press("Enter");
    const cell = page.locator('#decode-grid [role="gridcell"] button, #decode-grid button[role="gridcell"]').first();
    await cell.focus();
    await page.keyboard.press("Space");
    await page.locator("#decode-submit").focus();
    await page.keyboard.press("Enter");
    await page.locator("#decode-evidence").waitFor();
    assert.equal(await page.locator("#decode-readings tr").count(), 12);
    assert.match(await page.locator("#decode-source").getAttribute("href"), /^https:\/\/portal\.nccs\.nasa\.gov\//);
    for (const [id, anchor] of [["cine-nav-science", "#lens"], ["cine-nav-dataset", "#atlas"]]) {
      const link = page.locator("#" + id);
      assert.ok(await link.isVisible());
      const target = new URL(await link.getAttribute("href"), page.url());
      assert.equal(target.hash, anchor);
      assert.equal(target.searchParams.get("lang"), "ar");
      const response = await page.request.get(target.href);
      assert.ok(response.ok());
      assert.match(await response.text(), new RegExp(`id="${anchor.slice(1)}"`));
    }
    const silent = new URL(await page.locator("#cine-text").getAttribute("href"), page.url());
    assert.equal(silent.searchParams.get("condition"), "text");
    assert.equal(silent.searchParams.get("lang"), "ar");
    await page.goto(silent.href);
    await page.locator("#decode-next").waitFor();
    assert.deepEqual(errors, []);
    console.log(flat ? "Cinematic 2D fallback passed at 390px." : "Cinematic WebGL and Arabic source navigation passed.");
  } finally {
    await browser.close();
  }
}

await journey(false);
await journey(true);
