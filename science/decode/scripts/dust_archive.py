"""Discover, budget, acquire/resume and inventory anonymous official NASA dust granules."""
from __future__ import annotations

import argparse
import http.client
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dust_common import *


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.links.extend(v for k,v in attrs if k == "href" and v)


def open_url(url, method="GET", headers=None):
    # This utility never sends credentials; constrain all requests to official archive.
    if not url.startswith(ARCHIVE_URL):
        raise ValueError("Only the official GEOS-FP archive is allowed")
    request = urllib.request.Request(url, method=method, headers={"User-Agent":"EARTHPULSE-M1-dust/2", **(headers or {})})
    response = urllib.request.urlopen(request, timeout=60)
    if not response.url.startswith(ARCHIVE_URL):
        response.close()
        raise ValueError("Unexpected redirect; authentication is not automated")
    return response


def remote_headers(url):
    with open_url(url, "HEAD") as r:
        size = int(r.headers.get("Content-Length", "0"))
        if not 0 < size <= 160_000_000:
            raise ValueError("Missing/oversized Content-Length; refusing unbounded transfer")
        return {"size_bytes":size,"etag":r.headers.get("ETag"),"last_modified":r.headers.get("Last-Modified")}


def init(plan_path):
    manifest = load_manifest()
    existing = {r["id"]:r for r in manifest["sources"]}
    for item in load_plan(plan_path)["requests"]:
        ident = request_id(item["date"],item["center"])
        if ident not in existing:
            existing[ident] = {"id":ident,**item,"season":season(item["date"]),
                "original_filename":None,"download_url":None,"local_path":None,
                "download_status":"not_discovered","size_bytes":None,"sha256":None,
                "metadata":None,"processed_path":relative(PROCESSED/(ident+".json")),
                "extraction_status":"pending","compatibility_warnings":[]}
    manifest["sources"] = sorted(existing.values(), key=lambda r:(r["date"],r["center"]))
    # Preserve the legacy source; a hardlink gives it a navigable archive path without duplicate disk allocation.
    from extract_dust import SOURCE, SOURCE_SHA256, SOURCE_URL, GRANULE
    original = next((r for r in manifest["sources"] if r["date"]=="2025-08-19" and r["center"]=="19:30"),None)
    if original and SOURCE.exists() and (original["download_status"] == "not_discovered"
                                        or not original.get("local_path") or not (REPO/original["local_path"]).exists()):
        if sha(SOURCE) != SOURCE_SHA256:
            raise ValueError("Legacy NASA source checksum mismatch")
        dest = RAW / "2025/08/19" / GRANULE
        dest.parent.mkdir(parents=True,exist_ok=True)
        if not dest.exists():
            try:
                os.link(SOURCE,dest)
                kind = "hardlink"
            except OSError:
                shutil.copyfile(SOURCE,dest)
                kind = "copy"
        else:
            kind = "existing"
        original.update(original_filename=GRANULE,download_url=SOURCE_URL,local_path=relative(dest),
                        download_status="verified",size_bytes=dest.stat().st_size,sha256=sha(dest),
                        legacy_path=relative(SOURCE),archive_import=kind,verified_at=now())
        original["metadata"] = inspect_netcdf(dest,original)
        original["compatibility_warnings"] = original["metadata"]["compatibility_warnings"]
    save(MANIFEST,manifest)
    return manifest


def selected(manifest,args):
    return [r for r in manifest["sources"] if (args.phase=="all" or r["phase"]==args.phase)
            and (not args.date or r["date"]==args.date)]


def discover(record):
    day = record["date"].split("-")
    index = ARCHIVE_URL+f"Y{day[0]}/M{day[1]}/D{day[2]}/"
    with open_url(index) as r:
        html = r.read(2_000_001)
    if len(html)>2_000_000:
        raise ValueError("Unexpectedly large archive index")
    parser = Links()
    parser.feed(html.decode("utf-8"))
    pattern = re.compile(r"GEOS\.fp\.asm\.tavg3_2d_aer_Nx\."+"".join(day)+"_"+record["center"].replace(":","")+r"\.V\d+\.nc4")
    names = sorted({link for link in parser.links if pattern.fullmatch(link)})
    if len(names)!=1:
        raise ValueError(f"Expected one actual archive link at requested center; found {len(names)}")
    name = names[0]
    url = urllib.parse.urljoin(index,name)
    headers = remote_headers(url)
    local = RAW / "/".join(day) / name
    atomic(local.parent / "_index.html",html)
    record.update(original_filename=name,download_url=url,local_path=relative(local),
                  download_status="available",remote=headers,
                  discovery={"index_url":index,"index_sha256":hashlib.sha256(html).hexdigest(),"checked_at":now()})


def transfer(record, remaining=None):
    dest = REPO / record["local_path"]
    dest.parent.mkdir(parents=True,exist_ok=True)
    headers = remote_headers(record["download_url"])
    if record.get("remote") and record["remote"]!=headers:
        raise ValueError("Remote size/ETag/Last-Modified changed since discovery; rediscover before download")
    partial = dest.with_name(dest.name+".part")
    state = partial.with_name(partial.name+".json")
    identity = {"url":record["download_url"],**headers}
    if partial.exists() and (not state.exists() or read(state)!=identity or partial.stat().st_size>headers["size_bytes"]):
        partial.unlink()
    save(state,identity)
    for attempt in range(3):
        offset = partial.stat().st_size if partial.exists() else 0
        if offset and offset != headers["size_bytes"] and not (headers["etag"] or headers["last_modified"]):
            partial.unlink()
            offset = 0  # No stable server validator: never append to an uncertain representation.
        if offset==headers["size_bytes"]:
            break
        request_headers = {"Range":f"bytes={offset}-", "If-Range":headers["etag"] or headers["last_modified"]} if offset else {}
        try:
            with open_url(record["download_url"],headers=request_headers) as response:
                mode = "ab" if offset and response.status==206 else "wb"
                if mode=="ab" and response.headers.get("Content-Range")!=f"bytes {offset}-{headers['size_bytes']-1}/{headers['size_bytes']}":
                    raise ValueError("Unsafe resume response Content-Range")
                if response.status not in (200,206):
                    raise ValueError("Unexpected transfer status")
                with partial.open(mode) as stream:
                    received = offset if mode=="ab" else 0
                    while received < headers["size_bytes"]:
                        amount = min(1024*1024, headers["size_bytes"]-received)
                        if remaining is not None:
                            if remaining["bytes"]<=0:
                                raise ValueError("Transfer byte cap exhausted; partial retained for resume")
                            amount = min(amount,remaining["bytes"])
                        block = response.read(amount)
                        if not block:
                            break
                        if remaining is not None:
                            remaining["bytes"] -= len(block)
                        received += len(block)
                        if received > headers["size_bytes"]:
                            raise ValueError("Transfer exceeded the budgeted Content-Length")
                        stream.write(block)
            if partial.stat().st_size != headers["size_bytes"]:
                raise OSError("Incomplete transfer; partial retained for resume")
            break
        except (OSError,urllib.error.URLError,http.client.HTTPException):
            if attempt==2:
                raise
            time.sleep(attempt+1)
    digest = sha(partial)
    if record.get("sha256") and digest!=record["sha256"]:
        raise ValueError("Restored source differs from recorded SHA256")
    metadata = inspect_netcdf(partial,record)
    os.replace(partial,dest)
    state.unlink(missing_ok=True)
    record.update(download_status="verified",size_bytes=dest.stat().st_size,sha256=digest,
                  metadata=metadata,verified_at=now(),compatibility_warnings=metadata["compatibility_warnings"])
    record.pop("error",None)


def inventory(manifest):
    verified = [r for r in manifest["sources"] if r["download_status"]=="verified"]
    lines = ["# NASA dust source inventory", "", "Selected three-hour snapshots, not seasonal averages. All times UTC.", "",
             f"Verified raw granules: **{len(verified)}**; total unique source bytes: **{sum(r['size_bytes'] for r in verified)}**. The legacy August alias is not counted twice.", "",
             "| Date / center | Season | Download / extraction | Bytes | Source SHA256 | Raw path | Processed output |",
             "|---|---|---|---:|---|---|---|"]
    for r in manifest["sources"]:
        lines.append(f"| {r['date']} {r['center']} | {r['season']['key']} | {r['download_status']} / {r['extraction_status']} | {r['size_bytes'] or ''} | {r['sha256'] or ''} | `{r['local_path'] or ''}` | `{r['processed_path']}` |")
        if r.get("error"):
            lines.append(f"\n{r['id']}: {r['error']}\n")
    lines += ["", "## Sources and compatibility", ""]
    for r in verified:
        lines.append(f"- [{r['original_filename']}]({r['download_url']}): `{r['metadata']['short_name']}`, version `{r['metadata']['version']}`, `{r['metadata']['model_source']}`.")
        for warning in r["compatibility_warnings"]:
            lines.append("  - "+warning)
    lines += ["", "Exact filenames, URLs, metadata, checksums, compatibility warnings and status: [dust-sources.json](manifests/dust-sources.json).", "",
              "List locally: `python science/decode/scripts/dust_archive.py inventory`.", "",
              "The original August 19 source remains at its legacy path; its dated archive entry is a hardlink when supported, otherwise a verified copy.", ""]
    atomic(ROOT/"dust-inventory.md","\n".join(lines).encode())


def check_budget(pending, max_files, max_bytes, free):
    if any(not r.get("remote") or not r["download_url"] for r in pending):
        raise ValueError("Discover all requested entries first; no guessed URLs are downloaded")
    estimated = sum(r["remote"]["size_bytes"] for r in pending)
    result = {"pending_files":len(pending),"estimated_max_download_bytes":estimated,
              "free_disk_bytes":free,"reserve_bytes":1_073_741_824,"parallel_downloads":1}
    if len(pending)>max_files or estimated>max_bytes or free<estimated+1_073_741_824:
        raise ValueError("Batch exceeds explicit file/byte/disk limits; no transfers started")
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("command",choices=["init","discover","acquire","verify","inventory"])
    p.add_argument("--plan",type=Path,default=PLAN)
    p.add_argument("--phase",choices=["all","pilot","monthly","reference"],default="all")
    p.add_argument("--date",help="optional single ISO date")
    p.add_argument("--max-files",type=int,default=1)
    p.add_argument("--max-bytes",type=int,default=160_000_000)
    p.add_argument("--refresh-compatibility",action="store_true",help="update compatibility policy only after unchanged bytes and factual metadata are verified")
    p.add_argument("--dry-run",action="store_true",help="for acquire: print verified HEAD-size/disk budget, do not transfer")
    args = p.parse_args()
    if args.max_files < 0 or args.max_bytes < 0:
        p.error("Download limits must be nonnegative")
    manifest = init(args.plan)
    records = selected(manifest,args)
    remaining = {"bytes":args.max_bytes}
    if args.command=="acquire":
        pending = [r for r in records if not (r["download_status"]=="verified" and r["local_path"] and (REPO/r["local_path"]).exists())]
        budget = check_budget(pending,args.max_files,args.max_bytes,shutil.disk_usage(ROOT).free)
        print(json.dumps(budget),flush=True)
        if args.dry_run:
            inventory(manifest)
            return
    failed = 0
    for record in records:
        try:
            if args.command=="discover" and (record["download_status"]!="verified"
                    or not record.get("local_path") or not (REPO/record["local_path"]).exists()):
                discover(record)
            elif args.command=="acquire":
                if record["download_status"]=="verified" and (REPO/record["local_path"]).exists():
                    verify_record(record)
                else:
                    print("downloading "+record["id"],flush=True)
                    transfer(record,remaining)
            elif args.command=="verify" and record.get("sha256"):
                if args.refresh_compatibility:
                    path = REPO/record["local_path"]
                    if path.stat().st_size!=record["size_bytes"] or sha(path)!=record["sha256"]:
                        raise ValueError("Cannot refresh policy: source integrity failed")
                    meta = inspect_netcdf(path,record)
                    factual = lambda m: {k:v for k,v in m.items() if k not in ("compatible","compatibility_warnings")}
                    if factual(meta)!=factual(record["metadata"]):
                        raise ValueError("Cannot refresh policy: factual metadata changed")
                    record.update(metadata=meta,compatibility_warnings=meta["compatibility_warnings"])
                else:
                    verify_record(record)
            if args.command in ("discover","acquire","verify"):
                print(f"{record['id']}: {record['download_status']} {record.get('size_bytes') or record.get('remote',{}).get('size_bytes','')}",flush=True)
        except Exception as error:
            failed += 1
            record["error"] = f"{type(error).__name__}: {error}"
            record["download_status"] = "unavailable" if args.command=="discover" else "failed"
            record["extraction_status"] = "pending"
            print(record["id"]+": "+record["error"],flush=True)
        save(MANIFEST,manifest)
    inventory(manifest)
    if args.command=="inventory":
        for r in records:
            print(f"{r['id']} | {r['download_status']} | {r['extraction_status']} | {r['local_path']} -> {r['processed_path']}")
        print("total_verified_bytes="+str(sum(r["size_bytes"] or 0 for r in records if r["download_status"]=="verified")))
    if failed:
        raise SystemExit(1)


if __name__=="__main__":
    with dataset_lock():
        main()
