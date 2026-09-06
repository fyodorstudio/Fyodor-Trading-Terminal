"""Evaluate the frozen H1/H4 campaign on identical observable candle paths.

Historical proxy research only. Full elapsed-time coverage is required; gaps,
including weekends inside the holding window, are disclosed as exclusions.
"""
from __future__ import annotations

import argparse
import bisect
from collections import Counter
import json
import math
import os
from pathlib import Path
import sqlite3
import statistics

from fms_entry_campaign import digest, save


def atr_values(candles):
    values, seed, previous, atr = [], [], None, None
    for candle in candles:
        high, low, close = candle["high"], candle["low"], candle["close"]
        tr = high - low if previous is None else max(high - low, abs(high - previous), abs(low - previous))
        if atr is None:
            seed.append(tr)
            if len(seed) == 14:
                atr = statistics.fmean(seed)
        else:
            atr = (atr * 13 + tr) / 14
        values.append(atr)
        previous = close
    return values


def simulate(entry_time, direction, contract, h1, times, h4, h4_times, atrs):
    index = bisect.bisect_left(times, entry_time)
    if index == len(times) or times[index] != entry_time:
        return {"status": "missing_entry"}
    atr_index = bisect.bisect_right(h4_times, entry_time - 14400) - 1
    if atr_index < 0 or atrs[atr_index] is None or entry_time - (h4_times[atr_index] + 14400) > 14400:
        return {"status": "missing_completed_atr"}
    hours = contract["holdingCandles"] * 4
    window = h1[index:index + hours]
    if len(window) != hours or any(row["time"] != entry_time + i * 3600 for i, row in enumerate(window)):
        return {"status": "incomplete_elapsed_path"}
    entry, atr = h1[index]["open"], atrs[atr_index]
    if not math.isfinite(atr) or atr <= 0:
        return {"status": "invalid_atr"}
    sign = 1 if direction == "long" else -1
    risk = atr * contract["stopAtr"]
    stop, target = entry - sign * risk, entry + sign * risk * contract["targetR"]
    detail = {"entryTime": entry_time, "entry": entry, "atr": atr,
              "atrKnownAt": h4_times[atr_index] + 14400, "stop": stop, "target": target}
    for candle in window:
        # A candle open is observed first; a gap through SL cannot earn a -1R fill.
        opening_r = sign * (candle["open"] - entry) / risk
        if opening_r <= -1:
            return {**detail, "status": "stop_gap", "resultR": opening_r, "exitTime": candle["time"]}
        if opening_r >= contract["targetR"]:
            return {**detail, "status": "target_hit", "resultR": contract["targetR"], "exitTime": candle["time"]}
        adverse = candle["low"] <= stop if sign > 0 else candle["high"] >= stop
        favorable = candle["high"] >= target if sign > 0 else candle["low"] <= target
        if adverse and favorable:
            return {**detail, "status": "ambiguous"}
        if adverse or favorable:
            return {**detail, "status": "stop_hit" if adverse else "target_hit",
                    "resultR": -1.0 if adverse else contract["targetR"], "exitTime": candle["time"] + 3600}
    return {**detail, "status": "expired", "resultR": sign * (window[-1]["close"] - entry) / risk,
            "exitTime": entry_time + hours * 3600}


def summary(rows):
    if not rows:
        return {"n": 0, "h1AverageR": None, "h4AverageR": None, "pairedUpliftR": None}
    h1 = [row["H1"]["resultR"] for row in rows]
    h4 = [row["H4"]["resultR"] for row in rows]
    return {"n": len(rows), "h1AverageR": statistics.fmean(h1), "h4AverageR": statistics.fmean(h4),
            "pairedUpliftR": statistics.fmean(a - b for a, b in zip(h1, h4)),
            "h1ProfitFrequency": sum(x > 0 for x in h1) / len(h1),
            "h4ProfitFrequency": sum(x > 0 for x in h4) / len(h4)}


def compare(directory, database):
    manifest = json.loads((directory / "manifest.json").read_text())
    manifest_hash = manifest.pop("manifestHash")
    recipes = json.loads((directory / "recipes.json").read_text())
    if digest(manifest) != manifest_hash or digest(recipes) != manifest["recipesSha256"]:
        raise ValueError("Campaign inputs changed")
    checkpoint = json.loads((directory / "fetch-checkpoint.json").read_text())
    if len(checkpoint) != len(manifest["requests"]):
        raise ValueError("Acquisition has not finished")
    h1_by_market = {}
    for key, row in checkpoint.items():
        if row["status"] not in {"received", "no_within_range_candles"}:
            continue
        data = json.loads((directory / "candles" / f"{key}.json").read_text())
        if digest(data) != row["sha256"]:
            raise ValueError(f"Candle snapshot changed: {key}")
        market = row["request"]["symbol"]
        target = h1_by_market.setdefault(market, {})
        for candle in data:
            old = target.get(candle["time"])
            if old is not None and old != candle:
                raise ValueError(f"Conflicting candle snapshots: {market}/{candle['time']}")
            target[candle["time"]] = candle
    snapshot = directory / "h4-snapshot.json"
    if not snapshot.exists():
        c = sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)
        c.row_factory = sqlite3.Row
        c.execute("BEGIN")
        try:
            h4_by_market = {market: [dict(r) for r in c.execute(
                "SELECT time,open,high,low,close FROM candle_cache WHERE symbol=? AND timeframe='H4' ORDER BY time", (market,))]
                for market in h1_by_market}
        finally:
            c.rollback()
            c.close()
        save(snapshot, h4_by_market)
    h4_by_market = json.loads(snapshot.read_text())
    prepared = {}
    for market, keyed in h1_by_market.items():
        h1 = sorted(keyed.values(), key=lambda c: c["time"])
        h4 = h4_by_market[market]
        prepared[market] = h1, [c["time"] for c in h1], h4, [c["time"] for c in h4], atr_values(h4)
    findings = []
    for recipe in recipes:
        market = recipe["recipe"].split("|")[0]
        args = prepared.get(market)
        cases = []
        for case in recipe["cases"]:
            row = {"caseId": case["caseId"], "eventTime": case["eventTime"]}
            if args is None:
                row.update(H1={"status": "missing_market"}, H4={"status": "missing_market"})
            else:
                h1, times, h4, h4_times, atrs = args
                release = case["eventTime"]
                index = bisect.bisect_right(h4_times, release)
                h4_entry = h4_times[index] if index < len(h4_times) else None
                row["H1"] = simulate((release // 3600 + 1) * 3600, case["direction"], recipe["contract"], *args)
                row["H4"] = simulate(h4_entry, case["direction"], recipe["contract"], *args) if h4_entry and h4_entry - release <= 14400 else {"status": "missing_entry"}
            cases.append(row)
        matched = [row for row in cases if all("resultR" in row[tf] for tf in ("H1", "H4"))]
        development = [r for r in matched if r["eventTime"] < recipe["splitTime"] and
                       max(r[tf]["entryTime"] + recipe["contract"]["holdingCandles"] * 14400 for tf in ("H1", "H4")) < recipe["splitTime"]]
        later = [r for r in matched if r["eventTime"] >= recipe["splitTime"]]
        dev, holdout = summary(development), summary(later)
        findings.append({"recipe": recipe["recipe"], "development": dev, "later": holdout,
            "developmentSelectedEntry": "H1" if dev["n"] and dev["pairedUpliftR"] > 0 else "H4",
            "attempted": len(cases), "matched": len(matched),
            "purgedBoundaryCases": len(matched) - len(development) - len(later),
            "statusCounts": {tf: dict(Counter(r[tf]["status"] for r in cases)) for tf in ("H1", "H4")}, "cases": cases})
    result = {"schema": "fms-entry-comparison-v1", "manifestHash": manifest_hash,
              "h4SnapshotSha256": digest(h4_by_market), "findings": findings,
              "limitations": manifest["limitations"] + ["Full elapsed path gaps, including weekends, excluded before evaluation; matched sample can be very selective."]}
    save(directory / "comparison.json", result)
    print(json.dumps({"recipes": len(findings), "matchedCases": sum(r["matched"] for r in findings),
        "h1DevelopmentSelections": sum(r["developmentSelectedEntry"] == "H1" for r in findings)}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", required=True, type=Path)
    parser.add_argument("--database", type=Path, default=Path(os.environ.get("FYODOR_RESEARCH_DB") or str(Path(os.environ["LOCALAPPDATA"]) / "Fyodor Trading Terminal/fyodor-research.sqlite3")))
    args = parser.parse_args()
    compare(args.directory, args.database)
