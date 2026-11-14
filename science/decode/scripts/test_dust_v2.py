"""Dust V2 numerical/acquisition unit tests and explicit local real-data checks.

Synthetic test buffers live only in temporary ignored directories; no fabricated
NASA outputs are published. Restore the raw archive before running real-data tests.
"""
import hashlib
import io
import math
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parent))
import dust_common as common
import dust_archive as archive
import dust_process as process
import numpy as np


class SpatialTemporalTests(unittest.TestCase):
    def test_writer_lock_rejects_concurrent_mutations_and_releases(self):
        with common.dataset_lock():
            with self.assertRaisesRegex(RuntimeError,"writer lock"):
                with common.dataset_lock():
                    self.fail("Second writer acquired the same lock")
        with common.dataset_lock():
            pass

    def test_winter_rollover_and_season_partition(self):
        self.assertEqual(common.season("2024-12-15"),common.season("2025-01-15"))
        self.assertEqual(common.season("2025-02-28")["key"],"winter-2024-2025")
        for day,name in [("2025-03-01","spring"),("2025-06-01","summer"),("2025-09-01","autumn"),("2025-12-01","winter")]:
            self.assertEqual(common.season(day)["name"],name)
        for day,center in [("2025-02-30","19:30"),("2025-01-15","25:00"),("2025-01-15","1:30")]:
            with self.assertRaises(ValueError):
                common.request_id(day,center)

    def test_grid_centers_bounds_adjacency_and_orientation(self):
        g=common.geometry()
        self.assertEqual((g["rows"],g["cols"],len(g["cells"])),(25,40,1000))
        for i,c in enumerate(g["cells"]):
            self.assertEqual((c["row"],c["col"]),divmod(i,40))
            b=c["bounds"]
            self.assertAlmostEqual(c["lat"],(b["north"]+b["south"])/2)
            self.assertEqual(c["lon"],(b["west"]+b["east"])/2)
            self.assertAlmostEqual(b["north"]-b["south"],1.2)
            self.assertEqual(b["east"]-b["west"],1.75)
            if c["col"]<39:
                self.assertEqual(b["east"],g["cells"][i+1]["bounds"]["west"])
            if c["row"]<24:
                self.assertEqual(b["south"],g["cells"][i+40]["bounds"]["north"])
        self.assertEqual(g["cells"][0]["bounds"]["north"],45)
        self.assertEqual(g["cells"][-1]["bounds"]["south"],15)

    def test_1000_cells_conserve_native_area_integral(self):
        lat=np.arange(121)*.25+15
        lon=np.arange(225)*.3125-20
        synthetic=.1+lat[:,None]*.01+lon[None,:]*.001
        integrals,areas=[],[]
        for c in common.geometry()["cells"]:
            b=c["bounds"]
            v,e=common.overlap_mean(synthetic,lat,lon,b["south"],b["north"],b["west"],b["east"])
            integrals.append(v*e["overlap_solid_angle_sr"])
            areas.append(e["overlap_solid_angle_sr"])
        whole,e=common.overlap_mean(synthetic,lat,lon,15,45,-20,50)
        self.assertAlmostEqual(math.fsum(areas),e["overlap_solid_angle_sr"],places=13)
        self.assertAlmostEqual(math.fsum(integrals),whole*e["overlap_solid_angle_sr"],places=13)

    def test_actual_zero_is_available_invalid_overlap_is_missing(self):
        lat=np.arange(121)*.25+15
        lon=np.arange(225)*.3125-20
        synthetic=np.zeros((121,225))
        b=common.geometry()["cells"][0]["bounds"]
        args=(lat,lon,b["south"],b["north"],b["west"],b["east"])
        self.assertEqual(common.overlap_mean(synthetic,*args)[0],0)
        synthetic[-1,0]=float("nan")
        self.assertIsNone(common.overlap_mean(synthetic,*args)[0])


class AcquisitionTests(unittest.TestCase):
    def setUp(self):
        cache=common.ROOT/".cache"
        cache.mkdir(exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=cache)
        self.addCleanup(self.temp.cleanup)
        self.dest=Path(self.temp.name)/"synthetic-unit-test.bin"
        self.payload=b"explicitly synthetic unit-test bytes, not NASA data"
        self.remote={"size_bytes":len(self.payload),"etag":'"unit-test"',"last_modified":"unit-test"}
        self.record={"id":"synthetic-test", "local_path":common.relative(self.dest),
                     "download_url":common.ARCHIVE_URL+"synthetic-unit-test.bin", "remote":self.remote}

    def response(self,data,status=200,headers=None):
        value=io.BytesIO(data)
        value.status=status
        value.headers=headers or {}
        return value

    def partial(self,offset):
        p=self.dest.with_name(self.dest.name+".part")
        p.write_bytes(self.payload[:offset])
        common.save(p.with_name(p.name+".json"),{"url":self.record["download_url"],**self.remote})

    def transfer(self,response):
        with patch.object(archive,"remote_headers",return_value=self.remote), \
             patch.object(archive,"inspect_netcdf",return_value={"compatibility_warnings":[]}), \
             patch.object(archive,"open_url",return_value=response) as network:
            archive.transfer(self.record)
        return network

    def test_resume_uses_range_and_validator_then_promotes_atomically(self):
        offset=9
        self.partial(offset)
        network=self.transfer(self.response(self.payload[offset:],206,
                    {"Content-Range":f"bytes {offset}-{len(self.payload)-1}/{len(self.payload)}"}))
        self.assertEqual(network.call_args.kwargs["headers"]["Range"],"bytes=9-")
        self.assertEqual(network.call_args.kwargs["headers"]["If-Range"],self.remote["etag"])
        self.assertEqual(self.dest.read_bytes(),self.payload)
        self.assertEqual(self.record["sha256"],hashlib.sha256(self.payload).hexdigest())
        self.assertFalse(self.dest.with_name(self.dest.name+".part").exists())

    def test_server_ignoring_resume_restarts_without_concatenation(self):
        self.partial(9)
        self.transfer(self.response(self.payload,200))
        self.assertEqual(self.dest.read_bytes(),self.payload)

    def test_invalid_range_or_changed_digest_is_not_promoted(self):
        self.partial(9)
        with self.assertRaisesRegex(ValueError,"Unsafe resume"):
            self.transfer(self.response(self.payload[9:],206,{"Content-Range":"bytes 0-1/2"}))
        self.assertFalse(self.dest.exists())
        self.record["sha256"]="0"*64
        with self.assertRaisesRegex(ValueError,"differs from recorded SHA256"):
            self.transfer(self.response(self.payload,200))
        self.assertFalse(self.dest.exists())

    def test_changed_remote_identity_requires_rediscovery(self):
        with patch.object(archive,"remote_headers",return_value={**self.remote,"etag":"changed"}):
            with self.assertRaisesRegex(ValueError,"changed since discovery"):
                archive.transfer(self.record)

    def test_budget_refuses_unbounded_unavailable_or_excessive_batch(self):
        records=[self.record]
        self.assertEqual(archive.check_budget(records,1,1000,2**32)["parallel_downloads"],1)
        for count,size,free in [(0,1000,2**32),(1,1,2**32),(1,1000,1)]:
            with self.assertRaisesRegex(ValueError,"exceeds"):
                archive.check_budget(records,count,size,free)
        with self.assertRaisesRegex(ValueError,"Discover"):
            archive.check_budget([{"download_url":None}],1,1000,2**32)

    def test_no_network_or_duplicate_bytes_for_complete_partial(self):
        self.partial(len(self.payload))
        network=self.transfer(self.response(b"unused"))
        network.assert_not_called()
        self.assertEqual(self.dest.read_bytes(),self.payload)

    def test_payload_byte_cap_retains_only_a_resumable_partial(self):
        remaining={"bytes":5}
        with patch.object(archive,"remote_headers",return_value=self.remote), \
             patch.object(archive,"open_url",return_value=self.response(self.payload)):
            with self.assertRaisesRegex(ValueError,"byte cap exhausted"):
                archive.transfer(self.record,remaining)
        self.assertEqual(remaining["bytes"],0)
        self.assertFalse(self.dest.exists())
        self.assertEqual(self.dest.with_name(self.dest.name+".part").read_bytes(),self.payload[:5])

    def test_failed_atomic_replace_preserves_previous_output(self):
        self.dest.write_bytes(b"previous unit-test output")
        with patch.object(common.os,"replace",side_effect=OSError("synthetic interrupted promotion")):
            with self.assertRaises(OSError):
                common.atomic(self.dest,b"new unit-test output")
        self.assertEqual(self.dest.read_bytes(),b"previous unit-test output")


class RealArchiveTests(unittest.TestCase):
    def test_every_published_source_matches_real_raw_sha_and_metadata(self):
        manifest=common.load_manifest()
        verified=[r for r in manifest["sources"] if r["download_status"]=="verified"]
        self.assertGreaterEqual(len(verified),5,"Restore the pilot archive first")
        for record in verified:
            with self.subTest(id=record["id"]):
                common.verify_record(record)
                self.assertEqual(record["season"],common.season(record["date"]))

    def test_real_grid_cell_agrees_with_independent_scalar_native_overlap(self):
        manifest=common.load_manifest()
        for record in manifest["sources"]:
            if record["extraction_status"]!="verified":
                continue
            asset=common.read(common.REPO/record["publication"]["path"])
            weighted,area=0.0,0.0
            with common.netCDF4.Dataset(common.REPO/record["local_path"]) as source:
                # First cell is north 45, south 43.8, west -20, east -18.25.
                for yi in range(535,541):
                    lat=float(source["lat"][yi])
                    south,north=max(lat-.125,43.8),min(lat+.125,45)
                    if north<=south: continue
                    for xi in range(512,519):
                        lon=float(source["lon"][xi])
                        west,east=max(lon-.15625,-20),min(lon+.15625,-18.25)
                        if east<=west: continue
                        weight=math.radians(east-west)*(math.sin(math.radians(north))-math.sin(math.radians(south)))
                        value=float(source["DUEXTTAU"][0,yi,xi])
                        weighted+=weight*value
                        area+=weight
            self.assertAlmostEqual(asset["values"][0],weighted/area,places=13)

    def test_original_case_and_legacy_source_remain_identical(self):
        from extract_dust import SOURCE,SOURCE_SHA256,CASE_PATH
        self.assertEqual(common.sha(SOURCE),SOURCE_SHA256)
        self.assertEqual(hashlib.sha256(CASE_PATH.read_text(encoding="utf-8").encode()).hexdigest(),
                         "7f71da5fe3b10af60e6e78f169d2a68578f67d5d33c4717b1bc047023b5ca582")


if __name__=="__main__":
    unittest.main(verbosity=2)
