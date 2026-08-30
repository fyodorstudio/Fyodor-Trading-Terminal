from __future__ import annotations

import json
import math
from pathlib import Path
import statistics
import sys
from typing import Any, Dict, Iterable, List

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server
from macro_signal import (
  STRESS_HOLDING_CANDLES,
  STRESS_STOP_ATR_VALUES,
  STRESS_TARGET_R_VALUES,
  _select_stress_configuration,
  _simulate_path_configuration,
  _summarize_path_configuration,
  build_candidate_path_profile,
)


HORIZONS = (1, 3, 6, 12, 30)
WINDOW = 30


def percentile(values: Iterable[float], position: float) -> float | None:
  ordered = sorted(float(value) for value in values if math.isfinite(float(value)))
  if not ordered:
    return None
  offset = (len(ordered) - 1) * position
  lower = math.floor(offset)
  upper = math.ceil(offset)
  if lower == upper:
    return ordered[lower]
  return ordered[lower] * (upper - offset) + ordered[upper] * (offset - lower)


def distribution(values: Iterable[float]) -> Dict[str, float | None]:
  usable = [float(value) for value in values if math.isfinite(float(value))]
  return {
    "minimum": min(usable) if usable else None,
    "p25": percentile(usable, .25),
    "median": statistics.median(usable) if usable else None,
    "mean": statistics.fmean(usable) if usable else None,
    "p75": percentile(usable, .75),
    "maximum": max(usable) if usable else None,
  }


def classify(horizons: Dict[int, Dict[str, Any]], median_mfe_atr: float, median_mae_atr: float) -> str:
  rates = {horizon: float(row.get("alignmentRate") or 0) for horizon, row in horizons.items()}
  medians = {horizon: float((row.get("atr") or {}).get("median") or 0) for horizon, row in horizons.items()}
  if rates[1] >= .55 and rates[3] >= .55 and max(rates[12], rates[30]) < .50:
    return "short_lived_impulse"
  if max(rates[1], rates[3]) < .50 and max(rates[12], rates[30]) >= .55:
    return "delayed_continuation"
  if rates[3] >= .55 and rates[6] >= .55 and rates[12] >= .52 and medians[12] > 0:
    return "continuation"
  if rates[1] <= .45 and rates[3] <= .45 and rates[6] <= .45:
    return "initial_rejection"
  if median_mfe_atr >= .75 and median_mae_atr >= .75 and max(rates.values()) < .55:
    return "volatility_only"
  return "no_dependable_reaction"


def build_profile(pattern: Dict[str, Any]) -> Dict[str, Any] | None:
  benchmark = pattern.get("historicalBenchmark") or {}
  experiment_id = benchmark.get("experimentId")
  experiment = server._research_store.get_fms_experiment(str(experiment_id)) if experiment_id else None
  result = (experiment or {}).get("result") or {}
  raw_text = server._research_store.get_metadata(f"fms_raw_audit:{experiment_id}") if experiment_id else None
  if not raw_text or not result.get("splitTime"):
    return None
  raw = json.loads(raw_text)
  split_time = int(result["splitTime"])
  all_cases = [
    row for row in raw.get("cases", [])
    if row.get("included")
    and row.get("entryTime") is not None and row.get("entry") is not None and row.get("atr") is not None
  ]
  if not all_cases:
    return None
  market = str(pattern["market"])
  earliest = min(int(row["entryTime"]) for row in all_cases) - 120 * 4 * 60 * 60
  latest = max(int(row["entryTime"]) for row in all_cases) + (max(STRESS_HOLDING_CANDLES) + 2) * 4 * 60 * 60
  candles = server._research_store.query_candles(market, "H4", earliest, latest)
  candle_times = [int(candle["time"]) for candle in candles]
  all_profiles = []
  for row in all_cases:
    profile = build_candidate_path_profile({
      "eventTime": int(row["eventTime"]),
      "entryTime": int(row["entryTime"]),
      "entry": float(row["entry"]),
      "atr": float(row["atr"]),
      "direction": str(row["direction"]),
    }, candles, candle_times, max(STRESS_HOLDING_CANDLES))
    if profile is not None and len(profile["candles"]) >= WINDOW:
      profile["outcome"].update({
        "signature": str(row.get("signature") or ""),
        "numericRobustness": dict(row.get("numericRobustness") or {}),
      })
      all_profiles.append(profile)
  profiles = [profile for profile in all_profiles if int(profile["eventTime"]) >= split_time]
  if not profiles:
    return None
  stop_atr = float((pattern.get("execution") or {}).get("stopAtr") or 1)
  pip_size = .01 if market.endswith("JPY") else .0001
  horizon_rows: Dict[int, Dict[str, Any]] = {}
  for horizon in HORIZONS:
    responses_atr = [
      float(profile["sign"]) * (float(profile["candles"][horizon - 1]["close"]) - float(profile["entry"])) / float(profile["atr"])
      for profile in profiles
    ]
    responses_pips = [response * float(profile["atr"]) / pip_size for response, profile in zip(responses_atr, profiles)]
    horizon_rows[horizon] = {
      "holdingCandles": horizon,
      "evaluableN": len(responses_atr),
      "alignmentRate": sum(value > 0 for value in responses_atr) / len(responses_atr),
      "atr": distribution(responses_atr),
      "r": distribution(value / stop_atr for value in responses_atr),
      "pips": distribution(responses_pips),
    }
  mfe_atr = [max(profile["favorable"][:WINDOW]) for profile in profiles]
  mae_atr = [max(profile["adverse"][:WINDOW]) for profile in profiles]
  time_to_mfe = [profile["favorable"][:WINDOW].index(max(profile["favorable"][:WINDOW])) + 1 for profile in profiles]
  time_to_mae = [profile["adverse"][:WINDOW].index(max(profile["adverse"][:WINDOW])) + 1 for profile in profiles]
  final_atr = [
    float(profile["sign"]) * (float(profile["candles"][WINDOW - 1]["close"]) - float(profile["entry"])) / float(profile["atr"])
    for profile in profiles
  ]
  giveback_atr = [mfe - final for mfe, final in zip(mfe_atr, final_atr)]
  median_mfe = float(statistics.median(mfe_atr))
  median_mae = float(statistics.median(mae_atr))
  classification = classify(horizon_rows, median_mfe, median_mae)
  latest_event_time = max(int(profile["eventTime"]) for profile in all_profiles)
  configurations = [
    _summarize_path_configuration(
      _simulate_path_configuration(all_profiles, stop_atr_value, target_r_value, holding_candles),
      split_time,
      latest_event_time,
      stop_atr_value,
      target_r_value,
      holding_candles,
    )
    for stop_atr_value in STRESS_STOP_ATR_VALUES
    for target_r_value in STRESS_TARGET_R_VALUES
    for holding_candles in STRESS_HOLDING_CANDLES
  ]
  selected = _select_stress_configuration(configurations, len(all_profiles))
  frozen_execution = pattern.get("execution") or {}
  frozen = next((row for row in configurations if (
    float(row["stopAtr"]) == float(frozen_execution.get("stopAtr") or 1)
    and float(row["targetR"]) == float(frozen_execution.get("targetR") or 2)
    and int(row["holdingCandles"]) == int(frozen_execution.get("expiryCandles") or 30)
  )), None)
  selected_holdout = float(((selected or {}).get("holdout") or {}).get("stressedAverageR") or -999)
  frozen_holdout = float(((frozen or {}).get("holdout") or {}).get("stressedAverageR") or -999)
  alternative_status = (
    "historically_improved_candidate"
    if selected and frozen and (
      float(selected["stopAtr"]), float(selected["targetR"]), int(selected["holdingCandles"])
    ) != (
      float(frozen["stopAtr"]), float(frozen["targetR"]), int(frozen["holdingCandles"])
    ) and selected_holdout > frozen_holdout and selected_holdout > 0
    else "keep_frozen_contract"
  )
  return {
    "schema": "registered-reaction-profile-v1",
    "scope": "chronological later-test cases",
    "experimentId": str(experiment_id),
    "evaluableN": len(profiles),
    "standardWindowCandles": WINDOW,
    "classification": classification,
    "horizons": [horizon_rows[horizon] for horizon in HORIZONS],
    "mfe": {
      "atr": distribution(mfe_atr),
      "r": distribution(value / stop_atr for value in mfe_atr),
      "pips": distribution(value * float(profile["atr"]) / pip_size for value, profile in zip(mfe_atr, profiles)),
      "timeCandles": distribution(time_to_mfe),
    },
    "mae": {
      "atr": distribution(mae_atr),
      "r": distribution(value / stop_atr for value in mae_atr),
      "pips": distribution(value * float(profile["atr"]) / pip_size for value, profile in zip(mae_atr, profiles)),
      "timeCandles": distribution(time_to_mae),
    },
    "givebackAtr": distribution(giveback_atr),
    "contractResearch": {
      "selectionRule": "development lower-95 expectancy, then development average; later cases never select the contract",
      "status": alternative_status,
      "frozen": None if frozen is None else {
        "stopAtr": frozen["stopAtr"], "targetR": frozen["targetR"], "holdingCandles": frozen["holdingCandles"],
        "developmentAverageR": frozen["development"]["stressedAverageR"],
        "laterAverageR": frozen["holdout"]["stressedAverageR"],
        "laterTargetRate": frozen["holdout"]["targetHitRate"],
        "laterStopRate": frozen["holdout"]["stopHitRate"],
      },
      "developmentSelected": None if selected is None else {
        "stopAtr": selected["stopAtr"], "targetR": selected["targetR"], "holdingCandles": selected["holdingCandles"],
        "developmentAverageR": selected["development"]["stressedAverageR"],
        "laterAverageR": selected["holdout"]["stressedAverageR"],
        "laterTargetRate": selected["holdout"]["targetHitRate"],
        "laterStopRate": selected["holdout"]["stopHitRate"],
      },
    },
  }


def main() -> None:
  profiles = {}
  for pattern in server.PRACTICAL_PATTERN_DEFINITIONS:
    profile = build_profile(pattern)
    if profile is not None:
      profiles[(str(pattern["market"]), str(pattern["id"]))] = profile
  destination = Path(__file__).resolve().parents[1] / "registered_reaction_profiles.json"
  payload = {
    "schema": "registered-reaction-profile-v1",
    "horizons": list(HORIZONS),
    "profiles": {f"{market}|{pattern_id}": profile for (market, pattern_id), profile in sorted(profiles.items())},
  }
  destination.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
  print(json.dumps({"destination": str(destination), "profiles": len(profiles)}))


if __name__ == "__main__":
  main()
