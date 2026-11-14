# M1 production NASA dust data

The production case is **`dust-geos-fp-20250819-1930-north-africa-med`**, in
[`web/assets/decode/data/dust-geos-fp-20250819-1930-north-africa-med.json`](../web/assets/decode/data/dust-geos-fp-20250819-1930-north-africa-med.json).
It is a genuine model-derived field (`fixture: false`), not a synthetic fixture or direct satellite retrieval.

## Source and geographic extent

- Product: NASA GEOS-FP `DFPT3NXAER`, standard assimilation, GEOSadas 5.29.5-p6 / file revision V01.
- Granule: `GEOS.fp.asm.tavg3_2d_aer_Nx.20250819_1930.V01.nc4`.
- Variable: `DUEXTTAU`, Dust Extinction AOT at 550 nm, dimensionless unit `1`.
- Scientific interval: **2025-08-19T18:00:00Z–2025-08-19T21:00:00Z**, a three-hour mean centered at **19:30 UTC**.
- Production edges: **north 45, south 15, east 50, west -20**, covering North Africa and the Eastern Mediterranean.
- Advanced: **6 rows × 8 columns**, 5° latitude × 8.75° longitude per cell.
- Quick: **3 rows × 4 columns**, 10° latitude × 17.5° longitude per cell.
- Row 0 is north; column 0 is west in both Arabic and English. Coordinates stored in cells are geometric rectangle centers, not plume centroids or selected native sample locations.

The source native grid is 0.25° latitude × 0.3125° longitude. Its coordinate metadata declares `degrees_north` and `degrees_east`, without an explicit WGS84/EPSG identifier. The production grid uses the shared contract's WGS84 geographic convention with no datum transformation. This does not establish a native-source datum declaration.

The production outer edges now use the same numerical limits as the inspected source-center crop. The original inspection described **retained coordinate centers**, not native footprints; extraction explicitly clips inferred native footprints to the requested production edges. It reads the audited original NetCDF, not the crop or an image.

Full acquisition details and exact NASA download URL: [`science/decode/source-audit.md`](../science/decode/source-audit.md).
Original SHA256: `091ab5cdfdf8f68983283d1f3909014258d75738d499bf44a5e5d87e75cb87db`.
The extractor refuses different source bytes, variable metadata, coordinates, or time.

## Native-to-Advanced aggregation

Treat each native AOT value as constant over its inferred regular geographic footprint: latitude center ±0.125°, longitude center ±0.15625°. These footprints are an explicit midpoint assumption because the granule supplies no native cell bounds.

For every Advanced rectangle, intersect the native footprints with that rectangle and compute:

`mean = sum(AOT_i * w_i) / sum(w_i)`

`w_i = radians(overlap_east - overlap_west) * (sin(overlap_north) - sin(overlap_south))`

Angles inside `sin` are in radians. Weights are spherical solid angles; a common radius cancels. Verify their sum against the full target rectangle's area. Values on target edges contribute proportionally to both adjacent rectangles. This avoids latitude bias from an unweighted native-sample mean and avoids counting whole edge footprints outside the region. No clipping of AOT, contrast enhancement, normalization, interpolation, or rounding is applied.

NetCDF4 applies `_FillValue`, `missing_value`, `valid_range`, `scale_factor`, and `add_offset`. If any positively overlapping contributor is masked, nonfinite, or negative, the entire Advanced cell becomes `value: null`, `status: "missing"`. An uncovered target rectangle aborts extraction. Missing values are never replaced with zero; actual zero is valid.

## Quick aggregation and truth

Each Quick value is the arithmetic mean of its four Advanced children in northwest, northeast, southwest, southeast order, dividing each child by four before summation as in Majd's validator. If **any** child is missing, the parent is missing. Quick is not recomputed directly from native samples and is not an area-weighted mean of those four children; this follows the frozen contract exactly.

Both levels use **`value >= 0.20`**. This fixed educational cutoff identifies appreciable modeled dust-column extinction at 550 nm. It was set before calculating the aggregated grids, not fitted to a desired number or arrangement of positive cells. Optical depth 0.20 corresponds to `exp(-0.20) ≈ 0.8187` direct-beam transmission through the dust column on a vertical path (about 18.1% attenuation from dust alone). It does not represent a surface concentration or an air-quality/health threshold.

[NASA's AOD explanation](https://science.nasa.gov/earth/earth-observatory/global-maps/aerosol-optical-depth/) gives general optical-depth context, including very clear conditions below 0.1 and very hazy conditions around 1. Those examples concern total aerosol AOD. **NASA does not prescribe this project's 0.20 dust-specific cutoff.** Below-threshold cells can still contain dust; `truth.present` means the project's numerical rule is satisfied, not that dust is physically absent elsewhere.

For each level, `truth.present` is generated from its own available cell values. Status is `measured` at/above 0.20, `below_threshold` below it, and `missing` only for unavailable values. The contract word `measured` does not turn model values into direct observations. No `eventCount` is emitted for continuous dust.

The current extraction produces **18/48 Advanced** and **5/12 Quick** positive cells, with zero missing cells at either level. These counts are outputs of the rule, not selection targets.

## SVS relationship

The case explicitly declares **`visualLink.relation: "RELATED_CONTEXT"`**. Its linked [SVS 5669 image](https://svs.gsfc.nasa.gov/5669/) uses a separate **GEOS-FP 2 km Replay at 20:00 UTC**. Our standard-resolution assimilation three-hour mean is different in configuration, grid, and temporal support. Neither numeric identity nor pixel registration with the image is claimed. The SVG/grid renderer must use the production bounds and geometric cell centers; overlaying the full SVS image as if it were this numeric grid would be misleading.

## Reproduce and validate

No acquisition is performed by the pipeline. Keep the original NetCDF in the ignored `science/decode/raw/` directory. Use the numerical environment already documented in the source audit, or install `science/decode/requirements.txt` into a compatible Python environment. Node must be on PATH because the extractor invokes the existing shared validator before writing outputs.

From the repository root in PowerShell:

```powershell
& .\science\decode\.python\python.exe science/decode/extract_dust.py
& .\science\decode\.python\python.exe science/decode/extract_dust.py --check
& .\science\decode\.python\python.exe -B science/decode/test_extract_dust.py
node --test tests/decode-data.test.mjs
npm test
```

On standard Python with the required numerical libraries, substitute `python` for the portable interpreter path. The local restricted execution sandbox may require approved access to the already installed libraries; this is not a NASA authentication step.

The extractor writes the production JSON and [`science/decode/dust-extraction.json`](../science/decode/dust-extraction.json). The sidecar records raw SHA256, output SHA256 (UTF-8/LF), source interval, threshold rationale, methods, per-cell overlap areas/numerators, source indices, invalid counts, software versions and output statistics. `--check` recomputes from the real NetCDF and compares both outputs without writing; it tolerates checkout newline conversion through text-mode reading.

Numerical unit tests exercise weighted means, boundary splitting, invalid/missing propagation, genuine zero handling, partial coverage rejection, inclusive thresholding and Quick's exact child grouping using explicitly synthetic arrays in memory. They do not write synthetic NASA assets. Node tests validate the committed production asset/provenance, geometry, truth, child means and loader failure paths. `npm test` needs neither the ignored raw file nor Python scientific dependencies; source-level reproduction and numerical tests are separate commands above.

## Loader integration

```js
import { loadDecodeCase } from "./sources/decode/index.js";
const data = await loadDecodeCase("dust-geos-fp-20250819-1930-north-africa-med");
// Optional alternate asset directory:
const alternate = await loadDecodeCase(data.id, { baseUrl: new URL("https://example.org/cases/") });
```

The loader fetches `<id>.json` from `web/assets/decode/data/` relative to its module. `baseUrl` can be a directory URL or string (a missing trailing slash is added); relative strings resolve against the loader module. IDs must contain only letters, digits, underscores or hyphens, beginning with a letter or digit. HTTP errors, invalid JSON, invalid v2 data and requested/returned ID mismatches reject the promise. Validation always uses `web/contracts/validate.js` without modifying it. The loader does not cache mutable objects or perform UI wiring.

The existing build copies the entire `web/` tree, so the asset and module require no build-script changes. Production JSON, extractor, evidence and tests can enter git; the 121 MB raw input and local environments remain ignored. No shared contracts, package manifest, HTML, application/session/audio/visual files, or other contributors' files are changed by this module.
