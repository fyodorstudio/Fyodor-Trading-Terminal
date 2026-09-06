"""Evaluate the predeclared recent M1/H1/H4 fixed-contract diagnostic."""
import argparse
import bisect
from collections import Counter
from datetime import datetime, timezone
import json
from pathlib import Path
import statistics

from fms_entry_campaign import digest, save
from fms_compare_entries import atr_values


def weekend_gap(before, after):
    return (0 < after - before <= 72 * 3600
            and datetime.fromtimestamp(before, timezone.utc).weekday() in (4, 5)
            and datetime.fromtimestamp(after, timezone.utc).weekday() in (6, 0))


def simulate(entry_time, expiry, direction, contract, candles, times, h4_times, atrs):
    index = bisect.bisect_left(times, entry_time)
    if index >= len(times) or times[index] != entry_time:
        return {"status": "missing_entry"}
    known = bisect.bisect_right(h4_times, entry_time - 14400) - 1
    if known < 0 or atrs[known] is None or atrs[known] <= 0:
        return {"status": "missing_atr"}
    entry, atr = candles[index]["open"], atrs[known]
    sign = 1 if direction == "long" else -1
    risk = atr * contract["stopAtr"]
    stop, target = entry - sign * risk, entry + sign * risk * contract["targetR"]
    detail = {"entryTime": entry_time, "entry": entry, "atr": atr, "atrKnownAt": h4_times[known] + 14400,
              "stop": stop, "target": target, "expiry": expiry, "assumedWeekendClosures": 0}
    previous = None
    while index < len(candles) and candles[index]["time"] < expiry:
        candle = candles[index]
        if previous is not None and candle["time"] != previous["time"] + 60:
            if weekend_gap(previous["time"], candle["time"]):
                detail["assumedWeekendClosures"] += 1
            else:
                return {**detail, "status": "missing_path_minutes"}
        opening_r = sign * (candle["open"] - entry) / risk
        if opening_r <= -1:
            return {**detail, "status": "stop_gap", "resultR": opening_r, "exitTime": candle["time"]}
        if opening_r >= contract["targetR"]:
            return {**detail, "status": "target_hit", "resultR": contract["targetR"], "exitTime": candle["time"]}
        sl = candle["low"] <= stop if sign > 0 else candle["high"] >= stop
        tp = candle["high"] >= target if sign > 0 else candle["low"] <= target
        if sl and tp:
            return {**detail, "status": "ambiguous"}
        if sl or tp:
            return {**detail, "status": "stop_hit" if sl else "target_hit", "resultR": -1.0 if sl else contract["targetR"], "exitTime": candle["time"] + 60}
        previous = candle
        index += 1
    if previous is None or previous["time"] + 60 != expiry:
        return {**detail, "status": "missing_expiry"}
    return {**detail, "status": "expired", "resultR": sign * (previous["close"] - entry) / risk, "exitTime": expiry}


def compare(directory, source):
    manifest = json.loads((directory / "manifest.json").read_text())
    fingerprint = manifest.pop("manifestHash")
    recipes = json.loads((directory / "recipes.json").read_text())
    assert digest(manifest) == fingerprint and digest(recipes) == manifest["recipesSha256"]
    checkpoint = json.loads((directory / "fetch-checkpoint.json").read_text())
    if len(checkpoint) != len(manifest["requests"]):
        raise ValueError("Acquisition still incomplete")
    markets = {}
    for key, request in checkpoint.items():
        if "sha256" not in request:
            continue
        candles = json.loads((directory / "candles" / f"{key}.json").read_text())
        assert digest(candles) == request["sha256"]
        target = markets.setdefault(request["request"]["symbol"], {})
        for candle in candles:
            if candle["time"] in target and target[candle["time"]] != candle:
                raise ValueError("Conflicting overlapping minute snapshots")
            target[candle["time"]] = candle
    h4s = json.loads((source / "h4-snapshot.json").read_text())
    prepared = {}
    for market, keyed in markets.items():
        candles = sorted(keyed.values(), key=lambda c: c["time"])
        h4 = h4s[market]
        prepared[market] = candles, [c["time"] for c in candles], [c["time"] for c in h4], atr_values(h4)
    findings = []
    for recipe in recipes:
        market = recipe["recipe"].split("|")[0]
        args = prepared.get(market)
        cases = []
        for case in recipe["cases"]:
            release = case["eventTime"]
            if not manifest["period"]["from"] <= release < manifest["period"]["to"]:
                continue
            row = {"caseId": case["caseId"], "eventTime": release}
            h4_times = h4s[market]
            starts = [c["time"] for c in h4_times]
            activation = bisect.bisect_right(starts, release)
            last = activation + recipe["contract"]["holdingCandles"] - 1
            if args is None or activation >= len(starts) or last >= len(starts) or starts[activation] - release > 14400:
                row.update({tf: {"status": "missing_baseline_or_market"} for tf in ("M1", "H1", "H4")})
            else:
                expiry = starts[last] + 14400
                for tf, entry in (("M1", (release // 60 + 1) * 60), ("H1", (release // 3600 + 1) * 3600), ("H4", starts[activation])):
                    row[tf] = simulate(entry, expiry, case["direction"], recipe["contract"], *args)
                    if "resultR" in row[tf]:
                        assert row[tf]["entryTime"] > release and row[tf]["atrKnownAt"] <= row[tf]["entryTime"]
            cases.append(row)
        matched = [r for r in cases if all("resultR" in r[tf] for tf in ("M1", "H1", "H4"))]
        averages = {tf: statistics.fmean(r[tf]["resultR"] for r in matched) if matched else None for tf in ("M1", "H1", "H4")}
        findings.append({"recipe": recipe["recipe"], "attempted": len(cases), "matched": len(matched),
            "averages": averages, "statusCounts": {tf: dict(Counter(r[tf]["status"] for r in cases)) for tf in ("M1", "H1", "H4")}, "cases": cases})
    result = {"schema": "fms-minute-entry-comparison-v1", "manifestHash": fingerprint,
              "h4SnapshotSha256": digest(h4s), "findings": findings, "limitations": manifest["limitations"]}
    save(directory / "comparison.json", result)
    print(json.dumps({"recipes": len(findings), "attempted": sum(r["attempted"] for r in findings), "matched": sum(r["matched"] for r in findings)}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", required=True, type=Path)
    parser.add_argument("--source", required=True, type=Path)
    args = parser.parse_args()
    compare(args.directory, args.source)
