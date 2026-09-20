"""Freeze an event/pair-specific H4 execution grid over one matched cohort.

Selection uses development only. Reused holdout is revealed afterward. This is
research, never registration, and it never imports the live bridge or MT5.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import sqlite3
import statistics
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Main/mt5-bridge"))
from fms_recipe_catalogue import (  # noqa: E402
  fixed_reference_case, reference_followup_case, summarize_reference, truncate_followup_case,
)
from macro_signal import calculate_atr_by_candle  # noqa: E402
from fms_prepare_v2_research import digest, digest_bytes  # noqa: E402
from fms_build_recipe_catalogue import load_verified_inventory, write_frozen  # noqa: E402


STOP_ATR = (.5, .75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0)
TARGET_R = (.25, .5, .75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0)
HORIZONS = (6, 12, 18, 30, 42, 60)


def metrics(rows: list[dict], scope: str) -> dict:
  result = summarize_reference(rows, scope)
  evaluable = int(result["evaluableCount"] or 0)
  ambiguous = int(result["ambiguousCount"] or 0)
  resolved_or_ambiguous = evaluable + ambiguous
  gross = float(result["averageGrossR"] or 0) * evaluable
  # Same-H4 ambiguity cannot be called a win. The development selector uses
  # stop-first as a conservative score, while retaining the original unknown.
  pessimistic = (gross - ambiguous) / resolved_or_ambiguous if resolved_or_ambiguous else None
  return {**result, "resolvedOrAmbiguousCount": resolved_or_ambiguous,
          "pessimisticSelectionAverageR": pessimistic,
          "targetBeforeStopRate": (result["targetHitCount"] / evaluable) if evaluable else None}


def selection_key(row: dict) -> tuple:
  development = row["partitions"]["development"]
  score = development["pessimisticSelectionAverageR"]
  return (-float(score), -int(development["resolvedOrAmbiguousCount"]),
          int(row["horizonCandles"]), float(row["targetR"]), abs(float(row["stopAtr"]) - 1.0))


def compare(candidate: dict, baseline: dict | None) -> dict | None:
  if baseline is None:
    return None
  partitions = {}
  for scope in ("development", "holdout", "overall"):
    left, right = candidate["partitions"][scope], baseline["partitions"][scope]
    partitions[scope] = {
      "candidatePessimisticAverageR": left["pessimisticSelectionAverageR"],
      "baselinePessimisticAverageR": right["pessimisticSelectionAverageR"],
      "deltaPessimisticAverageR": (
        None if left["pessimisticSelectionAverageR"] is None or right["pessimisticSelectionAverageR"] is None
        else left["pessimisticSelectionAverageR"] - right["pessimisticSelectionAverageR"]
      ),
      "candidateTargetBeforeStopRate": left["targetBeforeStopRate"],
      "baselineTargetBeforeStopRate": right["targetBeforeStopRate"],
      "candidateEvaluableN": left["evaluableCount"], "baselineEvaluableN": right["evaluableCount"],
      "candidateAmbiguousN": left["ambiguousCount"], "baselineAmbiguousN": right["ambiguousCount"],
    }
  changed = any(candidate[key] != baseline[key] for key in ("stopAtr", "targetR", "horizonCandles"))
  improves = changed and all(
    partitions[scope]["deltaPessimisticAverageR"] is not None
    and partitions[scope]["deltaPessimisticAverageR"] > 0
    for scope in ("development", "holdout")
  )
  return {"matchedCohort": True, "configurationChanged": changed,
          "improvesDevelopmentAndReusedHoldout": improves, "partitions": partitions}


def clock_audit(clock: dict, cases: list[dict]) -> dict:
  observed = [row for row in cases if row.get("status") == "observed"]
  delays = [int(row["entryTime"]) - int(row["eventTime"]) for row in observed]
  invalid = [row["caseId"] for row, delay in zip(observed, delays) if not 0 < delay <= 72 * 3600]
  phases = Counter(int(row["entryTime"]) % 14_400 for row in observed)
  by_year = Counter(datetime.fromtimestamp(int(row["eventTime"]), timezone.utc).year for row in observed)
  direct = clock["ea"]["nativeM1OpenAt"] == clock["pythonForeground"]["m1LatestOpenAt"] \
    and clock["ea"]["nativeH4OpenAt"] == clock["pythonForeground"]["h4LatestOpenAt"]
  return {
    "status": "relative_event_candle_comparison_supported" if direct and not invalid else "clock_review_required",
    "currentSameSymbolDirectMatch": direct, "currentObservedOffsetSeconds": clock["observedNativeMinusUtcSeconds"],
    "historicalObservedCases": len(observed), "entryDelaySeconds": {
      "minimum": min(delays) if delays else None, "median": statistics.median(delays) if delays else None,
      "maximum": max(delays) if delays else None,
    },
    "entryOpenPhases": {str(key): value for key, value in sorted(phases.items())},
    "casesByEventYear": {str(key): value for key, value in sorted(by_year.items())},
    "invalidRelativeOrderCaseIds": invalid,
    "relativeExecutionResearchEligible": bool(direct and not invalid),
    "prospectiveCaptureEligible": False, "historicalUtcOffsetInferred": False,
    "timestampsChanged": False,
    "limitations": [
      "The current direct sample does not supply a historical timezone/DST schedule or broker-scope identity.",
      "This audit establishes raw relative event-to-candle order in the pinned source, not absolute historical UTC.",
      "Prospective decisions require the runtime's contemporaneous broker-scoped v2 clock protocol.",
    ],
  }


def prepare(database: Path, source: Path, clock_path: Path, directory: Path) -> dict:
  inventory = load_verified_inventory(source)
  source_manifest = inventory["manifest"]
  bridge = ROOT / "Main/mt5-bridge"
  adapter = (bridge / "server.py").read_bytes()
  profiles = (bridge / "registered_reaction_profiles.json").read_bytes()
  if digest_bytes(adapter) != source_manifest["sourceSha256"]["registryAdapter"] or digest_bytes(profiles) != source_manifest["sourceSha256"]["profiles"]:
    raise ValueError("Registry/profile source changed since inventory; freeze a new source inventory")
  clock = json.loads(clock_path.read_text(encoding="utf-8"))
  if not clock.get("sameSymbolCurrentBarMatches") or clock.get("timestampsChanged"):
    raise ValueError("Current direct source-clock evidence is not usable")
  prior = json.loads((directory / "manifest.json").read_text(encoding="utf-8")) if (directory / "manifest.json").exists() else None
  evaluated_at = int(prior["evaluatedAt"]) if prior else int(time.time())
  manifest = {
    "schema": "fms-event-specific-execution-manifest-v1", "evaluatedAt": evaluated_at,
    "objective": "Optimize fixed H4 execution independently for each event/pair recipe on a matched common path cohort",
    "sourceInventoryHash": inventory["inventoryHash"], "sourceManifestHash": source_manifest["manifestHash"],
    "sourceClockSha256": digest(clock), "sourceSha256": {
      "runner": digest_bytes(Path(__file__).read_bytes()),
      "recipeDomain": digest_bytes((bridge / "fms_recipe_catalogue.py").read_bytes()),
      "macroDomain": digest_bytes((bridge / "macro_signal.py").read_bytes()),
    },
    "declaredGrid": {"stopAtr": list(STOP_ATR), "targetR": list(TARGET_R), "horizonH4": list(HORIZONS)},
    "entryPolicy": "First strictly later pinned H4 open; completed pre-entry H4 Wilder ATR14",
    "cohortPolicy": "Each recipe uses only cases with a complete valid 60-H4 path; every shorter candidate is projected from that same path",
    "orderingPolicy": "Opening gaps first; same-H4 SL/TP order remains ambiguous; selector scores ambiguity as stop-first but does not relabel it",
    "selectionPolicy": "Maximum development pessimistic average R; ties resolved N, shorter horizon, lower target, stop nearest 1 ATR",
    "holdoutPolicy": "Reused holdout revealed only after development selection; not fresh validation",
    "registrationPolicy": "Non-promoting research; explicit review and new activation required",
    "newRegistrations": 0,
  }
  manifest["manifestHash"] = digest(manifest)
  write_frozen(directory / "manifest.json", manifest)

  connection = sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)
  connection.execute("BEGIN")
  try:
    candles, prepared, raw_sources = {}, {}, {}
    for market in sorted({row["market"] for row in inventory["recipes"]}):
      rows = [dict(zip(("time", "open", "high", "low", "close", "volume"), row)) for row in connection.execute(
        "SELECT time,open,high,low,close,volume FROM candle_cache WHERE symbol=? AND timeframe='H4' ORDER BY time", (market,))]
      candles[market] = rows
      prepared[market] = ([row["time"] for row in rows], calculate_atr_by_candle(rows))
    for recipe in inventory["recipes"]:
      raw = connection.execute("SELECT value FROM metadata WHERE key=?", (f"fms_raw_audit:{recipe['experimentId']}",)).fetchone()
      if not raw or digest_bytes(raw[0].encode()) != recipe["rawAuditSha256"]:
        raise ValueError(f"Immutable source changed: {recipe['recipe']}")
      raw_sources[recipe["recipe"]] = json.loads(raw[0])

    results, all_common = [], []
    for recipe in inventory["recipes"]:
      raw = raw_sources[recipe["recipe"]]
      included = [row for row in raw["cases"] if row.get("included")]
      selected_rows = {row["caseId"]: row for row in raw["contractResults"][raw["selectedContractKey"]]}
      series = candles[recipe["market"]]
      times, atrs = prepared[recipe["market"]]
      common = [reference_followup_case(
        case, (selected_rows.get(case["caseId"]) or {}).get("direction", ""),
        series, times, atrs, max(HORIZONS), as_of=evaluated_at,
      ) for case in included]
      all_common.extend(common)
      contracts = []
      for horizon in HORIZONS:
        paths = [truncate_followup_case(row, horizon) for row in common]
        for stop in STOP_ATR:
          for target in TARGET_R:
            outcomes = [fixed_reference_case(row, target, stop) for row in paths]
            partitions = {
              "overall": metrics(outcomes, "overall"),
              "development": metrics([row for row in outcomes if row["eventTime"] < recipe["splitTime"]], "development"),
              "holdout": metrics([row for row in outcomes if row["eventTime"] >= recipe["splitTime"]], "holdout"),
            }
            contracts.append({"key": f"{stop:g}|{target:g}|{horizon}", "stopAtr": stop, "targetR": target,
                              "horizonCandles": horizon, "partitions": partitions})
      selectable = [row for row in contracts if row["partitions"]["development"]["pessimisticSelectionAverageR"] is not None]
      selected = min(selectable, key=selection_key) if selectable else None
      snapshot = recipe.get("snapshotExecution") or {}
      baseline = next((row for row in contracts
                       if str(snapshot.get("entryTimeframe") or "H4") == "H4"
                       and str(snapshot.get("managementFamily") or "fixed") == "fixed"
                       and row["stopAtr"] == snapshot.get("stopAtr") and row["targetR"] == snapshot.get("targetR")
                       and row["horizonCandles"] == snapshot.get("expiryCandles")), None)
      comparison = compare(selected, baseline) if selected else None
      dev_score = None if selected is None else selected["partitions"]["development"]["pessimisticSelectionAverageR"]
      holdout_score = None if selected is None else selected["partitions"]["holdout"]["pessimisticSelectionAverageR"]
      status = ("coverage_unavailable" if selected is None else
                "matched_v1_improvement_lead" if comparison and comparison["improvesDevelopmentAndReusedHoldout"] and holdout_score > 0 else
                "positive_reused_history_lead" if dev_score > 0 and holdout_score is not None and holdout_score > 0 else
                "nonpositive_reused_history")
      results.append({
        "recipe": recipe["recipe"], "market": recipe["market"], "patternId": recipe["patternId"], "label": recipe["label"],
        "status": status, "splitTime": recipe["splitTime"], "commonPathAttemptedN": len(common),
        "commonPathObservedN": sum(row["status"] == "observed" for row in common),
        "selectedContract": selected, "matchedV1Contract": baseline,
        "matchedV1Comparison": comparison, "originalExecutionReview": recipe["executionReview"],
        "reviewedH1": recipe["reviewedH1"], "noteKeys": recipe["noteKeys"],
        "newRegistration": False,
      })
    audit = clock_audit(clock, all_common)
    payload = {
      "schema": "fms-event-specific-execution-research-v1", "manifest": manifest, "clockAudit": audit,
      "summary": {"recipes": len(results), "markets": len({row["market"] for row in results}),
                  "contractsPerRecipe": len(STOP_ATR) * len(TARGET_R) * len(HORIZONS),
                  "statuses": dict(Counter(row["status"] for row in results)),
                  "matchedV1Recipes": sum(row["matchedV1Contract"] is not None for row in results),
                  "newRegistrations": 0},
      "limitations": inventory["limitations"] + [
        "Recipe-specific optimization is deliberate; it increases selection flexibility and is labeled rather than hidden.",
        "The reused holdout and event episodes shared across pairs are not fresh independent validation.",
        "No spread, slippage, commission, swap or execution delay is modeled; results remain gross.",
        "H1/release-near entry, break-even management and structural bands are outside this fixed-H4 grid.",
        "Positive historical evidence is a research lead, not a profitability promise or automatic registration.",
      ],
      "recipes": results,
    }
    payload["researchHash"] = digest(payload)
    write_frozen(directory / "research.json", payload)
    return payload
  finally:
    connection.rollback()
    connection.close()


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--database", type=Path, default=Path(os.environ.get("FYODOR_RESEARCH_DB") or str(Path(os.environ["LOCALAPPDATA"]) / "Fyodor Trading Terminal/fyodor-research.sqlite3")))
  parser.add_argument("--source", type=Path, required=True)
  parser.add_argument("--clock", type=Path, required=True)
  parser.add_argument("--directory", type=Path, required=True)
  args = parser.parse_args()
  result = prepare(args.database, args.source, args.clock, args.directory)
  print(json.dumps({**result["summary"], "clockStatus": result["clockAudit"]["status"],
                    "manifestHash": result["manifest"]["manifestHash"], "researchHash": result["researchHash"]}))


if __name__ == "__main__":
  main()
