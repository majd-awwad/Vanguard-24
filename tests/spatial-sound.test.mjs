import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { makeSpatialPlan, heardClass, mappingVersion } from "../web/audio/spatial-plan.js";
import { continuousVoice, crackleVoice, GAIN_CEILING, MAX_PULSES } from "../web/audio/voices.js";
import { createTransport } from "../web/audio/transport.js";
import { makeTemporalPlan } from "../web/audio/temporal-plan.js";

// Official repository fixtures are explicitly synthetic, never NASA observations.
const fixtures = JSON.parse(readFileSync(new URL("./fixtures/decode-fixture.json", import.meta.url)));
const [continuous, intermittent] = fixtures;
const cellPlan = (data, pair, extra = {}) => makeSpatialPlan(data,
  { level: "advanced", mode: "cell", cells: [pair], ...extra });
const clone = () => structuredClone(continuous);
function calibrated(values) {
  const data = clone();
  data.levels.advanced.validRange = [0, 1];
  values.forEach((value, i) => Object.assign(data.levels.advanced.cells[i], { value, status: "measured" }));
  return data;
}

for (const data of fixtures) {
  for (const [level, rows, cols] of [["quick", 3, 4], ["advanced", 6, 8]]) {
    test(`${data.behavior} ${level}: complete deterministic west-to-east v2 sweep`, () => {
      const before = structuredClone(data);
      const plan = makeSpatialPlan(data, { level, mode: "sweep" });
      assert.equal(plan.events.length, rows * cols);
      assert.deepEqual(plan, makeSpatialPlan(data, { level, mode: "sweep" }));
      assert.equal(plan.caseId, data.id);
      assert.equal(plan.mappingVersion, "decode-spatial-v1");
      assert.equal(plan.level, level);
      assert.equal(plan.mode, "sweep");
      assert.equal(new Set(plan.events.map(e => e.id)).size, rows * cols);
      for (const [i, event] of plan.events.entries()) {
        assert.deepEqual([event.row, event.col], [i % rows, Math.floor(i / rows)]);
        assert.equal(event.onsetS, i * 0.8);
        const cell = data.levels[level].cells.find(c => c.row === event.row && c.col === event.col);
        assert.deepEqual(event.evidence, { ...cell, unit: data.unit, mappingVersion });
        if (cell.status !== "measured") assert.equal(event.tone, null);
        if (!event.tone) continue;
        const tone = event.tone;
        assert.equal(tone.pan, 2 * event.col / (cols - 1) - 1);
        assert.ok(tone.gain > 0 && tone.gain <= GAIN_CEILING);
        for (const key of ["gain", "pan", "frequencyHz", "durationS", "attackS", "releaseS"]) {
          assert.ok(Number.isFinite(tone[key]), key);
        }
        assert.ok(event.onsetS + (tone.pulses?.at(-1) ?? 0) + tone.durationS <= plan.durationS);
      }
      assert.deepEqual(data, before);
    });
  }
}

test("pan boundaries and latitude pitch are fixed independently of measured value", () => {
  const data = calibrated(Array(48).fill(0.5));
  const northWest = cellPlan(data, [0, 0]).events[0].tone;
  const southEast = cellPlan(data, [5, 7]).events[0].tone;
  assert.equal(northWest.pan, -1);
  assert.equal(southEast.pan, 1);
  assert.equal(northWest.frequencyHz, 880);
  assert.equal(southEast.frequencyHz, 220);
  const pitches = Array.from({ length: 6 }, (_, row) => cellPlan(data, [row, 0]).events[0].tone.frequencyHz);
  assert.ok(pitches.every((pitch, i) => i === 0 || pitches[i - 1] > pitch));
  data.levels.advanced.cells[0].value = 0.9;
  assert.equal(cellPlan(data, [0, 0]).events[0].tone.frequencyHz, northWest.frequencyHz);
});

test("square-root gain clamps to calibration range and never exceeds its ceiling", () => {
  const data = calibrated([0, 0.04, 0.25, 1, 100]);
  const gains = [0, 1, 2, 3, 4].map(col => cellPlan(data, [0, col]).events[0].tone?.gain ?? 0);
  assert.deepEqual(gains, [0, 0.22 * 0.2, 0.22 * 0.5, 0.22, 0.22]);
  const subset = makeSpatialPlan(data, { level: "advanced", mode: "contrast", cells: [[0, 1], [0, 2]] });
  assert.equal(subset.events[0].tone.gain, gains[1]);
  data.levels.advanced.validRange = [1, 1];
  assert.equal(cellPlan(data, [0, 0]).events[0].tone, null);
  assert.equal(cellPlan(data, [0, 3]).events[0].tone.gain, GAIN_CEILING);
});

test("fallback uses full finite level extent, with safe constant and all-missing ranges", () => {
  const data = calibrated(Array(48).fill(0.5));
  delete data.levels.advanced.validRange;
  assert.equal(cellPlan(data, [0, 1]).events[0].tone.gain, GAIN_CEILING);
  data.levels.advanced.cells.forEach(cell => { cell.value = 0; });
  assert.equal(cellPlan(data, [0, 1]).events[0].tone, null);
  data.levels.advanced.cells.forEach(cell => Object.assign(cell, { value: null, status: "missing" }));
  assert.ok(makeSpatialPlan(data, { level: "advanced" }).events.every(e => e.tone === null));
});

test("missing, measured zero and below-threshold evidence remain distinct", () => {
  const data = calibrated([0, 0.8]);
  data.levels.advanced.cells[1].status = "below_threshold";
  const missing = cellPlan(continuous, [0, 0]).events[0];
  const zero = cellPlan(data, [0, 0]).events[0];
  const below = cellPlan(data, [0, 1]).events[0];
  assert.equal(missing.tone, null);
  assert.equal(missing.evidence.value, null);
  assert.equal(zero.tone, null);
  assert.equal(zero.evidence.value, 0);
  assert.equal(zero.evidence.status, "measured");
  assert.equal(below.tone, null);
  assert.equal(below.evidence.value, 0.8);
  assert.equal(below.evidence.status, "below_threshold");
  assert.equal(heardClass(data, "advanced", 0, 1), "silent");
});

test("continuous voices sustain; crackle pulses depend on count and cannot overlap", () => {
  const parameters = { frequencyHz: 440, gain: 0.2, pan: 0 };
  const tone = continuousVoice(parameters);
  assert.equal(tone.voice, "tone");
  assert.equal(tone.pulses, undefined);
  assert.ok(tone.durationS > tone.attackS + tone.releaseS);
  for (const count of [0, 1, 3, 8, 12, 100000]) {
    const crackle = crackleVoice({ ...parameters, eventCount: count });
    assert.equal(crackle.voice, "crackle");
    assert.equal(crackle.pulses.length, Math.min(count, MAX_PULSES));
    assert.deepEqual(crackle, crackleVoice({ ...parameters, eventCount: count }));
    assert.ok(crackle.pulses.every((time, i) => time >= 0 &&
      time + crackle.durationS < 0.56 && (i === 0 || time >= crackle.pulses[i - 1] + crackle.durationS)));
  }
  const data = structuredClone(intermittent);
  Object.assign(data.levels.advanced.cells[4], { value: 4, eventCount: 4 });
  assert.equal(cellPlan(data, [0, 4]).events[0].tone.pulses.length, 4);
  delete data.levels.advanced.cells[4].eventCount;
  assert.equal(cellPlan(data, [0, 4]).events[0].tone.pulses.length, 4);
  data.levels.advanced.cells[4].eventCount = 0;
  assert.equal(cellPlan(data, [0, 4]).events[0].tone, null);
  assert.equal(heardClass(data, "advanced", 0, 4), "silent");
});

test("six-second legend teaches position, pitch and gain without dataset access", () => {
  for (const data of fixtures) for (const level of ["quick", "advanced"]) {
    const metadata = { ...data, levels: undefined };
    const plan = makeSpatialPlan(metadata, { level, mode: "legend" });
    assert.deepEqual(plan, makeSpatialPlan(metadata, { level, mode: "legend" }));
    assert.equal(plan.durationS, 6);
    assert.deepEqual(plan.events.map(e => e.onsetS), [0, 1, 2, 3, 4, 5]);
    const [left, right, low, high, quiet, loud] = plan.events.map(e => e.tone);
    assert.deepEqual([left.pan, right.pan], [-1, 1]);
    assert.equal(left.frequencyHz, right.frequencyHz);
    assert.equal(left.gain, right.gain);
    assert.ok(high.frequencyHz > low.frequencyHz);
    assert.equal(high.pan, low.pan);
    assert.equal(high.gain, low.gain);
    assert.ok(loud.gain > quiet.gain);
    assert.equal(loud.frequencyHz, quiet.frequencyHz);
    assert.deepEqual(loud.pulses, quiet.pulses);
    assert.ok(plan.events.every(e => e.evidence.synthetic === true && e.tone));
  }
});

test("row, cell and sequential contrast preserve selection order", () => {
  for (const [level, cols] of [["quick", 4], ["advanced", 8]]) {
    const row = makeSpatialPlan(continuous, { level, mode: "row", row: 1 });
    assert.deepEqual(row.events.map(e => [e.row, e.col]), Array.from({ length: cols }, (_, col) => [1, col]));
    const pair = [[2, 3], [0, 2]];
    const contrast = makeSpatialPlan(continuous, { level, mode: "contrast", cells: pair });
    assert.deepEqual(contrast.events.map(e => [e.row, e.col]), pair);
    assert.ok(contrast.events[1].onsetS >= contrast.events[0].onsetS + (contrast.events[0].tone?.durationS ?? 0));
    assert.equal(makeSpatialPlan(continuous, { level, mode: "cell", cells: [pair[0]] }).events.length, 1);
  }
});

test("invalid modes, coordinates, grids and parameters reject explicitly", () => {
  for (const options of [
    { mode: "bad" }, { level: "bad" }, { mode: "row", row: -1 }, { mode: "row", row: 3 },
    { mode: "cell" }, { mode: "contrast", cells: [[0, 0]] },
    ...[[3, 0], [0, 4], [0.5, 0], [NaN, 0], [0], null].map(pair => ({ mode: "cell", cells: [pair] })),
    { waveform: "noise" },
  ]) assert.throws(() => makeSpatialPlan(continuous, options), RangeError);
  assert.throws(() => heardClass(continuous, "quick", 3, 0), RangeError);
  assert.throws(() => makeSpatialPlan({ ...continuous, schema: "earthpulse.decode/1" }), TypeError);
  const data = clone();
  data.levels.quick.cells[1] = data.levels.quick.cells[0];
  assert.throws(() => makeSpatialPlan(data), /Duplicate/);
  for (const value of [NaN, Infinity, -1]) {
    const candidate = calibrated([value]);
    assert.throws(() => cellPlan(candidate, [0, 0]), TypeError);
  }
  const badRange = calibrated([1]);
  badRange.levels.advanced.validRange = [3, 2];
  assert.throws(() => cellPlan(badRange, [0, 0]), RangeError);
  assert.throws(() => crackleVoice({ frequencyHz: 440, gain: 0.1, eventCount: 1.5 }), RangeError);
});

test("heardClass reports gain thirds using only allowed labels", () => {
  const data = calibrated([0, 0.04, 1 / 9, 0.25, 4 / 9, 1]);
  assert.deepEqual(Array.from({ length: 6 }, (_, col) => heardClass(data, "advanced", 0, col)),
    ["silent", "low", "mid", "mid", "high", "high"]);
  for (const fixture of fixtures) for (const level of ["quick", "advanced"]) {
    for (const cell of fixture.levels[level].cells) {
      assert.ok(["low", "mid", "high", "silent"].includes(heardClass(fixture, level, cell.row, cell.col)));
    }
  }
});

test("waveform changes only timbre and preserves scientific evidence and mapping version", () => {
  for (const data of fixtures) {
    const before = structuredClone(data);
    const sine = makeSpatialPlan(data);
    const triangle = makeSpatialPlan(data, { waveform: "triangle" });
    assert.deepEqual(sine.events.map(e => e.evidence), triangle.events.map(e => e.evidence));
    assert.equal(triangle.mappingVersion, mappingVersion);
    assert.deepEqual(triangle.events, sine.events.map(e => ({ ...e, tone: e.tone ? { ...e.tone, waveform: "triangle" } : null })));
    assert.deepEqual(data, before);
  }
});

function audioHarness({ stereo = true, refuses = false } = {}) {
  const nodes = [];
  let frame;
  const param = () => ({ value: 0, automation: [],
    setValueAtTime(...args) { this.automation.push(["set", ...args]); },
    linearRampToValueAtTime(...args) { this.automation.push(["ramp", ...args]); },
    setTargetAtTime(...args) { this.automation.push(["target", ...args]); },
  });
  const node = kind => {
    const result = { kind, connections: [], disconnected: false,
      connect(to) { this.connections.push(to); }, disconnect() { this.disconnected = true; } };
    nodes.push(result);
    return result;
  };
  const context = { state: refuses ? "suspended" : "running", currentTime: 0, destination: {},
    resume: async () => { throw new Error("User activation required"); },
    createGain: () => Object.assign(node("gain"), { gain: param() }),
    createOscillator: () => Object.assign(node("oscillator"), { frequency: param(),
      start(time) { this.startTime = time; }, stop(time) { this.stopTime = time; } }),
    ...(stereo ? { createStereoPanner: () => Object.assign(node("pan"), { pan: param() }) } : {}),
  };
  const transport = createTransport({ createContext: () => context, now: () => context.currentTime,
    requestFrame: callback => { frame = callback; return 1; }, cancelFrame: () => { frame = undefined; } });
  return { nodes, context, transport, advance(seconds) { context.currentTime += seconds; frame?.(); } };
}

test("transport routes continuous and crackle voices through stereo pan and cleans nodes", async () => {
  for (const data of fixtures) {
    const harness = audioHarness();
    const plan = cellPlan(data, [0, 5]);
    harness.transport.load(plan);
    await harness.transport.play();
    const oscillators = harness.nodes.filter(n => n.kind === "oscillator");
    const pans = harness.nodes.filter(n => n.kind === "pan");
    const tone = plan.events[0].tone;
    assert.equal(oscillators.length, tone.pulses?.length ?? 1);
    assert.equal(pans.length, oscillators.length);
    pans.forEach(n => assert.equal(n.pan.value, tone.pan));
    oscillators.forEach((n, i) => {
      assert.equal(n.startTime, 0.035 + (tone.pulses?.[i] ?? 0));
      assert.ok(Math.abs(n.stopTime - n.startTime - tone.durationS) < 1e-10);
      n.onended();
      assert.equal(n.disconnected, true);
      assert.equal(pans[i].disconnected, true);
    });
    harness.transport.pause();
  }
});

test("transport provides mono fallback and graceful browser audio refusal", async () => {
  const mono = audioHarness({ stereo: false });
  mono.transport.load(cellPlan(intermittent, [0, 5]));
  await mono.transport.play();
  assert.equal(mono.transport.snapshot().audioUnavailable, false);
  assert.equal(mono.nodes.filter(n => n.kind === "pan").length, 0);
  const refused = audioHarness({ refuses: true });
  refused.transport.load(cellPlan(continuous, [0, 5]));
  await refused.transport.play();
  assert.equal(refused.transport.snapshot().playback, "silent");
  assert.equal(refused.transport.snapshot().audioUnavailable, true);
  refused.advance(1);
  assert.equal(refused.transport.snapshot().status, "ended");
});

test("transport keeps legacy temporal tone and pulse timing, controls and event identity", async () => {
  const data = { id: "rain", unit: "mm/day", cells: [{ lat: 0, lon: 0,
    samples: [{ value: 30 }, { value: 60 }] }], times: [{ start: "test-1" }, { start: "test-2" }] };
  const plan = makeTemporalPlan(data, { id: "synthetic", lat: 0, lon: 0 });
  const harness = audioHarness();
  harness.transport.load(plan);
  const snapshots = [];
  harness.transport.subscribe(snapshot => snapshots.push(snapshot));
  await harness.transport.play();
  assert.equal(harness.nodes.filter(n => n.kind === "pan").length, 0);
  const oscillators = harness.nodes.filter(n => n.kind === "oscillator");
  assert.deepEqual(oscillators.map(n => n.startTime), plan.events.flatMap(e => e.tone.pulses.map(p => 0.035 + (e.onsetS + p))));
  assert.equal(harness.transport.snapshot().activeEventId, plan.events[0].id);
  harness.advance(0.3);
  const position = harness.transport.snapshot().positionS;
  harness.transport.setSpeed(2);
  assert.equal(harness.transport.snapshot().positionS, position);
  harness.transport.setVolume(0.3);
  harness.transport.setMuted(true);
  assert.equal(harness.transport.snapshot().muted, true);
  harness.transport.pause();
  harness.transport.seek(0.9);
  assert.equal(harness.transport.snapshot().activeEventId, plan.events[1].id);
  assert.equal(harness.transport.snapshot().planRevision, 1);
  assert.ok(snapshots.length > 5);
});

test("spatial crackle seek and speed changes retain pulse offsets and cancel old schedules", async () => {
  const harness = audioHarness();
  const plan = cellPlan(intermittent, [0, 5]);
  harness.transport.load(plan, 0.1);
  harness.transport.setSpeed(2);
  await harness.transport.play();
  const tone = plan.events[0].tone;
  const remaining = tone.pulses.filter(time => time >= 0.1);
  const oscillators = harness.nodes.filter(n => n.kind === "oscillator");
  assert.deepEqual(oscillators.map(n => n.startTime), remaining.map(time => 0.035 + (time - 0.1) / 2));
  harness.transport.pause();
  assert.ok(oscillators.every(n => n.stopTime === undefined));
  harness.transport.load(makeSpatialPlan(continuous, { mode: "legend" }));
  assert.equal(harness.transport.snapshot().planRevision, 2);
  assert.equal(harness.transport.snapshot().positionS, 0);
});

test("transport falls back to mono when stereo node construction fails", async () => {
  const harness = audioHarness();
  harness.context.createStereoPanner = () => { throw new Error("Unsupported stereo node"); };
  harness.transport.load(cellPlan(continuous, [0, 5]));
  await harness.transport.play();
  assert.equal(harness.transport.snapshot().playback, "audio");
  assert.equal(harness.transport.snapshot().audioUnavailable, false);
  assert.equal(harness.nodes.filter(n => n.kind === "oscillator").length, 1);
});

test("reusable voice helpers bound amplitude and pan and reject nonfinite input", () => {
  const tone = continuousVoice({ frequencyHz: 440, gain: 8, pan: -8 });
  assert.equal(tone.gain, GAIN_CEILING);
  assert.equal(tone.pan, -1);
  assert.equal(continuousVoice({ frequencyHz: 440, gain: -1 }).gain, 0);
  for (const bad of [{ frequencyHz: Infinity, gain: 0.1 }, { frequencyHz: 440, gain: NaN },
    { frequencyHz: 440, gain: 0.1, pan: Infinity }]) {
    assert.throws(() => continuousVoice(bad), TypeError);
  }
});
