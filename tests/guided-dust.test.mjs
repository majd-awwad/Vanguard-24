import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { validateDecodeCase } from "../web/contracts/validate.js";
import { bandIds, buildBandPlayback, compareDustBands, completedBandCount, observatoryReference } from "../web/experiences/decode/guided-dust.js";

const production = validateDecodeCase(JSON.parse(await readFile(new URL(
  "../web/assets/decode/data/dust-geos-fp-20250819-1930-north-africa-med.json", import.meta.url,
), "utf8")));

test("Quick evidence points to the cells containing its centres on the reference map", async () => {
  const root = new URL("../web/assets/decode/dust-v2/", import.meta.url);
  const grid = JSON.parse(await readFile(new URL("grid.json", root), "utf8"));
  for (const cell of production.levels.quick.cells) {
    const location = observatoryReference(production, cell);
    assert.equal(location.first, "geos-fp-dust-20250819-1930");
    const bounds = grid.cells[location.row * grid.cols + location.col].bounds;
    assert.ok(cell.lat <= bounds.north && cell.lat > bounds.south);
    assert.ok(cell.lon >= bounds.west && cell.lon < bounds.east);
  }
  const cell = production.levels.quick.cells[0];
  assert.equal(observatoryReference({ ...production, fixture: true }, cell), null);
  assert.equal(observatoryReference(production, { ...cell, lat: 90 }), null);
});

function compareRows(rows) {
  const cells = rows.flatMap((values, row) => values.map((value, col) => ({
    row, col, value, status: value === null ? "missing" : value < 0.2 ? "below_threshold" : "measured",
  })));
  return compareDustBands({ levels: { quick: { cells } } });
}

test("the production band means and strongest bands come from the validated Quick values", () => {
  const result = compareDustBands(production);
  const means = bandIds.map((_, row) => {
    const cells = production.levels.quick.cells.slice(row * 4, (row + 1) * 4);
    return (cells[0].value + cells[1].value + cells[2].value + cells[3].value) / 4;
  });
  assert.deepEqual(result.bands.map(band => band.mean), means);
  assert.deepEqual(result.bands.map(band => band.count), [4, 4, 4]);
  assert.deepEqual(result.strongest, bandIds.filter((_, row) => means[row] === Math.max(...means)));
});

test("available zero and below-threshold readings count, a missing band has no rank, and ties share rank", () => {
  const { bands, strongest } = compareRows([[0, 0.3, null, null], [0.1, 0.2, null, null], [null, null, null, null]]);
  assert.ok(Math.abs(bands[0].mean - 0.15) < 1e-12);
  assert.deepEqual(bands.map(band => [band.count, band.notes]), [[2, 1], [2, 1], [0, 0]]);
  assert.equal(bands[2].mean, null);
  assert.deepEqual(strongest.slice().sort(), ["middle", "north"]);
  const empty = compareRows(Array.from({ length: 3 }, () => Array(4).fill(null)));
  assert.deepEqual(empty.strongest, []);
  assert.deepEqual(empty.bands.map(band => band.mean), [null, null, null]);
});

test("rank playback is deterministic, keeps pitch and gain constant, and schedules missing distinctly", () => {
  const { bands } = compareRows([[0, 0, 0, 0], [null, null, null, null], [0.3, 0.3, 0.3, 0.3]]);
  const options = { caseId: "synthetic-test" };
  const plan = buildBandPlayback(bands, options);
  assert.deepEqual(plan, buildBandPlayback(bands, options));
  assert.deepEqual([0, 1, 2].map(row => plan.events.filter(event => event.row === row && event.tone).length), [1, 0, 2]);
  assert.equal(plan.events.find(event => event.row === 1).tone, null);
  assert.equal(new Set(plan.events.map(event => event.id)).size, plan.events.length);
  assert.ok(plan.events.filter(event => event.tone).every(({ tone }) => tone.frequencyHz === 440 && tone.gain === 0.14));
  assert.ok(plan.events.every(event => event.onsetS + (event.tone?.durationS ?? 0) < plan.durationS));
  const example = buildBandPlayback([1, 2, 3].map(notes => ({ notes })), { ...options, example: true });
  assert.equal(example.events.length, 6);
});

test("a two-band clip preserves the original rank cues and the requested playback order", () => {
  const { bands } = compareDustBands(production);
  const choices = [bands[2], bands[0]];
  const plan = buildBandPlayback(choices, { caseId: production.id });
  for (const [slot, band] of choices.entries()) {
    const onsets = plan.events.filter(event => event.row === bandIds.indexOf(band.id));
    assert.equal(onsets.length, band.notes);
    assert.equal(onsets[0].onsetS, slot * plan.durationS / choices.length);
    assert.equal(new Set(onsets.map(event => event.tone.frequencyHz)).size, 1);
  }
});

test("the transcript waits until each band slot ends and restart clears every completed cue", () => {
  const { bands } = compareDustBands(production);
  const { durationS } = buildBandPlayback(bands, { caseId: production.id });
  const boundary = durationS / bands.length;
  assert.equal(completedBandCount(bands.length, boundary - .001), 0);
  assert.equal(completedBandCount(bands.length, boundary), 1);
  assert.equal(completedBandCount(bands.length, boundary * 2), 2);
  assert.equal(completedBandCount(bands.length, durationS), 3);
  assert.equal(completedBandCount(bands.length, durationS + 10), 3);
  assert.equal(completedBandCount(bands.length, 0), 0);
});
