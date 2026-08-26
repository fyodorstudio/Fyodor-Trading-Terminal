from __future__ import annotations

import hashlib
import json
import math
import re
import statistics
from bisect import bisect_right
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Callable, Dict, Iterable, List, Literal, Optional, Sequence, Tuple


VERSION_ID = "FMS-EURUSD-ECO-H4-v1"
VERSION_CREATED_AT = 1786982400  # 2026-08-18 00:00:00 UTC
V2_VERSION_ID = "FMS-EURUSD-LABOR-H4-v2"
V2_VERSION_CREATED_AT = 1787045252  # 2026-08-18 09:27:32 UTC
SENTIMENT_VERSION_ID = "FMS-EURUSD-SENTIMENT-H4-v3"
SENTIMENT_VERSION_CREATED_AT = 1787232138  # 2026-08-20 13:22:18 UTC
POLICY_INFLATION_VERSION_ID = "FMS-EURUSD-POLICY-INFL-H4-v5"
POLICY_INFLATION_VERSION_CREATED_AT = 1787234220  # 2026-08-20 13:57:00 UTC
GROWTH_VERSION_ID = "FMS-EURUSD-GROWTH-H4-v7"
GROWTH_VERSION_CREATED_AT = 1787237834  # 2026-08-20 14:57:14 UTC
ACTIVE_VERSION_ID = V2_VERSION_ID
RESULT_SCHEMA_VERSION = 3
H4_SECONDS = 4 * 60 * 60
PRIMARY_WINDOW_DAYS = 3652
RECENT_WINDOW_DAYS = 1826
HOLDING_CANDLES = 30
ATR_PERIOD = 14
TARGET_R_VALUES = (1.0, 1.5, 2.0)
DEVELOPMENT_SHARE = 0.70
CHART_SIGNAL_EXECUTION_STRESS_PIPS = 3.0
PATH_RESEARCH_HORIZON = 30
PATH_RESEARCH_MAX_HORIZON = 60
PATH_RESEARCH_THRESHOLDS_R = (0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0)
STRESS_STOP_ATR_VALUES = (0.5, 0.75, 1.0, 1.25, 1.5, 2.0)
STRESS_TARGET_R_VALUES = PATH_RESEARCH_THRESHOLDS_R
STRESS_HOLDING_CANDLES = (6, 12, 18, 30, 42, 60)
STRESS_MINIMUM_SIGNATURE_CASES = 10
CANDIDATE_STRESS_SCHEMA_VERSION = 8
NUMERIC_ROBUSTNESS_VERSION_ID = "FMS-EURUSD-NUMERIC-ROBUST-H4-v11"
V12_CHALLENGER_VERSION_ID = "FMS-EURUSD-FORECAST-ROBUST-H4-v12"
FORECAST_QUALITY_MINIMUM_HISTORY = 12
FORECAST_QUALITY_MAD_MULTIPLIER = 6.0
FORECAST_QUALITY_SCALE_MULTIPLIER = 4.0

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
  direction: Literal["higher_is_better", "lower_is_better", "higher_is_hotter", "policy_action"]
  include_any: Tuple[str, ...]
  exclude_any: Tuple[str, ...] = ()
  currencies: Tuple[str, ...] = ()


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

POLICY_INFLATION_RULES: Tuple[EconomyRule, ...] = (
  EconomyRule(
    "core_consumer_inflation", "Core consumer inflation", "inflation", "core_consumer_inflation", "higher_is_hotter",
    ("core cpi", "core hicp", "core pce", "trimmed mean cpi", "weighted median cpi", "median cpi"),
    ("expectation",),
  ),
  EconomyRule(
    "producer_inflation", "Producer inflation", "inflation", "producer_inflation", "higher_is_hotter",
    ("ppi", "producer price"), ("expectation",),
  ),
  EconomyRule(
    "headline_consumer_inflation", "Headline consumer inflation", "inflation", "headline_consumer_inflation", "higher_is_hotter",
    ("cpi", "hicp", "cpih", "consumer price", "pce price", "inflation rate"),
    ("core", "trimmed", "median", "producer", "ppi", "expectation"),
  ),
  EconomyRule(
    "usd_primary_policy_rate", "Fed policy rate", "policy", "primary_policy_rate", "policy_action",
    ("fed interest rate decision", "federal funds rate decision", "fomc interest rate decision"),
    ("statement", "minutes", "conference", "speech", "testimony"), ("USD",),
  ),
  EconomyRule(
    "eur_primary_policy_rate", "ECB deposit facility rate", "policy", "primary_policy_rate", "policy_action",
    ("ecb deposit facility rate decision", "deposit facility rate decision"),
    ("statement", "minutes", "conference", "speech"), ("EUR",),
  ),
)
GROWTH_RULES: Tuple[EconomyRule, ...] = (
  EconomyRule(
    "growth_gdp", "GDP growth", "activity", "gdp", "higher_is_better",
    ("gdp", "gross domestic product"), ("price index", "price deflator", "deflator"),
  ),
  EconomyRule(
    "growth_composite_pmi", "Composite PMI", "activity", "pmi_composite", "higher_is_better",
    ("composite pmi", "composite purchasing managers index"),
  ),
  EconomyRule(
    "growth_services_pmi", "Services PMI/ISM", "activity", "pmi_services", "higher_is_better",
    ("services pmi", "service pmi", "ism services", "ism non manufacturing", "non manufacturing pmi"),
  ),
  EconomyRule(
    "growth_manufacturing_pmi", "Manufacturing PMI/ISM", "activity", "pmi_manufacturing", "higher_is_better",
    ("manufacturing pmi", "ism manufacturing", "manufacturing purchasing managers index"),
  ),
  EconomyRule(
    "growth_industrial_output", "Industrial output", "activity", "industrial_output", "higher_is_better",
    ("industrial production", "industrial output", "factory output"), ("price", "ppi"),
  ),
  EconomyRule(
    "growth_core_retail", "Core retail demand", "retail", "retail_core", "higher_is_better",
    ("retail control", "retail sales excl", "retail sales ex"),
  ),
  EconomyRule(
    "growth_headline_retail", "Retail demand", "retail", "retail_headline", "higher_is_better",
    ("retail sales", "consumer spending"), ("excl", "excluding", "control"),
  ),
  EconomyRule(
    "growth_trade_balance", "Trade balance", "trade", "trade_balance", "higher_is_better",
    ("trade balance", "goods trade balance", "merchandise trade"), ("terms of trade",),
  ),
  EconomyRule(
    "growth_current_account", "Current account", "trade", "current_account", "higher_is_better",
    ("current account",),
  ),
)
ALL_SIGNAL_RULES = (*ECONOMY_RULES, *POLICY_INFLATION_RULES, *GROWTH_RULES)


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

SENTIMENT_VERSION_CONFIGURATION: Dict[str, Any] = {
  **{key: value for key, value in VERSION_CONFIGURATION.items() if key not in {"id", "pillar", "rules", "eligibilityGate"}},
  "id": SENTIMENT_VERSION_ID,
  "pillar": "sentiment_only",
  "seriesIdentity": "currency_country_code_normalized_title",
  "countryScope": {"EUR": ["EU"], "USD": ["US"]},
  "selectionDisclosure": "Directional Euro-area consumer sentiment was selected after inspecting existing archive research. All pre-registration history is exploratory reused data.",
  "historicalEligibility": "disabled_due_to_reused_history",
  "forwardPaperStart": SENTIMENT_VERSION_CREATED_AT,
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
    if rule.factor == "sentiment"
  ],
}
SENTIMENT_VERSION_HASH = hashlib.sha256(
  json.dumps(SENTIMENT_VERSION_CONFIGURATION, sort_keys=True, separators=(",", ":")).encode("utf-8")
).hexdigest()

POLICY_INFLATION_VERSION_CONFIGURATION: Dict[str, Any] = {
  **{key: value for key, value in VERSION_CONFIGURATION.items() if key not in {"id", "pillar", "rules", "eligibilityGate"}},
  "id": POLICY_INFLATION_VERSION_ID,
  "pillar": "policy_inflation_context",
  "seriesIdentity": "currency_country_code_normalized_title",
  "countryScope": {"EUR": ["EU"], "USD": ["US"]},
  "deduplicateExactSeriesTimestamp": True,
  "selectionDisclosure": "Inflation and policy families were tested after v4 archive inspection. All pre-registration results are exploratory reused history.",
  "historicalEligibility": "disabled_due_to_reused_history",
  "forwardPaperStart": POLICY_INFLATION_VERSION_CREATED_AT,
  "forwardPaperGate": FORWARD_PAPER_GATE,
  "interpretation": {
    "inflation": "Higher source values are hotter; EUR heat points Long and USD heat points Short before any context filter.",
    "policy": "A higher canonical decision value is tighter; unchanged decisions are neutral unless a numeric forecast supplies a surprise.",
    "communications": "Statements, minutes, conferences, testimony, and speeches are not numerically scored.",
  },
  "rules": [
    {
      "id": rule.id,
      "label": rule.label,
      "factor": rule.factor,
      "scoreGroup": rule.score_group,
      "direction": rule.direction,
      "includeAny": list(rule.include_any),
      "excludeAny": list(rule.exclude_any),
      "currencies": list(rule.currencies),
    }
    for rule in POLICY_INFLATION_RULES
  ],
}
POLICY_INFLATION_VERSION_HASH = hashlib.sha256(
  json.dumps(POLICY_INFLATION_VERSION_CONFIGURATION, sort_keys=True, separators=(",", ":")).encode("utf-8")
).hexdigest()

GROWTH_VERSION_CONFIGURATION: Dict[str, Any] = {
  **{key: value for key, value in VERSION_CONFIGURATION.items() if key not in {"id", "pillar", "rules", "eligibilityGate"}},
  "id": GROWTH_VERSION_ID,
  "pillar": "country_aware_growth",
  "seriesIdentity": "currency_country_code_normalized_title",
  "countryScope": {"EUR": ["EU"], "USD": ["US"]},
  "deduplicateExactSeriesTimestamp": True,
  "selectionDisclosure": "GDP/output, strict PMI/ISM, retail demand, and trade/current-account rules were frozen before inspecting v7 results. Pre-registration history remains exploratory reused data.",
  "historicalEligibility": "disabled_due_to_reused_history",
  "forwardPaperStart": GROWTH_VERSION_CREATED_AT,
  "forwardPaperGate": FORWARD_PAPER_GATE,
  "exclusions": [
    "GDP price indexes and deflators",
    "generic or regional manufacturing surveys that are not explicit PMI/ISM",
    "terms of trade",
    "unrelated consumer-card proxies",
  ],
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
    for rule in GROWTH_RULES
  ],
}
GROWTH_VERSION_HASH = hashlib.sha256(
  json.dumps(GROWTH_VERSION_CONFIGURATION, sort_keys=True, separators=(",", ":")).encode("utf-8")
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
  rule_ids: Optional[frozenset[str]] = None


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
  SENTIMENT_VERSION_ID: SignalDefinition(
    SENTIMENT_VERSION_ID,
    SENTIMENT_VERSION_CREATED_AT,
    SENTIMENT_VERSION_CONFIGURATION,
    SENTIMENT_VERSION_HASH,
    frozenset({"sentiment"}),
    True,
    False,
    {"EUR": frozenset({"EU"}), "USD": frozenset({"US"})},
  ),
  POLICY_INFLATION_VERSION_ID: SignalDefinition(
    POLICY_INFLATION_VERSION_ID,
    POLICY_INFLATION_VERSION_CREATED_AT,
    POLICY_INFLATION_VERSION_CONFIGURATION,
    POLICY_INFLATION_VERSION_HASH,
    frozenset({"inflation", "policy"}),
    True,
    False,
    {"EUR": frozenset({"EU"}), "USD": frozenset({"US"})},
    frozenset(rule.id for rule in POLICY_INFLATION_RULES),
  ),
  GROWTH_VERSION_ID: SignalDefinition(
    GROWTH_VERSION_ID,
    GROWTH_VERSION_CREATED_AT,
    GROWTH_VERSION_CONFIGURATION,
    GROWTH_VERSION_HASH,
    frozenset({"activity", "retail", "trade"}),
    True,
    False,
    {"EUR": frozenset({"EU"}), "USD": frozenset({"US"})},
    frozenset(rule.id for rule in GROWTH_RULES),
  ),
}


def get_signal_definition(version_id: str) -> Optional[SignalDefinition]:
  return SIGNAL_DEFINITIONS.get(version_id)


SOURCE_VALUE_RE = re.compile(r"^([+-]?\d+(?:\.\d+)?)\s*(%|[kmbt])?$", re.IGNORECASE)


@lru_cache(maxsize=8_192)
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


def compare_source_values_strict(left: Any, right: Any) -> Optional[int]:
  """Compare only like-for-like numeric units for post-v10 challengers."""
  left_value = parse_source_value(left)
  right_value = parse_source_value(right)
  if left_value is None or right_value is None or left_value[1] != right_value[1]:
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


def find_signal_rule(event: Dict[str, Any], definition: SignalDefinition) -> Optional[EconomyRule]:
  currency = str(event.get("currency", "")).upper()
  if currency not in {"EUR", "USD"}:
    return None
  title = normalize_title(str(event.get("title", "")))
  candidates = ALL_SIGNAL_RULES if definition.rule_ids is not None else ECONOMY_RULES
  for rule in candidates:
    if definition.rule_ids is not None and rule.id not in definition.rule_ids:
      continue
    if rule.currencies and currency not in rule.currencies:
      continue
    if any(normalize_title(term) in title for term in rule.exclude_any):
      continue
    if any(normalize_title(term) in title for term in rule.include_any):
      return rule
  return None


def _orient(point: Optional[int], rule: EconomyRule) -> Optional[int]:
  if point is None:
    return None
  return -point if rule.direction == "lower_is_better" else point


def score_event(event: Dict[str, Any], definition: Optional[SignalDefinition] = None) -> Optional[Dict[str, Any]]:
  rule = find_signal_rule(event, definition) if definition is not None else find_economy_rule(event)
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
  rule = find_signal_rule(event, definition)
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
  candidate_events: Sequence[Dict[str, Any]] = events
  if selected_definition.configuration.get("deduplicateExactSeriesTimestamp"):
    deduplicated: Dict[Tuple[Any, ...], Dict[str, Any]] = {}
    for event in events:
      key = (int(event.get("time", 0)), *_series_identity(event, selected_definition.country_aware_series))
      current = deduplicated.get(key)
      quality = sum(bool(str(event.get(field) or "").strip()) for field in ("actual", "forecast", "previous"))
      current_quality = sum(bool(str(current.get(field) or "").strip()) for field in ("actual", "forecast", "previous")) if current else -1
      if current is None or (quality, int(event.get("id", 0))) > (current_quality, int(current.get("id", 0))):
        deduplicated[key] = event
    candidate_events = list(deduplicated.values())
  for event in candidate_events:
    event_time = int(event.get("time", 0))
    if event_time > cutoff:
      continue
    if not _event_belongs_to_definition(event, selected_definition):
      continue
    scored = score_event(event, selected_definition)
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
  stop_atr: float = 1.0,
  holding_candles: int = HOLDING_CANDLES,
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
    "stopAtr": stop_atr,
    "expiryCandles": holding_candles,
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
  final_index = entry_index + holding_candles - 1
  if final_index >= len(candles) and not allow_pending:
    return {**base, "status": "unevaluable", "resultR": None, "reason": f"Incomplete {holding_candles}-candle outcome window"}

  entry = float(candles[entry_index]["open"])
  direction_sign = 1.0 if candidate["direction"] == "long" else -1.0
  risk_distance = atr * stop_atr
  stop = entry - direction_sign * risk_distance
  target = entry + direction_sign * risk_distance * target_r
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
      "reason": f"Monitoring the open {holding_candles}-candle paper outcome window",
    }

  expiry_candle = candles[final_index]
  expiry_r = direction_sign * (float(expiry_candle["close"]) - entry) / risk_distance
  return {
    **detail,
    "status": "expired",
    "resultR": expiry_r,
    "exitTime": int(expiry_candle["time"]) + H4_SECONDS,
    "reason": f"Expired after {holding_candles} completed H4 candles",
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


def _quantile(values: Sequence[float], probability: float) -> Optional[float]:
  if not values:
    return None
  ordered = sorted(float(value) for value in values)
  if len(ordered) == 1:
    return ordered[0]
  position = max(0.0, min(1.0, probability)) * (len(ordered) - 1)
  lower = math.floor(position)
  upper = math.ceil(position)
  if lower == upper:
    return ordered[lower]
  weight = position - lower
  return ordered[lower] * (1 - weight) + ordered[upper] * weight


def _path_distribution(values: Sequence[float]) -> Dict[str, Optional[float]]:
  if not values:
    return {"minimum": None, "p25": None, "median": None, "mean": None, "p75": None, "p90": None, "maximum": None}
  return {
    "minimum": min(values),
    "p25": _quantile(values, 0.25),
    "median": statistics.median(values),
    "mean": statistics.fmean(values),
    "p75": _quantile(values, 0.75),
    "p90": _quantile(values, 0.90),
    "maximum": max(values),
  }


def build_candidate_path_profile(
  outcome: Dict[str, Any],
  candles: Sequence[Dict[str, Any]],
  candle_times: Sequence[int],
  maximum_holding_candles: int = PATH_RESEARCH_MAX_HORIZON,
) -> Optional[Dict[str, Any]]:
  """Measure the post-entry path in baseline one-ATR units without choosing an exit."""
  entry_time = outcome.get("entryTime")
  entry = outcome.get("entry")
  atr = outcome.get("atr")
  direction = str(outcome.get("direction", ""))
  if entry_time is None or entry is None or atr is None or direction not in {"long", "short"}:
    return None
  atr_value = float(atr)
  if not math.isfinite(atr_value) or atr_value <= 0:
    return None
  entry_index = bisect_right(candle_times, int(entry_time) - 1)
  if entry_index >= len(candles) or int(candles[entry_index]["time"]) != int(entry_time):
    return None
  window = list(candles[entry_index:entry_index + maximum_holding_candles])
  if not window:
    return None
  entry_value = float(entry)
  sign = 1.0 if direction == "long" else -1.0
  favorable = [
    max(0.0, (float(candle["high"]) - entry_value) / atr_value)
    if sign > 0 else max(0.0, (entry_value - float(candle["low"])) / atr_value)
    for candle in window
  ]
  adverse = [
    max(0.0, (entry_value - float(candle["low"])) / atr_value)
    if sign > 0 else max(0.0, (float(candle["high"]) - entry_value) / atr_value)
    for candle in window
  ]
  return {
    "outcome": outcome,
    "eventTime": int(outcome["eventTime"]),
    "entryTime": int(entry_time),
    "entry": entry_value,
    "atr": atr_value,
    "direction": direction,
    "sign": sign,
    "candles": window,
    "favorable": favorable,
    "adverse": adverse,
  }


def summarize_candidate_paths(
  profiles: Sequence[Dict[str, Any]],
  holding_candles: int = PATH_RESEARCH_HORIZON,
) -> Dict[str, Any]:
  eligible = [profile for profile in profiles if len(profile["candles"]) >= holding_candles]
  mfe_values: List[float] = []
  mae_values: List[float] = []
  time_to_mfe: List[float] = []
  time_to_mae: List[float] = []
  adverse_before_favorable = 0
  for profile in eligible:
    favorable = profile["favorable"][:holding_candles]
    adverse = profile["adverse"][:holding_candles]
    mfe = max(favorable)
    mae = max(adverse)
    mfe_index = favorable.index(mfe) + 1
    mae_index = adverse.index(mae) + 1
    mfe_values.append(mfe)
    mae_values.append(mae)
    time_to_mfe.append(float(mfe_index))
    time_to_mae.append(float(mae_index))
    adverse_before_favorable += mae_index < mfe_index
  count = len(eligible)
  return {
    "holdingCandles": holding_candles,
    "evaluableCount": count,
    "mfeR": _path_distribution(mfe_values),
    "maeR": _path_distribution(mae_values),
    "timeToMfeCandles": _path_distribution(time_to_mfe),
    "timeToMaeCandles": _path_distribution(time_to_mae),
    "adverseBeforeFavorableRate": adverse_before_favorable / count if count else None,
    "thresholdReach": [
      {
        "thresholdR": threshold,
        "count": sum(value >= threshold for value in mfe_values),
        "rate": sum(value >= threshold for value in mfe_values) / count if count else None,
      }
      for threshold in PATH_RESEARCH_THRESHOLDS_R
    ],
  }


def simulate_candidate_path(
  profile: Dict[str, Any],
  stop_atr: float,
  target_r: float,
  holding_candles: int,
  stress_pips: float = CHART_SIGNAL_EXECUTION_STRESS_PIPS,
) -> Dict[str, Any]:
  if len(profile["candles"]) < holding_candles:
    return {"status": "unevaluable", "grossResultR": None, "stressedResultR": None, "exitTime": None}
  entry = float(profile["entry"])
  atr = float(profile["atr"])
  sign = float(profile["sign"])
  risk_distance = atr * stop_atr
  stop = entry - sign * risk_distance
  target = entry + sign * risk_distance * target_r
  for candle in profile["candles"][:holding_candles]:
    stop_hit, target_hit = _bar_touches(candle, profile["direction"], stop, target)
    if stop_hit and target_hit:
      return {"status": "ambiguous", "grossResultR": None, "stressedResultR": None, "exitTime": int(candle["time"])}
    if stop_hit:
      gross = -1.0
      return {"status": "stop_hit", "grossResultR": gross, "stressedResultR": gross - stress_pips * 0.0001 / risk_distance, "exitTime": int(candle["time"])}
    if target_hit:
      gross = target_r
      return {"status": "target_hit", "grossResultR": gross, "stressedResultR": gross - stress_pips * 0.0001 / risk_distance, "exitTime": int(candle["time"])}
  final_close = float(profile["candles"][holding_candles - 1]["close"])
  gross = sign * (final_close - entry) / risk_distance
  return {"status": "expired", "grossResultR": gross, "stressedResultR": gross - stress_pips * 0.0001 / risk_distance, "exitTime": int(profile["candles"][holding_candles - 1]["time"])}


def _aggregate_path_simulations(rows: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
  evaluable = [row for row in rows if row["status"] in {"target_hit", "stop_hit", "expired"}]
  stressed = [float(row["stressedResultR"]) for row in evaluable if row.get("stressedResultR") is not None]
  gross = [float(row["grossResultR"]) for row in evaluable if row.get("grossResultR") is not None]
  count = len(evaluable)
  return {
    "attemptedCount": len(rows),
    "evaluableCount": count,
    "targetHitCount": sum(row["status"] == "target_hit" for row in evaluable),
    "stopHitCount": sum(row["status"] == "stop_hit" for row in evaluable),
    "expiredCount": sum(row["status"] == "expired" for row in evaluable),
    "ambiguousCount": sum(row["status"] == "ambiguous" for row in rows),
    "unevaluableCount": sum(row["status"] == "unevaluable" for row in rows),
    "targetHitRate": sum(row["status"] == "target_hit" for row in evaluable) / count if count else None,
    "stopHitRate": sum(row["status"] == "stop_hit" for row in evaluable) / count if count else None,
    "expiredRate": sum(row["status"] == "expired" for row in evaluable) / count if count else None,
    "ambiguousRate": sum(row["status"] == "ambiguous" for row in rows) / len(rows) if rows else None,
    "grossAverageR": statistics.fmean(gross) if gross else None,
    "stressedAverageR": statistics.fmean(stressed) if stressed else None,
    "stressedMedianR": statistics.median(stressed) if stressed else None,
    "stressedExpectancyCi95": _mean_ci95(stressed),
  }


def _evaluate_path_configuration(
  profiles: Sequence[Dict[str, Any]],
  split_time: int,
  latest_event_time: int,
  stop_atr: float,
  target_r: float,
  holding_candles: int,
) -> Dict[str, Any]:
  simulations = _simulate_path_configuration(profiles, stop_atr, target_r, holding_candles)
  return _summarize_path_configuration(
    simulations, split_time, latest_event_time, stop_atr, target_r, holding_candles
  )


def _simulate_path_configuration(
  profiles: Sequence[Dict[str, Any]],
  stop_atr: float,
  target_r: float,
  holding_candles: int,
) -> List[Dict[str, Any]]:
  return [
    {
      **simulate_candidate_path(profile, stop_atr, target_r, holding_candles),
      "eventTime": int(profile["eventTime"]),
      "direction": str(profile["direction"]),
      "signature": str(profile["outcome"].get("signature", "")),
      "numericRobustness": dict(profile["outcome"].get("numericRobustness", {})),
    }
    for profile in profiles
  ]


def _summarize_path_configuration(
  simulations: Sequence[Dict[str, Any]],
  split_time: int,
  latest_event_time: int,
  stop_atr: float,
  target_r: float,
  holding_candles: int,
) -> Dict[str, Any]:
  development = [row for row in simulations if int(row["eventTime"]) < split_time]
  holdout = [row for row in simulations if int(row["eventTime"]) >= split_time]
  recent_cutoff = latest_event_time - CHART_SIGNAL_RECENT_DAYS * 86400
  recent = [row for row in simulations if int(row["eventTime"]) >= recent_cutoff]
  by_year = []
  for year in sorted({_timestamp_year(int(row["eventTime"])) for row in simulations}):
    metrics = _aggregate_path_simulations([row for row in simulations if _timestamp_year(int(row["eventTime"])) == year])
    by_year.append({"year": year, "metrics": metrics})
  evaluable_years = [row for row in by_year if row["metrics"]["evaluableCount"] > 0]
  positive_years = [row for row in evaluable_years if (row["metrics"]["stressedAverageR"] or 0) > 0]
  return {
    "stopAtr": stop_atr,
    "targetR": target_r,
    "holdingCandles": holding_candles,
    "overall": _aggregate_path_simulations(simulations),
    "development": _aggregate_path_simulations(development),
    "holdout": _aggregate_path_simulations(holdout),
    "recent": _aggregate_path_simulations(recent),
    "yearStability": {
      "evaluableYears": len(evaluable_years),
      "positiveYears": len(positive_years),
      "positiveYearShare": len(positive_years) / len(evaluable_years) if evaluable_years else 0.0,
    },
  }


def _select_stress_configuration(
  configurations: Sequence[Dict[str, Any]],
  case_count: int,
) -> Optional[Dict[str, Any]]:
  selectable = [
    row for row in configurations
    if row["development"]["evaluableCount"] >= CHART_SIGNAL_QUALIFICATION["minimumDevelopmentEvaluable"]
    and (row["development"]["ambiguousRate"] or 0) <= CHART_SIGNAL_QUALIFICATION["maximumAmbiguousRate"]
    and row["development"]["stressedAverageR"] is not None
  ]
  selection_pool = selectable or [
    row for row in configurations
    if row["development"]["evaluableCount"] >= min(10, case_count)
    and row["development"]["stressedAverageR"] is not None
  ]

  def selection_key(row: Dict[str, Any]) -> Tuple[float, float, float, float, float]:
    ci = row["development"].get("stressedExpectancyCi95") or {}
    lower = float(ci.get("lower")) if ci.get("lower") is not None else -999.0
    average = float(row["development"].get("stressedAverageR") or -999.0)
    baseline_distance = (
      abs(float(row["stopAtr"]) - 1.0)
      + abs(float(row["targetR"]) - 2.0)
      + abs(int(row["holdingCandles"]) - 30) / 30
    )
    return lower, average, -baseline_distance, -float(row["stopAtr"]), -float(row["targetR"])

  return max(selection_pool, key=selection_key) if selection_pool else None


def _stress_configuration_checks(selected: Dict[str, Any]) -> Tuple[Dict[str, bool], Dict[str, bool]]:
  checks = {
    "overallSample": selected["overall"]["evaluableCount"] >= CHART_SIGNAL_QUALIFICATION["minimumOverallEvaluable"],
    "developmentSample": selected["development"]["evaluableCount"] >= CHART_SIGNAL_QUALIFICATION["minimumDevelopmentEvaluable"],
    "holdoutSample": selected["holdout"]["evaluableCount"] >= CHART_SIGNAL_QUALIFICATION["minimumHoldoutEvaluable"],
    "recentSample": selected["recent"]["evaluableCount"] >= 10,
    "overallAverageR": (selected["overall"]["stressedAverageR"] or 0) >= CHART_SIGNAL_QUALIFICATION["minimumAverageR"],
    "developmentAverageR": (selected["development"]["stressedAverageR"] or 0) >= CHART_SIGNAL_QUALIFICATION["minimumAverageR"],
    "holdoutAverageR": (selected["holdout"]["stressedAverageR"] or 0) >= CHART_SIGNAL_QUALIFICATION["minimumAverageR"],
    "recentAverageR": (selected["recent"]["stressedAverageR"] or 0) >= CHART_SIGNAL_QUALIFICATION["minimumAverageR"],
    "yearCoverage": selected["yearStability"]["evaluableYears"] >= 8,
    "positiveYearShare": selected["yearStability"]["positiveYearShare"] >= 0.60,
    "ambiguity": (selected["overall"]["ambiguousRate"] or 0) <= CHART_SIGNAL_QUALIFICATION["maximumAmbiguousRate"],
  }
  holdout_ci = selected["holdout"].get("stressedExpectancyCi95") or {}
  return checks, {
    **checks,
    "holdoutLower95Positive": holdout_ci.get("lower") is not None and float(holdout_ci["lower"]) > 0,
  }


def _configuration_stability(
  configurations: Sequence[Dict[str, Any]],
  selected: Dict[str, Any],
) -> Dict[str, Any]:
  """Summarize adjacent declared configurations without using them to select the winner."""
  stop_index = STRESS_STOP_ATR_VALUES.index(float(selected["stopAtr"]))
  target_index = STRESS_TARGET_R_VALUES.index(float(selected["targetR"]))
  holding_index = STRESS_HOLDING_CANDLES.index(int(selected["holdingCandles"]))
  neighbours = [
    row for row in configurations
    if abs(STRESS_STOP_ATR_VALUES.index(float(row["stopAtr"])) - stop_index) <= 1
    and abs(STRESS_TARGET_R_VALUES.index(float(row["targetR"])) - target_index) <= 1
    and abs(STRESS_HOLDING_CANDLES.index(int(row["holdingCandles"])) - holding_index) <= 1
  ]

  def partition_summary(partition: str) -> Dict[str, Any]:
    values = [
      float(row[partition]["stressedAverageR"])
      for row in neighbours
      if row[partition].get("stressedAverageR") is not None
    ]
    return {
      "count": len(values),
      "positiveCount": sum(value > 0 for value in values),
      "positiveShare": sum(value > 0 for value in values) / len(values) if values else None,
      "minimumR": min(values) if values else None,
      "medianR": statistics.median(values) if values else None,
      "maximumR": max(values) if values else None,
    }

  return {
    "neighbourhoodCount": len(neighbours),
    "definition": "selected grid point plus immediately adjacent stop, target, and holding values",
    "development": partition_summary("development"),
    "holdout": partition_summary("holdout"),
    "recent": partition_summary("recent"),
  }


def _rule_by_id(rule_id: str) -> Optional[EconomyRule]:
  return next((rule for rule in ALL_SIGNAL_RULES if rule.id == rule_id), None)


def _annotate_numeric_robustness(outcomes: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
  """Attach only known-at-release numeric audit dimensions to each package.

  Broker Previous is compared with the prior archived Actual from the exact
  currency/country/title series. This cannot recreate a missing vintage, but it
  reveals whether the direction of Momentum depends on the supplied revision.
  """
  latest_actual: Dict[Tuple[str, str, str], Any] = {}
  annotated: List[Dict[str, Any]] = []
  for outcome in sorted(outcomes, key=lambda row: int(row["eventTime"])):
    events: List[Dict[str, Any]] = []
    evidence_modes: List[str] = []
    revision_states: List[str] = []
    pending_actuals: List[Tuple[Tuple[str, str, str], Any]] = []
    for source_event in outcome.get("events", []):
      event = dict(source_event)
      surprise = event.get("surprisePoint")
      momentum = event.get("momentumPoint")
      if surprise is None:
        evidence_modes.append("momentum_only")
      elif momentum is None:
        evidence_modes.append("surprise_only")
      elif surprise != 0 and surprise == momentum:
        evidence_modes.append("agreement")
      elif surprise != 0 and momentum != 0 and surprise == -momentum:
        evidence_modes.append("conflict")
      else:
        evidence_modes.append("mixed_or_zero")

      identity = (
        str(event.get("currency", "")).upper(),
        str(event.get("countryCode", "")).upper(),
        normalize_title(str(event.get("title", ""))),
      )
      archived_point: Optional[int] = None
      prior_actual = latest_actual.get(identity)
      rule = _rule_by_id(str(event.get("ruleId", "")))
      if prior_actual is not None and rule is not None:
        archived_point = _orient(compare_source_values(event.get("actual"), prior_actual), rule)
      if archived_point is None or momentum is None:
        revision_state = "incomplete"
      elif _sign(float(archived_point)) == _sign(float(momentum)):
        revision_state = "robust"
      else:
        revision_state = "sensitive"
      revision_states.append(revision_state)
      event["priorArchivedActual"] = prior_actual
      event["archivedMomentumPoint"] = archived_point
      event["revisionState"] = revision_state
      events.append(event)
      if parse_source_value(event.get("actual")) is not None:
        pending_actuals.append((identity, event.get("actual")))

    for identity, actual in pending_actuals:
      latest_actual[identity] = actual

    if evidence_modes and all(mode == "agreement" for mode in evidence_modes):
      evidence_mode = "agreement"
    elif "conflict" in evidence_modes:
      evidence_mode = "conflict"
    elif evidence_modes and all(mode == "surprise_only" for mode in evidence_modes):
      evidence_mode = "surprise_only"
    elif evidence_modes and all(mode == "momentum_only" for mode in evidence_modes):
      evidence_mode = "momentum_only"
    else:
      evidence_mode = "mixed_or_zero"

    if revision_states and all(state == "robust" for state in revision_states):
      revision_reliability = "robust"
    elif "sensitive" in revision_states:
      revision_reliability = "sensitive"
    else:
      revision_reliability = "incomplete"

    package_score = abs(sum(int(event.get("score", 0)) for event in events))
    score_strength = "strong" if package_score >= 3 else "moderate" if package_score == 2 else "weak"
    annotated.append({
      **outcome,
      "events": events,
      "numericRobustness": {
        "evidenceMode": evidence_mode,
        "revisionReliability": revision_reliability,
        "backgroundAlignment": str(outcome.get("backgroundAlignment", "neutral")),
        "scoreStrength": score_strength,
      },
    })
  return annotated


def _package_completeness(
  outcome: Dict[str, Any],
  pattern: Optional[Dict[str, Any]],
) -> str:
  titles = {
    normalize_title(str(event.get("title", "")))
    for event in outcome.get("events", [])
    if str(event.get("title", "")).strip()
  }
  required_titles = {
    normalize_title(str(title)) for title in (pattern or {}).get("requiredExactTitles", ())
  }
  if required_titles:
    if required_titles.issubset(titles):
      return "full"
    return "single" if len(titles) <= 1 else "partial"
  expected_groups = set(str(outcome.get("signature", "")).split("|")[1:])
  actual_groups = {
    f"{str(event.get('currency', '')).upper()}:{str(event.get('scoreGroup', ''))}"
    for event in outcome.get("events", []) if event.get("scoreGroup")
  }
  if len(titles) <= 1:
    return "single"
  return "full" if not expected_groups or expected_groups.issubset(actual_groups) else "partial"


ROBUSTNESS_DIMENSION_LABELS = {
  "evidenceMode": "S/M evidence",
  "revisionReliability": "Revision reliability",
  "packageCompleteness": "Package completeness",
  "backgroundAlignment": "Before alignment",
  "scoreStrength": "Vote strength",
}


def _build_numeric_robustness_variants(
  profiles: Sequence[Dict[str, Any]],
  base_simulations: Sequence[Tuple[float, float, int, Sequence[Dict[str, Any]]]],
  split_time: int,
  latest_event_time: int,
) -> Tuple[List[Dict[str, Any]], int]:
  variants: List[Dict[str, Any]] = []
  configurations_tested = 0

  def evaluate_variant(
    dimension: str,
    cohort: str,
    selected_profiles: Sequence[Dict[str, Any]],
    reaction: str,
  ) -> None:
    nonlocal configurations_tested
    if len(selected_profiles) < STRESS_MINIMUM_SIGNATURE_CASES:
      return
    selected_ids = {int(profile["eventTime"]) for profile in selected_profiles}
    simulation_grid: List[Tuple[float, float, int, Sequence[Dict[str, Any]]]] = []
    if reaction == "continuation":
      for stop_atr, target_r, holding_candles, simulations in base_simulations:
        filtered = [row for row in simulations if int(row["eventTime"]) in selected_ids]
        simulation_grid.append((stop_atr, target_r, holding_candles, filtered))
    else:
      working_profiles = []
      for profile in selected_profiles:
        outcome = {**profile["outcome"], "direction": "short" if profile["direction"] == "long" else "long"}
        working_profiles.append({
          **profile,
          "outcome": outcome,
          "direction": outcome["direction"],
          "sign": -float(profile["sign"]),
        })
      simulation_grid = [
        (
          stop_atr,
          target_r,
          holding_candles,
          _simulate_path_configuration(working_profiles, stop_atr, target_r, holding_candles),
        )
        for stop_atr in STRESS_STOP_ATR_VALUES
        for target_r in STRESS_TARGET_R_VALUES
        for holding_candles in STRESS_HOLDING_CANDLES
      ]
    configurations_tested += len(simulation_grid)
    selection_rows = [
      {
        "stopAtr": stop_atr,
        "targetR": target_r,
        "holdingCandles": holding_candles,
        "development": _aggregate_path_simulations([
          row for row in simulations if int(row["eventTime"]) < split_time
        ]),
      }
      for stop_atr, target_r, holding_candles, simulations in simulation_grid
    ]
    selected_stub = _select_stress_configuration(selection_rows, len(selected_profiles))
    if selected_stub is None:
      return
    stop_index = STRESS_STOP_ATR_VALUES.index(float(selected_stub["stopAtr"]))
    target_index = STRESS_TARGET_R_VALUES.index(float(selected_stub["targetR"]))
    holding_index = STRESS_HOLDING_CANDLES.index(int(selected_stub["holdingCandles"]))
    neighbour_grid = [
      row for row in simulation_grid
      if abs(STRESS_STOP_ATR_VALUES.index(float(row[0])) - stop_index) <= 1
      and abs(STRESS_TARGET_R_VALUES.index(float(row[1])) - target_index) <= 1
      and abs(STRESS_HOLDING_CANDLES.index(int(row[2])) - holding_index) <= 1
    ]
    configurations = [
      _summarize_path_configuration(
        simulations, split_time, latest_event_time, stop_atr, target_r, holding_candles
      )
      for stop_atr, target_r, holding_candles, simulations in neighbour_grid
    ]
    selected = next(
      row for row in configurations
      if float(row["stopAtr"]) == float(selected_stub["stopAtr"])
      and float(row["targetR"]) == float(selected_stub["targetR"])
      and int(row["holdingCandles"]) == int(selected_stub["holdingCandles"])
    )
    checks, diagnostic_checks = _stress_configuration_checks(selected)
    variants.append({
      "dimension": dimension,
      "dimensionLabel": "Reaction direction" if dimension == "reaction" else ROBUSTNESS_DIMENSION_LABELS[dimension],
      "cohort": cohort,
      "reaction": reaction,
      "cohortFingerprint": hashlib.sha256(
        ",".join(str(value) for value in sorted(selected_ids)).encode("utf-8")
      ).hexdigest()[:12],
      "historicalN": len(selected_profiles),
      "selectedOn": "development_only",
      "selectedConfiguration": selected,
      "configurationStability": _configuration_stability(configurations, selected),
      "checks": diagnostic_checks,
      "passesExploratoryScreen": all(checks.values()),
      "passesStrictHoldoutCheck": all(diagnostic_checks.values()),
    })

  for dimension in ROBUSTNESS_DIMENSION_LABELS:
    categories = sorted({
      str(profile["outcome"].get("numericRobustness", {}).get(dimension, "unknown"))
      for profile in profiles
    })
    for category in categories:
      evaluate_variant(
        dimension,
        category,
        [
          profile for profile in profiles
          if str(profile["outcome"].get("numericRobustness", {}).get(dimension, "unknown")) == category
        ],
        "continuation",
      )
  evaluate_variant("reaction", "continuation", profiles, "continuation")
  evaluate_variant("reaction", "contrarian", profiles, "contrarian")
  variants.sort(key=lambda row: (
    not row["passesExploratoryScreen"],
    -(float(row["selectedConfiguration"]["holdout"].get("stressedAverageR") or -999.0)),
    -int(row["historicalN"]),
    str(row["dimension"]),
    str(row["cohort"]),
  ))
  return variants, configurations_tested


V12_CANDIDATE_DEFINITIONS = (
  {
    "id": "eur-business-sentiment-rejection-long",
    "label": "Euro-area business-sentiment rejection",
    "sourceVersion": SENTIMENT_VERSION_ID,
    "evidenceSignature": "short|EUR:business_sentiment",
    "direction": "long",
    "condition": "Long EURUSD when the selected numeric policy scores an exact Euro-area business-sentiment package as weakening; this is an explicitly contrarian response.",
  },
  {
    "id": "eur-manufacturing-pmi-long",
    "label": "Euro-area manufacturing PMI improvement",
    "sourceVersion": GROWTH_VERSION_ID,
    "evidenceSignature": "long|EUR:pmi_manufacturing",
    "direction": "long",
    "condition": "Long EURUSD when the selected numeric policy scores an exact Euro-area manufacturing-PMI package as improving.",
  },
  {
    "id": "usd-manufacturing-pmi-weakness-long",
    "label": "US manufacturing PMI weakness",
    "sourceVersion": GROWTH_VERSION_ID,
    "evidenceSignature": "long|USD:pmi_manufacturing",
    "direction": "long",
    "condition": "Long EURUSD when the selected numeric policy scores an exact US manufacturing-PMI package as weakening.",
  },
  {
    "id": "usd-consumer-confidence-weakness-long",
    "label": "US consumer-confidence weakness",
    "sourceVersion": SENTIMENT_VERSION_ID,
    "evidenceSignature": "long|USD:consumer_sentiment",
    "direction": "long",
    "requiredTitleTerm": "consumer confidence",
    "condition": "Long EURUSD when the selected numeric policy scores an exact US consumer-confidence package as weakening.",
  },
)


def _strict_numeric_gap(left: Any, right: Any) -> Optional[float]:
  left_value = parse_source_value(left)
  right_value = parse_source_value(right)
  if left_value is None or right_value is None or left_value[1] != right_value[1]:
    return None
  return abs(float(left_value[0]) - float(right_value[0]))


def _raw_source_delta(left: Any, right: Any) -> Optional[str]:
  left_value = parse_source_value(left)
  right_value = parse_source_value(right)
  if left_value is None or right_value is None or left_value[1] != right_value[1]:
    return None
  delta = float(left_value[0]) - float(right_value[0])
  def precision(value: Any) -> int:
    text = str(value).strip().replace(",", "")
    numeric = re.sub(r"[^0-9.+-]", "", text)
    return len(numeric.split(".", 1)[1]) if "." in numeric else 0
  places = min(8, max(precision(left), precision(right)))
  rendered = f"{delta:+.{places}f}" if places else f"{delta:+.0f}"
  if delta == 0:
    rendered = f"{0:.{places}f}" if places else "0"
  suffix = left_value[1]
  return f"{rendered}{'pp' if suffix == '%' else suffix or ''}"


def _linear_quantile(values: Sequence[float], quantile: float) -> float:
  ordered = sorted(float(value) for value in values)
  if not ordered:
    return 0.0
  position = (len(ordered) - 1) * min(1.0, max(0.0, quantile))
  lower = int(math.floor(position))
  upper = int(math.ceil(position))
  if lower == upper:
    return ordered[lower]
  weight = position - lower
  return ordered[lower] * (1.0 - weight) + ordered[upper] * weight


def _rescore_policy_outcomes(
  outcomes: Sequence[Dict[str, Any]],
  policy: str,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
  """Rescore archived packages without mutating the frozen v10 calculation."""
  gap_history: Dict[Tuple[str, str, str], List[float]] = {}
  actual_move_history: Dict[Tuple[str, str, str], List[float]] = {}
  excluded: List[Dict[str, Any]] = []
  rescored: List[Dict[str, Any]] = []
  for source_outcome in sorted(outcomes, key=lambda row: int(row["eventTime"])):
    scored_events: List[Dict[str, Any]] = []
    for source_event in source_outcome.get("events", []):
      event = dict(source_event)
      rule = _rule_by_id(str(event.get("ruleId", "")))
      if rule is None:
        continue
      identity = (
        str(event.get("currency", "")).upper(),
        str(event.get("countryCode", "")).upper(),
        normalize_title(str(event.get("title", ""))),
      )
      prior_gaps = gap_history.setdefault(identity, [])
      prior_actual_moves = actual_move_history.setdefault(identity, [])
      current_gap = _strict_numeric_gap(event.get("forecast"), event.get("previous"))
      current_actual_move = _strict_numeric_gap(event.get("actual"), event.get("previous"))
      suspect = False
      threshold: Optional[float] = None
      if policy == "forecast_quality" and current_gap is not None and len(prior_gaps) >= FORECAST_QUALITY_MINIMUM_HISTORY:
        median_gap = statistics.median(prior_gaps)
        mad = statistics.median(abs(value - median_gap) for value in prior_gaps)
        reference_scale = _linear_quantile([*prior_gaps, *prior_actual_moves], 0.90)
        threshold = max(
          median_gap + FORECAST_QUALITY_MAD_MULTIPLIER * mad,
          FORECAST_QUALITY_SCALE_MULTIPLIER * reference_scale,
        )
        suspect = reference_scale > 0 and current_gap > threshold
      if policy == "baseline":
        surprise = event.get("surprisePoint")
        momentum = event.get("momentumPoint")
      else:
        momentum = _orient(compare_source_values_strict(event.get("actual"), event.get("previous")), rule)
        surprise = None if policy == "momentum_only" or suspect else _orient(
          compare_source_values_strict(event.get("actual"), event.get("forecast")), rule
        )
      if current_gap is not None:
        prior_gaps.append(current_gap)
      if current_actual_move is not None:
        prior_actual_moves.append(current_actual_move)
      if surprise is None and momentum is None:
        continue
      agreement = surprise if surprise is not None and surprise != 0 and surprise == momentum else 0
      score = int(surprise or 0) + int(momentum or 0) + int(agreement)
      event.update({
        "surprisePoint": surprise,
        "momentumPoint": momentum,
        "agreementBonus": agreement,
        "score": score,
        "forecastSuspect": suspect,
        "forecastGap": current_gap,
        "forecastAnomalyThreshold": threshold,
        "scoringPolicy": policy,
      })
      scored_events.append(event)
      if suspect:
        excluded.append({
          "eventTime": int(source_outcome["eventTime"]),
          "currency": identity[0],
          "countryCode": identity[1],
          "title": str(event.get("title", "")),
          "actual": event.get("actual"),
          "forecast": event.get("forecast"),
          "previous": event.get("previous"),
          "gap": current_gap,
          "threshold": threshold,
          "priorCount": len(prior_gaps) - 1,
        })
    factor_votes = _build_factor_votes(scored_events)
    pair_vote = sum(int(vote["pairVote"]) for vote in factor_votes if int(vote["pairVote"]) != 0)
    direction = "long" if pair_vote > 0 else "short" if pair_vote < 0 else "none"
    nonzero = [int(vote["pairVote"]) for vote in factor_votes if int(vote["pairVote"]) != 0]
    agreement_state = "no_direction" if not nonzero or pair_vote == 0 else "consensus" if all(value == nonzero[0] for value in nonzero) else "conflicted_weak"
    rescored.append({
      **source_outcome,
      "direction": direction,
      "pairVote": pair_vote,
      "agreement": agreement_state,
      "factorVotes": factor_votes,
      "events": scored_events,
      "scoringPolicy": policy,
    })
  return rescored, {
    "policy": policy,
    "excludedForecastCount": len(excluded),
    "representativeExclusions": excluded[-12:],
    "minimumHistory": FORECAST_QUALITY_MINIMUM_HISTORY,
    "madMultiplier": FORECAST_QUALITY_MAD_MULTIPLIER,
    "scaleMultiplier": FORECAST_QUALITY_SCALE_MULTIPLIER,
  }


def rescore_forecast_quality_outcomes(
  outcomes: Sequence[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
  """Apply the frozen past-only Forecast guard while preserving every raw value."""
  return _rescore_policy_outcomes(outcomes, "forecast_quality")


def _policy_portfolio_summary(
  rescored_by_source: Dict[str, Tuple[List[Dict[str, Any]], int]],
  candles: Sequence[Dict[str, Any]],
  candle_times: Sequence[int],
  atr_values: Sequence[Optional[float]],
) -> Dict[str, Any]:
  simulations: List[Dict[str, Any]] = []
  latest_event_time = 0
  for source_version, (outcomes, split_time) in rescored_by_source.items():
    patterns = [
      pattern for pattern in CHART_SIGNAL_PATTERN_DEFINITIONS
      if pattern["current"] and str(pattern["sourceVersion"]) == source_version
    ]
    for outcome in outcomes:
      pattern = next((row for row in patterns if candidate_matches_chart_pattern(outcome, row)), None)
      if pattern is None:
        continue
      profile = _build_policy_path_profile(outcome, candles, candle_times, atr_values)
      if profile is None:
        continue
      execution = pattern["execution"]
      simulation = simulate_candidate_path(
        profile, float(execution["stopAtr"]), float(execution["targetR"]), int(execution["expiryCandles"])
      )
      simulations.append({
        **simulation,
        "eventTime": int(outcome["eventTime"]),
        "activationTime": int(profile["entryTime"]),
        "direction": str(outcome["direction"]),
        "patternId": str(pattern["id"]),
        "splitTime": split_time,
        "maximumAdverseR": min(1.0, max([
          adverse for candle, adverse in zip(profile["candles"][:int(execution["expiryCandles"])], profile["adverse"][:int(execution["expiryCandles"])])
          if simulation.get("exitTime") is None or int(candle["time"]) <= int(simulation["exitTime"])
        ], default=0.0) / float(execution["stopAtr"])),
      })
      latest_event_time = max(latest_event_time, int(outcome["eventTime"]))
  development = [row for row in simulations if int(row["eventTime"]) < int(row["splitTime"])]
  holdout = [row for row in simulations if int(row["eventTime"]) >= int(row["splitTime"])]
  recent_cutoff = latest_event_time - CHART_SIGNAL_RECENT_DAYS * 86400
  recent = [row for row in simulations if int(row["eventTime"]) >= recent_cutoff]
  return {
    "signalCount": len(simulations),
    "overall": _aggregate_path_simulations(simulations),
    "development": _aggregate_path_simulations(development),
    "holdout": _aggregate_path_simulations(holdout),
    "recent": _aggregate_path_simulations(recent),
    "sequentialAccount": _sequential_research_account(simulations),
  }


def _sequential_research_account(rows: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
  cumulative_r = 0.0
  peak_r = 0.0
  maximum_drawdown_r = 0.0
  unavailable_until = -1
  taken = 0
  skipped_overlap = 0
  skipped_conflict = 0
  results_r: List[float] = []
  gross_results_r: List[float] = []
  ordered = sorted(rows, key=lambda row: (int(row["activationTime"]), str(row["patternId"])))
  index = 0
  while index < len(ordered):
    activation = int(ordered[index]["activationTime"])
    simultaneous: List[Dict[str, Any]] = []
    while index < len(ordered) and int(ordered[index]["activationTime"]) == activation:
      simultaneous.append(ordered[index])
      index += 1
    if activation < unavailable_until:
      skipped_overlap += len(simultaneous)
      continue
    if len({str(row["direction"]) for row in simultaneous}) > 1:
      skipped_conflict += len(simultaneous)
      continue
    selected = simultaneous[0]
    skipped_overlap += len(simultaneous) - 1
    unavailable_until = int(selected.get("exitTime") or activation)
    intratrade_low = cumulative_r - float(selected.get("maximumAdverseR") or 0)
    maximum_drawdown_r = max(maximum_drawdown_r, peak_r - intratrade_low)
    result = selected.get("stressedResultR")
    if result is None:
      continue
    cumulative_r += float(result)
    results_r.append(float(result))
    if selected.get("grossResultR") is not None:
      gross_results_r.append(float(selected["grossResultR"]))
    peak_r = max(peak_r, cumulative_r)
    maximum_drawdown_r = max(maximum_drawdown_r, peak_r - cumulative_r)
    taken += 1
  return {
    "takenTrades": taken,
    "cumulativeStressedR": cumulative_r,
    "maximumDrawdownR": maximum_drawdown_r,
    "skippedOverlap": skipped_overlap,
    "skippedConflict": skipped_conflict,
    "drawdownBasis": "intratrade_mae_when_available",
    "resultsR": results_r,
    "grossResultsR": gross_results_r,
  }


def _build_policy_path_profile(
  outcome: Dict[str, Any],
  candles: Sequence[Dict[str, Any]],
  candle_times: Sequence[int],
  atr_values: Sequence[Optional[float]],
) -> Optional[Dict[str, Any]]:
  existing = build_candidate_path_profile(outcome, candles, candle_times)
  if existing is not None:
    return existing
  if outcome.get("direction") not in {"long", "short"}:
    return None
  entry_index = bisect_right(candle_times, int(outcome["eventTime"]))
  if entry_index <= 0 or entry_index >= len(candles):
    return None
  atr = atr_values[entry_index - 1]
  if atr is None or float(atr) <= 0:
    return None
  hydrated = {
    **outcome,
    "entryTime": int(candles[entry_index]["time"]),
    "entry": float(candles[entry_index]["open"]),
    "atr": float(atr),
  }
  return build_candidate_path_profile(hydrated, candles, candle_times)


def _prequential_selected_audit(simulations: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
  prior: List[Dict[str, Any]] = []
  qualified: List[Dict[str, Any]] = []
  for row in sorted(simulations, key=lambda item: int(item["eventTime"])):
    prior_metrics = _aggregate_path_simulations(prior)
    if prior_metrics["evaluableCount"] >= 25 and float(prior_metrics.get("stressedAverageR") or 0) >= 0.10:
      qualified.append(row)
    prior.append(row)
  metrics = _aggregate_path_simulations(qualified)
  return {"evaluableCount": metrics["evaluableCount"], "stressedAverageR": metrics["stressedAverageR"]}


def _boundary_inward_check(configurations: Sequence[Dict[str, Any]], selected: Dict[str, Any]) -> Dict[str, Any]:
  stop_index = STRESS_STOP_ATR_VALUES.index(float(selected["stopAtr"]))
  target_index = STRESS_TARGET_R_VALUES.index(float(selected["targetR"]))
  holding_index = STRESS_HOLDING_CANDLES.index(int(selected["holdingCandles"]))
  boundary = stop_index in {0, len(STRESS_STOP_ATR_VALUES) - 1} or target_index in {0, len(STRESS_TARGET_R_VALUES) - 1} or holding_index in {0, len(STRESS_HOLDING_CANDLES) - 1}
  if not boundary:
    return {"required": False, "passed": True, "configuration": None}
  inward = (
    1 if stop_index == 0 else len(STRESS_STOP_ATR_VALUES) - 2 if stop_index == len(STRESS_STOP_ATR_VALUES) - 1 else stop_index,
    1 if target_index == 0 else len(STRESS_TARGET_R_VALUES) - 2 if target_index == len(STRESS_TARGET_R_VALUES) - 1 else target_index,
    1 if holding_index == 0 else len(STRESS_HOLDING_CANDLES) - 2 if holding_index == len(STRESS_HOLDING_CANDLES) - 1 else holding_index,
  )
  row = next((item for item in configurations if (
    float(item["stopAtr"]) == STRESS_STOP_ATR_VALUES[inward[0]]
    and float(item["targetR"]) == STRESS_TARGET_R_VALUES[inward[1]]
    and int(item["holdingCandles"]) == STRESS_HOLDING_CANDLES[inward[2]]
  )), None)
  passed = row is not None and all(float(row[name].get("stressedAverageR") or 0) >= 0.10 for name in ("overall", "development", "holdout", "recent"))
  return {"required": True, "passed": passed, "configuration": row}


def build_v12_challenger_report(
  source_results: Sequence[Dict[str, Any]],
  h4_candles: Sequence[Dict[str, Any]],
  generated_at: int,
) -> Dict[str, Any]:
  candles = sorted(h4_candles, key=lambda candle: int(candle["time"]))
  candle_times = [int(candle["time"]) for candle in candles]
  atr_values = calculate_atr_by_candle(candles)
  policies: Dict[str, Dict[str, Tuple[List[Dict[str, Any]], int]]] = {}
  audits: Dict[str, List[Dict[str, Any]]] = {}
  comparisons: List[Dict[str, Any]] = []
  for policy in ("baseline", "momentum_only", "forecast_quality"):
    by_source: Dict[str, Tuple[List[Dict[str, Any]], int]] = {}
    audits[policy] = []
    for source in source_results:
      rescored, audit = _rescore_policy_outcomes(list(source["outcomes"]), policy)
      by_source[str(source["versionId"])] = (rescored, int(source["splitTime"]))
      audits[policy].append({"sourceVersionId": str(source["versionId"]), **audit})
    policies[policy] = by_source
    comparisons.append({"policy": policy, **_policy_portfolio_summary(by_source, candles, candle_times, atr_values)})
  ranked = sorted(comparisons, key=lambda row: min(
    float(row["holdout"].get("stressedAverageR") or -999.0),
    float(row["recent"].get("stressedAverageR") or -999.0),
  ), reverse=True)
  best = ranked[0]
  momentum = next(row for row in comparisons if row["policy"] == "momentum_only")
  best_holdout = float(best["holdout"].get("stressedAverageR") or -999.0)
  best_recent = float(best["recent"].get("stressedAverageR") or -999.0)
  selected_policy = "momentum_only" if (
    float(momentum["holdout"].get("stressedAverageR") or -999.0) >= best_holdout - 0.03
    and float(momentum["recent"].get("stressedAverageR") or -999.0) >= best_recent - 0.03
  ) else str(best["policy"])

  candidates: List[Dict[str, Any]] = []
  for definition in V12_CANDIDATE_DEFINITIONS:
    source_version = str(definition["sourceVersion"])
    outcomes, split_time = policies[selected_policy][source_version]
    rows = []
    for outcome in outcomes:
      if candidate_pattern_signature(outcome) != str(definition["evidenceSignature"]):
        continue
      required_term = normalize_title(str(definition.get("requiredTitleTerm", "")))
      if required_term and not any(required_term in normalize_title(str(event.get("title", ""))) for event in outcome.get("events", [])):
        continue
      rows.append({**outcome, "direction": str(definition["direction"])})
    profiles = [
      profile for row in rows
      if (profile := _build_policy_path_profile(row, candles, candle_times, atr_values)) is not None
    ]
    configurations = [
      _evaluate_path_configuration(profiles, split_time, max((int(row["eventTime"]) for row in rows), default=generated_at), stop_atr, target_r, holding)
      for stop_atr in STRESS_STOP_ATR_VALUES
      for target_r in STRESS_TARGET_R_VALUES
      for holding in STRESS_HOLDING_CANDLES
    ]
    selected = _select_stress_configuration(configurations, len(profiles))
    if selected is None:
      continue
    simulations = _simulate_path_configuration(profiles, float(selected["stopAtr"]), float(selected["targetR"]), int(selected["holdingCandles"]))
    checks, _strict = _stress_configuration_checks(selected)
    stability = _configuration_stability(configurations, selected)
    prequential = _prequential_selected_audit(simulations)
    boundary = _boundary_inward_check(configurations, selected)
    practical_checks = {
      **checks,
      "historicalN": len(profiles) >= 40,
      "prequential": prequential["evaluableCount"] >= 2 and float(prequential.get("stressedAverageR") or 0) > 0,
      "configurationStability": all(float(stability[name].get("positiveShare") or 0) >= 0.60 for name in ("development", "holdout", "recent")),
      "boundaryInward": bool(boundary["passed"]),
    }
    path = summarize_candidate_paths(profiles, int(selected["holdingCandles"]))
    median_atr_pips = statistics.median(float(profile["atr"]) / 0.0001 for profile in profiles) if profiles else None
    candidates.append({
      **definition,
      "historicalN": len(profiles),
      "selectedConfiguration": selected,
      "configurationStability": stability,
      "prequentialAudit": prequential,
      "boundaryAudit": boundary,
      "path": path,
      "typicalStopPips": median_atr_pips * float(selected["stopAtr"]) if median_atr_pips is not None else None,
      "typicalMfePips": median_atr_pips * float(path["mfeR"]["median"]) if median_atr_pips is not None and path["mfeR"]["median"] is not None else None,
      "typicalMaePips": median_atr_pips * float(path["maeR"]["median"]) if median_atr_pips is not None and path["maeR"]["median"] is not None else None,
      "checks": practical_checks,
      "promoted": all(practical_checks.values()),
    })
  promoted = [row for row in candidates if row["promoted"]]
  return {
    "versionId": V12_CHALLENGER_VERSION_ID,
    "selectedPolicy": selected_policy,
    "policySelectionRule": "Prefer Momentum-only when both holdout and recent stressed expectancy are within 0.03R of the best policy; otherwise maximize the weaker of holdout and recent.",
    "policyComparisons": comparisons,
    "forecastQualityAudits": audits["forecast_quality"],
    "candidateDefinitionsTested": len(V12_CANDIDATE_DEFINITIONS),
    "candidates": candidates,
    "promotedPatternIds": [str(row["id"]) for row in promoted],
    "registryDecision": "create_v12" if promoted else "retain_v10",
    "reusedHistory": True,
  }


def build_candidate_stress_report(
  source_results: Sequence[Dict[str, Any]],
  h4_candles: Sequence[Dict[str, Any]],
  generated_at: int,
) -> Dict[str, Any]:
  """Run a declared path/exit matrix without altering the immutable Charts registry."""
  candles = sorted(h4_candles, key=lambda candle: int(candle["time"]))
  candle_times = [int(candle["time"]) for candle in candles]
  current_signatures = {
    (str(source["versionId"]), str(signature)): str(pattern_id)
    for source in source_results
    for signature, pattern_id in dict(source.get("currentPatterns", {})).items()
  }
  known_patterns = {
    (str(pattern["sourceVersion"]), str(signature)): pattern
    for pattern in CHART_SIGNAL_PATTERN_DEFINITIONS
    for signature in pattern["signatures"]
  }
  candidates: List[Dict[str, Any]] = []
  configurations_tested = 0
  robustness_configurations_tested = 0
  for source in source_results:
    source_version = str(source["versionId"])
    split_time = int(source["splitTime"])
    outcomes = _annotate_numeric_robustness(list(source["outcomes"]))
    latest_event_time = max((int(row["eventTime"]) for row in outcomes), default=generated_at)
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for outcome in outcomes:
      if outcome.get("direction") in {"long", "short"}:
        grouped.setdefault(candidate_pattern_signature(outcome), []).append(outcome)
    for signature, rows in sorted(grouped.items()):
      pattern = known_patterns.get((source_version, signature))
      rows = [
        {
          **row,
          "signature": signature,
          "numericRobustness": {
            **dict(row.get("numericRobustness", {})),
            "packageCompleteness": _package_completeness({**row, "signature": signature}, pattern),
          },
        }
        for row in rows
      ]
      profiles = [
        profile for row in sorted(rows, key=lambda item: int(item["eventTime"]))
        if (profile := build_candidate_path_profile(row, candles, candle_times)) is not None
      ]
      if len(profiles) < STRESS_MINIMUM_SIGNATURE_CASES:
        continue
      configurations: List[Dict[str, Any]] = []
      base_simulations: List[Tuple[float, float, int, Sequence[Dict[str, Any]]]] = []
      for stop_atr in STRESS_STOP_ATR_VALUES:
        for target_r in STRESS_TARGET_R_VALUES:
          for holding_candles in STRESS_HOLDING_CANDLES:
            simulations = _simulate_path_configuration(profiles, stop_atr, target_r, holding_candles)
            base_simulations.append((stop_atr, target_r, holding_candles, simulations))
            configurations.append(_summarize_path_configuration(
              simulations, split_time, latest_event_time, stop_atr, target_r, holding_candles
            ))
      configurations_tested += len(configurations)
      selected = _select_stress_configuration(configurations, len(profiles))
      if selected is None:
        continue
      checks, diagnostic_checks = _stress_configuration_checks(selected)
      registered_execution = dict(pattern["execution"]) if pattern and pattern.get("current") else None
      registered_configuration = next((
        row for row in configurations
        if registered_execution is not None
        and float(row["stopAtr"]) == float(registered_execution["stopAtr"])
        and float(row["targetR"]) == float(registered_execution["targetR"])
        and int(row["holdingCandles"]) == int(registered_execution["expiryCandles"])
      ), None)
      robustness_variants, robustness_test_count = _build_numeric_robustness_variants(
        profiles, base_simulations, split_time, latest_event_time
      )
      robustness_configurations_tested += robustness_test_count
      example_events = [event for row in rows for event in row.get("events", [])]
      candidates.append({
        "sourceVersionId": source_version,
        "signature": signature,
        "label": str(pattern["label"]) if pattern else _pattern_label(signature, example_events),
        "direction": signature.split("|", 1)[0],
        "groups": signature.split("|")[1:],
        "exampleTitles": sorted({str(event.get("title", "")) for event in example_events if event.get("title")})[:8],
        "historicalN": len(profiles),
        "currentRegistered": (source_version, signature) in current_signatures,
        "currentPatternId": current_signatures.get((source_version, signature)),
        "registeredExecution": registered_execution,
        "registeredConfiguration": registered_configuration,
        "path30": summarize_candidate_paths(profiles, PATH_RESEARCH_HORIZON),
        "path60": summarize_candidate_paths(profiles, PATH_RESEARCH_MAX_HORIZON),
        "selectedOn": "development_only",
        "selectedConfiguration": selected,
        "configurationStability": _configuration_stability(configurations, selected),
        "checks": diagnostic_checks,
        "passesExploratoryScreen": all(checks.values()),
        "passesStrictHoldoutCheck": all(diagnostic_checks.values()),
        "numericRobustness": {
          "versionId": NUMERIC_ROBUSTNESS_VERSION_ID,
          "variantsTested": len(robustness_variants),
          "variants": robustness_variants,
        },
        "reusedHistory": True,
      })
  candidates.sort(key=lambda row: (
    not row["currentRegistered"],
    not row["passesExploratoryScreen"],
    -(float(row["selectedConfiguration"]["holdout"].get("stressedAverageR") or -999.0)),
    -int(row["historicalN"]),
    str(row["label"]),
  ))
  dimension_priority = {
    "evidenceMode": 0,
    "backgroundAlignment": 1,
    "packageCompleteness": 2,
    "revisionReliability": 3,
    "scoreStrength": 4,
    "reaction": 5,
  }
  unique_robustness_leads: Dict[Tuple[str, str, str, str], Dict[str, Any]] = {}
  for candidate in candidates:
    for variant in candidate["numericRobustness"]["variants"]:
      enriched = {
        **variant,
        "sourceVersionId": str(candidate["sourceVersionId"]),
        "signature": str(candidate["signature"]),
        "label": str(candidate["label"]),
        "direction": str(candidate["direction"]),
        "currentRegistered": bool(candidate["currentRegistered"]),
      }
      key = (
        str(candidate["sourceVersionId"]),
        str(candidate["signature"]),
        str(variant["reaction"]),
        str(variant["cohortFingerprint"]),
      )
      existing = unique_robustness_leads.get(key)
      if existing is None or dimension_priority[str(variant["dimension"])] < dimension_priority[str(existing["dimension"])]:
        unique_robustness_leads[key] = enriched
  robustness_leads = list(unique_robustness_leads.values())
  robustness_leads.sort(key=lambda row: (
    not row["passesExploratoryScreen"],
    -(float(row["selectedConfiguration"]["holdout"].get("stressedAverageR") or -999.0)),
    -(float(row["selectedConfiguration"]["recent"].get("stressedAverageR") or -999.0)),
    -int(row["historicalN"]),
    str(row["label"]),
  ))
  protocol = {
    "pathHorizonCandles": PATH_RESEARCH_HORIZON,
    "maximumPathHorizonCandles": PATH_RESEARCH_MAX_HORIZON,
    "thresholdsR": list(PATH_RESEARCH_THRESHOLDS_R),
    "stopAtrValues": list(STRESS_STOP_ATR_VALUES),
    "targetRValues": list(STRESS_TARGET_R_VALUES),
    "holdingCandles": list(STRESS_HOLDING_CANDLES),
    "entry": "first_h4_open_strictly_after_release",
    "selection": "configuration selected on development lower-95 expectancy, then development average; holdout never enters configuration selection",
    "exploratoryScreen": "minimum samples, at least +0.10R stressed average in overall/development/holdout/recent, 8 years, 60% positive years, and bounded ambiguity",
    "intrabar": "same-H4 stop-and-target touches are ambiguous in this matrix; existing frozen 1R/1.5R/2R results retain M1 resolution",
    "stressPips": CHART_SIGNAL_EXECUTION_STRESS_PIPS,
    "primaryWindowDays": PRIMARY_WINDOW_DAYS,
  }
  v12_challenger = build_v12_challenger_report(source_results, candles, generated_at)
  return {
    "schemaVersion": CANDIDATE_STRESS_SCHEMA_VERSION,
    "generatedAt": generated_at,
    "modelId": CHART_SIGNAL_MODEL_ID,
    "researchVersionId": NUMERIC_ROBUSTNESS_VERSION_ID,
    "protocol": protocol,
    "protocolHash": hashlib.sha256(json.dumps(protocol, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest(),
    "sourceVersions": [str(source["versionId"]) for source in source_results],
    "researchPriceCutoff": max((int(source.get("generatedAt", generated_at)) for source in source_results), default=generated_at),
    "candleCoverage": {
      "count": len(candles),
      "earliest": candle_times[0] if candle_times else None,
      "latest": candle_times[-1] if candle_times else None,
    },
    "configurationsTested": configurations_tested + robustness_configurations_tested,
    "baseConfigurationsTested": configurations_tested,
    "robustnessConfigurationsTested": robustness_configurations_tested,
    "signaturesTested": len(candidates),
    "robustnessVariantsTested": len(robustness_leads),
    "robustnessLeads": robustness_leads[:40],
    "candidateCount": len(candidates),
    "candidates": candidates,
    "v12Challenger": v12_challenger,
    "limitations": [
      "Every candidate and configuration is reused-history research and cannot be promoted directly from this report.",
      "The flexible matrix excludes spread, commission, slippage, and swap and applies only the existing three-pip result stress.",
      "Maximum favorable excursion is known only afterward and cannot itself be used as a live exit.",
      "Trying many configurations increases selection risk; the chosen rule must be frozen before later evaluation.",
      "Revision reliability compares the broker-supplied Previous momentum direction with the prior archived Actual; it does not recreate missing historical vintages.",
      "V11 cohorts are numeric reused-history research. They do not change the immutable v10 Charts registry or create live arrows.",
      "V12 is created only when a fixed challenger passes every practical registration check; otherwise Charts remains on immutable v10.",
    ],
  }


def build_workbench_experiment(
  source_results: Sequence[Dict[str, Any]],
  h4_candles: Sequence[Dict[str, Any]],
  configuration: Dict[str, Any],
  generated_at: int,
) -> Dict[str, Any]:
  """Evaluate one guarded, recorded Lab experiment without changing Charts."""
  source_version = str(configuration["sourceVersionId"])
  signatures = tuple(str(value) for value in (configuration.get("signatures") or [configuration.get("signature")]) if value)
  if not signatures:
    raise ValueError("Experiment configuration has no directional signature")
  signature = str(configuration.get("signature") or signatures[0])
  scoring_policy = str(configuration["scoringPolicy"])
  reaction = str(configuration["reaction"])
  cohort = dict(configuration.get("cohort") or {})
  execution = dict(configuration["execution"])
  source = next(
    (row for row in source_results if str(row["versionId"]) == source_version),
    None,
  )
  if source is None:
    raise ValueError(f"Unknown source version: {source_version}")
  if scoring_policy not in {"baseline", "momentum_only", "forecast_quality"}:
    raise ValueError(f"Unsupported scoring policy: {scoring_policy}")
  if reaction not in {"continuation", "contrarian"}:
    raise ValueError(f"Unsupported reaction: {reaction}")

  rescored, forecast_audit = _rescore_policy_outcomes(
    list(source["outcomes"]), scoring_policy
  )
  outcomes = _annotate_numeric_robustness(rescored)
  known_pattern = next((
    pattern for pattern in CHART_SIGNAL_PATTERN_DEFINITIONS
    if str(pattern["sourceVersion"]) == source_version
    and any(value in pattern["signatures"] for value in signatures)
  ), None)
  rows: List[Dict[str, Any]] = []
  audit_rows: List[Dict[str, Any]] = []
  for outcome in outcomes:
    if outcome.get("direction") not in {"long", "short"}:
      continue
    outcome_signature = candidate_pattern_signature(outcome)
    if outcome_signature not in signatures:
      continue
    robustness = {
      **dict(outcome.get("numericRobustness", {})),
      "packageCompleteness": _package_completeness(
        {**outcome, "signature": outcome_signature}, known_pattern
      ),
    }
    dimension = str(cohort.get("dimension") or "none")
    value = str(cohort.get("value") or "all")
    included = dimension == "none" or str(robustness.get(dimension, "unknown")) == value
    audit_rows.append({
      **outcome,
      "signature": outcome_signature,
      "numericRobustness": robustness,
      "included": included,
      "inclusionReason": "Included by Cases included" if included else f"Excluded: {dimension} is {robustness.get(dimension, 'unknown')}, not {value}",
    })
    if not included:
      continue
    rows.append({
      **outcome,
      "signature": outcome_signature,
      "numericRobustness": robustness,
    })

  candles = sorted(h4_candles, key=lambda candle: int(candle["time"]))
  candle_times = [int(candle["time"]) for candle in candles]
  atr_values = calculate_atr_by_candle(candles)
  profiles = [
    profile for row in sorted(rows, key=lambda item: int(item["eventTime"]))
    if (profile := _build_policy_path_profile(row, candles, candle_times, atr_values)) is not None
  ]
  if reaction == "contrarian":
    profiles = [{
      **profile,
      "outcome": {
        **profile["outcome"],
        "direction": "short" if profile["direction"] == "long" else "long",
      },
      "direction": "short" if profile["direction"] == "long" else "long",
      "sign": -float(profile["sign"]),
    } for profile in profiles]
  if not profiles:
    raise ValueError("No evaluable historical cases match this guarded experiment")

  stop_values = [float(value) for value in execution["stopAtrValues"]]
  target_values = [float(value) for value in execution["targetRValues"]]
  holding_values = [int(value) for value in execution["holdingCandles"]]
  latest_event_time = max(int(row["eventTime"]) for row in rows)
  split_time = int(source["splitTime"])
  configurations = [
    _evaluate_path_configuration(
      profiles, split_time, latest_event_time, stop_atr, target_r, holding
    )
    for stop_atr in stop_values
    for target_r in target_values
    for holding in holding_values
  ]
  if str(execution["mode"]) == "single":
    selected = configurations[0]
  else:
    selectable = [
      row for row in configurations
      if row["development"].get("stressedAverageR") is not None
    ]
    def workbench_selection_key(row: Dict[str, Any]) -> Tuple[float, float, float]:
      lower = (row["development"].get("stressedExpectancyCi95") or {}).get("lower")
      average = row["development"].get("stressedAverageR")
      return (
        float(lower) if lower is not None else -999.0,
        float(average) if average is not None else -999.0,
        -abs(float(row["stopAtr"]) - 1.0)
        -abs(float(row["targetR"]) - 2.0)
        -abs(int(row["holdingCandles"]) - 30) / 30,
      )
    selected = max(
      selectable,
      key=workbench_selection_key,
      default=None,
    )
    if selected is None:
      raise ValueError("The selected matrix has insufficient development cases")

  simulations = _simulate_path_configuration(
    profiles,
    float(selected["stopAtr"]),
    float(selected["targetR"]),
    int(selected["holdingCandles"]),
  )
  profiles_by_time = {int(profile["eventTime"]): profile for profile in profiles}
  account_rows = []
  for simulation in simulations:
    profile = profiles_by_time[int(simulation["eventTime"])]
    exit_time = simulation.get("exitTime")
    adverse = [
      value for candle, value in zip(profile["candles"], profile["adverse"])
      if exit_time is None or int(candle["time"]) <= int(exit_time)
    ]
    account_rows.append({
      **simulation,
      "activationTime": int(profile["entryTime"]),
      "direction": str(profile["direction"]),
      "patternId": str(profile["outcome"].get("signature") or signature),
      "maximumAdverseR": min(
        1.0,
        max(adverse, default=0.0) / float(selected["stopAtr"]),
      ),
    })
  checks, strict_checks = _stress_configuration_checks(selected)
  stability = _configuration_stability(configurations, selected)
  path = summarize_candidate_paths(profiles, int(selected["holdingCandles"]))
  profiles_by_time = {
    int(profile["eventTime"]): profile
    for profile in profiles
  }
  raw_cases = []
  for row in sorted(audit_rows, key=lambda item: (int(item["eventTime"]), str(item.get("direction", "")))):
    profile = profiles_by_time.get(int(row["eventTime"])) if row["included"] else None
    raw_cases.append({
      "caseId": hashlib.sha256(f"{source_version}|{row['eventTime']}|{row['signature']}".encode("utf-8")).hexdigest()[:16],
      "eventTime": int(row["eventTime"]),
      "direction": str(row.get("direction", "none")),
      "included": bool(row["included"] and profile is not None),
      "inclusionReason": row["inclusionReason"] if profile is not None or not row["included"] else "Excluded: no complete H4 path is available",
      "numericRobustness": dict(row.get("numericRobustness", {})),
      "entryTime": int(profile["entryTime"]) if profile else None,
      "entry": float(profile["entry"]) if profile else None,
      "atr": float(profile["atr"]) if profile else None,
      "events": [{
        key: event.get(key) for key in (
          "currency", "countryCode", "title", "actual", "forecast", "previous",
          "surprisePoint", "momentumPoint", "agreementBonus", "score",
          "forecastSuspect", "forecastGap", "forecastAnomalyThreshold", "scoringPolicy",
        )
      } | {
        "surpriseRaw": _raw_source_delta(event.get("actual"), event.get("forecast")),
        "momentumRaw": _raw_source_delta(event.get("actual"), event.get("previous")),
      } for event in row.get("events", [])],
    })
  contract_results: Dict[str, List[Dict[str, Any]]] = {}
  for configuration_row in configurations:
    stop_atr = float(configuration_row["stopAtr"])
    target_r = float(configuration_row["targetR"])
    duration = int(configuration_row["holdingCandles"])
    contract_key = f"{stop_atr:g}|{target_r:g}|{duration}"
    contract_results[contract_key] = []
    for simulation in _simulate_path_configuration(profiles, stop_atr, target_r, duration):
      profile = profiles_by_time.get(int(simulation["eventTime"]))
      if profile is None:
        continue
      risk_distance = float(profile["atr"]) * stop_atr
      sign = float(profile["sign"])
      contract_results[contract_key].append({
        **simulation,
        "caseId": hashlib.sha256(f"{source_version}|{simulation['eventTime']}|{profile['outcome'].get('signature', signature)}".encode("utf-8")).hexdigest()[:16],
        "entryTime": int(profile["entryTime"]),
        "entry": float(profile["entry"]),
        "stop": float(profile["entry"]) - sign * risk_distance,
        "target": float(profile["entry"]) + sign * risk_distance * target_r,
        "stopAtr": stop_atr,
        "targetR": target_r,
        "targetAtr": stop_atr * target_r,
        "holdingCandles": duration,
      })
  selected_contract_key = f"{float(selected['stopAtr']):g}|{float(selected['targetR']):g}|{int(selected['holdingCandles'])}"
  return {
    "generatedAt": generated_at,
    "sourceVersionId": source_version,
    "signature": signature,
    "signatures": list(signatures),
    "directionSelection": str(configuration.get("directionSelection") or ("both" if len(signatures) > 1 else signatures[0].split("|", 1)[0])),
    "scoringPolicy": scoring_policy,
    "cohort": cohort,
    "reaction": reaction,
    "historicalN": len(profiles),
    "splitTime": split_time,
    "selection": (
      "single_declared_contract" if execution["mode"] == "single"
      else "development_lower95_then_average"
    ),
    "configurationsTested": len(configurations),
    "configurations": configurations,
    "selectedConfiguration": selected,
    "configurationStability": stability,
    "path": path,
    "sequentialAccount": _sequential_research_account(account_rows),
    "checks": strict_checks,
    "passesExploratoryScreen": all(checks.values()),
    "passesStrictHoldoutCheck": all(strict_checks.values()),
    "forecastQualityAudit": forecast_audit,
    "rawAudit": {
      "selectedContractKey": selected_contract_key,
      "contracts": [{
        "key": f"{float(row['stopAtr']):g}|{float(row['targetR']):g}|{int(row['holdingCandles'])}",
        "stopAtr": float(row["stopAtr"]),
        "targetR": float(row["targetR"]),
        "targetAtr": float(row["stopAtr"]) * float(row["targetR"]),
        "holdingCandles": int(row["holdingCandles"]),
        "overall": row["overall"],
        "development": row["development"],
        "holdout": row["holdout"],
        "recent": row["recent"],
      } for row in configurations],
      "cases": raw_cases,
      "contractResults": contract_results,
    },
    "limitations": [
      "Reused historical research cannot validate itself or prove causation.",
      "The simulation is gross; spread, commission, slippage, and swap are excluded.",
      "The entry remains the first H4 open strictly after the release.",
      "Holdout and recent results never select a matrix configuration.",
    ],
  }


CHART_SIGNAL_QUALIFICATION = {
  "targetR": 2.0,
  "minimumOverallEvaluable": 40,
  "minimumDevelopmentEvaluable": 25,
  "minimumHoldoutEvaluable": 10,
  "minimumAverageR": 0.10,
  "minimumTargetHitRate": 1 / 3,
  "maximumAmbiguousRate": 0.05,
}

CHART_SIGNAL_MODEL_ID = "FMS-EURUSD-FORECAST-GUARD-H4-v13"
CHART_SIGNAL_MODEL_CREATED_AT = 1787714200  # 2026-08-26 03:16:40 UTC
CHART_SIGNAL_RECENT_DAYS = 3 * 365
CHART_SIGNAL_PATTERN_DEFINITIONS = (
  {
    "id": "us-payroll-short",
    "label": "US payroll package",
    "sourceVersion": V2_VERSION_ID,
    "signatures": ("short|USD:employment|USD:labor_wages|USD:unemployment",),
    "current": True,
    "execution": {"stopAtr": 2.0, "targetR": 1.0, "expiryCandles": 6},
    "condition": "Short if the same-time US employment, wage, and unemployment package produces a USD-improving vote.",
  },
  {
    "id": "euro-unemployment-long",
    "label": "Euro-area unemployment",
    "sourceVersion": V2_VERSION_ID,
    "signatures": ("long|EUR:unemployment",),
    "current": False,
    "execution": {"stopAtr": 1.0, "targetR": 2.0, "expiryCandles": 30},
    "condition": "Research replay only: Long when the Euro-area unemployment release produces an EUR-improving vote.",
  },
  {
    "id": "euro-consumer-sentiment-directional",
    "label": "Euro-area consumer sentiment",
    "sourceVersion": SENTIMENT_VERSION_ID,
    "signatures": ("long|EUR:consumer_sentiment", "short|EUR:consumer_sentiment"),
    "current": True,
    "execution": {"stopAtr": 1.0, "targetR": 2.0, "expiryCandles": 30},
    "condition": "Long if Euro-area consumer sentiment improves; Short if it weakens; no signal on a zero score.",
  },
  {
    "id": "euro-producer-inflation-long",
    "label": "Euro-area producer inflation heat",
    "sourceVersion": POLICY_INFLATION_VERSION_ID,
    "signatures": ("long|EUR:producer_inflation",),
    "current": False,
    "execution": {"stopAtr": 1.0, "targetR": 2.0, "expiryCandles": 30},
    "condition": "Research replay only: Long when aggregate Euro-area producer-price releases score hotter; it failed the frozen year-stability gate.",
  },
  {
    "id": "us-industrial-output-short",
    "label": "US industrial-production package",
    "sourceVersion": GROWTH_VERSION_ID,
    "signatures": ("short|USD:industrial_output",),
    "current": True,
    "execution": {"stopAtr": 1.0, "targetR": 2.0, "expiryCandles": 30},
    "condition": "Short if same-time aggregate-US industrial production/output evidence produces a USD-improving vote.",
  },
  {
    "id": "us-producer-inflation-cooling-long",
    "label": "US producer-inflation cooling package",
    "sourceVersion": POLICY_INFLATION_VERSION_ID,
    "signatures": ("long|USD:producer_inflation",),
    "requiredExactTitles": ("Core PPI m/m", "Core PPI y/y", "PPI m/m", "PPI y/y"),
    "current": True,
    "execution": {"stopAtr": 2.0, "targetR": 1.25, "expiryCandles": 18},
    "condition": "Long only when the same-time four-series US Core PPI/PPI m/m and y/y package is complete and its aggregate producer-inflation score is cooling.",
  },
)
CHART_SIGNAL_REPLAY_SIGNATURES = tuple(
  signature
  for pattern in CHART_SIGNAL_PATTERN_DEFINITIONS
  for signature in pattern["signatures"]
)
CHART_SIGNAL_CURRENT_SIGNATURES = tuple(
  signature
  for pattern in CHART_SIGNAL_PATTERN_DEFINITIONS
  if pattern["current"]
  for signature in pattern["signatures"]
)
CHART_SIGNAL_MODEL_CONFIGURATION = {
  "id": CHART_SIGNAL_MODEL_ID,
  "createdAt": CHART_SIGNAL_MODEL_CREATED_AT,
  "sourceVersions": [V2_VERSION_ID, SENTIMENT_VERSION_ID, POLICY_INFLATION_VERSION_ID, GROWTH_VERSION_ID],
  "defaultTargetR": 2.0,
  "signalClock": "first_h4_open_strictly_after_release",
  "scoringPolicy": {
    "id": "past_only_forecast_quality",
    "minimumExactSeriesHistory": FORECAST_QUALITY_MINIMUM_HISTORY,
    "madMultiplier": FORECAST_QUALITY_MAD_MULTIPLIER,
    "scaleMultiplier": FORECAST_QUALITY_SCALE_MULTIPLIER,
    "suspectForecastTreatment": "preserve_raw_exclude_surprise_keep_momentum_no_agreement_bonus",
  },
  "defaultExpiryCandles": HOLDING_CANDLES,
  "patterns": [
    {
      **pattern,
      "signatures": list(pattern["signatures"]),
      "requiredExactTitles": list(pattern.get("requiredExactTitles", ())),
    }
    for pattern in CHART_SIGNAL_PATTERN_DEFINITIONS
  ],
  "historicalQualification": CHART_SIGNAL_QUALIFICATION,
  "executionStressPips": CHART_SIGNAL_EXECUTION_STRESS_PIPS,
  "recentWindowDays": CHART_SIGNAL_RECENT_DAYS,
  "recentMinimumEvaluable": 10,
  "minimumEvaluableYears": 8,
  "minimumPositiveYearShare": 0.60,
  "prequentialMinimumEvaluable": 2,
  "targetRobustness": "positive_after_execution_stress_at_1R_1_5R_and_2R",
  "costDisclosure": "Three-pip result stress only; historical spread, slippage, swap, and commission are unavailable.",
}
CHART_SIGNAL_MODEL_HASH = hashlib.sha256(
  json.dumps(CHART_SIGNAL_MODEL_CONFIGURATION, sort_keys=True, separators=(",", ":")).encode("utf-8")
).hexdigest()

# Historical registration snapshots are display/audit metadata. They are kept
# outside CHART_SIGNAL_MODEL_CONFIGURATION so they cannot rewrite an immutable
# Charts-model hash.
CHART_SIGNAL_REGISTRATION_EVIDENCE = {
  "euro-consumer-sentiment-directional": {
    "scoringPolicy": "baseline",
    "cohort": "all_matching_cases",
    "reaction": "continuation",
    "evaluable": 99,
    "targetFirst": 40,
    "stopFirst": 57,
    "expired": 2,
    "stressedAverageR": 0.133,
    "developmentAverageR": 0.068,
    "holdoutAverageR": 0.327,
    "recentAverageR": 0.523,
    "positiveYears": 8,
    "evaluatedYears": 11,
    "stressPips": 3.0,
  },
}


def candidate_pattern_signature(candidate: Dict[str, Any]) -> str:
  groups = sorted({
    f"{str(event.get('currency', '')).upper()}:{str(event.get('scoreGroup', ''))}"
    for event in candidate.get("events", [])
    if event.get("scoreGroup")
  })
  return f"{candidate.get('direction', 'none')}|{'|'.join(groups)}"


def candidate_matches_chart_pattern(candidate: Dict[str, Any], pattern: Dict[str, Any]) -> bool:
  """Match a frozen chart setup, including any exact release-package contract."""
  if candidate_pattern_signature(candidate) not in pattern.get("signatures", ()):
    return False
  required_titles = {
    normalize_title(str(title)) for title in pattern.get("requiredExactTitles", ())
  }
  if not required_titles:
    return True
  candidate_titles = {
    normalize_title(str(event.get("title", ""))) for event in candidate.get("events", [])
  }
  return required_titles.issubset(candidate_titles)


def build_chart_signal_realtime_watch(
  events: Sequence[Dict[str, Any]],
  as_of: int,
  eligible_pattern_ids: Optional[frozenset[str]] = None,
  observed_candidates: Optional[Sequence[Tuple[str, Dict[str, Any]]]] = None,
  observed_event_times: Optional[frozenset[int]] = None,
  model_activated_at: Optional[int] = None,
) -> Dict[str, Any]:
  """Describe the next pair event and the next structurally relevant pattern package.

  Scheduled rows do not have an Actual value, so this deliberately does not try to
  predict a direction. It only identifies whether the titles/countries in a future
  release package could satisfy one of the frozen current pattern structures once
  Actual values arrive.
  """
  pair_events = sorted(
    (
      event for event in events
      if str(event.get("currency", "")).upper() in {"EUR", "USD"}
    ),
    key=lambda event: (
      int(event.get("time", 0)),
      str(event.get("currency", "")),
      normalize_title(str(event.get("title", ""))),
      int(event.get("id", 0)),
    ),
  )
  future = [event for event in pair_events if int(event.get("time", 0)) > as_of]

  def public_event(event: Dict[str, Any]) -> Dict[str, Any]:
    return {
      "id": int(event.get("id", 0)),
      "time": int(event.get("time", 0)),
      "currency": str(event.get("currency", "")).upper(),
      "countryCode": str(event.get("countryCode", "")).upper(),
      "title": str(event.get("title", "")),
      "impact": str(event.get("impact", "low")).lower(),
      "actual": event.get("actual"),
      "forecast": event.get("forecast"),
      "previous": event.get("previous"),
    }

  next_event = public_event(future[0]) if future else None
  packages: Dict[int, List[Dict[str, Any]]] = {}
  for event in pair_events:
    packages.setdefault(int(event["time"]), []).append(event)

  def structural_patterns(package: Sequence[Dict[str, Any]]) -> List[Tuple[Dict[str, Any], List[set[str]]]]:
    matches: List[Tuple[Dict[str, Any], List[set[str]]]] = []
    for pattern in CHART_SIGNAL_PATTERN_DEFINITIONS:
      if not pattern["current"]:
        continue
      if eligible_pattern_ids is not None and str(pattern["id"]) not in eligible_pattern_ids:
        continue
      definition = get_signal_definition(str(pattern["sourceVersion"]))
      if definition is None:
        continue
      structural_groups = {
        f"{str(event.get('currency', '')).upper()}:{rule.score_group}"
        for event in package
        if _event_belongs_to_definition(event, definition)
        for rule in [find_signal_rule(event, definition)]
        if rule is not None
      }
      required_group_sets = [set(signature.split("|")[1:]) for signature in pattern["signatures"]]
      if not any(required and required.issubset(structural_groups) for required in required_group_sets):
        continue
      required_titles = {normalize_title(str(title)) for title in pattern.get("requiredExactTitles", ())}
      package_titles = {normalize_title(str(event.get("title", ""))) for event in package}
      if required_titles and not required_titles.issubset(package_titles):
        continue
      matches.append((pattern, required_group_sets))
    return matches

  def watch_payload(event_time: int, package: Sequence[Dict[str, Any]], pattern: Dict[str, Any], required_group_sets: Sequence[set[str]]) -> Dict[str, Any]:
    return {
      "time": event_time,
      "patternId": pattern["id"],
      "label": pattern["label"],
      "condition": pattern["condition"],
      "sourceVersionId": pattern["sourceVersion"],
      "requiredGroups": sorted(set().union(*required_group_sets)),
      "events": [public_event(event) for event in package],
    }

  next_pattern = None
  upcoming_by_pattern: Dict[str, Dict[str, Any]] = {}
  for event_time in sorted(time for time in packages if time > as_of):
    package = packages[event_time]
    for pattern, required_group_sets in structural_patterns(package):
      pattern_id = str(pattern["id"])
      payload = watch_payload(event_time, package, pattern, required_group_sets)
      upcoming_by_pattern.setdefault(pattern_id, payload)
      if next_pattern is None:
        next_pattern = payload

  candidates = list(observed_candidates or ())
  frozen_times = observed_event_times or frozenset()
  assessments_by_pattern: Dict[str, Dict[str, Any]] = {}

  def point_text(point: Any, positive: str, negative: str) -> str:
    return positive if point == 1 else negative if point == -1 else "equal or unavailable (0)"

  for event_time in sorted((time for time in packages if time <= as_of), reverse=True):
    package = packages[event_time]
    for pattern, _required_group_sets in structural_patterns(package):
      pattern_id = str(pattern["id"])
      if pattern_id in assessments_by_pattern:
        continue
      matching_candidates = [
        candidate for source_version, candidate in candidates
        if source_version == str(pattern["sourceVersion"])
        and int(candidate.get("eventTime", 0)) == event_time
      ]
      qualified = next((candidate for candidate in matching_candidates if candidate_matches_chart_pattern(candidate, pattern)), None)
      candidate = qualified or (matching_candidates[0] if matching_candidates else None)
      scored_events = list(candidate.get("events", [])) if candidate is not None else []
      calculations = [
        (
          f"{row.get('title')}: A {row.get('actual') or '–'} vs F {row.get('forecast') or '–'} = "
          f"{'excluded as historically anomalous' if row.get('forecastSuspect') else point_text(row.get('surprisePoint'), 'better (+1)', 'worse (-1)')}; "
          f"A {row.get('actual') or '–'} vs P {row.get('previous') or '–'} = "
          f"{point_text(row.get('momentumPoint'), 'improving (+1)', 'weakening (-1)')}; "
          f"agreement {int(row.get('agreementBonus', 0)):+d}; score {int(row.get('score', 0)):+d}."
        )
        for row in scored_events
      ]
      calculation = " ".join(calculations)
      predates_model = model_activated_at is not None and event_time < model_activated_at
      if event_time not in frozen_times:
        status = "awaiting_observation"
        reason = "Release time passed; waiting for the next completed EA cycle to freeze the first-seen values."
      elif predates_model and qualified is not None:
        status = "pre_activation_audit"
        reason = f"{calculation} Forecast Guard classifies {str(qualified.get('direction', '')).upper()} EURUSD, but this release predates model activation, so no hypothetical trade was opened."
      elif qualified is not None:
        status = "qualified"
        reason = f"{calculation} Frozen rule qualified {str(qualified.get('direction', '')).upper()} EURUSD."
      elif matching_candidates:
        status = "no_trade"
        reason = f"{calculation} Frozen rule: {pattern['condition']} This package produced no matching nonzero direction."
      else:
        status = "no_trade"
        source_values = "; ".join(
          f"{event.get('title')}: A {event.get('actual') or '–'}, F {event.get('forecast') or '–'}, P {event.get('previous') or '–'}"
          for event in package
        )
        reason = f"{source_values}. Frozen rule: {pattern['condition']} No complete numeric registered package was produced."
      assessments_by_pattern[pattern_id] = {
        "time": event_time,
        "patternId": pattern["id"],
        "label": pattern["label"],
        "condition": pattern["condition"],
        "status": status,
        "direction": qualified.get("direction") if qualified is not None else None,
        "reason": reason,
        "events": [public_event(event) for event in package],
        "calculations": [
          {
            "title": str(row.get("title", "")),
            "actual": row.get("actual"),
            "forecast": row.get("forecast"),
            "previous": row.get("previous"),
            "surprisePoint": int(row["surprisePoint"]) if row.get("surprisePoint") is not None else None,
            "momentumPoint": int(row["momentumPoint"]) if row.get("momentumPoint") is not None else None,
            "agreementBonus": int(row.get("agreementBonus", 0)),
            "score": int(row.get("score", 0)),
            "forecastSuspect": bool(row.get("forecastSuspect", False)),
            "forecastGap": row.get("forecastGap"),
            "forecastAnomalyThreshold": row.get("forecastAnomalyThreshold"),
            "scoringPolicy": row.get("scoringPolicy"),
          }
          for row in scored_events
        ],
      }

  assessments = sorted(assessments_by_pattern.values(), key=lambda row: (-int(row["time"]), str(row["label"])))
  upcoming = sorted(upcoming_by_pattern.values(), key=lambda row: (int(row["time"]), str(row["label"])))
  latest_assessment = assessments[0] if assessments else None

  return {
    "asOf": as_of,
    "nextPairEvent": next_event,
    "nextPatternWatch": next_pattern,
    "upcomingPatternWatches": upcoming,
    "latestPatternAssessment": latest_assessment,
    "latestPatternAssessments": assessments,
  }


def build_policy_inflation_context(
  events: Sequence[Dict[str, Any]],
  as_of: int,
) -> Dict[str, Any]:
  """Return factual latest policy action and inflation direction for EUR and USD.

  This context never changes signal eligibility. It deliberately avoids inferring
  tone from statements or claiming that hotter inflation is currency-positive.
  """
  definition = SIGNAL_DEFINITIONS[POLICY_INFLATION_VERSION_ID]
  deduplicated: Dict[Tuple[Any, ...], Dict[str, Any]] = {}
  for event in events:
    if int(event.get("time", 0)) > as_of or not _event_belongs_to_definition(event, definition):
      continue
    key = (int(event.get("time", 0)), *_series_identity(event, True))
    current = deduplicated.get(key)
    quality = sum(bool(str(event.get(field) or "").strip()) for field in ("actual", "forecast", "previous"))
    current_quality = sum(bool(str(current.get(field) or "").strip()) for field in ("actual", "forecast", "previous")) if current else -1
    if current is None or (quality, int(event.get("id", 0))) > (current_quality, int(current.get("id", 0))):
      deduplicated[key] = event

  scored = [
    row for event in deduplicated.values()
    if (row := score_event(event, definition)) is not None
  ]
  result: Dict[str, Any] = {}
  for currency in ("EUR", "USD"):
    policy_rows = sorted(
      [row for row in scored if row["currency"] == currency and row["factor"] == "policy"],
      key=lambda row: (int(row["time"]), int(row["id"])),
    )
    latest_policy = policy_rows[-1] if policy_rows else None
    policy_change = compare_source_values(latest_policy.get("actual"), latest_policy.get("previous")) if latest_policy else None
    policy_state = "tightening" if policy_change == 1 else "easing" if policy_change == -1 else "holding" if policy_change == 0 else "unresolved"

    inflation_rows = [row for row in scored if row["currency"] == currency and row["factor"] == "inflation"]
    inflation_time = max((int(row["time"]) for row in inflation_rows), default=None)
    latest_inflation = [row for row in inflation_rows if inflation_time is not None and int(row["time"]) == inflation_time]
    group_scores: Dict[str, int] = {}
    for row in latest_inflation:
      group = str(row["scoreGroup"])
      group_scores[group] = _clamp_group(group_scores.get(group, 0) + int(row["score"]))
    heating_groups = sum(score > 0 for score in group_scores.values())
    cooling_groups = sum(score < 0 for score in group_scores.values())
    inflation_state = (
      "heating" if heating_groups > cooling_groups else
      "cooling" if cooling_groups > heating_groups else
      "mixed" if heating_groups or cooling_groups else
      "no_change" if latest_inflation else
      "unresolved"
    )
    result[currency] = {
      "policy": {
        "state": policy_state,
        "time": int(latest_policy["time"]) if latest_policy else None,
        "title": str(latest_policy["title"]) if latest_policy else None,
        "actual": latest_policy.get("actual") if latest_policy else None,
        "previous": latest_policy.get("previous") if latest_policy else None,
      },
      "inflation": {
        "state": inflation_state,
        "time": inflation_time,
        "heatingGroups": heating_groups,
        "coolingGroups": cooling_groups,
        "titles": sorted({str(row["title"]) for row in latest_inflation}),
      },
    }
  return {
    "asOf": as_of,
    "currencies": result,
    "usage": "Context only; policy and inflation do not filter or reverse current Charts arrows.",
  }


def _pattern_label(signature: str, events: Sequence[Dict[str, Any]]) -> str:
  _direction, _, groups_raw = signature.partition("|")
  groups = groups_raw.split("|") if groups_raw else []
  if groups == ["USD:employment", "USD:labor_wages", "USD:unemployment"]:
    return "US payroll package"
  if groups == ["USD:employment"]:
    return "US employment release"
  if groups == ["EUR:unemployment"]:
    return "Euro-area unemployment"
  titles = sorted({str(event.get("title", "")) for event in events if event.get("title")})
  if titles:
    return titles[0] if len(titles) == 1 else f"{titles[0]} package"
  return "Economic release package"


def _chart_pattern_summary(
  signature: str,
  rows: Sequence[Dict[str, Any]],
  split_time: int,
) -> Dict[str, Any]:
  development = [row for row in rows if int(row["eventTime"]) < split_time]
  holdout = [row for row in rows if int(row["eventTime"]) >= split_time]
  event_examples = [event for row in rows for event in row.get("events", [])]
  pattern_id = hashlib.sha256(signature.encode("utf-8")).hexdigest()[:12]
  return {
    "id": pattern_id,
    "signature": signature,
    "label": _pattern_label(signature, event_examples),
    "direction": signature.split("|", 1)[0],
    "groups": signature.split("|")[1:],
    "overall": aggregate_outcomes(rows),
    "development": aggregate_outcomes(development),
    "holdout": aggregate_outcomes(holdout),
    "qualification": CHART_SIGNAL_QUALIFICATION,
    "exampleTitles": sorted({str(event.get("title", "")) for event in event_examples if event.get("title")})[:12],
  }


def execution_stressed_outcomes(
  outcomes: Sequence[Dict[str, Any]],
  stress_pips: float = CHART_SIGNAL_EXECUTION_STRESS_PIPS,
) -> List[Dict[str, Any]]:
  """Subtract a deterministic EURUSD execution stress from realized R results."""
  stressed: List[Dict[str, Any]] = []
  for outcome in outcomes:
    row = dict(outcome)
    result_r = row.get("resultR")
    atr = row.get("atr")
    if result_r is not None and atr is not None and float(atr) > 0:
      row["resultR"] = float(result_r) - stress_pips * 0.0001 / float(atr)
    stressed.append(row)
  return stressed


def _chart_metrics_pass(
  overall: Dict[str, Any],
  development: Dict[str, Any],
  holdout: Dict[str, Any],
) -> bool:
  metrics_rows = (overall, development, holdout)
  return (
    overall["evaluableCount"] >= CHART_SIGNAL_QUALIFICATION["minimumOverallEvaluable"]
    and development["evaluableCount"] >= CHART_SIGNAL_QUALIFICATION["minimumDevelopmentEvaluable"]
    and holdout["evaluableCount"] >= CHART_SIGNAL_QUALIFICATION["minimumHoldoutEvaluable"]
    and all(
      metrics["averageR"] is not None
      and float(metrics["averageR"]) >= CHART_SIGNAL_QUALIFICATION["minimumAverageR"]
      and metrics["targetHitRate"] is not None
      and float(metrics["targetHitRate"]) >= CHART_SIGNAL_QUALIFICATION["minimumTargetHitRate"]
      and (
        metrics["ambiguousRate"] is None
        or float(metrics["ambiguousRate"]) <= CHART_SIGNAL_QUALIFICATION["maximumAmbiguousRate"]
      )
      for metrics in metrics_rows
    )
  )


def _prequential_pattern_audit(rows: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
  """Replay qualification using only outcomes strictly before each candidate."""
  selected: List[Dict[str, Any]] = []
  for index, row in enumerate(rows):
    prior = list(rows[:index])
    if len(prior) < CHART_SIGNAL_QUALIFICATION["minimumOverallEvaluable"]:
      continue
    split_index = max(1, min(len(prior) - 1, math.floor(len(prior) * DEVELOPMENT_SHARE)))
    overall = aggregate_outcomes(prior)
    development = aggregate_outcomes(prior[:split_index])
    holdout = aggregate_outcomes(prior[split_index:])
    if not _chart_metrics_pass(overall, development, holdout):
      continue
    stressed_partitions = (
      aggregate_outcomes(execution_stressed_outcomes(prior)),
      aggregate_outcomes(execution_stressed_outcomes(prior[:split_index])),
      aggregate_outcomes(execution_stressed_outcomes(prior[split_index:])),
    )
    if any((metrics["averageR"] or 0) <= 0 for metrics in stressed_partitions):
      continue
    selected.append(row)
  return {
    "evaluableCount": aggregate_outcomes(selected)["evaluableCount"],
    "gross": aggregate_outcomes(selected),
    "executionStress": aggregate_outcomes(execution_stressed_outcomes(selected)),
    "firstEligibleEventTime": int(selected[0]["eventTime"]) if selected else None,
    "lastEligibleEventTime": int(selected[-1]["eventTime"]) if selected else None,
  }


def _estimated_break_even_stress_pips(rows: Sequence[Dict[str, Any]]) -> Optional[float]:
  """Return the linear result-stress level that reduces average R to zero."""
  evaluable = [
    row for row in rows
    if row.get("resultR") is not None and row.get("atr") is not None and float(row["atr"]) > 0
  ]
  if not evaluable:
    return None
  gross_average = statistics.fmean(float(row["resultR"]) for row in evaluable)
  average_r_per_pip = statistics.fmean(0.0001 / float(row["atr"]) for row in evaluable)
  if gross_average <= 0 or average_r_per_pip <= 0:
    return 0.0
  return gross_average / average_r_per_pip


def _target_robustness_rows(
  signatures: Sequence[str],
  outcomes_by_target: Optional[Dict[str, Sequence[Dict[str, Any]]]],
) -> List[Dict[str, Any]]:
  if not outcomes_by_target:
    return []
  rows: List[Dict[str, Any]] = []
  for target_r in TARGET_R_VALUES:
    target_rows = [
      outcome for outcome in outcomes_by_target.get(str(target_r), [])
      if candidate_pattern_signature(outcome) in signatures
    ]
    if not target_rows:
      continue
    rows.append({
      "targetR": target_r,
      "gross": aggregate_outcomes(target_rows),
      "executionStress": aggregate_outcomes(execution_stressed_outcomes(target_rows)),
    })
  return rows


def build_chart_signal_pattern_catalog(
  outcomes: Sequence[Dict[str, Any]],
  split_time: int,
  outcomes_by_target: Optional[Dict[str, Sequence[Dict[str, Any]]]] = None,
  source_version: str = V2_VERSION_ID,
) -> List[Dict[str, Any]]:
  """Build replay/current patterns belonging to one frozen source version."""
  definitions = [
    pattern for pattern in CHART_SIGNAL_PATTERN_DEFINITIONS
    if pattern["sourceVersion"] == source_version
  ]
  latest_event_time = max((int(row["eventTime"]) for row in outcomes), default=0)
  recent_cutoff = latest_event_time - CHART_SIGNAL_RECENT_DAYS * 24 * 60 * 60
  catalog: List[Dict[str, Any]] = []
  for definition in definitions:
    signatures = tuple(str(signature) for signature in definition["signatures"])
    rows = sorted(
      [outcome for outcome in outcomes if candidate_matches_chart_pattern(outcome, definition)],
      key=lambda row: int(row["eventTime"]),
    )
    if not rows:
      continue
    development = [row for row in rows if int(row["eventTime"]) < split_time]
    holdout = [row for row in rows if int(row["eventTime"]) >= split_time]
    event_examples = [event for row in rows for event in row.get("events", [])]
    direction_values = {signature.split("|", 1)[0] for signature in signatures}
    group_values = sorted({group for signature in signatures for group in signature.split("|")[1:]})
    pattern = {
      "id": str(definition["id"]),
      "signature": " || ".join(signatures),
      "signatures": list(signatures),
      "sourceVersionId": source_version,
      "label": str(definition["label"]),
      "condition": str(definition["condition"]),
      "execution": dict(definition["execution"]),
      "requiredExactTitles": list(definition.get("requiredExactTitles", ())),
      "direction": next(iter(direction_values)) if len(direction_values) == 1 else "both",
      "groups": group_values,
      "overall": aggregate_outcomes(rows),
      "development": aggregate_outcomes(development),
      "holdout": aggregate_outcomes(holdout),
      "qualification": CHART_SIGNAL_QUALIFICATION,
      "exampleTitles": sorted({str(event.get("title", "")) for event in event_examples if event.get("title")})[:12],
    }
    recent = [row for row in rows if int(row["eventTime"]) >= recent_cutoff]
    stress = {
      "pips": CHART_SIGNAL_EXECUTION_STRESS_PIPS,
      "overall": aggregate_outcomes(execution_stressed_outcomes(rows)),
      "development": aggregate_outcomes(execution_stressed_outcomes(development)),
      "holdout": aggregate_outcomes(execution_stressed_outcomes(holdout)),
      "recent": aggregate_outcomes(execution_stressed_outcomes(recent)),
    }
    by_year = []
    for year in sorted({_timestamp_year(int(row["eventTime"])) for row in rows}):
      year_rows = [row for row in rows if _timestamp_year(int(row["eventTime"])) == year]
      by_year.append({"year": year, "metrics": aggregate_outcomes(execution_stressed_outcomes(year_rows))})
    evaluable_years = [row for row in by_year if row["metrics"]["evaluableCount"] > 0]
    positive_years = [row for row in evaluable_years if (row["metrics"]["averageR"] or 0) > 0]
    positive_year_share = len(positive_years) / len(evaluable_years) if evaluable_years else 0.0
    prequential = _prequential_pattern_audit(rows)
    target_robustness = _target_robustness_rows(signatures, outcomes_by_target)
    stressed_ci = stress["overall"].get("expectancyCi95") or {}
    checks = {
      "frozenCurrentPattern": bool(definition["current"]),
      "historicallyQualified": _chart_metrics_pass(
        pattern["overall"], pattern["development"], pattern["holdout"]
      ),
      "executionStressOverallPositive": (stress["overall"]["averageR"] or 0) > 0,
      "executionStressDevelopmentPositive": (stress["development"]["averageR"] or 0) > 0,
      "executionStressHoldoutPositive": (stress["holdout"]["averageR"] or 0) > 0,
      "recentSample": stress["recent"]["evaluableCount"] >= 10,
      "recentExecutionStressPositive": (stress["recent"]["averageR"] or 0) > 0,
      "yearCoverage": len(evaluable_years) >= 8,
      "positiveYearShare": positive_year_share >= 0.60,
      "prequentialSample": prequential["evaluableCount"] >= 2,
      "prequentialExecutionStressPositive": (prequential["executionStress"]["averageR"] or 0) > 0,
      "targetRobustnessComplete": len(target_robustness) == len(TARGET_R_VALUES),
      "targetRobustnessPositive": all(
        (row["executionStress"]["averageR"] or 0) > 0 for row in target_robustness
      ),
    }
    # v10 is an explicit immutable registry. The checks remain visible audit
    # dimensions, while registration is no longer silently undone by a generic
    # one-size-fits-all 1 ATR / 2R gate after a setup receives its own frozen exit.
    current_eligible = bool(definition["current"])
    catalog.append({
      **pattern,
      "modelStatus": "current" if current_eligible else "research_only",
      "currentEligible": current_eligible,
      "modelChecks": checks,
      "executionStress": stress,
      "recentWindow": {"from": recent_cutoff, "to": latest_event_time, "metrics": stress["recent"]},
      "yearStability": {
        "evaluableYears": len(evaluable_years),
        "positiveYears": len(positive_years),
        "positiveYearShare": positive_year_share,
        "byYear": by_year,
      },
      "prequentialAudit": prequential,
      "targetRobustness": target_robustness,
      "estimatedBreakEvenStressPips": _estimated_break_even_stress_pips(rows),
      "uncertaintyIncludesNoEdge": (
        stressed_ci.get("lower") is None
        or stressed_ci.get("upper") is None
        or float(stressed_ci["lower"]) <= 0 <= float(stressed_ci["upper"])
      ),
      "selectionNote": (
        "Frozen into the current v10 Charts registry with its declared per-setup execution contract."
        if current_eligible else
        "Retained for Research Replay but excluded from the current Charts model because one or more frozen robustness checks did not pass."
      ),
    })
  return catalog


def discover_qualified_chart_patterns(
  outcomes: Sequence[Dict[str, Any]],
  split_time: int,
) -> List[Dict[str, Any]]:
  """Find frozen recurring v2 patterns that are positive on both time partitions."""
  groups: Dict[str, List[Dict[str, Any]]] = {}
  for outcome in outcomes:
    if outcome.get("direction") not in {"long", "short"}:
      continue
    groups.setdefault(candidate_pattern_signature(outcome), []).append(outcome)

  qualified: List[Dict[str, Any]] = []
  for signature, rows in groups.items():
    pattern = _chart_pattern_summary(signature, rows, split_time)
    overall_metrics = pattern["overall"]
    development_metrics = pattern["development"]
    holdout_metrics = pattern["holdout"]
    if not _chart_metrics_pass(overall_metrics, development_metrics, holdout_metrics):
      continue
    qualified.append(pattern)
  return sorted(qualified, key=lambda item: (-item["holdout"]["averageR"], item["label"], item["direction"]))


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
  scored_rows = [event for event in registered_rows if score_event(event, selected_definition) is not None]
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
