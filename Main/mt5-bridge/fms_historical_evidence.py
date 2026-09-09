"""Pure normalization and source selection for chart historical evidence.

This module intentionally imports neither MetaTrader5 nor FastAPI. Research
tools, bridge handlers, and tests can therefore use the same evidence contract
without starting the live bridge or weakening frozen-artifact checks.
"""
from __future__ import annotations

import json
from typing import Any, Callable, Dict, Optional


CANONICAL_HISTORICAL_EVIDENCE_SCHEMA = "fms-chart-historical-evidence-v1"


def normalize_historical_evidence(
  scope: str,
  source_id: Optional[str],
  cohort: Dict[str, Any],
  metrics: Dict[str, Any],
  average_key: str,
  sample_key: str,
) -> Dict[str, Any]:
  """Normalize one exact cohort without reverse-engineering unknown counts."""
  sample_value = metrics.get(sample_key)
  average_value = metrics.get(average_key)
  sample = int(sample_value) if sample_value is not None else 0
  average = float(average_value) if average_value is not None else None
  target_hit_count = metrics.get("targetHitCount")
  stop_hit_count = metrics.get("stopHitCount")
  target_hit_rate = metrics.get("targetHitRate", metrics.get("tpBeforeSl"))
  stop_hit_rate = metrics.get("stopHitRate", metrics.get("slBeforeTp"))
  if target_hit_rate is None and target_hit_count is not None and sample:
    target_hit_rate = int(target_hit_count) / sample
  if stop_hit_rate is None and stop_hit_count is not None and sample:
    stop_hit_rate = int(stop_hit_count) / sample
  return {
    "schema": CANONICAL_HISTORICAL_EVIDENCE_SCHEMA,
    "scope": scope,
    "cohort": dict(cohort),
    "sourceId": source_id,
    "evaluableCount": sample,
    "targetHitCount": target_hit_count,
    "targetHitRate": target_hit_rate,
    "stopHitCount": stop_hit_count,
    "stopHitRate": stop_hit_rate,
    "expiredCount": metrics.get("expiredCount"),
    "breakEvenCount": metrics.get("breakEvenCount"),
    "ambiguousCount": metrics.get("ambiguousCount", metrics.get("ambiguousN")),
    "ambiguousCases": list(metrics.get("ambiguousCases") or []),
    "unevaluableCount": metrics.get("unevaluableCount", metrics.get("unevaluableN")),
    "averageGrossR": average,
    "totalGrossR": average * sample if average is not None and sample else None,
    "totalGrossRDerivation": "exact_mean_times_evaluable_n" if average is not None and sample else None,
  }


def resolve_historical_evidence(
  pattern: Dict[str, Any],
  *,
  load_raw_audit: Optional[Callable[[str], Optional[str]]] = None,
  load_experiment: Optional[Callable[[str], Optional[Dict[str, Any]]]] = None,
  warn: Optional[Callable[[str, str], None]] = None,
) -> Dict[str, Any]:
  """Resolve the highest-priority exact source into the canonical contract."""
  benchmark = pattern.get("historicalBenchmark") or {}
  cohort = pattern.get("cohort") or {"dimension": "none", "value": "all"}

  entry_review = pattern.get("entryReview") or {}
  if entry_review.get("status") == "reviewed_active":
    later = entry_review.get("later") or {}
    return normalize_historical_evidence(
      "Chronological later matched cases · reviewed H1 entry",
      str(entry_review.get("id") or benchmark.get("experimentId") or "") or None,
      cohort,
      {**later, "evaluableN": later.get("laterN"), "averageR": later.get("h1AverageR")},
      "averageR", "evaluableN",
    )

  execution_review = pattern.get("executionReview") or {}
  if execution_review.get("status") == "reviewed_active":
    later = execution_review.get("later") or {}
    return normalize_historical_evidence(
      "Chronological later cases · reviewed execution successor",
      str(execution_review.get("configurationHash") or benchmark.get("experimentId") or "") or None,
      cohort, later, "averageR", "evaluableN",
    )

  if benchmark.get("basis") == "chronological_holdout":
    experiment_id = str(benchmark.get("experimentId") or "")
    try:
      encoded_audit = load_raw_audit(experiment_id) if experiment_id and load_raw_audit else None
      experiment = load_experiment(experiment_id) if experiment_id and load_experiment else None
      audit = json.loads(encoded_audit) if encoded_audit else None
      if isinstance(audit, dict):
        selected_key = str(audit.get("selectedContractKey") or "")
        contract = next((row for row in audit.get("contracts", []) if str(row.get("key")) == selected_key), None)
        stored_holdout = dict((contract or {}).get("holdout") or {})
        if stored_holdout:
          split_time = (((experiment or {}).get("result") or {}).get("splitTime"))
          stored_holdout["ambiguousCases"] = [
            {
              "caseId": row.get("caseId"),
              "eventTime": row.get("eventTime"),
              "reason": row.get("outcomeReason") or row.get("reason") or "SL and TP ordering was unresolved",
            }
            for row in (audit.get("contractResults") or {}).get(selected_key, [])
            if row.get("status") == "ambiguous"
            and (split_time is None or int(row.get("eventTime") or 0) >= int(split_time))
          ]
          return normalize_historical_evidence(
            "Chronological holdout · immutable registered contract",
            experiment_id or None, cohort, stored_holdout,
            "grossAverageR", "evaluableCount",
          )
    except (AttributeError, TypeError, ValueError, json.JSONDecodeError):
      if warn:
        warn("Falling back from immutable historical evidence for %s", experiment_id)
    return normalize_historical_evidence(
      "Chronological holdout · registered contract",
      experiment_id or None, cohort, pattern.get("holdout") or {},
      "averageR", "evaluableCount",
    )

  return normalize_historical_evidence(
    "Walk-forward pooled benchmark · registered contract",
    str(benchmark.get("experimentId") or "") or None,
    cohort,
    {
      "evaluableCount": benchmark.get("walkForwardN"),
      "averageR": benchmark.get("walkForwardAverageR"),
      "targetHitRate": benchmark.get("targetFirstRate"),
      "stopHitRate": benchmark.get("stopFirstRate"),
    },
    "averageR", "evaluableCount",
  )
