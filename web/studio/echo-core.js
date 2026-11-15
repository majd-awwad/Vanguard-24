// Earth Echo Finder: time-series pattern matching on the DATA (never on audio waveforms, never AI embeddings).
// Series per cell = the regular monthly samples (the 15th of each month; 2025-08-19 is excluded so the spacing stays
// regular), inside ONE model-build group (cross-build comparison is blocked). Same phenomenon and unit only.
//  - Shape mode: each series is z-normalised (guarded against near-constant series), then Euclidean distance on aligned
//    months and DTW with a Sakoe-Chiba band of `window` months. Level mode: no level normalisation; RMS difference in units.
//  - Distances are smaller = more similar. No percent match is ever reported.

export const ECHO_MIN_POINTS = 6;
export const DEFAULT_WINDOW = 1;
export const DEFAULT_SEPARATION = 3;
export const SIMILARITY_NOTE = "Similar pattern does not prove the same cause or any causal link.";
export const BUILD_REASON = "Different literal model build labels; numerical build equivalence unverified.";
const CHUNK = 100;

const finite = (v) => typeof v === "number" && Number.isFinite(v);
export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
export const std = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };

/** z-score of a series, or null when it is (nearly) constant: never divide by a zero deviation. */
export function zNormalize(series, flatTolerance) {
  const s = std(series);
  if (!(s > flatTolerance)) return null;
  const m = mean(series);
  return series.map((v) => (v - m) / s);
}

/** Root-mean-square difference of two aligned series (units of the series, or z units in shape mode). */
export function euclidean(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum / a.length);
}

/** DTW with a Sakoe-Chiba band: cells with |i - j| > window are not allowed. Returns RMS over the series length. */
export function dtw(a, b, window = DEFAULT_WINDOW) {
  const n = a.length;
  const m = b.length;
  const w = Math.max(window, Math.abs(n - m));
  const INF = Infinity;
  let previous = new Array(m + 1).fill(INF);
  previous[0] = 0;
  for (let i = 1; i <= n; i++) {
    const current = new Array(m + 1).fill(INF);
    for (let j = Math.max(1, i - w); j <= Math.min(m, i + w); j++) {
      const cost = (a[i - 1] - b[j - 1]) ** 2;
      current[j] = cost + Math.min(previous[j], current[j - 1], previous[j - 1]);
    }
    previous = current;
  }
  return Math.sqrt(previous[m] / Math.max(n, m));
}

const result = (query, data, extra = {}) => ({
  sourceSampleId: query.sourceIndex ?? null, mode: query.mode ?? "shape", algorithm: query.algorithm ?? "dtw", normalization: (query.mode ?? "shape") === "shape" ? "z-score" : "none",
  comparedSeriesCount: 0, matches: [], status: "results", reason: null, window: query.window ?? DEFAULT_WINDOW, dates: [], build: null, scopeLabel: "", flatExcluded: 0, gappyExcluded: 0, note: SIMILARITY_NOTE, ...extra,
});

/** Monthly dates (the 15th), without 2025-08-19, grouped by build; picks the requested or the largest group. */
export function monthlyGroup(data, preferredBuild) {
  const groups = new Map();
  for (const s of data.snapshots) {
    if (!s.date.endsWith("-15")) continue;
    if (!groups.has(s.build)) groups.set(s.build, []);
    groups.get(s.build).push(s);
  }
  const all = [...groups.entries()].sort((x, y) => y[1].length - x[1].length || x[0].localeCompare(y[0]));
  const chosen = (preferredBuild && groups.has(preferredBuild)) ? [preferredBuild, groups.get(preferredBuild)] : all[0];
  return { groups: all.map(([build, list]) => ({ build, count: list.length })), build: chosen?.[0] ?? null, snapshots: (chosen?.[1] ?? []).sort((x, y) => x.date.localeCompare(y.date)) };
}

/**
 * @param query { sourceIndex, mode: "shape"|"value", algorithm: "dtw"|"euclidean", window?, maxResults?, minSeparation?, build?, unit? }
 * @param data  { phenomenon, unit, rows, cols, flatTolerance, synthetic?, snapshots: [{ date, build, values, timeStart, timeEnd }] }
 */
export async function runEcho(query, data, { shouldCancel = () => false, yieldFn = async () => {} } = {}) {
  const mode = query.mode === "value" ? "value" : "shape";
  const algorithm = query.algorithm === "euclidean" ? "euclidean" : "dtw";
  const window = Number.isInteger(query.window) && query.window >= 0 ? query.window : DEFAULT_WINDOW;
  const q = { ...query, mode, algorithm, window };
  if (query.unit && query.unit !== data.unit) return result(q, data, { status: "incompatible", reason: "Echo compares the same phenomenon and unit only." });
  if (!Number.isInteger(query.sourceIndex) || query.sourceIndex < 0 || query.sourceIndex >= data.rows * data.cols) return result(q, data, { status: "error", reason: "Select a source cell on the map first." });
  const group = monthlyGroup(data, query.build);
  const base = { dates: group.snapshots.map((s) => s.date), build: group.build };
  if (group.snapshots.length < ECHO_MIN_POINTS) {
    return result(q, data, { ...base, status: "insufficient_data", reason: `Only ${group.snapshots.length} comparable monthly samples are available in one model build; at least ${ECHO_MIN_POINTS} are needed.`, groups: group.groups });
  }
  const months = group.snapshots.map((s) => Number(s.date.slice(0, 4)) * 12 + Number(s.date.slice(5, 7)));
  if (months.some((month, i) => i > 0 && month - months[i - 1] !== 1)) {
    return result(q, data, { ...base, status: "insufficient_data", reason: "The available monthly samples are not consecutive months, so the series would not be regularly spaced.", groups: group.groups });
  }
  const n = data.rows * data.cols;
  const flatTolerance = data.flatTolerance ?? 1e-9;
  const seriesOf = (index) => group.snapshots.map((s) => s.values[index]);
  const source = seriesOf(query.sourceIndex);
  if (!source.every(finite)) return result(q, data, { ...base, status: "insufficient_data", reason: "The source cell has a missing value in the series, and gaps are never filled." });
  const sourceZ = mode === "shape" ? zNormalize(source, flatTolerance) : source;
  if (!sourceZ) return result(q, data, { ...base, status: "insufficient_data", reason: "The source series is nearly constant, so a shape comparison is not meaningful. Use Level mode." });
  const separation = Number.isInteger(query.minSeparation) ? query.minSeparation : DEFAULT_SEPARATION;
  const sRow = Math.floor(query.sourceIndex / data.cols);
  const sCol = query.sourceIndex % data.cols;
  const candidates = [];
  let flat = 0;
  let gappy = 0;
  let compared = 0;
  for (let i = 0; i < n; i++) {
    if (i % CHUNK === 0) { if (shouldCancel()) return result(q, data, { ...base, status: "cancelled" }); await yieldFn(); }
    if (i === query.sourceIndex) continue;
    if (Math.max(Math.abs(Math.floor(i / data.cols) - sRow), Math.abs((i % data.cols) - sCol)) < separation) continue;
    const series = seriesOf(i);
    if (!series.every(finite)) { gappy++; continue; }
    const candidate = mode === "shape" ? zNormalize(series, flatTolerance) : series;
    if (!candidate) { flat++; continue; }
    compared++;
    const e = euclidean(sourceZ, candidate);
    const d = dtw(sourceZ, candidate, window);
    candidates.push({ index: i, series, euclidean: e, dtw: d, distance: algorithm === "dtw" ? d : e });
  }
  candidates.sort((x, y) => x.distance - y.distance || x.index - y.index);
  const first = group.snapshots[0];
  const last = group.snapshots.at(-1);
  const matches = candidates.slice(0, Math.max(1, Math.min(50, query.maxResults ?? 10))).map((c, i) => ({
    rank: i + 1, sampleId: c.index, row: Math.floor(c.index / data.cols), col: c.index % data.cols, distance: c.distance, euclidean: c.euclidean, dtw: c.dtw, sampleCount: group.snapshots.length,
    timeCoverage: { start: first.timeStart, end: last.timeEnd }, series: c.series,
  }));
  return result(q, data, {
    ...base, comparedSeriesCount: compared, matches, flatExcluded: flat, gappyExcluded: gappy, sourceSeries: source, status: matches.length ? "results" : "no_results", separation,
    scopeLabel: `Compared ${compared} cell series of ${group.snapshots.length} monthly samples each, in one model build`, groups: group.groups,
  });
}

/** Worker payload: the phenomenon's snapshots, without any date the caller must not search. */
export function toEchoData(phen, { excludeDates = [], flatFraction = 0.001 } = {}) {
  const spec = phen.spec;
  return {
    phenomenon: phen.id, unit: spec.unitLabel || spec.unit, rows: phen.grid.rows, cols: phen.grid.cols, flatTolerance: flatFraction * (spec.max - spec.min),
    snapshots: phen.list.filter((s) => !excludeDates.includes(s.date)).map((s) => ({ date: s.date, build: phen.groupOf?.(s.id) ?? s.source.modelSource, values: Array.from(s.values), timeStart: s.time.start, timeEnd: s.time.end })),
  };
}
