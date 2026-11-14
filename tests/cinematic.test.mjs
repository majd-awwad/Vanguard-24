import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { Vector3 } from "../web/vendor/three/three.module.min.js";
import {
  DEG, HERO_DISTANCE, HERO_SHIFT, bracketTriangles, cameraMatrices, cellRect, createFrame, ease, fillTriangles,
  fitFrustum, flightSpin, gridLines, projectToNdc, ringTriangles, spherePoint, surfacePoint, unroll,
} from "../web/cinematic/geo.js";
import { overlayModel, sanitizeOutcomes } from "../web/cinematic/overlay.js";
import { createGlobeMount } from "../web/cinematic/globe.js";
import { LEGEND_SECONDS, guideState, meridianStrip, parallelStrip } from "../web/cinematic/guide.js";
import { HAZE_SHARE, MAX_PARTICLES, buildDustParticles, particleCounts } from "../web/cinematic/particles.js";
import { createAudioTap, drawWaveform, isSilent } from "../web/cinematic/audio-tap.js";
import { copy, fill } from "../web/cinematic/copy.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const bytes = (path) => readFileSync(new URL(path, root));
const sha256 = (data) => createHash("sha256").update(data).digest("hex");

const dust = { west: -20, east: 50, south: 15, north: 45 };
const fixture = { west: 0, east: 8, south: 0, north: 6 };
const sizes = [[3, 4], [6, 8]];

// ---------- geometry ----------

test("at full unroll every cell corner lands on the interactive grid rectangle for any canvas aspect", () => {
  for (const bounds of [dust, fixture]) {
    const frame = createFrame(bounds);
    for (const aspect of [0.7, 1, 2.33, 3]) {
      const camera = cameraMatrices(frame, 1, aspect);
      for (const [rows, cols] of sizes) {
        for (let row = 0; row <= rows; row++) {
          for (let col = 0; col <= cols; col++) {
            const lon = bounds.west + (col * (bounds.east - bounds.west)) / cols;
            const lat = bounds.north - (row * (bounds.north - bounds.south)) / rows;
            const ndc = projectToNdc(camera, surfacePoint(frame, lon, lat, 1));
            assert.ok(Math.abs(ndc.x - (-1 + (2 * col) / cols)) < 1e-9, `x at row ${row}, col ${col}`);
            assert.ok(Math.abs(ndc.y - (1 - (2 * row) / rows)) < 1e-9, `y at row ${row}, col ${col}`);
            assert.ok(ndc.z > -1 && ndc.z < 1, "inside the depth range");
          }
        }
      }
    }
  }
});

test("the unrolled map registers to an arbitrary stage rectangle inside a larger canvas, with or without the hero pose", () => {
  const frame = createFrame(dust);
  const canvas = { width: 1366, height: 768 };
  const rect = { x0: 380, y0: 130, x1: 1290, y1: 521 };
  for (const hero of [null, { distance: HERO_DISTANCE, shift: HERO_SHIFT }, { distance: 5, shift: -HERO_SHIFT }]) {
    const camera = cameraMatrices(frame, 1, canvas.width / canvas.height, { rect, canvas, hero });
    for (const [rows, cols] of sizes) {
      for (let row = 0; row <= rows; row++) {
        for (let col = 0; col <= cols; col++) {
          const lon = dust.west + (col * 70) / cols;
          const lat = dust.north - (row * 30) / rows;
          const ndc = projectToNdc(camera, surfacePoint(frame, lon, lat, 1));
          const px = ((ndc.x + 1) / 2) * canvas.width;
          const py = ((1 - ndc.y) / 2) * canvas.height;
          assert.ok(Math.abs(px - (rect.x0 + ((rect.x1 - rect.x0) * col) / cols)) < 1e-6, `pixel x, row ${row} col ${col}`);
          assert.ok(Math.abs(py - (rect.y0 + ((rect.y1 - rect.y0) * row) / rows)) < 1e-6, `pixel y, row ${row} col ${col}`);
        }
      }
    }
  }
  const full = fitFrustum(frame);
  assert.ok(Math.abs(full.left + full.right) < 1e-12 && Math.abs(full.top + full.bottom) < 1e-12, "no rect means the whole canvas");
});

test("the hero pose puts a huge, partly cropped Earth on the chosen side and mirrors for Arabic without mirroring the map", () => {
  const frame = createFrame(dust);
  const aspect = 16 / 9;
  const centre = (shift) => projectToNdc(cameraMatrices(frame, 0, aspect, { hero: { distance: HERO_DISTANCE, shift } }), new Vector3(0, 0, 0));
  assert.ok(Math.abs(centre(HERO_SHIFT).x - HERO_SHIFT) < 1e-9, "Earth centre sits at the shift");
  assert.ok(Math.abs(centre(-HERO_SHIFT).x + HERO_SHIFT) < 1e-9, "mirrored for right-to-left");
  // Angular radius of the globe against the half field of view: the diameter is about 1.1x the viewport height.
  const camera = cameraMatrices(frame, 0, aspect, { hero: { distance: HERO_DISTANCE, shift: HERO_SHIFT } });
  const eye = new Vector3().setFromMatrixPosition(camera.world);
  assert.ok(Math.abs(eye.length() - HERO_DISTANCE) < 1e-9);
  const limbTop = projectToNdc(camera, new Vector3(0, 1, 0).multiplyScalar(1));
  assert.ok(Math.abs(limbTop.y) > 0.4, "the globe is large in frame");
  // The map's geography is the same in both directions: west is left at full unroll.
  const ltr = cameraMatrices(frame, 1, aspect, { hero: { distance: HERO_DISTANCE, shift: HERO_SHIFT } });
  const rtl = cameraMatrices(frame, 1, aspect, { hero: { distance: HERO_DISTANCE, shift: -HERO_SHIFT } });
  for (const camera2 of [ltr, rtl]) {
    const west = projectToNdc(camera2, surfacePoint(frame, dust.west, 30, 1));
    const east = projectToNdc(camera2, surfacePoint(frame, dust.east, 30, 1));
    assert.ok(west.x < east.x, "west stays left");
  }
});

test("the surface morphs from the unit sphere to the tangent plate carree plane", () => {
  const frame = createFrame(dust);
  for (const [lon, lat] of [[-20, 15], [15, 30], [50, 45], [-120, -30], [170, 70]]) {
    assert.ok(Math.abs(surfacePoint(frame, lon, lat, 0).length() - 1) < 1e-12, "t=0 is on the sphere");
    const flat = surfacePoint(frame, lon, lat, 1);
    const local = flat.clone().sub(frame.normal);
    assert.ok(Math.abs(local.dot(frame.normal)) < 1e-12, "t=1 is on the tangent plane");
    assert.ok(Math.abs(local.dot(frame.east) - (lon - frame.lon0) * DEG) < 1e-12, "x is longitude");
    assert.ok(Math.abs(local.dot(frame.north) - (lat - frame.lat0) * DEG) < 1e-12, "y is latitude");
  }
  const lifted = surfacePoint(frame, frame.lon0, frame.lat0, 1, 0.01);
  assert.ok(Math.abs(lifted.clone().sub(frame.normal).dot(frame.normal) - 0.01) < 1e-12, "lift follows the normal");
});

test("hero spin turns only the sphere and unwinds to nothing before the map is flat", () => {
  const frame = createFrame(dust);
  const spun = surfacePoint(frame, 10, 20, 0, 0, new Vector3(), 90);
  const expected = spherePoint(100, 20);
  assert.ok(spun.distanceTo(expected) < 1e-12, "spin shifts longitude on the sphere");
  assert.ok(surfacePoint(frame, 10, 20, 1, 0, new Vector3(), 90).distanceTo(surfacePoint(frame, 10, 20, 1)) < 1e-12,
    "once the map is flat the sphere's spin no longer matters");
  assert.equal(flightSpin(120, 0), 120);
  assert.ok(flightSpin(120, 1) === 0);
  assert.ok(flightSpin(-80, 1) === 0);
  let previous = Infinity;
  for (let step = 0; step <= 50; step++) {
    const value = Math.abs(flightSpin(100, step / 50));
    assert.ok(value <= previous + 1e-12, "monotone unwind");
    previous = value;
  }
  assert.ok(flightSpin(100, 0.6) === 0, "fully unwound before the unroll is complete");
  assert.ok(unroll(0.6) < 1);
});

test("the fly-to eases from the whole globe in view to the unrolled map", () => {
  assert.equal(ease(0), 0);
  assert.equal(ease(1), 1);
  assert.equal(unroll(0), 0);
  assert.equal(unroll(1), 1);
  let previous = -1;
  for (let step = 0; step <= 100; step++) {
    const value = unroll(step / 100);
    assert.ok(value >= previous, "monotone");
    previous = value;
  }
});

test("shape builders emit the expected vertex counts and stay on the unrolled plane", () => {
  const frame = createFrame(dust);
  const rects = [cellRect(frame.bounds, 3, 4, 0, 0), cellRect(frame.bounds, 3, 4, 2, 3)];
  assert.equal(rects[0].north, 45);
  assert.equal(rects[0].west, -20);
  assert.equal(rects[1].south, 15);
  assert.equal(rects[1].east, 50);
  const fill = fillTriangles(frame, rects, { t: 1, lift: 0.004, subdiv: 4 });
  assert.equal(fill.positions.length, rects.length * 4 * 4 * 6 * 3);
  assert.equal(fill.uvs.length, rects.length * 4 * 4 * 6 * 2);
  for (let i = 0; i < fill.positions.length; i += 3) {
    const offset = new Vector3(fill.positions[i], fill.positions[i + 1], fill.positions[i + 2]).sub(frame.normal);
    assert.ok(Math.abs(offset.dot(frame.normal) - 0.004) < 1e-6);
  }
  const ring = ringTriangles(frame, rects, { t: 0.5, segments: 6 });
  assert.equal(ring.length, rects.length * 24 * 6 * 3);
  assert.equal(gridLines(frame, 3, 4, { t: 1, segments: 24 }).length, (4 + 5) * 24 * 2 * 3);
  const brackets = bracketTriangles(frame, rects, { t: 1 });
  assert.equal(brackets.length, rects.length * 8 * 6 * 3, "eight arms (four corners, two each) per cell");
  assert.ok([...ring, ...fill.positions, ...brackets].every(Number.isFinite));
  // A bracket stays inside its own cell.
  const cell = rects[0];
  const inside = bracketTriangles(frame, [cell], { t: 1 });
  for (let i = 0; i < inside.length; i += 3) {
    const local = new Vector3(inside[i], inside[i + 1], inside[i + 2]).sub(frame.normal);
    const lon = frame.lon0 + local.dot(frame.east) / DEG;
    const lat = frame.lat0 + local.dot(frame.north) / DEG;
    assert.ok(lon >= cell.west - 1e-6 && lon <= cell.east + 1e-6 && lat >= cell.south - 1e-6 && lat <= cell.north + 1e-6);
  }
  assert.throws(() => createFrame({ west: 10, east: -10, south: 0, north: 1 }), RangeError);
});

// ---------- overlay model ----------

test("the overlay model reads only the playhead, the guesses and approved outcomes", () => {
  const grid = { rows: 3, cols: 4, cells: [] };
  const outcomes = [
    { row: 0, col: 2, outcome: "correct" },
    { row: 1, col: 1, outcome: "incorrect" },
    { row: 2, col: 0, outcome: "missed" },
  ];
  const before = overlayModel({ phase: "decode", grid, activeCell: [1, 2], guesses: [[0, 2], [9, 9]] }, outcomes);
  assert.deepEqual(before.active, [1, 2]);
  assert.deepEqual(before.selected, [[0, 2]]);
  assert.deepEqual(before.outcomes, [], "nothing is tinted before Reveal, whatever the caller supplies");
  for (const phase of ["intro", "legend", "listen", "decode"]) {
    assert.deepEqual(overlayModel({ phase, grid, guesses: [] }, outcomes).outcomes, []);
  }
  assert.equal(overlayModel({ phase: "listen", grid, activeCell: null, guesses: [] }).active, null);
  assert.equal(overlayModel({ phase: "listen", grid, activeCell: [3, 0], guesses: [] }).active, null, "out of grid");
  assert.equal(overlayModel({ phase: "listen", grid, activeCell: "ev-3", guesses: [] }).active, null, "never an event id");

  const after = overlayModel({ phase: "reveal", grid, guesses: [[0, 2]] }, outcomes);
  assert.deepEqual(after.outcomes, outcomes);
  assert.deepEqual(sanitizeOutcomes([{ row: 0, col: 0, outcome: "correct" }, { row: 0, col: 0, outcome: "missed" }], 3, 4), []);
  assert.deepEqual(sanitizeOutcomes([{ row: 0, col: 0, outcome: "dusty" }], 3, 4), []);
  assert.deepEqual(sanitizeOutcomes([{ row: 5, col: 0, outcome: "missed" }], 3, 4), []);
  assert.deepEqual(sanitizeOutcomes(null, 3, 4), []);
  const leaky = overlayModel({ phase: "reveal", grid: { rows: 3, cols: 4, cells: [{ row: 0, col: 0, value: 0.9, status: "measured" }] }, guesses: [] });
  assert.ok(!JSON.stringify(leaky).includes("0.9") && !JSON.stringify(leaky).includes("measured"));
});

// ---------- sound guide ----------

test("the sound guide follows playMode and the transport position and nothing else", () => {
  const at = (positionS, overrides = {}) => guideState({ playMode: "legend", transport: { status: "playing", positionS, ...overrides.transport }, ...overrides.snapshot });
  assert.equal(LEGEND_SECONDS, 6);
  assert.equal(at(0), null, "silent before it starts");
  assert.equal(at(6), null, "gone when it ends");
  assert.equal(at(3, { transport: { status: "idle" } }), null);
  assert.equal(at(3, { snapshot: { playMode: "sweep" } }), null, "only the legend plan drives it");
  assert.equal(guideState(null), null);
  assert.equal(at(1).step, "sweep");
  assert.equal(at(3).step, "pitch");
  assert.equal(at(5).step, "loudness");
  assert.ok(Math.abs(at(1).amount - 0.5) < 1e-12 && Math.abs(at(3).amount - 0.5) < 1e-12 && Math.abs(at(5).amount - 0.5) < 1e-12);
  assert.equal(at(1).opacity, 1);
  assert.ok(at(0.01).opacity < 0.5, "fades in at the start of a window");
  assert.equal(at(2.5, { transport: { status: "paused" } }).step, "pitch", "stays visible while paused");
  // Seeking changes the picture with the position, so there is no hidden timer.
  assert.equal(at(4.2).step, "loudness");
  assert.equal(at(0.4).step, "sweep");
});

test("guide strips follow the surface and the unrolled map", () => {
  const frame = createFrame(dust);
  const meridian = meridianStrip(frame, 15, -20, 60, { t: 1, segments: 8 });
  assert.equal(meridian.length, 8 * 6 * 3);
  const parallel = parallelStrip(frame, 30, -20, 50, { t: 1, segments: 12 });
  assert.equal(parallel.length, 12 * 6 * 3);
  // On the flat map a meridian is a vertical line: every vertex has (nearly) the same east coordinate.
  const norths = [];
  for (let i = 0; i < meridian.length; i += 3) {
    const local = new Vector3(meridian[i], meridian[i + 1], meridian[i + 2]).sub(frame.normal);
    norths.push(local.dot(frame.east));
  }
  assert.ok(Math.max(...norths) - Math.min(...norths) < 0.02);
});

// ---------- reveal particles ----------

function revealedSnapshot(values, rows = 3, cols = 4) {
  return {
    phase: "reveal",
    grid: { rows, cols, cells: values.map((value, index) => ({ row: Math.floor(index / cols), col: index % cols, lat: 0, lon: 0, value, status: value === null ? "missing" : "measured" })) },
  };
}

test("particles exist only after Reveal, and their density follows the measured values", () => {
  const values = [0.35, 0.1, 0, null, 0.2, 0.05, 0.3, 0.15, 0.25, 0.01, 0.12, 0.28];
  const redacted = { phase: "decode", grid: { rows: 3, cols: 4, cells: values.map((_, index) => ({ row: Math.floor(index / 4), col: index % 4, lat: 0, lon: 0 })) } };
  for (const phase of ["intro", "legend", "listen", "decode"]) assert.equal(buildDustParticles({ ...redacted, phase }, dust), null, `no particles in ${phase}`);
  assert.equal(buildDustParticles(null, dust), null);

  const data = buildDustParticles(revealedSnapshot(values), dust);
  assert.ok(data.count > 0 && data.count <= MAX_PARTICLES, "within the particle budget");
  assert.equal(data.lonLat.length, data.count * 2);
  assert.equal(data.vmax, 0.35);
  const byCell = new Map(data.perCell.map((entry) => [entry.row * 4 + entry.col, entry.particles]));
  assert.equal(byCell.get(2), 0, "a reading of zero gets no particles");
  assert.equal(byCell.get(3), 0, "a missing cell gets no particles");
  const reference = byCell.get(0);
  for (const [index, value] of values.entries()) {
    if (!value) continue;
    assert.ok(Math.abs(byCell.get(index) - (reference * value) / 0.35) <= 1, `cell ${index} density is proportional to its reading`);
  }
  // Particles stay inside their own cell.
  const dLon = 70 / 4;
  const dLat = 30 / 3;
  let cursor = 0;
  for (const entry of data.perCell) {
    for (let k = 0; k < entry.particles + entry.haze; k++, cursor++) {
      const lon = data.lonLat[cursor * 2];
      const lat = data.lonLat[cursor * 2 + 1];
      assert.ok(lon >= dust.west + entry.col * dLon - 1e-4 && lon <= dust.west + (entry.col + 1) * dLon + 1e-4);
      assert.ok(lat <= dust.north - entry.row * dLat + 1e-4 && lat >= dust.north - (entry.row + 1) * dLat - 1e-4);
    }
  }
  assert.equal(cursor, data.count);
  const again = buildDustParticles(revealedSnapshot(values), dust);
  assert.deepEqual([...again.lonLat.slice(0, 40)], [...data.lonLat.slice(0, 40)], "artistic positions are deterministic");
});

test("the particle budget holds for both grid sizes and for degenerate readings", () => {
  for (const [rows, cols] of sizes) {
    const values = Array.from({ length: rows * cols }, (_, index) => 0.05 + (index % 7) * 0.05);
    const data = buildDustParticles(revealedSnapshot(values, rows, cols), dust);
    assert.ok(data.count <= MAX_PARTICLES, `${rows}x${cols}: ${data.count} particles`);
  }
  assert.equal(buildDustParticles(revealedSnapshot(Array(12).fill(0)), dust).count, 0);
  assert.equal(buildDustParticles(revealedSnapshot(Array(12).fill(null)), dust).count, 0);
  assert.equal(buildDustParticles({ phase: "reveal", grid: { rows: 3, cols: 4, cells: [] } }, dust).count, 0);
  assert.deepEqual(particleCounts([0, 0]).counts, [0, 0]);
  const wild = particleCounts(Array.from({ length: 48 }, () => 1e9));
  assert.ok(wild.counts.reduce((a, b) => a + b, 0) * (1 + HAZE_SHARE) <= MAX_PARTICLES + 1);
});

// ---------- audio tap and waveform ----------

test("the audio tap routes output through an analyser and the waveform draws only a real signal", () => {
  class FakeNode { constructor(kind) { this.kind = kind; this.connections = []; } connect(node) { this.connections.push(node); return node; } }
  class FakeContext {
    constructor() { this.out = new FakeNode("destination"); }
    get destination() { return this.out; }
    createAnalyser() { return Object.assign(new FakeNode("analyser"), { fftSize: 0, smoothingTimeConstant: 0, getByteTimeDomainData() {} }); }
    createGain() { return new FakeNode("gain"); }
  }
  const tap = createAudioTap(FakeContext);
  assert.equal(tap.analyser, null);
  const context = tap.createContext();
  assert.equal(context.destination.kind, "analyser", "the transport will connect its master gain to the analyser");
  assert.equal(context.destination, tap.analyser);
  assert.equal(tap.analyser.connections[0].kind, "destination", "and the analyser feeds the real output");
  assert.equal(tap.analyser.fftSize, 1024);
  assert.throws(() => createAudioTap(null).createContext(), /Web Audio/);

  assert.equal(isSilent(new Uint8Array(64).fill(128)), true);
  assert.equal(isSilent(Uint8Array.from([128, 128, 200])), false);
  const calls = [];
  const canvas = { width: 100, height: 20, getContext: () => ({
    clearRect() {}, beginPath() {}, stroke() {}, moveTo: (x, y) => calls.push(["m", x, y]), lineTo: (x, y) => calls.push(["l", x, y]),
  }) };
  assert.equal(drawWaveform(canvas, null), false, "no analyser draws a flat line");
  assert.deepEqual(calls.at(-1), ["l", 100, 10]);
  calls.length = 0;
  const quiet = { fftSize: 256, getByteTimeDomainData: (a) => a.fill(128) };
  assert.equal(drawWaveform(canvas, quiet), false, "silence is not drawn as a signal");
  calls.length = 0;
  const loud = { fftSize: 256, getByteTimeDomainData: (a) => a.forEach((_, i) => { a[i] = 128 + Math.round(100 * Math.sin(i / 4)); }) };
  assert.equal(drawWaveform(canvas, loud), true, "a live signal is drawn");
  assert.ok(new Set(calls.map((c) => c[2])).size > 10, "the line follows the samples");
});

// ---------- mount ----------

function fakeDom() {
  const element = () => ({
    className: "", hidden: false, textContent: "", children: [], removed: false,
    setAttribute() {}, append(...nodes) { this.children.push(...nodes); }, remove() { this.removed = true; },
  });
  const bottom = element();
  const stage = { dataset: {}, querySelector: () => null, closest: () => ({ querySelector: () => bottom }) };
  return { bottom, stage, root: { ownerDocument: { createElement: element }, parentElement: stage, contains: () => false } };
}

test("without a scene (no WebGL) the mount hands over to the flat visual and still returns its handle", () => {
  const { root: rootElement, stage } = fakeDom();
  const session = { getState: () => ({}), subscribe: () => () => {} };
  const options = { t: (key) => key };
  const handle = { dispose() {}, prepareReveal: () => null, clearReveal() {} };
  const calls = [];
  const fallback = (...args) => { calls.push(args); return handle; };
  assert.equal(createGlobeMount({ scene: null, fallback })(rootElement, session, options), handle);
  assert.equal(stage.dataset.renderer, "svg");
  assert.deepEqual(calls[0], [rootElement, session, options]);
  assert.throws(() => createGlobeMount({}), TypeError);
});

test("with a scene the mount feeds it only the snapshot and the matching geography, and falls back on context loss", () => {
  const { root: rootElement, stage, bottom } = fakeDom();
  const calls = [];
  let lost;
  const scene = {
    setStage: (value) => calls.push(["stage", value]), setGeography: (value) => calls.push(["geography", value]),
    setSnapshot: (value) => calls.push(["snapshot", value]), setOutcomes: (value) => calls.push(["outcomes", value]),
    clearOutcomes: () => calls.push(["clear"]), onLost: (handler) => { lost = handler; },
  };
  const grid = { rows: 3, cols: 4, cells: [] };
  const snapshot = { caseId: "dust", level: "quick", phase: "listen", grid, guesses: [], activeCell: null };
  let listener;
  const session = { getState: () => snapshot, subscribe: (fn) => { listener = fn; fn(snapshot); return () => calls.push(["unsubscribe"]); } };
  const geography = { caseId: "dust", bounds: dust, projection: "plate-carree" };
  const flat = { dispose: () => calls.push(["flat dispose"]), prepareReveal: () => "flat", clearReveal() {} };
  let captions = 0;
  const mount = createGlobeMount({ scene, fallback: () => flat, captionFor: () => { captions++; return "caption"; }, onLost: () => calls.push(["lost"]) });
  const handle = mount(rootElement, session, { t: (key) => key, geography });

  assert.equal(stage.dataset.renderer, "webgl");
  assert.deepEqual(calls.find(([name]) => name === "geography"), ["geography", geography]);
  assert.equal(calls.find(([name]) => name === "snapshot")[1], snapshot);
  assert.equal(handle.prepareReveal(), null, "nothing to prepare before Reveal");
  assert.equal(bottom.children.length, 2, "outcome key and particle caption");

  listener({ ...snapshot, caseId: "other" });
  assert.deepEqual(calls.filter(([name]) => name === "geography").at(-1), ["geography", null], "geography never applies to another case");
  listener({ ...snapshot, phase: "reveal" });
  assert.ok(captions > 0, "the caption is requested only once Reveal is reached");
  assert.equal(bottom.children[1].hidden, false);

  lost();
  assert.ok(calls.some(([name]) => name === "lost"));
  assert.equal(stage.dataset.renderer, "svg");
  assert.equal(handle.prepareReveal(), "flat", "the flat visual takes over");
  handle.dispose();
  assert.ok(calls.some(([name]) => name === "flat dispose"));
});

// ---------- hygiene ----------

function comments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:])\/\/.*$/gm, "$1");
}

test("only the particle module reads cell readings, and no 3D file reads plans, event ids or the network", () => {
  const files = readdirSync(new URL("web/cinematic/", root)).filter((name) => name.endsWith(".js"));
  for (const name of ["globe.js", "geo.js", "overlay.js", "scene.js", "main.js", "hero.js", "guide.js", "particles.js", "audio-tap.js", "copy.js"]) {
    assert.ok(files.includes(name), `${name} exists`);
  }
  const transportReaders = new Set(["main.js", "hero.js", "guide.js", "audio-tap.js"]);
  for (const name of files) {
    const code = comments(read(`web/cinematic/${name}`));
    // copy.js is prose, so words like "measured" are fine there; every code file is held to the full list.
    const words = name === "copy.js" ? [] : [/\bmeasured\b/, /\bmissing\b/, /\bevidence\b/i, ...(name === "hero.js" ? [] : [/\btruth\b/])];
    for (const forbidden of [/activeEventId/, /eventCount/, /\.events\b/, /below_threshold/, /\.planRevision\b/, /\.score\b/, ...words]) {
      assert.doesNotMatch(code, forbidden, `${name} must not use ${forbidden}`);
    }
    if (name !== "particles.js") {
      assert.doesNotMatch(code, /\bcells?\.value\b|\bvalue\b[^\n]*\bof\b[^\n]*\bcells\b|\{[^}\n]*\bvalue\b[^}\n]*\}\s*of\s*[^\n]*cells/, `${name} must not read cell readings`);
    }
    // `.status` is playback state (idle, playing, ...) in the files that follow the transport, and a cell status elsewhere.
    if (name !== "particles.js" && !transportReaders.has(name)) assert.doesNotMatch(code, /\.status\b/, `${name} must not read statuses`);
    if (transportReaders.has(name)) assert.doesNotMatch(code, /\bcell\.status\b|\.cells\b[^\n]*\.status\b/, `${name} must not read cell statuses`);
    if (!transportReaders.has(name)) assert.doesNotMatch(code, /\bmakePlan\b|\bheardClass\b|\btransport\b/, `${name} must not touch plans or transport`);
    // The hero may read the challenge threshold from the loaded case, and nothing else about the truth.
    if (name === "hero.js") assert.doesNotMatch(code, /truth\.(?!threshold\b)|truth\[/, "hero.js reads only truth.threshold");
    assert.doesNotMatch(code, /https?:\/\//, `${name} must not reference the network`);
    assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|importScripts|\bcdn\b|unpkg|jsdelivr/i, `${name} must work offline`);
  }
  assert.match(read("web/cinematic/particles.js"), /phase !== "reveal"/, "the particle builder is gated on Reveal");
  assert.match(comments(read("web/cinematic/scene.js")), /buildDustParticles\(snapshot/, "scene builds particles from the snapshot only");
  const css = read("web/cinematic/cinematic.css");
  assert.doesNotMatch(css, /https?:\/\/|@import/);
  const html = read("web/decode-3d.html");
  assert.doesNotMatch(html, /https?:\/\//, "the page loads nothing from the network");
  assert.match(html, /\.\/cinematic\/main\.js/);
  assert.match(html, /\.\/cinematic\/cinematic\.css/);
  assert.match(read("web/cinematic/scene.js"), /\.\.\/vendor\/three\/three\.module\.min\.js/);
});

test("no pre-Reveal path draws colour or particles over the region", () => {
  const scene = comments(read("web/cinematic/scene.js"));
  // Dust is built from a snapshot only when its phase is reveal; the key for it is empty otherwise.
  assert.match(scene, /snapshot\?\.phase === "reveal" && frame/);
  // Outcome tints come from overlayModel, which empties them before Reveal (tested above).
  assert.match(scene, /model = overlayModel\(next, outcomes\)/);
  assert.match(scene, /if \(gridChanged \|\| next\.phase !== "reveal"\) outcomes = \[\]/);
});

test("the page keeps every element the shared Decode wiring queries and uses the corrected copy", () => {
  const html = read("web/decode-3d.html");
  const source = read("web/decode.js");
  const ids = new Set([...source.matchAll(/byId\("([\w-]+)"\)/g)].map((match) => `decode-${match[1]}`));
  for (const id of ["decode-title", "decode-home", "decode-state", "decode-retry", "decode-page"]) ids.add(id);
  assert.ok(ids.size > 25);
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`), `decode-3d.html needs #${id}`);
  for (const id of ["cine-eyebrow", "cine-title-lead", "cine-title-accent", "cine-lede", "cine-lede2", "cine-play-guide", "cine-play-label", "cine-wave",
    "cine-guide-caption", "cine-steps", "cine-start", "cine-start-label", "cine-source", "cine-challenge", "cine-zoom-in", "cine-zoom-out", "cine-compass",
    "cine-sound", "cine-dock-label", "cine-nav-decode", "cine-nav-about", "cine-nav-science", "cine-nav-dataset", "cine-lang-en", "cine-lang-ar"]) {
    assert.match(html, new RegExp(`id="${id}"`), `the hero needs #${id}`);
  }
  // The region and date live in the case bar, inside the root that mountDecode queries.
  const main = html.slice(html.indexOf('<main id="decode-page"'), html.indexOf("</main>"));
  assert.match(main, /id="decode-region"/);
  assert.match(main, /id="decode-date"/);
  assert.doesNotMatch(html + read("web/cinematic/copy.js") + read("web/cinematic/main.js"), /Turned NASA dust data/);
  assert.match(html, /HEAR THE/);
  assert.match(html, /UNSEEN/);
});

test("English and Arabic carry the same copy keys, and case facts are never hardcoded in them", () => {
  const keys = (object, prefix = "") => Object.entries(object).flatMap(([key, value]) =>
    value && typeof value === "object" && !Array.isArray(value) ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`]);
  assert.deepEqual(keys(copy.ar).sort(), keys(copy.en).sort());
  assert.equal(copy.en.steps.length, 3);
  assert.equal(copy.ar.steps.length, 3);
  for (const language of ["en", "ar"]) {
    assert.match(copy[language].challenge, /\{threshold\}/);
    assert.match(copy[language].challenge, /\{measure\}/);
    const all = JSON.stringify(copy[language]);
    assert.doesNotMatch(all, /0\.2|2025|Mediterranean|المتوسط/, "no date, threshold or region in the copy");
  }
  assert.equal(fill(copy.en.challenge, { measure: "dust optical depth", threshold: "0.20" }), "Challenge: find the cells with dust optical depth ≥ 0.20");
  assert.match(copy.en.caption.dust, /measured GEOS-FP dust optical depth per cell; positions inside a cell are artistic/);
  assert.match(read("web/cinematic/hero.js"), /data\.levels\.quick\.truth\.threshold/, "the threshold is read from the loaded case");
  assert.match(read("web/cinematic/hero.js"), /data\.source\.product/, "the source is read from the loaded case");
});

// ---------- assets ----------

function jpegSize(buffer) {
  assert.equal(buffer.readUInt16BE(0), 0xffd8, "JPEG signature");
  let offset = 2;
  while (offset < buffer.length) {
    assert.equal(buffer[offset], 0xff);
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    offset += 2 + length;
  }
  throw new Error("No JPEG frame header");
}

test("Earth textures and three.js are packaged locally, small, and documented with sources and SHA-256", () => {
  const files = {
    "blue-marble-4096.jpg": { width: 4096, height: 2048 },
    "blue-marble-2048.jpg": { width: 2048, height: 1024 },
    "black-marble-3600.jpg": { width: 3600, height: 1800 },
    "black-marble-2048.jpg": { width: 2048, height: 1024 },
  };
  let total = 0;
  const docs = read("docs/earth-assets.md");
  for (const [name, size] of Object.entries(files)) {
    const data = bytes(`web/assets/earth/${name}`);
    total += data.length;
    assert.deepEqual(jpegSize(data), size, `${name} dimensions`);
    assert.ok(size.width <= 4096, "no texture above 4096");
    assert.ok(docs.includes(name) && docs.includes(sha256(data)), `${name} is documented with its SHA-256`);
  }
  assert.ok(total < 8 * 1024 * 1024, "textures stay under 8 MB in total");
  assert.ok(bytes("web/assets/earth/blue-marble-2048.jpg").length < bytes("web/assets/earth/blue-marble-4096.jpg").length);
  assert.ok(bytes("web/assets/earth/black-marble-2048.jpg").length < bytes("web/assets/earth/black-marble-3600.jpg").length);
  assert.equal(sha256(bytes("web/assets/earth/black-marble-3600.jpg")), "d87de751a264e4f8ff69c68de5dab9606daee87a6f15ae743c93200743bd7ec1", "the Black Marble desktop file is NASA's unmodified download");

  const three = bytes("web/vendor/three/three.module.min.js");
  assert.ok(statSync(new URL("web/vendor/three/LICENSE", root)).size > 0);
  assert.match(read("web/vendor/three/LICENSE"), /MIT License/);
  assert.ok(docs.includes("three.module.min.js") && docs.includes(sha256(three)), "three.js SHA-256 matches the documented value");
  assert.match(docs, /https:\/\/assets\.science\.nasa\.gov\/content\/dam\/science\/esd\/eo\/images\/bmng\/bmng-base\/august\/world\.200408\.3x5400x2700\.jpg/);
  assert.match(docs, /https:\/\/assets\.science\.nasa\.gov\/content\/dam\/science\/esd\/eo\/images\/imagerecords\/144000\/144898\/BlackMarble_2016_01deg\.jpg/);
  assert.ok(docs.includes("2048023ccc62250c677c0f4b03d4362f997b130eb0154a6cad00aa1b27c390b9"), "Blue Marble source hash is recorded");
  assert.match(docs, /Reto St[oö]ckli/);
  assert.match(docs, /Black Marble 2016/);
  assert.match(docs, /0\.169\.0/);
});
