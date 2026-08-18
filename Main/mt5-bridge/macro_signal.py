from __future__ import annotations

import hashlib
import json
import math
import re
import statistics
from bisect import bisect_right
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterable, List, Literal, Optional, Sequence, Tuple


VERSION_ID = "FMS-EURUSD-ECO-H4-v1"
VERSION_CREATED_AT = 1786982400  # 2026-08-18 00:00:00 UTC
V2_VERSION_ID = "FMS-EURUSD-LABOR-H4-v2"
V2_VERSION_CREATED_AT = 1787045252  # 2026-08-18 09:27:32 UTC
ACTIVE_VERSION_ID = V2_VERSION_ID
RESULT_SCHEMA_VERSION = 3
H4_SECONDS = 4 * 60 * 60
PRIMARY_WINDOW_DAYS = 3652
RECENT_WINDOW_DAYS = 1826
HOLDING_CANDLES = 30
ATR_PERIOD = 14
TARGET_R_VALUES = (1.0, 1.5, 2.0)
DEVELOPMENT_SHARE = 0.70

ELIGIBILITY_GATE = {
  "targetR": 2.0,
  "minimumHoldoutEvaluable": 30,
  "minimumCoverageDays": 1826,
  "maximumAmbiguousRate": 0.05,
  "requirePrimaryPriceCoverage": True,
  "requirePositiveDevelopmentExpectancy": True,
  "requirePositiveHoldoutExpectancyLower95": True,
}

FORWARD_PAPER_GATE = {
  "minimumElapsedDays": 365,
  "minimumEvaluable": 100,
  "maximumAmbiguousRate": 0.05,
  "requirePositiveExpectancyLower95": True,
  "costModelRequiredBeforeCharts": True,
}


@dataclass(frozen=True)
class EconomyRule:
  id: str
  label: str
  factor: str
  score_group: str
  direction: Literal["higher_is_better", "lower_is_better"]
  include_any: Tuple[str, ...]
  exclude_any: Tuple[str, ...] = ()


ECONOMY_RULES: Tuple[EconomyRule, ...] = (
  EconomyRule("unemployment", "Unemployment", "labor", "unemployment", "lower_is_better", ("unemployment rate",)),
  EconomyRule(
    "labor_claims", "Labor claims", "labor", "labor_claims", "lower_is_better",
    ("jobless claims", "unemployment claims", "initial claims", "continuing claims", "claimant count", "jobseekers total"),
  ),
  EconomyRule(
    "labor_wages", "Wages", "labor", "labor_wages", "higher_is_better",
    ("average hourly earnings", "average weekly earnings", "wage", "earnings", "labor cash earnings", "labour cash earnings"),
    ("real earnings",),
  ),
  EconomyRule(
    "employment", "Employment", "labor", "employment", "higher_is_better",
    ("nonfarm payroll", "payroll employment", "employment change", "employment rate", "adp employment"),
    ("unemployment",),
  ),
  EconomyRule(
    "gdp", "GDP", "activity", "gdp", "higher_is_better",
    ("gdp", "gross domestic product"), ("price index", "price deflator", "deflator"),
  ),
  EconomyRule(
    "composite_activity_survey", "Composite activity survey", "activity", "pmi_composite", "higher_is_better",
    ("composite pmi", "composite purchasing managers index"),
  ),
  EconomyRule(
    "services_activity_survey", "Services activity survey", "activity", "pmi_services", "higher_is_better",
    ("services pmi", "service pmi", "ism services", "ism non manufacturing", "non manufacturing pmi"),
  ),
  EconomyRule(
    "manufacturing_activity_survey", "Manufacturing activity survey", "activity", "pmi_manufacturing", "higher_is_better",
    ("manufacturing pmi", "ism manufacturing", "manufacturing purchasing managers index"),
  ),
  EconomyRule(
    "generic_activity_survey", "Activity survey", "activity", "pmi_other", "higher_is_better",
    ("pmi", "purchasing managers index"),
  ),
  EconomyRule(
    "core_retail_demand", "Core retail demand", "retail", "retail_core", "higher_is_better",
    ("retail control", "retail sales excl", "retail sales ex"),
  ),
  EconomyRule(
    "headline_retail_demand", "Retail demand", "retail", "retail_headline", "higher_is_better",
    ("retail sales", "electronic card retail", "consumer spending", "card spending"),
    ("excl", "excluding", "control"),
  ),
  EconomyRule(
    "consumer_sentiment", "Consumer sentiment", "sentiment", "consumer_sentiment", "higher_is_better",
    ("consumer confidence", "consumer sentiment"), ("inflation expectation",),
  ),
  EconomyRule(
    "business_sentiment", "Business sentiment", "sentiment", "business_sentiment", "higher_is_better",
    ("business confidence", "business climate", "economic sentiment", "zew economic sentiment", "ifo business climate", "sentix"),
    ("inflation expectation",),
  ),
  EconomyRule(
    "trade_balance", "Trade balance", "trade", "trade_balance", "higher_is_better",
    ("trade balance", "goods trade balance", "merchandise trade", "terms of trade"),
  ),
  EconomyRule(
    "current_account", "Current account", "trade", "current_account", "higher_is_better",
    ("current account",),
  ),
)


VERSION_CONFIGURATION: Dict[str, Any] = {
  "id": VERSION_ID,
  "symbol": "EURUSD",
  "timeframe": "H4",
  "candidateClock": "exact_release_package",
  "pillar": "economy",
  "entry": "first_h4_open_strictly_after_release",
  "atr": {"period": ATR_PERIOD, "method": "wilder_rma", "completedCandlesOnly": True},
  "stopAtr": 1.0,
  "targetsR": list(TARGET_R_VALUES),
  "holdingCandles": HOLDING_CANDLES,
  "overlap": "independent",
  "intrabarResolution": "m1_then_ambiguous",
  "costs": "excluded",
  "developmentShare": DEVELOPMENT_SHARE,
  "primaryWindowDays": PRIMARY_WINDOW_DAYS,
  "eligibilityGate": ELIGIBILITY_GATE,
  "rules": [
    {
      "id": rule.id,
      "label": rule.label,
      "factor": rule.factor,
      "scoreGroup": rule.score_group,
      "direction": rule.direction,
      "includeAny": list(rule.include_any),
      "excludeAny": list(rule.exclude_any),
    }
    for rule in ECONOMY_RULES
  ],
}
VERSION_HASH = hashlib.sha256(
  json.dumps(VERSION_CONFIGURATION, sort_keys=True, separators=(",", ":")).encode("utf-8")
).hexdigest()

V2_VERSION_CONFIGURATION: Dict[str, Any] = {
  **{key: value for key, value in VERSION_CONFIGURATION.items() if key not in {"id", "pillar", "rules", "eligibilityGate"}},
  "id": V2_VERSION_ID,
  "pillar": "labor_only",
  "seriesIdentity": "currency_country_code_normalized_title",
  "countryScope": {"EUR": ["EU"], "USD": ["US"]},
  "selectionDisclosure": "Labor was selected after inspecting v1, including its holdout. All pre-registration history is exploratory reused data.",
  "historicalEligibility": "disabled_due_to_reused_history",
  "forwardPaperStart": V2_VERSION_CREATED_AT,
  "forwardPaperGate": FORWARD_PAPER_GATE,
  "rules": [
    {
      "id": rule.id,
      "label": rule.label,
      "factor": rule.factor,
      "scoreGroup": rule.score_group,
      "direction": rule.direction,
      "includeAny": list(rule.include_any),
      "excludeAny": list(rule.exclude_any),
    }
    for rule in ECONOMY_RULES
    if rule.factor == "labor"
  ],
}
V2_VERSION_HASH = hashlib.sha256(
  json.dumps(V2_VERSION_CONFIGURATION, sort_keys=True, separators=(",", ":")).encode("utf-8")
).hexdigest()


@dataclass(frozen=True)
class SignalDefinition:
  id: str
  created_at: int
  configuration: Dict[str, Any]
  configuration_hash: str
  allowed_factors: Optional[frozenset[str]]
  country_aware_series: bool
  historical_gate_allowed: bool
  country_scope: Optional[Dict[str, frozenset[str]]]


SIGNAL_DEFINITIONS: Dict[str, SignalDefinition] = {
  VERSION_ID: SignalDefinition(
    VERSION_ID, VERSION_CREATED_AT, VERSION_CONFIGURATION, VERSION_HASH, None, False, True, None,
  ),
  V2_VERSION_ID: SignalDefinition(
    V2_VERSION_ID,
    V2_VERSION_CREATED_AT,
    V2_VERSION_CONFIGURATION,
    V2_VERSION_HASH,
    frozenset({"labor"}),
    True,
    False,
    {"EUR": frozenset({"EU"}), "USD": frozenset({"US"})},
  ),
}


def get_signal_definition(version_id: str) -> Optional[SignalDefinition]:
  return SIGNAL_DEFINITIONS.get(version_id)


SOURCE_VALUE_RE = re.compile(r"^([+-]?\d+(?:\.\d+)?)\s*(%|[kmbt])?$", re.IGNORECASE)


def normalize_title(value: str) -> str:
  return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", value.lower())).strip()


def parse_source_value(value: Any) -> Optional[Tuple[float, Optional[str]]]:
  if value is None:
    return None
  match = SOURCE_VALUE_RE.match(str(value).strip().replace(",", ""))
  if not match:
    return None
  numeric = float(match.group(1))
  if not math.isfinite(numeric):
    return None
  suffix = match.group(2).upper() if match.group(2) else None
  return numeric, suffix


def compare_source_values(left: Any, right: Any) -> Optional[int]:
  left_value = parse_source_value(left)
  right_value = parse_source_value(right)
  if left_value is None or right_value is None:
    return None
  if left_value[1] and right_value[1] and left_value[1] != right_value[1]:
    return None
  if left_value[0] == right_value[0]:
    return 0
  return 1 if left_value[0] > right_value[0] else -1


def find_economy_rule(event: Dict[str, Any]) -> Optional[EconomyRule]:
  if str(event.get("currency", "")).upper() not in {"EUR", "USD"}:
    return None
  title = normalize_title(str(event.get("title", "")))
  for rule in ECONOMY_RULES:
    if any(normalize_title(term) in title for term in rule.exclude_any):
      continue
    if any(normalize_title(term) in title for term in rule.include_any):
      return rule
  return None


def _orient(point: Optional[int], rule: EconomyRule) -> Optional[int]:
  if point is None:
    return None
  return -point if rule.direction == "lower_is_better" else point


def score_event(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
  rule = find_economy_rule(event)
  if rule is None:
    return None
  surprise = _orient(compare_source_values(event.get("actual"), event.get("forecast")), rule)
  momentum = _orient(compare_source_values(event.get("actual"), event.get("previous")), rule)
  if surprise is None and momentum is None:
    return None
  agreement = surprise if surprise is not None and surprise != 0 and surprise == momentum else 0
  score = (surprise or 0) + (momentum or 0) + agreement
  return {
    "id": int(event["id"]),
    "time": int(event["time"]),
    "currency": str(event["currency"]).upper(),
    "countryCode": str(event.get("countryCode", "")).upper(),
    "title": str(event["title"]),
    "impact": str(event.get("impact", "low")).lower(),
    "actual": event.get("actual"),
    "forecast": event.get("forecast"),
    "previous": event.get("previous"),
    "ruleId": rule.id,
    "ruleLabel": rule.label,
    "factor": rule.factor,
    "scoreGroup": rule.score_group,
    "surprisePoint": surprise,
    "momentumPoint": momentum,
    "agreementBonus": agreement,
    "score": score,
  }


def _sign(value: float) -> int:
  return 1 if value > 0 else -1 if value < 0 else 0


def _clamp_group(value: int) -> int:
  return max(-3, min(3, value))


def _build_factor_votes(scored_events: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
  group_scores: Dict[Tuple[str, str, str], int] = {}
  for event in scored_events:
    key = (event["currency"], event["factor"], event["scoreGroup"])
    group_scores[key] = _clamp_group(group_scores.get(key, 0) + int(event["score"]))

  factor_scores: Dict[Tuple[str, str], int] = {}
  for (currency, factor, _group), group_score in group_scores.items():
    key = (currency, factor)
    factor_scores[key] = factor_scores.get(key, 0) + group_score

  return [
    {
      "currency": currency,
      "factor": factor,
      "score": score,
      "vote": _sign(score),
      "pairVote": _sign(score) if currency == "EUR" else -_sign(score),
    }
    for (currency, factor), score in sorted(factor_scores.items())
  ]


def _series_identity(event: Dict[str, Any], country_aware: bool) -> Tuple[str, ...]:
  currency = str(event.get("currency", "")).upper()
  title = normalize_title(str(event.get("title", "")))
  if country_aware:
    return currency, str(event.get("countryCode", "")).upper(), title
  return currency, title


def _event_belongs_to_definition(event: Dict[str, Any], definition: SignalDefinition) -> bool:
  rule = find_economy_rule(event)
  if rule is None:
    return False
  if definition.allowed_factors is not None and rule.factor not in definition.allowed_factors:
    return False
  if definition.country_scope is not None:
    currency = str(event.get("currency", "")).upper()
    allowed_countries = definition.country_scope.get(currency)
    if allowed_countries is None or str(event.get("countryCode", "")).upper() not in allowed_countries:
      return False
  return True


def build_signal_candidates(
  events: Sequence[Dict[str, Any]],
  now: Optional[int] = None,
  definition: Optional[SignalDefinition] = None,
) -> List[Dict[str, Any]]:
  selected_definition = definition or SIGNAL_DEFINITIONS[VERSION_ID]
  cutoff = now if now is not None else int(datetime.now(timezone.utc).timestamp())
  packages: Dict[int, List[Dict[str, Any]]] = {}
  for event in events:
    event_time = int(event.get("time", 0))
    if event_time > cutoff:
      continue
    if not _event_belongs_to_definition(event, selected_definition):
      continue
    scored = score_event(event)
    if scored is None:
      continue
    packages.setdefault(event_time, []).append(scored)

  candidates: List[Dict[str, Any]] = []
  latest_series: Dict[Tuple[str, ...], Dict[str, Any]] = {}
  for event_time, scored_events in sorted(packages.items()):
    background_cutoff = event_time - 90 * 24 * 60 * 60
    background_events = [
      event for event in latest_series.values()
      if int(event["time"]) >= background_cutoff
    ]
    background_factor_votes = _build_factor_votes(background_events)
    background_pair_vote = sum(vote["pairVote"] for vote in background_factor_votes if vote["pairVote"] != 0)
    background_direction = "long" if background_pair_vote > 0 else "short" if background_pair_vote < 0 else "none"

    factor_votes = _build_factor_votes(scored_events)
    nonzero_pair_votes = [vote["pairVote"] for vote in factor_votes if vote["pairVote"] != 0]
    pair_vote = sum(nonzero_pair_votes)
    if pair_vote > 0:
      direction = "long"
    elif pair_vote < 0:
      direction = "short"
    else:
      direction = "none"
    if not nonzero_pair_votes or pair_vote == 0:
      agreement = "no_direction"
    elif all(vote == nonzero_pair_votes[0] for vote in nonzero_pair_votes):
      agreement = "consensus"
    else:
      agreement = "conflicted_weak"

    if direction == "none" or background_direction == "none":
      background_alignment = "neutral"
    elif direction == background_direction:
      background_alignment = "aligned"
    else:
      background_alignment = "conflicted"

    candidates.append({
      "eventTime": event_time,
      "direction": direction,
      "agreement": agreement,
      "pairVote": pair_vote,
      "factorVotes": factor_votes,
      "backgroundDirection": background_direction,
      "backgroundPairVote": background_pair_vote,
      "backgroundAlignment": background_alignment,
      "events": sorted(scored_events, key=lambda event: (event["currency"], event["factor"], event["title"], event["id"])),
      "highestImpact": _highest_impact(event["impact"] for event in scored_events),
    })
    for event in scored_events:
      latest_series[_series_identity(event, selected_definition.country_aware_series)] = event
  return candidates


def _highest_impact(impacts: Iterable[str]) -> str:
  rank = {"low": 0, "medium": 1, "high": 2}
  return max(impacts, key=lambda impact: rank.get(impact, 0), default="low")


def calculate_atr_by_candle(candles: Sequence[Dict[str, Any]], period: int = ATR_PERIOD) -> List[Optional[float]]:
  result: List[Optional[float]] = [None] * len(candles)
  if len(candles) < period + 1:
    return result
  true_ranges: List[float] = []
  for index in range(1, len(candles)):
    candle = candles[index]
    previous = candles[index - 1]
    true_ranges.append(max(
      float(candle["high"]) - float(candle["low"]),
      abs(float(candle["high"]) - float(previous["close"])),
      abs(float(candle["low"]) - float(previous["close"])),
    ))
  atr = sum(true_ranges[:period]) / period
  result[period] = atr
  for tr_index in range(period, len(true_ranges)):
    atr = (atr * (period - 1) + true_ranges[tr_index]) / period
    result[tr_index + 1] = atr
  return result


M1Provider = Callable[[int, int], Sequence[Dict[str, Any]]]


def _bar_touches(candle: Dict[str, Any], direction: str, stop: float, target: float) -> Tuple[bool, bool]:
  if direction == "long":
    return float(candle["low"]) <= stop, float(candle["high"]) >= target
  return float(candle["high"]) >= stop, float(candle["low"]) <= target


def _resolve_m1_order(
  candles: Sequence[Dict[str, Any]], direction: str, stop: float, target: float,
) -> Optional[str]:
  for candle in sorted(candles, key=lambda item: int(item["time"])):
    stop_hit, target_hit = _bar_touches(candle, direction, stop, target)
    if stop_hit and target_hit:
      return "ambiguous"
    if stop_hit:
      return "stop_hit"
    if target_hit:
      return "target_hit"
  return None


def evaluate_candidate(
  candidate: Dict[str, Any],
  candles: Sequence[Dict[str, Any]],
  candle_times: Sequence[int],
  atr_values: Sequence[Optional[float]],
  target_r: float,
  m1_provider: Optional[M1Provider] = None,
  allow_pending: bool = False,
  as_of: Optional[int] = None,
) -> Dict[str, Any]:
  base = {
    "eventTime": candidate["eventTime"],
    "direction": candidate["direction"],
    "agreement": candidate["agreement"],
    "pairVote": candidate["pairVote"],
    "backgroundDirection": candidate["backgroundDirection"],
    "backgroundPairVote": candidate["backgroundPairVote"],
    "backgroundAlignment": candidate["backgroundAlignment"],
    "highestImpact": candidate["highestImpact"],
    "targetR": target_r,
    "factorVotes": candidate["factorVotes"],
    "events": candidate["events"],
  }
  if candidate["direction"] == "none":
    return {**base, "status": "no_direction", "resultR": None, "reason": "Exact factor-vote tie"}

  entry_index = bisect_right(candle_times, int(candidate["eventTime"]))
  if entry_index <= 0:
    return {**base, "status": "unevaluable", "resultR": None, "reason": "No strictly later H4 entry candle"}
  if entry_index >= len(candles):
    if allow_pending:
      return {**base, "status": "pending", "resultR": None, "reason": "Waiting for the first strictly later H4 entry candle"}
    return {**base, "status": "unevaluable", "resultR": None, "reason": "No strictly later H4 entry candle"}
  atr = atr_values[entry_index - 1]
  if atr is None or not math.isfinite(atr) or atr <= 0:
    return {**base, "status": "unevaluable", "resultR": None, "reason": "Insufficient completed H4 candles for ATR(14)"}
  final_index = entry_index + HOLDING_CANDLES - 1
  if final_index >= len(candles) and not allow_pending:
    return {**base, "status": "unevaluable", "resultR": None, "reason": "Incomplete 30-candle outcome window"}

  entry = float(candles[entry_index]["open"])
  direction_sign = 1.0 if candidate["direction"] == "long" else -1.0
  stop = entry - direction_sign * atr
  target = entry + direction_sign * atr * target_r
  detail = {
    **base,
    "entryTime": int(candles[entry_index]["time"]),
    "entry": entry,
    "atr": atr,
    "stop": stop,
    "target": target,
  }

  available_final_index = min(final_index, len(candles) - 1)
  for index in range(entry_index, available_final_index + 1):
    candle = candles[index]
    stop_hit, target_hit = _bar_touches(candle, candidate["direction"], stop, target)
    if stop_hit and target_hit:
      end_time = int(candles[index + 1]["time"]) if index + 1 < len(candles) else int(candle["time"]) + H4_SECONDS
      minute_candles = m1_provider(int(candle["time"]), end_time) if m1_provider else []
      resolved = _resolve_m1_order(minute_candles, candidate["direction"], stop, target)
      if resolved == "stop_hit":
        return {**detail, "status": "stop_hit", "resultR": -1.0, "exitTime": int(candle["time"]), "reason": "M1 resolved stop first"}
      if resolved == "target_hit":
        return {**detail, "status": "target_hit", "resultR": target_r, "exitTime": int(candle["time"]), "reason": "M1 resolved target first"}
      return {**detail, "status": "ambiguous", "resultR": None, "exitTime": int(candle["time"]), "reason": "Both touched — order unknown"}
    if stop_hit:
      return {**detail, "status": "stop_hit", "resultR": -1.0, "exitTime": int(candle["time"]), "reason": "H4 stop first"}
    if target_hit:
      return {**detail, "status": "target_hit", "resultR": target_r, "exitTime": int(candle["time"]), "reason": "H4 target first"}

  observation_time = as_of if as_of is not None else int(datetime.now(timezone.utc).timestamp())
  final_candle_complete = (
    final_index < len(candles)
    and int(candles[final_index]["time"]) + H4_SECONDS <= observation_time
  )
  if allow_pending and not final_candle_complete:
    return {
      **detail,
      "status": "pending",
      "resultR": None,
      "reason": "Monitoring the open 30-candle paper outcome window",
    }

  expiry_candle = candles[final_index]
  expiry_r = direction_sign * (float(expiry_candle["close"]) - entry) / atr
  return {
    **detail,
    "status": "expired",
    "resultR": expiry_r,
    "exitTime": int(expiry_candle["time"]) + H4_SECONDS,
    "reason": "Expired after 30 completed H4 candles",
  }


def _mean_ci95(values: Sequence[float]) -> Optional[Dict[str, float]]:
  if not values:
    return None
  mean = statistics.fmean(values)
  if len(values) < 2:
    return {"lower": mean, "upper": mean}
  margin = 1.96 * statistics.stdev(values) / math.sqrt(len(values))
  return {"lower": mean - margin, "upper": mean + margin}


def _wilson_ci(wins: int, total: int) -> Optional[Dict[str, float]]:
  if total <= 0:
    return None
  z = 1.96
  p = wins / total
  denominator = 1 + z * z / total
  center = (p + z * z / (2 * total)) / denominator
  margin = z * math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denominator
  return {"lower": max(0.0, center - margin), "upper": min(1.0, center + margin)}


def aggregate_outcomes(outcomes: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
  attempted = [outcome for outcome in outcomes if outcome["status"] != "no_direction"]
  evaluable = [outcome for outcome in attempted if outcome["status"] in {"target_hit", "stop_hit", "expired"}]
  results = [float(outcome["resultR"]) for outcome in evaluable if outcome.get("resultR") is not None]
  wins = sum(outcome["status"] == "target_hit" for outcome in evaluable)
  losses = sum(outcome["status"] == "stop_hit" for outcome in evaluable)
  expired = sum(outcome["status"] == "expired" for outcome in evaluable)
  ambiguous = sum(outcome["status"] == "ambiguous" for outcome in attempted)
  unevaluable = sum(outcome["status"] == "unevaluable" for outcome in attempted)
  pending = sum(outcome["status"] == "pending" for outcome in attempted)
  total = len(evaluable)
  return {
    "candidateCount": len(outcomes),
    "directionalCount": len(attempted),
    "evaluableCount": total,
    "targetHitCount": wins,
    "stopHitCount": losses,
    "expiredCount": expired,
    "ambiguousCount": ambiguous,
    "unevaluableCount": unevaluable,
    "pendingCount": pending,
    "targetHitRate": wins / total if total else None,
    "stopHitRate": losses / total if total else None,
    "expiredRate": expired / total if total else None,
    "ambiguousRate": ambiguous / len(attempted) if attempted else None,
    "averageR": statistics.fmean(results) if results else None,
    "medianR": statistics.median(results) if results else None,
    "expectancyCi95": _mean_ci95(results),
    "targetHitCi95": _wilson_ci(wins, total),
  }


def _timestamp_year(timestamp: int) -> int:
  return datetime.fromtimestamp(timestamp, tz=timezone.utc).year


def _filtered_outcomes(outcomes: Sequence[Dict[str, Any]], start: Optional[int], end: Optional[int]) -> List[Dict[str, Any]]:
  return [
    outcome for outcome in outcomes
    if (start is None or int(outcome["eventTime"]) >= start)
    and (end is None or int(outcome["eventTime"]) < end)
  ]


def _cohort_rows(
  outcomes: Sequence[Dict[str, Any]],
  key_fn: Callable[[Dict[str, Any]], Iterable[str]],
  split_time: Optional[int] = None,
) -> List[Dict[str, Any]]:
  groups: Dict[str, List[Dict[str, Any]]] = {}
  for outcome in outcomes:
    for key in key_fn(outcome):
      groups.setdefault(key, []).append(outcome)
  return [
    {
      "key": key,
      "metrics": aggregate_outcomes(rows),
      "development": aggregate_outcomes(_filtered_outcomes(rows, None, split_time)) if split_time is not None else None,
      "holdout": aggregate_outcomes(_filtered_outcomes(rows, split_time, None)) if split_time is not None else None,
    }
    for key, rows in sorted(groups.items(), key=lambda item: (-len(item[1]), item[0]))
  ]


def build_data_quality_audit(
  events: Sequence[Dict[str, Any]],
  candidates: Sequence[Dict[str, Any]],
  generated_at: int,
  definition: Optional[SignalDefinition] = None,
) -> Dict[str, Any]:
  selected_definition = definition or SIGNAL_DEFINITIONS[VERSION_ID]
  pair_rows = [event for event in events if str(event.get("currency", "")).upper() in {"EUR", "USD"}]
  historical_rows = [event for event in pair_rows if int(event.get("time", 0)) <= generated_at]
  future_rows = [event for event in pair_rows if int(event.get("time", 0)) > generated_at]
  registered_rows = [event for event in historical_rows if _event_belongs_to_definition(event, selected_definition)]
  scored_rows = [event for event in registered_rows if score_event(event) is not None]
  exact_keys: Dict[Tuple[str, str, int], int] = {}
  collision_rows: Dict[Tuple[str, str, int], List[Dict[str, Any]]] = {}
  factor_counts: Dict[str, int] = {}
  for event in registered_rows:
    rule = find_economy_rule(event)
    if rule is not None:
      factor_counts[rule.factor] = factor_counts.get(rule.factor, 0) + 1
    key = (
      str(event.get("currency", "")).upper(),
      normalize_title(str(event.get("title", ""))),
      int(event.get("time", 0)),
    )
    exact_keys[key] = exact_keys.get(key, 0) + 1
    collision_rows.setdefault(key, []).append(event)

  def missing(event: Dict[str, Any], key: str) -> bool:
    return not str(event.get(key) or "").strip()

  def unparsable_present(event: Dict[str, Any], key: str) -> bool:
    value = event.get(key)
    return bool(str(value or "").strip()) and parse_source_value(value) is None

  collision_groups = [
    {
      "currency": key[0],
      "normalizedTitle": key[1],
      "title": sorted({str(event.get("title", "")) for event in rows})[0],
      "time": key[2],
      "rows": len(rows),
      "countryCodes": sorted({str(event.get("countryCode", "")).upper() for event in rows}),
    }
    for key, rows in collision_rows.items()
    if len(rows) > 1
  ]
  collision_groups.sort(key=lambda row: (-int(row["rows"]), -int(row["time"]), str(row["title"])))
  collision_excess = sum(max(0, count - 1) for count in exact_keys.values())

  return {
    "pairRows": len(pair_rows),
    "historicalRows": len(historical_rows),
    "futureScheduledRows": len(future_rows),
    "registeredEconomyRows": len(registered_rows),
    "scoredEconomyRows": len(scored_rows),
    "unregisteredHistoricalRows": len(historical_rows) - len(registered_rows),
    "candidatePackages": len(candidates),
    "missingActualRows": sum(missing(event, "actual") for event in registered_rows),
    "missingForecastRows": sum(missing(event, "forecast") for event in registered_rows),
    "missingPreviousRows": sum(missing(event, "previous") for event in registered_rows),
    "unparsableActualRows": sum(unparsable_present(event, "actual") for event in registered_rows),
    "unparsableForecastRows": sum(unparsable_present(event, "forecast") for event in registered_rows),
    "unparsablePreviousRows": sum(unparsable_present(event, "previous") for event in registered_rows),
    "duplicateExactSeriesTimestampRows": collision_excess,
    "countryTitleCollisionRows": collision_excess,
    "countryTitleCollisionGroups": collision_groups[:50],
    "seriesIdentity": "currency + country/region + title" if selected_definition.country_aware_series else "currency + title (legacy v1)",
    "countryScope": selected_definition.configuration.get("countryScope", "all EUR/USD country sources"),
    "registeredByFactor": [
      {"factor": factor, "rows": count}
      for factor, count in sorted(factor_counts.items())
    ],
  }


def build_backtest_result(
  events: Sequence[Dict[str, Any]],
  h4_candles: Sequence[Dict[str, Any]],
  m1_provider: Optional[M1Provider],
  coverage: Dict[str, Any],
  generated_at: int,
  definition: Optional[SignalDefinition] = None,
) -> Dict[str, Any]:
  selected_definition = definition or SIGNAL_DEFINITIONS[VERSION_ID]
  candles = sorted(h4_candles, key=lambda candle: int(candle["time"]))
  candle_times = [int(candle["time"]) for candle in candles]
  atr_values = calculate_atr_by_candle(candles)
  candidates = build_signal_candidates(events, now=generated_at, definition=selected_definition)
  directional = [candidate for candidate in candidates if candidate["direction"] != "none"]
  latest_event = max((int(candidate["eventTime"]) for candidate in candidates), default=None)
  primary_start = latest_event - PRIMARY_WINDOW_DAYS * 86400 if latest_event is not None else None
  primary_candidates = [candidate for candidate in directional if primary_start is None or int(candidate["eventTime"]) >= primary_start]
  split_index = max(1, min(len(primary_candidates) - 1, math.floor(len(primary_candidates) * DEVELOPMENT_SHARE))) if len(primary_candidates) >= 2 else len(primary_candidates)
  split_time = int(primary_candidates[split_index]["eventTime"]) if split_index < len(primary_candidates) else None

  target_results: Dict[str, Any] = {}
  all_primary_outcomes: Dict[float, List[Dict[str, Any]]] = {}
  all_outcomes_by_target: Dict[float, List[Dict[str, Any]]] = {}
  for target_r in TARGET_R_VALUES:
    outcomes = [
      evaluate_candidate(candidate, candles, candle_times, atr_values, target_r, m1_provider)
      for candidate in candidates
    ]
    all_outcomes_by_target[target_r] = outcomes
    primary = _filtered_outcomes(outcomes, primary_start, None)
    development = _filtered_outcomes(primary, None, split_time)
    holdout = _filtered_outcomes(primary, split_time, None) if split_time is not None else []
    all_primary_outcomes[target_r] = primary
    target_results[str(target_r)] = {
      "overall": aggregate_outcomes(primary),
      "development": aggregate_outcomes(development),
      "holdout": aggregate_outcomes(holdout),
      "outcomes": primary,
    }

  highlighted = target_results["2.0"]
  development_metrics = highlighted["development"]
  holdout_metrics = highlighted["holdout"]
  coverage_earliest = coverage.get("earliest")
  coverage_latest = coverage.get("latest")
  coverage_days = (
    max(0, (int(coverage_latest) - int(coverage_earliest)) // 86400)
    if coverage_earliest is not None and coverage_latest is not None else 0
  )
  price_earliest = int(candles[0]["time"]) if candles else None
  price_latest = int(candles[-1]["time"]) if candles else None
  required_price_start = primary_start - (ATR_PERIOD + 1) * H4_SECONDS if primary_start is not None else None
  price_coverage_ok = (
    price_earliest is not None
    and price_latest is not None
    and required_price_start is not None
    and price_earliest <= required_price_start
    and latest_event is not None
    and price_latest >= min(latest_event, generated_at)
  )
  holdout_ci = holdout_metrics.get("expectancyCi95") or {}
  checks = {
    "coverage": coverage_days >= ELIGIBILITY_GATE["minimumCoverageDays"],
    "priceCoverage": price_coverage_ok,
    "holdoutSample": holdout_metrics["evaluableCount"] >= ELIGIBILITY_GATE["minimumHoldoutEvaluable"],
    "developmentExpectancy": development_metrics["averageR"] is not None and development_metrics["averageR"] > 0,
    "holdoutExpectancyLower95": holdout_ci.get("lower") is not None and holdout_ci["lower"] > 0,
    "ambiguity": (holdout_metrics["ambiguousRate"] or 0) <= ELIGIBILITY_GATE["maximumAmbiguousRate"],
  }
  historical_gate_passed = all(checks.values())
  eligible = historical_gate_passed and selected_definition.historical_gate_allowed

  recent_start = latest_event - RECENT_WINDOW_DAYS * 86400 if latest_event is not None else None
  earlier_start = latest_event - PRIMARY_WINDOW_DAYS * 86400 if latest_event is not None else None
  robustness = {}
  highlighted_primary = all_primary_outcomes[2.0]
  if latest_event is not None:
    robustness = {
      "latestFiveYears": aggregate_outcomes(_filtered_outcomes(highlighted_primary, recent_start, None)),
      "earlierFiveYears": aggregate_outcomes(_filtered_outcomes(highlighted_primary, earlier_start, recent_start)),
    }
  all_outcomes_2r = all_outcomes_by_target[2.0]
  robustness["fullAvailable"] = aggregate_outcomes(all_outcomes_2r)
  robustness["byYear"] = [
    {"year": year, "metrics": aggregate_outcomes([row for row in all_outcomes_2r if _timestamp_year(int(row["eventTime"])) == year])}
    for year in sorted({_timestamp_year(int(row["eventTime"])) for row in all_outcomes_2r})
  ]

  cohorts = {
    "agreement": _cohort_rows(highlighted_primary, lambda outcome: [str(outcome["agreement"])], split_time),
    "backgroundAlignment": _cohort_rows(highlighted_primary, lambda outcome: [str(outcome["backgroundAlignment"])], split_time),
    "direction": _cohort_rows(highlighted_primary, lambda outcome: [str(outcome["direction"])], split_time),
    "impact": _cohort_rows(highlighted_primary, lambda outcome: [str(outcome["highestImpact"])], split_time),
    "factor": _cohort_rows(highlighted_primary, lambda outcome: {str(vote["factor"]) for vote in outcome["factorVotes"]}, split_time),
    "exactSeries": _cohort_rows(
      highlighted_primary,
      lambda outcome: {f"{event['currency']} · {event['title']}" for event in outcome["events"]},
      split_time,
    ),
  }
  factor_leads = [
    {
      "key": row["key"],
      "developmentAverageR": row["development"]["averageR"],
      "holdoutAverageR": row["holdout"]["averageR"],
      "developmentN": row["development"]["evaluableCount"],
      "holdoutN": row["holdout"]["evaluableCount"],
    }
    for row in cohorts["factor"]
    if row["development"] is not None
    and row["holdout"] is not None
    and row["development"]["evaluableCount"] >= 30
    and row["holdout"]["evaluableCount"] >= 30
    and row["development"]["averageR"] is not None
    and row["holdout"]["averageR"] is not None
    and row["development"]["averageR"] > 0
    and row["holdout"]["averageR"] > 0
  ]
  forward_outcomes = _filtered_outcomes(highlighted_primary, selected_definition.created_at, None)
  forward_metrics = aggregate_outcomes(forward_outcomes)
  forward_ci = forward_metrics.get("expectancyCi95") or {}
  forward_elapsed_days = max(0, (generated_at - selected_definition.created_at) // 86400)
  forward_checks = {
    "elapsedTime": forward_elapsed_days >= FORWARD_PAPER_GATE["minimumElapsedDays"],
    "sample": forward_metrics["evaluableCount"] >= FORWARD_PAPER_GATE["minimumEvaluable"],
    "expectancyLower95": forward_ci.get("lower") is not None and forward_ci["lower"] > 0,
    "ambiguity": (forward_metrics["ambiguousRate"] or 0) <= FORWARD_PAPER_GATE["maximumAmbiguousRate"],
    "costModel": False,
  }
  forward_eligible = all(forward_checks.values())

  is_reused_history = not selected_definition.historical_gate_allowed
  conclusion_code = (
    "forward_paper_validated" if forward_eligible
    else "forward_observation_required" if is_reused_history
    else "eligible_for_paper_validation" if eligible
    else "no_validated_edge"
  )
  conclusion_title = (
    "Forward paper gate passed" if forward_eligible
    else "Exploratory history only — forward evidence required" if is_reused_history
    else "Eligible for paper validation" if eligible
    else "No validated edge in frozen v1"
  )
  conclusion_summary = (
    "The forward gate passed, but Charts still require an approved cost model and explicit product review."
    if forward_eligible else
    "This version was designed after v1 history was inspected. Past results can guide research but cannot validate it; only post-registration observations count."
    if is_reused_history else
    "The predeclared research gate passed. This permits forward paper validation, not chart signals or live orders."
    if eligible else
    "The frozen Economy-only rule did not pass its predeclared holdout gate. It must not be placed on Charts."
  )
  conclusion = {
    "code": conclusion_code,
    "title": conclusion_title,
    "summary": conclusion_summary,
    "developmentAverageR": development_metrics["averageR"],
    "holdoutAverageR": holdout_metrics["averageR"],
    "holdoutExpectancyCi95": holdout_metrics["expectancyCi95"],
    "exploratoryFactorLeads": factor_leads if selected_definition.id == VERSION_ID else [],
    "selectionWarning": "Exploratory leads were noticed after viewing v1 and are not untouched validation evidence.",
  }

  return {
    "resultSchemaVersion": RESULT_SCHEMA_VERSION,
    "versionId": selected_definition.id,
    "versionHash": selected_definition.configuration_hash,
    "generatedAt": generated_at,
    "symbol": "EURUSD",
    "timeframe": "H4",
    "status": "eligible_for_paper_validation" if eligible else "exploratory_reused_history" if is_reused_history else "research",
    "costs": "Gross simulation; spread, slippage, swap, and commission are excluded.",
    "coverage": {**coverage, "coverageDays": coverage_days},
    "priceCoverage": {
      "count": len(candles),
      "earliest": price_earliest,
      "latest": price_latest,
      "coversPrimaryWindow": price_coverage_ok,
    },
    "candidateSummary": {
      "allPackages": len(candidates),
      "directional": len(directional),
      "noDirection": len(candidates) - len(directional),
      "primaryWindowStart": primary_start,
      "developmentHoldoutBoundary": split_time,
    },
    "targets": target_results,
    "eligibility": {
      "eligible": eligible,
      "checks": {**checks, **({"untouchedHistoricalHoldout": False} if is_reused_history else {})},
      "gate": ELIGIBILITY_GATE,
      "historicalGatePassed": historical_gate_passed,
      "historicalEligibilityDisabled": is_reused_history,
    },
    "forwardPaper": {
      "start": selected_definition.created_at,
      "elapsedDays": forward_elapsed_days,
      "metrics": forward_metrics,
      "checks": forward_checks,
      "gate": FORWARD_PAPER_GATE,
      "eligible": forward_eligible,
      "outcomes": forward_outcomes,
    },
    "robustness": robustness,
    "cohorts": cohorts,
    "dataQuality": build_data_quality_audit(events, candidates, generated_at, selected_definition),
    "conclusion": conclusion,
    "limitations": [
      "Hypothetical results do not represent executed trades.",
      "Broker Previous values may already contain revisions; this is not guaranteed vintage data.",
      "Independent overlapping cases are research observations, not a portfolio simulation.",
      "Economic evidence and subsequent price behavior do not prove causation.",
    ],
  }


def dataset_fingerprint(
  events: Sequence[Dict[str, Any]],
  definition: Optional[SignalDefinition] = None,
) -> str:
  selected_definition = definition or SIGNAL_DEFINITIONS[VERSION_ID]
  relevant = [
    {
      "id": int(event["id"]),
      "time": int(event["time"]),
      "currency": str(event.get("currency", "")),
      "countryCode": str(event.get("countryCode", "")),
      "title": str(event.get("title", "")),
      "impact": str(event.get("impact", "")),
      "actual": event.get("actual"),
      "forecast": event.get("forecast"),
      "previous": event.get("previous"),
    }
    for event in events
    if _event_belongs_to_definition(event, selected_definition)
  ]
  payload = {"versionHash": selected_definition.configuration_hash, "events": relevant}
  return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
