import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const { chromium } = await import(process.env.EARTHPULSE_PLAYWRIGHT
  ? pathToFileURL(process.env.EARTHPULSE_PLAYWRIGHT).href
  : "playwright");
const browser = await chromium.launch({ executablePath: process.env.EARTHPULSE_BROWSER, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, reducedMotion: "reduce" });
const base = process.env.EARTHPULSE_URL ?? "http://127.0.0.1:4173/";
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => { if (!response.ok()) errors.push(`${response.status()} ${response.url()}`); });

try {
  await page.goto(new URL("pages/studio.html", base).href, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "The Studio shows the Decode answers" }).waitFor();
  await page.getByRole("button", { name: "Show anyway (spoils the challenge)" }).click();

  await page.locator("#st-date").waitFor({ state: "visible" });
  await page.locator(".st-map canvas").waitFor({ state: "visible" });
  assert.match(await page.locator(".st-map").getAttribute("data-renderer"), /^(webgl|2d)$/);
  assert.match(await page.locator("#st-date-info").textContent(), /2025/);
  assert.match(await page.locator(".st-understand").textContent(), /NASA GMAO GEOS-FP|Move over the map/);
  assert.notEqual(await page.locator(".st-hud-cell").textContent(), "—", "guided start must select one real cell");
  assert.equal(await page.locator(".st-area-panel").isVisible(), false, "advanced area tools start collapsed");
  if (process.env.EARTHPULSE_SCREENSHOT) await page.screenshot({ path: process.env.EARTHPULSE_SCREENSHOT, fullPage: true });

  await page.locator("#st-date").selectOption("geos-fp-dust-20250715-1930");
  await page.waitForFunction(() => document.querySelector("#st-date")?.value === "geos-fp-dust-20250715-1930");
  assert.match(await page.locator("#st-date-info").textContent(), /July|2025|07/);

  await page.getByRole("button", { name: "Enable sound" }).click();
  assert.equal(await page.getByRole("button", { name: "Mute sound" }).getAttribute("aria-pressed"), "true");
  await page.locator(".st-map").press("ArrowRight");
  await page.locator(".st-map").press("r");
  await page.getByRole("button", { name: "Play visible area" }).click();
  await page.waitForFunction(() => /Playing/.test(document.querySelector(".st-run")?.textContent ?? document.body.textContent));
  await page.getByRole("button", { name: "Stop" }).click();

  assert.equal(errors.length, 0, errors.join("\n"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(new URL("pages/studio.html?lang=ar", base).href, { waitUntil: "networkidle" });
  await page.locator("#st-date").waitFor({ state: "visible" });
  assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
  assert.equal(await page.locator(".st-map canvas").isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "mobile layout must not overflow horizontally");
  if (process.env.EARTHPULSE_MOBILE_SCREENSHOT) await page.screenshot({ path: process.env.EARTHPULSE_MOBILE_SCREENSHOT, fullPage: true });
  console.log("Yaman dust studio lock, real catalog, renderer, date selection, keyboard, audio and scan passed.");
} finally {
  await browser.close();
}
