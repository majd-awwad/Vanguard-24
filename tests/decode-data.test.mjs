import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateDecodeCase } from "../web/contracts/validate.js";
import { loadDecodeCase } from "../web/sources/decode/index.js";

const id = "dust-geos-fp-20250819-1930-north-africa-med";
const assetUrl = new URL(`../web/assets/decode/data/${id}.json`, import.meta.url);
const text = await readFile(assetUrl, "utf8");
const data = JSON.parse(text);
const provenance = JSON.parse(await readFile(new URL("../science/decode/dust-extraction.json", import.meta.url), "utf8"));
const audited = JSON.parse(await readFile(new URL("../science/decode/inspection.json", import.meta.url), "utf8"));

test("production dust case validates and links to the audited NASA source, not the SVS Replay", () => {
  assert.equal(validateDecodeCase(data), data);
  assert.equal(data.id, id);
  assert.equal(data.fixture, false);
  assert.equal(data.phenomenon, "dust");
  assert.equal(data.behavior, "continuous");
  assert.equal(data.unit, "1");
  assert.equal(data.source.url, audited.source_url);
  assert.deepEqual(data.source.granules, [audited.global_attributes.GranuleID]);
  assert.deepEqual(data.source.time, { start: "2025-08-19T18:00:00Z", end: "2025-08-19T21:00:00Z" });
  assert.equal(data.visualLink.relation, "RELATED_CONTEXT");
  assert.equal(data.visualLink.svs, "https://svs.gsfc.nasa.gov/5669/");
  assert.match(data.visualLink.note, /separate GEOS-FP 2 km Replay at 20:00 UTC/);
  assert.match(data.visualLink.note, /not the same visualization dataset/);
  assert.equal(provenance.source.sha256, audited.sha256);
  assert.equal(provenance.source.variable, "DUEXTTAU");
  assert.equal(provenance.case_sha256_lf, createHash("sha256").update(text.replaceAll("\r\n", "\n")).digest("hex"));
});

test("production geometry has fixed geographic edges and north-to-south, west-to-east centers", () => {
  assert.deepEqual(data.bounds, { north: 45, south: 15, east: 50, west: -20 });
  for (const [name, rows, cols] of [["quick", 3, 4], ["advanced", 6, 8]]) {
    const grid = data.levels[name];
    assert.deepEqual([grid.rows, grid.cols, grid.cells.length], [rows, cols, rows * cols]);
    for (const [index, cell] of grid.cells.entries()) {
      assert.equal(cell.row, Math.floor(index / cols));
      assert.equal(cell.col, index % cols);
      assert.equal(cell.lat, 45 - (cell.row + 0.5) * 30 / rows);
      assert.equal(cell.lon, -20 + (cell.col + 0.5) * 70 / cols);
      assert.ok(!Object.hasOwn(cell, "eventCount"));
    }
  }
});

test("production Quick values are derived from exactly four Advanced children; truth follows the fixed threshold", () => {
  const { advanced, quick } = data.levels;
  assert.equal(quick.aggregation, "mean of 2x2 advanced cells");
  for (const parent of quick.cells) {
    const children = advanced.cells.filter(c => Math.floor(c.row / 2) === parent.row && Math.floor(c.col / 2) === parent.col);
    assert.equal(children.length, 4);
    const expected = children.some(c => c.value === null) ? null : children.reduce((sum, c) => sum + c.value / 4, 0);
    assert.equal(parent.value, expected);
  }
  for (const grid of [advanced, quick]) {
    assert.equal(grid.truth.threshold, 0.2);
    assert.equal(grid.truth.rule, "value >= threshold");
    assert.deepEqual(grid.truth.present, grid.cells.filter(c => c.value !== null && c.value >= 0.2).map(c => [c.row, c.col]));
    for (const cell of grid.cells) {
      assert.equal(cell.status, cell.value === null ? "missing" : cell.value >= 0.2 ? "measured" : "below_threshold");
      assert.ok(cell.value === null || Number.isFinite(cell.value) && cell.value >= 0);
    }
  }
});

test("all Advanced cell means have complete spherical overlap evidence with no unreported missing values", () => {
  assert.equal(provenance.advanced_cell_evidence.length, 48);
  for (const cell of data.levels.advanced.cells) {
    const evidence = provenance.advanced_cell_evidence[cell.row * 8 + cell.col];
    assert.deepEqual([evidence.row, evidence.col], [cell.row, cell.col]);
    const { north, south, east, west } = evidence.bounds;
    const radians = degrees => degrees * Math.PI / 180;
    const expectedArea = radians(east - west) * (Math.sin(radians(north)) - Math.sin(radians(south)));
    assert.ok(Math.abs(evidence.overlap_solid_angle_sr / expectedArea - 1) < 1e-12);
    assert.equal(evidence.native_contributors, 609);
    assert.equal(evidence.invalid_contributors, 0);
    assert.equal(cell.value, evidence.aot_times_solid_angle / evidence.overlap_solid_angle_sr);
    assert.ok(cell.value >= audited.regional_subset.statistics.min && cell.value <= audited.regional_subset.statistics.max);
  }
});

test("loader fetches the production asset from its module-relative default URL", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async url => {
    calls.push(String(url));
    return new Response(text, { status: 200 });
  });
  assert.deepEqual(await loadDecodeCase(id), data);
  assert.deepEqual(calls, [assetUrl.href]);
});

test("loader accepts URL and string directory overrides, including a missing trailing slash", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async url => {
    calls.push(String(url));
    return new Response(text);
  });
  for (const baseUrl of ["https://example.test/decode-data", new URL("https://example.test/decode-data/")]) {
    assert.equal((await loadDecodeCase(id, { baseUrl })).id, id);
  }
  assert.deepEqual(calls, Array(2).fill(`https://example.test/decode-data/${id}.json`));
});

test("loader rejects unsafe case identifiers before making any request", async t => {
  const fetch = t.mock.method(globalThis, "fetch", () => { throw new Error("should not fetch"); });
  for (const unsafe of ["", "../dust", "a/b", "a%2fb", "a.json", "a?x=1", "https://example.test", null, 1]) {
    await assert.rejects(loadDecodeCase(unsafe), /Invalid Decode case id/);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test("loader reports HTTP and JSON errors and propagates network failures", async t => {
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response("missing", { status: 404 }));
  await assert.rejects(loadDecodeCase(id), /Could not load Decode case .* \(404\)/);
  fetch.mock.mockImplementation(async () => new Response("not JSON"));
  await assert.rejects(loadDecodeCase(id), /Invalid JSON for Decode case/);
  fetch.mock.mockImplementation(async () => { throw new Error("offline"); });
  await assert.rejects(loadDecodeCase(id), /offline/);
});

test("loader uses the shared validator and rejects a valid case with the wrong requested id", async t => {
  const corrupt = structuredClone(data);
  corrupt.levels.advanced.cells[0].lat += 1;
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(corrupt)));
  await assert.rejects(loadDecodeCase(id), /Invalid DecodeCase v2: .*WGS84 center/);
  fetch.mock.mockImplementation(async () => new Response(JSON.stringify({ ...data, id: "different-id" })));
  await assert.rejects(loadDecodeCase(id), /Decode case id mismatch/);
});
