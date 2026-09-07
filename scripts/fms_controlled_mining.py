"""Run a finite, auditable no-trade-filter search on frozen registered cases.

This is an exploratory lane. It cannot edit the registry and it never treats the
last chronological block as fresh proof because the underlying archive has been
used by earlier FMS research.
"""
from __future__ import annotations

import argparse
import bisect
import hashlib
import itertools
import json
import os
from pathlib import Path
import sqlite3
import statistics
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Main/mt5-bridge"))
from macro_signal import calculate_atr_by_candle, evaluate_candidate  # noqa: E402
FEATURES = ("evidenceMode", "revisionReliability", "backgroundAlignment", "scoreStrength", "packageCompleteness", "relativeMagnitude", "sessionJakarta", "releaseWindow", "forecastQuality", "surpriseShape", "momentumShape", "packageDisagreement", "priorRecipeDirectionShape", "priorSeriesSurpriseShape", "crossPairConfirmation", "directionalRoom", "entryAtrRegime", "preReleaseRange", "preReleaseTrend", "entryGap")

def digest(value: object) -> str:
  return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

def metrics(rows: list[dict]) -> dict:
  values = [float(row["grossResultR"]) for row in rows if row.get("grossResultR") is not None]
  if not values: return {"n": 0}
  peak = drawdown = equity = 0.0; streak = longest = 0
  for value in values:
    equity += value; peak = max(peak, equity); drawdown = max(drawdown, peak - equity)
    streak = streak + 1 if value < 0 else 0; longest = max(longest, streak)
  wins = sorted((value for value in values if value > 0), reverse=True)
  return {"n": len(values), "averageR": statistics.fmean(values), "medianR": statistics.median(values),
    "tpBeforeSl": sum(row.get("status") == "target_hit" for row in rows) / len(values),
    "expiryRate": sum(row.get("status") == "expired" for row in rows) / len(values),
    "maxDrawdownR": drawdown, "longestLosingStreak": longest,
    "largestWinShare": (wins[0] / sum(wins)) if wins and sum(wins) else None,
    "years": sorted({__import__("datetime").datetime.fromtimestamp(int(row["eventTime"]), __import__("datetime").timezone.utc).year for row in rows})}

def case_features(case: dict) -> dict:
  robust = case.get("numericRobustness") or {}
  hour = (__import__("datetime").datetime.fromtimestamp(int(case["eventTime"]), __import__("datetime").timezone.utc).hour + 7) % 24
  events = case.get("events") or []
  surprise = [event.get("surprisePoint") for event in events if event.get("surprisePoint") is not None]
  momentum = [event.get("momentumPoint") for event in events if event.get("momentumPoint") is not None]
  shape = lambda values: "positive" if values and sum(values) > 0 else "negative" if values and sum(values) < 0 else "flat_or_missing"
  return {**{key: str(robust.get(key, "unknown")) for key in FEATURES[:6]},
    "sessionJakarta": "asia" if hour < 8 else "europe" if hour < 15 else "us",
    "releaseWindow": f"{hour // 4 * 4:02d}-{hour // 4 * 4 + 4:02d}",
    "forecastQuality": "suspect" if any(event.get("forecastSuspect") for event in events) else "ordinary",
    "surpriseShape": shape(surprise), "momentumShape": shape(momentum),
    "packageDisagreement": "disagrees" if len({event.get("score", 0) > 0 for event in events if event.get("score", 0) != 0}) > 1 else "aligned_or_single",
    "priorRecipeDirectionShape": "unknown"}

def main() -> int:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--output", type=Path, required=True)
  parser.add_argument("--database", type=Path, default=Path(os.environ["LOCALAPPDATA"]) / "Fyodor Trading Terminal/fyodor-research.sqlite3")
  args = parser.parse_args()
  profiles_path = ROOT / "Main/mt5-bridge/registered_reaction_profiles.json"
  profiles = json.loads(profiles_path.read_text(encoding="utf-8-sig"))["profiles"]
  manifest = {"schema": "fms-controlled-mining-manifest-v1", "lane": "Exploratory mined candidate", "registryMutable": False,
    "profileSha256": hashlib.sha256(profiles_path.read_bytes()).hexdigest(), "features": FEATURES,
    "maximumFeaturesPerRule": 2, "maximumConfigurationsPerRecipe": 300, "chronology": "50% development (internally split 70/30 when each side can retain minimum N), 25% selection-procedure check, 25% final reused-history audit",
    "embargo": "one adjacent case removed at each boundary", "objective": "development average-R uplift, then TP-before-SL",
    "minimumPerPartition": 5, "selectionGate": "positive development and selection average-R uplift; final is reported once",
    "controls": ["unchanged parent", "always long", "always short", "opposite direction", "same-direction seven-calendar-day pre-event control"], "costs": "gross only",
    "limitations": ["The archive was inspected by earlier research, so the last block is not globally untouched.", "Filters can withhold a registered case but cannot create a new direction or execution contract."]}
  trials = []; finalists = []; raw_by_recipe = {}; candle_cache = {}
  connection = sqlite3.connect(args.database.resolve().as_uri() + "?mode=ro", uri=True)
  try:
    raw_audits = {}; cross_votes = {}
    for recipe, profile in sorted(profiles.items()):
      raw_row = connection.execute("SELECT value FROM metadata WHERE key=?", (f"fms_raw_audit:{profile['experimentId']}",)).fetchone()
      if not raw_row: continue
      audit = json.loads(raw_row[0]); raw_audits[recipe] = audit
      outcomes = {row["caseId"]: row for row in audit["contractResults"][audit["selectedContractKey"]]}
      market = recipe.split("|", 1)[0]
      for case in audit["cases"]:
        outcome = outcomes.get(case.get("caseId"))
        if not case.get("included") or not outcome: continue
        for currency in {str(event.get("currency", "")).upper() for event in case.get("events", [])}:
          if currency not in (market[:3], market[3:]): continue
          direction_vote = 1 if outcome["direction"] == "long" else -1
          currency_vote = direction_vote if currency == market[:3] else -direction_vote
          cross_votes.setdefault((int(case["eventTime"]), currency), {})[market] = currency_vote
    for recipe, profile in sorted(profiles.items()):
      audit = raw_audits.get(recipe)
      if not audit: continue
      outcomes = {row["caseId"]: row for row in audit["contractResults"][audit["selectedContractKey"]]}
      cases = [{**outcomes[row["caseId"]], "_sourceEvents": row.get("events", []), "features": case_features(row)} for row in audit["cases"] if row.get("included") and row["caseId"] in outcomes]
      cases.sort(key=lambda row: row["eventTime"])
      market = recipe.split("|", 1)[0]
      if market not in candle_cache:
        candles = [{"time": row[0], "open": row[1], "high": row[2], "low": row[3], "close": row[4]}
          for row in connection.execute("SELECT time,open,high,low,close FROM candle_cache WHERE symbol=? AND timeframe='H4' ORDER BY time", (market,))]
        candle_cache[market] = (candles, [row["time"] for row in candles], calculate_atr_by_candle(candles))
      candles, candle_times, atr_values = candle_cache[market]
      previous_direction = None
      prior_series_surprise = {}
      prior_atrs = []
      for case in cases:
        current_direction = case.get("direction")
        case["features"]["priorRecipeDirectionShape"] = "unknown" if previous_direction is None else "same" if current_direction == previous_direction else "reversal"
        previous_direction = current_direction
        comparisons = []
        for event in case["_sourceEvents"]:
          identity = (str(event.get("currency", "")), str(event.get("countryCode", "")), str(event.get("title", "")).lower())
          point = event.get("surprisePoint")
          previous = prior_series_surprise.get(identity)
          if point not in (None, 0) and previous not in (None, 0): comparisons.append("same" if (point > 0) == (previous > 0) else "reversal")
          if point not in (None, 0): prior_series_surprise[identity] = point
        case["features"]["priorSeriesSurpriseShape"] = comparisons[0] if comparisons and len(set(comparisons)) == 1 else "mixed" if comparisons else "unknown"
        cross_states = []
        for currency in {str(event.get("currency", "")).upper() for event in case["_sourceEvents"]}:
          votes = cross_votes.get((int(case["eventTime"]), currency), {})
          if len(votes) >= 2: cross_states.append("confirmed" if len(set(votes.values())) == 1 else "conflicted")
        case["features"]["crossPairConfirmation"] = "conflicted" if "conflicted" in cross_states else "confirmed" if cross_states else "isolated"
        case["features"]["directionalRoom"] = str(((cases_by_context := next((row for row in audit["cases"] if row.get("caseId") == case["caseId"]), {})).get("supportResistance") or {}).get("roomState", "unknown"))
        atr = float(case.get("atr") or 0)
        if len(prior_atrs) >= 10 and atr > 0:
          median_atr = statistics.median(prior_atrs)
          case["features"]["entryAtrRegime"] = "high" if atr > median_atr * 1.25 else "low" if atr < median_atr * .75 else "ordinary"
        else: case["features"]["entryAtrRegime"] = "insufficient"
        if atr > 0: prior_atrs.append(atr)
        index = bisect.bisect_right(candle_times, int(case["eventTime"]))
        prior = candles[max(0, index - 12):index]
        if atr > 0 and len(prior) >= 12 and index < len(candles):
          range_ratio = statistics.fmean(float(row["high"]) - float(row["low"]) for row in prior[-6:]) / atr
          case["features"]["preReleaseRange"] = "compressed" if range_ratio < .8 else "expanded" if range_ratio > 1.2 else "ordinary"
          trend = (float(prior[-1]["close"]) - float(prior[0]["close"])) / atr
          case["features"]["preReleaseTrend"] = "up" if trend > .25 else "down" if trend < -.25 else "flat"
          gap = abs(float(candles[index]["open"]) - float(prior[-1]["close"])) / atr
          case["features"]["entryGap"] = "large" if gap >= .25 else "ordinary"
        else:
          case["features"].update(preReleaseRange="insufficient", preReleaseTrend="insufficient", entryGap="insufficient")
      a, b = len(cases) // 2, len(cases) * 3 // 4
      partitions = {"development": cases[:max(0, a-1)], "selection": cases[min(len(cases), a+1):max(a+1, b-1)], "final": cases[min(len(cases), b+1):]}
      raw_by_recipe[recipe] = partitions
      values = {feature: sorted({row["features"][feature] for row in cases}) for feature in FEATURES}
      rules = [((feature, value),) for feature in FEATURES for value in values[feature]]
      rules += [pair for left, right in itertools.combinations(FEATURES, 2) for pair in itertools.product(((left, value) for value in values[left]), ((right, value) for value in values[right]))]
      rules = rules[:manifest["maximumConfigurationsPerRecipe"]]
      recipe_trials = []
      for rule in rules:
        result = {"recipe": recipe, "rule": dict(rule), "partitions": {}}
        passed = True
        for name, parent in (("development", partitions["development"]), ("selection", partitions["selection"])):
          kept = [row for row in parent if all(row["features"][key] == value for key, value in rule)]
          parent_metrics, kept_metrics = metrics(parent), metrics(kept)
          result["partitions"][name] = {"parent": parent_metrics, "kept": kept_metrics,
            "upliftAverageR": None if kept_metrics["n"] == 0 else kept_metrics["averageR"] - parent_metrics["averageR"]}
          if name in ("development", "selection") and (kept_metrics["n"] < manifest["minimumPerPartition"] or result["partitions"][name]["upliftAverageR"] <= 0): passed = False
        development = partitions["development"]
        inner_at = int(len(development) * .7)
        inner_parts = {"innerDevelopment": development[:inner_at], "innerValidation": development[inner_at:]}
        result["nestedSelectionApplied"] = all(len(rows) >= manifest["minimumPerPartition"] for rows in inner_parts.values())
        if result["nestedSelectionApplied"]:
          for name, parent in inner_parts.items():
            kept = [row for row in parent if all(row["features"][key] == value for key, value in rule)]
            parent_metrics, kept_metrics = metrics(parent), metrics(kept)
            result["partitions"][name] = {"parent": parent_metrics, "kept": kept_metrics,
              "upliftAverageR": None if kept_metrics["n"] == 0 else kept_metrics["averageR"] - parent_metrics["averageR"]}
            if kept_metrics["n"] < manifest["minimumPerPartition"] or result["partitions"][name]["upliftAverageR"] <= 0: passed = False
        result["passedSelection"] = passed
        recipe_trials.append(result)
      trials.extend(recipe_trials)
      eligible = [row for row in recipe_trials if row["passedSelection"]]
      if eligible:
        winner = max(eligible, key=lambda row: (row["partitions"]["development"]["upliftAverageR"], row["partitions"]["development"]["kept"].get("tpBeforeSl", -1)))
        final_parent = partitions["final"]
        final_kept = [row for row in final_parent if all(row["features"][key] == value for key, value in winner["rule"].items())]
        final_parent_metrics, final_kept_metrics = metrics(final_parent), metrics(final_kept)
        winner["partitions"]["final"] = {"parent": final_parent_metrics, "kept": final_kept_metrics,
          "upliftAverageR": None if final_kept_metrics["n"] == 0 else final_kept_metrics["averageR"] - final_parent_metrics["averageR"]}
        finalists.append({**winner, "identity": "Exploratory / high overfit risk", "promotion": "shadow_only_unregistered"})
    for finalist in finalists:
      recipe = finalist["recipe"]; market = recipe.split("|", 1)[0]
      if market not in candle_cache:
        candles = [{"time": row[0], "open": row[1], "high": row[2], "low": row[3], "close": row[4]}
          for row in connection.execute("SELECT time,open,high,low,close FROM candle_cache WHERE symbol=? AND timeframe='H4' ORDER BY time", (market,))]
        candle_cache[market] = (candles, [row["time"] for row in candles], calculate_atr_by_candle(candles))
      candles, candle_times, atr_values = candle_cache[market]
      profile = profiles[recipe]; audit = json.loads(connection.execute("SELECT value FROM metadata WHERE key=?", (f"fms_raw_audit:{profile['experimentId']}",)).fetchone()[0])
      contract = next(row for row in audit["contracts"] if row["key"] == audit["selectedContractKey"])
      kept_ids = {row["caseId"] for row in raw_by_recipe[recipe]["final"] if all(row["features"][key] == value for key, value in finalist["rule"].items())}
      cases_by_id = {row["caseId"]: row for row in audit["cases"] if row.get("included")}
      controls = {name: [] for name in ("alwaysLong", "alwaysShort", "oppositeDirection", "nonEventSevenDaysEarlier")}
      for case_id in kept_ids:
        source = cases_by_id[case_id]
        base = {"eventTime": source["eventTime"], "direction": source["direction"], "agreement": "consensus", "pairVote": 1,
          "backgroundDirection": "none", "backgroundPairVote": 0, "backgroundAlignment": "neutral", "highestImpact": "high", "factorVotes": [], "events": source.get("events", [])}
        variants = {"alwaysLong": {**base, "direction": "long"}, "alwaysShort": {**base, "direction": "short"},
          "oppositeDirection": {**base, "direction": "short" if base["direction"] == "long" else "long"},
          "nonEventSevenDaysEarlier": {**base, "eventTime": int(base["eventTime"]) - 7 * 86400}}
        for name, candidate in variants.items():
          controls[name].append(evaluate_candidate(candidate, candles, candle_times, atr_values, float(contract["targetR"]),
            stop_atr=float(contract["stopAtr"]), holding_candles=int(contract["holdingCandles"])))
      finalist["controlMetrics"] = {name: metrics(rows) for name, rows in controls.items()}
  finally: connection.close()
  manifest["declaredConfigurationCount"] = len(trials)
  manifest["multipleSearchDiagnostic"] = {"method": "complete trial count plus nested survival rate; no p-value promotion gate",
    "warning": "The archive is reused and categorical configurations are correlated; no survivor is eligible for registration regardless of apparent significance."}
  manifest["manifestHash"] = digest(manifest)
  payload = {"schema": "fms-controlled-mining-result-v1", "manifest": manifest, "attempts": trials, "finalists": finalists,
    "summary": {"recipes": len(profiles), "attempts": len(trials), "selectionSurvivors": sum(row["passedSelection"] for row in trials), "recipeFinalists": len(finalists), "registrations": 0}}
  payload["resultHash"] = digest(payload)
  args.output.parent.mkdir(parents=True, exist_ok=True); args.output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
  compact = {"schema": "fms-controlled-mining-summary-v1", "manifestHash": manifest["manifestHash"], "resultHash": payload["resultHash"],
    "summary": payload["summary"], "disclosure": "Exploratory / high overfit risk. Reused historical archive; no registration or real-money eligibility.",
    "finalists": [{"recipe": row["recipe"], "rule": row["rule"], "development": row["partitions"]["development"],
      "selection": row["partitions"]["selection"], "final": row["partitions"]["final"],
      "controlMetrics": row.get("controlMetrics", {}),
      "finalAuditPositive": row["partitions"]["final"]["kept"].get("n", 0) >= manifest["minimumPerPartition"] and row["partitions"]["final"]["upliftAverageR"] > 0}
      for row in finalists]}
  (ROOT / "Main/src/app/lib/fmsControlledMiningSummary.json").write_text(json.dumps(compact, indent=2) + "\n", encoding="utf-8")
  print(json.dumps({**payload["summary"], "manifestHash": manifest["manifestHash"], "resultHash": payload["resultHash"]}))
  return 0

if __name__ == "__main__": raise SystemExit(main())
