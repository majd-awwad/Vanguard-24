import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { classifyReferencePixel, referenceSample, resamplePath, serpentinePath } from "../web/studio/data.js";
import { mapStudioSample, STUDIO_MAPPING_VERSION } from "../web/audio/studio-sonification.js";
import { createStudioPlayback } from "../web/studio/playback.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("Studio manifest keeps official images traceable and refuses quantitative claims", async () => {
  const manifest = JSON.parse(await readFile(resolve(root, "web/assets/studio/manifest.json"), "utf8"));
  assert.equal(manifest.status, "REFERENCE_IMAGE_ONLY");
  assert.equal(manifest.quantitative, false);
  assert.equal(manifest.projection.pixel_level_geolocation_verified, false);
  assert.equal(manifest.numeric_target.product, "VNP46A4.002");
  assert.equal(manifest.numeric_target.availability, "blocked_pending_earthdata_token");
  for (const layer of ["2012", "2023", "change"]) {
    const asset = manifest.layers[layer];
    assert.equal(digest(await readFile(resolve(root, "web/assets/studio", asset.file))), asset.sha256);
    assert.match(asset.source_url, /^https:\/\/svs\.gsfc\.nasa\.gov\//);
  }
});

test("reference classifier distinguishes the published color vocabulary without inventing radiance", () => {
  assert.equal(classifyReferencePixel({ r: 170, g: 65, b: 225 }, "change").changeDirection, "increase");
  assert.equal(classifyReferencePixel({ r: 230, g: 125, b: 42 }, "change").changeDirection, "decrease");
  assert.equal(classifyReferencePixel({ r: 230, g: 229, b: 225 }, "change").changeDirection, "stable");
  assert.equal(classifyReferencePixel({ r: 4, g: 5, b: 7 }, "change").changeDirection, "no-signal");
  const sample = referenceSample({ longitude: 77.2, latitude: 28.6, pixel: { r: 170, g: 65, b: 225 }, layer: "change" });
  assert.equal(sample.baselineRadiance, null);
  assert.equal(sample.comparisonRadiance, null);
  assert.equal(sample.deltaRadiance, null);
  assert.equal(sample.quality, "reference-only");
  assert.equal(sample.quantitative, false);
});

test("sonification is deterministic, bounded, directional and silent for no signal", () => {
  const increase = referenceSample({ longitude: 77, latitude: 28, pixel: { r: 170, g: 65, b: 225 }, layer: "change" });
  const decrease = referenceSample({ longitude: 77, latitude: 28, pixel: { r: 230, g: 125, b: 42 }, layer: "change" });
  const first = mapStudioSample(increase, { pan: 1 });
  assert.deepEqual(first, mapStudioSample(increase, { pan: 1 }));
  assert.equal(first.mappingVersion, STUDIO_MAPPING_VERSION);
  assert.ok(first.frequencyHz > mapStudioSample(decrease).frequencyHz);
  assert.ok(first.gain > 0 && first.gain < 0.2);
  assert.equal(first.pan, 0.42);
  assert.equal(mapStudioSample(decrease, { mode: "increase" }).audible, false);
  assert.equal(mapStudioSample(referenceSample({ longitude: 0, latitude: 0, pixel: { r: 0, g: 0, b: 0 }, layer: "change" })).gain, 0);
});

test("scan and route sampling are geographic, deterministic and bounded", () => {
  const bounds = { west: 70, east: 80, south: 20, north: 30 };
  const scan = serpentinePath(bounds, 5, 3);
  assert.equal(scan.length, 15);
  assert.ok(scan[0].longitude < scan[4].longitude);
  assert.ok(scan[5].longitude > scan[9].longitude);
  const route = resamplePath([{ longitude: 70, latitude: 20 }, { longitude: 75, latitude: 25 }, { longitude: 80, latitude: 20 }], 50);
  assert.equal(route.length, 50);
  assert.deepEqual(route[0], { longitude: 70, latitude: 20 });
  assert.deepEqual(route.at(-1), { longitude: 80, latitude: 20 });
  assert.deepEqual(route, resamplePath([{ longitude: 70, latitude: 20 }, { longitude: 75, latitude: 25 }, { longitude: 80, latitude: 20 }], 50));
});

test("playback replays the same sequence and never creates hidden samples", () => {
  let time = 0;
  let scheduled;
  const steps = [];
  const playback = createStudioPlayback({
    now: () => time,
    requestFrame: (callback) => { scheduled = callback; return 1; },
    cancelFrame: () => { scheduled = undefined; },
    onStep: (sample, index) => steps.push([sample.id, index]),
  });
  const sequence = [{ id: "a" }, { id: "b" }, { id: "c" }];
  playback.load(sequence, { slotSeconds: 0.1 });
  playback.play();
  time = 0.11; scheduled();
  time = 0.21; scheduled();
  time = 0.31; scheduled();
  assert.deepEqual(steps.map(([id]) => id), ["a", "b", "c"]);
  steps.length = 0;
  playback.restart();
  time = 1; playback.play();
  time = 1.11; scheduled();
  time = 1.21; scheduled();
  time = 1.31; scheduled();
  assert.deepEqual(steps.map(([id]) => id), ["a", "b", "c"]);
});

test("Studio page links from the existing home and states the scientific limitation", async () => {
  const home = await readFile(resolve(root, "web/index.html"), "utf8");
  const studio = await readFile(resolve(root, "web/studio.html"), "utf8");
  assert.match(home, /href="\.\/studio\.html"/);
  assert.match(studio, /REFERENCE|reference-image mode/i);
  assert.match(studio, /No radiance value is inferred|noRadiance/);
  assert.doesNotMatch(studio, /population increased|economic growth/i);
});
