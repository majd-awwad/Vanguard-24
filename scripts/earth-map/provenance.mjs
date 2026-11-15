// Builds the per-dataset provenance manifest of spec 09.2 from the verified package, and writes
// docs/earth-map/provenance.json and docs/earth-map/DATA_PROVENANCE.md.   node scripts/earth-map/provenance.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EXCLUDED_PHENOMENA, TARGET, toLF, sha256, verifyDirectory } from "./copy-package.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const REQUIRED_FIELDS = Object.freeze(["datasetId", "phenomenon", "eicVisualizationUrl", "sourceDatasetUrl", "sourceType", "variable", "unit", "timeCoverage", "geoCoverage", "resolution", "sampleCount", "lastVerified", "processingSteps", "missingPolicy", "qualityFlags", "licenseAndCredit", "assetHash"]);

const EIC = {
  dust: { url: "https://svs.gsfc.nasa.gov/5669/", note: "RELATED_CONTEXT for 2025-08-19 only: a separate GEOS-FP 2 km Replay at 20:00 UTC; not registered numeric pixels; never drawn on the map." },
  rainfall: { url: "https://svs.gsfc.nasa.gov/4285/", note: "RELATED_CONTEXT: GPM IMERG is a different (satellite-derived) product; this rainfall is GEOS-FP model output." },
  wind: { url: null, note: "No EIC visualization is part of this package." },
};
const MEASURES = {
  dust: "DUEXTTAU, dust extinction aerosol optical depth at 550 nm", rainfall: "PRECTOT (total precipitation rate) and derived one-hour accumulation in mm",
  wind: "U10M and V10M (10 m wind) and derived speed and meteorological direction (null for calm)",
};

/** Pure: builds the manifest list from the master catalog and the per-phenomenon catalogs/snapshots. */
export function buildManifest({ master, catalogs, snapshots, grids, verifiedAt }) {
  return Object.keys(snapshots).map((id) => {
    const assets = master.assets.filter((a) => a.phenomenon === id);
    const list = snapshots[id];
    const first = list[0];
    const catalogAsset = assets.find((a) => a.role === "sampled-seasonal-catalog");
    const dates = list.map((s) => s.time.date ?? s.date).sort();
    const builds = [...new Set(list.map((s) => s.source.modelSource))];
    return {
      datasetId: catalogs[id].id ?? catalogAsset.id,
      phenomenon: id,
      eicVisualizationUrl: EIC[id].url, eicRelation: EIC[id].note,
      sourceDatasetUrl: first.source.url.replace(/\/Y\d{4}\/.*$/, "/"), sourceGranuleExample: first.source.url,
      sourceType: "model", sourceProduct: `NASA GMAO GEOS-FP ${first.source.shortName} (${first.source.product})`, modelRelease: first.source.version,
      variable: MEASURES[id], unit: catalogAsset.scientificUnits,
      timeCoverage: { start: dates[0], end: dates.at(-1), kind: list[0].time.kind, note: "13 selected snapshots (the 15th of each month 2024-12 to 2025-11, plus 2025-08-19); each is one snapshot, not a daily, monthly or seasonal average and not a climatology." },
      geoCoverage: { type: "bbox", west: grids[id].bounds.west, east: grids[id].bounds.east, south: grids[id].bounds.south, north: grids[id].bounds.north },
      resolution: { native: first.source.nativeResolutionDegrees ?? { lat: 0.25, lon: 0.3125 }, grid: `${grids[id].rows} x ${grids[id].cols} cells of 1.2 x 1.75 degrees` },
      sampleCount: { snapshots: list.length, cellsPerSnapshot: grids[id].rows * grids[id].cols }, buildLabels: builds,
      lastVerified: verifiedAt,
      processingSteps: ["Read the GEOS-FP NetCDF granule (SHA-256 recorded)", "Spherical area-weighted mean of the native footprints inside each 1.2 x 1.75 degree cell", "Serialise as JSON with provenance; every file verified against the master catalog sha256", id === "wind" ? "Derive speed and meteorological direction from the aggregated U and V (never averaged directions)" : id === "rainfall" ? "Derive one-hour accumulation = PRECTOT x 3600 s" : "No further derivation"],
      missingPolicy: "null means missing; any invalid native overlap makes the target cell missing; missing is never replaced by zero or shown as no change (0 missing cells in this release).",
      qualityFlags: ["model output, not a direct observation", "different literal model build labels are not comparable (differences and Echo blocked across them)", "native footprints inferred from regular coordinate centres; no explicit datum declaration"],
      licenseAndCredit: "Data: NASA GMAO GEOS-FP. Earth imagery: NASA Earth Observatory Blue Marble. No NASA logo; EARTHPULSE is a student project and is not endorsed by NASA.",
      assetHash: { master: "catalog.json", files: assets.length, catalog: catalogAsset.sha256, snapshots: Object.fromEntries(assets.filter((a) => a.role === "snapshot").map((a) => [a.id, a.sha256])) },
    };
  });
}

export function toMarkdown(manifests, verifiedAt) {
  const lines = ["# Data provenance (spec 09.2 manifest)", "", `Generated from the verified package \`deliverables/EarthPulse-JSON-ONLY\` (every file checked against the master catalog sha256) on ${verifiedAt} by \`scripts/earth-map/provenance.mjs\`. The same data are in \`provenance.json\`. All data are NASA GMAO GEOS-FP **model** output.`, ""];
  for (const m of manifests) {
    lines.push(`## ${m.phenomenon} (\`${m.datasetId}\`)`, "", "| Field | Value |", "|---|---|");
    const cell = (v) => (typeof v === "string" ? v : "`" + JSON.stringify(v) + "`").replace(/\|/g, "/");
    for (const key of REQUIRED_FIELDS) lines.push(`| ${key} | ${key === "assetHash" ? `master catalog sha256 per file; ${m.assetHash.files} files; catalog ${m.assetHash.catalog}; each snapshot hash is in \`provenance.json\`` : cell(m[key])} |`);
    lines.push(`| eicRelation | ${m.eicRelation} |`, `| sourceProduct | ${m.sourceProduct} (release ${m.modelRelease}) |`, `| buildLabels | ${m.buildLabels.map((b) => "`" + b + "`").join("; ")} |`, "");
  }
  return lines.join("\n");
}

async function main() {
  const check = await verifyDirectory(TARGET);
  if (check.failures.length) throw new Error("Package failed verification: " + check.failures.join("; "));
  const read = async (path) => JSON.parse(toLF(await readFile(resolve(TARGET, path))).toString("utf8"));
  const master = await read("catalog.json");
  const catalogs = {}; const snapshots = {}; const grids = {};
  for (const id of Object.keys(master.phenomena).filter((phenomenon) => !EXCLUDED_PHENOMENA.includes(phenomenon))) {
    catalogs[id] = await read(`${id}/catalog.json`);
    grids[id] = await read(`${id}/grid.json`);
    snapshots[id] = [];
    for (const entry of catalogs[id].snapshots) snapshots[id].push({ ...(await read(`${id}/${entry.path}`)), date: entry.date });
  }
  const verifiedAt = new Date().toISOString().slice(0, 10);
  const manifests = buildManifest({ master, catalogs, snapshots, grids, verifiedAt });
  const out = resolve(root, "docs/earth-map");
  await mkdir(out, { recursive: true });
  await writeFile(resolve(out, "provenance.json"), JSON.stringify(manifests, null, 2) + "\n");
  await writeFile(resolve(out, "DATA_PROVENANCE.md"), toMarkdown(manifests, verifiedAt));
  console.log(`provenance: ${manifests.length} datasets, ${check.ok} files verified (${sha256(Buffer.from(JSON.stringify(manifests))).slice(0, 12)})`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exit(1); });
