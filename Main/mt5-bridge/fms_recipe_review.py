"""Pure projection of existing recipe-review evidence; never selects/promotes.

Old decline decisions remain decisions of their original protocol. Positive
historical evidence stays visible without relabeling it a new approved recipe.
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict
import math
from bisect import bisect_right

from macro_signal import evaluate_candidate, evaluate_candidate_h1_entry


def audit_note_signal(note: Dict[str, Any], response: Dict[str, Any], h4_candles: list[dict], h1_candles: list[dict]) -> Dict[str, Any]:
  """Replay saved geometry through the canonical evaluator, never rescore.

  This is an as-recorded path diagnostic, not clock validation or a replacement
  result. Changed candle entry prices and missing/finer paths stay explicit.
  """
  expected_id = f"{note['patternId']}:{note['eventTime']}"
  matches = [row for row in response.get("signals", []) + response.get("recoveredSignals", []) if row["id"] == expected_id]
  base = {"recordKey": note["recordKey"], "snapshotGeneratedAt": response.get("generatedAt"),
          "timestampsChanged": False, "newRegistration": False, "qualification": "as_recorded_only_clock_unverified"}
  if not matches:
    return {**base, "status": "not_in_current_market_snapshot", "stored": None}
  if any(row != matches[0] for row in matches[1:]):
    return {**base, "status": "conflicting_stored_signal_identity", "stored": None}
  signal = matches[0]
  stored = {key: signal.get(key) for key in ("id", "direction", "activationTime", "entry", "atr", "initialStop", "target",
              "outcomeStatus", "resultR", "exitTime", "outcomeReasonCode", "outcomeReason", "entryTimeframe",
              "stopAtr", "targetR", "expiryCandles", "managementFamily", "managementTriggerR", "prospectiveCapture")}
  base["stored"] = deepcopy(stored)
  if any(signal.get(key) is None for key in ("activationTime", "entry", "atr", "stopAtr", "targetR", "expiryCandles")):
    return {**base, "status": "stored_geometry_unavailable"}
  timeframe = signal.get("entryTimeframe") or "H4"
  if timeframe not in {"H4", "H1"}:
    return {**base, "status": "unsupported_entry_timeframe"}
  entry_series = h1_candles if timeframe == "H1" else h4_candles
  entry_bar = next((bar for bar in entry_series if bar["time"] == signal["activationTime"]), None)
  if entry_bar is None:
    return {**base, "status": "cached_entry_unavailable"}
  if not math.isclose(float(entry_bar["open"]), float(signal["entry"]), rel_tol=1e-10, abs_tol=1e-10):
    return {**base, "status": "source_entry_price_revision", "cachedEntryOpen": entry_bar["open"]}
  times = [int(bar["time"]) for bar in h4_candles]
  parent_index = bisect_right(times, int(signal["eventTime"]))
  if parent_index <= 0 or parent_index >= len(times):
    return {**base, "status": "cached_parent_h4_unavailable"}
  atrs = [None] * len(times)
  atr_index = bisect_right(times, int(signal["activationTime"]) - 14400) - 1 if timeframe == "H1" else parent_index - 1
  if atr_index < 0:
    return {**base, "status": "cached_completed_atr_bar_unavailable"}
  atrs[atr_index] = float(signal["atr"])
  candidate = {**signal, "factorVotes": []}
  options = {"allow_pending": True, "as_of": int(response["generatedAt"]), "stop_atr": float(signal["stopAtr"]),
             "holding_candles": int(signal["expiryCandles"]), "management_family": signal.get("managementFamily") or "fixed",
             "management_trigger_r": signal.get("managementTriggerR")}
  if options["management_family"] not in {"fixed", "break_even"}:
    return {**base, "status": "unsupported_management_requires_review"}
  evaluated = (evaluate_candidate_h1_entry(candidate, h1_candles, h4_candles, atrs, float(signal["targetR"]), **options)
               if timeframe == "H1" else evaluate_candidate(candidate, h4_candles, times, atrs, float(signal["targetR"]), **options))
  replay = {key: evaluated.get(key) for key in ("status", "reasonCode", "entryTime", "entry", "atr", "initialStop", "target", "resultR", "exitTime")}
  if evaluated["status"] in {"pending", "unevaluable"}:
    return {**base, "status": "insufficient_cached_path", "replay": replay}
  if evaluated["status"] == "ambiguous" and signal["outcomeStatus"] != "ambiguous":
    return {**base, "status": "requires_finer_ordering_evidence", "replay": replay}
  comparisons = {"outcomeStatus": evaluated["status"] == signal["outcomeStatus"],
                 "exitTime": evaluated.get("exitTime") == signal.get("exitTime"),
                 "activationTime": evaluated.get("entryTime") == signal["activationTime"]}
  for key in ("entry", "atr", "initialStop", "target", "resultR"):
    before, after = signal.get(key), evaluated.get(key)
    comparisons[key] = before == after if before is None or after is None else math.isclose(float(before), float(after), rel_tol=1e-9, abs_tol=1e-9)
  return {**base, "status": "as_recorded_path_consistent" if all(comparisons.values()) else "requires_outcome_review",
          "comparisons": comparisons, "replay": replay}


def project_recipe_review(profile: Dict[str, Any], *, approved_in_baseline: bool) -> Dict[str, Any]:
  research = profile.get("executionChallenger") or {}
  review = research.get("registryReview") or {}
  decision = review.get("decision")
  if approved_in_baseline:
    status = "baseline_approval_requires_identity_check"
  elif decision == "declined":
    status = "previously_declined"
  elif decision == "approved_for_registry_review":
    status = "pending_registration_review"
  elif research.get("reviewWorthy"):
    status = "pending_evidence_review"
  else:
    status = "no_pending_execution_challenger"
  return deepcopy({
    "status": status,
    "originalDecision": decision,
    "reason": review.get("reason"),
    "checks": review.get("checks") or {},
    "failedChecks": sorted(key for key, value in (review.get("checks") or {}).items() if value is False),
    "activeLater": research.get("activeLater"),
    "developmentSelectedChallenger": research.get("bestChallenger"),
    "configurationHash": research.get("configurationHash"),
    "candleFingerprint": research.get("candleFingerprint"),
    "datasetFingerprint": research.get("datasetFingerprint"),
    "selection": research.get("selection"),
    "limitations": review.get("limitations"),
    "reusedHistory": True,
    "newRegistration": False,
  })
