"""Search exact multi-factor co-releases on markets without a registered recipe.

The hypothesis is frozen before outcomes: economic factors released at the same
broker timestamp may carry information as an exact package. Stage-A package
identities are excluded, results are chronological, and reused history can only
produce exploratory shadow candidates. This script never edits the registry.
"""
from __future__ import annotations

import argparse
import bisect
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import statistics
import sys
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Main/mt5-bridge"))
from macro_signal import _build_factor_votes, calculate_atr_by_candle, evaluate_candidate, score_event  # noqa: E402

STOP_ATR = (.5, 1.0, 1.5, 2.0)
TARGET_R = (.5, 1.0, 2.0, 3.0, 4.0)
EXPIRY = (6, 12, 30, 60)
REACTIONS = ("continuation", "contrarian")
DIRECTIONS = ("both", "long", "short")
MIN_TOTAL = 36
MIN_DEVELOPMENT = 15
MIN_LATER = 7


def digest(value: object) -> str:
  return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def metrics(rows: list[dict[str, Any]]) -> dict[str, Any]:
  evaluable = [row for row in rows if row.get("grossResultR") is not None]
  values = [float(row["grossResultR"]) for row in evaluable]
  if not values:
    return {"n": 0, "averageR": None, "medianR": None, "tpBeforeSl": None, "maximumDrawdownR": None, "longestLosingStreak": 0, "years": []}
  equity = peak = drawdown = 0.0
  streak = longest = 0
  for value in values:
    equity += value
    peak = max(peak, equity)
    drawdown = max(drawdown, peak - equity)
    streak = streak + 1 if value < 0 else 0
    longest = max(longest, streak)
  return {
    "n": len(values), "averageR": statistics.fmean(values), "medianR": statistics.median(values),
    "tpBeforeSl": sum(row.get("status") == "target_hit" for row in evaluable) / len(evaluable),
    "maximumDrawdownR": drawdown, "longestLosingStreak": longest,
    "years": sorted({dt.datetime.fromtimestamp(int(row["eventTime"]), dt.timezone.utc).year for row in evaluable}),
  }


def stage_a_identities() -> set[tuple[str, str]]:
  paths = list((ROOT / "docs/Development Logs/artifacts/fms-extended-stage-a-2026-09-06").glob("*.result.json"))
  if not paths:
    raise RuntimeError("Stage-A result is required for identity deduplication")
  result = json.loads(paths[0].read_text(encoding="utf-8"))
  return {(str(row["market"]), str(row["catalogLabel"])) for row in result["entries"]}


def event_packages(connection: sqlite3.Connection, market: str) -> dict[str, list[dict[str, Any]]]:
  base, quote = market[:3], market[3:]
  rows = connection.execute(
    "SELECT id,time,country_code,currency,title,impact,actual,forecast,previous FROM calendar_events "
    "WHERE currency IN (?,?) AND actual IS NOT NULL ORDER BY time,id", (base, quote),
  )
  by_time: dict[int, list[dict[str, Any]]] = {}
  for row in rows:
    event = {"id": row[0], "time": row[1], "countryCode": row[2], "currency": row[3], "title": row[4],
      "impact": row[5], "actual": row[6], "forecast": row[7], "previous": row[8]}
    scored = score_event(event)
    if scored is not None:
      by_time.setdefault(int(row[1]), []).append(scored)
  packages: dict[str, list[dict[str, Any]]] = {}
  for event_time, events in by_time.items():
    factors = sorted({(str(row["currency"]), str(row["factor"])) for row in events})
    if len(factors) < 2:
      continue
    label = " + ".join(f"{currency}:{factor}" for currency, factor in factors)
    votes = _build_factor_votes(events, base, quote)
    pair_vote = sum(int(row["pairVote"]) for row in votes)
    if pair_vote == 0:
      continue
    packages.setdefault(label, []).append({
      "eventTime": event_time, "direction": "long" if pair_vote > 0 else "short", "agreement": "consensus" if len({row["pairVote"] for row in votes if row["pairVote"]}) == 1 else "conflicted_weak",
      "pairVote": pair_vote, "factorVotes": votes, "events": events, "backgroundDirection": "none", "backgroundPairVote": 0, "backgroundAlignment": "neutral", "highestImpact": "high",
    })
  return packages


def main() -> int:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--output", type=Path, required=True)
  parser.add_argument("--database", type=Path, default=Path(os.environ["LOCALAPPDATA"]) / "Fyodor Trading Terminal/fyodor-research.sqlite3")
  args = parser.parse_args()
  exhaustion_path = ROOT / "Main/src/app/lib/fmsExhaustionSummary.json"
  exhaustion = json.loads(exhaustion_path.read_text(encoding="utf-8"))
  markets = list(exhaustion["marketsWithoutRegisteredRecipe"])
  prior_identities = stage_a_identities()
  manifest = {
    "schema": "fms-extended-corelease-manifest-v1", "registryMutable": False, "markets": markets,
    "hypothesis": "An exact set of two or more scored economic factors released at the same broker timestamp has a stable pair-oriented reaction.",
    "deduplication": "Exclude exact market/package labels declared by the 278-entry Stage-A campaign.",
    "directionTreatments": DIRECTIONS, "reactions": REACTIONS,
    "execution": {"stopAtr": STOP_ATR, "targetR": TARGET_R, "expiryH4": EXPIRY},
    "chronology": "50% development selects one contract; next 25% selection gate; final 25% reused-history audit with one-case embargo at each boundary.",
    "minimumSamples": {"total": MIN_TOTAL, "development": MIN_DEVELOPMENT, "selection": MIN_LATER, "final": MIN_LATER},
    "promotion": "Exploratory shadow only. The final block is untouched within this campaign but the OHLC/calendar archive was used by earlier FMS research.",
    "costs": "gross only", "sourceBoundary": "MT5 calendar plus H4 OHLC",
    "sourceHashes": {"exhaustion": hashlib.sha256(exhaustion_path.read_bytes()).hexdigest()},
  }
  manifest["manifestHash"] = digest(manifest)
  results: list[dict[str, Any]] = []
  configurations = 0
  connection = sqlite3.connect(args.database.resolve().as_uri() + "?mode=ro", uri=True)
  try:
    for market in markets:
      candles = [{"time": row[0], "open": row[1], "high": row[2], "low": row[3], "close": row[4]}
        for row in connection.execute("SELECT time,open,high,low,close FROM candle_cache WHERE symbol=? AND timeframe='H4' ORDER BY time", (market,))]
      if not candles:
        results.append({"market": market, "status": "missing_candles", "packages": []})
        continue
      candle_times = [int(row["time"]) for row in candles]
      atr_values = calculate_atr_by_candle(candles)
      package_results = []
      for label, raw_cases in sorted(event_packages(connection, market).items()):
        if (market, label) in prior_identities or len(raw_cases) < MIN_TOTAL:
          continue
        cases = sorted(raw_cases, key=lambda row: int(row["eventTime"]))
        first = len(cases) // 2
        second = len(cases) * 3 // 4
        partitions = {"development": cases[:max(0, first - 1)], "selection": cases[min(len(cases), first + 1):max(first + 1, second - 1)], "final": cases[min(len(cases), second + 1):]}
        candidates = []
        for reaction in REACTIONS:
          for direction_treatment in DIRECTIONS:
            prepared = {}
            for name, rows in partitions.items():
              prepared[name] = []
              for row in rows:
                direction = str(row["direction"])
                if direction_treatment != "both" and direction != direction_treatment:
                  continue
                if reaction == "contrarian":
                  direction = "short" if direction == "long" else "long"
                prepared[name].append({**row, "direction": direction})
            for stop_atr in STOP_ATR:
              for target_r in TARGET_R:
                for expiry in EXPIRY:
                  configurations += 1
                  evaluated = {name: [evaluate_candidate(row, candles, candle_times, atr_values, target_r, stop_atr=stop_atr, holding_candles=expiry) for row in rows] for name, rows in prepared.items()}
                  measured = {name: metrics(rows) for name, rows in evaluated.items()}
                  development = measured["development"]
                  if development["n"] < MIN_DEVELOPMENT or (development["averageR"] or 0) <= 0:
                    continue
                  candidates.append({"reaction": reaction, "directionTreatment": direction_treatment,
                    "contract": {"stopAtr": stop_atr, "targetR": target_r, "expiryH4": expiry}, "partitions": measured})
        if not candidates:
          package_results.append({"label": label, "caseCount": len(cases), "status": "no_development_contract"})
          continue
        winner = max(candidates, key=lambda row: (float(row["partitions"]["development"]["averageR"]), float(row["partitions"]["development"]["tpBeforeSl"] or 0), -float(row["contract"]["stopAtr"])))
        selection = winner["partitions"]["selection"]
        final = winner["partitions"]["final"]
        selection_passed = selection["n"] >= MIN_LATER and (selection["averageR"] or 0) > 0
        final_positive = final["n"] >= MIN_LATER and (final["averageR"] or 0) > 0
        package_results.append({"label": label, "caseCount": len(cases), "status": "exploratory_final_positive" if selection_passed and final_positive else "later_rejected",
          "selectionPassed": selection_passed, "finalPositive": final_positive, **winner})
      results.append({"market": market, "status": "completed", "packages": package_results})
  finally:
    connection.close()
  finalists = [row for market in results for row in market.get("packages", []) if row.get("status") == "exploratory_final_positive"]
  payload = {"schema": "fms-extended-corelease-result-v1", "manifest": manifest, "configurationsTested": configurations,
    "marketsCompleted": sum(row["status"] == "completed" for row in results), "packagesTested": sum(len(row.get("packages", [])) for row in results),
    "exploratoryFinalists": len(finalists), "registrations": 0, "results": results}
  payload["resultHash"] = digest(payload)
  args.output.parent.mkdir(parents=True, exist_ok=True)
  args.output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
  compact = {key: payload[key] for key in ("schema", "configurationsTested", "marketsCompleted", "packagesTested", "exploratoryFinalists", "registrations", "resultHash")}
  compact.update({"manifestHash": manifest["manifestHash"], "disclosure": manifest["promotion"], "finalists": [{"market": market["market"], **row} for market in results for row in market.get("packages", []) if row.get("status") == "exploratory_final_positive"]})
  (ROOT / "Main/src/app/lib/fmsExtendedCoreleaseSummary.json").write_text(json.dumps(compact, indent=2) + "\n", encoding="utf-8")
  print(json.dumps({key: payload[key] for key in ("configurationsTested", "marketsCompleted", "packagesTested", "exploratoryFinalists", "registrations", "resultHash")}))
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
