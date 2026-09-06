"""Measure price movement missed before the frozen H4 entry.

Uses the frozen H1 acquisition and trade directions. This measures historical
scheduled-release proxies and never claims package availability or a fill.
"""
import bisect
from collections import Counter
import json
from pathlib import Path
import statistics

from fms_entry_campaign import ROOT, digest, save
from fms_compare_entries import atr_values
from fms_compare_entries_session import weekend_gap


SOURCE = ROOT / "docs/Development Logs/artifacts/fms-entry-campaign-2026-09-06"


def distribution(values):
    values = sorted(values)
    if not values:
        return {"n": 0, "mean": None, "median": None, "positiveRate": None}
    return {"n": len(values), "mean": statistics.fmean(values), "median": statistics.median(values),
            "positiveRate": sum(value > 0 for value in values) / len(values)}


def main():
    source_manifest = json.loads((SOURCE / "manifest.json").read_text())
    active_review = json.loads((SOURCE / "active-entry-review.json").read_text())
    rules = {"schema": "fms-pre-h4-reaction-v1", "sourceManifestHash": source_manifest["manifestHash"],
        "activeEntryReviewHash": digest(active_review),
        "window": "First H1 open strictly after scheduled release through frozen H4 entry open",
        "normalization": "Completed H4 Wilder ATR14 known at first H1 open",
        "metrics": ["direction-adjusted H1-entry to H4-entry change", "maximum favorable excursion", "maximum adverse excursion"],
        "coverage": "Consecutive H1 observations required; declared weekend closure accepted only when applicable",
        "direction": "Frozen selected-contract trade direction",
        "limitations": ["Scheduled-release proxy does not prove package observation or fill.", "Reused historical archive; costs excluded."]}
    manifest_path = SOURCE / "pre-h4-reaction-manifest.json"
    if not manifest_path.exists():
        save(manifest_path, {**rules, "manifestHash": digest(rules)})
    frozen = json.loads(manifest_path.read_text()); manifest_hash = frozen.pop("manifestHash")
    if frozen != rules or digest(frozen) != manifest_hash:
        raise ValueError("Frozen pre-H4 reaction definition changed")
    recipes = json.loads((SOURCE / "recipes.json").read_text())
    checkpoint = json.loads((SOURCE / "fetch-checkpoint.json").read_text())
    by_market = {}
    for key, record in checkpoint.items():
        if "sha256" not in record: continue
        candles = json.loads((SOURCE / "candles" / f"{key}.json").read_text())
        assert digest(candles) == record["sha256"]
        target = by_market.setdefault(record["request"]["symbol"], {})
        for candle in candles: target[candle["time"]] = candle
    h4s = json.loads((SOURCE / "h4-snapshot.json").read_text())
    prepared = {}
    for market, keyed in by_market.items():
        h1 = sorted(keyed.values(), key=lambda row: row["time"]); h4 = h4s[market]
        prepared[market] = h1, [row["time"] for row in h1], [row["time"] for row in h4], atr_values(h4)
    findings = []
    for recipe in recipes:
        market = recipe["recipe"].split("|")[0]; rows = []; statuses = Counter()
        for case in recipe["cases"]:
            if market not in prepared:
                statuses["missing_market"] += 1; continue
            h1, h1_times, h4_times, atrs = prepared[market]
            h1_entry = (case["eventTime"] // 3600 + 1) * 3600
            h4_index = bisect.bisect_right(h4_times, case["eventTime"])
            if h4_index >= len(h4_times) or h4_times[h4_index] - case["eventTime"] > 14400:
                statuses["missing_h4_entry"] += 1; continue
            h4_entry = h4_times[h4_index]
            start = bisect.bisect_left(h1_times, h1_entry); end = bisect.bisect_left(h1_times, h4_entry)
            known = bisect.bisect_right(h4_times, h1_entry - 14400) - 1
            if start >= len(h1) or h1_times[start] != h1_entry:
                statuses["missing_h1_entry"] += 1; continue
            if known < 0 or atrs[known] is None or atrs[known] <= 0:
                statuses["missing_atr"] += 1; continue
            window = h1[start:end]
            if not window:
                # The entries coincide; no price reaction was missed.
                rows.append({"caseId": case["caseId"], "eventTime": case["eventTime"], "h1EntryTime": h1_entry,
                             "h4EntryTime": h4_entry, "entryDelayMinutes": 0, "closeChangeAtr": 0.0,
                             "maximumFavorableAtr": 0.0, "maximumAdverseAtr": 0.0})
                statuses["evaluated_same_open"] += 1; continue
            valid = all(window[i]["time"] == window[i-1]["time"] + 3600 or weekend_gap(window[i-1]["time"], window[i]["time"])
                        for i in range(1, len(window)))
            if not valid or window[-1]["time"] + 3600 != h4_entry:
                statuses["missing_path_hours"] += 1; continue
            sign = 1 if case["direction"] == "long" else -1; entry = window[0]["open"]; atr = atrs[known]
            h4_open = h4s[market][h4_index]["open"]
            favorable = max((row["high"] - entry) / atr if sign > 0 else (entry - row["low"]) / atr for row in window)
            adverse = max((entry - row["low"]) / atr if sign > 0 else (row["high"] - entry) / atr for row in window)
            rows.append({"caseId": case["caseId"], "eventTime": case["eventTime"], "h1EntryTime": h1_entry,
                         "h4EntryTime": h4_entry, "entryDelayMinutes": (h4_entry-h1_entry)//60,
                         "closeChangeAtr": sign * (h4_open-entry)/atr,
                         "maximumFavorableAtr": max(0.0, favorable), "maximumAdverseAtr": max(0.0, adverse)})
            statuses["evaluated"] += 1
        split = recipe["splitTime"]
        summarize = lambda cohort: {"cases": len(cohort),
            "entryToH4": distribution([row["closeChangeAtr"] for row in cohort]),
            "maximumFavorable": distribution([row["maximumFavorableAtr"] for row in cohort]),
            "maximumAdverse": distribution([row["maximumAdverseAtr"] for row in cohort]),
            "medianDelayMinutes": statistics.median([row["entryDelayMinutes"] for row in cohort]) if cohort else None}
        findings.append({"recipe": recipe["recipe"], "development": summarize([row for row in rows if row["eventTime"] < split]),
                         "later": summarize([row for row in rows if row["eventTime"] >= split]),
                         "statusCounts": dict(statuses)})
    result = {"schema": rules["schema"], "manifestHash": manifest_hash, "findings": findings,
              "limitations": rules["limitations"]}
    save(SOURCE / "pre-h4-reaction.json", result)
    print(json.dumps({"recipes": len(findings), "evaluated": sum(row["later"]["cases"] + row["development"]["cases"] for row in findings)}))


if __name__ == "__main__": main()
