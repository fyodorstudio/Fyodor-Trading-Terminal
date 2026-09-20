"""Pure, contemporaneous native/UTC clock provenance; never rewrite history.

The EA's explicit GMT and estimated server clock establish an observation's
clock mapping, not a historical timezone/DST schedule or SDK candle alignment.
"""
from typing import Any, Dict, Optional
from copy import deepcopy


def native_clock_mapping(sample: Optional[Dict[str, Any]], observed_at: int) -> Optional[Dict[str, Any]]:
  if not sample or not sample.get("terminalConnected"):
    return None
  try:
    utc = int(sample.get("sampledUtcAt") or 0)
    estimated = int(sample.get("serverEstimatedAt") or 0)
    current = int(sample.get("serverCurrentAt") or 0)
    observed_at = int(observed_at)
  except (TypeError, ValueError):
    return None
  symbol = str(sample.get("symbol") or "").strip()
  # TimeCurrent can be stale when ticks stop. Do not infer an offset from it.
  if utc <= 0 or estimated <= 0 or current <= 0 or not symbol or not 0 <= observed_at - utc <= 30:
    return None
  raw_offset = estimated - utc
  offset = round(raw_offset / 60) * 60
  if abs(offset) > 14 * 3600 or abs(raw_offset - offset) > 2 or abs(current - estimated) > 120:
    return None
  return {"schema": "fms-observation-clock-v1", "sampledUtcAt": utc,
          "observedUtcAt": int(observed_at), "observedNativeAt": int(observed_at) + offset,
          "nativeOffsetSeconds": offset, "uncertaintySeconds": 2,
          "sampleSymbol": symbol, "rawSample": dict(sample),
          "candleClockVerified": False, "historicalOffsetInferred": False}


def clock_boundary_comparison(mapping: Dict[str, Any], native_boundary: int) -> Dict[str, Any]:
  """Compare one receipt with one native boundary, preserving boundary doubt."""
  observed = int(mapping["observedNativeAt"])
  uncertainty = int(mapping["uncertaintySeconds"])
  relation = ("strictly_before" if observed + uncertainty < native_boundary
              else "strictly_after" if observed - uncertainty > native_boundary
              else "boundary_uncertain")
  return {"relation": relation, "observedUtcAt": mapping["observedUtcAt"],
          "observedNativeAt": observed, "nativeBoundary": int(native_boundary),
          "uncertaintySeconds": uncertainty, "originalTimestampsChanged": False}


def advance_native_mapping(mapping: Optional[Dict[str, Any]], utc_at: int) -> Optional[Dict[str, Any]]:
  """Advance a validated receipt clock for at most one normal 60s EA cycle.

  This is a current clock, never a conversion of historical candle/event data.
  Ninety seconds allows the poll interval plus a bounded delivery margin.
  """
  if not mapping or mapping.get("schema") != "fms-observation-clock-v1":
    return None
  received = int(mapping.get("receiptUtcAt", mapping["observedUtcAt"]))
  original = native_clock_mapping(mapping.get("rawSample"), received)
  if not original or original["nativeOffsetSeconds"] != mapping.get("nativeOffsetSeconds"):
    return None
  if not 0 <= int(utc_at) - received <= 90:
    return None
  return {**deepcopy(mapping), "observedUtcAt": int(utc_at),
          "observedNativeAt": int(utc_at) + original["nativeOffsetSeconds"],
          "receiptUtcAt": received}


def verify_native_candle_clock(mapping: Dict[str, Any], m1_times: list[int], h4_times: list[int]) -> Optional[Dict[str, Any]]:
  """Compare fresh SDK position reads with the EA's cached same-symbol opens.

  Exact captured anchors and a current latest bar are both required; matching
  an older SDK bar alone is not proof. A minute/H4 rollover can retain anchors
  in the short SDK window without falsely declaring a clock disagreement.
  """
  sample = mapping["rawSample"]
  minute = int(sample.get("nativeM1OpenAt") or 0)
  h4 = int(sample.get("nativeH4OpenAt") or 0)
  native_now = int(mapping["observedNativeAt"])
  if minute <= 0 or h4 <= 0 or minute not in m1_times or h4 not in h4_times:
    return None
  if not max(m1_times) - 2 <= native_now < max(m1_times) + 62:
    return None
  if not max(h4_times) - 2 <= native_now < max(h4_times) + 14402:
    return None
  return {**deepcopy(mapping), "candleClockVerified": True,
          "verification": {"schema": "fms-native-sdk-clock-verification-v1",
                           "verifiedUtcAt": mapping["observedUtcAt"], "sampleSymbol": mapping["sampleSymbol"],
                           "nativeM1OpenAt": minute, "nativeH4OpenAt": h4,
                           "sdkM1Times": list(m1_times), "sdkH4Times": list(h4_times),
                           "historicalAlignmentVerified": False}}


def native_capture_eligibility(events: list[dict], event_time: int, activation_time: Optional[int],
                               decided_at: int, observations: Dict[tuple[int, int], dict],
                               decision_clock: Optional[Dict[str, Any]]) -> Dict[str, Any]:
  """Clock-aware protocol for new mapped receipts, not a legacy migration."""
  rows = [observations.get((int(event["id"]), int(event["time"])))
          if event.get("id") is not None else None for event in events]
  first_seen = max((int(row["firstSeenAt"]) for row in rows if row and row.get("firstSeenAt") is not None), default=None)
  base = {"protocol": "fms-native-capture-eligibility-v2", "firstSeenAt": first_seen,
          "activationTime": activation_time, "decidedUtcAt": int(decided_at), "originalTimestampsChanged": False}
  def reject(reason: str) -> Dict[str, Any]:
    return {**base, "eligible": False, "reason": reason}
  if not rows or any(not row or row.get("firstSeenAt") is None for row in rows):
    return reject("missing_complete_package_observation")
  if not decision_clock or not decision_clock.get("candleClockVerified"):
    return reject("source_clock_verification_pending")
  if decision_clock.get("observedUtcAt") != int(decided_at):
    return reject("source_clock_verification_pending")
  scope = decision_clock.get("catalogIdentity")
  if not scope:
    return reject("source_clock_scope_unavailable")
  mapped = []
  for row in rows:
    clock = row.get("sourceClock")
    if not clock:
      return reject("missing_package_clock_provenance")
    if clock.get("catalogIdentity") != scope:
      return reject("source_clock_scope_mismatch")
    receipt = native_clock_mapping(clock.get("rawSample"), int(row["firstSeenAt"]))
    if not receipt or receipt["observedUtcAt"] != clock.get("observedUtcAt") or receipt["observedNativeAt"] != clock.get("observedNativeAt"):
      return reject("invalid_receipt_clock_provenance")
    if receipt["nativeOffsetSeconds"] != decision_clock["nativeOffsetSeconds"]:
      return reject("source_clock_transition_unverified")
    relation = clock_boundary_comparison(receipt, int(row["time"]))["relation"]
    if relation == "strictly_before":
      return reject("invalid_pre_release_observation")
    if relation == "boundary_uncertain":
      return reject("source_clock_boundary_uncertain")
    mapped.append(receipt)
  package_native = max(row["observedNativeAt"] for row in mapped)
  base.update({"firstSeenNativeAt": package_native, "decidedNativeAt": decision_clock["observedNativeAt"],
               "sourceClock": deepcopy(decision_clock)})
  if int(decided_at) < first_seen:
    return reject("decision_before_package_observation")
  if activation_time is None:
    return reject("entry_candle_unavailable")
  for clock, late_reason in ((max(mapped, key=lambda row: row["observedNativeAt"]), "observed_after_frozen_entry"),
                             (decision_clock, "decision_after_frozen_entry")):
    relation = clock_boundary_comparison(clock, int(activation_time))["relation"]
    if relation == "boundary_uncertain":
      return reject("source_clock_boundary_uncertain")
    if relation == "strictly_after":
      return reject(late_reason)
  if package_native < int(event_time):
    return reject("invalid_pre_release_observation")
  return {**base, "eligible": True, "reason": "captured_before_frozen_entry"}
