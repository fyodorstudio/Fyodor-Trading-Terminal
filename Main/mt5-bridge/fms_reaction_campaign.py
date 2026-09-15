from __future__ import annotations

import hashlib
import json
import math
import statistics
import time
from bisect import bisect_right
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

from macro_signal import (
  CHART_SIGNAL_RECENT_DAYS,
  H4_SECONDS,
  MARKET_RESEARCH_SPECS,
  MARKET_SOURCE_VERSION_IDS,
  REACTION_ATLAS_HORIZONS,
  _annotate_numeric_robustness,
  _rescore_policy_outcomes,
  build_signal_candidates,
  calculate_atr_by_candle,
  candidate_pattern_signature,
  get_signal_definition,
)
from research_store import ResearchStore


CAMPAIGN_VERSION = "FMS-EVENT-RESPECT-CAMPAIGN-v4"
REACTION_ATLAS_VERSION = "FMS-EVENT-RESPECT-ATLAS-v5"
CANDIDATE_DECLARATION_VERSION = "FMS-EVENT-RESPECT-DECLARATION-v4"
CHALLENGE_VERSION = "FMS-EVENT-RESPECT-CHALLENGE-v4"
PRIMARY_DIRECTION_RULE = "actual_vs_forecast_surprise_only"
MINIMUM_CANDLE_YEARS = 8
MINIMUM_DEVELOPMENT_CASES = 40
MINIMUM_DEVELOPMENT_YEARS = 5
MAXIMUM_DECLARED_CANDIDATES = 12


def canonical_hash(value: Any) -> str:
  return hashlib.sha256(
    json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")
  ).hexdigest()


def market_catalog() -> Dict[str, Dict[str, Any]]:
  rows: Dict[str, Dict[str, Any]] = {}
  for market, versions in MARKET_SOURCE_VERSION_IDS.items():
    if market == "EURUSD":
      currencies = ("EUR", "USD")
    else:
      base, quote, _scope = MARKET_RESEARCH_SPECS[market]
      currencies = (base, quote)
    rows[market] = {
      "currencies": list(currencies),
      "sourceVersions": list(versions),
    }
  return rows


def _quantile(values: Sequence[float], fraction: float) -> Optional[float]:
  ordered = sorted(float(value) for value in values if math.isfinite(float(value)))
  if not ordered:
    return None
  if len(ordered) == 1:
    return ordered[0]
  position = (len(ordered) - 1) * fraction
  lower = math.floor(position)
  upper = math.ceil(position)
  if lower == upper:
    return ordered[lower]
  weight = position - lower
  return ordered[lower] * (1 - weight) + ordered[upper] * weight


def _mean_ci95(values: Sequence[float]) -> Optional[Dict[str, float]]:
  usable = [float(value) for value in values if math.isfinite(float(value))]
  if not usable:
    return None
  mean = statistics.fmean(usable)
  if len(usable) < 2:
    return {"lower": mean, "upper": mean}
  margin = 1.96 * statistics.stdev(usable) / math.sqrt(len(usable))
  return {"lower": mean - margin, "upper": mean + margin}


def _one_sided_normal_p(values: Sequence[float]) -> Optional[float]:
  usable = [float(value) for value in values if math.isfinite(float(value))]
  if len(usable) < 2:
    return None
  deviation = statistics.stdev(usable)
  if deviation == 0:
    return 0.0 if statistics.fmean(usable) > 0 else 1.0
  z = statistics.fmean(usable) / (deviation / math.sqrt(len(usable)))
  return 1.0 - statistics.NormalDist().cdf(z)


def _year_stability(samples: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
  grouped: Dict[int, List[float]] = {}
  for sample in samples:
    year = datetime.fromtimestamp(int(sample["eventTime"]), timezone.utc).year
    grouped.setdefault(year, []).append(float(sample["finalAtr"]))
  means = {str(year): statistics.fmean(values) for year, values in sorted(grouped.items())}
  positive = sum(value > 0 for value in means.values())
  return {
    "representedYears": len(means),
    "positiveYears": positive,
    "positiveYearShare": positive / len(means) if means else None,
    "yearMeansAtr": means,
  }


def summarize_reaction(samples: Sequence[Dict[str, Any]], unavailable: int = 0) -> Dict[str, Any]:
  final = [float(row["finalAtr"]) for row in samples]
  mfe = [float(row["mfeAtr"]) for row in samples]
  mae = [float(row["maeAtr"]) for row in samples]
  respected = sum(value > 0 for value in final)
  impulse_reversal = sum(bool(row["impulseThenReversal"]) for row in samples)
  stability = _year_stability(samples)
  return {
    "evaluableN": len(samples),
    "unavailableN": int(unavailable),
    "respectCount": respected,
    "respectRate": respected / len(samples) if samples else None,
    "meanFinalAtr": statistics.fmean(final) if final else None,
    "medianFinalAtr": _quantile(final, .5),
    "finalAtrCi95": _mean_ci95(final),
    "oneSidedNoRespectPApprox": _one_sided_normal_p(final),
    "medianMfeAtr": _quantile(mfe, .5),
    "mfeAtrQ25": _quantile(mfe, .25),
    "mfeAtrQ75": _quantile(mfe, .75),
    "medianMaeAtr": _quantile(mae, .5),
    "maeAtrQ25": _quantile(mae, .25),
    "maeAtrQ75": _quantile(mae, .75),
    "impulseThenReversalCount": impulse_reversal,
    "impulseThenReversalRate": impulse_reversal / len(samples) if samples else None,
    **stability,
  }


def load_source_bundle(
  store: ResearchStore,
  market: str,
  pinned_run_ids: Optional[Sequence[str]] = None,
) -> Dict[str, Any]:
  normalized = market.upper()
  definition = market_catalog().get(normalized)
  if definition is None:
    raise ValueError(f"Unsupported campaign market: {market}")
  requested = {
    str(run["versionId"]): run
    for run_id in (pinned_run_ids or ())
    if (run := store.get_backtest_run(str(run_id))) is not None
  }
  if pinned_run_ids is not None and len(requested) != len(pinned_run_ids):
    raise ValueError(f"One or more pinned source runs are unavailable for {normalized}")
  sources: List[Dict[str, Any]] = []
  missing: List[str] = []
  fingerprints: List[str] = []
  run_ids: List[str] = []
  for version in definition["sourceVersions"]:
    run = requested.get(version) if pinned_run_ids is not None else store.latest_backtest_run(version)
    result = run.get("result") if run and run.get("status") == "completed" else None
    outcomes = (result or {}).get("targets", {}).get("2.0", {}).get("outcomes")
    split_time = (result or {}).get("candidateSummary", {}).get("developmentHoldoutBoundary")
    if not isinstance(outcomes, list) or not isinstance(split_time, int):
      missing.append(version)
      continue
    sources.append({
      "versionId": version,
      "outcomes": outcomes,
      "splitTime": int(split_time),
      "generatedAt": int(result.get("generatedAt") or run["createdAt"]),
    })
    run_ids.append(str(run["id"]))
    fingerprints.append(str(run.get("datasetFingerprint") or ""))
  coverage = store.candle_coverage(normalized, "H4")
  latest_source_time = max((int(row["generatedAt"]) for row in sources), default=0)
  candles = store.query_candles(normalized, "H4", 0, latest_source_time + H4_SECONDS) if latest_source_time else []
  candle_years = (
    (int(candles[-1]["time"]) - int(candles[0]["time"])) / (365.25 * 86400)
    if len(candles) >= 2 else 0.0
  )
  candle_revision = (
    f"{len(candles)}:{int(candles[0]['time'])}:{int(candles[-1]['time'])}"
    if candles else "0:none:none"
  )
  dataset_fingerprint = canonical_hash({
    "market": normalized,
    "sourceRunIds": run_ids,
    "sourceFingerprints": fingerprints,
    "candleRevision": candle_revision,
  })
  blocked_reasons: List[str] = []
  if missing:
    blocked_reasons.append(f"missing completed source runs: {', '.join(missing)}")
  if not candles:
    blocked_reasons.append("no durable H4 candles")
  elif candle_years < MINIMUM_CANDLE_YEARS:
    blocked_reasons.append(
      f"only {candle_years:.2f} years of H4 candles; {MINIMUM_CANDLE_YEARS} required"
    )
  return {
    "market": normalized,
    "currencies": list(definition["currencies"]),
    "sources": sources,
    "sourceRunIds": run_ids,
    "sourceVersions": list(definition["sourceVersions"]),
    "missingSourceVersions": missing,
    "sourceFingerprints": fingerprints,
    "candles": candles,
    "candleCoverage": {
      **coverage,
      "usableCount": len(candles),
      "usableEarliest": int(candles[0]["time"]) if candles else None,
      "usableLatest": int(candles[-1]["time"]) if candles else None,
      "years": candle_years,
      "revision": candle_revision,
    },
    "datasetFingerprint": dataset_fingerprint,
    "eligible": not blocked_reasons,
    "blockedReasons": blocked_reasons,
  }


def build_campaign_manifest(
  store: ResearchStore,
  legacy_model: Dict[str, Any],
  exhaustion_ledger_path: Path,
  generated_at: Optional[int] = None,
) -> Dict[str, Any]:
  created_at = int(generated_at or time.time())
  ledger_bytes = exhaustion_ledger_path.read_bytes()
  notes = store.list_fms_review_notes(10000)
  coverage_rows: List[Dict[str, Any]] = []
  for market in market_catalog():
    bundle = load_source_bundle(store, market)
    coverage_rows.append({
      key: bundle[key]
      for key in (
        "market", "currencies", "sourceRunIds", "sourceVersions",
        "missingSourceVersions", "sourceFingerprints", "candleCoverage",
        "datasetFingerprint", "eligible", "blockedReasons",
      )
    })
  protocol = {
    "question": "Which event-family and pair rows repeatedly move in the direction implied by Actual versus Forecast, and by how much?",
    "historicalEvidence": "Recovered broker-calendar values from pinned source runs; these are not relabeled as first-seen observations.",
    "prospectiveEvidence": "Only immutable first-seen release observations captured after activation.",
    "directionRule": PRIMARY_DIRECTION_RULE,
    "entryReference": "first H4 open strictly after release",
    "horizonsH4": list(REACTION_ATLAS_HORIZONS),
    "discoveryMetrics": [
      "signed final return in entry-known ATR", "signed maximum favorable excursion",
      "signed maximum adverse excursion", "respect rate", "impulse-then-reversal rate",
    ],
    "discoveryExcludes": [
      "SL selection", "TP selection", "holding-period optimization",
      "entry-delay optimization", "context interaction selection",
    ],
    "coverageGate": {
      "allFourCanonicalSourceRuns": True,
      "minimumH4Years": MINIMUM_CANDLE_YEARS,
    },
    "candidateGate": {
      "minimumDevelopmentCases": MINIMUM_DEVELOPMENT_CASES,
      "minimumRepresentedYears": MINIMUM_DEVELOPMENT_YEARS,
      "minimumRespectRate": .54,
      "minimumMeanFinalAtr": .08,
      "minimumFinalCi95LowerAtr": -.02,
      "minimumPositiveYearShare": .60,
      "minimumMedianMfeAtr": .75,
      "withinFamilyHorizonCorrection": "Bonferroni over five declared horizons",
      "acrossFamilyCorrection": "Benjamini-Hochberg FDR q=0.10",
      "maximumDeclaredCandidates": MAXIMUM_DECLARED_CANDIDATES,
    },
    "challengeGate": {
      "minimumHoldoutCases": 12,
      "positiveHoldoutAndRecentMean": True,
      "minimumHoldoutAndRecentRespectRate": .50,
      "minimumHoldoutPositiveYearShare": .50,
      "minimumHoldoutCi95LowerAtr": -.10,
      "acrossDeclaredCorrection": "Benjamini-Hochberg FDR q=0.10",
    },
    "promotionPolicy": "No automatic promotion. A survivor may become a prospective candidate only after explicit frozen review; execution remains a later bounded stage.",
    "legacyPolicy": "Preserve every prior contract and arrow under an explicit Legacy label.",
  }
  manifest = {
    "schema": "fms-event-respect-campaign-manifest-v1",
    "campaignVersion": CAMPAIGN_VERSION,
    "createdAt": created_at,
    "state": "inputs_frozen",
    "legacyModel": legacy_model,
    "reviewNotes": {
      "count": len(notes),
      "documentedCount": sum(row.get("label") == "documented" for row in notes),
      "snapshotHash": canonical_hash(notes),
      "latestUpdatedAt": max((int(row["updatedAt"]) for row in notes), default=None),
    },
    "exhaustionLedger": {
      "path": str(exhaustion_ledger_path),
      "sha256": hashlib.sha256(ledger_bytes).hexdigest(),
    },
    "coverage": coverage_rows,
    "protocol": protocol,
  }
  manifest["manifestHash"] = canonical_hash(manifest)
  return manifest


def _build_reaction_path(
  outcome: Dict[str, Any],
  ordered_candles: Sequence[Dict[str, Any]],
  candle_times: Sequence[int],
  atr_values: Sequence[Optional[float]],
) -> Optional[Dict[str, Any]]:
    direction = str(outcome.get("direction") or "")
    if direction not in {"long", "short"}:
      return None
    event_time = int(outcome["eventTime"])
    entry_index = bisect_right(candle_times, event_time)
    if entry_index <= 0 or entry_index >= len(ordered_candles):
      return None
    atr = atr_values[entry_index - 1]
    if atr is None or not math.isfinite(float(atr)) or float(atr) <= 0:
      return None
    entry = float(ordered_candles[entry_index]["open"])
    window = list(ordered_candles[entry_index:entry_index + max(REACTION_ATLAS_HORIZONS)])
    if not window:
      return None
    sign = 1.0 if direction == "long" else -1.0
    favorable = [
      max(0.0, (float(candle["high"]) - entry) / float(atr))
      if sign > 0 else max(0.0, (entry - float(candle["low"])) / float(atr))
      for candle in window
    ]
    adverse = [
      max(0.0, (entry - float(candle["low"])) / float(atr))
      if sign > 0 else max(0.0, (float(candle["high"]) - entry) / float(atr))
      for candle in window
    ]
    return {
      "outcome": outcome,
      "eventTime": event_time,
      "entryTime": int(ordered_candles[entry_index]["time"]),
      "entry": entry,
      "atr": float(atr),
      "direction": direction,
      "sign": sign,
      "candles": window,
      "favorable": favorable,
      "adverse": adverse,
    }


def _reaction_samples(
  source: Dict[str, Any],
  candles: Sequence[Dict[str, Any]],
) -> Tuple[str, Dict[str, List[Dict[str, Any]]], int]:
  rescored, _audit = _rescore_policy_outcomes(list(source["outcomes"]), "surprise_only")
  annotated = _annotate_numeric_robustness(rescored)
  ordered_candles = sorted(candles, key=lambda row: int(row["time"]))
  candle_times = [int(row["time"]) for row in ordered_candles]
  atr_values = calculate_atr_by_candle(ordered_candles)
  grouped: Dict[str, List[Dict[str, Any]]] = {}
  directional_count = 0

  for outcome in sorted(annotated, key=lambda row: int(row["eventTime"])):
    if outcome.get("direction") not in {"long", "short"}:
      continue
    directional_count += 1
    identity = candidate_pattern_signature(outcome).split("|", 1)[-1]
    profile = _build_reaction_path(outcome, ordered_candles, candle_times, atr_values)
    if profile is None:
      grouped.setdefault(identity, []).append({
        "eventTime": int(outcome["eventTime"]),
        "unavailable": True,
      })
      continue
    grouped.setdefault(identity, []).append({
      "eventTime": int(profile["eventTime"]),
      "splitTime": int(source["splitTime"]),
      "profile": profile,
      "unavailable": False,
    })
  return str(source["versionId"]), grouped, directional_count


def build_development_atlas(manifest: Dict[str, Any], store: ResearchStore) -> Dict[str, Any]:
  rows: List[Dict[str, Any]] = []
  blocked = []
  coverage_by_market = {str(row["market"]): row for row in manifest["coverage"]}
  for market in market_catalog():
    coverage = coverage_by_market[market]
    if not coverage["eligible"]:
      blocked.append({
        "market": market,
        "status": "coverage_blocked",
        "reasons": list(coverage["blockedReasons"]),
      })
      continue
    bundle = load_source_bundle(store, market, coverage["sourceRunIds"])
    if bundle["datasetFingerprint"] != coverage["datasetFingerprint"]:
      raise ValueError(f"Frozen dataset fingerprint mismatch for {market}")
    for source in bundle["sources"]:
      development_source = {
        **source,
        "outcomes": [
          outcome for outcome in source["outcomes"]
          if int(outcome["eventTime"]) < int(source["splitTime"])
        ],
      }
      source_version, grouped, _directional_count = _reaction_samples(
        development_source, bundle["candles"]
      )
      for identity, items in grouped.items():
        example_events = [
          event for item in items if not item["unavailable"]
          for event in item["profile"]["outcome"].get("events", [])
        ]
        for horizon in REACTION_ATLAS_HORIZONS:
          samples: List[Dict[str, Any]] = []
          unavailable = 0
          for item in items:
            if item["unavailable"] or len(item["profile"]["candles"]) < horizon:
              unavailable += 1
              continue
            profile = item["profile"]
            final_atr = (
              float(profile["sign"])
              * (float(profile["candles"][horizon - 1]["close"]) - float(profile["entry"]))
              / float(profile["atr"])
            )
            initial_atr = (
              float(profile["sign"])
              * (float(profile["candles"][0]["close"]) - float(profile["entry"]))
              / float(profile["atr"])
            )
            samples.append({
              "eventTime": int(item["eventTime"]),
              "finalAtr": final_atr,
              "mfeAtr": max(float(value) for value in profile["favorable"][:horizon]),
              "maeAtr": max(float(value) for value in profile["adverse"][:horizon]),
              "impulseThenReversal": horizon > 1 and initial_atr > 0 and final_atr <= 0,
            })
          development = summarize_reaction(samples, unavailable)
          row_id = canonical_hash({
            "market": market,
            "sourceVersionId": source_version,
            "identity": identity,
            "directionRule": PRIMARY_DIRECTION_RULE,
            "horizonH4": horizon,
          })[:20]
          rows.append({
            "rowId": row_id,
            "market": market,
            "sourceVersionId": source_version,
            "identity": identity,
            "family": " + ".join(part.split(":", 1)[-1].replace("_", " ") for part in identity.split("|")),
            "currencies": sorted({part.split(":", 1)[0] for part in identity.split("|")}),
            "directionRule": PRIMARY_DIRECTION_RULE,
            "horizonH4": horizon,
            "exampleTitles": sorted({
              str(event.get("title") or "") for event in example_events if event.get("title")
            })[:10],
            "development": development,
          })
  rows.sort(key=lambda row: (
    str(row["market"]), str(row["identity"]), int(row["horizonH4"])
  ))
  result = {
    "schema": "fms-event-respect-development-atlas-v1",
    "version": REACTION_ATLAS_VERSION,
    "campaignManifestHash": manifest["manifestHash"],
    "selectedOn": "development_only",
    "holdoutRead": False,
    "rows": rows,
    "coverageBlocked": blocked,
  }
  result["artifactHash"] = canonical_hash(result)
  return result


def _candidate_gate(metrics: Dict[str, Any]) -> Dict[str, bool]:
  ci = metrics.get("finalAtrCi95") or {}
  return {
    "minimumCases": int(metrics.get("evaluableN") or 0) >= MINIMUM_DEVELOPMENT_CASES,
    "minimumYears": int(metrics.get("representedYears") or 0) >= MINIMUM_DEVELOPMENT_YEARS,
    "respectRate": float(metrics.get("respectRate") or 0) >= .54,
    "meanFinalAtr": float(metrics.get("meanFinalAtr") or 0) >= .08,
    "uncertainty": float(ci.get("lower") if ci.get("lower") is not None else -999) >= -.02,
    "positiveYears": float(metrics.get("positiveYearShare") or 0) >= .60,
    "mfeScale": float(metrics.get("medianMfeAtr") or 0) >= .75,
  }


def _bh_passes(rows: Sequence[Dict[str, Any]], p_key: str, q: float) -> Dict[str, bool]:
  ranked = sorted(
    ((str(row["rowId"]), float(row[p_key])) for row in rows if row.get(p_key) is not None),
    key=lambda item: (item[1], item[0]),
  )
  boundary = -1
  total = len(ranked)
  for index, (_row_id, p_value) in enumerate(ranked, start=1):
    if p_value <= q * index / total:
      boundary = index
  return {
    row_id: boundary >= 0 and index <= boundary
    for index, (row_id, _p_value) in enumerate(ranked, start=1)
  }


def declare_candidates(atlas: Dict[str, Any]) -> Dict[str, Any]:
  by_family: Dict[Tuple[str, str, str], List[Dict[str, Any]]] = {}
  for row in atlas["rows"]:
    by_family.setdefault(
      (str(row["market"]), str(row["sourceVersionId"]), str(row["identity"])), []
    ).append(row)
  family_winners: List[Dict[str, Any]] = []
  for family_rows in by_family.values():
    eligible = []
    for row in family_rows:
      checks = _candidate_gate(row["development"])
      raw_p = row["development"].get("oneSidedNoRespectPApprox")
      eligible.append({
        **row,
        "checks": checks,
        "rawPApprox": raw_p,
        "horizonBonferroniPApprox": None if raw_p is None else min(1.0, float(raw_p) * len(REACTION_ATLAS_HORIZONS)),
      })
    passing = [row for row in eligible if all(row["checks"].values())]
    if not passing:
      continue
    winner = max(passing, key=lambda row: (
      float((row["development"].get("finalAtrCi95") or {}).get("lower") or -999),
      float(row["development"].get("meanFinalAtr") or -999),
      -int(row["horizonH4"]),
    ))
    family_winners.append(winner)
  bh = _bh_passes(family_winners, "horizonBonferroniPApprox", .10)
  corrected = [{**row, "passesFdr": bh.get(str(row["rowId"]), False)} for row in family_winners]
  corrected.sort(key=lambda row: (
    not row["passesFdr"],
    -float((row["development"].get("finalAtrCi95") or {}).get("lower") or -999),
    -float(row["development"].get("meanFinalAtr") or -999),
    -int(row["development"].get("evaluableN") or 0),
  ))
  selected = [row for row in corrected if row["passesFdr"]][:MAXIMUM_DECLARED_CANDIDATES]
  declaration_rows = [{
    "rowId": row["rowId"],
    "market": row["market"],
    "sourceVersionId": row["sourceVersionId"],
    "identity": row["identity"],
    "family": row["family"],
    "currencies": row["currencies"],
    "directionRule": row["directionRule"],
    "horizonH4": row["horizonH4"],
    "exampleTitles": row["exampleTitles"],
    "development": row["development"],
    "checks": row["checks"],
    "multiplicity": {
      "rawPApprox": row["rawPApprox"],
      "horizonBonferroniPApprox": row["horizonBonferroniPApprox"],
      "passesFdrQ10": row["passesFdr"],
    },
  } for row in selected]
  result = {
    "schema": "fms-event-respect-candidate-declaration-v1",
    "version": CANDIDATE_DECLARATION_VERSION,
    "campaignManifestHash": atlas["campaignManifestHash"],
    "developmentAtlasHash": atlas["artifactHash"],
    "declaredBeforeHoldout": True,
    "holdoutRead": False,
    "familyRowsPassingLiteralGates": len(family_winners),
    "familyRowsPassingMultiplicity": sum(row["passesFdr"] for row in corrected),
    "declaredCandidateCount": len(declaration_rows),
    "candidates": declaration_rows,
  }
  result["declarationHash"] = canonical_hash(result)
  return result


def _all_partition_samples(
  source: Dict[str, Any], candles: Sequence[Dict[str, Any]], identity: str, horizon: int,
) -> Dict[str, List[Dict[str, Any]]]:
  _source_version, grouped, _count = _reaction_samples(source, candles)
  items = grouped.get(identity, [])
  latest_event = max((int(item["eventTime"]) for item in items), default=0)
  recent_cutoff = latest_event - CHART_SIGNAL_RECENT_DAYS * 86400
  partitions: Dict[str, List[Dict[str, Any]]] = {"development": [], "holdout": [], "recent": [], "overall": []}
  for item in items:
    if item["unavailable"] or len(item["profile"]["candles"]) < horizon:
      continue
    profile = item["profile"]
    final_atr = (
      float(profile["sign"])
      * (float(profile["candles"][horizon - 1]["close"]) - float(profile["entry"]))
      / float(profile["atr"])
    )
    initial_atr = (
      float(profile["sign"])
      * (float(profile["candles"][0]["close"]) - float(profile["entry"]))
      / float(profile["atr"])
    )
    sample = {
      "eventTime": int(item["eventTime"]),
      "finalAtr": final_atr,
      "mfeAtr": max(float(value) for value in profile["favorable"][:horizon]),
      "maeAtr": max(float(value) for value in profile["adverse"][:horizon]),
      "impulseThenReversal": horizon > 1 and initial_atr > 0 and final_atr <= 0,
    }
    partitions["overall"].append(sample)
    if int(item["eventTime"]) < int(item["splitTime"]):
      partitions["development"].append(sample)
    else:
      partitions["holdout"].append(sample)
    if int(item["eventTime"]) >= recent_cutoff:
      partitions["recent"].append(sample)
  return partitions


def challenge_candidates(
  manifest: Dict[str, Any], declaration: Dict[str, Any], store: ResearchStore,
) -> Dict[str, Any]:
  coverage_by_market = {str(row["market"]): row for row in manifest["coverage"]}
  rows = []
  for candidate in declaration["candidates"]:
    market = str(candidate["market"])
    coverage = coverage_by_market[market]
    bundle = load_source_bundle(store, market, coverage["sourceRunIds"])
    if bundle["datasetFingerprint"] != coverage["datasetFingerprint"]:
      raise ValueError(f"Frozen dataset fingerprint mismatch for {market}")
    source = next(
      row for row in bundle["sources"]
      if str(row["versionId"]) == str(candidate["sourceVersionId"])
    )
    samples = _all_partition_samples(
      source, bundle["candles"], str(candidate["identity"]), int(candidate["horizonH4"])
    )
    partitions = {name: summarize_reaction(values) for name, values in samples.items()}
    holdout = partitions["holdout"]
    recent = partitions["recent"]
    ci = holdout.get("finalAtrCi95") or {}
    checks = {
      "minimumHoldoutCases": int(holdout.get("evaluableN") or 0) >= 12,
      "holdoutMeanPositive": float(holdout.get("meanFinalAtr") or 0) > 0,
      "recentMeanPositive": float(recent.get("meanFinalAtr") or 0) > 0,
      "holdoutRespectRate": float(holdout.get("respectRate") or 0) > .50,
      "recentRespectRate": float(recent.get("respectRate") or 0) > .50,
      "holdoutPositiveYears": float(holdout.get("positiveYearShare") or 0) >= .50,
      "holdoutUncertainty": float(ci.get("lower") if ci.get("lower") is not None else -999) >= -.10,
    }
    rows.append({
      **{key: candidate[key] for key in (
        "rowId", "market", "sourceVersionId", "identity", "family", "currencies",
        "directionRule", "horizonH4", "exampleTitles",
      )},
      "developmentDeclaration": candidate["development"],
      "partitions": partitions,
      "checks": checks,
      "holdoutPApprox": holdout.get("oneSidedNoRespectPApprox"),
    })
  bh = _bh_passes(rows, "holdoutPApprox", .10)
  finalized = []
  for row in rows:
    passes_fdr = bh.get(str(row["rowId"]), False)
    supported = all(row["checks"].values()) and passes_fdr
    promising = all(value for key, value in row["checks"].items() if key != "holdoutUncertainty")
    finalized.append({
      **row,
      "multiplicity": {"holdoutPApprox": row["holdoutPApprox"], "passesFdrQ10": passes_fdr},
      "classification": "challenge_supported" if supported else "prospective_only" if promising else "rejected",
    })
  result = {
    "schema": "fms-event-respect-chronological-challenge-v1",
    "version": CHALLENGE_VERSION,
    "campaignManifestHash": manifest["manifestHash"],
    "declarationHash": declaration["declarationHash"],
    "holdoutRead": True,
    "candidateCount": len(finalized),
    "supportedCount": sum(row["classification"] == "challenge_supported" for row in finalized),
    "prospectiveOnlyCount": sum(row["classification"] == "prospective_only" for row in finalized),
    "rejectedCount": sum(row["classification"] == "rejected" for row in finalized),
    "rows": finalized,
    "decision": "No automatic registration or execution optimization follows from this artifact.",
  }
  result["challengeHash"] = canonical_hash(result)
  return result


def build_prospective_observations(
  manifest: Dict[str, Any],
  challenge: Dict[str, Any],
  activation: Dict[str, Any],
  store: ResearchStore,
  observed_at: Optional[int] = None,
) -> Dict[str, Any]:
  now = int(observed_at or time.time())
  activated_at = int(activation["activatedAt"])
  if str(activation.get("challengeHash")) != str(challenge.get("challengeHash")):
    raise ValueError("Prospective activation does not match the frozen challenge")
  watched = [
    row for row in challenge.get("rows", [])
    if row.get("classification") in {"challenge_supported", "prospective_only"}
  ]
  coverage_by_market = {str(row["market"]): row for row in manifest["coverage"]}
  output_rows: List[Dict[str, Any]] = []
  for market in sorted({str(row["market"]) for row in watched}):
    candidates = [row for row in watched if str(row["market"]) == market]
    coverage = coverage_by_market[market]
    observed_events = store.query_release_observations(
      from_time=activated_at,
      currencies=coverage["currencies"],
    )
    if not observed_events:
      continue
    bundle = load_source_bundle(store, market, coverage["sourceRunIds"])
    first_seen = {
      (int(event["id"]), int(event["time"])): int(event["firstSeenAt"])
      for event in observed_events
    }
    candles = store.query_candles(market, "H4", 0, now + H4_SECONDS)
    candle_times = [int(row["time"]) for row in candles]
    atr_values = calculate_atr_by_candle(candles)
    for source_version in sorted({str(row["sourceVersionId"]) for row in candidates}):
      definition = get_signal_definition(source_version)
      source = next(row for row in bundle["sources"] if str(row["versionId"]) == source_version)
      if definition is None:
        continue
      observed_candidates = build_signal_candidates(observed_events, now=now, definition=definition)
      observed_times = {int(row["eventTime"]) for row in observed_candidates}
      historical_seed = [
        row for row in source["outcomes"] if int(row["eventTime"]) < activated_at
      ]
      rescored, _audit = _rescore_policy_outcomes(
        [*historical_seed, *observed_candidates], "surprise_only"
      )
      rescored = _annotate_numeric_robustness(rescored)
      for outcome in rescored:
        event_time = int(outcome["eventTime"])
        if event_time not in observed_times or event_time < activated_at:
          continue
        identity = candidate_pattern_signature(outcome).split("|", 1)[-1]
        declared = next((
          row for row in candidates
          if str(row["sourceVersionId"]) == source_version
          and str(row["identity"]) == identity
        ), None)
        if declared is None:
          continue
        horizon = int(declared["horizonH4"])
        profile = _build_reaction_path(outcome, candles, candle_times, atr_values)
        status = "unavailable"
        final_atr = mfe_atr = mae_atr = None
        completion_time = None
        if profile is not None:
          completion_time = (
            int(profile["candles"][horizon - 1]["time"]) + H4_SECONDS
            if len(profile["candles"]) >= horizon else None
          )
          if completion_time is not None and completion_time <= now:
            status = "resolved"
            final_atr = (
              float(profile["sign"])
              * (float(profile["candles"][horizon - 1]["close"]) - float(profile["entry"]))
              / float(profile["atr"])
            )
            mfe_atr = max(float(value) for value in profile["favorable"][:horizon])
            mae_atr = max(float(value) for value in profile["adverse"][:horizon])
          else:
            status = "pending"
        events = list(outcome.get("events") or [])
        seen_times = [
          first_seen.get((int(event["id"]), int(event["time"])))
          for event in events if event.get("id") is not None and event.get("time") is not None
        ]
        observation = {
          "id": canonical_hash({
            "challengeHash": challenge["challengeHash"],
            "market": market,
            "identity": identity,
            "eventTime": event_time,
          })[:20],
          "candidateRowId": declared["rowId"],
          "market": market,
          "identity": identity,
          "family": declared["family"],
          "classification": declared["classification"],
          "eventTime": event_time,
          "firstSeenAt": max((value for value in seen_times if value is not None), default=None),
          "direction": outcome.get("direction"),
          "horizonH4": horizon,
          "completionTime": completion_time,
          "status": status,
          "respected": None if final_atr is None else final_atr > 0,
          "finalAtr": final_atr,
          "mfeAtr": mfe_atr,
          "maeAtr": mae_atr,
          "titles": sorted({str(event.get("title") or "") for event in events if event.get("title")}),
        }
        if status == "resolved":
          durable_key = f"fms_event_respect_observation:v1:{observation['id']}"
          frozen = {**observation, "resolvedAt": now}
          record = {
            "schema": "fms-event-respect-observation-record-v1",
            "challengeHash": challenge["challengeHash"],
            "observation": frozen,
          }
          record["recordHash"] = canonical_hash(record)
          durable = json.loads(store.set_metadata_if_absent(
            durable_key, json.dumps(record, sort_keys=True, separators=(",", ":"))
          ))
          if (
            not isinstance(durable, dict)
            or durable.get("challengeHash") != challenge["challengeHash"]
            or not isinstance(durable.get("observation"), dict)
          ):
            raise ValueError(f"Stored prospective observation conflicts with {observation['id']}")
          observation = durable["observation"]
        output_rows.append(observation)
  output_rows.sort(key=lambda row: (int(row["eventTime"]), str(row["market"]), str(row["identity"])))
  resolved = [row for row in output_rows if row["status"] == "resolved"]
  return {
    "schema": "fms-event-respect-prospective-observations-v1",
    "campaignManifestHash": manifest["manifestHash"],
    "challengeHash": challenge["challengeHash"],
    "activation": activation,
    "asOf": now,
    "watchedCandidateCount": len(watched),
    "observationCount": len(output_rows),
    "pendingCount": sum(row["status"] == "pending" for row in output_rows),
    "resolvedCount": len(resolved),
    "unavailableCount": sum(row["status"] == "unavailable" for row in output_rows),
    "respectedCount": sum(row["respected"] is True for row in resolved),
    "rows": output_rows,
    "executionAttached": False,
    "disclosure": "Direction-only prospective observations. They are not trade signals and have no SL, TP, or order action.",
  }
