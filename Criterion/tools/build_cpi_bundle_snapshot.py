"""Publish the pinned EURUSD CPI-bundle V3 trials for chart inspection.

This extracts existing research results; it does not recalculate or select a setup.
"""

from __future__ import annotations

import csv
import hashlib
import json
from collections import defaultdict
from pathlib import Path

from build_audit_snapshot import DEFAULT_RESEARCH_ROOT, EXPECTED_CANDLES_SHA256, load_bars, sha256


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "frontend/public/criterion/eurusd_cpi_bundle_v3.json"
STUDY = Path("Research Candidate/CPI/CPI_BUNDLE_V1")
PRE = STUDY / "run_20260930_pre_outcome"
RUN = STUDY / "run_20260930_outcomes_v3"
COMPARISONS = (
    "CANDIDATE_1_HEADLINE_MM", "CANDIDATE_2_CORE_MM_LED",
    "CANDIDATE_3_CONCORDANT_MM", "CANDIDATE_4_CONFLICT_FILTERED_HEADLINE",
    "CONFLICT_SUBSTUDY_A_HEADLINE", "CONFLICT_SUBSTUDY_B_CORE",
)

COMPARISON_SOURCE_COLS = {
    "CANDIDATE_1_HEADLINE_MM": ("eligible_candidate_1_headline_mm_h60", "exclusion_candidate_1_headline_mm_h60"),
    "CANDIDATE_2_CORE_MM_LED": ("eligible_candidate_2_core_mm_led_h60", "exclusion_candidate_2_core_mm_led_h60"),
    "CANDIDATE_3_CONCORDANT_MM": ("eligible_candidate_3_concordant_mm_h60", "exclusion_candidate_3_concordant_mm_h60"),
    "CANDIDATE_4_CONFLICT_FILTERED_HEADLINE": ("eligible_candidate_4_conflict_filtered_headline_h60", "exclusion_candidate_4_conflict_filtered_headline_h60"),
    "CONFLICT_SUBSTUDY_A_HEADLINE": ("eligible_conflict_substudy_h60", "exclusion_conflict_substudy_h60"),
    "CONFLICT_SUBSTUDY_B_CORE": ("eligible_conflict_substudy_h60", "exclusion_conflict_substudy_h60"),
}


def explain_exclusion(pair: dict[str, str], comp: str, ex_code: str) -> tuple[str, str]:
    if ex_code == "excluded_missing_anchor":
        return "MISSING_INPUTS", "Missing required monthly readings"

    if ex_code == "excluded_no_entry_candle":
        return "COVERAGE_FAILURE", "Missing entry candle"
    if ex_code == "excluded_entry_delay_exceeded":
        return "COVERAGE_FAILURE", "Invalid entry delay"
    if ex_code == "excluded_insufficient_atr_warmup":
        return "COVERAGE_FAILURE", "Insufficient ATR warmup"
    if ex_code == "excluded_path_gap_exceeded":
        return "COVERAGE_FAILURE", "Path-gap failure"
    if ex_code == "excluded_insufficient_horizon_bars":
        return "COVERAGE_FAILURE", "Insufficient horizon bars"

    if ex_code == "excluded_zero_signal":
        if comp == "CANDIDATE_1_HEADLINE_MM":
            return "ZERO_CHANGE", "Zero monthly A−P change in headline m/m (0.0 reading change)"
        if comp == "CANDIDATE_2_CORE_MM_LED":
            return "ZERO_CHANGE", "Zero monthly A−P change in core m/m (0.0 reading change)"
        if comp == "CANDIDATE_4_CONFLICT_FILTERED_HEADLINE":
            return "ZERO_CHANGE", "Zero monthly A−P change in headline m/m (0.0 reading change)"
        return "ZERO_CHANGE", "Zero monthly A−P change in required series (0.0 reading change)"

    if ex_code == "excluded_discordant_or_zero":
        h_sign = pair.get("headline_mm_sign")
        c_sign = pair.get("core_mm_sign")
        if h_sign == "ZERO" and c_sign == "ZERO":
            return "ZERO_CHANGE", "Zero monthly A−P change in both headline and core m/m (0.0 reading change)"
        if h_sign == "ZERO":
            return "ZERO_CHANGE", "Zero monthly A−P change in headline m/m (0.0 reading change)"
        if c_sign == "ZERO":
            return "ZERO_CHANGE", "Zero monthly A−P change in core m/m (0.0 reading change)"
        if pair.get("is_conflict_episode") == "True":
            return "CONFLICT_REJECTED", "Headline/core conflict rejected by this interpretation"
        return "CONFLICT_REJECTED", "Headline/core conflict rejected by this interpretation"

    if ex_code == "excluded_conflict_filter":
        return "CONFLICT_REJECTED", "Headline/core conflict rejected by this interpretation"

    if ex_code == "excluded_non_conflict_episode":
        return "NON_CONFLICT", "Nonconflicting release under a conflict-only interpretation"

    if ex_code == "excluded_post_2026_cutoff":
        return "POST_CUTOFF", "Post-2026 research cutoff"

    # Fallback to physical gates if ex_code is unmapped or generic
    if pair.get("has_entry_candle") != "True":
        return "COVERAGE_FAILURE", "Missing entry candle"
    if pair.get("is_entry_delay_valid") != "True":
        return "COVERAGE_FAILURE", "Invalid entry delay"
    if pair.get("has_atr_warmup") != "True":
        return "COVERAGE_FAILURE", "Insufficient ATR warmup"
    if pair.get("has_h60_gap_free") != "True":
        return "COVERAGE_FAILURE", "Path-gap failure"
    if pair.get("has_h60_bars") != "True":
        return "COVERAGE_FAILURE", "Insufficient horizon bars"

    return "UNKNOWN", f"Excluded: {ex_code}"


def rows(path: Path):
    with path.open(encoding="utf-8-sig", newline="") as stream:
        yield from csv.DictReader(stream)


def check_hash(path: Path, expected: str):
    actual = sha256(path)
    if actual.upper() != expected.upper():
        raise ValueError(f"Pinned source hash mismatch: {path}")
    return actual.lower()


def number(value: str):
    return float(value) if value else None


def build(research_root: Path = DEFAULT_RESEARCH_ROOT, output: Path = OUTPUT):
    pre_manifest = json.loads((research_root / PRE / "manifest.json").read_text(encoding="utf-8"))
    run_manifest = json.loads((research_root / RUN / "manifest.json").read_text(encoding="utf-8"))
    pre_hashes = pre_manifest["artifacts"]
    run_hashes = run_manifest["generated_artifacts"]
    bundle_path = research_root / PRE / "cpi_bundle_ledger.csv"
    pair_path = research_root / PRE / "cpi_pair_expanded_ledger.csv"
    trial_path = research_root / RUN / "trial_ledger.csv"
    summary_path = research_root / RUN / "summary_grid_results.csv"
    bundle_hash = check_hash(bundle_path, pre_hashes["cpi_bundle_ledger_csv"]["sha256"])
    pair_hash = check_hash(pair_path, pre_hashes["cpi_pair_expanded_ledger_csv"]["sha256"])
    trial_hash = check_hash(trial_path, run_hashes["trial_ledger.csv"]["sha256"])
    summary_hash = check_hash(summary_path, run_hashes["summary_grid_results.csv"]["sha256"])
    candle = research_root / "raw_data/FyodorResearchExport_v4_20260928_021936_79538281_server/candles/candles_EURUSD_H1.csv"
    bars, by_time = load_bars(candle)  # independently checks the same pinned H1 hash as the legacy chart
    if sha256(candle).lower() != EXPECTED_CANDLES_SHA256.lower():
        raise ValueError("EURUSD chart candles differ from the existing Criterion snapshot")

    bundles = {row["bundle_id"]: row for row in rows(bundle_path)}
    episodes = []
    index = {}
    for pair in rows(pair_path):
        if pair["pair"] != "EURUSD" or pair["cohort"] == "POST_CUTOFF_2026":
            continue
        bundle = bundles[pair["bundle_id"]]
        if pair["timestamp"] != bundle["timestamp"]:
            raise ValueError("Pair and CPI bundle timestamps disagree")
        entry_time = int(pair["entry_bar_timestamp"]) if pair["entry_bar_timestamp"] else None
        entry = by_time.get(entry_time) if entry_time else None
        eligibility = {}
        for comp in COMPARISONS:
            el_col, ex_col = COMPARISON_SOURCE_COLS[comp]
            is_eligible = pair[el_col] == "True"
            ex_code = pair[ex_col]
            if is_eligible:
                eligibility[comp] = {
                    "eligible": True,
                    "exclusion": "",
                    "category": "ELIGIBLE",
                    "reason": "Included under selected rule",
                }
            else:
                cat, reason = explain_exclusion(pair, comp, ex_code)
                eligibility[comp] = {
                    "eligible": False,
                    "exclusion": ex_code,
                    "category": cat,
                    "reason": reason,
                }
        episode = {
            "id": pair["bundle_id"], "releaseTime": int(pair["timestamp"]),
            "releaseText": pair["timestamp_server_text"], "entryTime": entry_time,
            "entryText": pair["entry_bar_server_text"], "year": int(pair["year"]),
            "entryPrice": entry[1] if entry else None, "atr": None,
            "claimsCollision": pair["coincident_claims_collision"] == "True",
            "conflict": pair["is_conflict_episode"] == "True",
            "concordance": pair["mm_concordance_state"],
            "readings": [
                {"name": name, "actual": number(bundle[f"{prefix}_actual"]),
                 "previous": number(bundle[f"{prefix}_previous"]),
                 "delta": number(bundle[f"{prefix}_delta"]),
                 "sign": bundle[f"{prefix}_sign"]}
                for name, prefix in (("Headline m/m", "headline_mm"), ("Core m/m", "core_mm"),
                                     ("Headline y/y", "headline_yy"), ("Core y/y", "core_yy"))
            ],
            "eligibility": eligibility,
            "exclusions": {comp: pair[ex_col] for comp, (_, ex_col) in COMPARISON_SOURCE_COLS.items()},
            "coverage": {
                "hasEntryCandle": pair["has_entry_candle"] == "True",
                "hasAtrWarmup": pair["has_atr_warmup"] == "True",
                "hasH60Bars": pair["has_h60_bars"] == "True",
                "hasH60GapFree": pair["has_h60_gap_free"] == "True",
                "hasH120Bars": pair["has_h120_bars"] == "True",
                "hasH120GapFree": pair["has_h120_gap_free"] == "True",
                "hasH240Bars": pair["has_h240_bars"] == "True",
                "hasH240GapFree": pair["has_h240_gap_free"] == "True",
                "isEntryDelayValid": pair["is_entry_delay_valid"] == "True",
            },
            "headlineMmSign": pair["headline_mm_sign"],
            "coreMmSign": pair["core_mm_sign"],
            "headlineYySign": pair["headline_yy_sign"],
            "coreYySign": pair["core_yy_sign"],
        }
        index[episode["id"]] = len(episodes)
        episodes.append(episode)
    if len(episodes) != 139 or len(index) != 139:
        raise ValueError("Expected 139 in-cutoff EURUSD CPI bundle episodes")

    trials = defaultdict(list)
    directions = {}
    for row in rows(trial_path):
        if row["pair"] != "EURUSD":
            continue
        if row["bundle_id"] not in index:
            raise ValueError("Priced trial has no in-cutoff episode")
        episode_index = index[row["bundle_id"]]
        episode = episodes[episode_index]
        comparison = row["comparison_id"]
        if comparison not in COMPARISONS:
            raise ValueError(f"Unexpected comparison: {comparison}")
        direction = int(row["pair_direction"])
        if direction not in (-1, 1):
            raise ValueError("Priced trial has no direction")
        direction_key = (episode_index, comparison)
        if direction_key in directions and directions[direction_key] != direction:
            raise ValueError("One comparison changes direction across cells")
        directions[direction_key] = direction
        entry_price, atr = float(row["entry_price"]), float(row["atr"])
        if episode["entryPrice"] is None or abs(episode["entryPrice"] - entry_price) > 1e-8:
            raise ValueError("Trial entry differs from pinned EURUSD H1 open")
        if episode["atr"] is not None and abs(episode["atr"] - atr) > 1e-12:
            raise ValueError("One CPI episode has inconsistent ATR")
        episode["atr"] = atr
        horizon, stop, target = int(row["horizon_bars"]), float(row["stop_atr"]), float(row["target_atr"])
        if horizon not in (60, 120, 240) or stop not in (1, 2, 3, 4) or target not in [1 + i / 4 for i in range(13)]:
            raise ValueError("Unexpected horizon or ATR cell")
        kind = {"TARGET": 0, "TARGET_GAP": 0, "STOP": 1, "STOP_GAP": 1, "TIMEOUT": 2}[row["exit_reason"]]
        exit_h = int(row["exit_bar_idx"])
        if not 1 <= exit_h <= horizon:
            raise ValueError("Exit bar lies outside selected horizon")
        key = f"{comparison}|{horizon}|{stop:g}:{target:g}"
        trials[key].append([episode_index, direction, kind, exit_h, float(row["gross_r"]),
                            row["dual_touch"] == "True", row["is_opening_gap"] == "True"])

    summaries = {}
    for row in rows(summary_path):
        if row["pair"] != "EURUSD" or row["cohort_filter"] != "ALL_ELIGIBLE":
            continue
        comparison, panel = row["comparison_id"], row["panel"]
        horizon, stop, target = int(row["horizon_bars"]), float(row["stop_atr"]), float(row["target_atr"])
        cell = f"{comparison}|{horizon}|{stop:g}:{target:g}"
        picked = [t for t in trials[cell] if panel == "FULL_PANEL" or not episodes[t[0]]["claimsCollision"]]
        counts = (len(picked), sum(t[2] == 0 for t in picked), sum(t[2] == 1 for t in picked),
                  sum(t[2] == 2 for t in picked), sum(bool(t[5]) for t in picked))
        expected = tuple(int(row[k]) for k in ("N_trades", "N_wins", "N_losses", "N_timeouts", "N_dual_touch"))
        if counts != expected or len({t[0] for t in picked}) != int(row["N_bundles"]):
            raise ValueError(f"Count mismatch against source summary: {panel} {cell}")
        if abs(sum(t[4] for t in picked) - float(row["gross_sum_r"])) > 0.0002:
            raise ValueError(f"Gross R mismatch against source summary: {panel} {cell}")
        summaries[f"{panel}|{cell}"] = {
            "bundles": int(row["N_bundles"]), "trades": counts[0], "tp": counts[1],
            "sl": counts[2], "expiry": counts[3], "dual": counts[4],
            "grossR": float(row["gross_sum_r"]), "meanR": float(row["gross_mean_r"]),
            "loyo": row["loyo_positive_years"],
        }
    if len(summaries) != 1872 or len(trials) != 936 or sum(map(len, trials.values())) != 66612:
        raise ValueError("CPI bundle trial/summary matrix is incomplete")
    payload = {
        "schema": 1, "status": "EXPLORATORY_UNREGISTERED", "selectionPolicy": "NONE",
        "pair": "EURUSD", "study": "USD_CPI_BUNDLE_V1", "run": "run_20260930_outcomes_v3",
        "sourceSha256": trial_hash, "candlesSha256": EXPECTED_CANDLES_SHA256.lower(),
        "sourceHashes": {"bundle": bundle_hash, "pair": pair_hash, "trial": trial_hash, "summary": summary_hash},
        "episodes": episodes, "trials": trials, "summaries": summaries,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"Published {output}: {len(episodes)} episodes, {len(trials)} trial cells, {len(summaries)} summaries")
    return payload


if __name__ == "__main__":
    build()
