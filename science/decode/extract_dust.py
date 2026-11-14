"""Generate the production dust DecodeCase from the audited NASA granule.

Run with the local numerical Python environment documented in source-audit.md.
No acquisition, interpolation, threshold tuning, or image-derived data occurs here.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess

import netCDF4
import numpy as np

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
GRANULE = "GEOS.fp.asm.tavg3_2d_aer_Nx.20250819_1930.V01.nc4"
SOURCE = ROOT / "raw" / GRANULE
SOURCE_SHA256 = "091ab5cdfdf8f68983283d1f3909014258d75738d499bf44a5e5d87e75cb87db"
SOURCE_URL = f"https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/das/Y2025/M08/D19/{GRANULE}"
CASE_ID = "dust-geos-fp-20250819-1930-north-africa-med"
CASE_PATH = REPO / "web" / "assets" / "decode" / "data" / f"{CASE_ID}.json"
PROVENANCE_PATH = ROOT / "dust-extraction.json"
BOUNDS = {"north": 45, "south": 15, "east": 50, "west": -20}
# Fixed before examining aggregated output. See docs/decode-data.md for rationale.
THRESHOLD = 0.20
ADVANCED_AGGREGATION = (
    "spherical-area-weighted mean of DUEXTTAU native-cell overlaps; "
    "any missing or invalid contributor makes the cell missing"
)


def cell(row, col, rows, cols, value):
    return {
        "row": row, "col": col,
        "lat": BOUNDS["north"] - (row + 0.5) * (BOUNDS["north"] - BOUNDS["south"]) / rows,
        "lon": BOUNDS["west"] + (col + 0.5) * (BOUNDS["east"] - BOUNDS["west"]) / cols,
        "value": value,
        "status": "missing" if value is None else "measured" if value >= THRESHOLD else "below_threshold",
    }


def grid(rows, cols, cells, aggregation):
    return {
        "rows": rows, "cols": cols, "cells": cells,
        "truth": {"rule": "value >= threshold", "threshold": THRESHOLD,
                  "present": [[c["row"], c["col"]] for c in cells
                              if c["value"] is not None and c["value"] >= THRESHOLD]},
        "aggregation": aggregation,
    }


def overlap_mean(values, latitudes, longitudes, south, north, west, east):
    """Piecewise-constant native-cell mean using exact spherical overlap areas.

    The regular source grid has no cell bounds: infer native footprints at
    coordinate +/- half a native step (0.125 latitude, 0.15625 longitude).
    Radius cancels in the weighted mean. No source samples are clamped or filled.
    """
    lat_low = np.maximum(latitudes - 0.125, south)
    lat_high = np.minimum(latitudes + 0.125, north)
    lon_low = np.maximum(longitudes - 0.15625, west)
    lon_high = np.minimum(longitudes + 0.15625, east)
    yi = np.flatnonzero(lat_high > lat_low)
    xi = np.flatnonzero(lon_high > lon_low)
    if not yi.size or not xi.size:
        raise ValueError("Source grid does not cover the target cell")
    lat_area = np.sin(np.deg2rad(lat_high[yi])) - np.sin(np.deg2rad(lat_low[yi]))
    lon_area = np.deg2rad(lon_high[xi] - lon_low[xi])
    weights = np.outer(lat_area, lon_area)
    area = float(weights.sum(dtype=np.float64))
    expected_area = math.radians(east - west) * (
        math.sin(math.radians(north)) - math.sin(math.radians(south)))
    if not math.isclose(area, expected_area, rel_tol=1e-12, abs_tol=1e-15):
        raise ValueError("Incomplete native spatial coverage")
    block = np.ma.asarray(values)[np.ix_(yi, xi)]
    data = np.asarray(np.ma.getdata(block), dtype=np.float64)
    invalid = np.ma.getmaskarray(block) | ~np.isfinite(data) | (data < 0)
    missing = int(invalid.sum())
    numerator = None if missing else float(np.sum(data * weights, dtype=np.float64))
    value = None if missing else numerator / area
    evidence = {
        "native_contributors": int(data.size), "invalid_contributors": missing,
        "source_lat_indices_inclusive": [int(yi[0]), int(yi[-1])],
        "source_lon_indices_inclusive": [int(xi[0]), int(xi[-1])],
        "overlap_solid_angle_sr": area, "aot_times_solid_angle": numerator,
    }
    return value, evidence


def advanced_grid(values, latitudes, longitudes):
    cells, evidence = [], []
    for row in range(6):
        north = BOUNDS["north"] - row * 5
        south = north - 5
        for col in range(8):
            west = BOUNDS["west"] + col * 8.75
            east = west + 8.75
            value, detail = overlap_mean(values, latitudes, longitudes, south, north, west, east)
            cells.append(cell(row, col, 6, 8, value))
            evidence.append({"row": row, "col": col,
                             "bounds": {"north": north, "south": south, "east": east, "west": west},
                             **detail})
    return grid(6, 8, cells, ADVANCED_AGGREGATION), evidence


def quick_grid(advanced):
    cells = []
    for row in range(3):
        for col in range(4):
            index = row * 16 + col * 2
            children = [advanced["cells"][i]["value"]
                        for i in (index, index + 1, index + 8, index + 9)]
            # Same child order and divide-before-add arithmetic as validate.js.
            value = None
            if None not in children:
                value = 0.0
                for child in children:
                    value += child / 4
            cells.append(cell(row, col, 3, 4, value))
    return grid(3, 4, cells, "mean of 2x2 advanced cells")


def encode(value):
    return (json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n").encode("utf-8")


def extract():
    with SOURCE.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    if digest != SOURCE_SHA256:
        raise ValueError("NASA granule SHA256 does not match the audited source")
    with netCDF4.Dataset(SOURCE) as source:
        dust = source["DUEXTTAU"]
        if (source.GranuleID != GRANULE or source.ShortName != "DFPT3NXAER"
                or source.Source != "GEOSadas-5_29_5-p6-SLES15 experiment_id: f5295_fp"
                or dust.dimensions != ("time", "lat", "lon") or dust.shape != (1, 721, 1152)
                or dust.units != "1" or source["lat"].units != "degrees_north"
                or source["lon"].units != "degrees_east"):
            raise ValueError("Unexpected NASA source product, axes, variable, or units")
        start = source.RangeBeginningDate + "T" + source.RangeBeginningTime.split(".")[0] + "Z"
        end = source.RangeEndingDate + "T" + source.RangeEndingTime.split(".")[0] + "Z"
        timestamp = netCDF4.num2date(source["time"][:], source["time"].units)[0].isoformat() + "Z"
        if (start, end, timestamp) != ("2025-08-19T18:00:00Z", "2025-08-19T21:00:00Z", "2025-08-19T19:30:00Z"):
            raise ValueError("Unexpected scientific time")
        latitudes = np.asarray(source["lat"][:])
        longitudes = np.asarray(source["lon"][:])
        if (not np.array_equal(latitudes, np.linspace(-90, 90, 721))
                or not np.array_equal(longitudes, np.arange(1152) * 0.3125 - 180)):
            raise ValueError("Unexpected source coordinate grid")
        # netCDF4 honors the source fill/missing flags, valid_range and scaling.
        values = dust[0, :, :]
        advanced, evidence = advanced_grid(values, latitudes, longitudes)
        case = {
            "schema": "earthpulse.decode/2", "id": CASE_ID,
            "phenomenon": "dust", "behavior": "continuous", "fixture": False,
            "source": {"product": source.LongName + " (DFPT3NXAER; DUEXTTAU at 550 nm)",
                       "version": "5.29.5-p6 / V01", "url": SOURCE_URL,
                       "granules": [source.GranuleID], "time": {"start": start, "end": end}},
            "visualLink": {
                "svs": "https://svs.gsfc.nasa.gov/5669/",
                "image": "https://svs.gsfc.nasa.gov/vis/a000000/a005600/a005669/Aerosols_2025-08-19T20_00_00_1920x1080.png",
                "relation": "RELATED_CONTEXT",
                "note": "Numerical data are standard GEOS-FP 0.25-degree latitude by 0.3125-degree longitude "
                        "assimilation, a three-hour mean from 18:00 to 21:00 UTC centered at 19:30 UTC on "
                        "2025-08-19. SVS 5669 uses a separate GEOS-FP 2 km Replay at 20:00 UTC. "
                        "These are related scientific context, not the same visualization dataset or instantaneous field.",
            },
            "unit": dust.units, "bounds": dict(BOUNDS),
            "levels": {"quick": quick_grid(advanced), "advanced": advanced},
        }
    encoded = encode(case)
    provenance = {
        "case_id": CASE_ID, "case_path": CASE_PATH.relative_to(REPO).as_posix(),
        "case_sha256_lf": hashlib.sha256(encoded).hexdigest(),
        "source": {"path": SOURCE.relative_to(REPO).as_posix(), "url": SOURCE_URL,
                   "sha256": digest, "granule": GRANULE, "variable": "DUEXTTAU", "unit": "1",
                   "timestamp_utc": timestamp, "interval_utc": {"start": start, "end": end}},
        "bounds": dict(BOUNDS), "visual_relation": "RELATED_CONTEXT",
        "coordinate_note": "Source declares degrees_north/degrees_east, not an explicit datum. "
                           "Case geometry follows the Decode contract's WGS84 geographic convention; no datum transform applied.",
        "native_footprint_assumption": "Regular native cells inferred from center +/- half spacing; "
                                       "clipped to each target rectangle. Piecewise-constant AOT on a sphere.",
        "advanced_aggregation": ADVANCED_AGGREGATION,
        "quick_aggregation": "mean of 2x2 advanced cells; any missing child makes the parent missing",
        "threshold": {"value": THRESHOLD, "unit": "1", "rule": "value >= threshold",
                      "rationale": "Fixed educational cutoff for appreciable dust-column extinction at 550 nm, "
                                   "chosen before aggregation; not a NASA dust-event, visibility, or health standard. "
                                   "Optical depth 0.20 corresponds to exp(-0.20) direct-beam transmission "
                                   "through the dust column for a vertical path (about 18.1% attenuation).",
                      "context_url": "https://science.nasa.gov/earth/earth-observatory/global-maps/aerosol-optical-depth/"},
        "levels": {name: {"rows": g["rows"], "cols": g["cols"],
                          "positive_cells": len(g["truth"]["present"]),
                          "missing_cells": sum(c["value"] is None for c in g["cells"]),
                          "min": min(c["value"] for c in g["cells"] if c["value"] is not None),
                          "max": max(c["value"] for c in g["cells"] if c["value"] is not None)}
                   for name, g in case["levels"].items()},
        "advanced_cell_evidence": evidence,
        "software": {"netCDF4": netCDF4.__version__, "numpy": np.__version__},
    }
    return case, provenance


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="recompute and compare existing outputs without writing")
    args = parser.parse_args()
    case, provenance = extract()
    # Validate before publishing either output; reuse Majd's actual validator.
    validation = subprocess.run([
        "node", "--input-type=module", "-e",
        "import {readFileSync} from 'node:fs'; "
        "import {validateDecodeCase} from './web/contracts/validate.js'; "
        "validateDecodeCase(JSON.parse(readFileSync(0, 'utf8')));",
    ], input=encode(case), cwd=REPO, capture_output=True)
    if validation.returncode:
        raise RuntimeError("Shared DecodeCase validator rejected extraction:\n" + validation.stderr.decode("utf-8"))
    for path, payload in ((CASE_PATH, case), (PROVENANCE_PATH, provenance)):
        if args.check:
            if path.read_text(encoding="utf-8") != encode(payload).decode("utf-8"):
                raise ValueError(f"Committed/generated output differs from real extraction: {path}")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(encode(payload))
    print(json.dumps({"case_id": CASE_ID, "path": CASE_PATH.relative_to(REPO).as_posix(),
                      "bounds": BOUNDS, "threshold": THRESHOLD, "unit": case["unit"],
                      "levels": provenance["levels"], "validator": "PASS",
                      "mode": "reproduction check passed" if args.check else "generated"}, indent=2))


if __name__ == "__main__":
    main()
