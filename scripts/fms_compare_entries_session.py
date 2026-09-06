"""Second frozen H1/H4 comparison using observed trading-session bars.

Both entries share the baseline contract's H4-bar expiry. Weekend closures are
allowed; unexplained H1 gaps exclude the case. Historical proxy research only.
"""
import argparse
import bisect
from collections import Counter
from datetime import datetime, timezone
import json
from pathlib import Path
import statistics

from fms_entry_campaign import digest, save
from fms_compare_entries import atr_values


def weekend_gap(left, right):
    return (right - left <= 72 * 3600
            and datetime.fromtimestamp(left, timezone.utc).weekday() in (4, 5)
            and datetime.fromtimestamp(right, timezone.utc).weekday() in (6, 0))


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
    base = {"entryTime": entry_time, "entry": entry, "atr": atr,
            "atrKnownAt": h4_times[known] + 14400, "stop": stop, "target": target, "expiry": expiry}
    previous = None
    while index < len(candles) and candles[index]["time"] < expiry:
        candle = candles[index]
        if previous and candle["time"] != previous["time"] + 3600 and not weekend_gap(previous["time"], candle["time"]):
            return {**base, "status": "missing_path_hours"}
        opening_r = sign * (candle["open"] - entry) / risk
        if opening_r <= -1:
            return {**base, "status": "stop_gap", "resultR": opening_r, "exitTime": candle["time"]}
        if opening_r >= contract["targetR"]:
            return {**base, "status": "target_hit", "resultR": contract["targetR"], "exitTime": candle["time"]}
        stop_hit = candle["low"] <= stop if sign > 0 else candle["high"] >= stop
        target_hit = candle["high"] >= target if sign > 0 else candle["low"] <= target
        if stop_hit and target_hit:
            return {**base, "status": "ambiguous"}
        if stop_hit or target_hit:
            return {**base, "status": "stop_hit" if stop_hit else "target_hit",
                    "resultR": -1.0 if stop_hit else contract["targetR"], "exitTime": candle["time"] + 3600}
        previous = candle
        index += 1
    if previous is None or previous["time"] + 3600 != expiry:
        return {**base, "status": "missing_expiry"}
    return {**base, "status": "expired", "resultR": sign * (previous["close"] - entry) / risk, "exitTime": expiry}


def summarize(rows):
    if not rows:
        return {"n": 0, "h1AverageR": None, "h4AverageR": None, "pairedUpliftR": None}
    one, four = ([row[tf]["resultR"] for row in rows] for tf in ("H1", "H4"))
    return {"n": len(rows), "h1AverageR": statistics.fmean(one), "h4AverageR": statistics.fmean(four),
            "pairedUpliftR": statistics.fmean(a-b for a,b in zip(one,four)),
            "h1ProfitFrequency": sum(v > 0 for v in one)/len(one), "h4ProfitFrequency": sum(v > 0 for v in four)/len(four)}


def main(source):
    original_manifest = json.loads((source / "manifest.json").read_text())
    source_hash = original_manifest["manifestHash"]
    original_result = json.loads((source / "comparison.json").read_text())
    inputs = {"schema": "fms-entry-session-comparison-v1", "sourceManifestHash": source_hash,
        "sourceComparisonHash": digest(original_result),
        "entryAlternatives": ["first_H1_open_strictly_after_scheduled_release", "first_H4_open_strictly_after_scheduled_release"],
        "expiry": "Close of the final baseline H4 holding candle for both alternatives",
        "path": "H1 OHLC; weekend gaps at most 72 hours allowed; other gaps excluded; gaps through stops use observed open",
        "atr": "Completed H4 Wilder ATR14 independently at entry", "selection": "Positive development paired uplift selects H1 once; original split judges later",
        "limitations": original_result["limitations"] + ["Reused history and scheduled-release proxies; no actual release-time fill or costs."]}
    frozen = source / "session-comparison-manifest.json"
    if not frozen.exists():
        save(frozen, {**inputs, "manifestHash": digest(inputs)})
    stored = json.loads(frozen.read_text()); expected = stored.pop("manifestHash")
    if stored != inputs or digest(stored) != expected:
        raise ValueError("Frozen session comparison changed")
    recipes = json.loads((source / "recipes.json").read_text())
    checkpoint = json.loads((source / "fetch-checkpoint.json").read_text())
    by_market = {}
    for key, record in checkpoint.items():
        if "sha256" not in record: continue
        rows = json.loads((source / "candles" / f"{key}.json").read_text())
        assert digest(rows) == record["sha256"]
        target = by_market.setdefault(record["request"]["symbol"], {})
        for candle in rows:
            if candle["time"] in target and target[candle["time"]] != candle: raise ValueError("Conflicting H1 snapshots")
            target[candle["time"]] = candle
    h4s = json.loads((source / "h4-snapshot.json").read_text())
    prepared = {}
    for market, keyed in by_market.items():
        h1=sorted(keyed.values(),key=lambda c:c["time"]); h4=h4s[market]
        prepared[market]=(h1,[c["time"] for c in h1],[c["time"] for c in h4],atr_values(h4))
    findings=[]
    for recipe in recipes:
        market=recipe["recipe"].split("|")[0]; h4=h4s[market]; h4_times=[c["time"] for c in h4]; cases=[]
        for case in recipe["cases"]:
            release=case["eventTime"]; start=bisect.bisect_right(h4_times,release); end=start+recipe["contract"]["holdingCandles"]-1
            row={"caseId":case["caseId"],"eventTime":release}
            if market not in prepared or start>=len(h4_times) or end>=len(h4_times) or h4_times[start]-release>14400:
                row.update(H1={"status":"missing_baseline"},H4={"status":"missing_baseline"})
            else:
                expiry=h4_times[end]+14400
                for tf,entry in (("H1",(release//3600+1)*3600),("H4",h4_times[start])):
                    row[tf]=simulate(entry,expiry,case["direction"],recipe["contract"],*prepared[market])
            cases.append(row)
        matched=[r for r in cases if all("resultR" in r[tf] for tf in ("H1","H4"))]
        development=[r for r in matched if r["eventTime"]<recipe["splitTime"] and max(r[tf]["expiry"] for tf in ("H1","H4"))<recipe["splitTime"]]
        later=[r for r in matched if r["eventTime"]>=recipe["splitTime"]]
        dev,hold=summarize(development),summarize(later)
        findings.append({"recipe":recipe["recipe"],"attempted":len(cases),"matched":len(matched),"development":dev,"later":hold,
            "developmentSelectedEntry":"H1" if dev["n"] and dev["pairedUpliftR"]>0 else "H4",
            "statusCounts":{tf:dict(Counter(r[tf]["status"] for r in cases)) for tf in ("H1","H4")}})
    output={"schema":"fms-entry-session-comparison-v1","manifestHash":expected,"findings":findings,"limitations":inputs["limitations"]}
    save(source / "session-comparison.json",output)
    print(json.dumps({"matched":sum(r["matched"] for r in findings),"h1Selected":sum(r["developmentSelectedEntry"]=="H1" for r in findings)}))


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument("--source",required=True,type=Path); args=parser.parse_args(); main(args.source)
