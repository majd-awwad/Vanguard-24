import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BUILD_REASON, DECODE_LOCKED_DATES, PHENOMENA, PHENOMENON_IDS, changeNormalizer, comparability, denormalizer, fetchVerified, formatChange, formatValue, isLocked,
  normalizeLF, normalizer, openPackage, rampFromStops,
} from "../web/studio/datasets.js";
import { CALM_MPS, DRY_MM, HOVER_EVENT_S, MAPPING_VERSION, MAX_PULSES, cellInfo, hoverPlan, soundParams, valueTones } from "../web/studio/sonify.js";
import { DUCK_FACTOR, GUIDED, PURE, SETTLE_MS, createSpeech, hasVoice } from "../web/studio/speech.js";
import { AUDIO, EVENTS, SPEECH, TOOLS, createAppState, createStore, invariantViolations, reduce } from "../web/studio/state.js";
import { verifyDirectory, SOURCE, TARGET, copyPackage } from "../scripts/earth-map/copy-package.mjs";

const base = new URL("../web/assets/earthpulse-json/", import.meta.url);
const fetchImpl = async (u) => {
  try { const b = await readFile(new URL(u)); return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; } catch { return { ok: false, status: 404 }; }
};
const digest = async (bytes) => createHash("sha256").update(bytes).digest("hex");
const pkg = await openPackage({ baseUrl: base, fetchImpl, digest });
const phens = Object.fromEntries(await Promise.all(PHENOMENON_IDS.map(async (id) => [id, await pkg.openPhenomenon(id)])));

test("package: all 63 source files, and the 48 files of the copy (the excluded phenomenon is not copied), match the master catalog sha256 and bytes", async () => {
  const source = await verifyDirectory(SOURCE);
  assert.equal(source.failures.length, 0, source.failures.join("\n"));
  assert.equal(source.ok, 63);
  const copy = await verifyDirectory(TARGET);
  assert.equal(copy.failures.length, 0, copy.failures.join("\n"));
  assert.equal(copy.ok, 48);
  assert.equal(copy.total, 48);
});

test("integrity: a tampered byte is refused, CRLF is normalised before hashing", async () => {
  const asset = pkg.assets.get("dust/grid.json");
  const good = await fetchVerified(new URL("dust/grid.json", base), asset, { fetchImpl, digest });
  assert.equal(good.verified, true);
  const crlf = async (u) => { const r = await fetchImpl(u); const text = Buffer.from(await r.arrayBuffer()).toString("latin1").replace(/\n/g, "\r\n"); const b = Buffer.from(text, "latin1"); return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
  assert.equal((await fetchVerified(new URL("dust/grid.json", base), asset, { fetchImpl: crlf, digest })).verified, true);
  const tampered = async (u) => { const r = await fetchImpl(u); const b = Buffer.from(await r.arrayBuffer()); b[b.length - 5] ^= 1; return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
  await assert.rejects(fetchVerified(new URL("dust/grid.json", base), asset, { fetchImpl: tampered, digest }), /Integrity/);
  assert.deepEqual([...normalizeLF(new Uint8Array([97, 13, 10, 98, 13, 99]))], [97, 10, 98, 13, 99]);
});

test("every phenomenon: 13 snapshots, 25x40, model GEOS-FP, no null in this release, inside the fixed scale", () => {
  assert.deepEqual(PHENOMENON_IDS, ["dust", "rainfall", "wind"]);
  for (const id of PHENOMENON_IDS) {
    const p = phens[id];
    assert.equal(p.list.length, 13, id);
    assert.equal(p.grid.rows * p.grid.cols, 1000);
    const spec = PHENOMENA[id];
    const all = p.list.flatMap((s) => s.values);
    assert.ok(Math.min(...all) >= spec.min - 1e-9 && Math.max(...all) <= spec.max, `${id} fixed scale covers the data`);
    for (const s of p.list) { assert.match(s.source.product, /GEOS/); assert.equal(s.values.length, 1000); }
  }
  assert.equal(PHENOMENA.rainfall.unit, "mm");
});

test("build groups: the same two groups for all four phenomena, so cross-build differences are blocked", () => {
  for (const id of PHENOMENON_IDS) {
    const p = phens[id];
    assert.deepEqual(p.compatibilityGroups.map((g) => g.snapshotIds.length).sort((x, y) => x - y), [3, 10], id);
    const apr = p.byDate("2025-04-15").id;
    const jan = p.byDate("2025-01-15").id;
    const r = pkg.resolveComparison(p, jan, apr);
    assert.equal(r.status, "unavailable", id);
    assert.equal(r.reason, p.compatibilityPolicy ?? BUILD_REASON, id + ": the catalog policy text when the catalog has one");
    assert.equal(pkg.resolveComparison(p, apr, p.byDate("2025-07-15").id).status, id === "dust" ? "published" : "computed", id);
    assert.equal(comparability(p.snapshot(jan), p.snapshot(apr)).ok, false);
  }
});

test("scales: normalisers are monotonic, bounded and invertible; change scale has an exact neutral band", () => {
  for (const id of PHENOMENON_IDS) {
    const spec = PHENOMENA[id];
    const n = normalizer(spec);
    const d = denormalizer(spec);
    assert.equal(n(spec.min), 0);
    assert.ok(Math.abs(n(spec.max) - 1) < 1e-12);
    assert.equal(n(spec.min - 1000), 0);
    assert.equal(n(spec.max * 100 + 100), 1);
    for (const t of [0.1, 0.5, 0.9]) assert.ok(Math.abs(n(d(t)) - t) < 1e-9, `${id} ${t}`);
    const c = changeNormalizer(spec);
    assert.equal(c(spec.change.nearZero * 0.9), 0);
    assert.ok(c(spec.change.max) === 1 && c(-spec.change.max) === -1);
    assert.equal(rampFromStops(spec.stops).length, 1024);
  }
  assert.equal(formatChange(PHENOMENA.wind, -1.234), "−1.2");
});

test("spoiler lock: dust on the two Decode dates only, until Decode is finished", () => {
  assert.deepEqual([...DECODE_LOCKED_DATES], ["2025-08-15", "2025-08-19"]);
  assert.equal(isLocked("dust", "2025-08-19", false), true);
  assert.equal(isLocked("dust", "2025-08-15", false), true);
  assert.equal(isLocked("dust", "2025-08-15", true), false);
  assert.equal(isLocked("dust", "2025-04-15", false), false);
  assert.equal(isLocked("rainfall", "2025-08-19", false), false);
});

test("sonification: each phenomenon changes the right quantity; loudness never carries the value", () => {
  const rain = [0.1, 0.5, 1, 3].map((v) => soundParams("rainfall", { value: v }));
  assert.ok(rain.every((r, i) => i === 0 || r.rate > rain[i - 1].rate), "more rain = faster pulses");
  assert.ok(rain.every((r) => r.frequencyHz === 520), "rain pitch is fixed");
  const dust = [0.005, 0.05, 0.5, 2].map((v) => soundParams("dust", { value: v }));
  assert.ok(dust.every((d, i) => i === 0 || (d.rate > dust[i - 1].rate && d.frequencyHz > dust[i - 1].frequencyHz)), "more dust = denser and brighter");
  assert.deepEqual([...new Set(dust.map((d) => d.waveform))].length > 1, true, "brightness also changes the waveform");
  const wind = [1, 4, 9, 15].map((v) => soundParams("wind", { value: v, u: v, v: 0, direction: 270 }));
  assert.ok(wind.every((w, i) => i === 0 || w.rate > wind[i - 1].rate), "faster wind = faster pulses");
  for (const [id, info] of [["rainfall", { value: 2 }], ["dust", { value: 0.3 }], ["wind", { value: 8, u: 5, v: 5, direction: 225 }]]) {
    const gains = new Set([0.01, 0.2, 0.9].map((m) => valueTones(id, { ...info, value: id === "wind" ? 8 : info.value * (m + 0.5) }).map((t) => t.tone.gain).join()));
    assert.equal(gains.size, 1, `${id}: constant gain`);
  }
});

test("sonification: wind pan follows the east-west component, calm is centred; rain 0 is silent, missing is a click", () => {
  assert.equal(soundParams("wind", { value: 8, u: 8, v: 0, direction: 270 }).pan, 1);
  assert.equal(soundParams("wind", { value: 8, u: -8, v: 0, direction: 90 }).pan, -1);
  assert.ok(Math.abs(soundParams("wind", { value: 8, u: 0, v: 8, direction: 180 }).pan) < 1e-9);
  const calm = soundParams("wind", { value: CALM_MPS / 2, u: 0.1, v: 0, direction: null });
  assert.equal(calm.pan, 0);
  assert.equal(calm.calm, true);
  assert.equal(soundParams("wind", { value: 5, u: 3, v: 4, direction: null }).pan, 0, "a null direction is never guessed");
  assert.deepEqual(valueTones("rainfall", { value: 0 }), []);
  assert.ok(DRY_MM > 0);
  for (const id of PHENOMENON_IDS) assert.equal(valueTones(id, { value: null })[0].tone.voice, "crackle", `${id}: missing is a click`);
});

test("sonification: real cells, deterministic plans valid for the shared transport, bounded pulses", () => {
  for (const id of PHENOMENON_IDS) {
    const p = phens[id];
    const snap = p.byDate("2025-04-15");
    const cell = { row: 12, col: 20, index: 12 * 40 + 20 };
    const a = hoverPlan(id, snap, cell, p.grid, 15);
    const b = hoverPlan(id, snap, cell, p.grid, 15);
    assert.deepEqual(a, b);
    assert.equal(a.mappingVersion, MAPPING_VERSION);
    for (const ev of a.events) {
      const t = ev.tone;
      assert.ok(t.gain <= 0.22 && t.durationS >= t.attackS + t.releaseS, id);
      assert.ok((t.pulses?.length ?? 1) <= MAX_PULSES);
      assert.ok((t.pulses ?? [0]).every((o) => o >= 0 && o < HOVER_EVENT_S));
    }
    assert.equal(cellInfo(id, snap, 5).value, snap.values[5]);
  }
});

test("speech: VOICE-B Pure Sonification never speaks automatically; VOICE-A Guided announces after movement settles", () => {
  const spoken = [];
  let cancels = 0;
  const timers = [];
  const synth = { getVoices: () => [{ lang: "en-US" }], speak: (u) => { spoken.push(u.text); u.onstart?.(); }, cancel: () => { cancels++; } };
  class U { constructor(text) { this.text = text; } }
  const ducks = [];
  const live = { textContent: "" };
  const s = createSpeech({ synth, Utterance: U, language: () => "en", liveRegion: live, setTimer: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearTimer: (id) => { if (timers[id - 1]) timers[id - 1].f = null; }, onDuck: (d) => ducks.push(d) });
  s.setMode(PURE);
  for (let i = 0; i < 5; i++) s.announce("cell " + i);
  assert.equal(spoken.length, 0, "no automatic TTS");
  assert.equal(timers.length, 0, "nothing scheduled");
  assert.equal(live.textContent, "", "no automatic live announcements either");
  assert.equal(s.say("explicit request"), true, "explicit requests still work");
  assert.deepEqual(spoken, ["explicit request"]);
  s.setMode(GUIDED);
  assert.equal(s.state, "IDLE", "switching cancels speech");
  spoken.length = 0;
  s.announce("A");
  s.announce("B");
  s.announce("C");
  assert.equal(spoken.length, 0, "waits for the cursor to settle");
  const live1 = timers.filter((t) => t.f);
  assert.equal(live1.length, 1, "only the latest announcement is pending");
  assert.equal(live1[0].ms, SETTLE_MS);
  assert.ok(SETTLE_MS >= 400 && SETTLE_MS <= 700);
  live1[0].f();
  assert.deepEqual(spoken, ["C"]);
  assert.equal(live.textContent, "C");
  assert.equal(ducks.at(-1), true, "data sound is ducked while speaking");
  s.cancel();
  assert.equal(ducks.at(-1), false, "and restored");
  assert.ok(DUCK_FACTOR > 0 && DUCK_FACTOR < 1);
});

test("speech: no voice for the language falls back to the live region without breaking; stale speech is dropped", () => {
  const live = { textContent: "" };
  const noArabic = { getVoices: () => [{ lang: "en-GB" }], speak() { throw new Error("must not speak"); }, cancel() {} };
  class U { constructor(t) { this.text = t; } }
  const s = createSpeech({ synth: noArabic, Utterance: U, language: () => "ar", liveRegion: live, setTimer: (f) => f(), clearTimer() {} });
  assert.equal(s.voiceAvailable, false);
  s.setMode(GUIDED);
  assert.doesNotThrow(() => s.announce("مرحبا"));
  assert.equal(live.textContent, "مرحبا");
  assert.equal(createSpeech({ synth: undefined, Utterance: undefined }).state, "UNAVAILABLE");
  assert.equal(hasVoice([{ lang: "ar-SA" }], "ar"), true);
  assert.equal(hasVoice([], "en"), false);
  // A late end-event of an old utterance must not undo the current one.
  const ends = [];
  const synth = { getVoices: () => [{ lang: "en-US" }], speak: (u) => ends.push(u), cancel() {} };
  const s2 = createSpeech({ synth, Utterance: U, language: () => "en", setTimer: (f) => f(), clearTimer() {} });
  s2.say("one");
  s2.say("two");
  ends[1].onstart();
  ends[0].onend();
  assert.equal(s2.state, "SPEAKING", "the old utterance's end is ignored");
});

test("state machine: VOICE-C switching sound mode keeps dataset, position, tool, findings and matches", () => {
  let s = createAppState({ soundMode: "GUIDED_VOICE" });
  s = reduce(s, { type: "SELECT_DATASET", payload: { datasetId: "rainfall", variable: "intervalAccumulationMm" } });
  s = reduce(s, { type: "SELECT_SAMPLE", payload: { sampleId: 412 } });
  s = reduce(s, { type: "SET_TOOL", payload: { tool: TOOLS.HUNTER } });
  s = reduce(s, { type: "SET_CAMERA", payload: { bounds: { west: 0, east: 10, south: 20, north: 30 } } });
  s = reduce(s, { type: "RUN_HUNTER", payload: { filters: { queryType: "highest" } } });
  s = reduce(s, { type: "HUNTER_RESULT", payload: { requestId: s.hunterRequestId, datasetId: "rainfall", findings: [{ id: "f1", sampleId: 7 }] } });
  const before = s;
  const after = reduce(s, { type: "SET_SOUND_MODE", payload: { mode: "PURE_SONIFICATION" } });
  for (const key of ["datasetId", "selectedSampleId", "tool", "cameraBounds", "findings", "echoMatches", "queryFilters", "timeRange"]) assert.deepEqual(after[key], before[key], key);
  assert.equal(after.soundMode, "PURE_SONIFICATION");
  assert.equal(after.speech, SPEECH.IDLE);
  assert.equal(reduce(after, { type: "SET_SOUND_MODE", payload: { mode: "nonsense" } }), after);
});

test("state machine: never happens: tab switch loses position; stale Hunter or Echo results after a change", () => {
  let s = createAppState({ soundMode: "PURE_SONIFICATION" });
  s = reduce(s, { type: "SELECT_SAMPLE", payload: { sampleId: 99 } });
  s = reduce(s, { type: "SET_CAMERA", payload: { bounds: { west: 1, east: 2, south: 3, north: 4 } } });
  for (const tool of [TOOLS.HUNTER, TOOLS.ECHO, TOOLS.EXPLORE]) {
    s = reduce(s, { type: "SET_TOOL", payload: { tool } });
    assert.equal(s.selectedSampleId, 99);
    assert.deepEqual(s.cameraBounds, { west: 1, east: 2, south: 3, north: 4 });
  }
  // A Hunter result for a superseded query is ignored.
  s = reduce(s, { type: "RUN_HUNTER", payload: { filters: { queryType: "highest" } } });
  const first = s.hunterRequestId;
  s = reduce(s, { type: "RUN_HUNTER", payload: { filters: { queryType: "threshold" } } });
  const stale = reduce(s, { type: "HUNTER_RESULT", payload: { requestId: first, datasetId: "dust", findings: [{ id: "old", sampleId: 1 }] } });
  assert.equal(stale, s, "stale result dropped");
  s = reduce(s, { type: "HUNTER_RESULT", payload: { requestId: s.hunterRequestId, datasetId: "dust", findings: [{ id: "new", sampleId: 2 }] } });
  assert.equal(s.findings[0].id, "new");
  // Echo results of another dataset never appear after switching.
  s = reduce(s, { type: "SEARCH_ECHO", payload: { sourceId: 5 } });
  const req = s.echoRequestId;
  s = reduce(s, { type: "SELECT_DATASET", payload: { datasetId: "wind", variable: "speedMps" } });
  assert.deepEqual(s.echoMatches, []);
  assert.deepEqual(s.findings, []);
  const late = reduce(s, { type: "ECHO_RESULT", payload: { requestId: req, datasetId: "dust", matches: [{ sampleId: 3 }] } });
  assert.equal(late, s, "late echo result dropped");
  assert.deepEqual(invariantViolations(s), []);
  s = reduce(s, { type: "SEARCH_ECHO", payload: { sourceId: 6 } });
  s = reduce(s, { type: "ECHO_RESULT", payload: { requestId: s.echoRequestId, datasetId: "wind", matches: [{ sampleId: 8 }] } });
  assert.deepEqual(invariantViolations(s), []);
  assert.equal(reduce(s, { type: "OPEN_ECHO_MATCH", payload: { sampleId: 12345 } }), s, "only a real match can be opened");
  s = reduce(s, { type: "OPEN_ECHO_MATCH", payload: { sampleId: 8 } });
  assert.equal(s.selectedSampleId, 8);
  for (const type of EVENTS) assert.doesNotThrow(() => reduce(s, { type, payload: {} }), type);
  const store = createStore(createAppState());
  const seen = [];
  store.subscribe((_, __, type) => seen.push(type));
  store.dispatch("SELECT_SAMPLE", { sampleId: 1 });
  store.dispatch("SELECT_SAMPLE", { sampleId: 1 });
  assert.ok(seen.length >= 1);
  assert.equal(AUDIO.PLAYING, "PLAYING");
});

test("opening a finding selects its sample; a finding that is not in the list is refused", () => {
  let s = createAppState();
  s = reduce(s, { type: "RUN_HUNTER", payload: { filters: {} } });
  s = reduce(s, { type: "HUNTER_RESULT", payload: { requestId: s.hunterRequestId, datasetId: "dust", findings: [{ id: "a", sampleId: 10 }, { id: "b", sampleId: 20 }] } });
  assert.equal(reduce(s, { type: "OPEN_FINDING", payload: { id: "zzz" } }), s);
  s = reduce(s, { type: "OPEN_FINDING", payload: { id: "b" } });
  assert.equal(s.selectedSampleId, 20);
  assert.equal(s.selectedFindingId, "b");
  assert.deepEqual(invariantViolations(s), []);
});
