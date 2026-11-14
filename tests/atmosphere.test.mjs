import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { atmosphereFor, createAtmosphere, noiseLoop } from "../web/audio/atmosphere.js";
import { makeSpatialPlan } from "../web/audio/spatial-plan.js";
import { makeTemporalPlan } from "../web/audio/temporal-plan.js";
import { compareDustBands, buildBandPlayback } from "../web/experiences/decode/guided-dust.js";
import { createTransport } from "../web/audio/transport.js";

const dustUrl = new URL("../web/assets/decode/data/dust-geos-fp-20250819-1930-north-africa-med.json", import.meta.url);
const dust = JSON.parse(await readFile(dustUrl, "utf8"));

test("real dust frames follow model values without affecting cue or evidence timing", () => {
  const plan = makeSpatialPlan(dust);
  assert.ok(plan.texture.frames.some(frame => frame.intensity > 0));
  assert.deepEqual(plan.texture.frames, plan.events.map(({ onsetS, evidence }) => ({
    onsetS, intensity: evidence.status === "measured" ? Math.min(1, evidence.value / 2.5) : 0,
  })));
  assert.equal(makeSpatialPlan(dust, { mode: "legend" }).texture, undefined);
  assert.equal(makeSpatialPlan({ ...dust, fixture: true }).texture, undefined);
  const { bands } = compareDustBands(dust);
  const guides = buildBandPlayback(bands, { caseId: dust.id, texture: true });
  assert.deepEqual(guides.texture.frames.map(frame => frame.intensity), bands.map(band => Math.min(1, band.mean / 2.5)));
  assert.deepEqual(guides.events, buildBandPlayback(bands, { caseId: dust.id }).events);
  assert.equal(buildBandPlayback(bands, { caseId: dust.id, texture: true, example: true }).texture, undefined);
});

test("rain composition is separate from the numeric pulse count and respects zero and absent readings", () => {
  const samples = [null, 0, 15, 30, 90].map(value => ({ value }));
  const times = samples.map((_, index) => ({ start: String(index) }));
  const plan = makeTemporalPlan({
    id: "rain", unit: "mm/day", kind: "raster", cells: [{ lat: 0, lon: 0, samples }], times,
  }, { lat: 0, lon: 0, id: "test" });
  assert.deepEqual(plan.texture.frames.map(({ intensity }) => intensity), [0, 0, 0.25, 0.5, 1]);
  assert.deepEqual(plan.events.map(({ tone }) => tone?.pulses.length ?? 0), [0, 0, 2, 3, 6]);
});

function metrics(samples) {
  let energy = 0;
  let impulses = 0;
  for (const [index, sample] of samples.entries()) {
    assert.ok(Number.isFinite(sample) && Math.abs(sample) < 0.651);
    energy += sample ** 2;
    if (index) impulses += (sample - samples[index - 1]) ** 2;
  }
  return impulses / energy;
}

test("dust synthesis is smooth and repeatable, with a softer spectrum than rain", () => {
  const dustSamples = noiseLoop("dust", 12000);
  const rainSamples = noiseLoop("rain", 12000);
  assert.deepEqual(dustSamples, noiseLoop("dust", 12000));
  assert.equal(dustSamples.length, 48000);
  for (const samples of [dustSamples, rainSamples]) {
    assert.ok(samples[0] === 0 && samples.at(-1) === 0);
  }
  assert.ok(metrics(rainSamples) > 2 * metrics(dustSamples));
});

function harness() {
  const nodes = [];
  const param = () => ({
    value: 0, events: [],
    setValueAtTime(...args) { this.events.push(["set", ...args]); },
    linearRampToValueAtTime(...args) { this.events.push(["ramp", ...args]); },
    cancelScheduledValues(...args) { this.events.push(["cancel", ...args]); },
    setTargetAtTime(...args) { this.events.push(["target", ...args]); },
  });
  const node = (kind, extra = {}) => {
    const result = { kind, ...extra, connect() {}, disconnect() { this.disconnected = true; } };
    nodes.push(result);
    return result;
  };
  const context = {
    state: "running", currentTime: 0, sampleRate: 12000, destination: {},
    createBuffer: (_, length) => ({ getChannelData: () => new Float32Array(length) }),
    createGain: () => node("gain", { gain: param() }),
    createBiquadFilter: () => node("filter", { frequency: param(), Q: param() }),
    createBufferSource: () => node("source", {
      start(...args) { this.started = args; },
      stop(time) { this.stopped = time; },
    }),
  };
  return { context, nodes };
}

test("mix automation joins adjacent readings and reaches zero before unavailable slots", () => {
  const { context, nodes } = harness();
  const frames = [0.1, 1, null, 0.4].map((value, index) => ({ onsetS: index, evidence: { value } }));
  const texture = atmosphereFor("dust", frames, 1);
  const mix = createAtmosphere(context, context.destination);
  mix.setVolume(0.32, true);
  mix.start(texture, { origin: 0.035, position: 0, limit: 4, speed: 1 });
  const [source] = nodes.filter(node => node.kind === "source");
  assert.deepEqual(source.started, [0.035, 0]);
  assert.equal(source.stopped, 4.035);
  const [layer, output, envelope] = nodes.filter(node => node.kind === "gain");
  assert.equal(layer.gain.value, 0.32);
  assert.ok(envelope.gain.events.some(([type, value, time]) => type === "set" && value > 0 && time === 1.035));
  assert.ok(envelope.gain.events.some(([type, value, time]) => type === "ramp" && value === 0 && time === 2.035));
  assert.ok(envelope.gain.events.some(([type, value, time]) => type === "set" && value === 0 && time === 3.035));
  mix.setVolume(0);
  assert.deepEqual(layer.gain.events.at(-1), ["target", 0, 0, 0.018]);
  context.currentTime = 1;
  mix.stop();
  assert.deepEqual(output.gain.events.at(-1), ["target", 0, 1, 0.006]);
  assert.equal(source.stopped, 1.028);
  source.onended();
  assert.ok(source.disconnected && output.disconnected);
});

test("transport never creates texture in silent mode and retires it on seek and replacement", async () => {
  const { context, nodes } = harness();
  const transport = createTransport({
    createContext: () => context, now: () => 0, requestFrame: () => 1, cancelFrame() {},
  });
  const events = [{ id: "first", onsetS: 0, evidence: { value: 1 }, tone: null }];
  const plan = { events, durationS: 1, texture: atmosphereFor("rain", events, 1) };
  transport.setAtmosphereVolume(0);
  transport.load(plan);
  await transport.play("silent");
  assert.equal(nodes.length, 0);
  transport.seek(0);
  await transport.play("audio");
  assert.equal(transport.snapshot().atmosphereVolume, 0);
  const [source] = nodes.filter(node => node.kind === "source");
  transport.seek(0.5);
  assert.equal(source.stopped, 0.028);
  await transport.play("audio");
  const second = nodes.filter(node => node.kind === "source").at(-1);
  assert.deepEqual(second.started, [0.035, 0.5]);
  transport.load({ events, durationS: 1 });
  assert.equal(second.stopped, 0.028);
});
