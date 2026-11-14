"""Numerical regression checks using explicitly synthetic in-memory arrays only."""

import math
import sys
from pathlib import Path
import unittest

# Embedded CPython excludes the script directory from sys.path by default.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import extract_dust as dust
import numpy as np


class AggregationTests(unittest.TestCase):
    def test_spherical_area_mean_matches_independent_two_band_calculation(self):
        lat = np.array([20.0, 20.25])
        lon = np.array([0.0, 0.3125])
        synthetic = np.array([[0.0, 2.0], [4.0, 6.0]])
        value, evidence = dust.overlap_mean(synthetic, lat, lon, 19.875, 20.375, -0.15625, 0.46875)
        a = math.sin(math.radians(20.125)) - math.sin(math.radians(19.875))
        b = math.sin(math.radians(20.375)) - math.sin(math.radians(20.125))
        self.assertAlmostEqual(value, (a + 5 * b) / (a + b), places=13)
        self.assertEqual(evidence["native_contributors"], 4)
        self.assertEqual(evidence["invalid_contributors"], 0)

    def test_native_sample_on_target_edge_contributes_to_both_sides(self):
        synthetic = np.array([[0.0, 6.0, 0.0]])
        lat, lon = np.array([20.0]), np.array([-0.3125, 0.0, 0.3125])
        for west, east in [(-0.3125, 0.0), (0.0, 0.3125)]:
            value, _ = dust.overlap_mean(synthetic, lat, lon, 19.875, 20.125, west, east)
            self.assertAlmostEqual(value, 3.0)

    def test_missing_nonfinite_and_negative_contributors_propagate_without_filling(self):
        lat, lon = np.array([20.0]), np.array([0.0, 0.3125])
        arrays = [np.ma.array([[0.2, 1e15]], mask=[[False, True]]),
                  np.array([[0.2, np.nan]]), np.array([[0.2, np.inf]]), np.array([[0.2, -0.1]])]
        for synthetic in arrays:
            with self.subTest(array=str(synthetic)):
                value, evidence = dust.overlap_mean(synthetic, lat, lon, 19.875, 20.125, -0.15625, 0.46875)
                self.assertIsNone(value)
                self.assertEqual(evidence["invalid_contributors"], 1)
                self.assertIsNone(evidence["aot_times_solid_angle"])

    def test_zero_is_valid_and_incomplete_spatial_coverage_is_rejected(self):
        values, lat, lon = np.array([[0.0]]), np.array([20.0]), np.array([0.0])
        value, _ = dust.overlap_mean(values, lat, lon, 19.875, 20.125, -0.15625, 0.15625)
        self.assertEqual(value, 0)
        with self.assertRaisesRegex(ValueError, "Incomplete native spatial coverage"):
            dust.overlap_mean(values, lat, lon, 19.5, 20.5, -0.15625, 0.15625)

    def test_quick_uses_exact_child_groups_and_any_missing_child(self):
        # Binary fractions make the independently summed reference exact.
        cells = [dust.cell(i // 8, i % 8, 6, 8, i / 128) for i in range(48)]
        advanced = dust.grid(6, 8, cells, dust.ADVANCED_AGGREGATION)
        quick = dust.quick_grid(advanced)
        for parent in quick["cells"]:
            children = [c for c in cells if c["row"] // 2 == parent["row"] and c["col"] // 2 == parent["col"]]
            self.assertEqual(parent["value"], sum(c["value"] / 4 for c in children))
        for index in [0, 1, 8, 9]:
            candidate = {**advanced, "cells": [dict(c) for c in cells]}
            candidate["cells"][index]["value"] = None
            missing = dust.quick_grid(candidate)
            self.assertIsNone(missing["cells"][0]["value"])
            self.assertEqual(missing["cells"][0]["status"], "missing")
            self.assertNotIn([0, 0], missing["truth"]["present"])
            self.assertTrue(all(c["value"] is not None for c in missing["cells"][1:]))

    def test_threshold_is_inclusive_and_missing_is_distinct_from_zero(self):
        cells = [dust.cell(0, i, 1, 4, v) for i, v in enumerate([None, 0.0, 0.199, 0.2])]
        result = dust.grid(1, 4, cells, "synthetic unit-test inputs")
        self.assertEqual([c["status"] for c in cells], ["missing", "below_threshold", "below_threshold", "measured"])
        self.assertEqual(result["truth"]["present"], [[0, 3]])


if __name__ == "__main__":
    unittest.main(verbosity=2)
