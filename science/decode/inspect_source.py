"""Inspect the genuine NASA granule and retain a lossless local regional crop.

Requires netCDF4 and numpy. Run from any directory; all outputs stay here.
This does not produce an EARTHPULSE case or choose a classification threshold.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import netCDF4
import numpy as np

ROOT = Path(__file__).resolve().parent
GRANULE = "GEOS.fp.asm.tavg3_2d_aer_Nx.20250819_1930.V01.nc4"
SOURCE_URL = (
    "https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/das/"
    f"Y2025/M08/D19/{GRANULE}"
)
RAW = ROOT / "raw" / GRANULE
SUBSET = ROOT / "derived" / GRANULE.replace(
    ".nc4", ".DUEXTTAU.N15_N45.W20_E50.nc4"
)


def plain(value):
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, np.generic):
        return value.item()
    return value


def attributes(variable):
    return {key: plain(variable.getncattr(key)) for key in variable.ncattrs()}


def checksum(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def statistics(values, latitudes, longitudes):
    values = np.ma.masked_invalid(values)
    valid = values.compressed()
    if not valid.size:
        raise ValueError("The downloaded region contains no valid numerical data")
    imin = np.unravel_index(np.ma.argmin(values), values.shape)
    imax = np.unravel_index(np.ma.argmax(values), values.shape)
    return {
        "shape": list(values.shape),
        "valid_count": int(valid.size),
        "missing_or_nonfinite_count": int(values.size - valid.size),
        "negative_count": int(np.count_nonzero(valid < 0)),
        "zero_count": int(np.count_nonzero(valid == 0)),
        "min": float(valid.min()),
        "max": float(valid.max()),
        "mean": float(valid.astype(np.float64).mean()),
        "minimum_at": {"lat": float(latitudes[imin[-2]]), "lon": float(longitudes[imin[-1]])},
        "maximum_at": {"lat": float(latitudes[imax[-2]]), "lon": float(longitudes[imax[-1]])},
    }


def inspect():
    SUBSET.parent.mkdir(exist_ok=True)
    with netCDF4.Dataset(RAW) as source:
        dust = source["DUEXTTAU"]
        assert dust.dimensions == ("time", "lat", "lon")
        assert dust.units == "1"
        assert source.GranuleID == GRANULE
        assert source.RangeBeginningDate == source.RangeEndingDate == "2025-08-19"
        assert source.RangeBeginningTime == "18:00:00.000000"
        assert source.RangeEndingTime == "21:00:00.000000"
        latitudes = np.asarray(source["lat"][:])
        longitudes = np.asarray(source["lon"][:])
        assert np.all(np.diff(latitudes) == 0.25)
        assert np.all(np.diff(longitudes) == 0.3125)
        y = np.flatnonzero((latitudes >= 15) & (latitudes <= 45))
        x = np.flatnonzero((longitudes >= -20) & (longitudes <= 50))
        ys = slice(int(y[0]), int(y[-1]) + 1)
        xs = slice(int(x[0]), int(x[-1]) + 1)
        # netCDF4 automatically masks _FillValue/missing_value/valid_range and
        # applies the file's scale_factor=1 and add_offset=0. No clipping/filling.
        global_values = dust[:]
        region = global_values[:, ys, xs]
        assert region.shape == (1, 121, 225)
        timestamps = [
            date.isoformat() + "Z"
            for date in netCDF4.num2date(source["time"][:], source["time"].units)
        ]
        assert timestamps == ["2025-08-19T19:30:00Z"]
        report = {
            "source_url": SOURCE_URL,
            "downloaded_file": str(RAW.relative_to(ROOT)).replace("\\", "/"),
            "bytes": RAW.stat().st_size,
            "sha256": checksum(RAW),
            "file_format": source.data_model,
            "global_attributes": attributes(source),
            "dimensions": {name: len(dim) for name, dim in source.dimensions.items()},
            "all_variables": list(source.variables),
            "variable": {
                "name": dust.name,
                "dtype": str(dust.dtype),
                "dimensions": list(dust.dimensions),
                "attributes": attributes(dust),
                "chunking": dust.chunking(),
                "filters": dust.filters(),
            },
            "coordinates": {
                "time": {"values": source["time"][:].tolist(), "timestamps_utc": timestamps,
                         "attributes": attributes(source["time"]),
                         "calendar_note": "No calendar attribute; num2date uses standard Gregorian."},
                "lat": {"count": len(latitudes), "first": float(latitudes[0]),
                        "last": float(latitudes[-1]), "step": 0.25,
                        "attributes": attributes(source["lat"])},
                "lon": {"count": len(longitudes), "first": float(longitudes[0]),
                        "last": float(longitudes[-1]), "step": 0.3125,
                        "attributes": attributes(source["lon"])},
            },
            "global_statistics": statistics(global_values, latitudes, longitudes),
            "regional_subset": {
                "file": str(SUBSET.relative_to(ROOT)).replace("\\", "/"),
                "kind": "Locally cropped genuine NASA values; not an official NASA subset download",
                "bounds_of_retained_coordinate_centers": {"south": 15, "north": 45, "west": -20, "east": 50},
                "source_zero_based_indices_inclusive": {"time": [0, 0], "lat": [int(y[0]), int(y[-1])],
                                                        "lon": [int(x[0]), int(x[-1])]},
                "statistics": statistics(region, latitudes[ys], longitudes[xs]),
            },
            "software": {"netCDF4": netCDF4.__version__, "numpy": np.__version__,
                         "netcdf_c": netCDF4.__netcdf4libversion__, "hdf5": netCDF4.__hdf5libversion__},
        }
        with netCDF4.Dataset(SUBSET, "w", format="NETCDF4") as output:
            output.setncatts({key: source.getncattr(key) for key in source.ncattrs()})
            output.setncatts({
                "Filename": SUBSET.name,
                "SpatialCoverage": "regional local subset: North Africa and Eastern Mediterranean",
                "SouthernmostLatitude": "15.0", "NorthernmostLatitude": "45.0",
                "WesternmostLongitude": "-20.0", "EasternmostLongitude": "50.0",
                "parent_granule": GRANULE, "parent_sha256": report["sha256"],
                "source_download_url": SOURCE_URL,
                "subset_method": "Local index crop; no resampling, averaging, interpolation, or value replacement",
                "History": source.History + "; local regional crop by science/decode/inspect_source.py",
            })
            for name, size in (("time", 1), ("lat", len(y)), ("lon", len(x))):
                output.createDimension(name, size)
            for name, selection in (("time", slice(None)), ("lat", ys), ("lon", xs)):
                original = source[name]
                copied = output.createVariable(name, original.dtype, original.dimensions)
                copied.setncatts({key: original.getncattr(key) for key in original.ncattrs()})
                copied[:] = original[selection]
            copied = output.createVariable("DUEXTTAU", dust.dtype, dust.dimensions,
                                           fill_value=dust._FillValue, zlib=True, complevel=4)
            copied.setncatts({key: dust.getncattr(key) for key in dust.ncattrs() if key != "_FillValue"})
            copied[:] = region

    with netCDF4.Dataset(SUBSET) as output:
        restored = output["DUEXTTAU"][:]
        assert np.array_equal(np.ma.getmaskarray(restored), np.ma.getmaskarray(region))
        assert np.array_equal(restored.compressed(), region.compressed())
        assert np.array_equal(output["lat"][:], latitudes[ys])
        assert np.array_equal(output["lon"][:], longitudes[xs])
    report["regional_subset"].update({"sha256": checksum(SUBSET), "bytes": SUBSET.stat().st_size,
                                       "lossless_readback_verified": True})
    metadata = ROOT / "inspection.json"
    metadata.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in (
        "downloaded_file", "bytes", "sha256", "dimensions", "coordinates",
        "variable", "global_statistics", "regional_subset", "software")}, indent=2))


if __name__ == "__main__":
    inspect()
