import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parseOcean } from "../web/sources/ocean.js";
import { parseRain } from "../web/sources/rain.js";
import { parseFires, regionDetections } from "../web/sources/fires.js";
import { makeTemporalPlan } from "../web/audio/temporal-plan.js";
import { sources } from "../web/sources/catalog.js";

const sample = (file) => readFile(new URL(`../science/atlas/${file}`, import.meta.url), "utf8");
const oceanCsv = await sample("mur-sst.csv");
const oceanUrl = await sample("mur-sst-url.txt");
const rainCsv = await sample("imerg.csv");
const fireCsv = await sample("firms-noaa21-europe.csv");
const ocean = parseOcean(oceanCsv, oceanUrl);
const rain = parseRain(rainCsv);
const fires = parseFires(fireCsv);

function changeFirstRecord(csv, index, value, skip = 1) {
  const lines = csv.split(/\r?\n/);
  const columns = lines[skip].split(",");
  columns[index] = value;
  lines[skip] = columns.join(",");
  return lines.join("\n");
}

test("MUR rejects blank open-water fields, unsafe links and unsupported masks", () => {
  for (const index of [3, 4]) {
    assert.throws(() => parseOcean(changeFirstRecord(oceanCsv, index, "", 2), oceanUrl), /Invalid open-water/);
  }
  assert.throws(() => parseOcean(changeFirstRecord(oceanCsv, 5, "0", 2), oceanUrl), /mask/);
  assert.throws(() => parseOcean(oceanCsv, "https://example.org/mur.csv"), /subset URL/);
  const missing = parseOcean(changeFirstRecord(oceanCsv, 5, "-128", 2), oceanUrl).cells[0].samples[0];
  assert.deepEqual(missing, { value: null, error: null, mask: -128, status: "missing" });
  assert.equal(ocean.sampling.nativeLatDegrees, 0.01);
  assert.equal(ocean.sampling.retainedLatStrideDegrees, 1.5);
});

test("IMERG rejects shifted centres and keeps dry, missing and partial days distinct", () => {
  assert.throws(() => parseRain(changeFirstRecord(rainCsv, 1, "23.0502")), /Invalid IMERG sample/);
  assert.throws(() => parseRain(changeFirstRecord(rainCsv, 3, " ")), /Invalid IMERG sample/);
  const missing = parseRain(changeFirstRecord(rainCsv, 3, "")).cells[0].samples[0];
  const partial = parseRain(changeFirstRecord(rainCsv, 4, "47")).cells[0].samples[0];
  assert.equal(rain.cells[0].samples[0].value, 0);
  assert.deepEqual(missing, { value: null, error: null, mask: 48, status: "missing" });
  assert.deepEqual(partial, { value: null, error: null, mask: 47, status: "incomplete-coverage" });
  assert.ok(rain.times.every((day) => day.endExclusive && Date.parse(day.end) - Date.parse(day.start) === 86400000));
  assert.equal(rain.sampling.nativeLonDegrees, 0.1);
  assert.equal(rain.sampling.retainedLonStrideDegrees, 2);
});

test("FIRMS rejects rolled dates and blank FRP and retains actual source pixel metadata", () => {
  assert.throws(() => parseFires(changeFirstRecord(fireCsv, 5, "2026-11-31")), /Invalid FIRMS detection/);
  assert.throws(() => parseFires(changeFirstRecord(fireCsv, 6, "2400")), /Invalid FIRMS detection/);
  assert.throws(() => parseFires(changeFirstRecord(fireCsv, 11, " ")), /Invalid FIRMS detection/);
  assert.throws(() => parseFires(changeFirstRecord(fireCsv, 3, "0")), /Invalid FIRMS detection/);
  const detection = fires.windows[0].detections[0];
  assert.ok(detection.scanKm > 0 && detection.trackKm > 0 && ["D", "N"].includes(detection.dayNight));
  assert.equal(fires.sampling.nominalResolutionMeters, 375);
});

test("MUR retains exact open-water values, quality and a comparison-safe pitch scale", () => {
  assert.equal(ocean.cells.length, 143);
  assert.equal(ocean.times.length, 7);
  assert.match(ocean.times[0].granule, /G3182116833-POCLOUD/);
  assert.ok(ocean.cells.some((cell) => cell.samples[0].value === null));
  const [warm, cool] = ocean.sites.map((site) => makeTemporalPlan(ocean, site).events[0]);
  assert.deepEqual([warm.evidence.value, warm.evidence.error, warm.evidence.mask], [27.823, 0.38, 1]);
  assert.equal(cool.evidence.value, 21.164);
  assert.ok(warm.tone.frequencyHz > cool.tone.frequencyHz);
  assert.equal(warm.tone.gain, cool.tone.gain);
  const triangle = makeTemporalPlan(ocean, ocean.sites[0], "triangle").events[0];
  assert.deepEqual(triangle.evidence, warm.evidence);
  assert.deepEqual(triangle.tone, { ...warm.tone, waveform: "triangle" });
});

test("IMERG source windows and pulse patterns preserve units, zero and peaks at different dates", () => {
  assert.equal(rain.cells.length, 64);
  assert.equal(rain.unit, "mm/day");
  const gulf = makeTemporalPlan(rain, rain.sites[0]).events;
  const mountains = makeTemporalPlan(rain, rain.sites[1]).events;
  assert.equal(gulf[2].evidence.value, 106.55998);
  assert.equal(gulf[2].evidence.mask, 48);
  assert.equal(gulf[2].evidence.time.start, "2024-09-26T00:00:00Z");
  assert.equal(gulf[2].tone.pulses.length, 6);
  assert.equal(gulf[0].tone.pulses.length, 1);
  assert.equal(mountains[3].evidence.value, 43.345);
  const dry = rain.cells.find((cell) => cell.samples[0].value === 0);
  const dryEvent = makeTemporalPlan(rain, { ...dry, id: "dry" }).events[0];
  assert.equal(dryEvent.evidence.value, 0);
  assert.equal(dryEvent.tone, null);
});

test("FIRMS uses overlapping five-day intervals and derives peak FRP from retained rows", () => {
  for (const { start, end, detections } of fires.windows) {
    assert.equal(Date.parse(end) - Date.parse(start), 5 * 86400000);
    assert.ok(detections.every((row) => row.acquisitionTime >= start && row.acquisitionTime < end && row.confidence !== "low"));
  }
  const site = fires.sites[0];
  const events = makeTemporalPlan(fires, site).events;
  assert.deepEqual(events.map(({ evidence }) => evidence.count), [130, 98]);
  assert.deepEqual(events.map(({ evidence }) => evidence.value), [17.37, 17.37]);
  assert.ok(regionDetections(fires, site, 0).includes(events[0].evidence.peak));
  assert.equal(events[0].tone.frequencyHz, 185);
});

test("each implemented source explicitly records the related-visual status", () => {
  assert.equal(sources.length, 4);
  assert.ok(sources.every(({ status }) => status === "VERIFIED_RELATED_VISUAL"));
});
