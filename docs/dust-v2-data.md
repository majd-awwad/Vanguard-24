# M1 Dust V2: sampled NASA archive and 1,000-cell visualization data

This layer is separate from DecodeCase v2. The original
`dust-geos-fp-20250819-1930-north-africa-med` case, its 3×4/6×8 grids, loader,
threshold and JSON are preserved. No shared contracts or renderer/application
modules are changed. New data API: `web/sources/decode/dust-visual.js`.

## Actual inventory and coverage

The authoritative local/archive ledger is
[`science/decode/manifests/dust-sources.json`](../science/decode/manifests/dust-sources.json).
The human-readable [inventory](../science/decode/dust-inventory.md) is generated
from that ledger. Exact NASA links, byte sizes, raw SHA256, original filenames,
product/version, variable attributes and missing-value flags, actual valid times,
native coverage, processed paths, publication hashes, download/extraction status
and compatibility warnings are recorded per source. A SHA256 here is a locally
computed integrity fingerprint, not a comparison with a NASA-published digest.

The configurable [sampling plan](../science/decode/manifests/dust-sampling-plan.json)
requests the 15th of each month from **December 2024 through November 2025**,
at a nominal **19:30 UTC center**, plus the original **August 19, 2025** reference.
Pilot requests are January 15, April 15, July 15 and October 15. A request is not
proof of availability: discovery parses the actual official daily archive index,
requires an exact collection/time link, and obtains the file's HEAD metadata.
Downloaded data must pass in-file metadata/time/coordinate checks before entering
the published catalog. Missing/failed entries stay explicitly marked in the ledger
and `catalog.coverage.missingRequests`; no expected URL becomes an available asset.

Northern Hemisphere meteorological seasons are used: December 2024–February 2025
is `winter-2024-2025`, March–May is `spring-2025`, June–August is `summer-2025`,
and September–November is `autumn-2025`. `years` lists actual calendar years,
so December is under calendar year 2024 and winter season year 2025.

Every input is **a three-hour mean**, with the actual start, end and center read
from NASA's file. The selected nominal 19:30 granules cover 18:00–21:00 UTC.
One selected date per month is not a daily average, monthly average, full seasonal
average or climatology. No season-mean layers are generated. A season selection
enumerates its sampled snapshots; it does not imply temporal coverage between them.

## Physical and build compatibility

Inputs are NASA GEOS-FP `DFPT3NXAER`, variable `DUEXTTAU`, dust extinction AOT
at 550 nm, dimensionless unit `1`; regular native grid 0.25° latitude × 0.3125°
longitude. The inspected release is 5.29.5-p6. Two literal `Source` build labels
were observed in real files:

- `GEOSadas-5_29_5-p6 experiment_id: f5295_fp`
- `GEOSadas-5_29_5-p6-SLES15 experiment_id: f5295_fp`

Both have the same declared product, release/patch, variable, units and native
coordinates. The metadata suffix difference is retained, **not normalized away**.
Numerical equivalence of the builds has not been established. Each snapshot can
be viewed separately; catalogs expose `compatibilityGroups`. Cross-build temporal
differences and averages are disabled. Unknown products, variables, grids, units
or model versions are rejected from publication. No MERRA-2 is mixed into this set.

This decision followed an actual pilot check that initially rejected the January
build. Compatibility policy was updated only after its unchanged SHA256 and all
factual metadata were reverified (`verify --refresh-compatibility`); source bytes
were not changed. That flag cannot accept changed bytes or changed factual metadata.

## Raw archive and restore

```
science/decode/raw/geos_fp/YYYY/MM/DD/<original NASA filename>
science/decode/processed/dust/<snapshot-id>.json
science/decode/manifests/dust-sources.json
science/decode/manifests/dust-sampling-plan.json
science/decode/scripts/dust_common.py
science/decode/scripts/dust_archive.py
science/decode/scripts/dust_process.py
```

`raw/` is ignored by the M1-local `science/decode/.gitignore`; the shared root
ignore file is unchanged. Raw NetCDF, index snapshots, `.part`/resume state files,
environments and caches must never be added to Git. No commit or push is performed
by these tools. Processed evidence JSON, small manifests, scripts, tests, docs and
web JSON are intended to be versioned. Atomic `*.tmp` files are ignored.

The original August 19 raw path remains intact for the existing extractor. Its
dated archive location is created as a **hardlink** where supported, otherwise a
verified copy. Unique source-byte totals do not count that alias twice. Never edit
either raw path in place: integrity is rechecked before processing. To restore on
another computer, obtain the small versioned files, install
`science/decode/requirements.txt` in a compatible Python environment, run discovery,
inspect the printed budget, then acquire. Existing recorded SHA256 values are
enforced on restoration. If NASA has replaced a file with different bytes, the
utility stops rather than silently changing the dataset. When the original legacy
path is absent, the dated reference can still be restored; to run the old extractor,
copy or hardlink the verified August 19 dated file back to its documented legacy path.

Exact full-archive restore commands, after installing the numerical dependencies:

```powershell
$dustPython = '.\science\decode\.python\python.exe'
& $dustPython -B science/decode/scripts/dust_archive.py discover
& $dustPython -B science/decode/scripts/dust_archive.py acquire --max-files 13 --max-bytes 1700000000 --dry-run
& $dustPython -B science/decode/scripts/dust_archive.py acquire --max-files 13 --max-bytes 1700000000
& $dustPython -B science/decode/scripts/dust_archive.py verify
$legacyDust = 'science/decode/raw/GEOS.fp.asm.tavg3_2d_aer_Nx.20250819_1930.V01.nc4'
if (-not (Test-Path -LiteralPath $legacyDust)) {
  New-Item -ItemType HardLink -Path $legacyDust -Target 'science/decode/raw/geos_fp/2025/08/19/GEOS.fp.asm.tavg3_2d_aer_Nx.20250819_1930.V01.nc4' | Out-Null
}
& $dustPython -B science/decode/scripts/dust_process.py
& $dustPython science/decode/extract_dust.py --check
```

If hardlinks are unsupported, copy that same verified dated source to the absent
legacy path instead. Never overwrite an existing legacy source. On a standard
Python environment, replace the interpreter variable with its Python executable.

## Bounded acquisition workflow

Commands below use the existing portable Windows numerical interpreter; substitute
`python` on a compatible installation. They run from the repository root.

```powershell
$dustPython = '.\science\decode\.python\python.exe'
& $dustPython -B science/decode/scripts/dust_archive.py init
& $dustPython -B science/decode/scripts/dust_archive.py discover --phase pilot
& $dustPython -B science/decode/scripts/dust_archive.py acquire --phase pilot --max-files 4 --max-bytes 650000000 --dry-run
& $dustPython -B science/decode/scripts/dust_archive.py acquire --phase pilot --max-files 4 --max-bytes 650000000
& $dustPython -B science/decode/scripts/dust_process.py
# Proceed after the actual pilot validates:
& $dustPython -B science/decode/scripts/dust_archive.py discover --phase monthly
& $dustPython -B science/decode/scripts/dust_archive.py acquire --phase monthly --max-files 8 --max-bytes 1100000000 --dry-run
& $dustPython -B science/decode/scripts/dust_archive.py acquire --phase monthly --max-files 8 --max-bytes 1100000000
& $dustPython -B science/decode/scripts/dust_process.py
```

Discovery inspects public NASA listings and HEAD metadata. Acquisition requires
those discovered links and a known positive Content-Length no greater than 160 MB
per file. Defaults permit only one file/160 MB. Batch count, summed full-file
size and free disk are checked before transfer, retaining a 1 GiB free-space
reserve. Transfers are serial. `--max-bytes` additionally bounds payload bytes
read by a run, including retries; full-file estimates conservatively ignore bytes
already present in a partial. The pilot's discovered transfer total was
484,725,933 bytes; the eight monthly additions were 969,042,785 bytes. These are
observed HEAD sizes, not generic estimates. Restore all 13 with explicit limits
such as `--max-files 13 --max-bytes 1700000000` after rediscovery.

An existing verified file is SHA256/metadata checked and not downloaded again.
Interrupted transfers remain `.part`, accompanied by URL, length, ETag and
Last-Modified identity. Resume uses `Range` and `If-Range` and checks Content-Range.
If the server ignores Range with HTTP 200, the partial is safely restarted rather
than concatenated. No uncertain partial is appended when both server validators
are missing. Changed remote identity requires rediscovery. A completed file must
pass size, any recorded SHA256, real NetCDF metadata, geometry and time checks
before atomic promotion. Failures remain transparent in the manifest; usable
verified outputs are preserved. No authentication or credentials are automated.

Resume a failed/interrupted date without redownloading completed dates:

```powershell
& $dustPython -B science/decode/scripts/dust_archive.py discover --date 2025-02-15
& $dustPython -B science/decode/scripts/dust_archive.py acquire --date 2025-02-15 --max-files 1 --max-bytes 160000000
& $dustPython -B science/decode/scripts/dust_process.py
```

For denser sampling, copy/edit the M1 sampling-plan JSON: add canonical ISO dates
and UTC `HH:MM` centers, assign `phase: "monthly"`, then pass `--plan <path>` to
the archive commands. Multiple three-hour centers per day and additional dates
are supported only when actually discovered. Re-run `init` to register additions;
it preserves previously recorded source entries. Always size a batch explicitly.

## Spatial aggregation

Production visualization edges: **north 45, south 15, west −20, east 50**.
Grid: **25 rows × 40 columns = 1,000 cells**, each 1.2° latitude × 1.75° longitude.
The region covers North Africa and the Eastern Mediterranean. This is a coarser
aggregation of native model values, not 1,000 independent high-resolution
observations, and no image interpolation or added physical resolution is used.

Regional source centers retained in memory are 15–45°N, 20°W–50°E, original
indices lat 420:540 and lon 512:736 inclusive (121×225). Native footprints are
inferred at center ± half the regular spacing, because no native cell-bounds
variable is supplied. Footprints are clipped at **both** outer region edges and
every 1.2°/1.75° target edge. A sample straddling a target edge contributes its
correct fractional area to each adjoining rectangle. At each target:

`w = radians(east-west) * (sin(radians(north)) - sin(radians(south)))`

`AOT = sum(native_AOT * w) / sum(w)`

The spherical radius cancels. Coverage weights must sum to the target's full
spherical solid angle. NetCDF missing/fill/valid-range flags and scaling are
honored. Any positively overlapping masked, nonfinite or negative contributor
makes the target null; missing is never replaced with zero and partial valid
coverage is never renormalized. Actual zero stays available. No threshold is
applied to this visualization layer. The original game's fixed 0.20 threshold
and Quick/Advanced aggregation remain independent.

Processed JSON retains the exact snapshot plus 1,000 overlap areas, weighted
numerators, source contributor counts, invalid counts, regional input statistics,
source indices, raw path and scientific library versions. It is sufficient to
audit each target mean against the raw file, without storing raw arrays in web assets.

## Web asset schemas and API

Root: `web/assets/decode/dust-v2/`.

| Schema | Asset | Contents |
|---|---|---|
| `earthpulse.dust-grid/1` | `grid.json` | Shared 1,000 cells: row, col, lat, lon, per-cell north/south/east/west rectangle; fixed outer extent and projection note |
| `earthpulse.dust-snapshot/1` | `snapshots/<id>.json` | 1,000 row-major AOT values/nulls; exact source, raw SHA256, time/season, variable/unit, native resolution, method and optional dated imagery |
| `earthpulse.dust-catalog/1` | `catalog.json` | Actual calendar years, seasons, dates, intervals, asset URLs/hashes/sizes, availability, missing requests, compatibility groups and comparisons |
| `earthpulse.dust-comparison/1` | `comparisons/<id>.json` | Second minus first for two explicitly selected compatible three-hour means; signed differences/nulls, both source times and hashes |

Geometry is stored once, avoiding duplication across dates. `values[row*40+col]`
is either a finite nonnegative AOT or null. Snapshot status is derived unambiguously
as `available`/`missing`. Comparisons can be negative; null propagates if either
input is missing. Every cell inherits its parent snapshot time or comparison
periods through a temporal reference. `getDustCells()` materializes all requested
per-cell fields for tooltips or SVG: `row`, `col`, `lat`, `lon`, `bounds`, `value`,
`status`, `temporalRef`, `sourceTime`. All source and payload SHA256 values in web
catalogs are for UTF-8/LF JSON; raw binary hashes are byte-for-byte. Loaders validate
schemas/geometry/provenance/time/compatibility; raw integrity and artifact digest
checks are performed by the reproducibility commands/tests, not claimed as an
automatic cryptographic browser verification.

```js
import {
  loadDustCatalog, loadDustGrid, loadDustSnapshot, loadDustComparison,
  getDustCells, compareDustSnapshots,
} from './sources/decode/dust-visual.js';

const catalog = await loadDustCatalog();
const grid = await loadDustGrid();
const season = catalog.seasons.find(s => s.key === 'spring-2025');
const selected = await loadDustSnapshot(season.snapshotIds[0]);
const cells = getDustCells(selected, grid);
// cells now contains the full 1,000 geographic rectangles and per-cell values.
// Display selected.time.start/end and its sparse-sampling warning.

const pair = catalog.comparisons[0];
const delta = await loadDustComparison(pair.id);
const differenceCells = getDustCells(delta, grid);
// Or compare two selected snapshots with compareDustSnapshots(a, b).
// It rejects differing literal model build labels.
```

Every load function accepts `{baseUrl: URL|string}` for an alternate data
directory. Relative defaults resolve from the data module, so deployment under
a path prefix is supported. IDs are restricted to safe filename stems; HTTP,
JSON, schema, time and identity failures reject. There is no mutable shared cache.

For Canvas or WebGL, read the shared grid and upload `values` as a scalar buffer
plus a separate null/missing mask (do not turn null into zero). Use cell **corners**
for map rectangles and centers for labels/tooltips. Row 0 is north and column 0
is west, including RTL pages. In plate carrée for a viewport `(W,H)`:

`x = (lon + 20) / 70 * W`, `y = (45 - lat) / 30 * H`.

For Web Mercator, project each rectangle's corners using the map library; do not
pretend equal latitude spacing means equal pixel height. Source metadata declares
geographic degrees without an explicit datum. The display uses the existing
geographic contract's WGS84 convention, without asserting a native WGS84 declaration
or applying a datum conversion. M4/M6 own projection/rendering, controls, color
legend, missing-data treatment and application wiring. Color values consistently
across dates; show actual time support and build warnings. No shared GUI is added.

Only the original **August 19** reference snapshot includes the SVS 5669 image,
with **RELATED_CONTEXT** and an explicit note that it is a separate 2 km Replay
at 20:00 UTC. Other dates have `visualLink: null`. That frame is never presented
as another season's imagery or registered numeric pixels. Numeric values never
come from image colors.

## Verification and inventory commands

```powershell
& $dustPython -B science/decode/scripts/dust_archive.py inventory
& $dustPython -B science/decode/scripts/dust_archive.py verify
& $dustPython -B science/decode/scripts/dust_process.py --check
& $dustPython -B science/decode/scripts/test_dust_v2.py
& $dustPython -B science/decode/test_extract_dust.py
& $dustPython science/decode/extract_dust.py --check
npm test
```

The Python tests use synthetic in-memory arrays/temporary buffers solely for
math and transport unit checks, plus genuine raw-file checks for actual source
hashes/metadata and an independent scalar first-cell calculation. Node tests
need only the small versioned JSON: they validate geometry, actual published
source links and artifact digests, temporal/season membership, compatibility,
loader errors, adapter semantics and the unchanged original DecodeCase. Full
raw reproduction intentionally requires restoring the local NASA archive.

The raw manifest and inventory are updated atomically after each source. Web
and processed files are individually atomic; catalog publication occurs last.
An OS-held writer lock rejects simultaneous acquisition/processing commands and
is released automatically even after a process exits unexpectedly. During a batch
the last published catalog may lag acquisition; regenerate
after completion. Failed/unpublished entries are never advertised as available.
An interrupted run can leave unlisted old assets on disk; the catalog, not a
directory wildcard, determines available data.
