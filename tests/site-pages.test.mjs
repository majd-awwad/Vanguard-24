import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cellBounds, cellId, cellSize, fill, formatLat, formatLon, parseCellId, textureCrop, transmission, trimNumber, windowStats } from "../web/cinematic/site/cells.js";
import { applySettings, defaults, loadSettings, resolveLanguage, sanitize, saveSettings } from "../web/cinematic/site/settings.js";
import { NAV_ITEMS, hrefFor, navText } from "../web/cinematic/site/nav.js";
import { NATIVE, RAW_SHA256, REFERENCES, scienceCopy } from "../web/cinematic/site/science-copy.js";
import { scienceModel } from "../web/cinematic/site/science.js";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const data = JSON.parse(read("web/assets/decode/data/dust-geos-fp-20250819-1930-north-africa-med.json"));
const fakeStorage = () => { const map = new Map(); return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) }; };

test("cell names count rows from the north and columns from the west", () => {
  assert.equal(cellId(0, 0), "A1");
  assert.equal(cellId(5, 7), "F8");
  assert.deepEqual(parseCellId("B3"), { row: 1, col: 2 });
  const b = cellBounds(data.bounds, data.levels.advanced, 0, 0);
  assert.equal(b.north, data.bounds.north);
  assert.equal(b.west, data.bounds.west);
  const last = cellBounds(data.bounds, data.levels.advanced, 5, 7);
  assert.equal(last.south, data.bounds.south);
  assert.equal(last.east, data.bounds.east);
  assert.deepEqual(cellSize(data.bounds, data.levels.advanced), { lat: 5, lon: 8.75 });
});

test("formatting helpers", () => {
  assert.equal(formatLat(-15), "15°S");
  assert.equal(formatLon(-20), "20°W");
  assert.equal(trimNumber(8.75), "8.75");
  assert.equal(fill("{a}-{b}", { a: 1 }), "1-{b}");
  assert.equal(windowStats(data.source.time).hours, 3);
  assert.ok(Math.abs(transmission(0.2) - 0.8187) < 1e-4);
});

test("texture crop maps bounds exactly onto the equirectangular texture", () => {
  const crop = textureCrop(data.bounds);
  assert.ok(Math.abs(crop.aspect - 70 / 30) < 1e-9);
  assert.ok(Math.abs(crop.sizeX - 360 / 70 * 100) < 1e-9);
  assert.ok(Math.abs(crop.posY - 30) < 1e-9);
});

test("settings validate, persist and never throw", () => {
  assert.deepEqual(sanitize({ volume: 9, speed: 3, textSize: "huge", language: "fr", contrast: "yes" }), { ...defaults, volume: 1 });
  const storage = fakeStorage();
  saveSettings({ language: "ar", contrast: true }, storage);
  assert.equal(loadSettings(storage).language, "ar");
  assert.equal(loadSettings(storage).contrast, true);
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.deepEqual(loadSettings(broken), sanitize(null));
  assert.doesNotThrow(() => saveSettings({ volume: 0.2 }, broken));
  assert.equal(resolveLanguage("http://x/a?lang=ar", defaults), "ar");
  assert.equal(resolveLanguage("http://x/a", { ...defaults, language: "ar" }), "ar");
  const root = { dataset: {}, lang: "", dir: "" };
  applySettings({ documentElement: root }, sanitize({ language: "ar", contrast: true }));
  assert.equal(root.dir, "rtl");
  assert.equal(root.dataset.contrast, "high");
});

test("navigation targets are consistent and every page text exists in both languages", () => {
  assert.equal(hrefFor("pages/science.html", "pages"), "./science.html");
  assert.equal(hrefFor("index.html", "root"), "./");
  assert.equal(hrefFor("index.html", "pages"), "../");
  assert.equal(hrefFor("pages/science.html", "root"), "./pages/science.html");
  for (const language of ["en", "ar"]) for (const item of NAV_ITEMS) assert.ok(navText[language][item.id]);
  const keys = (object) => Object.keys(object).sort().map((k) => (object[k] && typeof object[k] === "object" ? k + "{" + keys(object[k]) + "}" : k)).join();
  assert.equal(keys(scienceCopy.en), keys(scienceCopy.ar));
});

test("science copy constants agree with the repository's own documentation", () => {
  const docs = read("docs/decode-data.md");
  assert.ok(docs.includes(RAW_SHA256));
  assert.ok(read("science/decode/dust-extraction.json").includes(RAW_SHA256));
  assert.ok(docs.includes("0.25° latitude × 0.3125° longitude") && NATIVE.lat === 0.25 && NATIVE.lon === 0.3125);
  for (const ref of REFERENCES) {
    const known = ref.key === "svs" ? data.visualLink.svs : ref.href;
    assert.ok(docs.includes(known.replace(/\/$/, "")) || read("docs/source-status.md").includes(known) || read("README.md").includes(known) || read("science/decode/source-audit.md").includes(known), known);
  }
});

test("science model comes from the case and states no invented bands", () => {
  const m = scienceModel(data, "en");
  assert.equal(m.threshold, "0.2");
  assert.equal(m.variable, "DUEXTTAU");
  assert.equal(m.wavelength, "550");
  assert.equal(m.hours, "3");
  assert.equal(m.centre, "19:30 UTC");
  assert.equal(m.attenuation, "18.1");
  assert.deepEqual([m.advanced.lat, m.advanced.lon, m.quick.lat, m.quick.lon], ["5", "8.75", "10", "17.5"]);
  assert.equal(data.levels.advanced.truth.threshold, data.levels.quick.truth.threshold);
  const copy = JSON.stringify(scienceCopy);
  assert.ok(!/0\.10|moderate dust|low dust/i.test(copy.replace("“moderate” bands", "")));
  assert.ok(!/NASA logo|insignia/i.test(copy));
  assert.ok(!/\b(18|5)\s*(of|\/)\s*(48|12)\b/.test(copy), "must not reveal how many cells are positive");
});

test("pages never use the NASA logo and keep SVS 5669 out of the globe", () => {
  const css = read("web/cinematic/site/site.css") + read("web/cinematic/site/science.css");
  const js = read("web/cinematic/site/science.js");
  assert.ok(!/nasa-logo|insignia|meatball/i.test(css + js));
  assert.ok(!/svs-5669/.test(read("web/cinematic/scene.js")));
});

import { aboutCopy, TEAM } from "../web/cinematic/site/about-copy.js";
import { decorativeWavePath } from "../web/cinematic/site/about.js";

test("about page: six names, no photos or bios, no benefit claims, no NASA endorsement", () => {
  assert.deepEqual([...TEAM], ["Mohammad", "Andreh", "Yaman", "Roaa", "Israa", "Majd"]);
  const copy = JSON.stringify(aboutCopy.en);
  assert.ok(/listening study[^"]*planned/i.test(copy));
  assert.ok(/not endorsed by NASA/.test(copy));
  assert.ok(!/proven|improves outcomes|clinically/i.test(copy));
  assert.ok(!/<img/.test(read("web/cinematic/site/about.js")));
  const keys = (o) => Object.keys(o).sort().map((k) => (o[k] && typeof o[k] === "object" ? k + "{" + keys(o[k]) + "}" : k)).join();
  assert.equal(keys(aboutCopy.en), keys(aboutCopy.ar));
  assert.equal(aboutCopy.en.cards.length, 4);
  assert.equal(aboutCopy.ar.cards.length, 4);
});

test("decorative waveform is fixed, finite and independent of any data", () => {
  const path = decorativeWavePath();
  assert.equal(path, decorativeWavePath());
  assert.ok(!/NaN|Infinity/.test(path));
});

import { calibration, cellSound, panWord } from "../web/cinematic/site/sound.js";
import { soundCopy } from "../web/cinematic/site/sound-copy.js";
import { COMPLETED_KEY, allowSpoilersThisVisit, isDecodeCompleted, markDecodeCompleted, resetOverrideForTests, spoilersUnlocked } from "../web/cinematic/site/progress.js";
import { makeSpatialPlan } from "../web/audio/spatial-plan.js";

test("sound lab reads pitch, pan and gain from the real plan, never from typed numbers", () => {
  const cal = calibration(data);
  assert.equal(cal.left, -1);
  assert.equal(cal.right, 1);
  assert.equal(cal.high, 880);
  assert.equal(cal.low, 220);
  assert.ok(cal.quiet < cal.loud);
  // A measured cell: B2 on the quick grid is row 1, col 1.
  const sound = cellSound(data, "quick", 1, 1);
  const planEvent = makeSpatialPlan(data, { level: "quick", mode: "cell", cells: [[1, 1]] }).events[0];
  assert.deepEqual(sound.tone, planEvent.tone);
  assert.equal(sound.tone.frequencyHz, 440);
  // Cells below the threshold are silent in this mapping.
  assert.equal(cellSound(data, "quick", 0, 0).tone, null);
  assert.equal(panWord(-0.33, soundCopy.en), "left");
  const keys = (o) => Object.keys(o).sort().map((k) => (o[k] && typeof o[k] === "object" ? k + "{" + keys(o[k]) + "}" : k)).join();
  assert.equal(keys(soundCopy.en), keys(soundCopy.ar));
});

test("sound lab copy claims none of the rejected reference-image rules", () => {
  const copy = JSON.stringify(soundCopy);
  assert.ok(!/richness|texture|0\.8\s*[–-]\s*1\.2|higher dust value.{0,20}higher pitch/i.test(copy));
  assert.ok(/farther north/.test(copy) && /west to east/.test(copy));
});

test("spoiler flag persists, never throws, and 'show anyway' is per visit", () => {
  const storage = fakeStorage();
  resetOverrideForTests();
  assert.equal(isDecodeCompleted(storage), false);
  assert.equal(spoilersUnlocked({ completedStorage: storage, overrideStorage: fakeStorage() }), false);
  markDecodeCompleted(storage);
  assert.equal(storage.getItem(COMPLETED_KEY), "1");
  assert.equal(spoilersUnlocked({ completedStorage: storage, overrideStorage: fakeStorage() }), true);
  resetOverrideForTests();
  const broken = { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); } };
  assert.equal(isDecodeCompleted(broken), false);
  assert.doesNotThrow(() => markDecodeCompleted(broken));
  assert.equal(spoilersUnlocked({ completedStorage: fakeStorage(), overrideStorage: broken }), false);
  allowSpoilersThisVisit(broken);
  assert.equal(spoilersUnlocked({ completedStorage: fakeStorage(), overrideStorage: broken }), true);
  resetOverrideForTests();
});

test("the Decode completion flag is only set by a finished discovery session", () => {
  const main = read("web/cinematic/main.js");
  assert.match(main, /phase === "reveal" && snapshot\.mode === "discovery"\) markDecodeCompleted/);
});

import { hasVoice } from "../web/cinematic/site/settings-page.js";
import { settingsCopy } from "../web/cinematic/site/settings-copy.js";
import { decodeMessage } from "../web/i18n/decode-messages.js";
import { h } from "../web/cinematic/site/dom.js";

test("ARIA booleans become real strings", () => {
  const el = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, append() {} };
  const doc = { createElement: () => el };
  h(doc, "button", { "aria-pressed": true, "aria-selected": false, checked: true, hidden: false });
  assert.equal(el.attrs["aria-pressed"], "true");
  assert.equal(el.attrs["aria-selected"], "false");
  assert.equal(el.attrs.checked, "");
  assert.ok(!("hidden" in el.attrs));
});

test("settings page: only real controls, real shortcuts, voice gating", () => {
  assert.equal(hasVoice([{ lang: "en-US" }], "ar"), false);
  assert.equal(hasVoice([{ lang: "ar-SA" }], "ar"), true);
  assert.equal(hasVoice([], "en"), false);
  const src = read("web/cinematic/site/settings-page.js");
  assert.match(src, /typeof|setSpeed/);
  for (const key of ["arrows", "space", "enter", "p", "l", "r", "s"]) {
    assert.ok(decodeMessage("en", "grid.shortcut." + key), key);
    assert.ok(decodeMessage("ar", "grid.shortcut." + key), key);
  }
  const keys = (o) => Object.keys(o).sort().map((k) => (o[k] && typeof o[k] === "object" ? k + "{" + keys(o[k]) + "}" : k)).join();
  assert.equal(keys(settingsCopy.en), keys(settingsCopy.ar));
  // Shortcuts the grids really implement: sound.js and decode-grid.js.
  const grid = read("web/accessibility/decode-grid.js");
  assert.ok(/ArrowUp/.test(grid) && /"enter"/.test(grid));
  const sound = read("web/cinematic/site/sound.js");
  assert.ok(/ArrowUp/.test(sound) && /"Home"/.test(sound) && /"End"/.test(sound));
});

test("every site page and the Decode 3D page link to the shared settings and nav", () => {
  for (const file of ["web/pages/science.html", "web/pages/about.html", "web/pages/settings.html", "web/pages/explore.html", "web/pages/studio.html"]) {
    const html = read(file);
    assert.ok(html.includes('id="site-nav"'), file);
    assert.ok(html.includes("site/site.css"), file);
  }
  assert.ok(read("web/cinematic/main.js").includes("mountNav"));
});

import { compareValues, levelMax, cellOf, ZOOM_MAX, ZOOM_MIN } from "../web/cinematic/site/explore.js";
import { exploreCopy } from "../web/cinematic/site/explore-copy.js";
import { mountCellGrid } from "../web/cinematic/site/cell-grid.js";

test("explore: comparison is numerical, pure and handles missing values", () => {
  assert.deepEqual(compareValues(0.3, 0.1), { difference: 0.19999999999999998, higher: "a" });
  assert.equal(compareValues(0.1, 0.1).higher, null);
  assert.equal(compareValues(null, 0.1), null);
  const snapshot = { grid: { cells: [{ row: 0, col: 0, value: 0.2 }, { row: 0, col: 1, value: null }, { row: 1, col: 0, value: 0.5 }] } };
  assert.equal(levelMax(snapshot), 0.5);
  assert.equal(cellOf(snapshot, 1, 0).value, 0.5);
  assert.ok(ZOOM_MIN === 1 && ZOOM_MAX > 1);
});

test("explore: copy parity, spoiler lock wiring, learning mode, no invented content", () => {
  const keys = (o) => Object.keys(o).sort().map((k) => (o[k] && typeof o[k] === "object" ? k + "{" + keys(o[k]) + "}" : k)).join();
  assert.equal(keys(exploreCopy.en), keys(exploreCopy.ar));
  const src = read("web/cinematic/site/explore.js");
  assert.match(src, /spoilersUnlocked\(\)/);
  assert.match(src, /mode: "learning"/);
  assert.match(src, /hearCell\(/, "listening plays the recordings for the cell");
  assert.ok(!/type: "probe"|type: "play"/.test(src), "no synthetic Decode tones on Explore Earth");
  assert.ok(!/rainfall|timeline|global/i.test(JSON.stringify(exploreCopy)));
  assert.match(JSON.stringify(exploreCopy.en), /positions inside a cell are artistic/);
});

test("cell grid: roving tabindex, geography never mirrors, aria states are strings", () => {
  const made = [];
  const node = (tag) => { const n = { tag, attrs: {}, children: [], style: {}, dataset: {}, listeners: {},
    setAttribute(k, v) { n.attrs[k] = String(v); }, removeAttribute(k) { delete n.attrs[k]; }, append(...c) { n.children.push(...c); }, replaceChildren() { n.children = []; },
    addEventListener(t, f) { n.listeners[t] = f; }, closest: () => n, focus() { n.focused = true; }, set className(v) { n.attrs.class = v; }, set textContent(v) { n.text = v; }, set tabIndex(v) { n.attrs.tabindex = String(v); }, get tabIndex() { return Number(n.attrs.tabindex); } }; made.push(n); return n; };
  const doc = { createElement: node };
  const host = node("div");
  const api = mountCellGrid(doc, host, { rows: 2, cols: 3, label: "grid", describe: () => "cell", onChoose() {}, helpId: "help" });
  assert.equal(api.buttons.length, 2);
  assert.equal(api.buttons[0].length, 3);
  assert.equal(api.buttons[0][0].attrs.tabindex, "0");
  assert.equal(api.buttons[1][2].attrs.tabindex, "-1");
  api.setSelected({ a: [0, 1], b: [1, 2] });
  assert.equal(api.buttons[0][1].attrs["aria-selected"], "true");
  assert.equal(api.buttons[0][1].dataset.role, "a");
  assert.equal(api.buttons[0][0].attrs["aria-selected"], "false");
  // ArrowRight from [0,0] goes east (col + 1) regardless of text direction.
  const target = api.buttons[0][0];
  target.dataset.row = "0"; target.dataset.col = "0";
  let prevented = false;
  host.listeners.keydown({ key: "ArrowRight", target, preventDefault() { prevented = true; } });
  assert.ok(prevented);
  assert.equal(api.buttons[0][1].focused, true);
});
