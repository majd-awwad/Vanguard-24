import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PHENOMENON_IDS, openPackage } from "../web/studio/datasets.js";
import { AMBIENCE_PHENOMENA, DOCUMENTED_BREAKPOINTS, DUST_BREAKPOINTS, MIN_VALUE, RAIN_MIN_MM_H, breakpoints, fileFor, levelFor, percentile } from "../web/studio/ambience-core.js";
import { CROSSFADE_S, LEVEL_FADE_S, SLICE_FADE_S, SLICE_S, createRecordings } from "../web/studio/recordings.js";

const base = new URL("../web/assets/earthpulse-json/", import.meta.url);
const fetchImpl = async (u) => { const b = await readFile(new URL(u)); return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const pkg = await openPackage({ baseUrl: base, fetchImpl, digest: async (b) => createHash("sha256").update(b).digest("hex") });
const doc = await readFile(new URL("../docs/earth-map/SONIFICATION_MAPPING.md", import.meta.url), "utf8");
const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");

test("the recordings: every file matches the SHA-256 and byte size in manifest.json", async () => {
  const dir = new URL("../web/assets/ambient/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", dir), "utf8"));
  assert.equal(manifest.items.length, 9);
  for (const item of manifest.items) {
    const bytes = await readFile(new URL(item.file, dir));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256, item.file);
    assert.equal(bytes.length, item.bytes, item.file);
    assert.equal(item.license, "TO VERIFY", item.file + " licence stays marked to verify");
    assert.equal(item.file, fileFor(item.phenomenon === "rain" ? "rainfall" : item.phenomenon, item.level));
  }
});

test("breakpoints are the 33rd and 66th percentiles across the 13 dates (rain: values >= 0.1 mm/h), equal the documented constants and the docs", async () => {
  assert.equal(percentile([1, 2, 3, 4, 5], 0.5), 3);
  for (const id of AMBIENCE_PHENOMENA) {
    const phen = await pkg.openPhenomenon(id);
    assert.equal(phen.list.length, 13);
    const min = MIN_VALUE[id] ?? -Infinity;
    const bp = breakpoints(phen.list.map((s) => s.values), { min });
    assert.equal(bp.count, id === "rainfall" ? 1074 : 13 * 1000);
    assert.equal(bp.low, DOCUMENTED_BREAKPOINTS[id].low, id);
    assert.equal(bp.high, DOCUMENTED_BREAKPOINTS[id].high, id);
    assert.ok(doc.includes(bp.low.toPrecision(4)) && doc.includes(bp.high.toPrecision(4)), id + " breakpoints are documented");
  }
  assert.equal(DUST_BREAKPOINTS, DOCUMENTED_BREAKPOINTS.dust);
});

test("the level is chosen from the REAL value; silence below the threshold, and for missing values", async () => {
  const bp = { low: 1, high: 2 };
  assert.equal(levelFor({ phenomenon: "wind", value: 0.5, breakpoints: bp }), "low");
  assert.equal(levelFor({ phenomenon: "wind", value: 1.5, breakpoints: bp }), "mid");
  assert.equal(levelFor({ phenomenon: "dust", value: 2.1, breakpoints: bp }), "high");
  assert.equal(levelFor({ phenomenon: "wind", value: null, breakpoints: bp }), null);
  assert.equal(levelFor({ phenomenon: "wind", value: Number.NaN, breakpoints: bp }), null);
  assert.equal(RAIN_MIN_MM_H, 0.1);
  assert.equal(levelFor({ phenomenon: "rainfall", value: 0.0999, breakpoints: bp }), null, "below 0.1 mm/h is no measurable rain");
  assert.equal(levelFor({ phenomenon: "rainfall", value: 0.1, breakpoints: bp }), "low");
  const real = DOCUMENTED_BREAKPOINTS.wind;
  const wind = await pkg.openPhenomenon("wind");
  const rank = { low: 0, mid: 1, high: 2 };
  let last = -1;
  for (const v of [...wind.byDate("2025-04-15").values].sort((a, b) => a - b)) { const r = rank[levelFor({ phenomenon: "wind", value: v, breakpoints: real })]; assert.ok(r >= last, "a higher real value never plays a lower level"); last = r; }
  assert.deepEqual([...AMBIENCE_PHENOMENA], [...PHENOMENON_IDS], "every phenomenon of the app has its three recordings");
});

test("the engine: nothing before the user gesture, the specified fades, one volume", () => {
  let created = 0;
  const engine = createRecordings({ baseUrl: "http://localhost/", createContext: () => { created += 1; throw new Error("must not start"); } });
  engine.stop();
  engine.silence();
  engine.stopSlices();
  assert.equal(created, 0, "no audio context is created until unlock() or a requested level");
  assert.equal(engine.active, null);
  assert.equal(CROSSFADE_S, 0.5);
  assert.equal(LEVEL_FADE_S, 0.4);
  assert.equal(SLICE_S, 0.7);
  assert.equal(SLICE_FADE_S, 0.08);
  engine.setVolume(0.5);
  assert.equal(engine.gain, 0.5);
  engine.setDuck(true);
  assert.ok(engine.gain < 0.5);
  engine.setDuck(false);
  assert.equal(engine.gain, 0.5);
});

test("no synthetic data tones in the Studio, Explore Earth, Science examples or Echo; one volume, no sound-style selector, no separate ambience toggle", async () => {
  const studio = await read("web/studio/studio.js");
  const audio = await read("web/studio/audio.js");
  const echo = await read("web/studio/echo-ui.js");
  const explore = await read("web/cinematic/site/explore.js");
  const science = await read("web/cinematic/site/science-sound.js");
  const copy = await read("web/studio/studio-ui-copy.js");
  for (const [name, src] of [["studio.js", studio], ["audio.js", audio], ["echo-ui.js", echo], ["explore.js", explore], ["science-sound.js", science]]) {
    assert.ok(!/valueTones|stepTones|changeTones|valueHoverPlan|continuousVoice|crackleVoice|confirmationPlan|makeSpatialPlan\(/.test(src.replace(/import .*makeSpatialPlan.*/g, "")), name + " uses no synthetic tone builders");
  }
  assert.ok(!/createStudioAudio\(\{[^}]*hover/.test(studio) && !/audio\.hover\(/.test(studio));
  assert.ok(!/st-amb|ambToggle/.test(studio), "no separate ambience toggle (Guided / Pure is the voice switch, not a sound-style selector)");
  assert.equal((studio.match(/id: "st-volume"/g) ?? []).length, 1, "one volume slider");
  assert.ok(copy.includes("Sounds are recordings chosen by the real value: low / mid / high. The level follows the data; the recordings themselves are illustrative."));
  assert.ok(copy.includes("الأصوات تسجيلات تُختار بالقيمة الحقيقية: منخفض / متوسط / مرتفع. المستوى يتبع البيانات؛ أما التسجيلات نفسها فتوضيحية."));
  assert.match(studio, /earthpulse\.sound\.v2/, "old stored sound settings are reset once");
});
