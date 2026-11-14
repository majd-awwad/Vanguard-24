# Earth Sound Studio — VNP46A4 intake

The checked-in experience currently runs in `REFERENCE_IMAGE_ONLY` mode using
three exact NASA SVS 5276 JPEGs. It does not expose radiance values. The numeric
target is one bounded Collection 2 tile, `h25v06` (70–80°E, 20–30°N):

- `VNP46A4.A2012001.h25v06.002.2025086172430.h5`
- `VNP46A4.A2023001.h25v06.002.2025162080718.h5`

Both are listed by the official LAADS archive. File download and OPeNDAP require
Earthdata authorization. Never commit the token or the raw HDF5 files.

```powershell
$env:EARTHDATA_TOKEN = "<temporary Earthdata token>"
python science/nightlights/extract_vnp46a4.py --download
```

The importer checks the HDF5 signature, exact filename, product DOI, tile,
2400×2400 geometry, units, scale, offset and fill metadata. It reads
`AllAngle_Composite_Snow_Free`, its quality flag and observation count. The
output is a documented 30 arc-second 2×2 valid-pixel mean; an empty block stays
missing. Quality 0, 1, 2 and 255 remain distinguishable.

The resulting processed bundle must be independently inspected and integrated
into the browser before `manifest.json` may change to `VERIFIED_NUMERIC`.
