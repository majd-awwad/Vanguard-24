# NASA dust source acquisition audit

Verified on **2026-11-14** for EARTHPULSE M1, repository `majD-awwad/Vanguard`, branch `feat/decode-data`.

**Production follow-up:** the acquisition-stage findings below remain the source record. The subsequent production pipeline now generates case `dust-geos-fp-20250819-1930-north-africa-med` at `web/assets/decode/data/dust-geos-fp-20250819-1930-north-africa-med.json`, using north 45, south 15, east 50, west -20 as target rectangle edges. See [`docs/decode-data.md`](../../docs/decode-data.md) for aggregation, the fixed 0.20 threshold, tests and loader integration, and [`dust-extraction.json`](dust-extraction.json) for reproducible extraction evidence. This follow-up preserves `RELATED_CONTEXT` and does not change the acquisition data or hashes. Statements below about work not yet performed describe the original acquisition stage.

## Result and scientific scope

**Acquired and inspected genuine numerical NASA GEOS-FP dust aerosol data for August 19, 2025.** The original NASA NetCDF-4/HDF5 granule is downloaded locally, its SHA256 is recorded below, and a lossless regional crop has been reopened and compared with its parent values and coordinates. No synthetic data, image-derived estimates, EARTHPULSE case, classification threshold, or lightning data were created.

This is the standard **GEOS-FP assimilation product**, at **0.25° latitude × 0.3125° longitude**, with a **three-hour mean over 18:00–21:00 UTC**, centered at **19:30 UTC**. Its interval contains the SVS image time of 20:00 UTC. It is suitable for a contextual dust extraction pipeline with these qualifications. It is **not** a numerical acquisition of the SVS 2 km Replay, and must not be presented as the exact image's values or an instantaneous 20:00 UTC field.

## Contract and ownership checks

Before investigating NASA sources, read both actual files `web/contracts/decode.d.ts` and `web/contracts/validate.js`. Both remain unchanged. All new files are under `science/decode/`. The root `.gitignore`, application entry points, package manifest, and other contributors' files remain unchanged. No commit or push was performed.

For later integration, the existing v2 contract needs a real source (`fixture: false`), an increasing UTC interval, correct provenance, and a truthful visual relationship. The validator also requires north-to-south row order, nonnegative finite values for available cells, consistent threshold statuses, and quick cells computed as means of their 2×2 advanced children. Those are future extraction requirements, not a generated case in this acquisition task.

## Official archive investigation

1. [NASA SVS 5669](https://svs.gsfc.nasa.gov/5669/) identifies its input as **GEOS-FP 2Km Replay**, dataset ID **1258**, for August 19, 2025, and describes the image time as **20:00 UTC**. It supplies images and identifies the model, but says it does not host the underlying datasets or further dataset details. The saved page is `svs-5669.html`. Its actual image link is <https://svs.gsfc.nasa.gov/vis/a000000/a005600/a005669/Aerosols_2025-08-19T20_00_00_1920x1080.png>. The image was not used to infer numbers.
2. Followed the [official NCCS GEOS-FP archive](https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/) to [`das/`](https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/das/) and the [actual August 19, 2025 listing](https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/das/Y2025/M08/D19/). Saved these as `geos-fp-index.html`, `geos-das-index.html`, and `geos-20250819-index.html`. The historical files exist and are anonymously downloadable. No publicly linked 2 km Replay numerical granule was identified in these inspected entry points; that is not a claim that no such archive exists elsewhere.
3. Inspected the actual [current primary aerosol DDS](https://opendap.nccs.nasa.gov/dods/GEOS-5/fp/0.25_deg/assim/tavg3_2d_aer_Nx.dds) and [DAS](https://opendap.nccs.nasa.gov/dods/GEOS-5/fp/0.25_deg/assim/tavg3_2d_aer_Nx.das), saved as `geos-current-aer.dds` and `geos-current-aer.das`. They expose lowercase `duexttau`, described as dust aerosol optical depth, with fill/missing values of `1e15`. The downloaded live metadata starts at **2026-02-27 01:30 UTC** and ends at **2026-11-14 07:30 UTC**; it cannot serve the requested 2025 date. Its variable DAS omits units. Consequently, neither its units nor its metadata were substituted for the historical file's own attributes.
4. Examined the smaller [instantaneous aerosol-assimilation collection DDS](https://opendap.nccs.nasa.gov/dods/GEOS-5/fp/0.25_deg/assim/inst3_2d_gas_Nx.dds), saved as `geos-current-gas.dds`. It exposes only `aodinc` and `aodana`, not dust-specific AOT. Its approximately 4.6 MiB historical granules therefore do not satisfy this task. The extended aerosol diagnostic granules in the historical listing are approximately 170 MiB; the primary aerosol granule is approximately 116 MiB.
5. Selected the **single primary-aerosol granule centered at 19:30 UTC**, rather than multiple times or the larger extended collection. No official historical geographic/variable subset endpoint was identified in the inspected interfaces. The current OPeNDAP collection lacks the date, so downloading one complete historical granule was practical. The regional derivative below is explicitly a **local crop**, not an official NASA subset download.
6. The [official GMAO production history](https://gmao.gsfc.nasa.gov/gmao-products/geos-near-real-time-data-products/), saved as `gmao-nrt-products.html`, lists **5.29.5-p6** for May 22, 2024–February 26, 2026. This corroborates the actual historical file's `Source` attribute. The historical file, rather than the newer live service, controls this audit.

**MERRA-2 fallback:** unnecessary because a usable genuine GEOS-FP dust field was obtained. No MERRA-2 file was downloaded, and no MERRA-2 values or units are asserted as inspected results.

## Downloaded original

| Field | Verified value |
| --- | --- |
| Local file | `raw/GEOS.fp.asm.tavg3_2d_aer_Nx.20250819_1930.V01.nc4` |
| Download URL | <https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/das/Y2025/M08/D19/GEOS.fp.asm.tavg3_2d_aer_Nx.20250819_1930.V01.nc4> |
| Bytes | `121678028` (approximately 116.04 MiB) |
| SHA256 | `091ab5cdfdf8f68983283d1f3909014258d75738d499bf44a5e5d87e75cb87db` |
| Product / short name | GEOS FP 2d time-averaged primary aerosol diagnostics / `DFPT3NXAER` |
| GranuleID / Filename | `GEOS.fp.asm.tavg3_2d_aer_Nx.20250819_1930.V01.nc4` |
| GMAO internal filename | `f5295_fp.tavg3_2d_aer_Nx.20250819_1930z.nc4` |
| VersionID / file revision | `5.29.5` / `V01` |
| Source | `GEOSadas-5_29_5-p6-SLES15 experiment_id: f5295_fp` |
| Generated | `2025-08-20 02:09:25 GMT`, from the file's History/ProductionDateTime |
| HTTP response | `200 OK`; Content-Length matches local bytes; headers in `geos-granule-headers.txt` |
| HTTP Last-Modified | `Wed, 20 Aug 2025 02:19:58 GMT` (separate from scientific valid time) |

SHA256 was computed in Python and independently checked with PowerShell `Get-FileHash`. It is a local integrity fingerprint, not a NASA-published checksum comparison.

## Actual in-file metadata and values

The complete machine-readable inspection is in [`inspection.json`](inspection.json), including all global attributes, variable names, storage filters, and coordinate metadata. [`inspect_source.py`](inspect_source.py) reads the actual file and regenerates that report and the regional crop.

| Field | Verified value |
| --- | --- |
| Dimensions | `time=1`, `lat=721`, `lon=1152` |
| Actual variable | **`DUEXTTAU`** (uppercase in this historical NetCDF file) |
| Type / axes | `float32`, `(time, lat, lon)` |
| long_name and standard_name | `Dust Extinction AOT [550 nm] __ENSEMBLE__` (retained verbatim; suffix not interpreted) |
| Units | **`1`**, dimensionless aerosol optical thickness |
| Latitude | `-90` through `90` degrees_north, ascending, increment `0.25` |
| Longitude | `-180` through `179.6875` degrees_east, ascending, increment `0.3125` |
| Time coordinate | `[0]`, units `minutes since 2025-08-19 19:30:00` |
| Decoded coordinate | **`2025-08-19T19:30:00Z`** |
| begin_date / begin_time / time_increment | `20250819` / `193000` / `30000` (HHMMSS: 03:00:00) |
| Actual averaging interval | **`2025-08-19T18:00:00Z`–`2025-08-19T21:00:00Z`**, from RangeBeginning/Ending attributes |
| Calendar / bounds | No calendar attribute and no time-bounds variable; standard Gregorian decoding used; interval comes from global range attributes |
| `_FillValue`, `missing_value`, `fmissing_value` | float32 `1e15`, represented exactly as `999999986991104` when converted to float64/JSON |
| `valid_range`, `vmin`, `vmax` | `[-999999986991104, 999999986991104]`, same min/max limits |
| Scale / offset | `1` / `0` |

Statistics below are calculated from the real data values after NetCDF missing/range masking and finite-value checking. Attribute limits such as `vmax` are **not** observed data extrema. There was no clipping, replacement, interpolation, or smoothing.

| Scope | Valid samples | Missing/nonfinite | Negative / zero | Actual min | Actual max | Arithmetic mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Global | 830592 | 0 | 0 / 0 | 0.0009364131838083267 | 2.195476531982422 | 0.021258588959897358 |
| Regional crop | 27225 | 0 | 0 / 0 | 0.0020747664384543896 | 2.195476531982422 | 0.17769721846016684 |

The regional minimum occurs at **34.5°N, 10.3125°W**. The maximum occurs at **26.25°N, 2.8125°W**. The reported means are unweighted diagnostic means, not area-weighted EARTHPULSE grid aggregations.

## Small local regional derivative

- File: `derived/GEOS.fp.asm.tavg3_2d_aer_Nx.20250819_1930.V01.DUEXTTAU.N15_N45.W20_E50.nc4`
- Size: **89061 bytes**; SHA256: `7b96accc8fda7341a08e4d6ddda2fa98bbddbf71d16fe458cdc274a756663118`.
- Contains only `DUEXTTAU`, `time`, `lat`, and `lon`; dimensions `(1, 121, 225)`.
- Retains coordinate centers **15–45°N, 20°W–50°E**, covering North Africa and the Eastern Mediterranean. These limits describe retained coordinate centers, not inferred native cell footprints.
- Parent indices, zero-based and inclusive: time `0`, latitude `420:540`, longitude `512:736`.
- Values and masks are preserved exactly; reopened crop values and coordinates were checked for exact equality with the parent slice. Parent granule, SHA256, URL, crop method, and original time interval are retained in its attributes. Spatial metadata and Filename identify the local derivative. Its inherited GranuleID identifies the parent, not a new NASA-issued granule.

## Exact download and inspection commands

Commands were run from the repository root in PowerShell. All NASA requests were anonymous. This is the actual successful data-download command:

```powershell
New-Item -ItemType Directory -Path science/decode/raw -Force | Out-Null
curl.exe --location --fail --silent --show-error --retry 2 --max-time 180 --dump-header science/decode/geos-granule-headers.txt --output science/decode/raw/GEOS.fp.asm.tavg3_2d_aer_Nx.20250819_1930.V01.nc4 https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/das/Y2025/M08/D19/GEOS.fp.asm.tavg3_2d_aer_Nx.20250819_1930.V01.nc4
Get-FileHash -Algorithm SHA256 -LiteralPath science/decode/raw/GEOS.fp.asm.tavg3_2d_aer_Nx.20250819_1930.V01.nc4
```

Each saved official metadata/page download used the following command shape (the loop reproduces the individually executed requests):

```powershell
$sources = @{
  'geos-fp-index.html' = 'https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/'
  'geos-das-index.html' = 'https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/das/'
  'geos-20250819-index.html' = 'https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/das/Y2025/M08/D19/'
  'geos-current-aer.dds' = 'https://opendap.nccs.nasa.gov/dods/GEOS-5/fp/0.25_deg/assim/tavg3_2d_aer_Nx.dds'
  'geos-current-aer.das' = 'https://opendap.nccs.nasa.gov/dods/GEOS-5/fp/0.25_deg/assim/tavg3_2d_aer_Nx.das'
  'geos-current-gas.dds' = 'https://opendap.nccs.nasa.gov/dods/GEOS-5/fp/0.25_deg/assim/inst3_2d_gas_Nx.dds'
  'svs-5669.html' = 'https://svs.gsfc.nasa.gov/5669/'
  'gmao-nrt-products.html' = 'https://gmao.gsfc.nasa.gov/gmao-products/geos-near-real-time-data-products/'
}
foreach ($entry in $sources.GetEnumerator()) {
  curl.exe --location --fail --silent --show-error --max-time 45 --output (Join-Path science/decode $entry.Key) $entry.Value
  if ($LASTEXITCODE -ne 0) { throw "Download failed: $($entry.Key)" }
}
```

The installed Python was MSYS UCRT Python 3.14.5, with no numerical libraries and no compatible binary netCDF4 wheel. To avoid changing project dependencies, inspection used a portable CPython plus binary dependencies entirely under the ignored `science/decode/` paths. These are the successful setup and inspection commands used (run once):

```powershell
python -m venv science/decode/.venv
curl.exe --location --fail --silent --show-error --max-time 90 --output science/decode/raw/python-3.13.9-embed-amd64.zip https://www.python.org/ftp/python/3.13.9/python-3.13.9-embed-amd64.zip
& .\science\decode\.venv\bin\python.exe -m pip install --no-cache-dir --only-binary=:all: --platform win_amd64 --python-version 3.13 --implementation cp --abi cp313 --target science/decode/.python/Lib/site-packages netCDF4
Expand-Archive -LiteralPath science/decode/raw/python-3.13.9-embed-amd64.zip -DestinationPath science/decode/.python -Force
Add-Content -LiteralPath science/decode/.python/python313._pth -Value 'Lib/site-packages'
& .\science\decode\.python\python.exe science/decode/inspect_source.py
```

Observed numerical versions: netCDF4 Python `1.7.5.1.post1`, NumPy `2.5.4`, netCDF C `4.10.1`, HDF5 `2.2.0`. `requirements.txt` pins the two direct inspection dependencies for a compatible standard Python environment; MSYS's virtualenv layout uses `bin`, unlike ordinary Windows CPython's `Scripts` layout.

## Access blockers and integration needs

**No NASA Earthdata authentication blocker exists for the acquired source. No manual browser action is required.** The first shell request was blocked by the execution sandbox's network restrictions; the same download succeeded with approved network access. Some web-reader requests timed out even though direct HTTPS downloads worked. Reading the locally installed scientific dependency directories also required execution outside the restrictive sandbox. These were local execution restrictions, not NASA login failures. No credentials or tokens were requested, read, or stored.

The nested [`science/decode/.gitignore`](.gitignore) ignores `raw/`, `derived/`, local Python environments and caches. `git check-ignore` verified the raw granule, crop and portable interpreter are excluded. The team-owned root `.gitignore` is untouched. Commit the audit, inspection code, dependency pins and compact metadata/evidence; collaborators must reacquire the ignored original and regenerate the crop. A later team integration can decide storage/hosting for derived case assets without checking the bulky raw data into git.

**Safe next step:** extract a real dust case from this verified standard GEOS-FP regional field, using its actual 18:00–21:00 UTC interval and unit `1`. Preserve the model-derived nature of the values. Use the conservative v2 `visualLink.relation: "RELATED_CONTEXT"`, with an explicit note that the numeric field is standard 0.25° × 0.3125° GEOS-FP assimilation and the SVS image is a separate 2 km Replay at 20:00 UTC. Shared GEOS branding alone does not establish identical numerical model configuration. Do not use `SAME_DATA`. An exact SVS replay extraction remains dependent on finding and validating that separate replay's numerical archive.
