"""Build independent 1,000-cell visualization assets from verified NASA files."""
from __future__ import annotations

import argparse
import hashlib
import math
from pathlib import Path
import sys

sys.path.insert(0,str(Path(__file__).resolve().parent))
from dust_common import *
from dust_archive import inventory


def statistics(values):
    available = [v for v in values if v is not None]
    return {"valid":len(available),"missing":len(values)-len(available),
            "min":min(available) if available else None,"max":max(available) if available else None}


def write_or_check(path, value, check=False):
    blob = json_bytes(value,compact=True)
    if check:
        if not Path(path).exists() or Path(path).read_text(encoding="utf-8")!=blob.decode():
            raise ValueError("Output does not reproduce: "+relative(path))
    else:
        atomic(path,blob)
    return hashlib.sha256(blob).hexdigest()


def extract_snapshot(record, grid):
    path = verify_record(record)
    meta = record["metadata"]
    if not meta["compatible"]:
        raise ValueError("Incompatible source configuration; refusing to mix products/versions")
    values, areas, sums, contributors, invalids = [], [], [], [], []
    with netCDF4.Dataset(path) as source:
        lat = np.asarray(source["lat"][420:541])
        lon = np.asarray(source["lon"][512:737])
        region = source["DUEXTTAU"][0,420:541,512:737]
        for cell in grid["cells"]:
            b = cell["bounds"]
            value, evidence = overlap_mean(region,lat,lon,b["south"],b["north"],b["west"],b["east"])
            values.append(value)
            areas.append(evidence["overlap_solid_angle_sr"])
            sums.append(evidence["aot_times_solid_angle"])
            contributors.append(evidence["native_contributors"])
            invalids.append(evidence["invalid_contributors"])
    temporal = {"kind":"three-hour mean","start":meta["start_utc"],"end":meta["end_utc"],
                "center":meta["timestamp_utc"],"date":record["date"],"season":record["season"],
                "sampling":"selected snapshot, not a daily/monthly/seasonal average"}
    source = {"product":meta["product"],"shortName":meta["short_name"],"version":meta["version"],
              "modelSource":meta["model_source"],"granule":record["original_filename"],
              "url":record["download_url"],"sha256":record["sha256"],"bytes":record["size_bytes"],
              "nativeResolutionDegrees":meta["native_resolution_degrees"]}
    visual = None
    if record["date"]=="2025-08-19" and record["center"]=="19:30":
        visual = {"svs":"https://svs.gsfc.nasa.gov/5669/",
                  "image":"https://svs.gsfc.nasa.gov/vis/a000000/a005600/a005669/Aerosols_2025-08-19T20_00_00_1920x1080.png",
                  "relation":"RELATED_CONTEXT",
                  "note":"SVS is a separate GEOS-FP 2 km Replay at 20:00 UTC on August 19; these numeric values are standard-resolution assimilation averaged over 18:00-21:00 UTC, not matching pixels."}
    snapshot = {"schema":"earthpulse.dust-snapshot/1","id":record["id"],"fixture":False,
                "gridId":GRID_ID,"gridPath":"grid.json","rows":25,"cols":40,"bounds":BOUNDS,
                "quantity":"dust extinction aerosol optical depth at 550 nm","variable":"DUEXTTAU","unit":"1",
                "time":temporal,"source":source,"method":METHOD,
                "missingRule":"null => missing; otherwise available; any invalid native overlap propagates",
                "warnings":COMMON_WARNINGS+meta["compatibility_warnings"],"visualLink":visual,
                "statistics":statistics(values),"values":values}
    processed = {"schema":"earthpulse.dust-processing/1","snapshot":snapshot,
                 "rawPath":record["local_path"],"regionalCenterBounds":BOUNDS,
                 "regionalSourceIndicesInclusive":{"lat":[420,540],"lon":[512,736]},
                 "regionalStatistics":meta["regional_statistics"],
                 "nativeFootprints":"lat +/-0.125, lon +/-0.15625 degrees, clipped to each target rectangle",
                 "overlapSolidAngleSr":areas,"aotTimesSolidAngle":sums,
                 "nativeContributors":contributors,"invalidContributors":invalids,
                 "software":{"netCDF4":netCDF4.__version__,"numpy":np.__version__}}
    return snapshot,processed


def comparison(first,second):
    for key in ("gridId","unit","variable","method"):
        if first[key]!=second[key]:
            raise ValueError("Incompatible comparison "+key)
    if first["source"]["modelSource"]!=second["source"]["modelSource"]:
        raise ValueError("Incompatible model configuration")
    vals = [None if a is None or b is None else b-a for a,b in zip(first["values"],second["values"],strict=True)]
    return {"schema":"earthpulse.dust-comparison/1","id":first["id"]+"--to--"+second["id"],
            "gridId":GRID_ID,"rows":25,"cols":40,"bounds":BOUNDS,"unit":"1","variable":"DUEXTTAU",
            "operation":"second minus first","timeSemantics":"difference between selected three-hour means; not seasonal means or a trend estimate",
            "periods":[{"id":s["id"],"time":s["time"],"sourceSha256":s["source"]["sha256"],
                        "modelSource":s["source"]["modelSource"]} for s in [first,second]],
            "statistics":statistics(vals),"values":vals}


def publish(manifest, check=False):
    grid = geometry()
    grid_hash = write_or_check(WEB/"grid.json",grid,check)
    published,errors = [],[]
    for record in manifest["sources"]:
        if record["download_status"]!="verified":
            continue
        try:
            snapshot,processed = extract_snapshot(record,grid)
            output = WEB / "snapshots" / (record["id"]+".json")
            processed_hash = write_or_check(REPO/record["processed_path"],processed,check)
            asset_hash = write_or_check(output,snapshot,check)
            publication = {"path":relative(output),"sha256_lf":asset_hash,"bytes":len(json_bytes(snapshot,True))}
            if check:
                if record.get("publication")!=publication or record.get("processed_sha256_lf")!=processed_hash:
                    raise ValueError("Manifest output digest differs from regeneration")
            else:
                record.update(extraction_status="verified",publication=publication,processed_sha256_lf=processed_hash)
                record.pop("extraction_error",None)
            published.append((record,snapshot))
            print("verified 1000 cells: "+record["id"],flush=True)
        except Exception as error:
            errors.append(record["id"]+": "+str(error))
            if not check:
                record.update(extraction_status="failed",extraction_error=str(error))
            print("FAILED "+errors[-1],flush=True)
        if not check:
            save(MANIFEST,manifest)
    entries = [{"id":r["id"],"date":r["date"],"time":s["time"],"phase":r["phase"],
                "path":"snapshots/"+r["id"]+".json","bytes":r["publication"]["bytes"],
                "sha256_lf":r["publication"]["sha256_lf"],"sourceSha256":r["sha256"],"modelSource":s["source"]["modelSource"],
                "downloadStatus":"verified","extractionStatus":"verified"} for r,s in published]
    seasons = []
    for key in dict.fromkeys(e["time"]["season"]["key"] for e in entries):
        members = [e for e in entries if e["time"]["season"]["key"]==key]
        seasons.append({**members[0]["time"]["season"],"label":"sampled seasonal snapshots, not a full seasonal average",
                        "snapshotIds":[e["id"] for e in members],"dates":[e["date"] for e in members],
                        "months":sorted({e["date"][:7] for e in members})})
    pilots = [s for r,s in published if r["phase"]=="pilot"]
    comparisons,unavailable_comparisons = [],[]
    for a,b in zip(pilots,pilots[1:]):
        if a["source"]["modelSource"]!=b["source"]["modelSource"]:
            unavailable_comparisons.append({"first":a["id"],"second":b["id"],
                                           "reason":"Different literal model build labels; numerical build equivalence unverified."})
            continue
        comp = comparison(a,b)
        path = WEB/"comparisons"/(comp["id"]+".json")
        digest = write_or_check(path,comp,check)
        comparisons.append({"id":comp["id"],"path":"comparisons/"+path.name,"sha256_lf":digest,
                            "first":a["id"],"second":b["id"]})
    catalog = {"schema":"earthpulse.dust-catalog/1","id":"geos-fp-dust-sampled-2025",
               "grid":{"id":GRID_ID,"path":"grid.json","rows":25,"cols":40,"sha256_lf":grid_hash},
               "bounds":BOUNDS,"unit":"1","variable":"DUEXTTAU",
               "years":sorted({int(e["date"][:4]) for e in entries}),"seasons":seasons,
               "coverage":{"plannedRequests":len(manifest["sources"]),"verifiedSnapshots":len(entries),
                           "monthlySamples":sum(r["phase"]!="reference" for r,s in published),
                           "months":sorted({e["date"][:7] for e in entries}),
                           "missingRequests":[{"id":r["id"],"status":r["download_status"],"error":r.get("error") or r.get("extraction_error")}
                                              for r in manifest["sources"] if r["id"] not in {e["id"] for e in entries}]},
               "datasets":[{"id":r["id"],"date":r["date"],"downloadStatus":r["download_status"],
                            "extractionStatus":r["extraction_status"],"published":r["id"] in {e["id"] for e in entries}}
                           for r in manifest["sources"]],
               "snapshots":entries,"comparisons":comparisons,"unavailableComparisons":unavailable_comparisons,
               "compatibilityGroups":[{"modelSource":key,"snapshotIds":[s["id"] for r,s in published if s["source"]["modelSource"]==key]}
                                      for key in dict.fromkeys(s["source"]["modelSource"] for r,s in published)],
               "seasonSummaries":[],"warnings":COMMON_WARNINGS,
               "summaryPolicy":"No seasonal mean layers generated; three dates per season are sparse selected snapshots, not full meteorological seasons."}
    write_or_check(WEB/"catalog.json",catalog,check)
    if not check:
        inventory(manifest)
    print(json.dumps({"snapshots":len(entries),"seasons":[s["key"] for s in seasons],
                      "months":catalog["coverage"]["months"],"comparisons":len(comparisons),
                      "catalog":relative(WEB/"catalog.json"),"check":check,"errors":errors},indent=2))
    if errors:
        raise SystemExit(1)


if __name__=="__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check",action="store_true",help="recompute every verified raw file and compare outputs without writing")
    args = parser.parse_args()
    with dataset_lock():
        publish(load_manifest(),args.check)
