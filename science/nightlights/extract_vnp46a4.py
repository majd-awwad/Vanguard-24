"""Bounded VNP46A4 Collection 2 importer for Earth Sound Studio.

The script never runs in the browser and never writes credentials. It accepts
two exact LAADS granules, validates their product identity and field metadata,
then creates a 30 arc-second, 2x2 valid-pixel mean for tile h25v06. The browser
must not enable quantitative mode until this script has completed successfully.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import struct
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOCAL_PACKAGES = ROOT / ".python"
if LOCAL_PACKAGES.exists():
    sys.path.insert(0, str(LOCAL_PACKAGES))

try:
    import h5py
    import numpy as np
except ImportError as error:
    raise SystemExit("Install h5py and numpy before importing VNP46A4.") from error

PRODUCT_DOI = "10.5067/VIIRS/VNP46A4.002"
FIELD_ROOT = "/HDFEOS/GRIDS/VIIRS_Grid_DNB_2d/Data Fields"
RADIANCE = "AllAngle_Composite_Snow_Free"
QUALITY = "AllAngle_Composite_Snow_Free_Quality"
OBSERVATIONS = "AllAngle_Composite_Snow_Free_Num"
FILES = {
    2012: "VNP46A4.A2012001.h25v06.002.2025086172430.h5",
    2023: "VNP46A4.A2023001.h25v06.002.2025162080718.h5",
}
URLS = {
    year: f"https://ladsweb.modaps.eosdis.nasa.gov/archive/allData/5200/VNP46A4/{year}/001/{name}"
    for year, name in FILES.items()
}
HDF5_MAGIC = b"\x89HDF\r\n\x1a\n"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(year: int, destination: Path, token: str) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(URLS[year], headers={"Authorization": f"Bearer {token}"})
    temporary = destination.with_suffix(".part")
    with urllib.request.urlopen(request, timeout=120) as response, temporary.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    with temporary.open("rb") as source:
        if source.read(8) != HDF5_MAGIC:
            temporary.unlink(missing_ok=True)
            raise RuntimeError(f"LAADS did not return HDF5 for {year}.")
    temporary.replace(destination)


def text(value) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return str(value)


def read_year(path: Path, year: int):
    if path.name != FILES[year]:
        raise ValueError(f"Expected exact {year} granule {FILES[year]}")
    with path.open("rb") as source:
        if source.read(8) != HDF5_MAGIC:
            raise ValueError(f"{path} is not an HDF5 file")
    with h5py.File(path, "r") as source:
        doi = text(source.attrs.get("identifier_product_doi", ""))
        if doi != PRODUCT_DOI:
            raise ValueError(f"Unexpected product DOI: {doi}")
        if text(source.attrs.get("HorizontalTileNumber", "")) != "25" or text(source.attrs.get("VerticalTileNumber", "")) != "06":
            raise ValueError("Granule is not tile h25v06")
        fields = source[FIELD_ROOT]
        radiance = fields[RADIANCE]
        quality = fields[QUALITY]
        observations = fields[OBSERVATIONS]
        if radiance.shape != quality.shape or radiance.shape != observations.shape or radiance.shape != (2400, 2400):
            raise ValueError(f"Unexpected field geometry: {radiance.shape}")
        units = text(radiance.attrs.get("units", ""))
        if "nW" not in units:
            raise ValueError(f"Unexpected radiance units: {units}")
        raw = radiance[:]
        qa = quality[:]
        count = observations[:]
        fill = radiance.attrs.get("_FillValue")
        scale = float(radiance.attrs.get("scale_factor", 1.0))
        offset = float(radiance.attrs.get("offset", 0.0))
        valid = np.isfinite(raw) & (qa != 255) & (count != 65535)
        if fill is not None:
            valid &= raw != fill
        calibrated = raw.astype("float64") * scale + offset
        calibrated[~valid] = np.nan
        metadata = {
            "year": year,
            "file": path.name,
            "sha256": sha256(path),
            "doi": doi,
            "field": RADIANCE,
            "quality_field": QUALITY,
            "observation_count_field": OBSERVATIONS,
            "shape": list(raw.shape),
            "units": units,
            "scale_factor": scale,
            "offset": offset,
            "fill_value": None if fill is None else float(fill),
            "range_beginning_date": text(source.attrs.get("RangeBeginningDate", "")),
            "range_ending_date": text(source.attrs.get("RangeEndingDate", "")),
        }
        return calibrated, qa.astype("uint8"), metadata


def aggregate(values, quality):
    height, width = values.shape
    values = values.reshape(height // 2, 2, width // 2, 2)
    quality = quality.reshape(height // 2, 2, width // 2, 2)
    finite = np.isfinite(values)
    count = finite.sum(axis=(1, 3))
    total = np.where(finite, values, 0).sum(axis=(1, 3))
    mean = np.divide(total, count, out=np.full(total.shape, np.nan), where=count > 0).astype("float32")
    safe_quality = np.where(finite, quality, 0)
    worst = safe_quality.max(axis=(1, 3)).astype("uint8")
    worst[count == 0] = 255
    return mean, worst, count.astype("uint8")


def write_bundle(output: Path, baseline, comparison, baseline_qa, comparison_qa, manifest) -> None:
    output.mkdir(parents=True, exist_ok=True)
    binary = output / "nightlights-h25v06.bin.gz"
    arrays = [baseline.astype("<f4"), comparison.astype("<f4"), baseline_qa, comparison_qa]
    with gzip.open(binary, "wb", compresslevel=9) as target:
        target.write(struct.pack("<8sHH", b"EPNTL001", baseline.shape[1], baseline.shape[0]))
        for array in arrays:
            target.write(array.tobytes(order="C"))
    manifest["binary"] = {"file": binary.name, "sha256": sha256(binary), "bytes": binary.stat().st_size}
    (output / "nightlights-h25v06.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", type=Path, default=ROOT / "raw")
    parser.add_argument("--output", type=Path, default=ROOT / "processed")
    parser.add_argument("--token-env", default="EARTHDATA_TOKEN")
    parser.add_argument("--download", action="store_true", help="Download both exact granules using the token environment variable")
    arguments = parser.parse_args()
    token = os.environ.get(arguments.token_env, "")
    if arguments.download and not token:
        raise SystemExit(f"{arguments.token_env} is not set")
    for year, filename in FILES.items():
        path = arguments.raw / filename
        if arguments.download and not path.exists():
            download(year, path, token)
        if not path.exists():
            raise SystemExit(f"Missing {path}. Use --download with an Earthdata token.")
    first, first_qa, first_meta = read_year(arguments.raw / FILES[2012], 2012)
    last, last_qa, last_meta = read_year(arguments.raw / FILES[2023], 2023)
    first, first_qa, first_count = aggregate(first, first_qa)
    last, last_qa, last_count = aggregate(last, last_qa)
    paired = np.isfinite(first) & np.isfinite(last)
    manifest = {
        "schema": "earthpulse-vnp46a4-h25v06-v1",
        "status": "VERIFIED_NUMERIC",
        "product": "VNP46A4.002",
        "doi": PRODUCT_DOI,
        "bounds": {"west": 70, "south": 20, "east": 80, "north": 30},
        "width": int(first.shape[1]),
        "height": int(first.shape[0]),
        "native_resolution": "15 arc-second",
        "output_resolution": "30 arc-second 2x2 valid-pixel mean",
        "aggregation": "mean of available calibrated pixels; missing blocks remain missing",
        "quality": "worst retained source quality in each 2x2 block; 0 good, 1 poor, 2 gap-filled, 255 no-data",
        "years": [first_meta, last_meta],
        "paired_valid_pixels": int(paired.sum()),
        "baseline_valid_contributors": {"min": int(first_count.min()), "max": int(first_count.max())},
        "comparison_valid_contributors": {"min": int(last_count.min()), "max": int(last_count.max())},
    }
    write_bundle(arguments.output, first, last, first_qa, last_qa, manifest)


if __name__ == "__main__":
    main()
