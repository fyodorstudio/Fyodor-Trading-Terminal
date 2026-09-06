"""Read-only FMS research coverage inventory; never imports or starts the bridge.

Run with the existing bridge Python, passing --output to save a review artifact.
The SQLite transaction keeps all queries on one consistent database snapshot.
"""
from __future__ import annotations

import argparse
import bisect
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3


ROOT = Path(__file__).resolve().parents[1]


def inventory(database: Path) -> dict:
    profile_path = ROOT / "Main/mt5-bridge/registered_reaction_profiles.json"
    profile_bytes = profile_path.read_bytes()
    profiles = json.loads(profile_bytes.decode("utf-8-sig"))["profiles"]
    pairs = re.findall(r'name: "([A-Z]{6})"', (ROOT / "Main/src/app/config/fxPairs.ts").read_text())
    connection = sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute("BEGIN")
    try:
        coverage = [dict(row) for row in connection.execute(
            "SELECT symbol,timeframe,count(*) AS candles,min(time) AS first,max(time) AS last "
            "FROM candle_cache GROUP BY symbol,timeframe ORDER BY symbol,timeframe")]
        calendar = [dict(row) for row in connection.execute(
            "SELECT currency,count(*) AS rows,min(time) AS first,max(time) AS last "
            "FROM calendar_events GROUP BY currency ORDER BY currency")]
        times = {}
        recipes = []
        for key, profile in sorted(profiles.items()):
            market, pattern = key.split("|", 1)
            experiment = profile.get("experimentId")
            raw = connection.execute("SELECT value FROM metadata WHERE key = ?", (f"fms_raw_audit:{experiment}",)).fetchone()
            row = {"market": market, "patternId": pattern, "experimentId": experiment}
            if raw is None:
                row["status"] = "missing_saved_case_audit"
                recipes.append(row)
                continue
            audit = json.loads(raw[0])
            cases = [case for case in audit["cases"] if case.get("included")]
            releases = sorted({int(case["eventTime"]) for case in cases})
            row.update(caseCount=len(cases), independentReleaseCount=len(releases),
                       caseAuditSha256=hashlib.sha256(raw[0].encode()).hexdigest())
            entry_coverage = {}
            for timeframe, seconds in (("M1", 60), ("H1", 3600), ("H4", 14400)):
                cache_key = (market, timeframe)
                if cache_key not in times:
                    times[cache_key] = [r[0] for r in connection.execute(
                        "SELECT time FROM candle_cache WHERE symbol=? AND timeframe=? ORDER BY time", cache_key)]
                available = times[cache_key]
                matched = 0
                for release in releases:
                    index = bisect.bisect_right(available, release)
                    # Do not skip over missing history and call a much later bar an entry.
                    if index < len(available) and available[index] - release <= seconds:
                        matched += 1
                entry_coverage[timeframe] = {"releaseCountWithNextBar": matched,
                    "releaseCountMissingNextBar": len(releases) - matched}
            row["scheduledProxyEntryCoverage"] = entry_coverage
            row["status"] = "coverage_only_not_execution_validation"
            selected = next((contract for contract in audit["contracts"]
                             if contract["key"] == audit["selectedContractKey"]), None)
            row["savedSelectedContract"] = selected
            row["profileFrozenLaterAverageR"] = profile.get("contractResearch", {}).get("frozen", {}).get("laterAverageR")
            row["profileExecutionLaterAverageR"] = profile.get("executionChallenger", {}).get("activeLater", {}).get("averageR")
            recipes.append(row)
        return {"schema": "fms-research-inventory-v1",
            "profileSha256": hashlib.sha256(profile_bytes).hexdigest(),
            "pairUniverse": pairs, "profileMarkets": sorted({r["market"] for r in recipes}),
            "pairsWithoutSavedProfiles": sorted(set(pairs) - {r["market"] for r in recipes}),
            "calendarCoverage": calendar, "candleCoverage": coverage, "recipes": recipes,
            "limitations": ["A cached next bar proves neither complete path coverage nor a fill.",
                "Scheduled-release proxies do not prove Actual/package availability at entry.",
                "Saved profile and experiment metrics may use different cohorts or revisions; reconcile before comparing or promoting.",
                "This inventory does not infer current registration from saved profiles."]}
    finally:
        connection.rollback()
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, default=Path(os.environ.get("FYODOR_RESEARCH_DB") or
        str(Path(os.environ.get("LOCALAPPDATA", ".")) / "Fyodor Trading Terminal/fyodor-research.sqlite3")))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = inventory(args.database)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "recipes": len(result["recipes"]),
        "profileMarkets": result["profileMarkets"], "pairsWithoutProfiles": len(result["pairsWithoutSavedProfiles"])}))


if __name__ == "__main__":
    main()
