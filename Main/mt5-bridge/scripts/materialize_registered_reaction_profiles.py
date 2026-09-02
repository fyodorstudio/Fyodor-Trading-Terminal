from __future__ import annotations

import argparse
import json
import hashlib
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
  _resolve_m1_order,
  _mean_ci95,
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


def context_categories(profile: Dict[str, Any]) -> Dict[str, str]:
  context = profile.get("marketContext") or {}
  price = context.get("price") or {}
  volatility = context.get("volatility") or {}
  support = context.get("supportResistance") or {}
  background = context.get("macroBackground") or {}
  environment = context.get("releaseEnvironment") or {}
  return {
    "priceRegime": str(price.get("regime") or "unknown"),
    "trendRelation": str(price.get("relationToSignal") or "unknown"),
    "volatilityRegime": str(volatility.get("regime") or "unknown"),
    "directionalRoom": str(support.get("roomState") or "unknown"),
    "macroBackground": str(background.get("relationToSignal") or "unknown"),
    "releaseSession": str(environment.get("session") or "unknown"),
  }


def context_reaction_metrics(profiles: List[Dict[str, Any]], horizon: int = 6) -> Dict[str, Any]:
  usable = [profile for profile in profiles if len(profile.get("candles") or []) >= horizon]
  values = [
    float(profile["sign"]) * (float(profile["candles"][horizon - 1]["close"]) - float(profile["entry"])) / float(profile["atr"])
    for profile in usable
  ]
  return {
    "evaluableN": len(values),
    "alignmentRate": sum(value > 0 for value in values) / len(values) if values else None,
    "medianAtr": statistics.median(values) if values else None,
    "averageAtr": statistics.fmean(values) if values else None,
    "ci95": _mean_ci95(values),
  }


def context_path_metrics(profiles: List[Dict[str, Any]]) -> Dict[str, Any]:
  """Describe direction and path without letting these later diagnostics select a context."""
  horizons = {
    str(horizon): context_reaction_metrics(profiles, horizon)
    for horizon in HORIZONS
  }
  usable = [profile for profile in profiles if len(profile.get("candles") or []) >= WINDOW]
  mfe = [max(float(value) for value in profile["favorable"][:WINDOW]) for profile in usable]
  mae = [max(float(value) for value in profile["adverse"][:WINDOW]) for profile in usable]
  return {
    "horizons": horizons,
    "mfeAtr": distribution(mfe),
    "maeAtr": distribution(mae),
    "timeToMfeH4": distribution(
      profile["favorable"][:WINDOW].index(max(profile["favorable"][:WINDOW])) + 1
      for profile in usable
    ),
    "timeToMaeH4": distribution(
      profile["adverse"][:WINDOW].index(max(profile["adverse"][:WINDOW])) + 1
      for profile in usable
    ),
  }


def classify_context_relationship(
  selected: Dict[str, Any] | None,
  baseline_later_execution: Dict[str, Any],
  baseline_later_reaction: Dict[str, Any],
) -> str:
  if not selected or int((selected.get("laterReaction") or {}).get("evaluableN") or 0) < 10:
    return "not_enough_cases"
  execution_uplift = float(selected.get("laterExecutionUpliftR") or 0)
  alignment_uplift = float(selected.get("laterAlignmentUplift") or 0)
  later_execution = float((selected.get("laterExecution") or {}).get("averageR") or 0)
  later_reaction = float((selected.get("laterReaction") or {}).get("averageAtr") or 0)
  baseline_execution = float(baseline_later_execution.get("averageR") or 0)
  baseline_reaction = float(baseline_later_reaction.get("averageAtr") or 0)
  if later_execution > 0 and later_reaction > 0 and execution_uplift >= .05 and alignment_uplift >= 0:
    return "context_improves_setup"
  if execution_uplift <= -.05 or alignment_uplift <= -.05 or (
    later_execution < baseline_execution and later_reaction < baseline_reaction
  ):
    return "context_weakens_setup"
  return "no_meaningful_difference"


def build_context_research(
  profiles: List[Dict[str, Any]],
  split_time: int,
  active: Dict[str, Any],
  m1_resolver=None,
) -> Dict[str, Any]:
  family = str(active.get("managementFamily") or "fixed")
  stop_atr = float(active.get("stopAtr") or 1)
  target_r = float(active.get("targetR") or 2)
  holding = int(active.get("expiryCandles") or 30)
  trigger = active.get("managementTriggerR")
  rows: List[Dict[str, Any]] = []
  baseline_development = [profile for profile in profiles if int(profile["eventTime"]) < split_time]
  baseline_later = [profile for profile in profiles if int(profile["eventTime"]) >= split_time]
  baseline_simulations = [
    {**simulate_managed(profile, family, stop_atr, target_r, holding, trigger, m1_resolver), "eventTime": int(profile["eventTime"])}
    for profile in profiles
  ]
  baseline_development_execution = aggregate_managed([row for row in baseline_simulations if row["eventTime"] < split_time])
  baseline_later_execution = aggregate_managed([row for row in baseline_simulations if row["eventTime"] >= split_time])
  baseline_development_reaction = context_reaction_metrics(baseline_development)
  baseline_later_reaction = context_reaction_metrics(baseline_later)
  dimensions = ("priceRegime", "trendRelation", "volatilityRegime", "directionalRoom", "macroBackground", "releaseSession")
  for dimension in dimensions:
    values = sorted({context_categories(profile)[dimension] for profile in profiles})
    for value in values:
      selected = [profile for profile in profiles if context_categories(profile)[dimension] == value]
      development = [profile for profile in selected if int(profile["eventTime"]) < split_time]
      later = [profile for profile in selected if int(profile["eventTime"]) >= split_time]
      simulations = [
        {**simulate_managed(profile, family, stop_atr, target_r, holding, trigger, m1_resolver), "eventTime": int(profile["eventTime"])}
        for profile in selected
      ]
      development_execution = aggregate_managed([row for row in simulations if row["eventTime"] < split_time])
      later_execution = aggregate_managed([row for row in simulations if row["eventTime"] >= split_time])
      development_reaction = context_reaction_metrics(development)
      later_reaction = context_reaction_metrics(later)
      selected_event_times = {int(profile["eventTime"]) for profile in selected}
      outside_development = [profile for profile in baseline_development if int(profile["eventTime"]) not in selected_event_times]
      outside_later = [profile for profile in baseline_later if profile not in selected]
      outside_development_reaction = context_reaction_metrics(outside_development)
      outside_later_reaction = context_reaction_metrics(outside_later)
      outside_development_simulations = [row for row in baseline_simulations if row["eventTime"] < split_time and row["eventTime"] not in selected_event_times]
      outside_later_simulations = [row for row in baseline_simulations if row["eventTime"] >= split_time and row["eventTime"] not in selected_event_times]
      outside_development_execution = aggregate_managed(outside_development_simulations)
      outside_later_execution = aggregate_managed(outside_later_simulations)
      development_execution_uplift = (development_execution.get("averageR") or 0) - (baseline_development_execution.get("averageR") or 0)
      later_execution_uplift = (later_execution.get("averageR") or 0) - (baseline_later_execution.get("averageR") or 0)
      development_alignment_uplift = (development_reaction.get("alignmentRate") or 0) - (baseline_development_reaction.get("alignmentRate") or 0)
      later_alignment_uplift = (later_reaction.get("alignmentRate") or 0) - (baseline_later_reaction.get("alignmentRate") or 0)
      rows.append({
        "dimension": dimension,
        "value": value,
        "historicalN": len(selected),
        "developmentReaction": development_reaction,
        "laterReaction": later_reaction,
        "developmentExecution": development_execution,
        "laterExecution": later_execution,
        "outsideDevelopmentReaction": outside_development_reaction,
        "outsideLaterReaction": outside_later_reaction,
        "outsideDevelopmentExecution": outside_development_execution,
        "outsideLaterExecution": outside_later_execution,
        "developmentExecutionUpliftR": development_execution_uplift,
        "laterExecutionUpliftR": later_execution_uplift,
        "developmentAlignmentUplift": development_alignment_uplift,
        "laterAlignmentUplift": later_alignment_uplift,
        "status": (
          "insufficient" if len(development) < 20 or len(later) < 10
          else "promising_context" if (
            (development_reaction.get("averageAtr") or 0) > 0
            and (later_reaction.get("averageAtr") or 0) > 0
            and (development_execution.get("averageR") or 0) > 0
            and (later_execution.get("averageR") or 0) > 0
            and development_execution_uplift >= .05
            and later_execution_uplift >= .05
            and development_alignment_uplift >= 0
            and later_alignment_uplift >= 0
          )
          else "no_stable_improvement"
        ),
      })
  selectable = [
    row for row in rows
    if row["value"] not in {"unknown", "insufficient_history"}
    # Release session remains useful descriptive context, but it is often a
    # proxy for the release identity or a daylight-saving schedule change.
    # Do not let that proxy become an arrow-filter candidate.
    and row["dimension"] != "releaseSession"
    and int(row["developmentReaction"]["evaluableN"] or 0) >= 20
    and int(row["outsideDevelopmentReaction"]["evaluableN"] or 0) >= 10
    and float(row["developmentExecution"].get("averageR") or 0) > 0
    and float(row["developmentReaction"].get("averageAtr") or 0) > 0
    and float(row["developmentExecutionUpliftR"]) >= .05
    and float(row["developmentAlignmentUplift"]) >= 0
  ]
  development_selected = sorted(
    selectable,
    key=lambda row: (
      -float(row["developmentExecutionUpliftR"]),
      -float(row["developmentAlignmentUplift"]),
      float((row["developmentExecution"] or {}).get("maximumDrawdownR") or math.inf),
      int((row["developmentExecution"] or {}).get("longestLosingStreak") or 999),
      -int(row["developmentReaction"]["evaluableN"] or 0),
      str(row["dimension"]),
      str(row["value"]),
    ),
  )[0] if selectable else None
  selected_later_supported = bool(development_selected) and (
    int(development_selected["laterReaction"]["evaluableN"] or 0) >= 10
    and int(development_selected["outsideLaterReaction"]["evaluableN"] or 0) >= 5
    and float(development_selected["laterExecution"].get("averageR") or 0) > 0
    and float(development_selected["laterReaction"].get("averageAtr") or 0) > 0
    and float(development_selected["laterExecutionUpliftR"]) >= .05
    and float(development_selected["laterAlignmentUplift"]) >= 0
  )
  selected_candidate = None if development_selected is None else {
    "dimension": development_selected["dimension"],
    "value": development_selected["value"],
    "status": "later_supported" if selected_later_supported else "later_rejected",
    "selectionBasis": "Highest development execution uplift among bounded one-dimensional contexts with positive development execution/reaction and no alignment reduction; later cases were untouched during selection.",
    "developmentReaction": development_selected["developmentReaction"],
    "laterReaction": development_selected["laterReaction"],
    "developmentExecution": development_selected["developmentExecution"],
    "laterExecution": development_selected["laterExecution"],
    "outsideLaterReaction": development_selected["outsideLaterReaction"],
    "outsideLaterExecution": development_selected["outsideLaterExecution"],
    "developmentExecutionUpliftR": development_selected["developmentExecutionUpliftR"],
    "laterExecutionUpliftR": development_selected["laterExecutionUpliftR"],
    "developmentAlignmentUplift": development_selected["developmentAlignmentUplift"],
    "laterAlignmentUplift": development_selected["laterAlignmentUplift"],
    "relationship": classify_context_relationship(
      development_selected, baseline_later_execution, baseline_later_reaction,
    ),
    "developmentPath": context_path_metrics([
      profile for profile in profiles
      if int(profile["eventTime"]) < split_time
      and context_categories(profile)[development_selected["dimension"]] == development_selected["value"]
    ]),
    "laterPath": context_path_metrics([
      profile for profile in profiles
      if int(profile["eventTime"]) >= split_time
      and context_categories(profile)[development_selected["dimension"]] == development_selected["value"]
    ]),
    "activeArrowChanged": False,
  }
  return {
    "schema": "fms-context-challenger-v1",
    "dimensions": rows,
    "selection": "One price/regime context is selected per recipe using development data only; later cases audit it unchanged. Release session remains observational. No row changes live eligibility or the active contract.",
    "selectedCandidate": selected_candidate,
    "minimumSamples": {"development": 20, "later": 10},
    "baseline": {
      "developmentReaction": baseline_development_reaction,
      "laterReaction": baseline_later_reaction,
      "developmentExecution": baseline_development_execution,
      "laterExecution": baseline_later_execution,
    },
    "activeContract": {
      "managementFamily": family, "stopAtr": stop_atr, "targetR": target_r,
      "holdingCandles": holding, "managementTriggerR": trigger,
    },
    "activeRegistryPreserved": True,
  }


def build_context_conditioned_execution(
  profiles: List[Dict[str, Any]],
  split_time: int,
  active: Dict[str, Any],
  context_research: Dict[str, Any],
  m1_resolver=None,
) -> Dict[str, Any]:
  """Challenge execution only after a context survived untouched later history."""
  candidate = context_research.get("selectedCandidate") or {}
  if candidate.get("status") != "later_supported":
    return {
      "schema": "fms-context-conditioned-execution-v1",
      "status": "not_run",
      "reason": "The development-selected context did not survive untouched later history.",
      "activeRegistryPreserved": True,
    }
  dimension = str(candidate["dimension"])
  value = str(candidate["value"])
  selected_profiles = [
    profile for profile in profiles
    if context_categories(profile).get(dimension) == value
  ]
  challenger = management_challengers(selected_profiles, split_time, active, m1_resolver)
  best = challenger.get("bestChallenger") or {}
  active_later = challenger.get("activeLater") or {}
  best_later = best.get("later") or {}
  best_development = best.get("development") or {}
  supported_management = str(best.get("family") or "") in {"fixed", "break_even"}
  use_challenger = bool(
    supported_management
    and best_later.get("averageR") is not None
    and active_later.get("averageR") is not None
    and float(best_later["averageR"]) > 0
    and float(best_later["averageR"]) >= float(active_later["averageR"]) + .05
    and float(best_later.get("maximumDrawdownR") or math.inf) <= float(active_later.get("maximumDrawdownR") or 0) * 1.1
    and int(best_later.get("longestLosingStreak") or 999) <= int(active_later.get("longestLosingStreak") or 0) + 2
  )
  selected_execution = (
    {
      "managementFamily": str(best["family"]),
      "managementTriggerR": best.get("triggerR"),
      "stopAtr": float(best["stopAtr"]),
      "targetR": float(best["targetR"]),
      "expiryCandles": int(best["holdingCandles"]),
    }
    if use_challenger else {
      "managementFamily": str(active.get("managementFamily") or "fixed"),
      "managementTriggerR": active.get("managementTriggerR"),
      "stopAtr": float(active.get("stopAtr") or 1),
      "targetR": float(active.get("targetR") or 2),
      "expiryCandles": int(active.get("expiryCandles") or 30),
    }
  )
  selected_later = best_later if use_challenger else active_later
  later_reaction = candidate.get("laterReaction") or {}
  checks = {
    "contextSurvivedLaterHistory": candidate.get("relationship") == "context_improves_setup",
    "laterExecutionSampleAtLeast10": int(selected_later.get("evaluableN") or 0) >= 10,
    "laterAverageRPositive": float(selected_later.get("averageR") or 0) > 0,
    "laterDirectionalAlignmentAtLeast55Percent": float(later_reaction.get("alignmentRate") or 0) >= .55,
    "laterDirectionAdjustedMovePositive": float(later_reaction.get("averageAtr") or 0) > 0,
    "developmentExecutionPositive": float(
      (best_development if use_challenger else candidate.get("developmentExecution") or {}).get("averageR") or 0
    ) > 0,
  }
  return {
    "schema": "fms-context-conditioned-execution-v1",
    "status": "approved_for_code_review" if all(checks.values()) else "research_only",
    "parentBehaviorWhenContextDoesNotMatch": "retain_parent",
    "condition": {"dimension": dimension, "value": value, "knownAt": "entry"},
    "selectedExecutionSource": "context_challenger" if use_challenger else "parent_contract",
    "selectedExecution": selected_execution,
    "selectedDevelopment": best_development if use_challenger else candidate.get("developmentExecution"),
    "selectedLater": selected_later,
    "activeContextLater": active_later,
    "checks": checks,
    "challenger": challenger,
    "limitations": "Gross reused history; costs and immutable forward execution remain unavailable.",
    "activeRegistryPreserved": True,
  }
def simulate_managed(profile: Dict[str, Any], family: str, stop_atr: float, target_r: float, holding: int, trigger: float | None = None, m1_resolver=None) -> Dict[str, Any]:
  if len(profile["candles"]) < holding:
    return {"status": "unevaluable", "resultR": None}
  sign = float(profile["sign"])
  entry = float(profile["entry"])
  atr = float(profile["atr"])
  risk = atr * stop_atr
  stop = entry - sign * risk
  target = entry + sign * risk * target_r
  armed = False
  partial = False
  for candle in profile["candles"][:holding]:
    low, high = float(candle["low"]), float(candle["high"])
    stop_hit = low <= stop if sign > 0 else high >= stop
    target_hit = high >= target if sign > 0 else low <= target
    one_r_hit = high >= entry + risk if sign > 0 else low <= entry - risk
    if family == "partial" and not partial:
      if stop_hit and target_hit:
        resolved = m1_resolver(candle, stop, target, sign) if m1_resolver else None
        if resolved == "stop_hit": return {"status": "stop_hit", "resultR": -1.0}
        if resolved == "target_hit": return {"status": "target_hit", "resultR": 0.5 + 0.5 * target_r}
        return {"status": "ambiguous", "resultR": None}
      if stop_hit and one_r_hit:
        resolved = m1_resolver(candle, stop, entry + sign * risk, sign) if m1_resolver else None
        if resolved == "stop_hit": return {"status": "stop_hit", "resultR": -1.0}
        if resolved == "target_hit": return {"status": "stop_hit", "resultR": 0.0}
        return {"status": "ambiguous", "resultR": None}
      if stop_hit:
        return {"status": "stop_hit", "resultR": -1.0}
      if target_hit:
        return {"status": "target_hit", "resultR": 0.5 + 0.5 * target_r}
      if one_r_hit:
        partial = True
        if target_r <= 1:
          return {"status": "target_hit", "resultR": target_r}
        continue
    if stop_hit and target_hit:
      resolved = m1_resolver(candle, stop, target, sign) if m1_resolver else None
      if resolved == "stop_hit": return {"status": "stop_hit", "resultR": 0.0 if partial or (armed and family == "break_even") else (sign * (stop - entry) / risk if family == "trailing" and armed else -1.0)}
      if resolved == "target_hit": return {"status": "target_hit", "resultR": (0.5 + 0.5 * target_r) if partial else target_r}
      return {"status": "ambiguous", "resultR": None}
    if stop_hit:
      return {"status": "stop_hit", "resultR": 0.0 if partial or (armed and family == "break_even") else (sign * (stop - entry) / risk if family == "trailing" and armed else -1.0)}
    if target_hit:
      return {"status": "target_hit", "resultR": (0.5 + 0.5 * target_r) if partial else target_r}
    favorable_reach_r = ((high - entry) / risk) if sign > 0 else ((entry - low) / risk)
    if family == "break_even" and favorable_reach_r >= float(trigger or 1):
      armed = True
      stop = entry
    elif family == "trailing" and favorable_reach_r >= 1:
      armed = True
      candidate_stop = float(candle["close"]) - sign * atr
      stop = max(stop, candidate_stop) if sign > 0 else min(stop, candidate_stop)
  final_r = sign * (float(profile["candles"][holding - 1]["close"]) - entry) / risk
  if partial:
    final_r = 0.5 + 0.5 * final_r
  return {"status": "expired", "resultR": final_r}


def aggregate_managed(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
  values = [float(row["resultR"]) for row in rows if row.get("resultR") is not None]
  equity = peak = drawdown = 0.0
  streak = longest = 0
  for value in values:
    equity += value
    peak = max(peak, equity)
    drawdown = max(drawdown, peak - equity)
    streak = streak + 1 if value < 0 else 0
    longest = max(longest, streak)
  year_results: Dict[int, List[float]] = {}
  for row in rows:
    if row.get("resultR") is None or row.get("eventTime") is None:
      continue
    year = server.datetime.fromtimestamp(int(row["eventTime"]), tz=server.timezone.utc).year
    year_results.setdefault(year, []).append(float(row["resultR"]))
  return {
    "evaluableN": len(values), "averageR": statistics.fmean(values) if values else None,
    "tpBeforeSl": sum(row["status"] == "target_hit" for row in rows) / len(values) if values else None,
    "maximumDrawdownR": drawdown, "longestLosingStreak": longest,
    "ambiguousN": sum(row["status"] == "ambiguous" for row in rows),
    "positiveYears": sum(statistics.fmean(values) > 0 for values in year_results.values()),
    "evaluableYears": len(year_results),
    "expectancyCi95": _mean_ci95(values),
  }


def nearby_stability(
  selected: Dict[str, Any],
  family_rows: List[Dict[str, Any]],
) -> Dict[str, Any]:
  """Audit one-grid-step neighbors without allowing later data to select them."""
  family = str(selected["family"])
  stop_values = list(STRESS_STOP_ATR_VALUES)
  target_values = [2.0, 3.0, 4.0] if family == "partial" else list(STRESS_TARGET_R_VALUES)
  holding_values = list(STRESS_HOLDING_CANDLES)
  selected_indexes = (
    stop_values.index(float(selected["stopAtr"])),
    target_values.index(float(selected["targetR"])),
    holding_values.index(int(selected["holdingCandles"])),
  )
  neighbors: List[Dict[str, Any]] = []
  for row in family_rows:
    if row.get("triggerR") != selected.get("triggerR"):
      continue
    indexes = (
      stop_values.index(float(row["stopAtr"])),
      target_values.index(float(row["targetR"])),
      holding_values.index(int(row["holdingCandles"])),
    )
    if sum(abs(left - right) for left, right in zip(indexes, selected_indexes)) > 1:
      continue
    later_average = (row.get("later") or {}).get("averageR")
    development_average = (row.get("development") or {}).get("averageR")
    if later_average is None or development_average is None:
      continue
    neighbors.append({
      "stopAtr": row["stopAtr"], "targetR": row["targetR"],
      "holdingCandles": row["holdingCandles"], "triggerR": row.get("triggerR"),
      "developmentAverageR": float(development_average),
      "laterAverageR": float(later_average),
    })
  later_values = [row["laterAverageR"] for row in neighbors]
  development_values = [row["developmentAverageR"] for row in neighbors]
  return {
    "definition": "Selected contract plus same-family, same-trigger configurations one grid step away in exactly one parameter.",
    "configurationCount": len(neighbors),
    "developmentPositiveShare": (
      sum(value > 0 for value in development_values) / len(development_values)
      if development_values else None
    ),
    "laterPositiveShare": (
      sum(value > 0 for value in later_values) / len(later_values)
      if later_values else None
    ),
    "developmentMedianAverageR": statistics.median(development_values) if development_values else None,
    "laterMedianAverageR": statistics.median(later_values) if later_values else None,
    "rows": neighbors,
  }


def review_execution_challenger(
  best: Dict[str, Any] | None,
  active_later: Dict[str, Any] | None,
) -> Dict[str, Any]:
  """Apply a frozen practical review gate; this records evidence, not certainty."""
  if not best or not active_later:
    return {"decision": "declined", "checks": {}, "reason": "A comparable active and challenger result was unavailable."}
  development = best.get("development") or {}
  later = best.get("later") or {}
  stability = best.get("nearbyStability") or {}
  checks = {
    "supportedManagement": str(best.get("family")) in {"fixed", "break_even"},
    "developmentSampleAtLeast50": int(development.get("evaluableN") or 0) >= 50,
    "laterSampleAtLeast30": int(later.get("evaluableN") or 0) >= 30,
    "developmentPositive": float(development.get("averageR") or 0) > 0,
    "laterPositive": float(later.get("averageR") or 0) > 0,
    "laterAverageAtLeastPointOneR": float(later.get("averageR") or 0) >= .1,
    "laterImprovementAtLeastPointOneR": (
      float(later.get("averageR") or 0) - float(active_later.get("averageR") or 0) >= .1
    ),
    "laterPositiveYearsAtLeastThree": int(later.get("positiveYears") or 0) >= 3,
    "laterPositiveYearShareAtLeastThreeQuarters": (
      int(later.get("evaluableYears") or 0) > 0
      and int(later.get("positiveYears") or 0) / int(later.get("evaluableYears") or 1) >= .75
    ),
    "drawdownNotWorse": float(later.get("maximumDrawdownR") or math.inf) <= float(active_later.get("maximumDrawdownR") or 0),
    "losingStreakNotWorse": int(later.get("longestLosingStreak") or 0) <= int(active_later.get("longestLosingStreak") or 0),
    "nearbyLaterMajorityPositive": float(stability.get("laterPositiveShare") or 0) >= .6,
    "nearbyLaterMedianPositive": float(stability.get("laterMedianAverageR") or 0) > 0,
  }
  approved = all(checks.values())
  return {
    "decision": "approved_for_registry_review" if approved else "declined",
    "checks": checks,
    "reason": (
      "The development-selected contract improved later expectancy, drawdown, losing streak, year consistency, and nearby-parameter behavior."
      if approved else
      "At least one frozen practical promotion check failed; keep the active contract unchanged."
    ),
    "limitations": "Gross reused history; costs and immutable forward execution remain unavailable.",
  }


def management_challengers(profiles: List[Dict[str, Any]], split_time: int, active: Dict[str, Any], m1_resolver=None) -> Dict[str, Any]:
  families: List[Dict[str, Any]] = []
  declared: List[tuple[str, float, float, int, float | None]] = []
  for stop in STRESS_STOP_ATR_VALUES:
    for target in STRESS_TARGET_R_VALUES:
      for holding in STRESS_HOLDING_CANDLES:
        declared.append(("fixed", stop, target, holding, None))
        declared.extend(("break_even", stop, target, holding, trigger) for trigger in (.5, 1.0, 1.5))
        declared.append(("trailing", stop, target, holding, 1.0))
  for stop in STRESS_STOP_ATR_VALUES:
    for target in (2.0, 3.0, 4.0):
      for holding in STRESS_HOLDING_CANDLES:
        declared.append(("partial", stop, target, holding, 1.0))
  for family, stop, target, holding, trigger in declared:
    rows = [{**simulate_managed(profile, family, stop, target, holding, trigger, m1_resolver), "eventTime": int(profile["eventTime"])} for profile in profiles]
    development = aggregate_managed([row for row in rows if row["eventTime"] < split_time])
    later = aggregate_managed([row for row in rows if row["eventTime"] >= split_time])
    families.append({"family": family, "stopAtr": stop, "targetR": target, "holdingCandles": holding, "triggerR": trigger, "development": development, "later": later})
  winners = []
  for family in ("fixed", "break_even", "trailing", "partial"):
    rows = [row for row in families if row["family"] == family and row["development"]["averageR"] is not None]
    if rows:
      selected = max(rows, key=lambda row: (float(row["development"]["averageR"]), -float(row["development"]["maximumDrawdownR"]), -int(row["development"]["longestLosingStreak"]), -int(row["holdingCandles"]), int(row["development"]["evaluableN"])))
      winners.append({**selected, "nearbyStability": nearby_stability(selected, rows)})
  active_later = next((row["later"] for row in families if row["family"] == "fixed" and float(row["stopAtr"]) == float(active.get("stopAtr", 1)) and float(row["targetR"]) == float(active.get("targetR", 2)) and int(row["holdingCandles"]) == int(active.get("expiryCandles", 30))), None)
  simplicity = {"fixed": 4, "break_even": 3, "trailing": 2, "partial": 1}
  best = max(winners, key=lambda row: (float(row["development"]["averageR"]), -float(row["development"]["maximumDrawdownR"]), -int(row["development"]["longestLosingStreak"]), simplicity[row["family"]], int(row["development"]["evaluableN"])), default=None)
  review_worthy = bool(best and active_later and best["later"]["averageR"] is not None and active_later["averageR"] is not None and float(best["later"]["averageR"]) > 0 and float(best["later"]["averageR"]) > float(active_later["averageR"]) and float(best["later"]["maximumDrawdownR"]) <= float(active_later["maximumDrawdownR"]) * 1.1 and int(best["later"]["longestLosingStreak"]) <= int(active_later["longestLosingStreak"]) + 2)
  active_stop = float(active.get("stopAtr", 1))
  active_holding = int(active.get("expiryCandles", 30))
  target_frontier_rows = [
    row for row in families
    if row["family"] == "fixed"
    and float(row["stopAtr"]) == active_stop
    and int(row["holdingCandles"]) == active_holding
  ]
  target_frontier_selected = max(
    target_frontier_rows,
    key=lambda row: (
      float((row.get("development") or {}).get("averageR") or -999),
      -float((row.get("development") or {}).get("maximumDrawdownR") or math.inf),
      -int((row.get("development") or {}).get("longestLosingStreak") or 999),
    ),
    default=None,
  )
  return {
    "schema": "fms-execution-challenger-v2",
    "declaredConfigurationCount": len(declared),
    "selection": "development average R; drawdown; losing streak; simplicity; sample",
    "activeLater": active_later,
    "familyWinners": winners,
    "bestChallenger": best,
    "reviewWorthy": review_worthy,
    "registryReview": review_execution_challenger(best, active_later),
    "targetFrontier": {
      "definition": "Independent full-position targets with the active SL and duration; no partial exits.",
      "selection": "Older development cases select the target; later cases audit it unchanged.",
      "activeTargetR": float(active.get("targetR", 2)),
      "developmentSelectedTargetR": None if target_frontier_selected is None else float(target_frontier_selected["targetR"]),
      "rows": [{
        "targetR": float(row["targetR"]),
        "development": {
          key: row["development"].get(key) for key in (
            "evaluableN", "averageR", "tpBeforeSl", "maximumDrawdownR",
            "longestLosingStreak", "positiveYears", "evaluableYears",
          )
        },
        "later": {
          key: row["later"].get(key) for key in (
            "evaluableN", "averageR", "tpBeforeSl", "maximumDrawdownR",
            "longestLosingStreak", "positiveYears", "evaluableYears",
          )
        },
      } for row in target_frontier_rows],
    },
  }


def build_profile(pattern: Dict[str, Any]) -> Dict[str, Any] | None:
  benchmark = pattern.get("historicalBenchmark") or {}
  experiment_id = benchmark.get("experimentId")
  experiment = server._research_store.get_fms_experiment(str(experiment_id)) if experiment_id else None
  result = (experiment or {}).get("result") or {}
  raw_text = server._research_store.get_metadata(f"fms_raw_audit:{experiment_id}") if experiment_id else None
  if not raw_text or not result.get("splitTime"):
    return None
  raw = json.loads(raw_text)
  selected_contract_key = str(raw.get("selectedContractKey") or "")
  unresolved_by_reason: Dict[str, int] = {}
  for row in (raw.get("contractResults") or {}).get(selected_contract_key, []):
    status = str(row.get("status") or "")
    if status not in {"pending", "ambiguous", "unevaluable"}:
      continue
    reason = str(row.get("reason") or "").lower()
    code = (
      "both_touched_order_unknown" if status == "ambiguous" else
      "trade_still_running" if status == "pending" else
      "missing_atr_history" if "atr" in reason else
      "missing_outcome_candles" if "outcome" in reason or "candle" in reason else
      "historical_price_data_unavailable"
    )
    unresolved_by_reason[code] = unresolved_by_reason.get(code, 0) + 1
  split_time = int(result["splitTime"])
  all_cases = [
    row for row in raw.get("cases", [])
    if row.get("included")
    and row.get("entryTime") is not None and row.get("entry") is not None and row.get("atr") is not None
  ]
  if not all_cases:
    return None
  market = str(pattern["market"])
  source_version = str(result.get("sourceVersionId") or pattern.get("sourceVersion") or "")
  source_run = server._research_store.latest_backtest_run(source_version) if source_version else None
  source_result = (source_run or {}).get("result") or {}
  source_context_by_time = {
    int(row["eventTime"]): row
    for row in ((source_result.get("targets") or {}).get("2.0") or {}).get("outcomes", [])
    if row.get("eventTime") is not None
  }
  earliest = min(int(row["entryTime"]) for row in all_cases) - 120 * 4 * 60 * 60
  latest = max(int(row["entryTime"]) for row in all_cases) + (max(STRESS_HOLDING_CANDLES) + 2) * 4 * 60 * 60
  candles = server._research_store.query_candles(market, "H4", earliest, latest)
  candle_times = [int(candle["time"]) for candle in candles]
  all_profiles = []
  for row in all_cases:
    source_context = source_context_by_time.get(int(row["eventTime"])) or {}
    profile = build_candidate_path_profile({
      "eventTime": int(row["eventTime"]),
      "entryTime": int(row["entryTime"]),
      "entry": float(row["entry"]),
      "atr": float(row["atr"]),
      "direction": str(row["direction"]),
      "backgroundDirection": row.get("backgroundDirection") or source_context.get("backgroundDirection"),
      "backgroundPairVote": row.get("backgroundPairVote") if row.get("backgroundPairVote") is not None else source_context.get("backgroundPairVote"),
      "backgroundAlignment": row.get("backgroundAlignment") or source_context.get("backgroundAlignment"),
      "highestImpact": row.get("highestImpact") or source_context.get("highestImpact"),
      "events": list(row.get("events") or source_context.get("events") or []),
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
  # Always compare against the pre-review frozen contract. Importing server may
  # expose an already reviewed overlay, which must not make regeneration
  # circular or erase the original improvement comparison.
  frozen_execution = pattern.get("baseExecution") or pattern.get("execution") or {}
  m1_cache: Dict[int, List[Dict[str, Any]]] = {}
  def resolve_with_m1(candle: Dict[str, Any], stop: float, target: float, sign: float) -> str | None:
    start = int(candle["time"])
    if start not in m1_cache:
      m1_cache[start] = server._research_store.query_candles(market, "M1", start, start + 4 * 60 * 60)
    if not m1_cache[start]:
      return None
    return _resolve_m1_order(m1_cache[start], "long" if sign > 0 else "short", stop, target)
  management_research = management_challengers(all_profiles, split_time, frozen_execution, resolve_with_m1)
  candle_fingerprint = hashlib.sha256(json.dumps([
    [int(row["time"]), float(row["open"]), float(row["high"]), float(row["low"]), float(row["close"])]
    for row in candles
  ], separators=(",", ":")).encode("utf-8")).hexdigest()
  configuration_hash = hashlib.sha256(json.dumps({
    "grid": [STRESS_STOP_ATR_VALUES, STRESS_TARGET_R_VALUES, STRESS_HOLDING_CANDLES],
    "management": ["fixed", "break_even_.5_1_1.5", "trailing_after_1R", "partial_50_at_1R"],
  }, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
  context_configuration_hash = hashlib.sha256(json.dumps({
    "schema": "fms-context-conditioned-h4-v1",
    "priceRegime": {"shortH4": 12, "mediumH4": 48, "shortThresholdAtr": .75, "mediumThresholdAtr": 1.5},
    "volatility": {"lookbackH4": 120, "compressedPercentile": .25, "expandedPercentile": .75, "extremePercentile": .90},
    "supportResistance": {"lookbackH4": 120, "pivotSpan": 2, "clusterAtr": .25, "minimumTouches": 2, "limitedRoomAtr": .75, "openRoomAtr": 1.5},
    "dimensions": ["priceRegime", "trendRelation", "volatilityRegime", "directionalRoom", "macroBackground", "releaseSession"],
    "selectableDimensions": ["priceRegime", "trendRelation", "volatilityRegime", "directionalRoom", "macroBackground"],
    "minimumDevelopment": 20,
    "minimumLater": 10,
    "reactionHorizonH4": 6,
    "minimumExecutionUpliftR": .05,
    "minimumAlignmentUplift": 0,
    "developmentSelection": "highest_execution_uplift_then_alignment_then_drawdown_then_losing_streak_then_sample_then_identity",
    "minimumOutsideDevelopment": 10,
    "minimumOutsideLater": 5,
  }, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
  context_research = build_context_research(
    all_profiles, split_time, pattern.get("execution") or frozen_execution, resolve_with_m1,
  )
  context_execution = build_context_conditioned_execution(
    all_profiles, split_time, pattern.get("execution") or frozen_execution,
    context_research, resolve_with_m1,
  )
  context_research = {
    **context_research,
    "conditionedExecution": context_execution,
    "recipe": f"{market}|{pattern['id']}",
    "registryRevision": server.PRACTICAL_MODEL_HASH,
    "configurationHash": context_configuration_hash,
    "candleFingerprint": candle_fingerprint,
    "datasetFingerprint": str(result.get("datasetFingerprint") or ""),
    "activeArrowPreserved": True,
  }
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
    "schema": "registered-reaction-profile-v2",
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
    "contextResearch": context_research,
    "executionChallenger": {
      **management_research,
      "recipe": f"{market}|{pattern['id']}",
      "registryRevision": server.PRACTICAL_MODEL_HASH,
      "configurationHash": configuration_hash,
      "candleFingerprint": candle_fingerprint,
      "datasetFingerprint": str(result.get("datasetFingerprint") or ""),
      "activeContractPreserved": True,
      "unresolvedByReason": unresolved_by_reason,
      "costsExcluded": ["spread", "commission", "slippage", "swap"],
    },
  }


def main() -> None:
  parser = argparse.ArgumentParser()
  parser.add_argument(
    "--context-only-base",
    type=Path,
    default=None,
    help="Preserve an immutable prior reaction/execution profile and replace only contextResearch.",
  )
  args = parser.parse_args()
  destination = Path(__file__).resolve().parents[1] / "registered_reaction_profiles.json"
  context_destination = destination.with_name("registered_market_context_profiles.json")
  base_profiles: Dict[str, Any] = {}
  if args.context_only_base is not None:
    base_payload = json.loads(args.context_only_base.read_text(encoding="utf-8-sig"))
    base_profiles = dict(base_payload.get("profiles") or {})
  profiles = {}
  for pattern in server.PRACTICAL_PATTERN_DEFINITIONS:
    profile = build_profile(pattern)
    if profile is not None:
      market = str(pattern["market"])
      pattern_id = str(pattern["id"])
      key = f"{market}|{pattern_id}"
      profiles[(market, pattern_id)] = {
        **(base_profiles.get(key) or profile),
        "contextResearch": profile["contextResearch"],
      }
  existing_context_profiles: Dict[str, Any] = {}
  try:
    existing_context_profiles = dict(json.loads(context_destination.read_text(encoding="utf-8-sig")).get("profiles") or {})
  except (OSError, TypeError, ValueError):
    pass
  context_experiment_sequences: Dict[str, int] = {}
  for key, research in existing_context_profiles.items():
    experiment_id = str((research or {}).get("researchExperimentId") or "")
    market = str(key).split("|", 1)[0]
    try:
      sequence = int(experiment_id.rsplit("E", 1)[1])
    except (IndexError, ValueError):
      continue
    context_experiment_sequences[market] = max(context_experiment_sequences.get(market, 0), sequence)
  for (market, pattern_id), profile in sorted(profiles.items()):
    key = f"{market}|{pattern_id}"
    existing_id = str((existing_context_profiles.get(key) or {}).get("researchExperimentId") or "")
    if existing_id:
      experiment_id = existing_id
    else:
      context_experiment_sequences[market] = context_experiment_sequences.get(market, 0) + 1
      experiment_id = f"FMS-{market}-H4-CTX-E{context_experiment_sequences[market]:03d}"
    profile["contextResearch"] = {
      **profile["contextResearch"],
      "researchExperimentId": experiment_id,
    }
  context_payload = {
    "schema": "fms-context-challenger-index-v1",
    "marketContextSchema": "fms-market-context-v1",
    "contextResearchSchema": "fms-context-conditioned-h4-v1",
    "profiles": {f"{market}|{pattern_id}": profile["contextResearch"] for (market, pattern_id), profile in sorted(profiles.items())},
  }
  context_destination.write_text(json.dumps(context_payload, separators=(",", ":"), sort_keys=True) + "\n", encoding="utf-8")
  if args.context_only_base is None:
    payload = {
      "schema": "registered-reaction-profile-v2",
      "horizons": list(HORIZONS),
      "profiles": {
        f"{market}|{pattern_id}": {key: value for key, value in profile.items() if key != "contextResearch"}
        for (market, pattern_id), profile in sorted(profiles.items())
      },
    }
    destination.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
  print(json.dumps({"destination": str(context_destination), "profiles": len(profiles), "reactionProfilesPreserved": args.context_only_base is not None}))


if __name__ == "__main__":
  main()
