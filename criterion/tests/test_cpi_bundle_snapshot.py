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
from build_cpi_bundle_snapshot import build, explain_exclusion, DEFAULT_RESEARCH_ROOT  # noqa: E402


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

    def test_six_interpretations_and_both_claims_counts(self):
        expected_counts = {
            "CANDIDATE_1_HEADLINE_MM": (123, 96, 27),
            "CANDIDATE_2_CORE_MM_LED": (94, 74, 20),
            "CANDIDATE_3_CONCORDANT_MM": (59, 51, 8),
            "CANDIDATE_4_CONFLICT_FILTERED_HEADLINE": (95, 77, 18),
            "CONFLICT_SUBSTUDY_A_HEADLINE": (28, 19, 9),
            "CONFLICT_SUBSTUDY_B_CORE": (28, 19, 9),
        }
        episodes = self.data["episodes"]
        for comp, (exp_full, exp_clean, exp_claims) in expected_counts.items():
            cell_trials = self.data["trials"][f"{comp}|60|2:2"]
            full_matching = [t for t in cell_trials]
            clean_matching = [t for t in full_matching if not episodes[t[0]]["claimsCollision"]]
            claims_matching = [t for t in full_matching if episodes[t[0]]["claimsCollision"]]
            self.assertEqual(len(full_matching), exp_full, f"{comp} full trials")
            self.assertEqual(len(clean_matching), exp_clean, f"{comp} clean trials")
            self.assertEqual(len(claims_matching), exp_claims, f"{comp} claims trials")

            # Check eligibility in episode metadata agrees
            eligible_episodes = [ep for ep in episodes if ep["eligibility"][comp]["eligible"]]
            clean_eligible = [ep for ep in eligible_episodes if not ep["claimsCollision"]]
            self.assertEqual(len(eligible_episodes), exp_full, f"{comp} eligible metadata")
            self.assertEqual(len(clean_eligible), exp_clean, f"{comp} clean eligible metadata")

    def test_concordant_breakdown_of_all_139_releases(self):
        episodes = self.data["episodes"]
        comp = "CANDIDATE_3_CONCORDANT_MM"
        matching = [ep for ep in episodes if ep["eligibility"][comp]["eligible"]]
        zero_change = [ep for ep in episodes if ep["eligibility"][comp]["category"] == "ZERO_CHANGE"]
        conflict = [ep for ep in episodes if ep["eligibility"][comp]["category"] == "CONFLICT_REJECTED"]
        missing = [ep for ep in episodes if ep["eligibility"][comp]["category"] == "MISSING_INPUTS"]

        self.assertEqual(len(matching), 59)
        self.assertEqual(len(zero_change), 51)
        self.assertEqual(len(conflict), 28)
        self.assertEqual(len(missing), 1)
        self.assertEqual(len(matching) + len(zero_change) + len(conflict) + len(missing), 139)

    def test_claims_coincidences_population(self):
        episodes = self.data["episodes"]
        claims_episodes = [ep for ep in episodes if ep["claimsCollision"]]
        self.assertEqual(len(claims_episodes), 33)

        # 32 have monthly CPI anchors, 1 is 2025-12-18
        with_anchors = [ep for ep in claims_episodes if ep["concordance"] != "MISSING_ANCHOR"]
        without_anchors = [ep for ep in claims_episodes if ep["concordance"] == "MISSING_ANCHOR"]
        self.assertEqual(len(with_anchors), 32)
        self.assertEqual(len(without_anchors), 1)
        self.assertEqual(without_anchors[0]["releaseText"], "2025.12.18 16:30:00")

    def test_rule_eligibility_matches_trial_availability_for_all_episodes(self):
        episodes = self.data["episodes"]
        for comp in (
            "CANDIDATE_1_HEADLINE_MM", "CANDIDATE_2_CORE_MM_LED",
            "CANDIDATE_3_CONCORDANT_MM", "CANDIDATE_4_CONFLICT_FILTERED_HEADLINE",
            "CONFLICT_SUBSTUDY_A_HEADLINE", "CONFLICT_SUBSTUDY_B_CORE",
        ):
            trial_indices = {t[0] for t in self.data["trials"][f"{comp}|60|2:2"]}
            for index, ep in enumerate(episodes):
                is_eligible = ep["eligibility"][comp]["eligible"]
                has_trial = index in trial_indices
                self.assertEqual(is_eligible, has_trial, f"{comp} ep {ep['id']}")
                if not is_eligible:
                    self.assertTrue(ep["eligibility"][comp]["reason"])
                    self.assertIn(ep["eligibility"][comp]["category"], (
                        "MISSING_INPUTS", "ZERO_CHANGE", "CONFLICT_REJECTED", "NON_CONFLICT", "COVERAGE_FAILURE"
                    ))

    def test_snapshot_data_claims_collision_and_pricing(self):
        episodes = self.data["episodes"]
        # Find an episode that has Claims collision and is eligible under Candidate 1
        claims_idx = next(i for i, ep in enumerate(episodes)
                          if ep["claimsCollision"] and ep["eligibility"]["CANDIDATE_1_HEADLINE_MM"]["eligible"])
        ep = episodes[claims_idx]

        # Under FULL_PANEL, it has a valid priced trial
        full_trials = [t for t in self.data["trials"]["CANDIDATE_1_HEADLINE_MM|60|2:2"] if t[0] == claims_idx]
        self.assertEqual(len(full_trials), 1)

        # Under JOBLESS_CLAIMS_CLEAN, it is excluded
        clean_trials = [t for t in full_trials if not ep["claimsCollision"]]
        self.assertEqual(len(clean_trials), 0)

        # Exclusion reason identifies simultaneous Jobless Claims
        self.assertTrue(ep["claimsCollision"])

    def test_overlapping_explanations_preserved_on_yoy_episode(self):
        index = next(i for i, ep in enumerate(self.data["episodes"])
                     if ep["releaseText"] == "2025.12.18 16:30:00")
        ep = self.data["episodes"][index]
        # Overlapping: both missing monthly readings and Claims collision
        self.assertEqual(ep["eligibility"]["CANDIDATE_3_CONCORDANT_MM"]["category"], "MISSING_INPUTS")
        self.assertEqual(ep["eligibility"]["CANDIDATE_3_CONCORDANT_MM"]["reason"], "Missing required monthly readings")
        self.assertTrue(ep["claimsCollision"])

    def test_snapshot_data_eligibility_across_interpretations(self):
        episodes = self.data["episodes"]
        # 1. Episode with zero core change:
        # e.g., Headline has positive delta, core has 0.0 delta
        zero_core_idx = next(i for i, ep in enumerate(episodes)
                             if ep["readings"][0]["delta"] is not None and ep["readings"][0]["delta"] != 0
                             and ep["readings"][1]["delta"] == 0)
        ep_zero = episodes[zero_core_idx]
        self.assertTrue(ep_zero["eligibility"]["CANDIDATE_1_HEADLINE_MM"]["eligible"])
        self.assertFalse(ep_zero["eligibility"]["CANDIDATE_2_CORE_MM_LED"]["eligible"])
        self.assertEqual(ep_zero["eligibility"]["CANDIDATE_2_CORE_MM_LED"]["category"], "ZERO_CHANGE")
        self.assertIn("Zero monthly A−P change in core m/m", ep_zero["eligibility"]["CANDIDATE_2_CORE_MM_LED"]["reason"])
        self.assertFalse(ep_zero["eligibility"]["CANDIDATE_3_CONCORDANT_MM"]["eligible"])
        self.assertEqual(ep_zero["eligibility"]["CANDIDATE_3_CONCORDANT_MM"]["category"], "ZERO_CHANGE")

        # 2. Episode with conflict (2026.05.12):
        conf_idx = next(i for i, ep in enumerate(episodes)
                        if ep["releaseText"] == "2026.05.12 15:30:00")
        ep_conf = episodes[conf_idx]
        self.assertTrue(ep_conf["eligibility"]["CANDIDATE_1_HEADLINE_MM"]["eligible"])
        self.assertTrue(ep_conf["eligibility"]["CANDIDATE_2_CORE_MM_LED"]["eligible"])
        self.assertFalse(ep_conf["eligibility"]["CANDIDATE_3_CONCORDANT_MM"]["eligible"])
        self.assertEqual(ep_conf["eligibility"]["CANDIDATE_3_CONCORDANT_MM"]["category"], "CONFLICT_REJECTED")
        self.assertFalse(ep_conf["eligibility"]["CANDIDATE_4_CONFLICT_FILTERED_HEADLINE"]["eligible"])
        self.assertEqual(ep_conf["eligibility"]["CANDIDATE_4_CONFLICT_FILTERED_HEADLINE"]["category"], "CONFLICT_REJECTED")
        self.assertTrue(ep_conf["eligibility"]["CONFLICT_SUBSTUDY_A_HEADLINE"]["eligible"])
        self.assertTrue(ep_conf["eligibility"]["CONFLICT_SUBSTUDY_B_CORE"]["eligible"])

    def test_explain_exclusion_h60_zero_signal_with_missing_h240_coverage(self):
        # Synthetic check: H60 zero-signal exclusion must NOT be overwritten by missing H240 coverage
        synthetic_pair = {
            "has_entry_candle": "True",
            "is_entry_delay_valid": "True",
            "has_atr_warmup": "True",
            "has_h60_bars": "True",
            "has_h60_gap_free": "True",
            "has_h120_bars": "True",
            "has_h120_gap_free": "True",
            "has_h240_bars": "False",  # Missing H240 path
            "has_h240_gap_free": "False",
            "headline_mm_sign": "ZERO",
            "core_mm_sign": "POS",
            "is_conflict_episode": "False",
        }
        category, reason = explain_exclusion(synthetic_pair, "CANDIDATE_1_HEADLINE_MM", "excluded_zero_signal")
        self.assertEqual(category, "ZERO_CHANGE")
        self.assertEqual(reason, "Zero monthly A−P change in headline m/m (0.0 reading change)")

    def test_explain_exclusion_path_gap_exceeded(self):
        synthetic_pair = {
            "has_entry_candle": "True",
            "is_entry_delay_valid": "True",
            "has_atr_warmup": "True",
            "has_h60_bars": "True",
            "has_h60_gap_free": "False",
        }
        category, reason = explain_exclusion(synthetic_pair, "CANDIDATE_1_HEADLINE_MM", "excluded_path_gap_exceeded")
        self.assertEqual(category, "COVERAGE_FAILURE")
        self.assertEqual(reason, "Path-gap failure")

    def test_explain_exclusion_missing_monthly_readings_with_claims_collision(self):
        synthetic_pair = {
            "has_entry_candle": "True",
            "is_entry_delay_valid": "True",
            "has_atr_warmup": "True",
            "has_h60_bars": "True",
            "coincident_claims_collision": "True",
        }
        category, reason = explain_exclusion(synthetic_pair, "CANDIDATE_3_CONCORDANT_MM", "excluded_missing_anchor")
        self.assertEqual(category, "MISSING_INPUTS")
        self.assertEqual(reason, "Missing required monthly readings")

    def test_rebuild_is_byte_identical(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "snapshot.json"
            build(DEFAULT_RESEARCH_ROOT, path)
            self.assertEqual(path.read_bytes(), self.raw)


if __name__ == "__main__":
    unittest.main()
