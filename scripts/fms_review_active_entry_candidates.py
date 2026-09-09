"""Review session-H1 candidates under their frozen manifest contracts.

This is a frozen follow-up to the session comparison. It does not register or
alter an entry rule. It intentionally does not import the live bridge.
Contradictory/missing intrabar order stays ambiguous.
"""
from __future__ import annotations

import bisect
from collections import Counter
import json
import statistics

from fms_entry_campaign import ROOT, digest, save
from fms_compare_entries import atr_values
from fms_compare_entries_session import weekend_gap


SOURCE = ROOT / "docs/Development Logs/artifacts/fms-entry-campaign-2026-09-06"


def managed(entry_time, expiry, direction, contract, candles, times, h4_times, atrs):
    index = bisect.bisect_left(times, entry_time)
    if index >= len(times) or times[index] != entry_time:
        return {"status": "missing_entry"}
    known = bisect.bisect_right(h4_times, entry_time - 14400) - 1
    if known < 0 or atrs[known] is None or atrs[known] <= 0:
        return {"status": "missing_atr"}
    entry, atr = candles[index]["open"], atrs[known]
    sign = 1 if direction == "long" else -1
    risk = atr * contract["stopAtr"]
    initial_stop = entry - sign * risk
    target = entry + sign * risk * contract["targetR"]
    break_even = contract.get("managementFamily") == "break_even"
    trigger = entry + sign * risk * float(contract.get("managementTriggerR") or 1)
    armed = False
    detail = {"entryTime": entry_time, "entry": entry, "atr": atr, "atrKnownAt": h4_times[known] + 14400,
              "initialStop": initial_stop, "target": target, "expiry": expiry}
    previous = None
    while index < len(candles) and candles[index]["time"] < expiry:
        candle = candles[index]
        if previous and candle["time"] != previous["time"] + 3600 and not weekend_gap(previous["time"], candle["time"]):
            return {**detail, "status": "missing_path_hours"}
        stop = entry if armed else initial_stop
        stop_hit = candle["low"] <= stop if sign > 0 else candle["high"] >= stop
        target_hit = candle["high"] >= target if sign > 0 else candle["low"] <= target
        trigger_hit = candle["high"] >= trigger if sign > 0 else candle["low"] <= trigger
        if stop_hit and target_hit:
            return {**detail, "status": "ambiguous"}
        if break_even and not armed and stop_hit and trigger_hit:
            return {**detail, "status": "ambiguous_trigger_order"}
        if stop_hit:
            return {**detail, "status": "break_even" if armed else "stop_hit", "resultR": 0.0 if armed else -1.0,
                    "exitTime": candle["time"] + 3600}
        if target_hit:
            return {**detail, "status": "target_hit", "resultR": contract["targetR"], "exitTime": candle["time"] + 3600}
        if break_even and trigger_hit:
            armed = True
        previous = candle
        index += 1
    if previous is None or previous["time"] + 3600 != expiry:
        return {**detail, "status": "missing_expiry"}
    return {**detail, "status": "expired", "resultR": sign * (previous["close"] - entry) / risk, "exitTime": expiry}


def summary(rows):
    if not rows:
        return {"n": 0, "h1AverageR": None, "h4AverageR": None, "pairedUpliftR": None}
    h1 = [row["H1"]["resultR"] for row in rows]
    h4 = [row["H4"]["resultR"] for row in rows]
    h1_statuses = Counter(row["H1"]["status"] for row in rows)
    return {"n": len(rows), "h1AverageR": statistics.fmean(h1), "h4AverageR": statistics.fmean(h4),
            "pairedUpliftR": statistics.fmean(a - b for a, b in zip(h1, h4)),
            "h1ProfitFrequency": sum(x > 0 for x in h1) / len(h1),
            "h4ProfitFrequency": sum(x > 0 for x in h4) / len(h4),
            "targetHitCount": h1_statuses["target_hit"], "stopHitCount": h1_statuses["stop_hit"],
            "expiredCount": h1_statuses["expired"], "breakEvenCount": h1_statuses["break_even"],
            "ambiguousCount": 0, "unevaluableCount": 0}


def main():
    session = json.loads((SOURCE / "session-comparison.json").read_text())
    recipes = json.loads((SOURCE / "recipes.json").read_text())
    candidates = [row["recipe"] for row in session["findings"]
                  if row["developmentSelectedEntry"] == "H1" and row["later"]["n"]
                  and row["later"]["pairedUpliftR"] > 0 and row["later"]["h1AverageR"] > 0]
    manifest_path = SOURCE / "active-entry-review-manifest.json"
    if not manifest_path.exists():
        raise ValueError("Frozen active-entry review manifest is missing")
    registered_manifest = json.loads(manifest_path.read_text())
    active = registered_manifest.get("activeContracts") or {}
    if set(active) != set(candidates):
        raise ValueError("Frozen active-contract keys do not match the selected candidate keys")
    manifest_data = {"schema": "fms-active-entry-candidate-review-v1", "sourceManifestHash": session["manifestHash"],
        "sourceResultHash": digest(session), "candidates": candidates, "activeContracts": active,
        "entryAlternatives": ["first_H1_open_strictly_after_scheduled_release", "first_H4_open_strictly_after_scheduled_release"],
        "expiry": "Same active-contract final baseline H4 candle close", "path": "H1 OHLC with declared weekend closures",
        "management": "Fixed or break-even exactly as currently registered; trigger/stop ordering inside one H1 is ambiguous",
        "selection": "Candidate must retain positive paired development and later uplift, positive later H1 average R and >=10 later matched cases",
        "limitations": ["Scheduled-release proxy, reused history, gross costs excluded, no proof of package-time fill.",
                        "Context-conditioned contracts are excluded unless their condition can be reconstructed identically."]}
    frozen = dict(registered_manifest); manifest_hash = frozen.pop("manifestHash")
    if frozen != manifest_data or digest(frozen) != manifest_hash:
        raise ValueError("Frozen active-entry review changed")
    checkpoint = json.loads((SOURCE / "fetch-checkpoint.json").read_text())
    h1_by_market = {}
    for key, record in checkpoint.items():
        if "sha256" not in record: continue
        rows = json.loads((SOURCE / "candles" / f"{key}.json").read_text())
        assert digest(rows) == record["sha256"]
        target = h1_by_market.setdefault(record["request"]["symbol"], {})
        for candle in rows: target[candle["time"]] = candle
    h4s = json.loads((SOURCE / "h4-snapshot.json").read_text())
    prepared = {}
    for market, keyed in h1_by_market.items():
        h1 = sorted(keyed.values(), key=lambda x: x["time"]); h4 = h4s[market]
        prepared[market] = h1, [x["time"] for x in h1], [x["time"] for x in h4], atr_values(h4)
    findings = []
    for recipe in (row for row in recipes if row["recipe"] in candidates):
        market = recipe["recipe"].split("|")[0]; contract = active[recipe["recipe"]]
        h4_times = [x["time"] for x in h4s[market]]; cases = []
        for case in recipe["cases"]:
            start = bisect.bisect_right(h4_times, case["eventTime"]); end = start + contract["expiryCandles"] - 1
            row = {"caseId": case["caseId"], "eventTime": case["eventTime"]}
            if start >= len(h4_times) or end >= len(h4_times) or h4_times[start] - case["eventTime"] > 14400:
                row.update(H1={"status": "missing_baseline"}, H4={"status": "missing_baseline"})
            else:
                expiry = h4_times[end] + 14400
                for tf, entry in (("H1", (case["eventTime"] // 3600 + 1) * 3600), ("H4", h4_times[start])):
                    row[tf] = managed(entry, expiry, case["direction"], contract, *prepared[market])
            cases.append(row)
        matched = [row for row in cases if all("resultR" in row[tf] for tf in ("H1", "H4"))]
        development = [row for row in matched if row["eventTime"] < recipe["splitTime"] and row["H4"]["expiry"] < recipe["splitTime"]]
        later = [row for row in matched if row["eventTime"] >= recipe["splitTime"]]
        dev, hold = summary(development), summary(later)
        supported = bool(dev["n"] and hold["n"] >= 10 and dev["pairedUpliftR"] > 0 and hold["pairedUpliftR"] > 0 and hold["h1AverageR"] > 0)
        findings.append({"recipe": recipe["recipe"], "contract": contract, "development": dev, "later": hold,
            "supportedForEntryCandidate": supported,
            "statusCounts": {tf: dict(Counter(row[tf]["status"] for row in cases)) for tf in ("H1", "H4")}})
    result = {"schema": "fms-active-entry-candidate-review-v1", "manifestHash": manifest_hash,
              "findings": findings, "limitations": manifest_data["limitations"], "registrationsChanged": 0}
    save(SOURCE / "active-entry-review.json", result)
    print(json.dumps({"reviewed": len(findings), "supported": [row["recipe"] for row in findings if row["supportedForEntryCandidate"]]}))


if __name__ == "__main__": main()
