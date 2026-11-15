// Earth Map data layer: the three phenomena of Mohammad's verified JSON package, their documented scales, and a loader
// that checks every file's SHA-256 against the master catalog in the browser (LF-normalised, see
// scripts/earth-map/copy-package.mjs). Everything here is NASA GMAO GEOS-FP *model* output, never measured.

export const PACKAGE_URL = () => new URL("../assets/earthpulse-json/", import.meta.url);
export const DECODE_LOCKED_DATES = Object.freeze(["2025-08-15", "2025-08-19"]);
export const BUILD_REASON = "Different literal model build labels; numerical build equivalence unverified.";

const hex = (value) => [(value >> 16) & 255, (value >> 8) & 255, value & 255];
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Documented fixed scales (docs/earth-map/SONIFICATION_MAPPING.md). Limits cover every value of all 13 dates. */
export const PHENOMENA = Object.freeze({
  dust: {
    id: "dust", short: "DFPT3NXAER", variable: "DUEXTTAU", measure: "values", unit: "1", unitLabel: "", decimals: 3,
    window: "three-hour mean", defaultThreshold: 0.2, transform: "log", min: 0.001, max: 2.5, ticks: [0.01, 0.1, 1],
    stops: [[0, hex(0x0f3b66)], [0.22, hex(0x1f9fb5)], [0.45, hex(0xe9d66b)], [0.7, hex(0xf29a2e)], [0.88, hex(0xd4451b)], [1, hex(0x7a1410)]],
    change: { max: 1.5, nearZero: 0.02 }, decodeThreshold: 0.2,
    related: [{ label: "SVS 5669", url: "https://svs.gsfc.nasa.gov/5669/", relation: "RELATED_CONTEXT", only: "2025-08-19" }],
  },
  rainfall: {
    id: "rainfall", short: "DFPT1NXFLX", variable: "PRECTOT", measure: "intervalAccumulationMm", unit: "mm", unitLabel: "mm / h", decimals: 3,
    window: "one-hour mean", defaultThreshold: 0.5, transform: "sqrt", min: 0, max: 4, ticks: [0.1, 1, 3],
    stops: [[0, hex(0x17324d)], [0.25, hex(0x2a73c9)], [0.55, hex(0x46c2f0)], [0.8, hex(0xb6f0ff)], [1, hex(0xffffff)]],
    change: { max: 3, nearZero: 0.05 },
    related: [{ label: "SVS 4285 (IMERG, a different product)", url: "https://svs.gsfc.nasa.gov/4285/", relation: "RELATED_CONTEXT" }],
  },
  wind: {
    id: "wind", short: "DFPT1NXSLV", variable: "U10M, V10M", measure: "speedMps", unit: "m s-1", unitLabel: "m/s", decimals: 1,
    window: "one-hour mean", defaultThreshold: 10, transform: "linear", min: 0, max: 16, ticks: [2, 8, 14],
    stops: [[0, hex(0x0b2a3a)], [0.3, hex(0x127c8a)], [0.55, hex(0x5fd1b0)], [0.8, hex(0xe6f08a)], [1, hex(0xfff6d6)]],
    change: { max: 12, nearZero: 0.3 }, vector: true,
    related: [],
  },
});
export const PHENOMENON_IDS = Object.freeze(Object.keys(PHENOMENA));
export const UNAVAILABLE_PHENOMENA = Object.freeze({ forests: { id: "forests", reason: "forests" } });

/** value -> 0..1 on the phenomenon's fixed scale. */
export function normalizer(spec) {
  const { transform, min, max } = spec;
  if (transform === "log") { const span = Math.log(max / min); return (v) => clamp01(Math.log(Math.max(v, min) / min) / span); }
  if (transform === "sqrt") return (v) => clamp01(Math.sqrt(clamp01((v - min) / (max - min))));
  return (v) => clamp01((v - min) / (max - min));
}
/** Inverse of normalizer (0..1 -> value). */
export function denormalizer(spec) {
  const { transform, min, max } = spec;
  if (transform === "log") return (t) => min * Math.exp(clamp01(t) * Math.log(max / min));
  if (transform === "sqrt") return (t) => min + clamp01(t) ** 2 * (max - min);
  return (t) => min + clamp01(t) * (max - min);
}

/** Signed change normaliser for a phenomenon: magnitudes below nearZero are exactly 0 (neutral). */
export function changeNormalizer(spec) {
  const { max, nearZero } = spec.change;
  const top = Math.log1p(max / nearZero);
  return (c) => (Math.abs(c) < nearZero ? 0 : Math.sign(c) * Math.min(1, Math.log1p(Math.abs(c) / nearZero) / top));
}

/** 256-entry RGBA ramp from the phenomenon's colour stops. */
export function rampFromStops(stops) {
  const data = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let rgb = stops.at(-1)[1];
    for (let k = 1; k < stops.length; k++) {
      if (t <= stops[k][0]) { const f = (t - stops[k - 1][0]) / (stops[k][0] - stops[k - 1][0]); rgb = stops[k - 1][1].map((c, j) => Math.round(c + (stops[k][1][j] - c) * f)); break; }
    }
    data.set([...rgb, 255], i * 4);
  }
  return data;
}

export const colorAt = (spec, value) => { const t = Math.round(normalizer(spec)(value) * 255); const table = rampFromStops(spec.stops); return [table[t * 4], table[t * 4 + 1], table[t * 4 + 2]]; };

/** Number text with the phenomenon's own precision (null stays an em dash: never 0). */
export function formatValue(spec, value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (spec.id === "dust" && Math.abs(value) < 0.01) return String(Number(value.toFixed(4)));
  return String(Number(value.toFixed(spec.decimals)));
}
export const formatChange = (spec, value) => (value === null || value === undefined ? "—" : (value > 0 ? "+" : value < 0 ? "−" : "") + formatValue(spec, Math.abs(value)));

// ---- Integrity
export function normalizeLF(raw) {
  const out = new Uint8Array(raw.length);
  let n = 0;
  for (let i = 0; i < raw.length; i++) { if (raw[i] === 13 && raw[i + 1] === 10) continue; out[n++] = raw[i]; }
  return out.subarray(0, n);
}
export const toHex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
export function browserDigest(win = globalThis) {
  const subtle = win.crypto?.subtle;
  return subtle ? async (bytes) => toHex(await subtle.digest("SHA-256", bytes)) : null;
}

/** Fetch one package file, normalise CRLF, check sha256 and bytes against the master catalog asset, return parsed JSON. */
export async function fetchVerified(url, asset, { fetchImpl = fetch, digest = browserDigest() } = {}) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Could not load ${asset?.path ?? url} (${response.status})`);
  const bytes = normalizeLF(new Uint8Array(await response.arrayBuffer()));
  let verified = false;
  if (asset && digest) {
    if (bytes.length !== asset.bytes || (await digest(bytes)) !== asset.sha256) throw new Error(`Integrity check failed for ${asset.path}`);
    verified = true;
  }
  return { json: JSON.parse(new TextDecoder().decode(bytes)), verified };
}

// ---- Package
const isFiniteOrNull = (v) => v === null || Number.isFinite(v);
export function validateSnapshot(spec, s) {
  if (!s || typeof s !== "object") throw new TypeError("Snapshot is not an object.");
  if (s.rows !== 25 || s.cols !== 40) throw new RangeError("Unexpected grid size.");
  const measures = Array.isArray(s.values) ? { values: s.values } : s.values;
  if (!measures?.[spec.measure]) throw new TypeError(`Snapshot ${s.id} has no ${spec.measure}.`);
  for (const [key, arr] of Object.entries(measures)) {
    if (!Array.isArray(arr) || arr.length !== 1000 || !arr.every(isFiniteOrNull)) throw new TypeError(`Invalid ${key} values in ${s.id}.`);
  }
  if (!s.time?.start || !s.source?.modelSource) throw new TypeError(`Snapshot ${s.id} lacks time or source.`);
  return measures;
}

/** Same build label for both snapshots, or the reason a difference is blocked. */
export function comparability(a, b, { groupOf = (s) => s.source.modelSource, policy = null } = {}) {
  if (!a || !b) return { ok: false, reason: "missing snapshot" };
  return groupOf(a) === groupOf(b) ? { ok: true } : { ok: false, reason: policy ?? BUILD_REASON };
}

export const isLocked = (phenomenon, date, unlocked) => phenomenon === "dust" && DECODE_LOCKED_DATES.includes(date) && !unlocked;

/** Opens the package: master catalog now, phenomena on demand. */
export async function openPackage({ baseUrl = PACKAGE_URL(), fetchImpl = fetch, digest = browserDigest() } = {}) {
  const base = new URL(baseUrl);
  const master = await (async () => { const r = await fetchImpl(new URL("catalog.json", base)); if (!r.ok) throw new Error("Could not load the master catalog."); return JSON.parse(new TextDecoder().decode(normalizeLF(new Uint8Array(await r.arrayBuffer())))); })();
  if (master.schema !== "earthpulse.json-export/1") throw new TypeError("Unexpected master catalog schema.");
  const assets = new Map(master.assets.map((a) => [a.path, a]));
  const integrity = { mode: digest ? "sha256" : "unavailable", verified: 0, failed: [] };
  const opened = new Map();
  const loadJson = async (path) => {
    try { const { json, verified } = await fetchVerified(new URL(path, base), assets.get(path), { fetchImpl, digest }); if (verified) integrity.verified++; return json; }
    catch (error) { integrity.failed.push(path); throw error; }
  };

  async function openPhenomenon(id) {
    if (!PHENOMENA[id]) throw new RangeError(`Unknown phenomenon ${id}.`);
    if (opened.has(id)) return opened.get(id);
    const job = (async () => {
      const spec = PHENOMENA[id];
      const [catalog, grid] = await Promise.all([loadJson(`${id}/catalog.json`), loadJson(`${id}/grid.json`)]);
      const raw = await Promise.all(catalog.snapshots.map((entry) => loadJson(entry.path.startsWith(id + "/") ? entry.path : `${id}/${entry.path}`)));
      const snapshots = new Map();
      catalog.snapshots.forEach((entry, i) => {
        const s = raw[i];
        const measures = validateSnapshot(spec, s);
        snapshots.set(entry.id, { id: entry.id, phenomenon: id, date: entry.date, time: s.time, source: s.source, warnings: s.warnings ?? [], statistics: s.statistics, visualLink: s.visualLink ?? null, measures, values: measures[spec.measure], variables: s.variables ?? null });
      });
      const list = [...snapshots.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
      // The catalog's own compatibilityGroups are used directly; the derived rule (the literal modelSource of each snapshot) is only the fallback.
      const derived = new Map();
      for (const s of list) { if (!derived.has(s.source.modelSource)) derived.set(s.source.modelSource, []); derived.get(s.source.modelSource).push(s.id); }
      const declared = Array.isArray(catalog.compatibilityGroups) ? catalog.compatibilityGroups.filter((g) => g && typeof g.modelSource === "string" && Array.isArray(g.snapshotIds)) : [];
      const covered = new Set(declared.flatMap((g) => g.snapshotIds));
      const useCatalog = declared.length > 0 && list.every((s) => covered.has(s.id));
      const groupList = useCatalog ? declared.map((g) => ({ modelSource: g.modelSource, snapshotIds: [...g.snapshotIds] })) : [...derived].map(([modelSource, snapshotIds]) => ({ modelSource, snapshotIds }));
      const groupById = new Map(groupList.flatMap((g) => g.snapshotIds.map((sid) => [sid, g.modelSource])));
      const compatibilityPolicy = typeof catalog.compatibilityPolicy === "string" ? catalog.compatibilityPolicy : null;
      const seasons = [];
      for (const s of list) {
        let season = seasons.find((x) => x.key === s.time.season.key);
        if (!season) { season = { key: s.time.season.key, name: s.time.season.name, seasonYear: s.time.season.seasonYear, snapshotIds: [], dates: [] }; seasons.push(season); }
        season.snapshotIds.push(s.id); season.dates.push(s.date);
      }
      const comparisons = (catalog.comparisons ?? []).map((c) => ({ ...c, path: `${id}/${c.path}` }));
      return {
        id, spec, grid, catalog, list, snapshots, seasons, comparisons,
        compatibilityGroups: groupList, compatibilityPolicy, groupsFrom: useCatalog ? "catalog" : "derived",
        unavailableComparisons: catalog.unavailableComparisons ?? [],
        snapshot: (snapshotId) => snapshots.get(snapshotId) ?? null,
        byDate: (date) => list.find((s) => s.date === date) ?? null,
        groupOf: (snapshotId) => groupById.get(snapshotId) ?? snapshots.get(snapshotId)?.source.modelSource ?? null,
      };
    })();
    opened.set(id, job);
    try { return await job; } catch (error) { opened.delete(id); throw error; }
  }

  /** Earlier date is the first. Published (dust only) > computed in one build group > unavailable with the reason. */
  function resolveComparison(phen, idA, idB) {
    if (idA === idB) return { status: "same" };
    const [first, second] = phen.snapshot(idA).date <= phen.snapshot(idB).date ? [idA, idB] : [idB, idA];
    const published = phen.comparisons.find((p) => p.first === first && p.second === second);
    const cmp = comparability(phen.snapshot(first), phen.snapshot(second), { groupOf: (s) => phen.groupOf(s.id), policy: phen.compatibilityPolicy });
    if (published && cmp.ok) return { status: "published", first, second, id: published.id, path: published.path };
    if (cmp.ok) return { status: "computed", first, second };
    const known = phen.unavailableComparisons.find((p) => p.first === first && p.second === second);
    return { status: "unavailable", first, second, reason: known?.reason ?? cmp.reason };
  }

  /** second minus first for the phenomenon's default measure, null where either side is missing. */
  async function difference(phen, resolution) {
    const a = phen.snapshot(resolution.first);
    const b = phen.snapshot(resolution.second);
    if (resolution.status === "published") {
      const file = await loadJson(resolution.path);
      return { id: file.id, kind: "published", values: file.values, first: a, second: b, statistics: file.statistics };
    }
    if (resolution.status !== "computed") throw new Error("Comparison not allowed.");
    const values = a.values.map((x, i) => (x === null || b.values[i] === null ? null : b.values[i] - x));
    return { id: `${a.id}--to--${b.id}`, kind: "computed", values, first: a, second: b };
  }

  return { master, assets, integrity, openPhenomenon, resolveComparison, difference, loadJson, base };
}
