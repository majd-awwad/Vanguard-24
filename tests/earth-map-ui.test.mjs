import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { REQUIRED_FIELDS, buildManifest } from "../scripts/earth-map/provenance.mjs";
import { EXCLUDED_PHENOMENA, TARGET, toLF } from "../scripts/earth-map/copy-package.mjs";
import { analysisCopy } from "../web/studio/analysis-copy.js";
import { mapCopy } from "../web/studio/earthmap-copy.js";
import { PHENOMENA } from "../web/studio/datasets.js";
import { ANOMALY_REASON } from "../web/studio/hunter-core.js";

const text = async (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const json = async (path) => JSON.parse(toLF(await readFile(new URL(path, "file:///" + TARGET.replace(/\\/g, "/") + "/"))).toString("utf8"));
const keys = (o) => Object.keys(o).sort().map((k) => (o[k] && typeof o[k] === "object" && !Array.isArray(o[k]) ? k + "{" + keys(o[k]) + "}" : k)).join();

test("SOURCE: the provenance manifest has every spec 09.2 field for every dataset, all model data", async () => {
  const master = await json("catalog.json");
  const catalogs = {}; const snapshots = {}; const grids = {};
  for (const id of Object.keys(master.phenomena).filter((phenomenon) => !EXCLUDED_PHENOMENA.includes(phenomenon))) {
    catalogs[id] = await json(`${id}/catalog.json`);
    grids[id] = await json(`${id}/grid.json`);
    snapshots[id] = [];
    for (const entry of catalogs[id].snapshots) snapshots[id].push({ ...(await json(`${id}/${entry.path}`)), date: entry.date });
  }
  const manifests = buildManifest({ master, catalogs, snapshots, grids, verifiedAt: "2026-11-15" });
  assert.deepEqual(manifests.map((m) => m.phenomenon), ["dust", "rainfall", "wind"]);
  for (const m of manifests) {
    for (const field of REQUIRED_FIELDS) assert.ok(field in m, `${m.phenomenon}.${field}`);
    assert.equal(m.sourceType, "model");
    assert.match(m.sourceDatasetUrl, /^https:\/\/portal\.nccs\.nasa\.gov\/datashare\/gmao\/geos-fp\/das\/$/);
    assert.equal(m.sampleCount.snapshots, 13);
    assert.equal(m.geoCoverage.west, -20);
    assert.equal(m.buildLabels.length, 2);
    assert.ok(m.missingPolicy.includes("never replaced by zero"));
    assert.ok(Object.keys(m.assetHash.snapshots).length === 13);
    assert.ok(!/imerg|satellite/i.test(m.sourceProduct + m.variable), `${m.phenomenon} is never described as IMERG or satellite data`);
  }
  assert.equal(manifests.find((m) => m.phenomenon === "wind").eicVisualizationUrl, null);
  assert.match(manifests.find((m) => m.phenomenon === "rainfall").eicRelation, /RELATED_CONTEXT.*different/);
  assert.match(manifests.find((m) => m.phenomenon === "dust").eicRelation, /2025-08-19 only/);
});

test("SOURCE: wording stays honest: model data, never measured or observed; rainfall is not IMERG; no NASA logo", () => {
  for (const language of ["en", "ar"]) {
    const all = JSON.stringify(mapCopy[language]) + JSON.stringify(analysisCopy[language]);
    assert.ok(!/nasa[-_ ]?logo|insignia/i.test(all));
  }
  const en = JSON.stringify(mapCopy.en) + JSON.stringify(analysisCopy.en);
  assert.ok(!/\b(measured|observed)\b/i.test(en), "values are model data, not measured or observed");
  assert.match(mapCopy.en.info.dataTypeValue, /Model \(GEOS-FP\)/);
  assert.match(mapCopy.en.phen.forestsReason, /not available/i);
  assert.match(mapCopy.en.phen.forestsReason, /not a time series/);
  assert.ok(!/imerg/i.test(en.replace(/SVS 4285 \(IMERG, a different product\)/g, "")));
  assert.equal(PHENOMENA.rainfall.related[0].relation, "RELATED_CONTEXT");
  assert.match(analysisCopy.en.echo.note, /does not prove the same cause/);
  assert.equal(ANOMALY_REASON.includes("not a climatological baseline"), true);
});

test("copy parity: Arabic and English have the same keys for the whole Earth Map", () => {
  assert.equal(keys(mapCopy.en), keys(mapCopy.ar));
  assert.equal(keys(analysisCopy.en), keys(analysisCopy.ar));
});

test("SAFETY: no autoplay, one AudioContext, sound only after an explicit action, no stray speech calls", async () => {
  const studio = await text("web/studio/studio.js");
  const speech = await text("web/studio/speech.js");
  const audio = await text("web/studio/audio.js");
  assert.ok((studio.match(/audio\.enable\(/g) ?? []).length === 1, "audio.enable is called in exactly one place (the setSound handler)");
  assert.match(studio, /const setSound = async \(on\) => \{/);
  assert.match(studio, /if \(!audio\.enabled \|\| state\.busy\) return;/, "cursor sound needs enabled audio");
  assert.match(studio, /rec\.unlock\(\)/, "the audio context is created and resumed inside the sound button click");
  assert.match(studio, /start\.addEventListener\("click", \(\) => openModeDialog/, "the entry needs a click");
  assert.ok(!/AudioContext\(/.test(studio + audio), "the Studio creates no AudioContext itself: recordings.js (unlocked by the click) and the clock do");
  assert.ok(!/\.speak\(/.test(studio), "speech goes only through the speech manager");
  assert.equal((speech.match(/synth\.speak\(/g) ?? []).length, 1);
  assert.match(speech, /if \(mode !== GUIDED\) return false;/, "Pure Sonification never announces automatically");
  assert.match(studio, /store\.state\.soundMode === GUIDED/);
});

test("ACCESS-A: every main tool is a real control with a role and a name", async () => {
  const studio = await text("web/studio/studio.js");
  for (const needle of ['role: "application"', 'class: "st-rail", "aria-label"', 'role: "dialog"', '"aria-modal": "true"', 'role: "group"', "aria-pressed", 'aria-labelledby: "st-flyout-title"'.replace('aria-labelledby: ', '"aria-labelledby": ')]) assert.ok(studio.includes(needle), needle);
  assert.ok(!/<div[^>]*onclick/.test(studio));
  assert.match(studio, /if \(event\.key === "Escape"\) \{ speech\.cancel\(\); return; \}/);
  assert.match(studio, /"Home"/);
  const tools = await text("web/studio/tools.js");
  assert.match(tools, /event\.key === "Enter"/);
  const hunter = await text("web/studio/hunter-ui.js");
  assert.match(hunter, /id: "hunter-type"/);
  assert.match(await text("web/studio/studio-ui-kit.js"), /aria-live/);
});

test("RESPONSIVE: sticky map + scrolling cards on desktop, one column with a 55vh sticky map on phones, 44px targets, geography never mirrors", async () => {
  const css = await text("web/studio/earthmap.css");
  assert.ok(css.includes("@media (max-width: 1023px)"));
  assert.ok(css.includes(".st-mapcol { position: sticky"));
  assert.ok(css.includes("height: 55dvh"));
  assert.ok(css.includes("min-height: var(--target); border-radius: 10px"));
  const studio = await text("web/studio/studio.js");
  assert.ok(studio.includes("st-mapcol") && studio.includes("st-col"));
  assert.match(studio, /dir: "ltr", tabindex: "0", role: "application"/, "geography never mirrors");
});

test("the page still wires the shared nav and the dust-lock rule", async () => {
  const html = await text("web/pages/studio.html");
  assert.match(html, /id="site-nav"/);
  assert.match(html, /earthmap\.css/);
  const studio = await text("web/studio/studio.js");
  assert.match(studio, /isLocked\(/);
  assert.match(studio, /allowSpoilersThisVisit/);
  assert.match(studio, /lockedDates:/);
});
