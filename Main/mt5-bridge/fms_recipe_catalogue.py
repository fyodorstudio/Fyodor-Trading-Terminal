"""Pure, non-promoting reference catalogue over frozen recipe/candle evidence."""
from __future__ import annotations

from bisect import bisect_left, bisect_right
from collections import Counter
from copy import deepcopy
from datetime import datetime, timezone
import math
import statistics
from typing import Any, Dict, List, Sequence

from fms_historical_evidence import normalize_historical_evidence

H4_SECONDS = 14_400
REFERENCE_TARGETS_R = (0.5, 1.0, 2.0)
REFERENCE_HORIZONS = (6, 12, 30)


def project_catalogue_surface(catalogue: Dict[str, Any]) -> Dict[str, Any]:
  """Compact read-only presentation; no recipe selection or approval action."""
  reconciled = {row["recipe"] for row in catalogue["baselineReconciliation"]
                if row["kind"] == "execution_approval" and row["artifactMatches"]}
  recipes = []
  metric_keys = ("attemptedCount", "evaluableCount", "targetHitCount",
                 "stopHitCount", "stopGapCount", "expiredCount", "ambiguousCount",
                 "unevaluableCount", "averageGrossR", "expectancyCi95")
  followup_keys = ("attemptedCount", "observedCount", "unavailableCount", "unavailableByReason",
                   "tradeDirectionAlignedCount", "economicReadingAlignedCount",
                   "economicReadingEvaluableCount")
  def followup_projection(row: Dict[str, Any]) -> Dict[str, Any]:
    return {**{key: row.get(key) for key in followup_keys},
            **{key: {"median": row[key]["median"]} for key in ("finalAtr", "mfeAtr", "maeAtr")},
            "targetTouches": [{key: touch[key] for key in ("targetR", "touchedCount", "observedCount")}
                              | {"timeToTouchH4": {"median": touch["timeToTouchH4"]["median"]}}
                              for touch in row["targetTouches"]]}
  for source in catalogue["recipes"]:
    configuration, review = source["configuration"], source["executionReview"]
    recipes.append({
      "recipe": source["recipe"], "market": source["market"], "label": source["label"],
      "experimentId": source["experimentId"], "splitTime": source["splitTime"],
      "scoringPolicy": configuration["scoringPolicy"], "reaction": configuration["reaction"],
      "signatures": configuration.get("signatures") or [configuration["signature"]],
      "cohort": configuration.get("cohort"), "noteKeys": source["noteKeys"],
      "review": {"status": "baseline_identity_reconciled" if source["recipe"] in reconciled else review["status"],
                 "originalDecision": review["originalDecision"], "reason": review["reason"],
                 "failedChecks": review["failedChecks"]},
      "contracts": [{"targetR": row["targetR"], "horizonCandles": row["horizonCandles"],
                     "partitions": {scope: {key: metrics.get(key) for key in metric_keys}
                                    for scope, metrics in row["partitions"].items()}}
                    for row in source["referenceContracts"]],
      "followup": [{"horizonCandles": row["horizonCandles"],
                    "partitions": {scope: followup_projection(row[raw_scope])
                                   for scope, raw_scope in (("overall", "all"), ("development", "development"), ("holdout", "holdout"))}}
                   for row in source["followup"]],
    })
  return deepcopy({
    "schema": "fms-recipe-catalogue-surface-v1", "catalogueHash": catalogue["catalogueHash"],
    "manifestHash": catalogue["manifest"]["manifestHash"], "evaluatedAt": catalogue["manifest"]["evaluatedAt"],
    "sourceClock": catalogue["manifest"]["sourceClock"], "summary": catalogue["summary"],
    "marketsWithoutBaselineRecipe": catalogue["marketsWithoutBaselineRecipe"],
    "universe": catalogue["universe"], "limitations": catalogue["limitations"], "recipes": recipes,
  })


def assess_source_clock(observations: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
  """Describe acknowledgement clocks, never infer historical release offsets.

  Upload latency and repeated package rows are not independent clock samples.
  Even a stable acknowledgement offset says nothing about historical DST or
  the time basis of an unscoped candle archive. No timestamps are rewritten.
  """
  pairs = sorted({(int(row["ea_completed_at"]), int(row["bridge_acknowledged_at"]))
                  for row in observations if row.get("ea_completed_at") is not None
                  and row.get("bridge_acknowledged_at") is not None})
  deltas = [server - receipt for server, receipt in pairs]
  return {
    "status": "unverified_cross_source_alignment",
    "calendarBasis": "Raw MQL5 trade-server calendar timestamps; no stored per-event UTC offset",
    "candleBasis": "Python MT5 documented UTC; historical archive alignment not empirically verified",
    "uniqueAcknowledgementPairs": len(pairs),
    "serverMinusReceiptSeconds": {
      "min": min(deltas) if deltas else None,
      "median": statistics.median(deltas) if deltas else None,
      "max": max(deltas) if deltas else None,
    },
    "historicalOffsetInferred": False,
    "timestampsChanged": False,
    "successorTimingEligible": False,
    "requiredEvidence": "Verified event and candle clock mapping for each studied historical period; current offset alone is insufficient",
  }


def reference_followup_case(
  source_case: Dict[str, Any], trade_direction: str, candles: Sequence[Dict[str, Any]],
  times: Sequence[int], atr_values: Sequence[float | None], horizon: int, *, as_of: int,
) -> Dict[str, Any]:
  """Derive this study's geometry without changing a frozen source entry/ATR.

  Historical broker candle revisions must not silently exclude just the cases
  whose old entry price differs. The new reference uses one pinned snapshot's
  strict post-release open and canonical completed-H4 ATR for every case.
  """
  event_time = int(source_case["eventTime"])
  index = bisect_right(times, event_time)
  unavailable = {"caseId": source_case["caseId"], "eventTime": event_time, "status": "unavailable"}
  if index <= 0 or index >= len(candles):
    return {**unavailable, "reason": "missing_post_release_entry"}
  if not _permitted_gap(event_time, int(times[index])):
    return {**unavailable, "reason": "missing_first_entry_interval"}
  atr = atr_values[index - 1]
  if atr is None or not math.isfinite(float(atr)) or float(atr) <= 0:
    return {**unavailable, "reason": "missing_completed_atr"}
  entry = float(candles[index]["open"])
  reference = {**source_case, "entryTime": int(times[index]), "entry": entry, "atr": float(atr)}
  response = followup_case(reference, trade_direction, candles, times, horizon, as_of=as_of)
  if response["status"] == "observed":
    response["sourceEntryPriceChanged"] = source_case.get("entry") is not None and not math.isclose(float(source_case["entry"]), entry, rel_tol=1e-10, abs_tol=1e-10)
    response["sourceEntryTimeChanged"] = source_case.get("entryTime") is not None and int(source_case["entryTime"]) != int(times[index])
    response["atrKnownAt"] = min(int(times[index - 1]) + H4_SECONDS, int(times[index]))
  return response


def archive_contract_evidence(contract: Dict[str, Any], scope: str) -> Dict[str, Any]:
  metrics = contract.get(scope)
  if not isinstance(metrics, dict):
    raise ValueError(f"Missing immutable contract partition: {scope}")
  evidence = normalize_historical_evidence(
    f"Reused immutable archive · {scope}", str(contract["key"]),
    {"dimension": "reference_policy", "value": "SL 1 ATR · fixed target · later H4 entry"},
    metrics, "grossAverageR", "evaluableCount",
  )
  attempts = metrics.get("attemptedCount")
  count_fields = ("evaluableCount", "ambiguousCount", "unevaluableCount")
  if attempts is not None and all(metrics.get(field) is not None for field in count_fields):
    if int(attempts) != sum(int(metrics[field]) for field in count_fields):
      raise ValueError("Immutable attempted/evaluable/unknown counts do not partition")
  return {**evidence, "attemptedCount": attempts}


def _permitted_gap(before: int, after: int) -> bool:
  delta = after - before
  # Short session-edge bars are allowed. Longer gaps require the predeclared
  # weekend rule; missing weekday/holiday bars remain unknown, not invented.
  if 0 < delta <= H4_SECONDS:
    return True
  return (
    H4_SECONDS < delta <= 72 * 3600
    and datetime.fromtimestamp(before, timezone.utc).weekday() in (4, 5)
    and datetime.fromtimestamp(after, timezone.utc).weekday() in (6, 0)
  )


def followup_case(
  case: Dict[str, Any], trade_direction: str, candles: Sequence[Dict[str, Any]],
  times: Sequence[int], horizon: int, *, as_of: int | None = None,
) -> Dict[str, Any]:
  """Measure full-horizon touches, including after a stop; never a trade P/L."""
  if not isinstance(horizon, int) or horizon <= 0:
    raise ValueError("A positive integer candle horizon is required")
  base = {"caseId": case["caseId"], "eventTime": int(case["eventTime"])}
  entry_time, entry, atr = case.get("entryTime"), case.get("entry"), case.get("atr")
  if trade_direction not in {"long", "short"} or entry_time is None or entry is None or atr is None:
    return {**base, "status": "unavailable", "reason": "missing_frozen_geometry"}
  if not math.isfinite(float(entry)) or not math.isfinite(float(atr)) or float(atr) <= 0:
    return {**base, "status": "unavailable", "reason": "invalid_frozen_geometry"}
  if int(entry_time) <= base["eventTime"]:
    return {**base, "status": "unavailable", "reason": "entry_not_strictly_after_release"}
  index = bisect_left(times, int(entry_time))
  if index >= len(candles) or times[index] != int(entry_time):
    return {**base, "status": "unavailable", "reason": "missing_exact_entry_candle"}
  if not math.isclose(float(candles[index]["open"]), float(entry), rel_tol=1e-10, abs_tol=1e-10):
    return {**base, "status": "unavailable", "reason": "entry_snapshot_mismatch"}
  window = candles[index:index + horizon]
  if len(window) != horizon:
    return {**base, "status": "unavailable", "reason": "incomplete_horizon"}
  if as_of is not None and int(window[-1]["time"]) + H4_SECONDS > as_of:
    return {**base, "status": "unavailable", "reason": "horizon_candle_not_complete"}
  if any(not all(math.isfinite(float(row[field])) for field in ("open", "high", "low", "close"))
         or float(row["low"]) > min(float(row["open"]), float(row["close"]))
         or float(row["high"]) < max(float(row["open"]), float(row["close"])) for row in window):
    return {**base, "status": "unavailable", "reason": "invalid_ohlc"}
  if any(not _permitted_gap(int(left["time"]), int(right["time"])) for left, right in zip(window, window[1:])):
    return {**base, "status": "unavailable", "reason": "missing_weekday_path"}
  sign = 1 if trade_direction == "long" else -1
  favorable = [max(0.0, (float(row["high"]) - float(entry)) / float(atr)) if sign > 0
               else max(0.0, (float(entry) - float(row["low"])) / float(atr)) for row in window]
  adverse = [max(0.0, (float(entry) - float(row["low"])) / float(atr)) if sign > 0
             else max(0.0, (float(row["high"]) - float(entry)) / float(atr)) for row in window]
  final_atr = sign * (float(window[-1]["close"]) - float(entry)) / float(atr)
  evidence_direction = case.get("direction")
  economic_final = final_atr if evidence_direction == trade_direction else -final_atr if evidence_direction in {"long", "short"} else None
  return {
    **base, "status": "observed", "entryTime": int(entry_time), "horizonCandles": horizon,
    "finalAtr": final_atr, "economicReadingFinalAtr": economic_final,
    "mfeAtr": max(favorable), "maeAtr": max(adverse),
    "favorableAtr": favorable, "adverseAtr": adverse,
    "openingAtr": [sign * (float(row["open"]) - float(entry)) / float(atr) for row in window],
    "targets": [{"targetR": target, "touched": max(favorable) >= target,
                 "firstTouchCandle": next((i + 1 for i, value in enumerate(favorable) if value >= target), None)}
                for target in REFERENCE_TARGETS_R],
  }


def fixed_reference_case(followup: Dict[str, Any], target_r: float) -> Dict[str, Any]:
  """Fixed 1-ATR stop on the same complete-H4 cohort, with unknown ordering."""
  base = {"caseId": followup["caseId"], "eventTime": followup["eventTime"]}
  if target_r not in REFERENCE_TARGETS_R:
    raise ValueError("Undeclared reference target")
  if followup["status"] != "observed":
    return {**base, "status": "unevaluable", "resultR": None, "reason": followup.get("reason")}
  for index, (opening, favorable, adverse) in enumerate(zip(followup["openingAtr"], followup["favorableAtr"], followup["adverseAtr"])):
    if opening <= -1:
      return {**base, "status": "stop_gap", "resultR": opening, "exitCandle": index + 1}
    if opening >= target_r:
      return {**base, "status": "target_hit", "resultR": target_r, "exitCandle": index + 1}
    if favorable >= target_r and adverse >= 1:
      return {**base, "status": "ambiguous", "resultR": None, "reason": "both_touched_order_unknown", "exitCandle": index + 1}
    if adverse >= 1:
      return {**base, "status": "stop_hit", "resultR": -1.0, "exitCandle": index + 1}
    if favorable >= target_r:
      return {**base, "status": "target_hit", "resultR": target_r, "exitCandle": index + 1}
  return {**base, "status": "expired", "resultR": followup["finalAtr"], "exitCandle": followup["horizonCandles"]}


def summarize_reference(rows: Sequence[Dict[str, Any]], scope: str) -> Dict[str, Any]:
  evaluable = [row for row in rows if row.get("resultR") is not None]
  counts = Counter(row["status"] for row in rows)
  results = [float(row["resultR"]) for row in evaluable]
  metrics = {
    "evaluableCount": len(evaluable), "targetHitCount": counts["target_hit"],
    "stopHitCount": counts["stop_hit"] + counts["stop_gap"], "expiredCount": counts["expired"],
    "ambiguousCount": counts["ambiguous"], "unevaluableCount": counts["unevaluable"],
    "averageR": statistics.fmean(results) if results else None,
  }
  if len(rows) != len(evaluable) + metrics["ambiguousCount"] + metrics["unevaluableCount"]:
    raise ValueError("Reference outcomes do not partition")
  evidence = normalize_historical_evidence(
    f"Pinned complete-H4 reference cohort · {scope} · coarse ordering", None,
    {"dimension": "reference_policy", "value": "SL 1 ATR · fixed target · later H4 entry"},
    metrics, "averageR", "evaluableCount",
  )
  years: Dict[int, List[float]] = {}
  for row in evaluable:
    year = datetime.fromtimestamp(row["eventTime"], timezone.utc).year
    years.setdefault(year, []).append(float(row["resultR"]))
  ci = None
  if len(results) >= 2:
    margin = 1.96 * statistics.stdev(results) / math.sqrt(len(results))
    ci = {"lower": metrics["averageR"] - margin, "upper": metrics["averageR"] + margin}
  return {**evidence, "attemptedCount": len(rows), "stopGapCount": counts["stop_gap"],
          "expectancyCi95": ci, "evaluableYears": len(years),
          "positiveYears": sum(statistics.fmean(values) > 0 for values in years.values()),
          "ciMethod": "Descriptive normal mean interval; does not establish independent release samples",
          "unavailableByReason": dict(Counter(row.get("reason", "unknown") for row in rows if row["status"] == "unevaluable"))}


def _distribution(values: List[float]) -> Dict[str, Any]:
  ordered = sorted(values)
  def quantile(fraction: float) -> float | None:
    if not ordered:
      return None
    index = (len(ordered) - 1) * fraction
    low, high = math.floor(index), math.ceil(index)
    return ordered[low] * (high - index) + ordered[high] * (index - low) if low != high else ordered[low]
  return {"minimum": min(ordered) if ordered else None, "p25": quantile(.25), "median": quantile(.5),
          "mean": statistics.fmean(ordered) if ordered else None, "p75": quantile(.75),
          "maximum": max(ordered) if ordered else None}


def summarize_followup(rows: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
  observed = [row for row in rows if row["status"] == "observed"]
  economic = [row for row in observed if row.get("economicReadingFinalAtr") is not None]
  sample = len(observed)
  touches = []
  for target in REFERENCE_TARGETS_R:
    items = [next(item for item in row["targets"] if item["targetR"] == target) for row in observed]
    touched = [item for item in items if item["touched"]]
    touches.append({"targetR": target, "touchedCount": len(touched), "observedCount": sample,
                    "touchRate": len(touched) / sample if sample else None,
                    "timeToTouchH4": _distribution([float(item["firstTouchCandle"]) for item in touched])})
  return {
    "scope": "Pinned H4 full-horizon follow-up · not TP-before-SL or captured profit",
    "attemptedCount": len(rows), "observedCount": sample, "unavailableCount": len(rows) - sample,
    "unavailableByReason": dict(Counter(row.get("reason", "unknown") for row in rows if row["status"] != "observed")),
    "distinctReleaseEpisodes": len({row["eventTime"] for row in observed}),
    "sourceEntryPriceChangedCount": sum(bool(row.get("sourceEntryPriceChanged")) for row in observed),
    "sourceEntryTimeChangedCount": sum(bool(row.get("sourceEntryTimeChanged")) for row in observed),
    "tradeDirectionAlignedCount": sum(row["finalAtr"] > 0 for row in observed),
    "tradeDirectionAlignmentRate": sum(row["finalAtr"] > 0 for row in observed) / sample if sample else None,
    "economicReadingEvaluableCount": len(economic),
    "economicReadingAlignedCount": sum(row["economicReadingFinalAtr"] > 0 for row in economic),
    "economicReadingAlignmentRate": sum(row["economicReadingFinalAtr"] > 0 for row in economic) / len(economic) if economic else None,
    "finalAtr": _distribution([row["finalAtr"] for row in observed]),
    "mfeAtr": _distribution([row["mfeAtr"] for row in observed]),
    "maeAtr": _distribution([row["maeAtr"] for row in observed]),
    "targetTouches": touches,
  }
