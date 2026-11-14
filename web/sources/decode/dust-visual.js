// Independent M1 visualization data API. DecodeCase v2 and its loader are unchanged.
const defaultBase = new URL("../../assets/decode/dust-v2/", import.meta.url);
const bounds = { north: 45, south: 15, east: 50, west: -20 };
const gridId = "north-africa-med-25x40-v1";
const model = "GEOSadas-5_29_5-p6-SLES15 experiment_id: f5295_fp";
const supportedModels = new Set([model, "GEOSadas-5_29_5-p6 experiment_id: f5295_fp"]);
const method = "spherical-area-weighted native-footprint overlap mean; any invalid contributor => missing";
const finite = x => typeof x === "number" && Number.isFinite(x);
const hash = x => typeof x === "string" && /^[a-f0-9]{64}$/.test(x);
const safeId = x => typeof x === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(x);
const close = (a, b) => finite(a) && Math.abs(a - b) < 1e-9;
function require(ok, field) {
  if (!ok) throw new TypeError(`Invalid dust visualization data: ${field}`);
}
function sameBounds(value) {
  return value && Object.keys(bounds).every(k => value[k] === bounds[k]);
}
function baseGeometry(data) {
  require(data?.gridId === gridId && data.rows === 25 && data.cols === 40 && sameBounds(data.bounds), "grid geometry");
}
function season(date) {
  const [year, month] = date.split("-").map(Number);
  if ([12, 1, 2].includes(month)) {
    const end = year + (month === 12 ? 1 : 0);
    return { key: `winter-${end - 1}-${end}`, name: "winter", seasonYear: end };
  }
  const name = month < 6 ? "spring" : month < 9 ? "summer" : "autumn";
  return { key: `${name}-${year}`, name, seasonYear: year };
}
function utc(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value.replace("Z", ".000Z");
}
function temporal(time) {
  require(time?.kind === "three-hour mean" && [time.start, time.end, time.center].every(utc), "three-hour UTC interval");
  require(Date.parse(time.end) - Date.parse(time.start) === 10800000
    && Date.parse(time.center) - Date.parse(time.start) === 5400000, "averaging support");
  require(time.date === time.center.slice(0, 10), "source date");
  const expected = season(time.date);
  require(Object.keys(expected).every(k => time.season?.[k] === expected[k]), "meteorological season");
}
function statistics(values) {
  const valid = values.filter(v => v !== null);
  return { valid: valid.length, missing: values.length - valid.length,
    min: valid.length ? Math.min(...valid) : null, max: valid.length ? Math.max(...valid) : null };
}
function numerical(data, allowNegative = false) {
  require(Array.isArray(data.values) && data.values.length === 1000
    && data.values.every(v => v === null || finite(v) && (allowNegative || v >= 0)), "1000 finite values/nulls");
  const expected = statistics(data.values);
  require(Object.keys(expected).every(k => data.statistics?.[k] === expected[k]), "value statistics");
}

export function validateDustGrid(data) {
  require(data?.schema === "earthpulse.dust-grid/1" && data.id === gridId, "grid schema/id");
  require(data.rows === 25 && data.cols === 40 && sameBounds(data.bounds), "grid extent/dimensions");
  require(Array.isArray(data.cells) && data.cells.length === 1000, "1000 geometry cells");
  data.cells.forEach((cell, i) => {
    const row = Math.floor(i / 40), col = i % 40;
    const n = 45 - row * 1.2, s = 45 - (row + 1) * 1.2, w = -20 + col * 1.75, e = w + 1.75;
    require(cell?.row === row && cell.col === col && close(cell.lat, (n + s) / 2) && close(cell.lon, (w + e) / 2)
      && close(cell.bounds?.north, n) && close(cell.bounds?.south, s)
      && close(cell.bounds?.west, w) && close(cell.bounds?.east, e), `cell ${i} orientation/rectangle`);
  });
  return data;
}

export function validateDustSnapshot(data) {
  require(data?.schema === "earthpulse.dust-snapshot/1" && safeId(data.id) && data.fixture === false, "snapshot schema/id/provenance");
  baseGeometry(data);
  require(data.unit === "1" && data.variable === "DUEXTTAU" && data.method === method, "quantity/unit/method");
  temporal(data.time);
  const source = data.source;
  require(source?.shortName === "DFPT3NXAER" && source.version === "5.29.5" && supportedModels.has(source.modelSource)
    && hash(source.sha256) && Number.isSafeInteger(source.bytes) && source.bytes > 0
    && typeof source.url === "string" && source.url.startsWith("https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/das/")
    && typeof source.granule === "string" && source.url.endsWith("/" + source.granule)
    && source.nativeResolutionDegrees?.lat === .25 && source.nativeResolutionDegrees?.lon === .3125, "verified compatible NASA source");
  const center = data.time.center.slice(11, 16).replace(":", "");
  require(data.id === `geos-fp-dust-${data.time.date.replaceAll("-", "")}-${center}`
    && source.granule === `GEOS.fp.asm.tavg3_2d_aer_Nx.${data.time.date.replaceAll("-", "")}_${center}.V01.nc4`, "granule/time identity");
  if (data.visualLink !== null) {
    require(data.time.date === "2025-08-19" && data.visualLink?.relation === "RELATED_CONTEXT"
      && data.visualLink.svs === "https://svs.gsfc.nasa.gov/5669/"
      && data.visualLink.image === "https://svs.gsfc.nasa.gov/vis/a000000/a005600/a005669/Aerosols_2025-08-19T20_00_00_1920x1080.png"
      && typeof data.visualLink.note === "string" && data.visualLink.note.length > 0, "dated contextual imagery");
  }
  numerical(data);
  return data;
}

export function validateDustComparison(data) {
  require(data?.schema === "earthpulse.dust-comparison/1" && safeId(data.id), "comparison schema/id");
  baseGeometry(data);
  require(data.unit === "1" && data.variable === "DUEXTTAU" && data.operation === "second minus first", "comparison operation/unit");
  require(Array.isArray(data.periods) && data.periods.length === 2, "two selected periods");
  data.periods.forEach(p => { require(safeId(p.id) && hash(p.sourceSha256) && supportedModels.has(p.modelSource), "period provenance"); temporal(p.time); });
  require(data.periods[0].modelSource === data.periods[1].modelSource, "incompatible comparison builds");
  require(data.id === `${data.periods[0].id}--to--${data.periods[1].id}`, "comparison identity");
  numerical(data, true);
  return data;
}

export function validateDustCatalog(data) {
  require(data?.schema === "earthpulse.dust-catalog/1" && sameBounds(data.bounds)
    && data.unit === "1" && data.variable === "DUEXTTAU", "catalog schema/quantity/extent");
  require(data.grid?.id === gridId && data.grid.path === "grid.json" && data.grid.rows === 25
    && data.grid.cols === 40 && hash(data.grid.sha256_lf), "catalog grid");
  require(Array.isArray(data.snapshots) && Array.isArray(data.seasons) && Array.isArray(data.comparisons)
    && Array.isArray(data.datasets), "catalog entries");
  const ids = new Set();
  data.snapshots.forEach(s => {
    require(safeId(s.id) && !ids.has(s.id), "unique snapshot ids"); ids.add(s.id);
    temporal(s.time);
    require(s.date === s.time.date && s.path === `snapshots/${s.id}.json`
      && hash(s.sha256_lf) && hash(s.sourceSha256) && s.downloadStatus === "verified"
      && s.extractionStatus === "verified" && supportedModels.has(s.modelSource)
      && ["pilot", "monthly", "reference"].includes(s.phase), "published verified source");
  });
  require(data.coverage?.verifiedSnapshots === ids.size && data.coverage.plannedRequests === data.datasets.length, "coverage counts");
  require(data.coverage.monthlySamples === data.snapshots.filter(s => s.phase !== "reference").length, "monthly sample count");
  require(new Set(data.datasets.map(d => d.id)).size === data.datasets.length, "unique dataset ids");
  data.datasets.forEach(d => require(d.published === ids.has(d.id)
    && (!d.published || d.downloadStatus === "verified" && d.extractionStatus === "verified"), "dataset availability"));
  require(Array.isArray(data.coverage.missingRequests), "missing request ledger");
  const missing = data.datasets.filter(d => !d.published).map(d => d.id).sort();
  require(JSON.stringify(data.coverage.missingRequests.map(d => d.id).sort()) === JSON.stringify(missing), "missing request consistency");
  const seasonMembers = [];
  data.seasons.forEach(s => {
    require(Array.isArray(s.snapshotIds) && s.snapshotIds.length > 0, "season membership");
    s.snapshotIds.forEach(id => {
      require(ids.has(id) && data.snapshots.find(x => x.id === id).time.season.key === s.key, "actual seasonal source");
      seasonMembers.push(id);
    });
  });
  require(seasonMembers.length === ids.size && new Set(seasonMembers).size === ids.size, "complete seasonal partition");
  const years = [...new Set(data.snapshots.map(s => Number(s.date.slice(0, 4))))].sort((a, b) => a - b);
  require(JSON.stringify(data.years) === JSON.stringify(years), "available calendar years");
  const months = [...new Set(data.snapshots.map(s => s.date.slice(0, 7)))].sort();
  require(JSON.stringify(data.coverage.months) === JSON.stringify(months), "verified month coverage");
  data.comparisons.forEach(c => require(ids.has(c.first) && ids.has(c.second)
    && c.id === `${c.first}--to--${c.second}` && c.path === `comparisons/${c.id}.json`
    && hash(c.sha256_lf) && data.snapshots.find(s => s.id === c.first).modelSource === data.snapshots.find(s => s.id === c.second).modelSource, "comparison references"));
  require(Array.isArray(data.compatibilityGroups), "compatibility groups");
  const grouped = [];
  data.compatibilityGroups.forEach(g => {
    require(supportedModels.has(g.modelSource) && Array.isArray(g.snapshotIds), "supported build group");
    g.snapshotIds.forEach(id => {
      require(ids.has(id) && data.snapshots.find(s => s.id === id).modelSource === g.modelSource, "build membership");
      grouped.push(id);
    });
  });
  require(grouped.length === ids.size && new Set(grouped).size === ids.size, "complete build partition");
  return data;
}

async function load(path, validator, options) {
  const base = new URL(options?.baseUrl ?? defaultBase, import.meta.url);
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  const response = await fetch(new URL(path, base));
  if (!response.ok) throw new Error(`Could not load dust visualization ${path} (${response.status})`);
  let data;
  try { data = await response.json(); }
  catch (cause) { throw new Error(`Invalid dust visualization JSON: ${path}`, { cause }); }
  return validator(data);
}
export const loadDustCatalog = options => load("catalog.json", validateDustCatalog, options);
export const loadDustGrid = options => load("grid.json", validateDustGrid, options);
export async function loadDustSnapshot(id, options) {
  require(safeId(id), "unsafe snapshot id");
  const data = await load(`snapshots/${id}.json`, validateDustSnapshot, options);
  require(data.id === id, "requested snapshot id mismatch");
  return data;
}
export async function loadDustComparison(id, options) {
  require(safeId(id), "unsafe comparison id");
  const data = await load(`comparisons/${id}.json`, validateDustComparison, options);
  require(data.id === id, "requested comparison id mismatch");
  return data;
}

export function compareDustSnapshots(first, second) {
  validateDustSnapshot(first); validateDustSnapshot(second);
  require(["gridId", "unit", "variable", "method"].every(k => first[k] === second[k])
    && first.source.modelSource === second.source.modelSource, "incompatible snapshots");
  const values = first.values.map((a, i) => a === null || second.values[i] === null ? null : second.values[i] - a);
  return validateDustComparison({ schema: "earthpulse.dust-comparison/1", id: `${first.id}--to--${second.id}`,
    gridId, rows: 25, cols: 40, bounds: { ...bounds }, unit: "1", variable: "DUEXTTAU", operation: "second minus first",
    timeSemantics: "difference between selected three-hour means; not seasonal means or a trend estimate",
    periods: [first, second].map(s => ({ id: s.id, time: s.time, sourceSha256: s.source.sha256, modelSource: s.source.modelSource })),
    statistics: statistics(values), values });
}

/** Join compact values to shared geometry for Canvas/WebGL/SVG or tooltips. */
export function getDustCells(asset, grid) {
  validateDustGrid(grid);
  if (asset?.schema === "earthpulse.dust-comparison/1") validateDustComparison(asset);
  else validateDustSnapshot(asset);
  return grid.cells.map((cell, i) => ({ ...cell, bounds: { ...cell.bounds }, value: asset.values[i],
    status: asset.values[i] === null ? "missing" : "available", temporalRef: asset.id,
    sourceTime: asset.time ?? asset.periods }));
}
