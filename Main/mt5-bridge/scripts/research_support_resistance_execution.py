"""Frozen entry-known H4 support/resistance execution challenger.

The pass changes no registered setup.  It compares the active fixed contract
with three predeclared ways to place a nearer target at the first confirmed
directional H4 barrier known at entry.  Development history selects at most one
variant per recipe; later chronology only judges that frozen choice.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server
from macro_signal import build_candidate_path_profile
from scripts.materialize_registered_reaction_profiles import aggregate_managed, simulate_managed


SCHEMA = "fms-entry-known-support-resistance-execution-v1"
BUFFER_ATR = 0.10
MIN_TARGET_ATR = 0.50
VARIANTS = (
  {"id": "barrier_cap_keep_stop", "riskReward": None},
  {"id": "barrier_equal_risk", "riskReward": 1.0},
  {"id": "barrier_two_to_one", "riskReward": 2.0},
)


def load_profiles(pattern: Dict[str, Any]) -> tuple[List[Dict[str, Any]], int, str, str, str] | None:
  experiment_id = ((pattern.get("historicalBenchmark") or {}).get("experimentId"))
  experiment = server._research_store.get_fms_experiment(str(experiment_id)) if experiment_id else None
  result = (experiment or {}).get("result") or {}
  raw_text = server._research_store.get_metadata(f"fms_raw_audit:{experiment_id}") if experiment_id else None
  if not raw_text or not result.get("splitTime"):
    return None
  raw = json.loads(raw_text)
  selected_key = str(raw.get("selectedContractKey") or "")
  execution_by_case = {
    str(row["caseId"]): row
    for row in ((raw.get("contractResults") or {}).get(selected_key) or [])
  }
  cases = [
    row for row in (raw.get("cases") or [])
    if row.get("included") and row.get("entryTime") is not None
    and row.get("entry") is not None and row.get("atr") is not None
  ]
  if not cases:
    return None
  earliest = min(int(row["entryTime"]) for row in cases) - 120 * 4 * 3600
  holding = int((pattern.get("execution") or {}).get("expiryCandles") or 30)
  latest = max(int(row["entryTime"]) for row in cases) + (max(holding, 60) + 2) * 4 * 3600
  candles = server._research_store.query_candles(str(pattern["market"]), "H4", earliest, latest)
  candle_times = [int(row["time"]) for row in candles]
  profiles: List[Dict[str, Any]] = []
  for row in cases:
    execution = execution_by_case.get(str(row["caseId"]))
    if not execution or execution.get("direction") not in {"long", "short"}:
      continue
    profile = build_candidate_path_profile({
      "eventTime": int(row["eventTime"]), "entryTime": int(row["entryTime"]),
      "entry": float(row["entry"]), "atr": float(row["atr"]),
      "direction": str(execution["direction"]),
    }, candles, candle_times, max(holding, 60))
    if profile is not None and len(profile.get("candles") or []) >= holding:
      profiles.append(profile)
  fingerprint = hashlib.sha256(json.dumps([
    [int(row["time"]), float(row["open"]), float(row["high"]), float(row["low"]), float(row["close"])]
    for row in candles
  ], separators=(",", ":")).encode()).hexdigest()
  return profiles, int(result["splitTime"]), fingerprint, str(result.get("datasetFingerprint") or ""), str(experiment_id)


def simulate_barrier(profile: Dict[str, Any], active: Dict[str, Any], variant: Dict[str, Any]) -> Dict[str, Any]:
  sign = float(profile["sign"])
  entry = float(profile["entry"])
  atr = float(profile["atr"])
  active_stop_atr = float(active.get("stopAtr") or 1)
  active_target_atr = active_stop_atr * float(active.get("targetR") or 2)
  holding = int(active.get("expiryCandles") or 30)
  support_resistance = (profile.get("marketContext") or {}).get("supportResistance") or {}
  barrier = support_resistance.get("directionalBarrier")
  barrier_distance = (
    sign * (float(barrier["level"]) - entry) / atr
    if isinstance(barrier, dict) and barrier.get("level") is not None else None
  )
  capped = barrier_distance is not None and MIN_TARGET_ATR + BUFFER_ATR <= barrier_distance < active_target_atr + BUFFER_ATR
  target_atr = max(MIN_TARGET_ATR, float(barrier_distance) - BUFFER_ATR) if capped else active_target_atr
  ratio = variant.get("riskReward")
  stop_atr = min(active_stop_atr, target_atr / float(ratio)) if capped and ratio else active_stop_atr
  stop = entry - sign * stop_atr * atr
  target = entry + sign * target_atr * atr
  management = str(active.get("managementFamily") or "fixed")
  trigger_r = float(active.get("managementTriggerR") or 1)
  armed = False
  for candle in list(profile["candles"])[:holding]:
    low, high = float(candle["low"]), float(candle["high"])
    stop_hit = low <= stop if sign > 0 else high >= stop
    target_hit = high >= target if sign > 0 else low <= target
    if stop_hit and target_hit:
      return {"status": "ambiguous", "resultR": None, "eventTime": int(profile["eventTime"]), "barrierApplied": capped}
    if stop_hit:
      return {"status": "stop_hit", "resultR": 0.0 if armed and management == "break_even" else -1.0, "eventTime": int(profile["eventTime"]), "barrierApplied": capped}
    if target_hit:
      return {"status": "target_hit", "resultR": target_atr / stop_atr, "eventTime": int(profile["eventTime"]), "barrierApplied": capped}
    favorable_r = ((high - entry) / (stop_atr * atr)) if sign > 0 else ((entry - low) / (stop_atr * atr))
    if management == "break_even" and favorable_r >= trigger_r:
      armed = True
      stop = entry
  close = float(profile["candles"][holding - 1]["close"])
  return {
    "status": "expired", "resultR": sign * (close - entry) / (stop_atr * atr),
    "eventTime": int(profile["eventTime"]), "barrierApplied": capped,
  }


def partition(rows: List[Dict[str, Any]], split: int, later: bool) -> Dict[str, Any]:
  selected = [row for row in rows if (int(row["eventTime"]) >= split) == later]
  result = aggregate_managed(selected)
  result["barrierAppliedN"] = sum(bool(row.get("barrierApplied")) for row in selected)
  return result


def main() -> None:
  configuration = {
    "schema": SCHEMA, "zoneMethod": "confirmed H4 pivots; 120 completed bars; span 2; 0.25 ATR clustering; minimum 2 touches",
    "target": {"level": "nearest directional barrier minus 0.10 ATR", "minimumDistanceAtr": MIN_TARGET_ATR, "fallback": "active target"},
    "variants": list(VARIANTS), "selection": "highest development average-R uplift; minimum N 20, positive development average, and >= 0.05R development uplift",
    "laterGate": "N >= 10, positive average R, >= 0.05R uplift versus active, barrier applied in both partitions",
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
    family = str(active.get("managementFamily") or "fixed")
    trigger = active.get("managementTriggerR")
    baseline = [{**simulate_managed(profile, family, float(active.get("stopAtr") or 1), float(active.get("targetR") or 2), int(active.get("expiryCandles") or 30), trigger), "eventTime": int(profile["eventTime"])} for profile in profiles]
    baseline_dev, baseline_later = partition(baseline, split, False), partition(baseline, split, True)
    candidates = []
    for variant in VARIANTS:
      simulated = [simulate_barrier(profile, active, variant) for profile in profiles]
      development, later = partition(simulated, split, False), partition(simulated, split, True)
      candidates.append({
        "variant": variant, "development": development, "later": later,
        "developmentUpliftR": (development.get("averageR") or 0) - (baseline_dev.get("averageR") or 0),
        "laterUpliftR": (later.get("averageR") or 0) - (baseline_later.get("averageR") or 0),
      })
    eligible = [row for row in candidates if int(row["development"].get("evaluableN") or 0) >= 20 and float(row["development"].get("averageR") or 0) > 0 and float(row["developmentUpliftR"]) >= .05 and int(row["development"].get("barrierAppliedN") or 0) > 0]
    selected = max(eligible, key=lambda row: (float(row["developmentUpliftR"]), float(row["development"].get("averageR") or -999)), default=None)
    supported = bool(selected and int(selected["later"].get("evaluableN") or 0) >= 10 and int(selected["later"].get("barrierAppliedN") or 0) > 0 and float(selected["later"].get("averageR") or 0) > 0 and float(selected["laterUpliftR"]) >= .05)
    rows.append({
      "market": pattern["market"], "patternId": pattern["id"], "label": pattern["label"],
      "sourceExperimentId": experiment_id, "datasetFingerprint": dataset_fingerprint,
      "splitTime": split, "activeExecution": active, "baselineDevelopment": baseline_dev,
      "baselineLater": baseline_later, "selected": selected, "status": "later_supported" if supported else "rejected_or_insufficient",
      "candleFingerprint": candle_fingerprint,
    })
  payload = {
    "schema": SCHEMA, "configuration": configuration, "configurationHash": configuration_hash,
    "registryRevision": server.PRACTICAL_MODEL_HASH, "recipes": len(rows),
    "supported": sum(row["status"] == "later_supported" for row in rows), "rows": rows,
    "activeRegistryPreserved": True,
    "limitations": [
      "This is reused historical research, not prospective validation or proof of executable fills.",
      "H4 candles cannot order a stop and target touched inside the same candle; those cases remain ambiguous and are excluded from average R.",
      "Confirmed pivot zones are deterministic approximations of support/resistance, not objective physical barriers or guaranteed reversal levels.",
      "Spread, commission, slippage, swap, and gaps beyond recorded H4 prices are excluded.",
    ],
  }
  destination = Path(__file__).resolve().parents[1] / "support_resistance_execution_research.json"
  destination.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
  print(json.dumps({"destination": str(destination), "recipes": len(rows), "supported": payload["supported"]}))


if __name__ == "__main__":
  main()
