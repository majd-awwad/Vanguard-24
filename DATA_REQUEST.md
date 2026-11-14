# Data intake for EarthPulse

## Earth Sound Studio — required to unlock quantitative radiance

Create a NASA Earthdata account and a temporary LAADS bearer token. Provide the
token only through the local `EARTHDATA_TOKEN` environment variable; never paste
it into source code, chat logs, JSON or frontend configuration. The bounded
importer requests exactly these official Collection 2 granules:

- 2012: <https://ladsweb.modaps.eosdis.nasa.gov/archive/allData/5200/VNP46A4/2012/001/VNP46A4.A2012001.h25v06.002.2025086172430.h5>
- 2023: <https://ladsweb.modaps.eosdis.nasa.gov/archive/allData/5200/VNP46A4/2023/001/VNP46A4.A2023001.h25v06.002.2025162080718.h5>

Run `python science/nightlights/extract_vnp46a4.py --download`. The script stores
raw HDF5 files under ignored `science/nightlights/raw/`, validates product,
metadata, fields, scale, fill and QA, and creates a compact processed bundle.
The frontend deliberately remains in labeled reference-image mode until that
output is reviewed and integrated.

The packaged Atlas, Dust Observatory, Earth Detective and GEDI V001 case need no additional data, imagery, recordings or credentials to run. The records below are optional extensions of coverage or scientific validation. The browser always uses local processed assets, so Earthdata credentials stay in the provider's login flow.

| Priority and result | Provider, exact request and expected format | Intake |
| --- | --- | --- |
| 1. Establish whether the six existing GEDI shots can be reproduced from release V002 | NASA LP DAAC `GEDI01_B.002` and `GEDI02_A.002`; candidate CMR granules [G2164347602-LPCLOUD](https://cmr.earthdata.nasa.gov/search/concepts/G2164347602-LPCLOUD.umm_json) and [G2164259609-LPCLOUD](https://cmr.earthdata.nasa.gov/search/concepts/G2164259609-LPCLOUD.umm_json), orbit O01964, track T05337, `BEAM0101`. Search 2019-04-18T08:21:45Z through 08:22:15Z and longitude −44.14 to −44.11°, latitude −13.75 to −13.72°. Request a spatially subsetted HDF5 (or full HDF5 if subsetting drops waveform data). Unsubsetted catalog sizes are approximately 3,469 MB and 2,513 MB. Subset size has not been measured. | Sign in at [Earthdata Login](https://urs.earthdata.nasa.gov/) and create a custom order in [Earthdata Search](https://search.earthdata.nasa.gov/search) following the [NASA GEDI subsetting guide](https://github.com/nasa/GEDI-Data-Resources/blob/main/guides/gedi-earthdata-search.md). Keep both files outside the checkout, for example in `../earthpulse-intake/gedi-v002/`. The current case remains at V001 until a reviewed extraction confirms the join and recomputes its comparison. |
| 2. Extend the regional dust history for a specific date or analysis window | NASA GMAO/NCCS [GEOS-FP DAS archive](https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/das/), product `DFPT3NXAER`, variable `DUEXTTAU`, file `GEOS.fp.asm.tavg3_2d_aer_Nx.YYYYMMDD_HHMM.V01.nc4` in that date's directory. Retain the North Africa–Mediterranean bounds 20°W to 50°E, 15°N to 45°N. Specify the desired UTC center before expanding the archive. The verified 2025 files for the existing regional batch ranged roughly 120–125 MB each. | Public archive, no credentials normally needed. Use the existing budgeted downloader and processor from [Dust V2 intake](docs/dust-v2-data.md#bounded-acquisition-workflow); their documented raw destination is `science/decode/raw/geos_fp/YYYY/MM/DD/`. For a new build, compare native metadata, grid, and literal model build before authorizing numerical differences. |
| 3. Verify exact imagery-to-data alignment for an historical frame | NASA SVS source evidence for [4950](https://svs.gsfc.nasa.gov/4950/), [5101](https://svs.gsfc.nasa.gov/5101/), [4285](https://svs.gsfc.nasa.gov/4285/), [5113](https://svs.gsfc.nasa.gov/5113/) or [5669](https://svs.gsfc.nasa.gov/5669/). Request the source product/version, frame timestamp and averaging window, granule identifiers, projection/extent, and shot membership or renderer registration needed for a numerical match. | Preserve the official metadata or producer’s record in `../earthpulse-intake/svs/`. Compare it with the exact case provenance before changing the current related-context labels. The JPEG and its publication page alone cannot establish matching numerical pixels. |

## Prepare the optional GEDI V002 intake

Use two files exposed by your own Earthdata session. An order may provide a ZIP with the HDF5 members and service metadata. Retain the files and the order metadata privately, without placing session URLs, tokens, or credentials in the repository.

For the L1B custom order retain the beam's `shot_number`, `delta_time`, `rxwaveform`, `rx_sample_start_index`, `rx_sample_count`, noise mean/stddev and the first/last-bin geolocation. For L2A retain the beam's `shot_number`, `delta_time`, `lat_lowestmode`, `lon_lowestmode`, `elev_lowestmode`, `rh`, `quality_flag`, `degrade_flag`, `surface_flag` and `sensitivity`. Keep dataset/group metadata. Some subsets may omit waveform indices or rebase them. Screen any candidate by the documented 1-based index and bounds before reading its waveform. If those fields are unavailable, request the complete fields or use the matching full granules. [L1B data dictionary](https://edcftp.cr.usgs.gov/project/lpdaac/GEDI_L1A-L1B/gedi_l1b_product_data_dictionary.html) · [L2A data dictionary](https://edcftp.cr.usgs.gov/project/lpdaac/GEDI_L2/gedi_l2a_product_data_dictionary.html)

```powershell
python -B science/gedi/validate_sample.py
```

The command checks the existing V001 case using the Python standard library. To reproduce the V001 extraction, install the optional scientific dependencies from `science/gedi/requirements.txt` and run `python -B science/gedi/extract_sample.py --check`. The V002 files require a separate extraction. Confirm their version and granule identities against the retained official order metadata, join the six shot IDs as integers in `BEAM0101`, verify their time and quality fields, and repeat the waveform normalization and robustness checks before wiring a separate case into the application. The V001 extractor stays pinned to its original input pair.
