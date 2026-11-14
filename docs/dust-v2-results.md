# Dust V2 actual execution results — 2026-11-14

Completed on `feat/decode-data`. No commit, push, branch merge or shared application edits were performed in this expansion.
Starting/current HEAD: `d393e2e0026a1d995e2d4daa1368f26c2e9106da`.

## Coverage and storage

- Verified snapshots: **13**: 12 selected monthly three-hour means plus the original August 19 reference.
- Covered months: 2024-12, 2025-01, 2025-02, 2025-03, 2025-04, 2025-05, 2025-06, 2025-07, 2025-08, 2025-09, 2025-10, 2025-11.
- Actual nominal center is 19:30 UTC; every opened granule covers 18:00–21:00 UTC on its listed date.
- All sources are DFPT3NXAER / DUEXTTAU / 550 nm / dimensionless `1`, native 0.25° latitude × 0.3125° longitude.
- Unique raw source bytes: **1575446746**; newly downloaded this run: **1453768718** bytes.
- Web JSON: **17 files, 449723 bytes** total, including shared geometry, catalog, 13 snapshots and 2 comparisons.
- Shared geometry: **105793 bytes**. Individual snapshots: **21455–22471 bytes**.
- Processed audit evidence: **13 JSON files, 934476 bytes**.
- Raw location: `science/decode/raw/geos_fp/YYYY/MM/DD/<original filename>`. The old August source remains at its original path and shares the dated file through a verified hardlink; it is not counted twice.
- No source requests are missing; no partial raw transfers remain.

| Season | Verified snapshots | Covered months |
|---|---:|---|
| winter-2024-2025 | 3 | 2024-12, 2025-01, 2025-02 |
| spring-2025 | 3 | 2025-03, 2025-04, 2025-05 |
| summer-2025 | 4 | 2025-06, 2025-07, 2025-08 |
| autumn-2025 | 3 | 2025-09, 2025-10, 2025-11 |

## Original NASA granules actually present and verified

| Original NASA filename | Bytes |
|---|---:|
| `GEOS.fp.asm.tavg3_2d_aer_Nx.20241215_1930.V01.nc4` | 121022875 |
| `GEOS.fp.asm.tavg3_2d_aer_Nx.20250115_1930.V01.nc4` | 121001899 |
| `GEOS.fp.asm.tavg3_2d_aer_Nx.20250215_1930.V01.nc4` | 121087510 |
| `GEOS.fp.asm.tavg3_2d_aer_Nx.20250315_1930.V01.nc4` | 120442933 |
| `GEOS.fp.asm.tavg3_2d_aer_Nx.20250415_1930.V01.nc4` | 120993875 |
| `GEOS.fp.asm.tavg3_2d_aer_Nx.20250515_1930.V01.nc4` | 120684083 |
| `GEOS.fp.asm.tavg3_2d_aer_Nx.20250615_1930.V01.nc4` | 121460313 |
| `GEOS.fp.asm.tavg3_2d_aer_Nx.20250715_1930.V01.nc4` | 121379980 |
| `GEOS.fp.asm.tavg3_2d_aer_Nx.20250815_1930.V01.nc4` | 121857054 |
| `GEOS.fp.asm.tavg3_2d_aer_Nx.20250819_1930.V01.nc4` | 121678028 |
| `GEOS.fp.asm.tavg3_2d_aer_Nx.20250915_1930.V01.nc4` | 121806397 |
| `GEOS.fp.asm.tavg3_2d_aer_Nx.20251015_1930.V01.nc4` | 121350179 |
| `GEOS.fp.asm.tavg3_2d_aer_Nx.20251115_1930.V01.nc4` | 120681620 |

Each exact download URL, local path, SHA256, actual temporal support, dimensions, variable attributes, native coverage, product/version, processed file and status is in [the source manifest](../science/decode/manifests/dust-sources.json). The [generated inventory](../science/decode/dust-inventory.md) links the original NASA URLs.

## Assets and integration

- 1,000-cell geometry: `web/assets/decode/dust-v2/grid.json`.
- Snapshot outputs: `web/assets/decode/dust-v2/snapshots/<snapshot-id>.json` (one per granule listed above).
- Selected-period differences: `web/assets/decode/dust-v2/comparisons/` (April 15→July 15 and July 15→October 15).
- Catalog: `web/assets/decode/dust-v2/catalog.json`.
- Data module: `web/sources/decode/dust-visual.js` exports `loadDustCatalog`, `loadDustGrid`, `loadDustSnapshot`, `loadDustComparison`, `getDustCells`, and `compareDustSnapshots`, plus schema validators.
- Region: north 45, south 15, west -20, east 50. Grid: 25×40, spherical native-cell partial-overlap aggregation. Data stay separate from DecodeCase v2.
- Complete schemas, M4/M6 Canvas/WebGL integration, missing-value rules, projection assumptions, safe restoration and resume commands: [dust-v2-data.md](dust-v2-data.md).

## Actual verification results

| Command | Actual result |
|---|---|
| `python -B science/decode/scripts/dust_archive.py verify` | PASS, all 13 raw SHA256/size/metadata checks |
| `python -B science/decode/scripts/dust_process.py --check` | PASS, all 13 snapshots, processed outputs, grid, catalog and comparisons reproduced |
| `python -B science/decode/scripts/test_dust_v2.py` | PASS, 16 tests |
| `python -B science/decode/test_extract_dust.py` | PASS, 6 tests |
| `python science/decode/extract_dust.py --check` | PASS, original production JSON and provenance reproduced |
| `npm test` | PASS, 35 tests, 0 failures, 0 skipped |
| `dust_archive.py acquire --phase all --max-files 0 --max-bytes 0 --dry-run` | PASS, 0 pending files, 0 download bytes; no duplicate transfers needed |
| Git scope and ignore checks | PASS; raw, environments, caches and temporary files ignored; protected files unchanged; no staged changes |

Python commands used the existing documented interpreter `science/decode/.python/python.exe`. Numerical tests included actual source hashes and an independently calculated scalar first-cell overlap, along with explicitly synthetic unit buffers for conservation, missing values, resume, byte caps, atomic promotion and writer locking.

The preserved original production JSON SHA256 is `7f71da5fe3b10af60e6e78f169d2a68578f67d5d33c4717b1bc047023b5ca582`; the shared DecodeCase validator and 3×4/6×8 modes pass unchanged.

## Scientific caveats and remaining work

- These are sparse selected three-hour snapshots, not daily/monthly averages, full seasonal means, climatology or trends. No seasonal-average layers are generated.
- December–February report the literal source build `GEOSadas-5_29_5-p6`; March–November (including August 19) report `GEOSadas-5_29_5-p6-SLES15`, both with experiment `f5295_fp`. Declared product/release/variable/units/grid were verified, but build numerical equivalence is unproven. Catalog groups retain this difference; cross-build comparisons and averages are blocked.
- January→April pilot comparison is unavailable for that scientific compatibility reason. The two same-build pilot comparisons are published; the API supports any compatible selected pair.
- Native cell footprints are inferred by half spacing, not supplied bounds. Spherical area weighting preserves overlap contributions without inventing resolution. Any invalid contributor yields missing; genuine zero is retained.
- The source declares geographic degrees without an explicit native datum. Geographic display follows the existing contract convention, without a datum transformation or a new native-WGS84 claim.
- Only August 19 carries the actual SVS 5669 context image URL with RELATED_CONTEXT. No other season reuses that frame as matching imagery; pixels are not numerical evidence.
- No acquisition or resource blockers remain. M4/M6 renderer/application wiring and optional denser scientifically reviewed sampling remain separate work.

## Exact files added or updated

Two existing M1 files were updated: `docs/decode-data.md` (link to V2) and `science/decode/.gitignore` (ignore atomic scratch files). All other listed files are additions. Raw binaries are intentionally absent from this Git-visible list.

- `docs/decode-data.md`
- `docs/dust-v2-data.md`
- `docs/dust-v2-results.md`
- `science/decode/.gitignore`
- `science/decode/dust-inventory.md`
- `science/decode/manifests/dust-sampling-plan.json`
- `science/decode/manifests/dust-sources.json`
- `science/decode/processed/dust/geos-fp-dust-20241215-1930.json`
- `science/decode/processed/dust/geos-fp-dust-20250115-1930.json`
- `science/decode/processed/dust/geos-fp-dust-20250215-1930.json`
- `science/decode/processed/dust/geos-fp-dust-20250315-1930.json`
- `science/decode/processed/dust/geos-fp-dust-20250415-1930.json`
- `science/decode/processed/dust/geos-fp-dust-20250515-1930.json`
- `science/decode/processed/dust/geos-fp-dust-20250615-1930.json`
- `science/decode/processed/dust/geos-fp-dust-20250715-1930.json`
- `science/decode/processed/dust/geos-fp-dust-20250815-1930.json`
- `science/decode/processed/dust/geos-fp-dust-20250819-1930.json`
- `science/decode/processed/dust/geos-fp-dust-20250915-1930.json`
- `science/decode/processed/dust/geos-fp-dust-20251015-1930.json`
- `science/decode/processed/dust/geos-fp-dust-20251115-1930.json`
- `science/decode/scripts/dust_archive.py`
- `science/decode/scripts/dust_common.py`
- `science/decode/scripts/dust_process.py`
- `science/decode/scripts/test_dust_v2.py`
- `tests/dust-visual-data.test.mjs`
- `web/assets/decode/dust-v2/.gitignore`
- `web/assets/decode/dust-v2/catalog.json`
- `web/assets/decode/dust-v2/comparisons/geos-fp-dust-20250415-1930--to--geos-fp-dust-20250715-1930.json`
- `web/assets/decode/dust-v2/comparisons/geos-fp-dust-20250715-1930--to--geos-fp-dust-20251015-1930.json`
- `web/assets/decode/dust-v2/grid.json`
- `web/assets/decode/dust-v2/snapshots/geos-fp-dust-20241215-1930.json`
- `web/assets/decode/dust-v2/snapshots/geos-fp-dust-20250115-1930.json`
- `web/assets/decode/dust-v2/snapshots/geos-fp-dust-20250215-1930.json`
- `web/assets/decode/dust-v2/snapshots/geos-fp-dust-20250315-1930.json`
- `web/assets/decode/dust-v2/snapshots/geos-fp-dust-20250415-1930.json`
- `web/assets/decode/dust-v2/snapshots/geos-fp-dust-20250515-1930.json`
- `web/assets/decode/dust-v2/snapshots/geos-fp-dust-20250615-1930.json`
- `web/assets/decode/dust-v2/snapshots/geos-fp-dust-20250715-1930.json`
- `web/assets/decode/dust-v2/snapshots/geos-fp-dust-20250815-1930.json`
- `web/assets/decode/dust-v2/snapshots/geos-fp-dust-20250819-1930.json`
- `web/assets/decode/dust-v2/snapshots/geos-fp-dust-20250915-1930.json`
- `web/assets/decode/dust-v2/snapshots/geos-fp-dust-20251015-1930.json`
- `web/assets/decode/dust-v2/snapshots/geos-fp-dust-20251115-1930.json`
- `web/sources/decode/dust-visual.js`

## Reproduce from existing raw files

```powershell
$dustPython = '.\science\decode\.python\python.exe'
& $dustPython -B science/decode/scripts/dust_archive.py inventory
& $dustPython -B science/decode/scripts/dust_archive.py verify
& $dustPython -B science/decode/scripts/dust_process.py --check
& $dustPython -B science/decode/scripts/test_dust_v2.py
& $dustPython -B science/decode/test_extract_dust.py
& $dustPython science/decode/extract_dust.py --check
npm test
```

For restoration or additional bounded discovery/acquisition, use the explicit pilot/monthly and per-date resume commands in [the integration/workflow guide](dust-v2-data.md).
