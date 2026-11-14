import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateDecodeCase } from "../web/contracts/validate.js";
import {
  validateDustGrid, validateDustSnapshot, validateDustCatalog, validateDustComparison,
  loadDustGrid, loadDustCatalog, loadDustSnapshot, loadDustComparison, getDustCells, compareDustSnapshots,
} from "../web/sources/decode/dust-visual.js";

const root = new URL("../web/assets/decode/dust-v2/", import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), "utf8"));
const digest = text => createHash("sha256").update(text.replaceAll("\r\n", "\n")).digest("hex");
const catalog = await read("catalog.json");
const grid = await read("grid.json");
const snapshots = await Promise.all(catalog.snapshots.map(e => read(e.path)));
const comparisons = await Promise.all(catalog.comparisons.map(e => read(e.path)));
const manifest = JSON.parse(await readFile(new URL("../science/decode/manifests/dust-sources.json", import.meta.url), "utf8"));
const stats = values => {
  const valid = values.filter(v => v !== null);
  return { valid: valid.length, missing: values.length - valid.length,
    min: valid.length ? Math.min(...valid) : null, max: valid.length ? Math.max(...valid) : null };
};

test("Dust V2 geometry and every published real NASA asset pass independent-schema validation", () => {
  assert.equal(validateDustGrid(grid), grid);
  assert.equal(validateDustCatalog(catalog), catalog);
  snapshots.forEach(s => assert.equal(validateDustSnapshot(s), s));
  comparisons.forEach(c => assert.equal(validateDustComparison(c), c));
  assert.ok(snapshots.length >= 5);
});

test("catalog hashes, native metadata and processed evidence link each asset to an inspected original", async () => {
  assert.equal(digest(await readFile(new URL("grid.json", root), "utf8")), catalog.grid.sha256_lf);
  for (const [i, entry] of catalog.snapshots.entries()) {
    const source = manifest.sources.find(s => s.id === entry.id);
    const asset = snapshots[i];
    assert.equal(source.download_status, "verified");
    assert.equal(source.extraction_status, "verified");
    assert.equal(asset.source.sha256, source.sha256);
    assert.equal(asset.source.url, source.download_url);
    assert.equal(asset.source.modelSource, source.metadata.model_source);
    assert.equal(asset.time.center, source.metadata.timestamp_utc);
    assert.equal(digest(await readFile(new URL(entry.path, root), "utf8")), entry.sha256_lf);
    const processedText = await readFile(new URL(`../${source.processed_path}`, import.meta.url), "utf8");
    assert.equal(digest(processedText), source.processed_sha256_lf);
    const processed = JSON.parse(processedText);
    assert.deepEqual(processed.snapshot, asset);
    assert.equal(processed.overlapSolidAngleSr.length, 1000);
    asset.values.forEach((v, index) => {
      assert.ok(processed.nativeContributors[index] > 0);
      if (processed.invalidContributors[index]) assert.equal(v, null);
      else assert.equal(v, processed.aotTimesSolidAngle[index] / processed.overlapSolidAngleSr[index]);
    });
  }
});

test("catalog availability, seasonal partition and month coverage reflect verified outputs rather than planned URLs", () => {
  const actual = new Set(manifest.sources.filter(s => s.extraction_status === "verified" && s.download_status === "verified").map(s => s.id));
  assert.deepEqual(new Set(catalog.snapshots.map(s => s.id)), actual);
  assert.deepEqual(catalog.coverage.months, [...new Set(snapshots.map(s => s.time.date.slice(0, 7)))].sort());
  assert.deepEqual(catalog.seasons.map(s => s.key), ["winter-2024-2025", "spring-2025", "summer-2025", "autumn-2025"]);
  assert.equal(catalog.coverage.monthlySamples, catalog.snapshots.filter(s => s.phase !== "reference").length);
  assert.deepEqual(catalog.seasonSummaries, []);
  for (const s of snapshots) {
    assert.equal(Date.parse(s.time.end) - Date.parse(s.time.start), 3 * 60 * 60 * 1000);
    assert.equal(s.time.center.slice(11, 16), "19:30");
    assert.equal(s.time.kind, "three-hour mean");
    assert.match(s.time.sampling, /not a daily\/monthly\/seasonal average/);
  }
});

test("1000 geographic rectangles exactly cover the region in north-to-south, west-to-east order", () => {
  assert.deepEqual(grid.bounds, { north: 45, south: 15, east: 50, west: -20 });
  assert.deepEqual([grid.rows, grid.cols, grid.cells.length], [25, 40, 1000]);
  grid.cells.forEach((c, i) => {
    assert.deepEqual([c.row, c.col], [Math.floor(i / 40), i % 40]);
    assert.ok(Math.abs(c.lat - (45 - (c.row + .5) * 1.2)) < 1e-9);
    assert.equal(c.lon, -20 + (c.col + .5) * 1.75);
    if (c.col < 39) assert.equal(c.bounds.east, grid.cells[i + 1].bounds.west);
    if (c.row < 24) assert.equal(c.bounds.south, grid.cells[i + 40].bounds.north);
  });
});

test("imagery is attached only to the August 19 reference and never claims matching pixels", () => {
  for (const s of snapshots) {
    if (s.time.date === "2025-08-19") {
      assert.equal(s.visualLink.relation, "RELATED_CONTEXT");
      assert.match(s.visualLink.note, /separate GEOS-FP 2 km Replay/);
    } else assert.equal(s.visualLink, null);
  }
});

test("adapter preserves real zero, missing values and per-cell geographic/time references", () => {
  const example = structuredClone(snapshots[0]);
  example.values[0] = 0;
  example.values[1] = null;
  example.statistics = stats(example.values);
  const cells = getDustCells(example, grid);
  assert.equal(cells.length, 1000);
  assert.equal(cells[0].value, 0);
  assert.equal(cells[0].status, "available");
  assert.equal(cells[1].value, null);
  assert.equal(cells[1].status, "missing");
  assert.deepEqual(cells[0].bounds, grid.cells[0].bounds);
  assert.equal(cells[0].temporalRef, example.id);
  assert.deepEqual(cells[0].sourceTime, example.time);
  assert.notEqual(cells[0].bounds, grid.cells[0].bounds);
});

test("selected-period differences reproduce published assets and never compare across build labels", () => {
  catalog.comparisons.forEach((entry, i) => {
    const a = snapshots.find(s => s.id === entry.first), b = snapshots.find(s => s.id === entry.second);
    assert.deepEqual(compareDustSnapshots(a, b), comparisons[i]);
  });
  const first = snapshots[0];
  const otherBuild = snapshots.find(s => s.source.modelSource !== first.source.modelSource);
  if (otherBuild) assert.throws(() => compareDustSnapshots(first, otherBuild), /incompatible snapshots/);
  const sameBuild = snapshots.find(s => s.id !== first.id && s.source.modelSource === first.source.modelSource);
  if (sameBuild) {
    const a = structuredClone(first), b = structuredClone(sameBuild);
    a.values[0] = null; a.statistics = stats(a.values);
    b.values[1] = 0; b.statistics = stats(b.values);
    const difference = compareDustSnapshots(a, b);
    assert.equal(difference.values[0], null);
    assert.equal(difference.values[1], -a.values[1]);
  }
});

test("validation rejects bad geometry, NaN, invalid time/season, bad source identity and catalog references", () => {
  const badGrid = structuredClone(grid);
  badGrid.cells.reverse();
  assert.throws(() => validateDustGrid(badGrid), /orientation/);
  for (const mutate of [
    s => { s.values[0] = NaN; },
    s => { s.time.end = s.time.start; },
    s => { s.time.season.key = "winter-1900-1901"; },
    s => { s.source.sha256 = "not-a-hash"; },
    s => { s.source.granule = "wrong.nc4"; },
    s => { s.visualLink = { relation: "SAME_DATA" }; },
  ]) {
    const invalid = structuredClone(snapshots[0]); mutate(invalid);
    assert.throws(() => validateDustSnapshot(invalid), /Invalid dust visualization data/);
  }
  const badCatalog = structuredClone(catalog);
  badCatalog.snapshots[0].path = "../outside.json";
  assert.throws(() => validateDustCatalog(badCatalog), /published verified source/);
});

test("visualization loaders resolve all four asset kinds with a configurable directory base", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async url => {
    calls.push(String(url));
    const path = new URL(url).pathname.replace("/project/dust/", "");
    return new Response(JSON.stringify(await read(path)));
  });
  const options = { baseUrl: "https://example.test/project/dust" };
  assert.deepEqual(await loadDustCatalog(options), catalog);
  assert.deepEqual(await loadDustGrid(options), grid);
  assert.deepEqual(await loadDustSnapshot(snapshots[0].id, options), snapshots[0]);
  assert.deepEqual(await loadDustComparison(comparisons[0].id, options), comparisons[0]);
  assert.equal(calls.length, 4);
  assert.ok(calls.every(u => u.startsWith("https://example.test/project/dust/")));
});

test("visualization loaders reject path traversal, HTTP/JSON errors, wrong ids and invalid payloads", async t => {
  const mock = t.mock.method(globalThis, "fetch", async () => new Response("missing", { status: 404 }));
  await assert.rejects(loadDustSnapshot("../outside"), /unsafe snapshot id/);
  assert.equal(mock.mock.callCount(), 0);
  await assert.rejects(loadDustCatalog(), /\(404\)/);
  mock.mock.mockImplementation(async () => new Response("not JSON"));
  await assert.rejects(loadDustGrid(), /Invalid dust visualization JSON/);
  mock.mock.mockImplementation(async () => new Response(JSON.stringify(snapshots[0])));
  await assert.rejects(loadDustSnapshot("another-id"), /requested snapshot id mismatch/);
  mock.mock.mockImplementation(async () => new Response(JSON.stringify({ ...grid, rows: 24 })));
  await assert.rejects(loadDustGrid(), /grid extent\/dimensions/);
});

test("the original DecodeCase remains byte-identical and passes Majd's unchanged validator", async () => {
  const url = new URL("../web/assets/decode/data/dust-geos-fp-20250819-1930-north-africa-med.json", import.meta.url);
  const text = await readFile(url, "utf8");
  assert.equal(digest(text), "7f71da5fe3b10af60e6e78f169d2a68578f67d5d33c4717b1bc047023b5ca582");
  const data = validateDecodeCase(JSON.parse(text));
  assert.deepEqual([data.levels.quick.cells.length, data.levels.advanced.cells.length], [12, 48]);
  assert.deepEqual([data.levels.quick.truth.present.length, data.levels.advanced.truth.present.length], [5, 18]);
});
