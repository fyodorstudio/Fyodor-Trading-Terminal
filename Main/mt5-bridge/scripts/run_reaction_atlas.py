from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys
import time
from typing import Any, Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server
from macro_signal import (
  REACTION_ATLAS_VERSION,
  _annotate_numeric_robustness,
  _build_policy_path_profile,
  _evaluate_path_configuration,
  _rescore_policy_outcomes,
  calculate_atr_by_candle,
  candidate_pattern_signature,
  build_reaction_atlas,
)


def compact_experiment(result: Dict[str, Any], configuration: Dict[str, Any]) -> Dict[str, Any]:
  selected = result["selectedConfiguration"]
  return {
    "configuration": configuration,
    "configurationHash": hashlib.sha256(
      json.dumps(configuration, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest(),
    "historicalN": result["historicalN"],
    "development": selected["development"],
    "holdout": selected["holdout"],
    "recent": selected["recent"],
    "overall": selected["overall"],
    "checks": result.get("checks", {}),
  }


def registered_reaudit(market: str, bundle: Dict[str, Any]) -> List[Dict[str, Any]]:
  rows: List[Dict[str, Any]] = []
  policies = ("baseline", "surprise_only", "momentum_only", "agreement_no_bonus", "forecast_quality")
  candles = sorted(bundle["candles"], key=lambda row: int(row["time"]))
  candle_times = [int(row["time"]) for row in candles]
  atr_values = calculate_atr_by_candle(candles)
  for pattern in server.PRACTICAL_PATTERN_DEFINITIONS:
    if str(pattern["market"]) != market or not pattern.get("current"):
      continue
    execution = pattern["execution"]
    current_policy = str(pattern.get("scoringPolicy", "forecast_quality"))
    declared_variants = [
      (policy, {"dimension": "none", "value": "all"}, "continuation")
      for policy in policies
    ] + [
      (current_policy, {"dimension": "relativeMagnitude", "value": value}, "continuation")
      for value in ("ordinary", "upper_tail")
    ] + [
      (current_policy, {"dimension": "none", "value": "all"}, "contrarian")
    ]
    audits = []
    for policy, cohort, reaction in declared_variants:
      configuration = {
            "market": market,
            "sourceVersionId": pattern["sourceVersion"],
            "signature": pattern["signatures"][0],
            "signatures": list(pattern["signatures"]),
            "directionSelection": "both" if len(pattern["signatures"]) > 1 else pattern["signatures"][0].split("|", 1)[0],
            "scoringPolicy": policy,
            "cohort": cohort,
            "reaction": reaction,
            "execution": {
              "mode": "single",
              "stopAtrValues": [float(execution["stopAtr"])],
              "targetRValues": [float(execution["targetR"])],
              "holdingCandles": [int(execution["expiryCandles"])],
            },
      }
      try:
        source = next(row for row in bundle["sources"] if row["versionId"] == pattern["sourceVersion"])
        rescored, _forecast_audit = _rescore_policy_outcomes(source["outcomes"], policy)
        outcomes = _annotate_numeric_robustness(rescored)
        selected_rows = []
        for outcome in outcomes:
          if outcome.get("direction") not in {"long", "short"}:
            continue
          if candidate_pattern_signature(outcome) not in pattern["signatures"]:
            continue
          dimension = cohort["dimension"]
          value = cohort["value"]
          observed = str((outcome.get("numericRobustness") or {}).get(dimension, "unknown"))
          if dimension != "none" and not (
            observed == value or (dimension == "relativeMagnitude" and value == "upper_tail" and observed in {"large", "exceptional"})
          ):
            continue
          selected_rows.append(outcome)
        profiles = [
          profile for row in selected_rows
          if (profile := _build_policy_path_profile(row, candles, candle_times, atr_values)) is not None
        ]
        if reaction == "contrarian":
          profiles = [{
            **profile,
            "outcome": {**profile["outcome"], "direction": "short" if profile["direction"] == "long" else "long"},
            "direction": "short" if profile["direction"] == "long" else "long",
            "sign": -float(profile["sign"]),
          } for profile in profiles]
        if not profiles:
          raise ValueError("No evaluable historical cases")
        selected = _evaluate_path_configuration(
          profiles,
          int(source["splitTime"]),
          max(int(row["eventTime"]) for row in selected_rows),
          float(execution["stopAtr"]),
          float(execution["targetR"]),
          int(execution["expiryCandles"]),
        )
        audits.append({
          "configuration": configuration,
          "configurationHash": hashlib.sha256(json.dumps(configuration, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
          "historicalN": len(profiles),
          "development": selected["development"],
          "holdout": selected["holdout"],
          "recent": selected["recent"],
          "overall": selected["overall"],
        })
      except ValueError as exc:
        audits.append({"configuration": configuration, "error": str(exc)})
    valid = [row for row in audits if "error" not in row]
    current = next((row for row in valid if (
      row["configuration"]["scoringPolicy"] == pattern.get("scoringPolicy", "forecast_quality")
      and row["configuration"]["cohort"]["dimension"] == "none"
      and row["configuration"]["reaction"] == "continuation"
    )), None)
    development_ranked = sorted(valid, key=lambda row: (
      float(((row["development"].get("stressedExpectancyCi95") or {}).get("lower")) or -999.0),
      float(row["development"].get("stressedAverageR") or -999.0),
      int(row["historicalN"]),
    ), reverse=True)
    rows.append({
      "market": market,
      "patternId": pattern["id"],
      "label": pattern["label"],
      "experimentId": pattern.get("historicalBenchmark", {}).get("experimentId"),
      "fixedExecution": dict(execution),
      "currentRecipe": current,
      "developmentSelectedChallenger": development_ranked[0] if development_ranked else None,
      "audits": audits,
    })
  return rows


def main() -> None:
  parser = argparse.ArgumentParser()
  parser.add_argument("--markets", nargs="*", default=list(server.WORKBENCH_MARKETS))
  parser.add_argument("--magnitude-only", action="store_true")
  args = parser.parse_args()
  generated_at = int(time.time())
  previous = json.loads(server._research_store.get_metadata("fms_reaction_atlas:latest") or "{}")
  atlases = list(previous.get("markets", [])) if args.magnitude_only else []
  magnitude_atlases = []
  reaudit = list(previous.get("registeredReaudit", [])) if args.magnitude_only else []
  for atlas in atlases:
    for row in atlas.get("rows", []):
      row.setdefault("cohort", "all")
  for market in [value.upper() for value in args.markets]:
    started = time.time()
    bundle = server._workbench_source_bundle(market)
    if not args.magnitude_only:
      atlas = build_reaction_atlas(market, bundle["sources"], bundle["candles"], bundle["cutoff"])
      atlas["datasetFingerprint"] = bundle["datasetFingerprint"]
      for row in atlas["rows"]:
        row["cohort"] = "all"
      atlases.append(atlas)
      reaudit.extend(registered_reaudit(market, bundle))
      print(json.dumps({
        "market": market, "cohort": "all", "counts": atlas["counts"],
        "rows": len(atlas["rows"]), "seconds": round(time.time() - started, 2),
      }), flush=True)
    for cohort in ("ordinary", "upper_tail"):
      filtered_sources = []
      for source in bundle["sources"]:
        annotated = _annotate_numeric_robustness(source["outcomes"])
        selected = [
          row for row in annotated
          if str((row.get("numericRobustness") or {}).get("relativeMagnitude", "insufficient")) == cohort
          or (
            cohort == "upper_tail"
            and str((row.get("numericRobustness") or {}).get("relativeMagnitude", "insufficient")) in {"large", "exceptional"}
          )
        ]
        filtered_sources.append({**source, "outcomes": selected})
      magnitude = build_reaction_atlas(
        market, filtered_sources, bundle["candles"], bundle["cutoff"], minimum_cases=40
      )
      magnitude["datasetFingerprint"] = bundle["datasetFingerprint"]
      magnitude["cohort"] = cohort
      for row in magnitude["rows"]:
        row["cohort"] = cohort
      magnitude_atlases.append(magnitude)
      print(json.dumps({
        "market": market, "cohort": cohort, "counts": magnitude["counts"],
        "rows": len(magnitude["rows"]), "seconds": round(time.time() - started, 2),
      }), flush=True)
  artifact = {
    "version": REACTION_ATLAS_VERSION,
    "generatedAt": generated_at,
    "markets": atlases,
    "magnitudeMarkets": magnitude_atlases,
    "registeredReaudit": reaudit,
  }
  artifact["artifactHash"] = hashlib.sha256(
    json.dumps(artifact, sort_keys=True, separators=(",", ":")).encode("utf-8")
  ).hexdigest()
  server._research_store.set_metadata(
    "fms_reaction_atlas:latest", json.dumps(artifact, separators=(",", ":"))
  )
  server._research_store.set_metadata("fms_reaction_atlas:revision", artifact["artifactHash"])
  print(json.dumps({
    "stored": True,
    "artifactHash": artifact["artifactHash"],
    "markets": len(atlases),
    "registeredReaudit": len(reaudit),
  }), flush=True)


if __name__ == "__main__":
  main()
