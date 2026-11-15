// Earth Signal Hunter: pure analysis over the real package (no DOM, no network). It runs in a Web Worker
// (hunter.worker.js) and returns the Finding[] structure of spec 10.4. Rules:
//  - highest values and threshold exceedance (value >= threshold, in the phenomenon's unit) for one sampled date;
//  - largest increase / decrease between two sampled dates, blocked across different model build labels;
//  - percent change only for ratio-scale measures with a base far from zero, otherwise "not valid for percent";
//  - anomaly versus a baseline is NOT available: 12-13 selected snapshots are not a climatological baseline;
//  - missing values are excluded and counted, never zero; ranking is metric, then date, then stable cell index.

export const QUERY = Object.freeze({ HIGHEST: "highest", THRESHOLD: "threshold", INCREASE: "largest_increase", DECREASE: "largest_decrease", ANOMALY: "anomaly" });
export const BUILD_REASON = "Different literal model build labels; numerical build equivalence unverified.";
export const ANOMALY_REASON = "An anomaly needs a baseline of many comparable observations (for example the same time of year over several years). The package has 13 selected snapshots from different seasons, which is not a climatological baseline, so no anomaly is claimed.";
export const SCOPE = (cells, dates) => `Searched ${cells} available cells × ${dates} sampled dates in North Africa–Mediterranean`;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const CHUNK = 100;

const byIndex = (a, b) => a.index - b.index;
const finite = (v) => typeof v === "number" && Number.isFinite(v);

function base(query, data, extra = {}) {
  return { datasetId: data.phenomenon, queryType: query.type, evaluatedSamples: 0, scopeLabel: "", findings: [], status: "results", reason: null, totalMatches: 0, missingExcluded: 0, ...extra };
}

function finding(query, data, rank, cell, parts) {
  const { first, second, snap } = parts;
  const isDelta = Boolean(second);
  const windowStart = (first ?? snap).timeStart;
  const windowEnd = (second ?? snap).timeEnd;
  const dateKey = isDelta ? `${first.date}_${second.date}` : snap.date;
  return {
    id: `finding-${query.type}-${dateKey}-${String(cell.index).padStart(4, "0")}`, rank, sampleId: cell.index, row: Math.floor(cell.index / data.cols), col: cell.index % data.cols,
    timeStart: windowStart, timeEnd: windowEnd, date: isDelta ? second.date : snap.date, firstDate: first?.date ?? null, secondDate: second?.date ?? null,
    value: isDelta ? parts.v2 : cell.value, delta: isDelta ? parts.delta : null, percent: parts.percent ?? null, firstValue: isDelta ? parts.v1 : null, unit: data.unit,
    evidence: { method: parts.method, formula: parts.formula, inputCount: parts.inputCount, dates: isDelta ? [first.date, second.date] : [snap.date], build: (second ?? snap).build, granules: isDelta ? [first.granule, second.granule] : [snap.granule] },
    quality: { status: "valid", notes: parts.notes ?? [] },
  };
}

/**
 * @param query { type, date?, startDate?, endDate?, threshold?, limit? }
 * @param data  { phenomenon, unit, ratio, percentBase, rows, cols, snapshots: [{ id, date, build, values, timeStart, timeEnd, granule }] }
 */
export async function runHunter(query, data, { shouldCancel = () => false, yieldFn = async () => {} } = {}) {
  if (!Object.values(QUERY).includes(query.type)) return base(query, data, { status: "error", reason: "Unknown query type." });
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(query.limit ?? DEFAULT_LIMIT)));
  const dates = new Set(data.snapshots.map((s) => s.date));
  const snapOf = (date) => data.snapshots.find((s) => s.date === date) ?? null;

  if (query.type === QUERY.ANOMALY) return base(query, data, { status: "not_available", reason: ANOMALY_REASON });

  // ---- Single date: highest values, threshold
  if (query.type === QUERY.HIGHEST || query.type === QUERY.THRESHOLD) {
    const snap = snapOf(query.date);
    if (!snap) return base(query, data, { status: "unsupported_period", reason: "That date is not one of the available sampled dates." });
    if (query.type === QUERY.THRESHOLD && !finite(query.threshold)) return base(query, data, { status: "error", reason: "Enter a threshold as a number." });
    const cells = [];
    let missing = 0;
    for (let i = 0; i < snap.values.length; i++) {
      if (i % CHUNK === 0) { if (shouldCancel()) return base(query, data, { status: "cancelled" }); await yieldFn(); }
      const v = snap.values[i];
      if (!finite(v)) { missing++; continue; }
      cells.push({ index: i, value: v });
    }
    if (!cells.length) return base(query, data, { status: "insufficient_data", reason: "This date has no valid values.", missingExcluded: missing, scopeLabel: SCOPE(0, 1) });
    const pool = query.type === QUERY.THRESHOLD ? cells.filter((c) => c.value >= query.threshold) : cells;
    pool.sort((a, b) => b.value - a.value || byIndex(a, b));
    const method = query.type === QUERY.THRESHOLD ? `value >= ${query.threshold} ${data.unit}` : "highest values on one date";
    const top = pool.slice(0, limit).map((cell, i) => finding(query, data, i + 1, cell, { snap, method, formula: query.type === QUERY.THRESHOLD ? "value >= threshold" : "sort by value, largest first", inputCount: cells.length }));
    return base(query, data, { evaluatedSamples: cells.length, scopeLabel: SCOPE(cells.length, 1), findings: top, totalMatches: pool.length, missingExcluded: missing, status: top.length ? "results" : "no_results" });
  }

  // ---- Two dates: largest increase / decrease
  const a = snapOf(query.startDate);
  const b = snapOf(query.endDate);
  if (!a || !b || a.date === b.date) return base(query, data, { status: "unsupported_period", reason: a && b ? "Pick two different dates." : "Both dates must be available sampled dates." });
  const [first, second] = a.date <= b.date ? [a, b] : [b, a];
  if (first.build !== second.build) return base(query, data, { status: "unsupported_period", reason: BUILD_REASON, scopeLabel: SCOPE(0, 2) });
  const rows = [];
  let missing = 0;
  for (let i = 0; i < first.values.length; i++) {
    if (i % CHUNK === 0) { if (shouldCancel()) return base(query, data, { status: "cancelled" }); await yieldFn(); }
    const v1 = first.values[i];
    const v2 = second.values[i];
    if (!finite(v1) || !finite(v2)) { missing++; continue; }
    rows.push({ index: i, v1, v2, delta: v2 - v1 });
  }
  if (!rows.length) return base(query, data, { status: "insufficient_data", reason: "No cell has a value on both dates.", missingExcluded: missing, scopeLabel: SCOPE(0, 2) });
  const up = query.type === QUERY.INCREASE;
  const pool = rows.filter((r) => (up ? r.delta > 0 : r.delta < 0));
  pool.sort((x, y) => (up ? y.delta - x.delta : x.delta - y.delta) || byIndex(x, y));
  const percentBase = data.percentBase ?? 0;
  const out = pool.slice(0, limit).map((r, i) => {
    const percentOk = data.ratio && Math.abs(r.v1) >= percentBase && Math.abs(r.v1) > 0;
    const notes = percentOk ? [] : [data.ratio ? "Percent change not valid: the first value is too close to zero." : "Percent change not valid for this measure (no true zero)."];
    return finding(query, data, i + 1, { index: r.index, value: r.v2 }, { first, second, v1: r.v1, v2: r.v2, delta: r.delta, percent: percentOk ? (100 * r.delta) / Math.abs(r.v1) : null, notes, method: up ? "largest increase" : "largest decrease", formula: "delta = value(date 2) - value(date 1)", inputCount: rows.length });
  });
  return base(query, data, { evaluatedSamples: rows.length, scopeLabel: SCOPE(rows.length, 2), findings: out, totalMatches: pool.length, missingExcluded: missing, status: out.length ? "results" : "no_results", dateCount: dates.size });
}

/** Builds the worker payload for a phenomenon, leaving out dates the caller must not search (locked dust dates). */
export function toHunterData(phen, { excludeDates = [], percentBaseFraction = 0.05 } = {}) {
  const spec = phen.spec;
  return {
    phenomenon: phen.id, unit: spec.unitLabel || spec.unit, ratio: true, percentBase: percentBaseFraction * (spec.max - spec.min), rows: phen.grid.rows, cols: phen.grid.cols,
    snapshots: phen.list.filter((s) => !excludeDates.includes(s.date)).map((s) => ({ id: s.id, date: s.date, build: phen.groupOf?.(s.id) ?? s.source.modelSource, values: Array.from(s.values), timeStart: s.time.start, timeEnd: s.time.end, granule: s.source.granule })),
  };
}
