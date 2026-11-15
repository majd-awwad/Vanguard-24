import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PHENOMENON_IDS, openPackage } from "../web/studio/datasets.js";
import { ANOMALY_REASON, BUILD_REASON, QUERY, SCOPE, runHunter, toHunterData } from "../web/studio/hunter-core.js";
import { DEFAULT_SEPARATION, ECHO_MIN_POINTS, SIMILARITY_NOTE, dtw, euclidean, mean, monthlyGroup, runEcho, std, toEchoData, zNormalize } from "../web/studio/echo-core.js";

const base = new URL("../web/assets/earthpulse-json/", import.meta.url);
const fetchImpl = async (u) => { try { const b = await readFile(new URL(u)); return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; } catch { return { ok: false, status: 404 }; } };
const pkg = await openPackage({ baseUrl: base, fetchImpl, digest: async (b) => createHash("sha256").update(b).digest("hex") });
const phens = Object.fromEntries(await Promise.all(PHENOMENON_IDS.map(async (id) => [id, await pkg.openPhenomenon(id)])));

// ---------------------------------------------------------------- Hunter (synthetic, labelled)
const synthetic = (values1, values2, { build2 = "B", ratio = true, percentBase = 0.05 } = {}) => ({
  synthetic: true, phenomenon: "synthetic", unit: "u", ratio, percentBase, rows: 1, cols: values1.length,
  snapshots: [
    { id: "s1", date: "2025-03-15", build: "B", values: values1, timeStart: "2025-03-15T19:00:00Z", timeEnd: "2025-03-15T20:00:00Z", granule: "g1" },
    { id: "s2", date: "2025-04-15", build: build2, values: values2, timeStart: "2025-04-15T19:00:00Z", timeEnd: "2025-04-15T20:00:00Z", granule: "g2" },
  ],
});

test("HUNTER-A (synthetic): largest increase returns the highest real delta, ranked deterministically", async () => {
  const data = synthetic([1, 2, 3, 4, 5], [1, 9, 3.5, 4, 5.2]);
  const query = { type: QUERY.INCREASE, startDate: "2025-03-15", endDate: "2025-04-15", limit: 3 };
  const r = await runHunter(query, data);
  assert.equal(r.status, "results");
  assert.deepEqual(r.findings.map((f) => f.sampleId), [1, 2, 4]);
  assert.equal(r.findings[0].delta, 7);
  assert.equal(r.findings[0].firstValue, 2);
  assert.equal(r.findings[0].value, 9);
  assert.deepEqual(r, await runHunter(query, data), "same input, same output");
  const down = await runHunter({ type: QUERY.DECREASE, startDate: "2025-04-15", endDate: "2025-03-15" }, synthetic([1, 2, 3], [0.5, 2, 9]));
  assert.equal(down.findings[0].sampleId, 0, "dates are ordered earliest first, so the delta is date 2 minus date 1 either way");
  assert.equal(r.scopeLabel, SCOPE(5, 2));
  assert.match(r.scopeLabel, /^Searched 5 available cells × 2 sampled dates in North Africa–Mediterranean$/);
  assert.ok(!/global|world/i.test(r.scopeLabel));
  assert.ok(r.findings.every((f) => f.evidence.method && f.evidence.inputCount === 5 && f.quality.status === "valid"));
});

test("HUNTER (synthetic): ties break by stable id; percent only when valid; threshold changes the results", async () => {
  const tie = await runHunter({ type: QUERY.HIGHEST, date: "2025-03-15" }, synthetic([5, 5, 9, 5], [0, 0, 0, 0]));
  assert.deepEqual(tie.findings.map((f) => f.sampleId), [2, 0, 1, 3]);
  const pct = await runHunter({ type: QUERY.INCREASE, startDate: "2025-03-15", endDate: "2025-04-15" }, synthetic([0, 2], [4, 3]));
  const zero = pct.findings.find((f) => f.sampleId === 0);
  assert.equal(zero.percent, null, "base near zero: not valid for percent");
  assert.match(zero.quality.notes[0], /not valid/i);
  assert.equal(pct.findings.find((f) => f.sampleId === 1).percent, 50);
  const noRatio = await runHunter({ type: QUERY.INCREASE, startDate: "2025-03-15", endDate: "2025-04-15" }, synthetic([10, 20], [15, 30], { ratio: false }));
  assert.ok(noRatio.findings.every((f) => f.percent === null && /no true zero/i.test(f.quality.notes[0])));
  const data = synthetic([1, 4, 2, 8], [0, 0, 0, 0]);
  const t3 = await runHunter({ type: QUERY.THRESHOLD, date: "2025-03-15", threshold: 3 }, data);
  const t5 = await runHunter({ type: QUERY.THRESHOLD, date: "2025-03-15", threshold: 5 }, data);
  assert.deepEqual(t3.findings.map((f) => f.sampleId), [3, 1]);
  assert.deepEqual(t5.findings.map((f) => f.sampleId), [3]);
  assert.equal((await runHunter({ type: QUERY.THRESHOLD, date: "2025-03-15", threshold: 4 }, data)).findings.some((f) => f.value === 4), true, ">= is inclusive");
  assert.equal((await runHunter({ type: QUERY.THRESHOLD, date: "2025-03-15", threshold: 100 }, data)).status, "no_results");
  assert.equal((await runHunter({ type: QUERY.THRESHOLD, date: "2025-03-15", threshold: Number.NaN }, data)).status, "error");
});

test("HUNTER: missing values are excluded and counted, never zero; states are explicit", async () => {
  const data = synthetic([null, 3, 4], [5, null, 6]);
  const r = await runHunter({ type: QUERY.INCREASE, startDate: "2025-03-15", endDate: "2025-04-15" }, data);
  assert.equal(r.evaluatedSamples, 1);
  assert.equal(r.missingExcluded, 2);
  assert.deepEqual(r.findings.map((f) => f.sampleId), [2]);
  const high = await runHunter({ type: QUERY.HIGHEST, date: "2025-03-15" }, data);
  assert.ok(high.findings.every((f) => f.value !== null && f.value !== 0));
  assert.equal((await runHunter({ type: QUERY.HIGHEST, date: "2025-03-15" }, synthetic([null, null], [1, 1]))).status, "insufficient_data");
  assert.equal((await runHunter({ type: QUERY.HIGHEST, date: "2030-01-01" }, data)).status, "unsupported_period");
  assert.equal((await runHunter({ type: QUERY.INCREASE, startDate: "2025-03-15", endDate: "2025-03-15" }, data)).status, "unsupported_period");
  assert.equal((await runHunter({ type: "nonsense" }, data)).status, "error");
});

test("HUNTER-C: anomaly without a sufficient baseline says Not available and claims nothing", async () => {
  const r = await runHunter({ type: QUERY.ANOMALY, date: "2025-03-15" }, synthetic([1, 2], [3, 4]));
  assert.equal(r.status, "not_available");
  assert.deepEqual(r.findings, []);
  assert.equal(r.reason, ANOMALY_REASON);
  assert.match(r.reason, /not a climatological baseline/);
  for (const id of PHENOMENON_IDS) assert.equal((await runHunter({ type: QUERY.ANOMALY, date: "2025-04-15" }, toHunterData(phens[id]))).status, "not_available", id);
});

test("HUNTER: cancellation stops the search; cross-build differences are blocked with the catalog reason", async () => {
  let calls = 0;
  const r = await runHunter({ type: QUERY.HIGHEST, date: "2025-03-15" }, synthetic(new Array(1000).fill(1), new Array(1000).fill(2)), { shouldCancel: () => ++calls > 2 });
  assert.equal(r.status, "cancelled");
  assert.deepEqual(r.findings, []);
  const blocked = await runHunter({ type: QUERY.INCREASE, startDate: "2025-03-15", endDate: "2025-04-15" }, synthetic([1], [2], { build2: "A" }));
  assert.equal(blocked.status, "unsupported_period");
  assert.equal(blocked.reason, BUILD_REASON);
});

// ---------------------------------------------------------------- Hunter on the real data
test("HUNTER-A (real data): April to July dust increase equals the independently computed best delta", async () => {
  const dust = phens.dust;
  const a = dust.byDate("2025-04-15");
  const b = dust.byDate("2025-07-15");
  let best = -Infinity;
  let bestIndex = -1;
  b.values.forEach((v, i) => { const d = v - a.values[i]; if (d > best) { best = d; bestIndex = i; } });
  const r = await runHunter({ type: QUERY.INCREASE, startDate: "2025-04-15", endDate: "2025-07-15", limit: 5 }, toHunterData(dust));
  assert.equal(r.findings[0].sampleId, bestIndex);
  assert.ok(Math.abs(r.findings[0].delta - best) < 1e-12);
  assert.equal(r.findings[0].evidence.build, a.source.modelSource);
  assert.equal(r.findings[0].evidence.granules.length, 2);
  assert.match(r.findings[0].evidence.granules[0], /\.nc4$/);
  assert.equal(r.evaluatedSamples, 1000);
  for (const id of PHENOMENON_IDS) {
    const p = phens[id];
    const data = toHunterData(p);
    const hi = await runHunter({ type: QUERY.HIGHEST, date: "2025-04-15", limit: 3 }, data);
    const snap = p.byDate("2025-04-15");
    assert.equal(hi.findings[0].value, Math.max(...snap.values), id);
    assert.equal(hi.findings[0].unit, data.unit);
  }
  const cross = await runHunter({ type: QUERY.INCREASE, startDate: "2025-01-15", endDate: "2025-04-15" }, toHunterData(dust));
  assert.equal(cross.status, "unsupported_period");
});

test("HUNTER: locked dust dates are never searched; other phenomena keep them", async () => {
  const dust = toHunterData(phens.dust, { excludeDates: ["2025-08-15", "2025-08-19"] });
  assert.ok(!dust.snapshots.some((s) => s.date === "2025-08-19" || s.date === "2025-08-15"));
  assert.equal((await runHunter({ type: QUERY.HIGHEST, date: "2025-08-19" }, dust)).status, "unsupported_period");
  assert.ok(toHunterData(phens.rainfall).snapshots.some((s) => s.date === "2025-08-19"));
});

// ---------------------------------------------------------------- Echo (synthetic, labelled)
const MONTHS = ["2025-03-15", "2025-04-15", "2025-05-15", "2025-06-15", "2025-07-15", "2025-08-15", "2025-09-15", "2025-10-15", "2025-11-15"];
const fixture = (seriesList, { build = "B", dates = MONTHS } = {}) => ({
  synthetic: true, phenomenon: "synthetic", unit: "u", rows: 1, cols: seriesList.length, flatTolerance: 1e-6,
  snapshots: dates.map((date, t) => ({ date, build, values: seriesList.map((s) => s[t]), timeStart: date + "T19:00:00Z", timeEnd: date + "T20:00:00Z" })),
});
const peak = [0, 0, 0, 10, 0, 0, 0, 0, 0];
const peakShifted = [0, 0, 0, 0, 10, 0, 0, 0, 0];
const peakScaled = [5, 5, 5, 25, 5, 5, 5, 5, 5];
const flat = [3, 3, 3, 3, 3, 3, 3, 3, 3];
const ramp = [0, 1, 2, 3, 4, 5, 6, 7, 8];

test("ECHO-A (synthetic): the sharp-peak pattern finds the same pattern before a constant one; same input, same order", async () => {
  const data = fixture([peak, flat, peakShifted, ramp, peakScaled]);
  const q = { sourceIndex: 0, mode: "shape", algorithm: "euclidean", minSeparation: 0 };
  const r = await runEcho(q, data);
  assert.equal(r.status, "results");
  assert.equal(r.matches[0].sampleId, 4, "the scaled copy has the identical shape");
  assert.ok(r.matches[0].distance < 1e-9);
  const order = r.matches.map((m) => m.sampleId);
  assert.ok(order.indexOf(4) < order.indexOf(3), "peak before a ramp");
  assert.ok(!order.includes(1), "a constant series is excluded in shape mode");
  assert.equal(r.flatExcluded, 1);
  assert.deepEqual(r, await runEcho(q, data), "deterministic");
  assert.equal(r.normalization, "z-score");
  assert.ok(r.matches.every((m) => m.distance >= 0));
  assert.match(r.note, /does not prove/);
  assert.equal(SIMILARITY_NOTE, r.note);
});

test("ECHO (synthetic): DTW tolerates a one-month shift that Euclidean does not; mode changes the ranking as expected", async () => {
  const data = fixture([peak, peakShifted, [9, 0, 0, 0, 0, 0, 0, 0, 0]]);
  const euc = await runEcho({ sourceIndex: 0, mode: "shape", algorithm: "euclidean", minSeparation: 0 }, data);
  const dt = await runEcho({ sourceIndex: 0, mode: "shape", algorithm: "dtw", window: 1, minSeparation: 0 }, data);
  const shifted = (r) => r.matches.find((m) => m.sampleId === 1);
  assert.ok(shifted(dt).distance < shifted(euc).distance, "DTW within a band of 1 month matches the shifted peak better");
  assert.equal(dt.matches[0].sampleId, 1, "the shifted peak is the closest under DTW");
  assert.ok(Math.abs(dtw(peak, peakShifted, 0) - euclidean(peak, peakShifted)) < 1e-12, "window 0 equals Euclidean");
  const level = await runEcho({ sourceIndex: 0, mode: "value", algorithm: "euclidean", minSeparation: 0 }, fixture([peak, peakScaled, [0, 0, 0, 9, 1, 0, 0, 0, 0]]));
  assert.equal(level.matches[0].sampleId, 2, "Level mode keeps the magnitude: the scaled copy is far");
  assert.equal(level.normalization, "none");
  assert.equal(zNormalize(flat, 1e-6), null);
  assert.ok(Math.abs(mean(zNormalize(ramp, 1e-6))) < 1e-12 && Math.abs(std(zNormalize(ramp, 1e-6)) - 1) < 1e-12);
});

test("ECHO-B: incompatible, short, gappy or irregular data gives a clear message and no invented matches", async () => {
  const short = fixture([peak, peak].map((s) => s.slice(0, 4)), { dates: MONTHS.slice(0, 4) });
  const a = await runEcho({ sourceIndex: 0, mode: "shape" }, short);
  assert.equal(a.status, "insufficient_data");
  assert.deepEqual(a.matches, []);
  assert.match(a.reason, new RegExp(`at least ${ECHO_MIN_POINTS}`));
  const irregularDates = [...MONTHS.slice(0, 5), ...MONTHS.slice(6)];
  const irregular = fixture([peak, peakShifted].map((s) => [...s.slice(0, 5), ...s.slice(6)]), { dates: irregularDates });
  const b = await runEcho({ sourceIndex: 0, mode: "shape", minSeparation: 0 }, irregular);
  assert.equal(b.status, "insufficient_data");
  assert.match(b.reason, /not consecutive/);
  assert.equal((await runEcho({ sourceIndex: 0, mode: "shape", unit: "other" }, fixture([peak, peak]))).status, "incompatible");
  const gap = fixture([peak, peakShifted]);
  gap.snapshots[2].values[1] = null;
  const c = await runEcho({ sourceIndex: 0, mode: "shape", minSeparation: 0 }, gap);
  assert.equal(c.gappyExcluded, 1, "a gap is never filled");
  assert.equal(c.matches.length, 0);
  assert.equal((await runEcho({ sourceIndex: 0, mode: "shape" }, fixture([flat, peak]))).status, "insufficient_data", "a flat source cannot be matched by shape");
  assert.equal((await runEcho({ sourceIndex: 99, mode: "shape" }, fixture([peak]))).status, "error");
  assert.equal((await runEcho({ sourceIndex: 0, mode: "shape", minSeparation: 0 }, fixture([peak, ramp]), { shouldCancel: () => true })).status, "cancelled");
});

test("ECHO (real data): month selection, build groups, spacing and the separation rule", async () => {
  for (const id of ["rainfall", "wind"]) {
    const data = toEchoData(phens[id]);
    const g = monthlyGroup(data);
    assert.equal(g.snapshots.length, 9, id);
    assert.ok(!g.snapshots.some((s) => s.date === "2025-08-19"), "2025-08-19 is excluded");
    assert.deepEqual(g.groups.map((x) => x.count), [9, 3]);
    const src = 12 * 40 + 20;
    const r = await runEcho({ sourceIndex: src, mode: "shape", algorithm: "dtw" }, data);
    assert.equal(r.status, "results", id);
    assert.equal(r.matches.length, 10);
    assert.ok(r.comparedSeriesCount + r.flatExcluded + r.gappyExcluded > 800);
    for (const m of r.matches) {
      assert.ok(Math.max(Math.abs(m.row - 12), Math.abs(m.col - 20)) >= DEFAULT_SEPARATION);
      assert.equal(m.sampleCount, 9);
      assert.equal(m.series.length, 9);
    }
    assert.ok(r.matches.every((m, i) => i === 0 || m.distance >= r.matches[i - 1].distance - 1e-12), "sorted, smaller = more similar");
    assert.equal(r.build, g.build);
    assert.deepEqual(r, await runEcho({ sourceIndex: src, mode: "shape", algorithm: "dtw" }, data), "deterministic");
  }
  const dataA = toEchoData(phens.wind);
  const a = await runEcho({ sourceIndex: 100, mode: "shape", build: monthlyGroup(dataA).groups[1].build }, dataA);
  assert.equal(a.status, "insufficient_data");
  assert.match(a.reason, /at least 6/);
  const dust = await runEcho({ sourceIndex: 100, mode: "shape" }, toEchoData(phens.dust, { excludeDates: ["2025-08-15", "2025-08-19"] }));
  assert.equal(dust.status, "insufficient_data", "dust with the locked August 15 removed is refused, not silently shortened");
  assert.match(dust.reason, /not consecutive/);
  assert.equal((await runEcho({ sourceIndex: 100, mode: "shape" }, toEchoData(phens.dust))).status, "results", "with all dates (Decode finished) dust has the same 9 monthly samples");
});
