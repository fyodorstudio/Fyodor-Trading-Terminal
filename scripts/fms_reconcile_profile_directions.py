"""Reconcile saved recipe evidence directions with frozen execution directions.

Read-only database access; no bridge/server import or research mutation.
"""
from __future__ import annotations

import argparse
import bisect
import json
from pathlib import Path
import sqlite3
import statistics

from fms_research_inventory import ROOT


def simulate(candles, case, direction, contract):
    sign = 1 if direction == "long" else -1
    risk = case["atr"] * contract["stopAtr"]
    entry = case["entry"]
    stop, target = entry - sign * risk, entry + sign * risk * contract["targetR"]
    if len(candles) < contract["holdingCandles"]:
        return None
    for candle in candles[:contract["holdingCandles"]]:
        hit_stop = candle["low"] <= stop if sign > 0 else candle["high"] >= stop
        hit_target = candle["high"] >= target if sign > 0 else candle["low"] <= target
        if hit_stop and hit_target:
            return None
        if hit_stop:
            return -1.0
        if hit_target:
            return contract["targetR"]
    return sign * (candles[contract["holdingCandles"] - 1]["close"] - entry) / risk


def reconcile(database):
    profiles = json.loads((ROOT / "Main/mt5-bridge/registered_reaction_profiles.json").read_text(encoding="utf-8-sig"))["profiles"]
    c = sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)
    c.row_factory = sqlite3.Row
    c.execute("BEGIN")
    rows, cache = [], {}
    try:
        for key, profile in sorted(profiles.items()):
            market = key.split("|")[0]
            experiment = profile["experimentId"]
            experiment_row = c.execute("SELECT result_json,configuration_json FROM fms_experiments WHERE id=?", (experiment,)).fetchone()
            result = json.loads(experiment_row[0])
            config = json.loads(experiment_row[1])
            raw = json.loads(c.execute("SELECT value FROM metadata WHERE key=?", (f"fms_raw_audit:{experiment}",)).fetchone()[0])
            contract = next(x for x in raw["contracts"] if x["key"] == raw["selectedContractKey"])
            outcomes = {x["caseId"]: x for x in raw["contractResults"][contract["key"]]}
            if market not in cache:
                candles = [dict(x) for x in c.execute("SELECT time,open,high,low,close FROM candle_cache WHERE symbol=? AND timeframe='H4' ORDER BY time", (market,))]
                cache[market] = candles, [x["time"] for x in candles]
            candles, times = cache[market]
            mismatches = missing = 0
            original, corrected, saved = [], [], []
            for case in raw["cases"]:
                if not case.get("included"):
                    continue
                outcome = outcomes.get(case["caseId"])
                if not outcome or outcome.get("direction") not in {"long", "short"}:
                    missing += 1
                    continue
                mismatches += case["direction"] != outcome["direction"]
                if case["eventTime"] < result["splitTime"] or case.get("entryTime") is None or not case.get("atr"):
                    continue
                index = bisect.bisect_left(times, case["entryTime"])
                if index == len(times) or times[index] != case["entryTime"]:
                    continue
                window = candles[index:index + contract["holdingCandles"]]
                a = simulate(window, case, case["direction"], contract)
                b = simulate(window, case, outcome["direction"], contract)
                if a is not None:
                    original.append(a)
                if b is not None:
                    corrected.append(b)
                if outcome.get("grossResultR") is not None:
                    saved.append(outcome["grossResultR"])
            mean = lambda values: statistics.fmean(values) if values else None
            rows.append({"recipe": key, "experimentId": experiment, "reaction": config.get("reaction"),
                "evidenceTradeDirectionMismatches": mismatches, "missingTradeDirection": missing,
                "evidenceDirectionReplay": {"n": len(original), "averageR": mean(original)},
                "tradeDirectionReplay": {"n": len(corrected), "averageR": mean(corrected)},
                "savedTradeResults": {"n": len(saved), "averageR": mean(saved)}})
        return {"schema": "fms-profile-direction-reconciliation-v1", "rows": rows,
            "limitations": ["Fixed selected experimental contract only; no claim to replay active overlays.",
                "Uses current cached H4 paths; ambiguous bars remain excluded, no M1 resolution.",
                "Coverage and sample differences must be inspected before equating aggregate means."]}
    finally:
        c.rollback()
        c.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    payload = reconcile(args.database)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"recipes": len(payload["rows"]), "directionMismatchRecipes":
        [r["recipe"] for r in payload["rows"] if r["evidenceTradeDirectionMismatches"]]}))
