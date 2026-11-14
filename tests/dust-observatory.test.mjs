import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  cellSound, compatibleDates, fieldColor, fieldPalette, moveCell, opticalDepthLimit,
} from "../web/experiences/decode/observatory-field.js";
import { validateDustCatalog } from "../web/sources/decode/dust-visual.js";

test("comparison dates follow the verified catalog's model-build boundaries", async () => {
  const url = new URL("../web/assets/decode/dust-v2/catalog.json", import.meta.url);
  const { snapshots } = validateDustCatalog(JSON.parse(await readFile(url, "utf8")));
  const reference = snapshots.find(snapshot => snapshot.phase === "reference");
  const referenceDates = compatibleDates(snapshots, reference);
  assert.equal(reference.time.date, "2025-08-19");
  assert.equal(referenceDates.length, 9);
  assert.ok(referenceDates.every(snapshot => snapshot.modelSource === reference.modelSource));
  assert.equal(compatibleDates(snapshots, snapshots[0]).length, 2);
  assert.ok(!referenceDates.includes(reference));
});

test("dust colors distinguish missing, zero, decreases, and increases with fixed endpoints", () => {
  const levels = fieldPalette(false);
  const changes = fieldPalette(true);
  assert.equal(fieldColor(null, false), null);
  assert.equal(fieldColor(null, true), null);
  assert.equal(fieldColor(0, false), levels[0]);
  assert.equal(fieldColor(0, true), changes[3]);
  assert.equal(fieldColor(0.16, false), levels[1]);
  assert.equal(fieldColor(-1, true), changes[1]);
  assert.equal(fieldColor(1, true), changes[5]);
  assert.equal(fieldColor(-20, true), changes[0]);
  assert.equal(fieldColor(20, true), changes.at(-1));
  assert.equal(fieldColor(opticalDepthLimit, false), levels.at(-1));
  assert.equal(fieldColor(20, false), levels.at(-1));
});

test("keyboard directions follow map coordinates, including on lateral boundaries", () => {
  const grid = { rows: 25, cols: 40 };
  assert.deepEqual(moveCell({ row: 1, col: 1 }, "ArrowUp", grid), { row: 0, col: 1 });
  assert.deepEqual(moveCell({ row: 1, col: 1 }, "ArrowRight", grid), { row: 1, col: 2 });
  assert.deepEqual(moveCell({ row: 1, col: 1 }, "End", grid), { row: 1, col: 39 });
  assert.deepEqual(moveCell({ row: 1, col: 39 }, "ArrowRight", grid), { row: 1, col: 39 });
  assert.deepEqual(moveCell({ row: 1, col: 39 }, "Home", grid), { row: 1, col: 0 });
});

test("cell sound distinguishes zero from missing and the direction of signed change", () => {
  const sound = (value, difference) => cellSound({ row: 4, col: 2, value }, difference);
  const pitches = events => events.map(event => event.tone.frequencyHz);
  assert.deepEqual(sound(null, false), []);
  assert.deepEqual(sound(null, true), []);
  assert.deepEqual(pitches(sound(0, false)), [180]);
  assert.deepEqual(pitches(sound(0, true)), [440, 440]);
  assert.deepEqual(pitches(sound(opticalDepthLimit, false)), pitches(sound(30, false)));
  assert.deepEqual(pitches(sound(opticalDepthLimit, true)), [440, 880]);
  assert.deepEqual(pitches(sound(-opticalDepthLimit, true)), [440, 220]);
  assert.ok(pitches(sound(.4, true))[1] > pitches(sound(.1, true))[1]);
  assert.ok(pitches(sound(-.4, true))[1] < pitches(sound(-.1, true))[1]);
  assert.ok(sound(1, true).every(event => event.row === 4 && event.col === 2 && event.tone.gain === .14));
});
