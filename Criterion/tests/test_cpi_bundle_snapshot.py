"""Regression checks for the EURUSD CPI-bundle chart-audit publication."""

import hashlib
import bisect
import json
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "Criterion/tools"))
from build_cpi_bundle_snapshot import build, DEFAULT_RESEARCH_ROOT  # noqa: E402


class CpiBundleSnapshotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.path = ROOT / "frontend/public/criterion/eurusd_cpi_bundle_v3.json"
        cls.raw = cls.path.read_bytes()
        cls.data = json.loads(cls.raw)
        cls.manifest = json.loads((ROOT / "frontend/src/criterion/cpi-bundle-manifest.json").read_text())

    def test_published_hash_scope_and_source(self):
        self.assertEqual(hashlib.sha256(self.raw).hexdigest(), self.manifest["snapshotSha256"])
        self.assertEqual(self.data["sourceSha256"], self.manifest["sourceTrialSha256"])
        self.assertEqual(self.data["status"], "EXPLORATORY_UNREGISTERED")
        self.assertEqual(self.data["selectionPolicy"], "NONE")
        self.assertEqual(len(self.data["episodes"]), 139)
        self.assertEqual(len(self.data["trials"]), 936)
        self.assertEqual(len(self.data["summaries"]), 1872)

    def test_every_displayed_rule_reconciles(self):
        episodes = self.data["episodes"]
        for key, summary in self.data["summaries"].items():
            panel, cell = key.split("|", 1)
            trials = [t for t in self.data["trials"][cell]
                      if panel == "FULL_PANEL" or not episodes[t[0]]["claimsCollision"]]
            self.assertEqual(len(trials), summary["trades"], key)
            self.assertEqual(len({t[0] for t in trials}), summary["bundles"], key)
            self.assertEqual(sum(t[2] == 0 for t in trials), summary["tp"], key)
            self.assertEqual(sum(t[2] == 1 for t in trials), summary["sl"], key)
            self.assertEqual(sum(t[2] == 2 for t in trials), summary["expiry"], key)
            self.assertLessEqual(abs(sum(t[4] for t in trials) - summary["grossR"]), 0.0002, key)

    def test_known_conflict_keeps_both_directions(self):
        index = next(i for i, episode in enumerate(self.data["episodes"])
                     if episode["releaseText"] == "2026.05.12 15:30:00")
        episode = self.data["episodes"][index]
        self.assertEqual([reading["delta"] for reading in episode["readings"]], [-0.3, 0.2, 0.5, 0.2])
        headline = next(t for t in self.data["trials"]["CONFLICT_SUBSTUDY_A_HEADLINE|60|2:2"] if t[0] == index)
        core = next(t for t in self.data["trials"]["CONFLICT_SUBSTUDY_B_CORE|60|2:2"] if t[0] == index)
        self.assertEqual((headline[1], core[1]), (1, -1))
        self.assertEqual((headline[2], core[2]), (1, 0))

    def test_yoy_only_release_is_context_not_priced_mm_trial(self):
        index = next(i for i, episode in enumerate(self.data["episodes"])
                     if episode["releaseText"] == "2025.12.18 16:30:00")
        episode = self.data["episodes"][index]
        self.assertEqual([reading["delta"] for reading in episode["readings"]],
                         [None, None, -0.3, -0.4])
        self.assertEqual(episode["concordance"], "MISSING_ANCHOR")
        self.assertTrue(episode["claimsCollision"])
        self.assertIsNone(episode["atr"])
        self.assertFalse(any(trial[0] == index for trials in self.data["trials"].values()
                             for trial in trials))

    def test_every_bundle_episode_has_an_h240_chart_path(self):
        baseline = json.loads((ROOT / "frontend/public/criterion/eurusd_cpi_nfp_v2.json").read_text())
        self.assertEqual(self.data["candlesSha256"], baseline["candlesSha256"].lower())
        times = [bar[0] for bar in baseline["bars"]]
        for episode in self.data["episodes"]:
            pos = bisect.bisect_left(times, episode["entryTime"])
            self.assertLess(pos + 240, len(times) + 1, episode["id"])
            self.assertEqual(times[pos], episode["entryTime"], episode["id"])
            self.assertAlmostEqual(baseline["bars"][pos][1], episode["entryPrice"], places=8)

    def test_rebuild_is_byte_identical(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "snapshot.json"
            build(DEFAULT_RESEARCH_ROOT, path)
            self.assertEqual(path.read_bytes(), self.raw)


if __name__ == "__main__":
    unittest.main()
