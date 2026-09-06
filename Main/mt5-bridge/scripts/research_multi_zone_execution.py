"""Frozen sequential H4 price-structure challenger for registered FMS recipes."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
import statistics
import sys
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server
from scripts.materialize_registered_reaction_profiles import aggregate_managed, distribution, simulate_managed
from scripts.research_support_resistance_execution import load_profiles


SCHEMA = "fms-sequential-price-structure-execution-v1"
BUFFER_ATR = .10
MIN_TARGET_ATR = .50
PARTIAL_SHARE = .50
VARIANTS = ("nearest_full", "partial_then_registered", "partial_then_wider_after_break")


def directional_zones(profile: Dict[str, Any]) -> List[Dict[str, Any]]:
  structure = (profile.get("marketContext") or {}).get("supportResistance") or {}
  key = "resistances" if profile["direction"] == "long" else "supports"
  return [
    zone for zone in (structure.get(key) or [])
    if zone.get("entryKnownState", "active") == "active" and float(zone.get("distanceAtr") or 0) > 0
  ]


def simulate_structure(profile: Dict[str, Any], active: Dict[str, Any], variant: str) -> Dict[str, Any]:
  sign, entry, atr = float(profile["sign"]), float(profile["entry"]), float(profile["atr"])
  stop_atr = float(active.get("stopAtr") or 1)
  target_r = float(active.get("targetR") or 2)
  active_target_atr = stop_atr * target_r
  holding = int(active.get("expiryCandles") or 30)
  zones = directional_zones(profile)
  qualifying = [zone for zone in zones if MIN_TARGET_ATR + BUFFER_ATR <= float(zone["distanceAtr"]) < active_target_atr + BUFFER_ATR]
  nearest = qualifying[0] if qualifying else None
  if nearest is None:
    baseline = simulate_managed(profile, str(active.get("managementFamily") or "fixed"), stop_atr, target_r, holding, active.get("managementTriggerR"))
    return {**baseline, "eventTime": int(profile["eventTime"]), "structureState": "no_qualifying_zone", "partialCaptured": False, "nearestRole": None, "widerAvailable": False}
  nearest_atr = max(MIN_TARGET_ATR, float(nearest["distanceAtr"]) - BUFFER_ATR)
  wider = next((zone for zone in zones if float(zone["distanceAtr"]) >= float(nearest["distanceAtr"]) + .25), None)
  wider_atr = min(active_target_atr, max(MIN_TARGET_ATR, float(wider["distanceAtr"]) - BUFFER_ATR)) if wider else active_target_atr
  risk = stop_atr * atr
  stop = entry - sign * risk
  nearest_target = entry + sign * nearest_atr * atr
  registered_target = entry + sign * active_target_atr * atr
  wider_target = entry + sign * wider_atr * atr
  management = str(active.get("managementFamily") or "fixed")
  trigger_r = float(active.get("managementTriggerR") or 1)
  armed = partial = break_confirmed = False
  partial_result = .5 * nearest_atr / stop_atr
  remainder_target: Optional[float] = None
  state = "nearest_active"
  band_low = float(nearest.get("bandLow") or nearest["level"])
  band_high = float(nearest.get("bandHigh") or nearest["level"])
  tolerance = .25 * atr
  for candle in list(profile["candles"])[:holding]:
    low, high = float(candle["low"]), float(candle["high"])
    stop_hit = low <= stop if sign > 0 else high >= stop
    if not partial:
      nearest_hit = high >= nearest_target if sign > 0 else low <= nearest_target
      if stop_hit and nearest_hit:
        return {"status": "ambiguous", "resultR": None, "eventTime": int(profile["eventTime"]), "structureState": "nearest_order_unknown", "partialCaptured": False, "nearestRole": nearest.get("role"), "widerAvailable": wider is not None}
      if stop_hit:
        return {"status": "stop_hit", "resultR": 0.0 if armed and management == "break_even" else -1.0, "eventTime": int(profile["eventTime"]), "structureState": "nearest_held", "partialCaptured": False, "nearestRole": nearest.get("role"), "widerAvailable": wider is not None}
      if nearest_hit:
        if variant == "nearest_full":
          return {"status": "target_hit", "resultR": nearest_atr / stop_atr, "eventTime": int(profile["eventTime"]), "structureState": "nearest_target", "partialCaptured": False, "nearestRole": nearest.get("role"), "widerAvailable": wider is not None}
        partial = True
        state = "partial_at_nearest"
        if variant == "partial_then_registered":
          remainder_target = registered_target
          registered_hit = high >= registered_target if sign > 0 else low <= registered_target
          if registered_hit:
            return {"status": "target_hit", "resultR": partial_result + .5 * target_r, "eventTime": int(profile["eventTime"]), "structureState": "registered_target_after_partial", "partialCaptured": True, "nearestRole": nearest.get("role"), "widerAvailable": wider is not None}
    else:
      remainder_hit = remainder_target is not None and (high >= remainder_target if sign > 0 else low <= remainder_target)
      if stop_hit and remainder_hit:
        return {"status": "ambiguous", "resultR": None, "eventTime": int(profile["eventTime"]), "structureState": "remainder_order_unknown", "partialCaptured": True, "nearestRole": nearest.get("role"), "widerAvailable": wider is not None}
      if stop_hit:
        remainder_stop_r = 0.0 if armed and management == "break_even" else -1.0
        return {"status": "stop_hit", "resultR": partial_result + .5 * remainder_stop_r, "eventTime": int(profile["eventTime"]), "structureState": state, "partialCaptured": True, "nearestRole": nearest.get("role"), "widerAvailable": wider is not None}
      if remainder_hit:
        remainder_r = (wider_atr if break_confirmed else active_target_atr) / stop_atr
        return {"status": "target_hit", "resultR": partial_result + .5 * remainder_r, "eventTime": int(profile["eventTime"]), "structureState": "wider_target" if break_confirmed else "registered_target_after_partial", "partialCaptured": True, "nearestRole": nearest.get("role"), "widerAvailable": wider is not None}
    favorable_r = ((high - entry) / risk) if sign > 0 else ((entry - low) / risk)
    if management == "break_even" and favorable_r >= trigger_r:
      armed, stop = True, entry
    if partial and variant == "partial_then_wider_after_break" and not break_confirmed:
      broke = float(candle["close"]) > band_high + tolerance if sign > 0 else float(candle["close"]) < band_low - tolerance
      if broke:
        break_confirmed, remainder_target, state = True, wider_target, "nearest_broken_wider_active"
  final_r = sign * (float(profile["candles"][holding - 1]["close"]) - entry) / risk
  result_r = partial_result + .5 * final_r if partial else final_r
  return {"status": "expired", "resultR": result_r, "eventTime": int(profile["eventTime"]), "structureState": state, "partialCaptured": partial, "nearestRole": nearest.get("role"), "widerAvailable": wider is not None}


def summarize(rows: List[Dict[str, Any]], split: int, later: bool) -> Dict[str, Any]:
  chosen = [row for row in rows if (int(row["eventTime"]) >= split) == later]
  summary = aggregate_managed(chosen)
  values = sorted((float(row["resultR"]) for row in chosen if row.get("resultR") is not None), reverse=True)
  positive_total = sum(value for value in values if value > 0)
  summary.update({
    "partialCapturedN": sum(bool(row.get("partialCaptured")) for row in chosen),
    "roleReversalConfirmedN": sum(row.get("nearestRole") == "role_reversed" for row in chosen),
    "widerZoneAvailableN": sum(bool(row.get("widerAvailable")) for row in chosen),
    "widerTargetAttemptedN": sum(row.get("structureState") in {"nearest_broken_wider_active", "wider_target"} for row in chosen),
    "structureStates": {state: sum(row.get("structureState") == state for row in chosen) for state in sorted({str(row.get("structureState")) for row in chosen})},
    "topOneWinShare": values[0] / positive_total if values and values[0] > 0 and positive_total > 0 else None,
    "topThreeWinShare": sum(value for value in values[:3] if value > 0) / positive_total if positive_total > 0 else None,
    "topFiveWinShare": sum(value for value in values[:5] if value > 0) / positive_total if positive_total > 0 else None,
  })
  return summary


def target_evidence(profiles: List[Dict[str, Any]], split: int, active: Dict[str, Any]) -> Dict[str, Any]:
  stop_atr = float(active.get("stopAtr") or 1)
  target_r = float(active.get("targetR") or 2)
  holding = int(active.get("expiryCandles") or 30)
  rows = []
  times = []
  mfe = []
  for profile in profiles:
    simulated = simulate_managed(profile, str(active.get("managementFamily") or "fixed"), stop_atr, target_r, holding, active.get("managementTriggerR"))
    row = {**simulated, "eventTime": int(profile["eventTime"])}
    rows.append(row)
    if int(profile["eventTime"]) >= split:
      favorable = list(profile["favorable"])[:holding]
      mfe.append(max(favorable) / stop_atr)
      threshold = stop_atr * target_r
      hit_index = next((index for index, value in enumerate(favorable) if value >= threshold), None)
      if hit_index is not None:
        times.append(hit_index + 1)
  later = summarize(rows, split, True)
  later_rows = [row for row in rows if int(row["eventTime"]) >= split]
  later_evaluable = [row for row in later_rows if row.get("resultR") is not None]
  denominator = len(later_evaluable)
  later.update({
    "slBeforeTp": sum(row.get("status") == "stop_hit" for row in later_evaluable) / denominator if denominator else None,
    "expiredRate": sum(row.get("status") == "expired" for row in later_evaluable) / denominator if denominator else None,
    "expiredN": sum(row.get("status") == "expired" for row in later_evaluable),
    "unevaluableN": sum(row.get("status") == "unevaluable" for row in later_rows),
  })
  needed = 1 / (1 + target_r)
  target_rate = later.get("tpBeforeSl")
  label = (
    "not_supported" if (later.get("averageR") or 0) <= 0 else
    "rare_outsized_wins" if target_r >= 3 and (target_rate or 0) < needed else
    "historically_supported"
  )
  return {**later, "label": label, "targetR": target_r, "breakEvenTargetRate": needed, "mfeR": distribution(mfe), "timeToTargetH4": distribution(times)}


def historical_target_contracts(pattern: Dict[str, Any], profiles: List[Dict[str, Any]], split: int) -> List[Dict[str, Any]]:
  grouped: Dict[str, Dict[str, Any]] = {}
  for profile in profiles:
    execution = dict(server._execution_for_event(pattern, int(profile["eventTime"])))
    contract = {
      "stopAtr": float(execution.get("stopAtr") or 1),
      "targetR": float(execution.get("targetR") or 2),
      "expiryCandles": int(execution.get("expiryCandles") or 30),
      "managementFamily": str(execution.get("managementFamily") or "fixed"),
      "managementTriggerR": execution.get("managementTriggerR"),
    }
    key = json.dumps(contract, sort_keys=True, separators=(",", ":"))
    bucket = grouped.setdefault(key, {"execution": contract, "profiles": []})
    bucket["profiles"].append(profile)
  return [
    {
      "execution": bucket["execution"],
      "allN": len(bucket["profiles"]),
      "evidence": target_evidence(bucket["profiles"], split, bucket["execution"]),
    }
    for _, bucket in sorted(grouped.items())
  ]


def main() -> None:
  configuration = {
    "schema": SCHEMA, "zoneSchema": "fms-price-structure-ladder-v1", "bufferAtr": BUFFER_ATR,
    "minimumTargetAtr": MIN_TARGET_ATR, "partialShare": PARTIAL_SHARE, "variants": VARIANTS,
    "breakConfirmation": "completed H4 close beyond nearest zone by 0.25 entry ATR; wider target becomes active on next candle",
    "selection": "older development N>=20 across >=2 years, positive average, >=0.05R uplift; highest uplift",
    "laterGate": "N>=10 across >=2 years, positive average, >=0.05R matched-parent uplift, drawdown <= parent+1R, losing streak <= parent+1, top win share <=35%",
  }
  configuration_hash = hashlib.sha256(json.dumps(configuration, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
  rows = []
  for raw_pattern in server.PRACTICAL_PATTERN_DEFINITIONS:
    pattern = server._reconciled_pattern(raw_pattern)
    loaded = load_profiles(pattern)
    if loaded is None:
      continue
    profiles, split, candle_fingerprint, dataset_fingerprint, experiment_id = loaded
    active = dict(pattern.get("execution") or {})
    baseline_rows = [{**simulate_managed(profile, str(active.get("managementFamily") or "fixed"), float(active.get("stopAtr") or 1), float(active.get("targetR") or 2), int(active.get("expiryCandles") or 30), active.get("managementTriggerR")), "eventTime": int(profile["eventTime"])} for profile in profiles]
    baseline_dev, baseline_later = summarize(baseline_rows, split, False), summarize(baseline_rows, split, True)
    candidates = []
    for variant in VARIANTS:
      simulated = [simulate_structure(profile, active, variant) for profile in profiles]
      development, later = summarize(simulated, split, False), summarize(simulated, split, True)
      candidates.append({"variant": variant, "development": development, "later": later, "developmentUpliftR": (development.get("averageR") or 0)-(baseline_dev.get("averageR") or 0), "laterUpliftR": (later.get("averageR") or 0)-(baseline_later.get("averageR") or 0)})
    selectable = [row for row in candidates if int(row["development"].get("evaluableN") or 0)>=20 and int(row["development"].get("evaluableYears") or 0)>=2 and float(row["development"].get("averageR") or 0)>0 and float(row["developmentUpliftR"])>=.05]
    selected = max(selectable, key=lambda row: float(row["developmentUpliftR"]), default=None)
    supported = bool(selected and int(selected["later"].get("evaluableN") or 0)>=10 and int(selected["later"].get("evaluableYears") or 0)>=2 and float(selected["later"].get("averageR") or 0)>0 and float(selected["laterUpliftR"])>=.05 and float(selected["later"].get("maximumDrawdownR") or math.inf)<=float(baseline_later.get("maximumDrawdownR") or 0)+1 and int(selected["later"].get("longestLosingStreak") or 999)<=int(baseline_later.get("longestLosingStreak") or 0)+1 and float(selected["later"].get("topOneWinShare") or 1)<=.35)
    rows.append({"market": pattern["market"], "patternId": pattern["id"], "label": pattern["label"], "sourceExperimentId": experiment_id, "datasetFingerprint": dataset_fingerprint, "candleFingerprint": candle_fingerprint, "splitTime": split, "activeExecution": active, "targetEvidence": target_evidence(profiles, split, active), "targetEvidenceContracts": historical_target_contracts(pattern, profiles, split), "baselineDevelopment": baseline_dev, "baselineLater": baseline_later, "candidates": candidates, "selected": selected, "status": "later_supported" if supported else "rejected_or_insufficient"})
  payload = {"schema": SCHEMA, "configuration": configuration, "configurationHash": configuration_hash, "registryRevision": server.PRACTICAL_MODEL_HASH, "recipes": len(rows), "selected": sum(row["selected"] is not None for row in rows), "supported": sum(row["status"]=="later_supported" for row in rows), "rows": rows, "activeRegistryPreserved": True, "limitations": ["Reused historical research is not prospective validation.", "Same-H4 stop/target ordering without finer coverage remains ambiguous.", "Zones are deterministic price-structure approximations, not guaranteed reversal levels.", "Spread, commission, slippage, swap, and unrecorded gaps are excluded."]}
  destination = Path(__file__).resolve().parents[1] / "multi_zone_execution_research.json"
  destination.write_text(json.dumps(payload, indent=2, sort_keys=True)+"\n", encoding="utf-8")
  print(json.dumps({"destination": str(destination), "recipes": len(rows), "selected": payload["selected"], "supported": payload["supported"]}))


if __name__ == "__main__":
  main()
