"""M1 dust archive primitives. No imports or mutations in shared application code."""
from __future__ import annotations

from datetime import date, datetime, timezone
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import sys

import netCDF4
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
sys.path.insert(0, str(ROOT))
from extract_dust import overlap_mean  # Preserve the original case implementation.

MANIFEST = ROOT / "manifests/dust-sources.json"
PLAN = ROOT / "manifests/dust-sampling-plan.json"
RAW = ROOT / "raw/geos_fp"
PROCESSED = ROOT / "processed/dust"
WEB = REPO / "web/assets/decode/dust-v2"
ARCHIVE_URL = "https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/das/"
BOUNDS = {"north":45,"south":15,"east":50,"west":-20}
GRID_ID = "north-africa-med-25x40-v1"
MODEL = "GEOSadas-5_29_5-p6-SLES15 experiment_id: f5295_fp"
SUPPORTED_MODELS = {MODEL, "GEOSadas-5_29_5-p6 experiment_id: f5295_fp"}
METHOD = "spherical-area-weighted native-footprint overlap mean; any invalid contributor => missing"
COMMON_WARNINGS = [
    "Selected three-hour means, not daily/monthly averages or full seasonal climatology.",
    "Native geographic degrees have no explicit datum declaration; display uses the contract's geographic convention without datum transformation.",
    "Native footprints inferred at center +/- half regular spacing; spherical, piecewise-constant area aggregation.",
]


@contextmanager
def dataset_lock():
    """An OS-held lock prevents concurrent writers; crashes release it automatically."""
    cache = ROOT / ".cache"
    cache.mkdir(exist_ok=True)
    with (cache/"dust-writer.lock").open("a+b") as stream:
        if stream.seek(0,2)==0:
            stream.write(b"0")
            stream.flush()
        stream.seek(0)
        try:
            if os.name=="nt":
                import msvcrt
                msvcrt.locking(stream.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(stream,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError as error:
            raise RuntimeError("Another dust archive/process command holds the writer lock") from error
        try:
            yield
        finally:
            stream.seek(0)
            if os.name=="nt":
                msvcrt.locking(stream.fileno(),msvcrt.LK_UNLCK,1)
            else:
                fcntl.flock(stream,fcntl.LOCK_UN)


def json_bytes(value, compact=False):
    return (json.dumps(value, ensure_ascii=False, allow_nan=False,
                       **({"separators": (",", ":")} if compact else {"indent": 2})) + "\n").encode("utf-8")


def atomic(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + ".tmp")
    with temp.open("wb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temp, path)


def save(path, obj, compact=False):
    atomic(path, json_bytes(obj, compact))


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def relative(path):
    return Path(path).relative_to(REPO).as_posix()


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def season(day):
    d = date.fromisoformat(day)
    if d.month in (12, 1, 2):
        ending = d.year + (d.month == 12)
        return {"key":f"winter-{ending-1}-{ending}", "name":"winter", "seasonYear":ending}
    name = "spring" if d.month < 6 else "summer" if d.month < 9 else "autumn"
    return {"key":f"{name}-{d.year}", "name":name, "seasonYear":d.year}


def request_id(day, center):
    if date.fromisoformat(day).isoformat()!=day or datetime.strptime(center, "%H:%M").strftime("%H:%M")!=center:
        raise ValueError("Use canonical YYYY-MM-DD and HH:MM UTC")
    return "geos-fp-dust-" + day.replace("-", "") + "-" + center.replace(":", "")


def load_plan(path=PLAN):
    plan = read(path)
    if plan.get("schema") != "earthpulse.dust-sampling-plan/1":
        raise ValueError("Unsupported sampling plan")
    ids = [request_id(r["date"], r["center"]) for r in plan["requests"]]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate date/time requests")
    return plan


def load_manifest():
    return read(MANIFEST) if MANIFEST.exists() else {"schema":"earthpulse.dust-sources/1", "sources":[]}


def geometry():
    cells = []
    for row in range(25):
        for col in range(40):
            n, s = round(45-row*1.2, 10), round(45-(row+1)*1.2, 10)
            w, e = -20+col*1.75, -20+(col+1)*1.75
            cells.append({"row":row,"col":col,"lat":round((n+s)/2,10),"lon":(e+w)/2,
                          "bounds":{"north":n,"south":s,"east":e,"west":w}})
    return {"schema":"earthpulse.dust-grid/1","id":GRID_ID,"rows":25,"cols":40,
            "bounds":BOUNDS,"orientation":"north-to-south, west-to-east",
            "projection":"geographic longitude/latitude degrees; render using plate carree or project rectangle corners",
            "coordinateNote":COMMON_WARNINGS[1],"cells":cells}


def inspect_netcdf(path, record):
    """Metadata comes from the opened bytes, not URL/file-name inference."""
    with netCDF4.Dataset(path) as d:
        v = d["DUEXTTAU"]
        if (d.ShortName != "DFPT3NXAER" or v.units != "1"
                or v.dimensions != ("time","lat","lon") or v.shape != (1,721,1152)
                or d["lat"].units != "degrees_north" or d["lon"].units != "degrees_east"):
            raise ValueError("Incompatible product, variable, units or axes")
        lat, lon = np.asarray(d["lat"][:]), np.asarray(d["lon"][:])
        if not np.array_equal(lat, np.arange(721)*.25-90) or not np.array_equal(lon,np.arange(1152)*.3125-180):
            raise ValueError("Incompatible native coordinates")
        stamp = netCDF4.num2date(d["time"][:],d["time"].units)[0].isoformat()+"Z"
        start = d.RangeBeginningDate+"T"+d.RangeBeginningTime.split(".")[0]+"Z"
        end = d.RangeEndingDate+"T"+d.RangeEndingTime.split(".")[0]+"Z"
        if stamp != record["date"]+"T"+record["center"]+":00Z":
            raise ValueError("Actual timestamp does not match requested date/time")
        t, a, b = [datetime.fromisoformat(x.replace("Z","+00:00")) for x in [stamp,start,end]]
        if (b-a).total_seconds()!=10800 or t-a != b-t:
            raise ValueError("Expected a centered three-hour averaging interval")
        if d.GranuleID != record["original_filename"]:
            raise ValueError("Actual GranuleID does not match discovered archive filename")
        region = np.ma.asarray(v[0,420:541,512:737])
        data = np.asarray(np.ma.getdata(region), dtype=np.float64)
        invalid = np.ma.getmaskarray(region) | ~np.isfinite(data) | (data < 0)
        valid = data[~invalid]
        compatible = d.Source in SUPPORTED_MODELS and d.VersionID == "5.29.5"
        warnings = [] if d.Source == MODEL else ["Literal Source build label lacks the SLES15 suffix present in the August reference. Same declared 5.29.5-p6 release, but numerical build equivalence is unverified; cross-build comparisons/averages are disabled."]
        if not compatible:
            warnings.append("Unsupported model/version; excluded from publication and comparisons.")
        attrs = {k: (v.getncattr(k).tolist() if isinstance(v.getncattr(k), np.ndarray)
                     else v.getncattr(k).item() if isinstance(v.getncattr(k), np.generic)
                     else v.getncattr(k)) for k in v.ncattrs()}
        return {"product":d.LongName,"short_name":d.ShortName,"version":d.VersionID,
                "model_source":d.Source,"variable":"DUEXTTAU","units":v.units,
                "variable_attributes":attrs,"timestamp_utc":stamp,"start_utc":start,"end_utc":end,
                "time_semantics":"three-hour mean", "dimensions":{"time":1,"lat":721,"lon":1152},
                "native_coverage":{"north":90,"south":-90,"east":179.6875,"west":-180},
                "native_resolution_degrees":{"lat":.25,"lon":.3125},
                "regional_center_coverage":BOUNDS,
                "regional_statistics":{"valid":int(valid.size),"missing_or_invalid":int(invalid.sum()),
                                       "min":float(valid.min()) if valid.size else None,
                                       "max":float(valid.max()) if valid.size else None},
                "compatible":compatible,"compatibility_warnings":warnings}


def verify_record(record):
    path = REPO / record["local_path"]
    if path.stat().st_size != record["size_bytes"] or sha(path) != record["sha256"]:
        raise ValueError("Raw file size/SHA256 mismatch: " + record["id"])
    metadata = inspect_netcdf(path, record)
    if metadata != record["metadata"]:
        raise ValueError("Raw metadata differs from verified manifest: " + record["id"])
    return path
