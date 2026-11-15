# Data provenance (spec 09.2 manifest)

Generated from the verified package `deliverables/EarthPulse-JSON-ONLY` (every file checked against the master catalog sha256) on 2026-11-15 by `scripts/earth-map/provenance.mjs`. The same data are in `provenance.json`. All data are NASA GMAO GEOS-FP **model** output.

## dust (`geos-fp-dust-sampled-2025`)

| Field | Value |
|---|---|
| datasetId | geos-fp-dust-sampled-2025 |
| phenomenon | dust |
| eicVisualizationUrl | https://svs.gsfc.nasa.gov/5669/ |
| sourceDatasetUrl | https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/das/ |
| sourceType | model |
| variable | DUEXTTAU, dust extinction aerosol optical depth at 550 nm |
| unit | 1 |
| timeCoverage | `{"start":"2024-12-15","end":"2025-11-15","kind":"three-hour mean","note":"13 selected snapshots (the 15th of each month 2024-12 to 2025-11, plus 2025-08-19); each is one snapshot, not a daily, monthly or seasonal average and not a climatology."}` |
| geoCoverage | `{"type":"bbox","west":-20,"east":50,"south":15,"north":45}` |
| resolution | `{"native":{"lat":0.25,"lon":0.3125},"grid":"25 x 40 cells of 1.2 x 1.75 degrees"}` |
| sampleCount | `{"snapshots":13,"cellsPerSnapshot":1000}` |
| lastVerified | 2026-11-15 |
| processingSteps | `["Read the GEOS-FP NetCDF granule (SHA-256 recorded)","Spherical area-weighted mean of the native footprints inside each 1.2 x 1.75 degree cell","Serialise as JSON with provenance; every file verified against the master catalog sha256","No further derivation"]` |
| missingPolicy | null means missing; any invalid native overlap makes the target cell missing; missing is never replaced by zero or shown as no change (0 missing cells in this release). |
| qualityFlags | `["model output, not a direct observation","different literal model build labels are not comparable (differences and Echo blocked across them)","native footprints inferred from regular coordinate centres; no explicit datum declaration"]` |
| licenseAndCredit | Data: NASA GMAO GEOS-FP. Earth imagery: NASA Earth Observatory Blue Marble. No NASA logo; EARTHPULSE is a student project and is not endorsed by NASA. |
| assetHash | master catalog sha256 per file; 18 files; catalog 3094068c7ef557f430e0f77c03ad3da5e9f88218d2a83b5160e012d5cdd32a8b; each snapshot hash is in `provenance.json` |
| eicRelation | RELATED_CONTEXT for 2025-08-19 only: a separate GEOS-FP 2 km Replay at 20:00 UTC; not registered numeric pixels; never drawn on the map. |
| sourceProduct | NASA GMAO GEOS-FP DFPT3NXAER (GEOS FP 2d time-averaged primary aerosol diagnostics) (release 5.29.5) |
| buildLabels | `GEOSadas-5_29_5-p6 experiment_id: f5295_fp`; `GEOSadas-5_29_5-p6-SLES15 experiment_id: f5295_fp` |

## rainfall (`geos-fp-rainfall-sampled-2025`)

| Field | Value |
|---|---|
| datasetId | geos-fp-rainfall-sampled-2025 |
| phenomenon | rainfall |
| eicVisualizationUrl | https://svs.gsfc.nasa.gov/4285/ |
| sourceDatasetUrl | https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/das/ |
| sourceType | model |
| variable | PRECTOT (total precipitation rate) and derived one-hour accumulation in mm |
| unit | kg m-2 s-1; derived one-hour accumulation mm |
| timeCoverage | `{"start":"2024-12-15","end":"2025-11-15","kind":"one-hour mean","note":"13 selected snapshots (the 15th of each month 2024-12 to 2025-11, plus 2025-08-19); each is one snapshot, not a daily, monthly or seasonal average and not a climatology."}` |
| geoCoverage | `{"type":"bbox","west":-20,"east":50,"south":15,"north":45}` |
| resolution | `{"native":{"lat":0.25,"lon":0.3125},"grid":"25 x 40 cells of 1.2 x 1.75 degrees"}` |
| sampleCount | `{"snapshots":13,"cellsPerSnapshot":1000}` |
| lastVerified | 2026-11-15 |
| processingSteps | `["Read the GEOS-FP NetCDF granule (SHA-256 recorded)","Spherical area-weighted mean of the native footprints inside each 1.2 x 1.75 degree cell","Serialise as JSON with provenance; every file verified against the master catalog sha256","Derive one-hour accumulation = PRECTOT x 3600 s"]` |
| missingPolicy | null means missing; any invalid native overlap makes the target cell missing; missing is never replaced by zero or shown as no change (0 missing cells in this release). |
| qualityFlags | `["model output, not a direct observation","different literal model build labels are not comparable (differences and Echo blocked across them)","native footprints inferred from regular coordinate centres; no explicit datum declaration"]` |
| licenseAndCredit | Data: NASA GMAO GEOS-FP. Earth imagery: NASA Earth Observatory Blue Marble. No NASA logo; EARTHPULSE is a student project and is not endorsed by NASA. |
| assetHash | master catalog sha256 per file; 15 files; catalog 6561e07702e245e2c22b498eea4956111a5f1fd21e8a94c0331ba62dfe1cc359; each snapshot hash is in `provenance.json` |
| eicRelation | RELATED_CONTEXT: GPM IMERG is a different (satellite-derived) product; this rainfall is GEOS-FP model output. |
| sourceProduct | NASA GMAO GEOS-FP DFPT1NXFLX (GEOS FP 2d time-averaged surface flux diagnostics) (release 5.29.5) |
| buildLabels | `GEOSadas-5_29_5-p6 experiment_id: f5295_fp`; `GEOSadas-5_29_5-p6-SLES15 experiment_id: f5295_fp` |

## wind (`geos-fp-wind-sampled-2025`)

| Field | Value |
|---|---|
| datasetId | geos-fp-wind-sampled-2025 |
| phenomenon | wind |
| eicVisualizationUrl | `null` |
| sourceDatasetUrl | https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/das/ |
| sourceType | model |
| variable | U10M and V10M (10 m wind) and derived speed and meteorological direction (null for calm) |
| unit | m s-1; derived direction degree |
| timeCoverage | `{"start":"2024-12-15","end":"2025-11-15","kind":"one-hour mean","note":"13 selected snapshots (the 15th of each month 2024-12 to 2025-11, plus 2025-08-19); each is one snapshot, not a daily, monthly or seasonal average and not a climatology."}` |
| geoCoverage | `{"type":"bbox","west":-20,"east":50,"south":15,"north":45}` |
| resolution | `{"native":{"lat":0.25,"lon":0.3125},"grid":"25 x 40 cells of 1.2 x 1.75 degrees"}` |
| sampleCount | `{"snapshots":13,"cellsPerSnapshot":1000}` |
| lastVerified | 2026-11-15 |
| processingSteps | `["Read the GEOS-FP NetCDF granule (SHA-256 recorded)","Spherical area-weighted mean of the native footprints inside each 1.2 x 1.75 degree cell","Serialise as JSON with provenance; every file verified against the master catalog sha256","Derive speed and meteorological direction from the aggregated U and V (never averaged directions)"]` |
| missingPolicy | null means missing; any invalid native overlap makes the target cell missing; missing is never replaced by zero or shown as no change (0 missing cells in this release). |
| qualityFlags | `["model output, not a direct observation","different literal model build labels are not comparable (differences and Echo blocked across them)","native footprints inferred from regular coordinate centres; no explicit datum declaration"]` |
| licenseAndCredit | Data: NASA GMAO GEOS-FP. Earth imagery: NASA Earth Observatory Blue Marble. No NASA logo; EARTHPULSE is a student project and is not endorsed by NASA. |
| assetHash | master catalog sha256 per file; 15 files; catalog 11236ab9b7d7a08ad05152834baa0ed6845e713e520cc2694f824222f0aca8a7; each snapshot hash is in `provenance.json` |
| eicRelation | No EIC visualization is part of this package. |
| sourceProduct | NASA GMAO GEOS-FP DFPT1NXSLV (GEOS FP 2d time-averaged single level diagnostics) (release 5.29.5) |
| buildLabels | `GEOSadas-5_29_5-p6 experiment_id: f5295_fp`; `GEOSadas-5_29_5-p6-SLES15 experiment_id: f5295_fp` |
