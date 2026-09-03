from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import math
import os
import random
import statistics
import time as _time
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from threading import Lock, RLock
from typing import Any, Dict, List, Optional, Set, Tuple

import MetaTrader5 as mt5
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ValidationError, field_validator

from registered_reaction_audits import registered_context_followup_index, registered_reaction_audit

from macro_signal import (
  ACTIVE_VERSION_ID,
  CHART_SIGNAL_MODEL_CREATED_AT,
  CHART_SIGNAL_MODEL_HASH,
  CHART_SIGNAL_MODEL_ID,
  CHART_SIGNAL_PATTERN_DEFINITIONS,
  CHART_SIGNAL_REGISTRATION_EVIDENCE,
  CANDIDATE_STRESS_SCHEMA_VERSION,
  FORWARD_PAPER_GATE,
  GBPUSD_GROWTH_VERSION_ID,
  GBPUSD_POLICY_INFLATION_VERSION_ID,
  GBPUSD_SENTIMENT_VERSION_ID,
  GBPUSD_V2_VERSION_ID,
  H4_SECONDS,
  MARKET_RESEARCH_SPECS,
  MARKET_SOURCE_VERSION_IDS,
  PAIR_ORIENTATION_VERSION,
  PATH_RESEARCH_HORIZONS,
  RELEASE_REACTION_ENGINE_ID,
  RESULT_SCHEMA_VERSION,
  SIGNAL_DEFINITIONS,
  STRESS_HOLDING_CANDLES,
  STRESS_STOP_ATR_VALUES,
  STRESS_TARGET_R_VALUES,
  TARGET_R_VALUES,
  WORKBENCH_SCORING_ENGINE_VERSION,
  WORKBENCH_RESEARCH_DIAGNOSTICS_VERSION,
  _annotate_numeric_robustness,
  V2_VERSION_ID,
  aggregate_outcomes,
  apply_chart_pattern_reaction,
  build_backtest_result,
  build_candidate_path_profile,
  build_candidate_stress_report,
  build_workbench_experiment,
  build_chart_signal_pattern_catalog,
  build_chart_signal_realtime_watch,
  build_policy_inflation_context,
  build_signal_candidates,
  calculate_atr_by_candle,
  candidate_matches_chart_pattern,
  candidate_pattern_signature,
  dataset_fingerprint,
  evaluate_candidate,
  get_signal_definition,
  rescore_policy_outcomes,
  rescore_forecast_quality_outcomes,
)
from research_store import ResearchStore

logger = logging.getLogger("mt5_bridge")

WORKBENCH_MARKETS = {
  "EURUSD": {"currencies": ["EUR", "USD"], "sourceVersions": list(MARKET_SOURCE_VERSION_IDS["EURUSD"])},
  **{
    symbol: {"currencies": [base, quote], "sourceVersions": list(MARKET_SOURCE_VERSION_IDS[symbol])}
    for symbol, (base, quote, _scope) in MARKET_RESEARCH_SPECS.items()
  },
}

PRACTICAL_MODEL_ID = "FMS-REGISTERED-REACTION-H4-v5"
PRACTICAL_MODEL_CREATED_AT = 1787970337
REVIEWED_EXECUTION_ACTIVATED_AT = 1788134400
CONTEXT_CONDITIONAL_MODEL_ID = "FMS-CONTEXT-CONDITIONAL-H4-v1"
CONTEXT_CONDITIONAL_ACTIVATED_AT = 1788314400
FMS_MANUAL_DEMO_RISK_POLICY = {
  "id": "FMS-MANUAL-DEMO-RISK-v1",
  "maximumRiskPerTradePercent": .25,
  "maximumOpenTrades": 1,
  "maximumPortfolioRiskPercent": .25,
  "maximumPeakToTroughDrawdownPercent": 5.0,
  "maximumConsecutiveLosingTrades": 5,
  "stopRequired": True,
  "scope": "Optional manually placed MT5 demo trades carrying an exact FMS tag; no order transmission.",
}

FMS_TARGET_PATH_LADDER_R = (.25, .5, .75, 1.0, 1.5, 2.0, 3.0, 4.0)


def _target_path_ladder(
  profile: Dict[str, Any], stop_atr: float, expiry_candles: int, market: str,
  incomplete: bool = False,
  m1_by_candle: Optional[Dict[int, List[Dict[str, Any]]]] = None,
) -> List[Dict[str, Any]]:
  """Compare fixed targets against the original SL without rewriting the frozen trade."""
  entry = float(profile["entry"])
  atr = float(profile["atr"])
  sign = float(profile["sign"])
  risk = atr * float(stop_atr)
  stop = entry - sign * risk
  pip_size = .01 if market.endswith("JPY") else .0001
  candles = list(profile.get("candles") or [])[:int(expiry_candles)]
  def same_candle_order(candle: Dict[str, Any], target: float) -> Optional[str]:
    candle_time = int(candle["time"])
    rows = (m1_by_candle or {}).get(candle_time, [])
    if not rows:
      return None
    for row in rows:
      low, high = float(row["low"]), float(row["high"])
      stop_hit = low <= stop if sign > 0 else high >= stop
      target_hit = high >= target if sign > 0 else low <= target
      if stop_hit and target_hit:
        return "ambiguous"
      if target_hit:
        return "target_before_sl"
      if stop_hit:
        return "sl_before_target"
    return None

  ladder: List[Dict[str, Any]] = []
  for target_r in FMS_TARGET_PATH_LADDER_R:
    target = entry + sign * risk * target_r
    status = "pending" if incomplete else "not_reached"
    reached_at: Optional[int] = None
    time_to_target: Optional[int] = None
    for index, candle in enumerate(candles):
      low, high = float(candle["low"]), float(candle["high"])
      stop_hit = low <= stop if sign > 0 else high >= stop
      target_hit = high >= target if sign > 0 else low <= target
      if stop_hit and target_hit:
        status = same_candle_order(candle, target) or "ambiguous"
      elif target_hit:
        status = "target_before_sl"
      elif stop_hit:
        status = "sl_before_target"
      else:
        continue
      reached_at = int(candle["time"])
      if status == "target_before_sl":
        time_to_target = index + 1
      break
    ladder.append({
      "targetR": target_r,
      "targetPrice": target,
      "distanceAtr": stop_atr * target_r,
      "distancePips": risk * target_r / pip_size,
      "status": status,
      "reachedAt": reached_at,
      "timeToTargetCandles": time_to_target,
    })
  return ladder


def _practical_pattern(
  market: str, pattern_id: str, label: str, source_version: str,
  signatures: List[str], scoring_policy: str, stop_atr: float, target_r: float,
  expiry: int, experiment_id: str, historical_n: int, walk_forward_n: int,
  average_r: float, target_rate: float, stop_rate: float, condition: str,
  reaction: str = "continuation",
  cohort: Optional[Dict[str, str]] = None,
  benchmark_basis: str = "qualification_pooled",
  strength: str = "stronger_history",
) -> Dict[str, Any]:
  return {
    "market": market, "id": pattern_id, "label": label,
    "sourceVersion": source_version, "signatures": tuple(signatures),
    "scoringPolicy": scoring_policy, "current": True,
    "reaction": reaction,
    "cohort": dict(cohort or {"dimension": "none", "value": "all"}),
    "activatedAt": PRACTICAL_MODEL_CREATED_AT,
    "execution": {"stopAtr": stop_atr, "targetR": target_r, "expiryCandles": expiry},
    "condition": condition,
    "historicalBenchmark": {
      "experimentId": experiment_id, "historicalN": historical_n,
      "walkForwardN": walk_forward_n, "walkForwardAverageR": average_r,
      "targetFirstRate": target_rate, "stopFirstRate": stop_rate,
      "status": "historically_profitable", "basis": benchmark_basis,
      "strength": strength,
    },
  }


_preserved_eurusd_patterns = tuple({
  **pattern, "market": "EURUSD", "scoringPolicy": "forecast_quality",
  "activatedAt": CHART_SIGNAL_MODEL_CREATED_AT,
} for pattern in CHART_SIGNAL_PATTERN_DEFINITIONS if pattern.get("current") and pattern["id"] != "us-industrial-output-short")

PRACTICAL_PATTERN_DEFINITIONS = (
  _practical_pattern("EURUSD", "us-industrial-output-directional", "US industrial-production package", "FMS-EURUSD-GROWTH-H4-v7", ["long|USD:industrial_output", "short|USD:industrial_output"], "forecast_quality", 1.5, .5, 12, "FMS-EURUSD-H4-E282", 105, 52, .1704458426, .8076923077, .1538461538, "Follow the scored USD industrial-output direction: USD improvement points Short EURUSD; USD weakening points Long EURUSD."),
  _practical_pattern("GBPUSD", "gbpusd-us-industrial-output", "US industrial-production package", "FMS-GBPUSD-GROWTH-H4-v7", ["long|USD:industrial_output", "short|USD:industrial_output"], "forecast_quality", 1, .5, 6, "FMS-GBPUSD-H4-E062", 105, 50, .1478691956, .82, .18, "Follow the scored USD industrial-output direction for GBPUSD."),
  _practical_pattern("USDJPY", "usdjpy-us-consumer-sentiment", "US consumer sentiment", "FMS-USDJPY-SENTIMENT-H4-v3", ["long|USD:consumer_sentiment", "short|USD:consumer_sentiment"], "momentum_only", 2, 1, 60, "FMS-USDJPY-H4-E073", 355, 176, .0903866493, .5397727273, .4488636364, "Use Actual versus Previous only; follow the scored USDJPY direction."),
  _practical_pattern("USDJPY", "usdjpy-jpy-labor-wages", "Japan labor wages", "FMS-USDJPY-LABOR-H4-v2", ["long|JPY:labor_wages", "short|JPY:labor_wages"], "forecast_quality", .75, 4, 6, "FMS-USDJPY-H4-E074", 97, 49, .428517575, .1224489796, .5306122449, "Follow the scored JPY wage direction using Forecast Guard."),
  _practical_pattern("USDJPY", "usdjpy-jpy-inflation", "Japan headline and core inflation", "FMS-USDJPY-POLICY-INFL-H4-v5", ["long|JPY:core_consumer_inflation|JPY:headline_consumer_inflation", "short|JPY:core_consumer_inflation|JPY:headline_consumer_inflation"], "forecast_quality", 2, 1, 30, "FMS-USDJPY-H4-E075", 208, 104, .1013164501, .5288461538, .4326923077, "Follow the scored JPY headline/core inflation direction using Forecast Guard."),
  _practical_pattern("AUDUSD", "audusd-us-producer-inflation", "US producer inflation", "FMS-AUDUSD-POLICY-INFL-H4-v5", ["long|USD:producer_inflation", "short|USD:producer_inflation"], "momentum_only", 2, 2, 12, "FMS-AUDUSD-H4-E050", 94, 47, .1090984769, .1489361702, .3617021277, "Use Actual versus Previous only; follow the scored AUDUSD direction."),
  _practical_pattern("AUDUSD", "audusd-business-confidence-rejection", "Australia business confidence rejection", "FMS-AUDUSD-SENTIMENT-H4-v3", ["long|AUD:business_sentiment", "short|AUD:business_sentiment"], "momentum_only", 1.5, .5, 30, "FMS-AUDUSD-H4-E051", 127, 63, .04015157, .746031746, .253968254, "Use Actual versus Previous only; trade opposite the scored AUD business-confidence direction.", "contrarian"),
  _practical_pattern("GBPUSD", "gbpusd-us-labor-claims", "US labor claims · ordinary magnitude", "FMS-GBPUSD-LABOR-H4-v2", ["long|USD:labor_claims", "short|USD:labor_claims"], "agreement_no_bonus", 2, 4, 60, "FMS-GBPUSD-H4-E061", 357, 178, .2069688213, .1516853933, .6348314607, "Follow the scored US labor-claims direction only when the package's past-only exact-series magnitude is ordinary.", "continuation", {"dimension": "relativeMagnitude", "value": "ordinary"}),
  _practical_pattern("NZDUSD", "nzdusd-us-producer-inflation", "US producer inflation", "FMS-NZDUSD-POLICY-INFL-H4-v5", ["long|USD:producer_inflation", "short|USD:producer_inflation"], "momentum_only", 2, 2, 12, "FMS-NZDUSD-H4-E044", 94, 47, .1585086236, .2127659574, .3404255319, "Use Actual versus Previous only; follow the scored NZDUSD direction."),
  _practical_pattern("NZDUSD", "nzdusd-us-trade-balance", "US trade balance", "FMS-NZDUSD-GROWTH-H4-v7", ["long|USD:trade_balance", "short|USD:trade_balance"], "momentum_only", 1.5, 4, 30, "FMS-NZDUSD-H4-E045", 198, 99, .0401787828, .101010101, .6464646465, "Use Actual versus Previous only; follow the scored NZDUSD direction."),
  _practical_pattern("USDCAD", "usdcad-us-consumer-inflation", "US headline and core inflation", "FMS-USDCAD-POLICY-INFL-H4-v5", ["long|USD:core_consumer_inflation|USD:headline_consumer_inflation", "short|USD:core_consumer_inflation|USD:headline_consumer_inflation"], "agreement_no_bonus", 1.5, 4, 60, "FMS-USDCAD-H4-E043", 265, 132, .2080814094, .2121212121, .696969697, "Follow the scored US headline/core inflation direction without an agreement bonus."),
  _practical_pattern("USDCAD", "usdcad-us-producer-inflation", "US producer inflation", "FMS-USDCAD-POLICY-INFL-H4-v5", ["long|USD:producer_inflation", "short|USD:producer_inflation"], "momentum_only", 2, 1, 30, "FMS-USDCAD-H4-E044", 91, 46, .2196882345, .6086956522, .347826087, "Use Actual versus Previous only; follow the scored USDCAD direction."),
  _practical_pattern("USDCAD", "usdcad-canada-retail-sales", "Canada retail sales", "FMS-USDCAD-GROWTH-H4-v7", ["long|CAD:retail_headline", "short|CAD:retail_headline"], "momentum_only", 1.5, 4, 30, "FMS-USDCAD-H4-E045", 84, 42, .3224750324, .1666666667, .619047619, "Use Actual versus Previous only; follow the scored Canada retail-sales direction."),
  _practical_pattern("USDJPY", "usdjpy-us-producer-inflation-rejection", "US producer inflation rejection", "FMS-USDJPY-POLICY-INFL-H4-v5", ["long|USD:producer_inflation", "short|USD:producer_inflation"], "surprise_only", 1, 2, 6, "FMS-USDJPY-H4-E067", 101, 51, .1011688719, .2549019608, .5098039216, "Use Actual versus Forecast only; trade opposite the scored USD producer-inflation direction.", "contrarian"),
  _practical_pattern("USDJPY", "usdjpy-us-manufacturing-employment", "US manufacturing employment", "FMS-USDJPY-GROWTH-H4-v7", ["long|USD:pmi_manufacturing", "short|USD:pmi_manufacturing"], "forecast_quality", 2, .5, 60, "FMS-USDJPY-H4-E068", 194, 97, .0666507331, .7113402062, .2886597938, "Follow the Forecast Guard-scored US manufacturing-employment package direction."),
  _practical_pattern("USDJPY", "usdjpy-us-trade-balance-ordinary", "US trade balance · ordinary magnitude", "FMS-USDJPY-GROWTH-H4-v7", ["long|USD:trade_balance", "short|USD:trade_balance"], "surprise_only", 2, .5, 30, "FMS-USDJPY-H4-E070", 109, 55, .1723702861, .7818181818, .2181818182, "Use Actual versus Forecast only; follow the scored USDJPY direction when the package's past-only exact-series magnitude is ordinary.", "continuation", {"dimension": "relativeMagnitude", "value": "ordinary"}),
)
def _discovered_condition(label: str, scoring_policy: str, reaction: str, cohort: Dict[str, str]) -> str:
  score_text = {
    "baseline": "Use the original Surprise plus Momentum score",
    "surprise_only": "Use Actual versus Forecast only",
    "momentum_only": "Use Actual versus Previous only",
    "agreement_no_bonus": "Use Surprise plus Momentum without the agreement bonus",
    "forecast_quality": "Use Forecast Guard",
  }[scoring_policy]
  reaction_text = "trade opposite the scored pair direction" if reaction == "contrarian" else "follow the scored pair direction"
  cohort_text = " when its past-only exact-series magnitude is ordinary" if cohort == {"dimension": "relativeMagnitude", "value": "ordinary"} else ""
  return f"{score_text}; {reaction_text} for {label}{cohort_text}."


# One development-selected direction per market/package. Each row is linked to
# an immutable current-engine experiment and its untouched chronological holdout.
_PRACTICAL_DISCOVERY_ROWS = (
  ('AUDUSD', 'audusd-ism-manufacturing-employment-package', 'ISM Manufacturing Employment', 'FMS-AUDUSD-GROWTH-H4-v7', ('long|USD:pmi_manufacturing', 'short|USD:pmi_manufacturing'), 'forecast_quality', 'contrarian', {'dimension': 'relativeMagnitude', 'value': 'ordinary'}, 0.75, 4.0, 12, 'FMS-AUDUSD-H4-E055', 154, 44, 0.0516272054, 0.2045454545, 0.7272727273, 'stronger_history'),
  ('AUDUSD', 'audusd-s-p-global-manufacturing-pmi', 'S&P Global Manufacturing PMI', 'FMS-AUDUSD-GROWTH-H4-v7', ('long|AUD:pmi_manufacturing', 'short|AUD:pmi_manufacturing'), 'momentum_only', 'continuation', {'dimension': 'none', 'value': 'all'}, 2.0, 0.5, 6, 'FMS-AUDUSD-H4-E057', 83, 36, 0.0008395462, 0.5555555556, 0.1388888889, 'positive_but_fragile'),
  ('AUDUSD', 'audusd-us-payroll-package', 'US payroll', 'FMS-AUDUSD-LABOR-H4-v2', ('long|USD:employment|USD:labor_wages|USD:unemployment', 'short|USD:employment|USD:labor_wages|USD:unemployment'), 'agreement_no_bonus', 'contrarian', {'dimension': 'relativeMagnitude', 'value': 'ordinary'}, 1.5, 1.0, 30, 'FMS-AUDUSD-H4-E058', 77, 31, 0.0509961771, 0.5483870968, 0.4193548387, 'stronger_history'),
  ('EURUSD', 'eurusd-business-climate-indicator-package', 'Business Climate Indicator', 'FMS-EURUSD-SENTIMENT-H4-v3', ('long|EUR:business_sentiment|EUR:consumer_sentiment', 'short|EUR:business_sentiment|EUR:consumer_sentiment'), 'surprise_only', 'continuation', {'dimension': 'relativeMagnitude', 'value': 'ordinary'}, 1.0, 1.0, 6, 'FMS-EURUSD-H4-E283', 68, 27, 0.072615107, 0.5555555556, 0.3333333333, 'stronger_history'),
  ('EURUSD', 'eurusd-cpi-package', 'US CPI · ordinary magnitude', 'FMS-EURUSD-POLICY-INFL-H4-v5', ('long|USD:core_consumer_inflation|USD:headline_consumer_inflation', 'short|USD:core_consumer_inflation|USD:headline_consumer_inflation'), 'agreement_no_bonus', 'continuation', {'dimension': 'relativeMagnitude', 'value': 'ordinary'}, 2.0, 4.0, 30, 'FMS-EURUSD-H4-E284', 206, 73, 0.0563732631, 0.0684931507, 0.5753424658, 'positive_but_fragile'),
  ('EURUSD', 'eurusd-ism-manufacturing-employment-package', 'US manufacturing employment rejection', 'FMS-EURUSD-GROWTH-H4-v7', ('long|USD:pmi_manufacturing', 'short|USD:pmi_manufacturing'), 'forecast_quality', 'contrarian', {'dimension': 'relativeMagnitude', 'value': 'ordinary'}, 2.0, 1.0, 6, 'FMS-EURUSD-H4-E286', 154, 42, 0.0410342046, 0.2857142857, 0.2142857143, 'positive_but_fragile'),
  ('EURUSD', 'eurusd-retail-sales-m-m-package', 'Euro-area retail sales', 'FMS-EURUSD-GROWTH-H4-v7', ('long|EUR:retail_headline', 'short|EUR:retail_headline'), 'baseline', 'continuation', {'dimension': 'none', 'value': 'all'}, 2.0, 4.0, 30, 'FMS-EURUSD-H4-E287', 95, 28, 0.0249631544, 0.0, 0.5357142857, 'positive_but_fragile'),
  ('EURUSD', 'eurusd-s-p-global-composite-pmi-package', 'Euro-area composite PMI', 'FMS-EURUSD-GROWTH-H4-v7', ('long|EUR:pmi_composite|EUR:pmi_manufacturing|EUR:pmi_services', 'short|EUR:pmi_composite|EUR:pmi_manufacturing|EUR:pmi_services'), 'surprise_only', 'continuation', {'dimension': 'relativeMagnitude', 'value': 'ordinary'}, 2.0, 0.5, 6, 'FMS-EURUSD-H4-E288', 54, 25, 0.0984286905, 0.64, 0.12, 'stronger_history'),
  ('GBPUSD', 'gbpusd-average-weekly-earnings-regular-pay-y-y-package', 'UK labor package rejection', 'FMS-GBPUSD-LABOR-H4-v2', ('long|GBP:employment|GBP:labor_claims|GBP:labor_wages|GBP:unemployment', 'short|GBP:employment|GBP:labor_claims|GBP:labor_wages|GBP:unemployment'), 'surprise_only', 'contrarian', {'dimension': 'none', 'value': 'all'}, 2.0, 2.0, 12, 'FMS-GBPUSD-H4-E063', 57, 16, 0.4391023316, 0.25, 0.25, 'stronger_history'),
  ('GBPUSD', 'gbpusd-gdp-sales-q-q-package', 'US GDP rejection', 'FMS-GBPUSD-GROWTH-H4-v7', ('long|USD:gdp', 'short|USD:gdp'), 'forecast_quality', 'contrarian', {'dimension': 'none', 'value': 'all'}, 2.0, 1.0, 12, 'FMS-GBPUSD-H4-E065', 68, 17, 0.0966002026, 0.4117647059, 0.1764705882, 'stronger_history'),
  ('GBPUSD', 'gbpusd-ism-non-manufacturing-business-activity-package', 'US services activity', 'FMS-GBPUSD-GROWTH-H4-v7', ('long|USD:pmi_services', 'short|USD:pmi_services'), 'forecast_quality', 'continuation', {'dimension': 'none', 'value': 'all'}, 2.0, 1.0, 6, 'FMS-GBPUSD-H4-E066', 85, 30, 0.0534054655, 0.2, 0.1666666667, 'stronger_history'),
  ('NZDUSD', 'nzdusd-gdp-annual-change-package', 'New Zealand GDP rejection', 'FMS-NZDUSD-GROWTH-H4-v7', ('long|NZD:gdp', 'short|NZD:gdp'), 'momentum_only', 'contrarian', {'dimension': 'none', 'value': 'all'}, 1.0, 4.0, 12, 'FMS-NZDUSD-H4-E048', 58, 21, 0.3484534399, 0.1428571429, 0.5714285714, 'stronger_history'),
  ('NZDUSD', 'nzdusd-gdp-sales-q-q-package', 'US GDP', 'FMS-NZDUSD-GROWTH-H4-v7', ('long|USD:gdp', 'short|USD:gdp'), 'momentum_only', 'continuation', {'dimension': 'none', 'value': 'all'}, 1.0, 1.0, 30, 'FMS-NZDUSD-H4-E049', 67, 16, 0.1080757074, 0.625, 0.375, 'stronger_history'),
  ('NZDUSD', 'nzdusd-us-payroll-package', 'US payroll rejection', 'FMS-NZDUSD-LABOR-H4-v2', ('long|USD:employment|USD:labor_wages|USD:unemployment', 'short|USD:employment|USD:labor_wages|USD:unemployment'), 'surprise_only', 'contrarian', {'dimension': 'relativeMagnitude', 'value': 'ordinary'}, 2.0, 1.0, 60, 'FMS-NZDUSD-H4-E052', 63, 27, 0.1900285888, 0.6296296296, 0.3703703704, 'stronger_history'),
  ('USDCAD', 'usdcad-gdp-annualized-q-q-package', 'Canada GDP rejection', 'FMS-USDCAD-GROWTH-H4-v7', ('long|CAD:gdp', 'short|CAD:gdp'), 'agreement_no_bonus', 'contrarian', {'dimension': 'relativeMagnitude', 'value': 'ordinary'}, 1.5, 0.5, 12, 'FMS-USDCAD-H4-E049', 68, 26, 0.0186839436, 0.7307692308, 0.2692307692, 'positive_but_fragile'),
  ('USDCAD', 'usdcad-gdp-sales-q-q-package', 'US GDP rejection', 'FMS-USDCAD-GROWTH-H4-v7', ('long|USD:gdp', 'short|USD:gdp'), 'momentum_only', 'contrarian', {'dimension': 'none', 'value': 'all'}, 1.5, 4.0, 60, 'FMS-USDCAD-H4-E050', 49, 11, 0.5415198612, 0.2727272727, 0.6363636364, 'stronger_history'),
  ('USDCAD', 'usdcad-ism-manufacturing-employment-package', 'US manufacturing employment rejection', 'FMS-USDCAD-GROWTH-H4-v7', ('long|USD:pmi_manufacturing', 'short|USD:pmi_manufacturing'), 'forecast_quality', 'contrarian', {'dimension': 'relativeMagnitude', 'value': 'ordinary'}, 1.0, 2.0, 12, 'FMS-USDCAD-H4-E051', 154, 44, 0.0866762372, 0.3863636364, 0.5454545455, 'stronger_history'),
  ('USDCAD', 'usdcad-s-p-global-composite-pmi-package', 'US composite PMI rejection', 'FMS-USDCAD-GROWTH-H4-v7', ('long|USD:pmi_composite|USD:pmi_services', 'short|USD:pmi_composite|USD:pmi_services'), 'surprise_only', 'contrarian', {'dimension': 'none', 'value': 'all'}, 2.0, 0.5, 12, 'FMS-USDCAD-H4-E052', 90, 27, 0.0616019765, 0.7407407407, 0.2222222222, 'positive_but_fragile'),
  ('USDCHF', 'usdchf-fed-industrial-production-m-m-package', 'US industrial-production rejection', 'FMS-USDCHF-GROWTH-H4-v7', ('long|USD:industrial_output', 'short|USD:industrial_output'), 'momentum_only', 'contrarian', {'dimension': 'none', 'value': 'all'}, 2.0, 2.0, 6, 'FMS-USDCHF-H4-E052', 88, 29, 0.0020527979, 0.0344827586, 0.1034482759, 'positive_but_fragile'),
  ('USDCHF', 'usdchf-ppi-m-m-package', 'Switzerland producer inflation', 'FMS-USDCHF-POLICY-INFL-H4-v5', ('long|CHF:producer_inflation', 'short|CHF:producer_inflation'), 'momentum_only', 'continuation', {'dimension': 'relativeMagnitude', 'value': 'ordinary'}, 1.5, 0.5, 6, 'FMS-USDCHF-H4-E053', 62, 26, 0.0115849761, 0.6153846154, 0.1538461538, 'positive_but_fragile'),
  ('USDCHF', 'usdchf-us-employment-release', 'US employment rejection', 'FMS-USDCHF-LABOR-H4-v2', ('long|USD:employment', 'short|USD:employment'), 'momentum_only', 'contrarian', {'dimension': 'none', 'value': 'all'}, 2.0, 0.5, 6, 'FMS-USDCHF-H4-E054', 118, 37, 0.0068248223, 0.5675675676, 0.1081081081, 'positive_but_fragile'),
  ('USDJPY', 'usdjpy-adjusted-current-account-package', 'Japan current-account rejection', 'FMS-USDJPY-GROWTH-H4-v7', ('long|JPY:current_account|JPY:trade_balance', 'short|JPY:current_account|JPY:trade_balance'), 'surprise_only', 'contrarian', {'dimension': 'relativeMagnitude', 'value': 'ordinary'}, 1.0, 0.5, 6, 'FMS-USDJPY-H4-E076', 52, 21, 0.0826437667, 0.7142857143, 0.2380952381, 'stronger_history'),
  ('USDJPY', 'usdjpy-consumer-confidence-index', 'Japan consumer-confidence rejection', 'FMS-USDJPY-SENTIMENT-H4-v3', ('long|JPY:consumer_sentiment', 'short|JPY:consumer_sentiment'), 'forecast_quality', 'contrarian', {'dimension': 'relativeMagnitude', 'value': 'ordinary'}, 1.0, 1.0, 6, 'FMS-USDJPY-H4-E077', 64, 24, 0.1371245061, 0.5416666667, 0.4166666667, 'stronger_history'),
  ('USDJPY', 'usdjpy-fed-industrial-production-m-m-package', 'US industrial-production rejection', 'FMS-USDJPY-GROWTH-H4-v7', ('long|USD:industrial_output', 'short|USD:industrial_output'), 'forecast_quality', 'contrarian', {'dimension': 'relativeMagnitude', 'value': 'ordinary'}, 2.0, 0.5, 30, 'FMS-USDJPY-H4-E078', 78, 34, 0.0143626214, 0.6764705882, 0.3235294118, 'positive_but_fragile'),
  ('USDJPY', 'usdjpy-ism-non-manufacturing-business-activity-package', 'US services activity', 'FMS-USDJPY-GROWTH-H4-v7', ('long|USD:pmi_services', 'short|USD:pmi_services'), 'forecast_quality', 'continuation', {'dimension': 'relativeMagnitude', 'value': 'ordinary'}, 2.0, 4.0, 60, 'FMS-USDJPY-H4-E081', 64, 30, 0.1030859274, 0.1, 0.6333333333, 'stronger_history'),
  ('USDJPY', 'usdjpy-industrial-production-forecast-1-month-ahead-m-m-package', 'Japan industrial output and retail rejection', 'FMS-USDJPY-GROWTH-H4-v7', ('long|JPY:industrial_output|JPY:retail_headline', 'short|JPY:industrial_output|JPY:retail_headline'), 'baseline', 'contrarian', {'dimension': 'none', 'value': 'all'}, 2.0, 0.5, 6, 'FMS-USDJPY-H4-E082', 46, 21, 0.1779117676, 0.619047619, 0.0952380952, 'stronger_history'),
  ('USDJPY', 'usdjpy-us-employment-release', 'US employment rejection', 'FMS-USDJPY-LABOR-H4-v2', ('long|USD:employment', 'short|USD:employment'), 'surprise_only', 'contrarian', {'dimension': 'none', 'value': 'all'}, 2.0, 2.0, 6, 'FMS-USDJPY-H4-E083', 107, 36, 0.0836099257, 0.0833333333, 0.2222222222, 'positive_but_fragile'),
  ('USDJPY', 'usdjpy-us-payroll-package', 'US payroll rejection', 'FMS-USDJPY-LABOR-H4-v2', ('long|USD:employment|USD:labor_wages|USD:unemployment', 'short|USD:employment|USD:labor_wages|USD:unemployment'), 'baseline', 'contrarian', {'dimension': 'relativeMagnitude', 'value': 'ordinary'}, 0.75, 0.5, 30, 'FMS-USDJPY-H4-E084', 77, 26, 0.0953631248, 0.7307692308, 0.2692307692, 'stronger_history'),
)

PRACTICAL_PATTERN_DEFINITIONS += tuple(
  _practical_pattern(
    market, pattern_id, label, source_version, list(signatures), scoring_policy,
    stop_atr, target_r, expiry, experiment_id, historical_n, later_n,
    later_average_r, target_rate, stop_rate,
    _discovered_condition(label, scoring_policy, reaction, cohort),
    reaction, cohort, "chronological_holdout", strength,
  )
  for (
    market, pattern_id, label, source_version, signatures, scoring_policy,
    reaction, cohort, stop_atr, target_r, expiry, experiment_id, historical_n,
    later_n, later_average_r, target_rate, stop_rate, strength,
  ) in _PRACTICAL_DISCOVERY_ROWS
)

_legacy_by_id = {pattern["id"]: pattern for pattern in _preserved_eurusd_patterns}
PRACTICAL_PATTERN_DEFINITIONS += (
  _practical_pattern("EURUSD", "eurusd-us-payroll-short-restored", "US payroll", _legacy_by_id["us-payroll-short"]["sourceVersion"], list(_legacy_by_id["us-payroll-short"]["signatures"]), "forecast_quality", 2, 1, 6, "FMS-EURUSD-H4-E289", 55, 14, .2498051148, .3571428571, .0714285714, _legacy_by_id["us-payroll-short"]["condition"], "continuation", {"dimension": "none", "value": "all"}, "chronological_holdout", "stronger_history"),
  _practical_pattern("EURUSD", "eurusd-consumer-sentiment-restored", "Euro-area consumer sentiment", _legacy_by_id["euro-consumer-sentiment-directional"]["sourceVersion"], list(_legacy_by_id["euro-consumer-sentiment-directional"]["signatures"]), "forecast_quality", 1, 2, 30, "FMS-EURUSD-H4-E291", 100, 26, .3847168593, .5, .5, _legacy_by_id["euro-consumer-sentiment-directional"]["condition"], "continuation", {"dimension": "none", "value": "all"}, "chronological_holdout", "stronger_history"),
  {
    **_practical_pattern("EURUSD", "eurusd-us-producer-inflation-cooling-restored", "US producer-inflation cooling package", _legacy_by_id["us-producer-inflation-cooling-long"]["sourceVersion"], list(_legacy_by_id["us-producer-inflation-cooling-long"]["signatures"]), "forecast_quality", 2, 1.25, 18, "FMS-EURUSD-H4-E293", 46, 11, .5249552155, .5454545455, .1818181818, _legacy_by_id["us-producer-inflation-cooling-long"]["condition"], "continuation", {"dimension": "none", "value": "all"}, "chronological_holdout", "stronger_history"),
    "requiredExactTitles": tuple(_legacy_by_id["us-producer-inflation-cooling-long"].get("requiredExactTitles", ())),
  },
)

PRACTICAL_PATTERN_DEFINITIONS = tuple({
  **pattern,
  "reactionAudit": registered_reaction_audit(str(pattern["market"]), str(pattern["id"])),
} for pattern in PRACTICAL_PATTERN_DEFINITIONS)

# Explicit human/AI-reviewed promotions. The allowlist freezes the exact
# execution rule and the immutable price/calendar fingerprints reviewed on
# 2026-08-31. Regenerating research cannot silently change an active contract.
_REVIEWED_EXECUTION_APPROVALS: Dict[Tuple[str, str], Dict[str, Any]] = {
  ("AUDUSD", "audusd-us-producer-inflation"): {
    "family": "break_even", "stopAtr": 2.0, "targetR": 2.5,
    "expiryCandles": 60, "triggerR": 1.5,
    "candleFingerprint": "73b091939216f1e2fad7735fa4d7d0376769149a95d35e781870c51098026c8d",
    "datasetFingerprint": "3004f4677e656baa24faae6ac9eba9c0eacd53adca942836f077fb7b4c0c9abd",
  },
  ("NZDUSD", "nzdusd-us-producer-inflation"): {
    "family": "break_even", "stopAtr": 1.25, "targetR": 2.5,
    "expiryCandles": 30, "triggerR": 1.0,
    "candleFingerprint": "93dc9e641f9c7703270b5d82341a2942aea7019e55374d2ffbc1e69903525bb7",
    "datasetFingerprint": "235163109f95be38c8436174658589d2f3394057585b3694b415a1df7927d2e1",
  },
  ("USDJPY", "usdjpy-jpy-inflation"): {
    "family": "break_even", "stopAtr": .5, "targetR": 4.0,
    "expiryCandles": 30, "triggerR": .5,
    "candleFingerprint": "4cc95054fca2ac4bfe07b835ed59065357ddd7bb5fa56ceca654fea7e4e98f16",
    "datasetFingerprint": "2ab9138755448726a788dabb18ae00d61a65f491ae416d4b4d892713a32f1106",
  },
}


def _apply_reviewed_execution(pattern: Dict[str, Any]) -> Dict[str, Any]:
  approval = _REVIEWED_EXECUTION_APPROVALS.get((str(pattern["market"]), str(pattern["id"])))
  if not approval:
    return pattern
  artifact = (((pattern.get("reactionAudit") or {}).get("profile") or {}).get("executionChallenger") or {})
  best = artifact.get("bestChallenger") or {}
  review = artifact.get("registryReview") or {}
  expected = {
    "family": approval["family"], "stopAtr": approval["stopAtr"],
    "targetR": approval["targetR"], "holdingCandles": approval["expiryCandles"],
    "triggerR": approval["triggerR"],
  }
  artifact_matches = (
    artifact.get("schema") == "fms-execution-challenger-v2"
    and review.get("decision") == "approved_for_registry_review"
    and all(best.get(key) == value for key, value in expected.items())
    and artifact.get("candleFingerprint") == approval["candleFingerprint"]
    and artifact.get("datasetFingerprint") == approval["datasetFingerprint"]
  )
  if not artifact_matches:
    return {
      **pattern,
      "executionReview": {
        "status": "blocked_artifact_mismatch", "activatedAt": REVIEWED_EXECUTION_ACTIVATED_AT,
        "reason": "The reviewed challenger no longer matches its immutable artifact; the prior contract remains active.",
      },
    }
  base_execution = dict(pattern["execution"])
  current_execution = {
    "stopAtr": approval["stopAtr"], "targetR": approval["targetR"],
    "expiryCandles": approval["expiryCandles"],
    "managementFamily": approval["family"], "managementTriggerR": approval["triggerR"],
  }
  later = best.get("later") or {}
  stability = best.get("nearbyStability") or {}
  return {
    **pattern,
    "baseExecution": base_execution,
    "execution": current_execution,
    "executionReview": {
      "status": "reviewed_active", "activatedAt": REVIEWED_EXECUTION_ACTIVATED_AT,
      "artifactSchema": artifact.get("schema"),
      "configurationHash": artifact.get("configurationHash"),
      "candleFingerprint": artifact.get("candleFingerprint"),
      "datasetFingerprint": artifact.get("datasetFingerprint"),
      "previousExecution": base_execution,
      "currentExecution": current_execution,
      "later": later,
      "nearbyStability": stability,
      "reason": review.get("reason"),
      "limitations": review.get("limitations"),
    },
  }


PRACTICAL_PATTERN_DEFINITIONS = tuple(_apply_reviewed_execution(pattern) for pattern in PRACTICAL_PATTERN_DEFINITIONS)

# Exact context registrations are added only after the generated artifact has
# been reviewed. The allowlist is intentionally code-owned: regenerating a
# research file cannot silently alter a live Shadow Trader rule.
_REVIEWED_CONTEXT_APPROVALS: Dict[Tuple[str, str], Dict[str, Any]] = {
  ("NZDUSD", "nzdusd-us-trade-balance"): {
    "id": "FMS-NZDUSD-H4-CTX-C001", "dimension": "trendRelation", "value": "opposed",
    "managementFamily": "fixed", "managementTriggerR": None,
    "stopAtr": 1.5, "targetR": 4.0, "expiryCandles": 30,
    "configurationHash": "8daf8f1fd4d4c58f5cbf26799201a7e55a0a71317656e121b7fd40586810b7ec",
    "candleFingerprint": "54ac23a123b5f899b51f3a66e55f0dec03527971e75f7392d8bdcb43f9c4b2c6",
    "datasetFingerprint": "235163109f95be38c8436174658589d2f3394057585b3694b415a1df7927d2e1",
  },
  ("USDJPY", "usdjpy-us-consumer-sentiment"): {
    "id": "FMS-USDJPY-H4-CTX-C001", "dimension": "macroBackground", "value": "aligned",
    "managementFamily": "fixed", "managementTriggerR": None,
    "stopAtr": 2.0, "targetR": 1.0, "expiryCandles": 60,
    "configurationHash": "8daf8f1fd4d4c58f5cbf26799201a7e55a0a71317656e121b7fd40586810b7ec",
    # Coverage refresh changed only the encompassing candle fingerprint; the
    # selected context, execution, and every development/later metric remained identical.
    "candleFingerprint": "964a87dcd31a383881f4e8c94ecf063f1a024297493eca0ed2ec2f2fde3f31e1",
    "datasetFingerprint": "2ab9138755448726a788dabb18ae00d61a65f491ae416d4b4d892713a32f1106",
  },
  ("USDJPY", "usdjpy-us-manufacturing-employment"): {
    "id": "FMS-USDJPY-H4-CTX-C002", "dimension": "macroBackground", "value": "aligned",
    "managementFamily": "fixed", "managementTriggerR": None,
    "stopAtr": .75, "targetR": 3.0, "expiryCandles": 18,
    "configurationHash": "8daf8f1fd4d4c58f5cbf26799201a7e55a0a71317656e121b7fd40586810b7ec",
    "candleFingerprint": "459218e89490d46778c74594e433b296cf33a426e3fb717b182b23393026f5d3",
    "datasetFingerprint": "2ab9138755448726a788dabb18ae00d61a65f491ae416d4b4d892713a32f1106",
  },
  ("USDJPY", "usdjpy-us-payroll-package"): {
    "id": "FMS-USDJPY-H4-CTX-C003", "dimension": "directionalRoom", "value": "open",
    "managementFamily": "fixed", "managementTriggerR": None,
    "stopAtr": .75, "targetR": .5, "expiryCandles": 30,
    "configurationHash": "8daf8f1fd4d4c58f5cbf26799201a7e55a0a71317656e121b7fd40586810b7ec",
    "candleFingerprint": "02bc5b4faa5bd632a100bb9f2a2c1dbd9a1acce5516d5f94c6d9d3c90df8afef",
    "datasetFingerprint": "2ab9138755448726a788dabb18ae00d61a65f491ae416d4b4d892713a32f1106",
  },
}


def _apply_reviewed_context(pattern: Dict[str, Any]) -> Dict[str, Any]:
  approval = _REVIEWED_CONTEXT_APPROVALS.get((str(pattern["market"]), str(pattern["id"])))
  if not approval:
    return pattern
  research = (((pattern.get("reactionAudit") or {}).get("profile") or {}).get("contextResearch") or {})
  conditioned = research.get("conditionedExecution") or {}
  condition = conditioned.get("condition") or {}
  execution = conditioned.get("selectedExecution") or {}
  expected_execution = {
    "managementFamily": approval["managementFamily"],
    "managementTriggerR": approval.get("managementTriggerR"),
    "stopAtr": approval["stopAtr"],
    "targetR": approval["targetR"],
    "expiryCandles": approval["expiryCandles"],
  }
  artifact_matches = (
    conditioned.get("schema") == "fms-context-conditioned-execution-v1"
    and conditioned.get("status") == "approved_for_code_review"
    and condition.get("dimension") == approval["dimension"]
    and condition.get("value") == approval["value"]
    and condition.get("knownAt") == "entry"
    and all(execution.get(key) == value for key, value in expected_execution.items())
    and research.get("configurationHash") == approval["configurationHash"]
    and research.get("candleFingerprint") == approval["candleFingerprint"]
    and research.get("datasetFingerprint") == approval["datasetFingerprint"]
  )
  if not artifact_matches:
    return {
      **pattern,
      "contextRegistration": {
        "id": approval["id"], "modelId": CONTEXT_CONDITIONAL_MODEL_ID,
        "status": "blocked_artifact_mismatch", "activatedAt": CONTEXT_CONDITIONAL_ACTIVATED_AT,
        "reason": "The reviewed context no longer matches its immutable artifact; the parent setup remains unchanged.",
      },
    }
  return {
    **pattern,
    "contextRegistration": {
      "id": approval["id"], "modelId": CONTEXT_CONDITIONAL_MODEL_ID,
      "status": "reviewed_active", "activatedAt": CONTEXT_CONDITIONAL_ACTIVATED_AT,
      "parentPatternId": str(pattern["id"]), "market": str(pattern["market"]),
      "condition": {"dimension": approval["dimension"], "value": approval["value"], "knownAt": "entry"},
      "execution": expected_execution,
      "parentBehaviorWhenContextDoesNotMatch": "retain_parent",
      "configurationHash": research.get("configurationHash"),
      "researchExperimentId": research.get("researchExperimentId"),
      "candleFingerprint": research.get("candleFingerprint"),
      "datasetFingerprint": research.get("datasetFingerprint"),
      "development": conditioned.get("selectedDevelopment"),
      "later": conditioned.get("selectedLater"),
      "parentOnSameContextLater": conditioned.get("activeContextLater"),
      "reaction": (research.get("selectedCandidate") or {}).get("laterReaction"),
      "relationship": (research.get("selectedCandidate") or {}).get("relationship"),
      "limitations": conditioned.get("limitations"),
    },
  }


PRACTICAL_PATTERN_DEFINITIONS = tuple(_apply_reviewed_context(pattern) for pattern in PRACTICAL_PATTERN_DEFINITIONS)

PRACTICAL_MODEL_HASH = hashlib.sha256(json.dumps(PRACTICAL_PATTERN_DEFINITIONS, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

FMS_RESEARCH_INTELLIGENCE = (
  {
    "id": "usdcad-us-pmi-orientation-rejected", "status": "avoid", "market": "USDCAD",
    "label": "US composite and services PMI",
    "evidence": "The corrected base/quote replay reversed the old registration and produced -0.22R across 47 later walk-forward cases.",
    "conclusion": "The old USDCAD arrow was an orientation defect. Do not use this direct mapping as a registered setup.",
  },
  {
    "id": "usdcad-us-labor-claims-orientation-rejected", "status": "avoid", "market": "USDCAD",
    "label": "US labor claims",
    "evidence": "After pair-orientation repair, its selected-contract holdout and recent averages were negative and the walk-forward average was only +0.01R.",
    "conclusion": "Removed from the registered scanner; retain it only as research context.",
  },
  {
    "id": "usdjpy-us-labor-claims-rejected", "status": "avoid", "market": "USDJPY",
    "label": "US labor claims",
    "evidence": "The corrected rebuild selected a contract whose fixed later holdout and recent averages were negative.",
    "conclusion": "Removed from the registered scanner until an entry-known treatment survives later data.",
  },
  {
    "id": "eurusd-us-manufacturing-pmi-contender", "status": "contender", "market": "EURUSD",
    "label": "Aligned US manufacturing PMI",
    "evidence": "Later history was strongly positive, while the older development period was approximately flat.",
    "conclusion": "Possible regime-dependent reaction; do not register until the older weakness is explained by an entry-known rule.",
  },
  {
    "id": "gbpusd-us-producer-inflation-avoid", "status": "avoid", "market": "GBPUSD",
    "label": "US producer inflation",
    "evidence": "The fixed walk-forward audit produced only 2/5 positive folds and a negative 90% lower bound.",
    "conclusion": "Do not use its direct economic direction as a standalone GBPUSD arrow.",
  },
  {
    "id": "eurusd-us-labor-claims-avoid", "status": "avoid", "market": "EURUSD",
    "label": "US labor claims",
    "evidence": "Broad continuation and S/M-agreement experiments both had negative holdout and recent average R.",
    "conclusion": "The direct release direction has not been historically dependable for EURUSD.",
  },
  {
    "id": "eurusd-us-consumer-inflation-avoid", "status": "avoid", "market": "EURUSD",
    "label": "Broad US consumer inflation direct mapping",
    "evidence": "The unrestricted all-case direction did not persist in important later partitions. This does not invalidate the separately registered ordinary-magnitude CPI package.",
    "conclusion": "Avoid the broad mapping; use only the exact frozen magnitude-conditioned recipe shown in the registered list.",
  },
  {
    "id": "eurusd-us-consumer-sentiment-avoid", "status": "avoid", "market": "EURUSD",
    "label": "US consumer sentiment direct mapping",
    "evidence": "High-N direct tests were weak or negative across important partitions.",
    "conclusion": "Do not assume EURUSD will follow the release direction without a separately frozen condition.",
  },
)


def _registration_provenance(pattern: Dict[str, Any]) -> Dict[str, Any]:
  """Reconcile a practical registration with its immutable experiment/audit."""
  benchmark = pattern.get("historicalBenchmark")
  if not isinstance(benchmark, dict):
    return {
      "status": "legacy_snapshot",
      "experimentId": None,
      "configurationHash": None,
      "datasetFingerprint": None,
      "qualificationAuditId": None,
      "checks": {},
      "note": "Archived snapshot: no immutable Workbench experiment is linked, so source diagnostics are not an active registered-contract benchmark.",
    }
  experiment_id = str(benchmark.get("experimentId") or "")
  experiment = _research_store.get_fms_experiment(experiment_id) if experiment_id else None
  if not experiment or experiment.get("status") != "completed" or not isinstance(experiment.get("result"), dict):
    return {
      "status": "unavailable",
      "experimentId": experiment_id or None,
      "configurationHash": None if not experiment else experiment.get("configurationHash"),
      "datasetFingerprint": None if not experiment else experiment.get("datasetFingerprint"),
      "qualificationAuditId": None,
      "checks": {},
      "note": "The linked immutable experiment is unavailable or incomplete. Treat the registration benchmark as unverified.",
    }
  result = experiment["result"]
  configuration = experiment.get("configuration") or {}
  selected = result.get("selectedConfiguration") or {}
  audit = _research_store.latest_fms_qualification_audit(experiment_id)
  pooled = ((audit or {}).get("walkForward") or {}).get("pooled") or {}
  benchmark_basis = str(benchmark.get("basis") or "qualification_pooled")
  benchmark_partition = (
    selected.get("holdout") or {}
    if benchmark_basis == "chronological_holdout"
    else pooled
  )
  # The immutable source experiment verifies the originally registered fixed
  # contract. A reviewed execution overlay owns separate artifact provenance.
  execution = pattern.get("baseExecution") or pattern.get("execution") or {}
  expected_signatures = sorted(str(value) for value in pattern.get("signatures") or ())
  actual_signatures = sorted(str(value) for value in configuration.get("signatures") or ())
  if not actual_signatures and configuration.get("signature"):
    actual_signatures = [str(configuration["signature"])]

  def close(left: Any, right: Any, tolerance: float = 1e-8) -> bool:
    try:
      return abs(float(left) - float(right)) <= tolerance
    except (TypeError, ValueError):
      return False

  checks = {
    "market": str(configuration.get("market") or result.get("market") or "") == str(pattern.get("market") or "EURUSD"),
    "sourceVersion": str(result.get("sourceVersionId") or configuration.get("sourceVersionId") or "") == str(pattern.get("sourceVersion") or pattern.get("sourceVersionId") or ""),
    "signatures": actual_signatures == expected_signatures,
    "scoringPolicy": str(configuration.get("scoringPolicy") or result.get("scoringPolicy") or "") == str(pattern.get("scoringPolicy") or "forecast_quality"),
    "reaction": str(configuration.get("reaction") or result.get("reaction") or "continuation") == str(pattern.get("reaction") or "continuation"),
    "cohort": dict(configuration.get("cohort") or {"dimension": "none", "value": "all"}) == dict(pattern.get("cohort") or {"dimension": "none", "value": "all"}),
    "requiredExactTitles": sorted(str(value) for value in configuration.get("requiredExactTitles") or ()) == sorted(str(value) for value in pattern.get("requiredExactTitles") or ()),
    "scoringEngine": str(configuration.get("scoringEngineVersion") or "") == WORKBENCH_SCORING_ENGINE_VERSION,
    "pairOrientation": (
      str(configuration.get("pairOrientationVersion") or "") == PAIR_ORIENTATION_VERSION
      or not str(pattern.get("market") or "EURUSD").startswith("USD")
    ),
    "stopAtr": close(selected.get("stopAtr"), execution.get("stopAtr")),
    "targetR": close(selected.get("targetR"), execution.get("targetR")),
    "expiryCandles": int(selected.get("holdingCandles") or -1) == int(execution.get("expiryCandles") or -2),
    "historicalN": int(result.get("historicalN") or -1) == int(benchmark.get("historicalN") or -2),
    "walkForwardN": int(benchmark_partition.get("evaluableCount" if benchmark_basis == "chronological_holdout" else "n") or -1) == int(benchmark.get("walkForwardN") or -2),
    "walkForwardAverageR": close(benchmark_partition.get("stressedAverageR" if benchmark_basis == "chronological_holdout" else "averageR"), benchmark.get("walkForwardAverageR")),
    "targetFirstRate": close(benchmark_partition.get("targetHitRate" if benchmark_basis == "chronological_holdout" else "targetRate"), benchmark.get("targetFirstRate")),
    "stopFirstRate": close(benchmark_partition.get("stopHitRate" if benchmark_basis == "chronological_holdout" else "stopRate"), benchmark.get("stopFirstRate")),
  }
  verified = all(checks.values())
  return {
    "status": "verified" if verified else "mismatch",
    "experimentId": experiment_id,
    "configurationHash": experiment.get("configurationHash"),
    "datasetFingerprint": experiment.get("datasetFingerprint"),
    "qualificationAuditId": None if not audit else audit.get("auditId"),
    "checks": checks,
    "note": (
      "Verified against the immutable experiment configuration and its latest walk-forward qualification audit."
      if verified else
      "Registration values do not fully reconcile with the linked immutable experiment. Treat this setup as an audit failure until repaired."
    ),
  }


def _registration_display_evidence(pattern: Dict[str, Any]) -> Optional[Dict[str, Any]]:
  benchmark = pattern.get("historicalBenchmark") or {}
  experiment = _research_store.get_fms_experiment(str(benchmark.get("experimentId") or ""))
  result = (experiment or {}).get("result") or {}
  selected = result.get("selectedConfiguration") or {}
  if not selected:
    return None
  overall = selected.get("overall") or {}
  year_stability = selected.get("yearStability") or {}
  evaluable = int(overall.get("evaluableCount") or result.get("historicalN") or 0)
  target_rate = float(overall.get("targetHitRate") or 0)
  stop_rate = float(overall.get("stopHitRate") or 0)
  return {
    "scoringPolicy": str(pattern.get("scoringPolicy", "forecast_quality")),
    "cohort": dict(pattern.get("cohort") or {"dimension": "none", "value": "all"}),
    "reaction": str(pattern.get("reaction", "continuation")),
    "evaluable": evaluable,
    "targetFirst": round(evaluable * target_rate),
    "stopFirst": round(evaluable * stop_rate),
    "expired": int(overall.get("expiredCount") or 0),
    "stressedAverageR": overall.get("stressedAverageR"),
    "developmentAverageR": (selected.get("development") or {}).get("stressedAverageR"),
    "holdoutAverageR": (selected.get("holdout") or {}).get("stressedAverageR"),
    "recentAverageR": (selected.get("recent") or {}).get("stressedAverageR"),
    "positiveYears": int(year_stability.get("positiveYears") or 0),
    "evaluatedYears": int(year_stability.get("evaluableYears") or 0),
    "stressPips": 3.0,
  }


def _pattern_readiness(pattern: Dict[str, Any], provenance: Dict[str, Any]) -> Dict[str, Any]:
  """Keep historical qualification, audit integrity, and live validation separate."""
  audit_complete = provenance.get("status") == "verified"
  fragile = (pattern.get("historicalBenchmark") or {}).get("strength") == "positive_but_fragile"
  return {
    "auditStatus": "complete" if audit_complete else "incomplete",
    "historicalStatus": (
      "historically_positive_fragile" if audit_complete and fragile else
      "historically_qualified" if audit_complete else
      "unverified"
    ),
    "liveStatus": "not_live_validated",
    "orientationAudited": audit_complete,
    "label": (
      "Historical audit complete · fragile" if audit_complete and fragile else
      "Historical audit complete · orientation audited" if audit_complete else
      "Audit incomplete"
    ),
    "actionableInShadowTrader": audit_complete,
  }


def _reconciled_pattern(pattern: Dict[str, Any]) -> Dict[str, Any]:
  """Overlay a corrected immutable reconciliation without rewriting registry history."""
  raw = _research_store.get_metadata("fms_registered_reaction:reconciliation")
  if not raw:
    return pattern
  try:
    payload = json.loads(raw)
  except (TypeError, ValueError):
    return pattern
  row = next(
    (item for item in payload.get("rows", ()) if str(item.get("patternId")) == str(pattern.get("id"))),
    None,
  )
  if not isinstance(row, dict) or not row.get("id"):
    return pattern
  benchmark = dict(pattern.get("historicalBenchmark") or {})
  benchmark.update({
    "experimentId": row["id"],
    "historicalN": row.get("historicalN"),
    "walkForwardN": row.get("walkForwardN"),
    "walkForwardAverageR": row.get("walkForwardAverageR"),
    "targetFirstRate": row.get("targetFirstRate"),
    "stopFirstRate": row.get("stopFirstRate"),
  })
  return {**pattern, "historicalBenchmark": benchmark}


def _execution_for_event(pattern: Dict[str, Any], event_time: int) -> Dict[str, Any]:
  """Preserve the contract that was active when a historical signal occurred."""
  review = pattern.get("executionReview") or {}
  if (
    review.get("status") == "reviewed_active"
    and event_time < int(review.get("activatedAt") or REVIEWED_EXECUTION_ACTIVATED_AT)
  ):
    return dict(pattern.get("baseExecution") or pattern.get("execution") or {})
  return dict(pattern.get("execution") or {})


def _market_context_dimension_value(context: Optional[Dict[str, Any]], dimension: str) -> Optional[str]:
  if not context:
    return None
  if dimension == "priceRegime":
    return str((context.get("price") or {}).get("regime") or "unknown")
  if dimension == "trendRelation":
    return str((context.get("price") or {}).get("relationToSignal") or "unknown")
  if dimension == "volatilityRegime":
    return str((context.get("volatility") or {}).get("regime") or "unknown")
  if dimension == "directionalRoom":
    return str((context.get("supportResistance") or {}).get("roomState") or "unknown")
  if dimension == "macroBackground":
    return str((context.get("macroBackground") or {}).get("relationToSignal") or "unknown")
  return None


def _context_overlay_for_signal(pattern: Dict[str, Any], signal: Dict[str, Any]) -> Optional[Dict[str, Any]]:
  registration = pattern.get("contextRegistration") or {}
  if registration.get("status") != "reviewed_active":
    return None
  condition = registration.get("condition") or {}
  actual_value = _market_context_dimension_value(signal.get("marketContext"), str(condition.get("dimension") or ""))
  matched = actual_value == condition.get("value")
  active_for_event = int(signal["eventTime"]) >= int(registration.get("activatedAt") or CONTEXT_CONDITIONAL_ACTIVATED_AT)
  return {
    "registrationId": registration["id"], "modelId": registration["modelId"],
    "parentPatternId": registration["parentPatternId"],
    "condition": condition, "observedValue": actual_value,
    "matched": matched, "activeForEvent": active_for_event,
    "executionApplied": matched and active_for_event,
    "parentBehaviorWhenContextDoesNotMatch": registration["parentBehaviorWhenContextDoesNotMatch"],
    "parentExecution": dict(signal.get("execution") or {}),
    "contextExecution": dict(registration.get("execution") or {}),
    "later": registration.get("later"),
    "parentOnSameContextLater": registration.get("parentOnSameContextLater"),
    "reaction": registration.get("reaction"),
    "relationship": registration.get("relationship"),
    "limitations": registration.get("limitations"),
  }

app = FastAPI(title="MT5 Bridge", version="0.1.0")


def _json_sanitize(obj: Any) -> Any:
  """Recursively replace bytes with UTF-8 decoded string for JSON serialization."""
  if isinstance(obj, bytes):
    return obj.decode("utf-8", errors="replace")
  if isinstance(obj, dict):
    return {k: _json_sanitize(v) for k, v in obj.items()}
  if isinstance(obj, list):
    return [_json_sanitize(v) for v in obj]
  return obj


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
  """Return 422 with JSON-serializable detail (no bytes). No I/O."""
  detail = _json_sanitize(exc.errors())
  return JSONResponse(status_code=422, content={"detail": detail})

app.add_middleware(
  CORSMiddleware,
  allow_origins=[
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

terminal_connected: bool = False
last_error: Optional[Dict[str, Any]] = None
BRIDGE_API_REVISION = "2026-08-26-fms-workbench-v1"


def _coerce_int(v: Any) -> int:
  """Coerce string numerals to int for contract resilience."""
  if isinstance(v, int):
    return v
  if isinstance(v, str) and v.strip().lstrip("-").isdigit():
    return int(v)
  raise ValueError(f"expected int, got {type(v).__name__}")


class CalendarEventPayload(BaseModel):
  """Economic calendar event as pushed from the MT5 EA. See CALENDAR_CONTRACT.md."""

  id: int
  time: int = Field(..., description="UNIX seconds in MT5 server time")
  countryCode: str
  currency: str
  title: str
  impact: str
  actual: Optional[str] = None
  forecast: Optional[str] = None
  previous: Optional[str] = None

  @field_validator("id", "time", mode="before")
  @classmethod
  def coerce_int_fields(cls, v: Any) -> int:
    return _coerce_int(v)


class CalendarIngestRequest(BaseModel):
  events: List[CalendarEventPayload]


class MacroBacktestRequest(BaseModel):
  versionId: str = ACTIVE_VERSION_ID


class FmsMarketCacheRequest(BaseModel):
  market: str

  @field_validator("market")
  @classmethod
  def validate_market(cls, value: str) -> str:
    normalized = value.upper()
    if normalized not in WORKBENCH_MARKETS:
      raise ValueError("Unsupported FMS research market")
    return normalized


class FmsExperimentCohort(BaseModel):
  dimension: str = "none"
  value: str = "all"


class FmsExperimentExecution(BaseModel):
  mode: str
  stopAtrValues: List[float]
  targetRValues: List[float]
  holdingCandles: List[int]

  @field_validator("mode")
  @classmethod
  def validate_mode(cls, value: str) -> str:
    if value not in {"single", "matrix"}:
      raise ValueError("Execution mode must be single or matrix")
    return value


class FmsExperimentRequest(BaseModel):
  market: str = "EURUSD"
  friendlyName: str = Field(min_length=1, max_length=80)
  catalogId: str
  directionSelection: str = "both"
  scoringPolicy: str
  cohort: FmsExperimentCohort = Field(default_factory=FmsExperimentCohort)
  reaction: str
  execution: FmsExperimentExecution

  @field_validator("friendlyName")
  @classmethod
  def validate_friendly_name(cls, value: str) -> str:
    if not value.strip():
      raise ValueError("Experiment name cannot be blank")
    return value.strip()

  @field_validator("directionSelection")
  @classmethod
  def validate_direction_selection(cls, value: str) -> str:
    if value not in {"long", "short", "both"}:
      raise ValueError("Direction selection must be long, short, or both")
    return value

  @field_validator("market")
  @classmethod
  def validate_market(cls, value: str) -> str:
    normalized = value.upper()
    if normalized not in WORKBENCH_MARKETS:
      raise ValueError("Unsupported FMS research market")
    return normalized


class FmsCandidateFreezeRequest(BaseModel):
  friendlyName: str = Field(min_length=1, max_length=80)
  acknowledgeFailedGates: bool = False

  @field_validator("friendlyName")
  @classmethod
  def validate_friendly_name(cls, value: str) -> str:
    if not value.strip():
      raise ValueError("Candidate name cannot be blank")
    return value.strip()


class CalendarIngestCycleRequest(BaseModel):
  completedAt: int
  failedBatches: int = 0

  @field_validator("completedAt", "failedBatches", mode="before")
  @classmethod
  def coerce_cycle_int_fields(cls, v: Any) -> int:
    return _coerce_int(v)


_research_store = ResearchStore()
_chart_model_metadata_key = f"chart_signal_model_hash:{CHART_SIGNAL_MODEL_ID}"
_stored_chart_model_hash = _research_store.get_metadata(_chart_model_metadata_key)
if _stored_chart_model_hash is not None and _stored_chart_model_hash != CHART_SIGNAL_MODEL_HASH:
  raise RuntimeError(
    f"Chart signal model {CHART_SIGNAL_MODEL_ID} already exists with a different configuration; create a new model id"
  )
_research_store.set_metadata(_chart_model_metadata_key, CHART_SIGNAL_MODEL_HASH)
_research_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="fyodor-research")
_forward_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="fyodor-forward")
_mt5_lock = RLock()
_MT5_FOREGROUND_LOCK_TIMEOUT_SECONDS = 2.0
_forward_schedule_lock = Lock()
_forward_reconcile_scheduled = False
_chart_signal_catalog_lock = Lock()
_chart_signal_catalog_cache: Dict[str, List[Dict[str, Any]]] = {}
_chart_signal_response_lock = Lock()
_chart_signal_response_cache: Dict[str, Dict[str, Any]] = {}
_chart_signal_current_candidates_lock = Lock()
_chart_signal_current_candidates_cache: Dict[str, Dict[str, Any]] = {}
_chart_signal_context_lock = Lock()
_chart_signal_context_cache: Dict[str, Dict[str, Any]] = {}
_candidate_stress_lock = Lock()
_candidate_stress_cache: Dict[str, Dict[str, Any]] = {}
_research_store.mark_unfinished_fms_experiments_failed(
  "Bridge restarted before the recorded experiment completed"
)

# First timestamp at which Fyodor can honestly guarantee immutable first-seen
# release values and complete EA upload cycles for forward paper evidence.
FORWARD_LEDGER_ACTIVATED_AT = 1787047068  # 2026-08-18 09:57:48 UTC

# Last symbol used successfully in GET /history; used by GET /server_time when no symbol param.
_last_history_symbol: Optional[str] = None
_last_symbols_payload: List[Dict[str, Any]] = []


class Mt5BusyError(RuntimeError):
  pass


@contextmanager
def _mt5_access(timeout: Optional[float] = None):
  """Serialize access to MetaTrader5's process-global IPC session.

  The Python MT5 package is not safe to call concurrently. Foreground routes
  use a bounded wait so a background reconciliation cannot make Charts or
  bridge health hang indefinitely.
  """
  acquired = _mt5_lock.acquire(timeout=timeout) if timeout is not None else _mt5_lock.acquire()
  if not acquired:
    raise Mt5BusyError("MT5 connection is busy with another bridge operation")
  try:
    yield
  finally:
    _mt5_lock.release()


def _cached_history(
  symbol: str,
  timeframe: str,
  *,
  bars: Optional[int] = None,
  from_time: int = 0,
  to_time: Optional[int] = None,
) -> List[Dict[str, Any]]:
  rows = _research_store.query_candles(
    symbol.upper(), timeframe.upper(), from_time, to_time or int(_time.time()) + 24 * 60 * 60,
  )
  return rows[-bars:] if bars is not None else rows

def _ensure_mt5_initialized() -> bool:
  """Return True when the Python MT5 API has an active terminal connection.

  Calendar ingestion reaches this bridge over HTTP from the EA and can keep
  working even when the Python package has lost its IPC session. Price, symbol,
  server-time, and streaming endpoints need this connection.
  """
  global terminal_connected, last_error

  with _mt5_access():
    if mt5.terminal_info() is not None:
      terminal_connected = True
      last_error = None
      return True

    mt5_path = os.environ.get("MT5_EXE")
    initialized = mt5.initialize(path=mt5_path) if mt5_path else mt5.initialize()
    if initialized:
      terminal_connected = True
      last_error = None
      return True

    _update_last_error()
    terminal_connected = False
    return False


def _namedtuple_to_dict(value: Any) -> Dict[str, Any]:
  if value is None:
    return {}
  if hasattr(value, "_asdict"):
    return value._asdict()
  if isinstance(value, dict):
    return value
  names = getattr(getattr(value, "dtype", None), "names", None)
  if names:
    return {str(name): value[name].item() if hasattr(value[name], "item") else value[name] for name in names}
  return {}


_CRYPTO_SYMBOL_HINTS = (
  "btc",
  "eth",
  "sol",
  "xrp",
  "ada",
  "ltc",
  "doge",
  "bch",
  "bnb",
  "dot",
  "avax",
  "matic",
  "link",
  "uni",
  "crypto",
  "coin",
)

_METAL_SYMBOL_HINTS = ("xau", "xag", "gold", "silver", "metal")
_FOREX_CODES = {
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "AUD",
  "NZD",
  "CAD",
  "CHF",
  "CNH",
  "CZK",
  "DKK",
  "HKD",
  "HUF",
  "NOK",
  "PLN",
  "SEK",
  "SGD",
  "TRY",
  "MXN",
  "ZAR",
}


def _looks_like_forex_pair(symbol: str) -> bool:
  if len(symbol) != 6:
    return False
  base = symbol[:3].upper()
  quote = symbol[3:].upper()
  return base in _FOREX_CODES and quote in _FOREX_CODES


def _infer_asset_class(symbol: str, path: Optional[str]) -> str:
  text = f"{symbol} {path or ''}".lower()
  if any(hint in text for hint in _CRYPTO_SYMBOL_HINTS):
    return "crypto"
  if any(hint in text for hint in _METAL_SYMBOL_HINTS):
    return "metals"
  if "forex" in text or "fx" in text or _looks_like_forex_pair(symbol):
    return "forex"
  return "other"


def _forex_session_window(now_utc: datetime) -> Tuple[bool, int, int, str]:
  weekday = now_utc.weekday()
  minutes = now_utc.hour * 60 + now_utc.minute
  sunday_open = 22 * 60
  friday_close = 22 * 60

  if weekday == 5:
    next_open = datetime.combine(
      (now_utc + timedelta(days=1)).date(),
      datetime.min.time(),
      tzinfo=timezone.utc,
    ) + timedelta(minutes=sunday_open)
    return False, int(next_open.timestamp()), int(next_open.timestamp()), "weekend"

  if weekday == 6 and minutes < sunday_open:
    next_open = datetime.combine(
      now_utc.date(),
      datetime.min.time(),
      tzinfo=timezone.utc,
    ) + timedelta(minutes=sunday_open)
    return False, int(next_open.timestamp()), int(next_open.timestamp()), "weekend"

  if weekday == 4 and minutes >= friday_close:
    next_open = datetime.combine(
      (now_utc + timedelta(days=2)).date(),
      datetime.min.time(),
      tzinfo=timezone.utc,
    ) + timedelta(minutes=sunday_open)
    close_time = datetime.combine(
      now_utc.date(),
      datetime.min.time(),
      tzinfo=timezone.utc,
    ) + timedelta(minutes=friday_close)
    return False, int(next_open.timestamp()), int(close_time.timestamp()), "weekend"

  days_until_friday = (4 - weekday) % 7
  close_base = datetime.combine(
    (now_utc + timedelta(days=days_until_friday)).date(),
    datetime.min.time(),
    tzinfo=timezone.utc,
  ) + timedelta(minutes=friday_close)
  if close_base <= now_utc:
    close_base += timedelta(days=7)

  if weekday == 6:
    next_open = datetime.combine(
      now_utc.date(),
      datetime.min.time(),
      tzinfo=timezone.utc,
    ) + timedelta(minutes=sunday_open)
  else:
    next_open = int(now_utc.timestamp())

  return True, int(next_open if isinstance(next_open, int) else next_open.timestamp()), int(close_base.timestamp()), "active_session"


def _next_daily_boundary(now_utc: datetime, hours: int) -> int:
  boundary = datetime.combine(now_utc.date(), datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=hours)
  if boundary <= now_utc:
    boundary += timedelta(days=1)
  return int(boundary.timestamp())


def _session_snapshot_unlocked(symbol: str) -> Dict[str, Any]:
  checked_at = int(datetime.now(timezone.utc).timestamp())
  if not _ensure_mt5_initialized():
    return {
      "symbol": symbol,
      "symbol_path": None,
      "asset_class": None,
      "session_state": "unavailable",
      "is_open": None,
      "terminal_connected": False,
      "checked_at": checked_at,
      "server_time": None,
      "last_tick_time": None,
      "next_open_time": None,
      "next_close_time": None,
      "reason": "terminal_disconnected",
    }

  info = mt5.symbol_info(symbol)
  if info is None:
    return {
      "symbol": symbol,
      "symbol_path": None,
      "asset_class": None,
      "session_state": "unavailable",
      "is_open": None,
      "terminal_connected": True,
      "checked_at": checked_at,
      "server_time": _get_server_time_from_mt5(symbol),
      "last_tick_time": None,
      "next_open_time": None,
      "next_close_time": None,
      "reason": "symbol_unavailable",
    }

  info_dict = _namedtuple_to_dict(info)
  path = getattr(info, "path", None) or info_dict.get("path")
  asset_class = _infer_asset_class(symbol, path)
  tick = mt5.symbol_info_tick(symbol)
  tick_dict = _namedtuple_to_dict(tick)
  server_time = _get_server_time_from_mt5(symbol) or checked_at
  last_tick_time = tick_dict.get("time") or getattr(info, "time", None) or info_dict.get("time")
  if last_tick_time is not None:
    last_tick_time = int(last_tick_time)

  now_utc = datetime.fromtimestamp(checked_at, tz=timezone.utc)

  if asset_class == "crypto":
    next_close_time = _next_daily_boundary(now_utc, 0)
    return {
      "symbol": symbol,
      "symbol_path": path,
      "asset_class": asset_class,
      "session_state": "open",
      "is_open": True,
      "terminal_connected": True,
      "checked_at": checked_at,
      "server_time": int(server_time),
      "last_tick_time": last_tick_time,
      "next_open_time": int(checked_at),
      "next_close_time": next_close_time,
      "reason": "always_on",
    }

  if asset_class in {"forex", "metals"}:
    is_open, next_open_time, next_close_time, reason = _forex_session_window(now_utc)
    return {
      "symbol": symbol,
      "symbol_path": path,
      "asset_class": asset_class,
      "session_state": "open" if is_open else "closed",
      "is_open": is_open,
      "terminal_connected": True,
      "checked_at": checked_at,
      "server_time": int(server_time),
      "last_tick_time": last_tick_time,
      "next_open_time": next_open_time,
      "next_close_time": next_close_time,
      "reason": reason,
    }

  tick_age_seconds = None
  if last_tick_time is not None:
    tick_age_seconds = max(0, checked_at - last_tick_time)

  if tick_age_seconds is None:
    return {
      "symbol": symbol,
      "symbol_path": path,
      "asset_class": asset_class,
      "session_state": "unavailable",
      "is_open": None,
      "terminal_connected": True,
      "checked_at": checked_at,
      "server_time": int(server_time),
      "last_tick_time": last_tick_time,
      "next_open_time": None,
      "next_close_time": None,
      "reason": "session_unknown",
    }

  is_open = tick_age_seconds <= 900
  return {
    "symbol": symbol,
    "symbol_path": path,
    "asset_class": asset_class,
    "session_state": "open" if is_open else "closed",
    "is_open": is_open,
    "terminal_connected": True,
    "checked_at": checked_at,
    "server_time": int(server_time),
    "last_tick_time": last_tick_time,
    "next_open_time": None if is_open else checked_at + 900,
    "next_close_time": checked_at + 900 if is_open else None,
    "reason": "tick_fresh" if is_open else "tick_stale",
  }


def _session_snapshot(symbol: str) -> Dict[str, Any]:
  try:
    with _mt5_access(_MT5_FOREGROUND_LOCK_TIMEOUT_SECONDS):
      return _session_snapshot_unlocked(symbol)
  except Mt5BusyError:
    checked_at = int(_time.time())
    asset_class = _infer_asset_class(symbol, None)
    session_state = "unavailable"
    is_open: Optional[bool] = None
    next_open_time: Optional[int] = None
    next_close_time: Optional[int] = None
    if asset_class in {"forex", "metals"}:
      is_open, next_open_time, next_close_time, _ = _forex_session_window(
        datetime.fromtimestamp(checked_at, tz=timezone.utc)
      )
      session_state = "open" if is_open else "closed"
    return {
      "symbol": symbol,
      "symbol_path": None,
      "asset_class": asset_class,
      "session_state": session_state,
      "is_open": is_open,
      "terminal_connected": terminal_connected,
      "checked_at": checked_at,
      "server_time": None,
      "last_tick_time": None,
      "next_open_time": next_open_time,
      "next_close_time": next_close_time,
      "reason": "mt5_busy",
    }


def _update_last_error() -> None:
  global last_error
  with _mt5_access():
    code, message = mt5.last_error()
  if code != 0:
    last_error = {"code": code, "message": message}
  else:
    last_error = None


def _get_last_error() -> Optional[Dict[str, Any]]:
  with _mt5_access():
    code, message = mt5.last_error()
  if code == 0:
    return None
  return {"code": code, "message": message}


@app.on_event("startup")
def on_startup() -> None:
  global terminal_connected, last_error

  for definition in SIGNAL_DEFINITIONS.values():
    _research_store.ensure_signal_version(
      definition.id,
      definition.created_at,
      definition.configuration,
      definition.configuration_hash,
    )
  _research_store.mark_unfinished_runs_failed("Bridge restarted before this research job completed")
  if not _ensure_mt5_initialized():
    terminal_connected = False
    last_error = _get_last_error()
  else:
    terminal_connected = True
    last_error = None


@app.on_event("shutdown")
def on_shutdown() -> None:
  global terminal_connected
  if terminal_connected:
    with _mt5_access():
      mt5.shutdown()
    terminal_connected = False


def mt5_timeframe(tf: str) -> int:
  mapping = {
    "M1": mt5.TIMEFRAME_M1,
    "M5": mt5.TIMEFRAME_M5,
    "M15": mt5.TIMEFRAME_M15,
    "M30": mt5.TIMEFRAME_M30,
    "H1": mt5.TIMEFRAME_H1,
    "H4": mt5.TIMEFRAME_H4,
    "D1": mt5.TIMEFRAME_D1,
    "W1": mt5.TIMEFRAME_W1,
    "MN1": mt5.TIMEFRAME_MN1,
  }
  key = tf.upper()
  try:
    return mapping[key]
  except KeyError:
    raise HTTPException(status_code=400, detail=f"Unsupported timeframe: {tf!r}")


def ensure_symbol_selected(symbol: str) -> None:
  with _mt5_access():
    if not mt5.symbol_select(symbol, True):
      _update_last_error()
      err = _get_last_error()
      raise HTTPException(
        status_code=502,
        detail={"message": f"symbol_select failed for {symbol!r}", "mt5_error": err},
      )


def convert_rate_row(row: Any) -> Dict[str, Any]:
  """
  Convert a single MT5 rates row (from copy_rates_from_pos) to a candle dict.
  """
  # 'time' is already seconds since epoch in MT5
  t = int(row["time"])
  # MT5 returns a NumPy structured array; rows are numpy.void, so we
  # cannot use dict-style .get(). Instead, inspect dtype.names.
  names = getattr(getattr(row, "dtype", None), "names", ()) or ()

  tick_vol = int(row["tick_volume"]) if "tick_volume" in names else 0
  real_vol = int(row["real_volume"]) if "real_volume" in names else 0
  vol = real_vol if real_vol != 0 else tick_vol

  return {
    "time": t,
    "open": float(row["open"]),
    "high": float(row["high"]),
    "low": float(row["low"]),
    "close": float(row["close"]),
    "volume": vol,
  }


def _metadata_float(key: str) -> Optional[float]:
  raw = _research_store.get_metadata(key)
  if raw is None:
    return None
  try:
    return float(raw)
  except ValueError:
    return None


@app.get("/health")
def health() -> Dict[str, Any]:
  mt5_busy = False
  try:
    with _mt5_access(_MT5_FOREGROUND_LOCK_TIMEOUT_SECONDS):
      connected = _ensure_mt5_initialized()
      version = mt5.version() if connected else None
      account = mt5.account_info() if connected else None
      err_code, err_message = mt5.last_error()
      last_error_info = {"code": err_code, "message": err_message}
  except Mt5BusyError:
    mt5_busy = True
    connected = terminal_connected
    version = None
    account = None
    last_error_info = last_error

  payload: Dict[str, Any] = {
    "ok": True,
    "bridge_connected": True,
    "api_revision": BRIDGE_API_REVISION,
    "terminal_connected": connected,
    "mt5_busy": mt5_busy,
    "mt5_version": version,
    "account_login": account.login if account is not None else None,
    "last_error": last_error_info,
    "calendar_events_count": _research_store.calendar_count(),
    "last_calendar_ingest_at": _metadata_float("last_calendar_ingest_at"),
  }
  return payload


def _get_server_time_from_mt5_unlocked(symbol: Optional[str] = None) -> Optional[int]:
  """Get MT5 server time. If symbol is set, try only that symbol. Else try _last_history_symbol, then fallbacks."""
  if not _ensure_mt5_initialized():
    return None

  def try_symbol(sym: str) -> Optional[int]:
    tick = mt5.symbol_info_tick(sym)
    if tick is not None:
      tick_dict = _namedtuple_to_dict(tick)
      tick_time = tick_dict.get("time") or getattr(tick, "time", None)
      if tick_time is not None:
        return int(tick_time)
    try:
      if not mt5.symbol_select(sym, True):
        return None
      rates = mt5.copy_rates_from_pos(sym, mt5.TIMEFRAME_M1, 0, 1)
      if rates is not None and len(rates) > 0:
        return int(rates[-1]["time"])
    except Exception:
      pass
    return None

  if symbol:
    return try_symbol(symbol)

  if _last_history_symbol:
    t = try_symbol(_last_history_symbol)
    if t is not None:
      return t

  for sym in ("EURUSD", "USDJPY", "GBPUSD", "XAUUSD"):
    t = try_symbol(sym)
    if t is not None:
      return t
  syms = mt5.symbols_get()
  if syms:
    for s in syms[:20]:
      name = getattr(s, "name", None)
      if not name:
        continue
      t = try_symbol(name)
      if t is not None:
        return t
  return None


def _get_server_time_from_mt5(symbol: Optional[str] = None) -> Optional[int]:
  try:
    with _mt5_access(_MT5_FOREGROUND_LOCK_TIMEOUT_SECONDS):
      return _get_server_time_from_mt5_unlocked(symbol)
  except Mt5BusyError:
    return None


@app.get("/server_time")
def server_time(symbol: Optional[str] = None) -> Dict[str, Any]:
  """Return current MT5 server time as UNIX seconds. Optional query param symbol= to use a specific symbol."""
  t = _get_server_time_from_mt5(symbol)
  if t is None:
    raise HTTPException(status_code=503, detail="Could not get server time from MT5")
  return {"time": t}


@app.get("/symbols")
def symbols() -> List[Dict[str, Any]]:
  """Return all symbols from MT5 with optional path for grouping."""
  global _last_symbols_payload
  try:
    with _mt5_access(_MT5_FOREGROUND_LOCK_TIMEOUT_SECONDS):
      if not _ensure_mt5_initialized():
        raise HTTPException(status_code=503, detail="MT5 terminal not connected")

      syms = mt5.symbols_get()
      if syms is None:
        _update_last_error()
        err = _get_last_error()
        raise HTTPException(
          status_code=502,
          detail={"message": "symbols_get failed", "mt5_error": err},
        )

      result: List[Dict[str, Any]] = []
      for s in syms:
        name = getattr(s, "name", None)
        if name is None:
          continue
        path: Optional[str] = None
        try:
          info = mt5.symbol_info(name)
          if info is not None:
            path = getattr(info, "path", None) or None
        except Exception:
          pass
        result.append({"name": name, "path": path})
      _last_symbols_payload = result
      return result
  except Mt5BusyError:
    if _last_symbols_payload:
      return _last_symbols_payload
    return [{"name": market, "path": None} for market in WORKBENCH_MARKETS]


@app.get("/market_status")
def market_status(symbol: str) -> Dict[str, Any]:
  return _session_snapshot(symbol)


@app.get("/history")
def history(symbol: str, tf: str, bars: int = 500) -> List[Dict[str, Any]]:
  if bars <= 0:
    raise HTTPException(status_code=400, detail="bars must be > 0")
  if bars > 5000:
    raise HTTPException(status_code=400, detail="bars must be <= 5000")

  timeframe = mt5_timeframe(tf)
  try:
    with _mt5_access(_MT5_FOREGROUND_LOCK_TIMEOUT_SECONDS):
      if not _ensure_mt5_initialized():
        raise HTTPException(status_code=503, detail="MT5 terminal not connected")
      ensure_symbol_selected(symbol)
      rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, bars)
      if rates is None or len(rates) == 0:
        _update_last_error()
        err = _get_last_error()
        raise HTTPException(
          status_code=502,
          detail={"message": "No data from MT5", "mt5_error": err},
        )
      candles = [convert_rate_row(row) for row in rates]
      candles.sort(key=lambda c: c["time"])
      _research_store.upsert_candles(symbol, tf, candles)
      global _last_history_symbol
      _last_history_symbol = symbol
      return candles
  except Mt5BusyError:
    cached = _cached_history(symbol, tf, bars=bars)
    if cached:
      return cached
    raise HTTPException(status_code=503, detail="MT5 is busy and no cached chart history is available")
  except HTTPException as error:
    cached = _cached_history(symbol, tf, bars=bars)
    if cached and error.status_code in {502, 503}:
      return cached
    raise


@app.get("/history_range")
def history_range(symbol: str, tf: str, from_: int, to: int) -> List[Dict[str, Any]]:
  if from_ >= to:
    raise HTTPException(status_code=400, detail="from_ must be < to")

  max_range_seconds = 40 * 24 * 60 * 60
  if to - from_ > max_range_seconds:
    raise HTTPException(status_code=400, detail="requested range is too large")

  timeframe = mt5_timeframe(tf)
  try:
    with _mt5_access(_MT5_FOREGROUND_LOCK_TIMEOUT_SECONDS):
      if not _ensure_mt5_initialized():
        raise HTTPException(status_code=503, detail="MT5 terminal not connected")
      ensure_symbol_selected(symbol)
      from_dt = datetime.fromtimestamp(from_, tz=timezone.utc)
      to_dt = datetime.fromtimestamp(to, tz=timezone.utc)
      rates = mt5.copy_rates_range(symbol, timeframe, from_dt, to_dt)
      if rates is None or len(rates) == 0:
        _update_last_error()
        err = _get_last_error()
        raise HTTPException(
          status_code=502,
          detail={"message": "No data from MT5", "mt5_error": err},
        )
      candles = [convert_rate_row(row) for row in rates]
      candles.sort(key=lambda c: c["time"])
      _research_store.upsert_candles(symbol, tf, candles)
      global _last_history_symbol
      _last_history_symbol = symbol
      return candles
  except Mt5BusyError:
    cached = _cached_history(symbol, tf, from_time=from_, to_time=to)
    if cached:
      return cached
    raise HTTPException(status_code=503, detail="MT5 is busy and no cached chart range is available")
  except HTTPException as error:
    cached = _cached_history(symbol, tf, from_time=from_, to_time=to)
    if cached and error.status_code in {502, 503}:
      return cached
    raise


@app.get("/history_boundary")
def history_boundary(symbol: str, tf: str) -> Dict[str, Any]:
  timeframe = mt5_timeframe(tf)
  try:
    with _mt5_access(_MT5_FOREGROUND_LOCK_TIMEOUT_SECONDS):
      if not _ensure_mt5_initialized():
        raise HTTPException(status_code=503, detail="MT5 terminal not connected")
      ensure_symbol_selected(symbol)
      earliest = datetime(1971, 1, 1, tzinfo=timezone.utc)
      rates = mt5.copy_rates_from(symbol, timeframe, earliest, 1)
      if rates is None or len(rates) == 0:
        _update_last_error()
        err = _get_last_error()
        raise HTTPException(
          status_code=502,
          detail={"message": "No boundary data from MT5", "mt5_error": err},
        )
      candle = convert_rate_row(rates[0])
      _research_store.upsert_candles(symbol, tf, [candle])
      global _last_history_symbol
      _last_history_symbol = symbol
      return {"oldest_time": candle["time"], "approximate": True}
  except Mt5BusyError:
    coverage = _research_store.candle_coverage(symbol, tf)
    if coverage["earliest"] is not None:
      return {"oldest_time": coverage["earliest"], "approximate": True, "source": "durable_cache"}
    raise HTTPException(status_code=503, detail="MT5 is busy and no cached history boundary is available")
  except HTTPException as error:
    coverage = _research_store.candle_coverage(symbol, tf)
    if coverage["earliest"] is not None and error.status_code in {502, 503}:
      return {"oldest_time": coverage["earliest"], "approximate": True, "source": "durable_cache"}
    raise


@app.post("/calendar_ingest")
async def calendar_ingest(request: Request) -> Dict[str, Any]:
  """
  Ingest economic calendar events pushed from the MT5 EA.
  Reads raw body and strips trailing null bytes (MQL5 StringToCharArray quirk)
  so JSON parsing always succeeds. See CALENDAR_CONTRACT.md.
  """
  t0 = _time.perf_counter()
  body_bytes = await request.body()
  body_size = len(body_bytes)
  # Strip trailing null byte(s) that MQL5 may append; then decode.
  while body_bytes and body_bytes[-1:] == b"\x00":
    body_bytes = body_bytes[:-1]
  try:
    raw = json.loads(body_bytes.decode("utf-8", errors="replace"))
  except json.JSONDecodeError as e:
    duration_ms = int((_time.perf_counter() - t0) * 1000)
    logger.info(
      "calendar_ingest method=POST path=/calendar_ingest status=400 body_size=%s duration_ms=%s error=Invalid JSON",
      body_size,
      duration_ms,
    )
    raise HTTPException(status_code=400, detail={"message": "Invalid JSON", "error": str(e)})
  try:
    payload = CalendarIngestRequest.model_validate(raw)
  except ValidationError as e:
    duration_ms = int((_time.perf_counter() - t0) * 1000)
    logger.info(
      "calendar_ingest method=POST path=/calendar_ingest status=422 body_size=%s duration_ms=%s",
      body_size,
      duration_ms,
    )
    raise HTTPException(status_code=422, detail=_json_sanitize(e.errors()))

  ingested_at = int(_time.time())
  records = [event.model_copy().model_dump() for event in payload.events]
  ingest_result = _research_store.upsert_calendar_events(records, ingested_at)
  ingested = ingest_result["inserted"]
  updated = ingest_result["updated"]
  total = ingest_result["total"]
  duration_ms = int((_time.perf_counter() - t0) * 1000)
  logger.info(
    "calendar_ingest method=POST path=/calendar_ingest status=200 body_size=%s ingested=%s updated=%s total=%s duration_ms=%s",
    body_size,
    ingested,
    updated,
    total,
    duration_ms,
  )
  return {"ingested": ingested, "updated": updated, "total": total}


@app.post("/calendar_ingest_cycle")
async def calendar_ingest_cycle(request: Request) -> Dict[str, Any]:
  """Acknowledge one complete EA upload cycle before freezing forward releases."""
  body_bytes = await request.body()
  while body_bytes and body_bytes[-1:] == b"\x00":
    body_bytes = body_bytes[:-1]
  try:
    raw = json.loads(body_bytes.decode("utf-8", errors="replace"))
    payload = CalendarIngestCycleRequest.model_validate(raw)
  except (json.JSONDecodeError, ValidationError) as error:
    raise HTTPException(
      status_code=422,
      detail={"message": "Invalid calendar cycle acknowledgement", "error": str(error)},
    )
  completed_at = int(payload.completedAt)
  observed_at = int(_time.time())
  _research_store.set_metadata("last_calendar_cycle_at", str(observed_at))
  _research_store.set_metadata("last_calendar_cycle_failed_batches", str(payload.failedBatches))
  if payload.failedBatches > 0:
    return {
      "accepted": False,
      "captured": 0,
      "reconcileScheduled": False,
      "reason": "Incomplete upload cycle",
    }
  _research_store.set_metadata("last_calendar_successful_cycle_at", str(observed_at))
  captured = _research_store.capture_release_observations(
    FORWARD_LEDGER_ACTIVATED_AT,
    observed_at,
    released_through=completed_at,
    ea_completed_at=completed_at,
  )
  scheduled = _schedule_forward_reconcile(observed_at)
  return {
    "accepted": True,
    "captured": captured,
    "reconcileScheduled": scheduled,
    "activatedAt": FORWARD_LEDGER_ACTIVATED_AT,
    "eaCompletedAt": completed_at,
    "observedAt": observed_at,
  }


@app.get("/calendar")
def calendar(
  from_: Optional[int] = None,
  to: Optional[int] = None,
  impact: Optional[str] = None,
  country: Optional[str] = None,
) -> List[Dict[str, Any]]:
  """
  Return stored calendar events filtered by time, impact and country.

  - from_: UNIX seconds (inclusive lower bound)
  - to: UNIX seconds (inclusive upper bound)
  - impact: comma-separated list of levels: low,medium,high
  - country: comma-separated list of ISO country/region codes (US,EU,...)
  """

  impacts: Optional[Set[str]] = None
  if impact:
    raw_levels = [part.strip().lower() for part in impact.split(",") if part.strip()]
    if raw_levels:
      impacts = set(raw_levels)

  countries: Optional[Set[str]] = None
  if country:
    raw_countries = [part.strip().upper() for part in country.split(",") if part.strip()]
    if raw_countries:
      countries = set(raw_countries)

  return _research_store.query_calendar(
    from_time=from_,
    to_time=to,
    impacts=impacts,
    countries=countries,
  )


def _research_price_fingerprint(candles: List[Dict[str, Any]]) -> str:
  compact = [
    [
      int(candle["time"]),
      float(candle["open"]),
      float(candle["high"]),
      float(candle["low"]),
      float(candle["close"]),
    ]
    for candle in candles
  ]
  return hashlib.sha256(json.dumps(compact, separators=(",", ":")).encode("utf-8")).hexdigest()


def _fetch_research_candles_unlocked(
  symbol: str,
  timeframe: str,
  from_time: int,
  to_time: int,
  chunk_days: int,
) -> List[Dict[str, Any]]:
  cached = _research_store.query_candles(symbol, timeframe, from_time, to_time)
  if not _ensure_mt5_initialized():
    return cached

  mt5_tf = mt5_timeframe(timeframe)
  ensure_symbol_selected(symbol)
  fetched: List[Dict[str, Any]] = []
  cursor = from_time
  chunk_seconds = chunk_days * 24 * 60 * 60
  while cursor < to_time:
    end = min(to_time, cursor + chunk_seconds)
    rates = mt5.copy_rates_range(
      symbol,
      mt5_tf,
      datetime.fromtimestamp(cursor, tz=timezone.utc),
      datetime.fromtimestamp(end, tz=timezone.utc),
    )
    if rates is not None and len(rates) > 0:
      fetched.extend(convert_rate_row(row) for row in rates)
    cursor = end + 1

  if fetched:
    deduped = {int(candle["time"]): candle for candle in fetched}
    rows = [deduped[key] for key in sorted(deduped)]
    _research_store.upsert_candles(symbol, timeframe, rows)
    return _research_store.query_candles(symbol, timeframe, from_time, to_time)
  return cached


def _fetch_research_candles(
  symbol: str,
  timeframe: str,
  from_time: int,
  to_time: int,
  chunk_days: int,
) -> List[Dict[str, Any]]:
  with _mt5_access():
    return _fetch_research_candles_unlocked(symbol, timeframe, from_time, to_time, chunk_days)


def _paper_case_state(outcomes: Dict[str, Dict[str, Any]]) -> str:
  statuses = {str(outcome.get("status", "")) for outcome in outcomes.values()}
  if "pending" in statuses:
    return "monitoring"
  if "unevaluable" in statuses:
    return "unevaluable"
  return "completed"


def _reconcile_forward_paper_definition(
  definition: Any,
  observed_at: int,
  observations: List[Dict[str, Any]],
) -> None:
  """Freeze and advance one immutable research definition's paper cases."""
  candidates = [
    candidate for candidate in build_signal_candidates(observations, now=observed_at, definition=definition)
    if int(candidate["eventTime"]) >= int(definition.created_at)
  ]
  existing = {
    int(case["eventTime"]): case
    for case in _research_store.query_paper_cases(definition.id)
  }
  first_seen_by_time: Dict[int, int] = {}
  for event in observations:
    event_time = int(event["time"])
    first_seen_by_time[event_time] = max(
      first_seen_by_time.get(event_time, 0), int(event["firstSeenAt"])
    )
  for candidate in candidates:
    event_time = int(candidate["eventTime"])
    if event_time in existing:
      continue
    frozen_at = first_seen_by_time.get(event_time, observed_at)
    initial_outcomes = {
      str(target): {
        "eventTime": event_time,
        "direction": candidate["direction"],
        "targetR": target,
        "status": "no_direction" if candidate["direction"] == "none" else "pending",
        "resultR": None,
        "reason": "Exact factor-vote tie" if candidate["direction"] == "none" else "Waiting for price monitoring",
      }
      for target in TARGET_R_VALUES
    }
    state = "no_direction" if candidate["direction"] == "none" else "monitoring"
    _research_store.save_paper_case(
      definition.id, event_time, frozen_at, state, candidate, initial_outcomes, observed_at
    )

  cases = _research_store.query_paper_cases(definition.id)
  directional = [
    case for case in cases
    if case["candidate"].get("direction") != "none"
    and case["state"] in {"monitoring", "unevaluable"}
  ]
  if not directional:
    return

  earliest = min(int(case["eventTime"]) for case in directional) - 60 * 24 * 60 * 60
  h4_candles = _fetch_research_candles("EURUSD", "H4", earliest, observed_at + H4_SECONDS, 31)
  if not h4_candles:
    return
  candle_times = [int(candle["time"]) for candle in h4_candles]
  atr_values = calculate_atr_by_candle(h4_candles)

  def m1_provider(from_time: int, to_time: int) -> List[Dict[str, Any]]:
    return _fetch_research_candles("EURUSD", "M1", from_time, to_time, 1)

  for case in directional:
    candidate = case["candidate"]
    outcomes = {
      str(target): evaluate_candidate(
        candidate,
        h4_candles,
        candle_times,
        atr_values,
        target,
        m1_provider,
        allow_pending=True,
        as_of=observed_at,
      )
      for target in TARGET_R_VALUES
    }
    entry_times = [
      int(outcome["entryTime"])
      for outcome in outcomes.values()
      if outcome.get("entryTime") is not None
    ]
    state = _paper_case_state(outcomes)
    if entry_times and min(entry_times) <= int(case["frozenAt"]):
      state = "late_for_contract"
    _research_store.update_paper_case(
      definition.id, int(case["eventTime"]), state, outcomes, observed_at
    )


def _reconcile_forward_paper(observed_at: int) -> None:
  """Advance every source model used by the current Charts signal model."""
  observations = _research_store.query_release_observations(
    from_time=FORWARD_LEDGER_ACTIVATED_AT,
    currencies=["EUR", "USD"],
  )
  for definition in SIGNAL_DEFINITIONS.values():
    if not definition.historical_gate_allowed:
      _reconcile_forward_paper_definition(definition, observed_at, observations)


def _run_scheduled_forward_reconcile(observed_at: int) -> None:
  global _forward_reconcile_scheduled
  try:
    _reconcile_forward_paper(observed_at)
    for market in WORKBENCH_MARKETS:
      try:
        # The release-observation revision already invalidates stale responses.
        # Do not force a full seven-market rebuild after every EA cycle.
        response = research_chart_signals(symbol=market, tf="H4", mode="current", refresh=True)
        qualified_keys = {
          (str(row["patternId"]), int(row["eventTime"]))
          for row in _research_store.list_fms_live_decisions(market, 500)
          if row.get("status") == "qualified" and row.get("prospectiveEligible") is True
        }
        has_live_case = any(
          (str(signal.get("patternId") or ""), int(signal.get("eventTime") or 0)) in qualified_keys
          and signal.get("outcomeStatus") == "pending"
          for signal in response.get("signals") or []
        )
        if has_live_case:
          _fetch_research_candles(
            market, "H4", observed_at - 60 * 24 * 60 * 60,
            observed_at + H4_SECONDS, 60,
          )
          response = research_chart_signals(symbol=market, tf="H4", mode="current", refresh=True)
        _capture_forward_entry_quotes(response, observed_at)
      except Exception:
        logger.exception("registered_shadow_reconcile failed market=%s observed_at=%s", market, observed_at)
    _capture_tagged_demo_deals(observed_at)
  except Exception:
      logger.exception("forward_paper_reconcile failed observed_at=%s", observed_at)
  finally:
    with _forward_schedule_lock:
      _forward_reconcile_scheduled = False


def _quote_snapshot_for_forward_case(symbol: str, activation_time: int, observed_at: int) -> Optional[Dict[str, Any]]:
  """Capture the first available broker quote after a declared reference time; never infer a fill."""
  try:
    with _mt5_access():
      if not _ensure_mt5_initialized() or not mt5.symbol_select(symbol, True):
        return None
      info = mt5.symbol_info(symbol)
      if info is None:
        return None
      tick = None
      source = "current_snapshot"
      try:
        ticks = mt5.copy_ticks_range(
          symbol,
          datetime.fromtimestamp(int(activation_time), tz=timezone.utc),
          datetime.fromtimestamp(int(observed_at), tz=timezone.utc),
          mt5.COPY_TICKS_INFO,
        )
        if ticks is not None and len(ticks) > 0:
          tick = ticks[0]
          source = "first_tick_after_observation"
      except Exception:
        logger.debug("forward_tick_history_unavailable symbol=%s reference=%s", symbol, activation_time)
      if tick is None:
        tick = mt5.symbol_info_tick(symbol)
      if tick is None:
        return None
      tick_data = _namedtuple_to_dict(tick)
      bid = float(tick_data.get("bid") or getattr(tick, "bid", 0) or 0)
      ask = float(tick_data.get("ask") or getattr(tick, "ask", 0) or 0)
      quote_time = int(tick_data.get("time") or getattr(tick, "time", 0) or 0)
      if bid <= 0 or ask <= 0 or ask < bid or quote_time < int(activation_time):
        return None
      point = float(getattr(info, "point", 0) or 0)
      lag = max(0, quote_time - int(activation_time))
      return {
        "bid": bid,
        "ask": ask,
        "spreadPrice": ask - bid,
        "spreadPoints": None if point <= 0 else (ask - bid) / point,
        "point": point or None,
        "digits": int(getattr(info, "digits", 0) or 0),
        "quoteTime": quote_time,
        "capturedAt": int(observed_at),
        "entryLagSeconds": lag,
        "quality": "first_tick" if source == "first_tick_after_observation" else "near_entry" if lag <= 120 else "late_snapshot",
        "source": source,
        "disclosure": "Observed MT5 bid/ask only; this is not a broker fill and excludes commission, slippage, and swap.",
      }
  except Exception:
    logger.exception("forward_quote_capture_failed symbol=%s activation=%s", symbol, activation_time)
    return None


def _entry_timing_audit(
  event_time: int,
  first_seen_at: int,
  direction: str,
  quote: Dict[str, Any],
  candles_by_timeframe: Dict[str, List[Dict[str, Any]]],
  decided_at: Optional[int] = None,
) -> Dict[str, Any]:
  """Compare immutable observed timing with later candle opens without inferring a fill."""
  quote_time = int(quote["quoteTime"])
  bid = float(quote["bid"])
  ask = float(quote["ask"])
  midpoint = (bid + ask) / 2
  point = float(quote.get("point") or 0)
  digits = int(quote.get("digits") or 0)
  pip_size = .01 if digits in {2, 3} else .0001 if digits in {4, 5} else point or None
  sign = 1 if direction == "long" else -1
  entries: List[Dict[str, Any]] = []
  for timeframe in ("M1", "H1", "H4"):
    candle = next(
      (row for row in candles_by_timeframe.get(timeframe, []) if int(row["time"]) > int(first_seen_at)),
      None,
    )
    if candle is None:
      entries.append({
        "timeframe": timeframe, "status": "waiting_for_candle", "entryTime": None,
        "entryOpen": None, "gapPips": None, "directionAdjustedGapPips": None,
      })
      continue
    entry_time = int(candle["time"])
    entry_open = float(candle["open"])
    comparable = entry_time >= quote_time and pip_size is not None and pip_size > 0
    gap_pips = None if not comparable else (entry_open - midpoint) / pip_size
    entries.append({
      "timeframe": timeframe,
      "status": "observed" if comparable else "quote_captured_after_entry",
      "entryTime": entry_time,
      "entryOpen": entry_open,
      "gapPips": gap_pips,
      "directionAdjustedGapPips": None if gap_pips is None else gap_pips * sign,
    })
  return {
    "schema": "fms-prospective-entry-timing-v1",
    "status": "prospective_observation_only",
    "eventTime": int(event_time),
    "firstSeenAt": int(first_seen_at),
    "firstSeenDelaySeconds": max(0, int(first_seen_at) - int(event_time)),
    "decisionAt": None if decided_at is None else int(decided_at),
    "decisionDelaySeconds": None if decided_at is None else max(0, int(decided_at) - int(event_time)),
    "processingDelaySeconds": None if decided_at is None else max(0, int(decided_at) - int(first_seen_at)),
    "quoteTime": quote_time,
    "quoteDelaySeconds": max(0, quote_time - int(event_time)),
    "observedMid": midpoint,
    "entries": entries,
    "disclosure": (
      "Observed MT5 quote and later candle opens only. These are not broker fills, and no historical "
      "release-time price is reconstructed."
    ),
  }


def _entry_timing_audit_for_signal(
  market: str,
  signal: Dict[str, Any],
  quote: Dict[str, Any],
  first_seen_at: int,
  observed_at: int,
  fetch_missing: bool = False,
  decided_at: Optional[int] = None,
) -> Dict[str, Any]:
  ranges = {"M1": 2 * 60, "H1": 2 * 60 * 60, "H4": 2 * H4_SECONDS}
  candles: Dict[str, List[Dict[str, Any]]] = {}
  for timeframe, duration in ranges.items():
    to_time = min(int(observed_at), int(first_seen_at) + duration)
    rows = _research_store.query_candles(market, timeframe, int(first_seen_at), to_time)
    if fetch_missing and to_time > int(first_seen_at) and not any(
      int(row["time"]) > int(first_seen_at) for row in rows
    ):
      rows = _fetch_research_candles(market, timeframe, int(first_seen_at), to_time, 1)
    candles[timeframe] = rows
  return _entry_timing_audit(
    int(signal.get("eventTime") or 0), int(first_seen_at), str(signal.get("direction") or "long"),
    quote, candles, decided_at,
  )


def _forward_demo_tag(model_id: str, market: str, pattern_id: str, event_time: int) -> str:
  digest = hashlib.sha256(
    f"{model_id}|{market.upper()}|{pattern_id}|{int(event_time)}".encode("utf-8")
  ).hexdigest()[:10].upper()
  return f"FMS-{digest}"


def _prospective_capture_eligibility(
  events: List[Dict[str, Any]],
  event_time: int,
  activation_time: Optional[int],
  decided_at: int,
  first_seen_by_event: Dict[Tuple[int, int], int],
) -> Dict[str, Any]:
  """Accept a live setup only when its complete package was known before entry."""
  first_seen_values = [
    first_seen_by_event[(int(event["id"]), int(event["time"]))]
    for event in events
    if event.get("id") is not None
    and (int(event["id"]), int(event["time"])) in first_seen_by_event
  ]
  package_first_seen = max(first_seen_values, default=None)
  if package_first_seen is None:
    return {"eligible": False, "reason": "missing_first_seen_timestamp", "firstSeenAt": None, "activationTime": activation_time}
  if package_first_seen < int(event_time):
    return {"eligible": False, "reason": "invalid_pre_release_observation", "firstSeenAt": package_first_seen, "activationTime": activation_time}
  if activation_time is None:
    return {"eligible": False, "reason": "entry_candle_unavailable", "firstSeenAt": package_first_seen, "activationTime": None}
  if package_first_seen >= int(activation_time):
    return {"eligible": False, "reason": "observed_after_frozen_entry", "firstSeenAt": package_first_seen, "activationTime": int(activation_time)}
  if int(decided_at) >= int(activation_time):
    return {"eligible": False, "reason": "decision_after_frozen_entry", "firstSeenAt": package_first_seen, "activationTime": int(activation_time)}
  return {"eligible": True, "reason": "captured_before_frozen_entry", "firstSeenAt": package_first_seen, "activationTime": int(activation_time)}


def _planned_strictly_later_h4_open(event_time: int, candle_times: List[int]) -> int:
  """Return the next H4 boundary even before that future candle is loaded."""
  loaded_next = next((int(timestamp) for timestamp in candle_times if int(timestamp) > int(event_time)), None)
  if loaded_next is not None:
    return loaded_next
  phase = int(candle_times[-1]) % H4_SECONDS if candle_times else 0
  intervals = (int(event_time) - phase) // H4_SECONDS + 1
  return phase + intervals * H4_SECONDS


def _capture_tagged_demo_deals(observed_at: int) -> Dict[str, Any]:
  """Read explicitly tagged demo deals. This function never sends or changes an order."""
  def finish(payload: Dict[str, Any]) -> Dict[str, Any]:
    status = {**payload, "checkedAt": int(observed_at), "orderTransmission": False}
    _research_store.set_metadata("fms_demo_capture_status", json.dumps(status, separators=(",", ":")))
    return status

  decisions = [
    row for row in _research_store.list_fms_live_decisions(limit=500)
    if row.get("modelId") == PRACTICAL_MODEL_ID and row.get("status") == "qualified" and row.get("prospectiveEligible") is True
  ]
  tag_map = {
    _forward_demo_tag(PRACTICAL_MODEL_ID, row["market"], row["patternId"], row["eventTime"]): row
    for row in decisions
  }
  case_by_tag = {
    _forward_demo_tag(PRACTICAL_MODEL_ID, row["market"], row["patternId"], row["eventTime"]): row
    for row in _research_store.list_fms_live_execution_cases(limit=2000)
    if row.get("modelId") == PRACTICAL_MODEL_ID
  }
  if not tag_map:
    return finish({"status": "waiting_for_qualified_signal", "captured": 0, "accountLogin": None})
  try:
    with _mt5_access():
      if not _ensure_mt5_initialized():
        return finish({"status": "mt5_unavailable", "captured": 0, "accountLogin": None})
      account = mt5.account_info()
      if account is None:
        return finish({"status": "account_unavailable", "captured": 0, "accountLogin": None})
      account_data = _namedtuple_to_dict(account)
      account_login = int(account_data.get("login") or getattr(account, "login", 0) or 0)
      account_balance = float(account_data.get("balance") or getattr(account, "balance", 0) or 0)
      trade_mode = int(account_data.get("trade_mode") if account_data.get("trade_mode") is not None else getattr(account, "trade_mode", -1))
      demo_mode = int(getattr(mt5, "ACCOUNT_TRADE_MODE_DEMO", 0))
      if trade_mode != demo_mode:
        return finish({"status": "blocked_non_demo_account", "captured": 0, "accountLogin": account_login, "tradeMode": trade_mode})
      deals = mt5.history_deals_get(
        datetime.fromtimestamp(FORWARD_LEDGER_ACTIVATED_AT, tz=timezone.utc),
        datetime.fromtimestamp(int(observed_at) + 1, tz=timezone.utc),
      )
  except Exception:
    logger.exception("fms_demo_deal_capture_failed observed_at=%s", observed_at)
    return finish({"status": "capture_failed", "captured": 0, "accountLogin": None})
  captured = 0
  position_tags = {
    int(row["positionId"]): str(row["signalTag"])
    for row in _research_store.list_fms_demo_deals(limit=20000)
    if row.get("positionId") is not None and str(row.get("signalTag") or "") in tag_map
  }
  for deal in sorted(deals or [], key=lambda row: (int(getattr(row, "time", 0) or 0), int(getattr(row, "ticket", 0) or 0))):
    raw = _namedtuple_to_dict(deal)
    comment = str(raw.get("comment") or getattr(deal, "comment", "") or "").strip()
    token = comment.split(maxsplit=1)[0].upper() if comment else ""
    position_id = int(raw.get("position_id") or 0)
    if token not in tag_map and position_id in position_tags:
      token = position_tags[position_id]
    decision = tag_map.get(token)
    if decision is None or str(raw.get("symbol") or "").upper() != str(decision["market"]).upper():
      continue
    case = case_by_tag.get(token) or {}
    signal = case.get("signal") or {}
    entry_type = raw.get("entry")
    if entry_type == int(getattr(mt5, "DEAL_ENTRY_IN", 0)) and signal.get("stop") is not None:
      direction = str(signal.get("direction") or decision.get("direction") or "")
      order_type = getattr(mt5, "ORDER_TYPE_BUY", 0) if direction == "long" else getattr(mt5, "ORDER_TYPE_SELL", 1)
      initial_risk = None
      try:
        with _mt5_access():
          calculated = mt5.order_calc_profit(
            order_type, str(raw.get("symbol") or ""), float(raw.get("volume") or 0),
            float(raw.get("price") or 0), float(signal.get("initialStop") or signal["stop"]),
          )
        initial_risk = None if calculated is None else abs(float(calculated))
      except Exception:
        logger.exception("fms_demo_risk_calculation_failed tag=%s ticket=%s", token, raw.get("ticket"))
      actual_stop = None
      actual_target = None
      symbol_point = None
      try:
        with _mt5_access():
          positions = mt5.positions_get(ticket=position_id) if position_id else None
          orders = mt5.history_orders_get(position=position_id) if position_id else None
          symbol_info = mt5.symbol_info(str(raw.get("symbol") or ""))
        protection_sources = [
          *(_namedtuple_to_dict(row) for row in (positions or [])),
          *(_namedtuple_to_dict(row) for row in (orders or [])),
        ]
        for source in protection_sources:
          source_stop = float(source.get("sl") or 0)
          source_target = float(source.get("tp") or 0)
          if actual_stop is None and source_stop > 0:
            actual_stop = source_stop
          if actual_target is None and source_target > 0:
            actual_target = source_target
          if actual_stop is not None and actual_target is not None:
            break
        symbol_point = float(getattr(symbol_info, "point", 0) or 0) or None
        if actual_stop is not None:
          with _mt5_access():
            calculated = mt5.order_calc_profit(
              order_type, str(raw.get("symbol") or ""), float(raw.get("volume") or 0),
              float(raw.get("price") or 0), float(actual_stop),
            )
          initial_risk = None if calculated is None else abs(float(calculated))
      except Exception:
        logger.exception("fms_demo_protection_capture_failed tag=%s position=%s", token, position_id)
      raw = {
        **raw,
        "fms_model_entry": signal.get("entry"),
        "fms_model_stop": signal.get("initialStop") or signal.get("stop"),
        "fms_account_balance": account_balance,
        "fms_initial_risk_account": initial_risk,
        "fms_actual_stop": actual_stop,
        "fms_actual_target": actual_target,
        "fms_protection_verified": actual_stop is not None and actual_target is not None,
        "fms_symbol_point": symbol_point,
        "fms_risk_percent": (
          None if initial_risk is None or account_balance <= 0
          else initial_risk / account_balance * 100
        ),
        "fms_capture_lag_seconds": max(0, int(observed_at) - int(raw.get("time") or observed_at)),
      }
    if _research_store.record_fms_demo_deal(account_login, token, observed_at, raw):
      captured += 1
    if position_id:
      position_tags[position_id] = token
  return finish({
    "status": "capturing_demo_deals", "captured": captured, "accountLogin": account_login,
    "tradeMode": demo_mode, "recognizedTags": len(tag_map),
  })


def _capture_forward_entry_quotes(response: Dict[str, Any], observed_at: int) -> None:
  market = str(response.get("symbol") or "").upper()
  if not market:
    return
  existing = {
    (str(row["patternId"]), int(row["eventTime"])): row
    for row in _research_store.list_fms_live_execution_cases(market, 500)
  }
  decision_keys = {
    (str(row["patternId"]), int(row["eventTime"])): row
    for row in _research_store.list_fms_live_decisions(market, 500)
    if row.get("status") == "qualified" and row.get("prospectiveEligible") is True
  }
  for signal in response.get("signals") or []:
    key = (str(signal.get("patternId") or ""), int(signal.get("eventTime") or 0))
    decision = decision_keys.get(key)
    if decision is None or key[1] > int(observed_at):
      continue
    prior = existing.get(key) or {}
    quote = prior.get("entryQuote")
    first_seen_at = ((decision.get("assessment") or {}).get("prospectiveCapture") or {}).get("firstSeenAt")
    if first_seen_at is None:
      continue
    if quote is None:
      quote = _quote_snapshot_for_forward_case(market, int(first_seen_at), observed_at)
    if quote is None:
      continue
    signal["releaseObservationQuote"] = quote
    signal["entryTimingAudit"] = _entry_timing_audit_for_signal(
      market, signal, quote, int(first_seen_at), observed_at, fetch_missing=True,
      decided_at=int(decision.get("firstDecidedAt") or observed_at),
    )
    _research_store.record_fms_live_execution_observation(
      PRACTICAL_MODEL_ID, market, key[0], key[1], observed_at, signal, quote,
    )


def _schedule_forward_reconcile(observed_at: int) -> bool:
  global _forward_reconcile_scheduled
  with _forward_schedule_lock:
    if _forward_reconcile_scheduled:
      return False
    _forward_reconcile_scheduled = True
  _forward_executor.submit(_run_scheduled_forward_reconcile, observed_at)
  return True


def _forward_paper_payload(version_id: str) -> Dict[str, Any]:
  definition = get_signal_definition(version_id)
  if definition is None or definition.historical_gate_allowed:
    raise HTTPException(status_code=400, detail="Forward paper ledger is available for registered exploratory source models only")
  cases = _research_store.query_paper_cases(version_id)
  eligible_cases = [case for case in cases if case["state"] != "late_for_contract"]
  target_metrics: Dict[str, Dict[str, Any]] = {}
  for target in TARGET_R_VALUES:
    key = str(target)
    outcomes = [case["outcomes"][key] for case in eligible_cases if key in case["outcomes"]]
    target_metrics[key] = aggregate_outcomes(outcomes)
  highlighted = target_metrics[str(2.0)]
  now = int(_time.time())
  activated_at = max(FORWARD_LEDGER_ACTIVATED_AT, int(definition.created_at))
  elapsed_days = max(0, (now - activated_at) // (24 * 60 * 60))
  ci = highlighted.get("expectancyCi95")
  checks = {
    "minimumElapsedDays": elapsed_days >= int(FORWARD_PAPER_GATE["minimumElapsedDays"]),
    "minimumEvaluable": highlighted["evaluableCount"] >= int(FORWARD_PAPER_GATE["minimumEvaluable"]),
    "maximumAmbiguousRate": (
      highlighted["ambiguousRate"] is not None
      and highlighted["ambiguousRate"] <= float(FORWARD_PAPER_GATE["maximumAmbiguousRate"])
    ),
    "positiveExpectancyLower95": ci is not None and float(ci["lower"]) > 0,
    "costModel": False,
  }
  observation_count = len(_research_store.query_release_observations(
    from_time=FORWARD_LEDGER_ACTIVATED_AT, currencies=["EUR", "USD"]
  ))
  last_cycle_raw = _research_store.get_metadata("last_calendar_successful_cycle_at")
  failed_batches_raw = _research_store.get_metadata("last_calendar_cycle_failed_batches")
  return {
    "versionId": version_id,
    "activatedAt": activated_at,
    "elapsedDays": elapsed_days,
    "immutable": True,
    "lastSuccessfulCycleAt": int(last_cycle_raw) if last_cycle_raw is not None else None,
    "lastCycleFailedBatches": int(failed_batches_raw or "0"),
    "observationCount": observation_count,
    "caseCount": len(cases),
    "directionalCount": sum(case["candidate"].get("direction") != "none" for case in cases),
    "monitoringCount": sum(case["state"] == "monitoring" for case in cases),
    "completedCount": sum(case["state"] == "completed" for case in cases),
    "noDirectionCount": sum(case["state"] == "no_direction" for case in cases),
    "lateForContractCount": sum(case["state"] == "late_for_contract" for case in cases),
    "targets": target_metrics,
    "checks": checks,
    "eligible": all(checks.values()),
    "gate": FORWARD_PAPER_GATE,
    "recentCases": list(reversed(cases[-30:])),
  }


def _execute_macro_backtest(run_id: str, event_fingerprint: str, version_id: str) -> None:
  created_at = int(_time.time())
  definition = get_signal_definition(version_id)
  if definition is None:
    return
  try:
    _research_store.save_backtest_run(
      run_id, definition.id, event_fingerprint, created_at, "running"
    )
    currencies = list(definition.configuration.get("marketCurrencies") or ["EUR", "USD"])
    symbol = str(definition.configuration.get("symbol") or "EURUSD")
    events = _research_store.query_calendar(currencies=currencies)
    candidates = build_signal_candidates(events, now=created_at, definition=definition)
    if not candidates:
      raise RuntimeError(f"No registered {symbol} release packages are stored yet")

    earliest = min(int(candidate["eventTime"]) for candidate in candidates) - 60 * 24 * 60 * 60
    latest = min(
      created_at,
      max(int(candidate["eventTime"]) for candidate in candidates),
    ) + 10 * 24 * 60 * 60

    h4_candles = _fetch_research_candles(symbol, "H4", earliest, latest, 366)
    if not h4_candles:
      raise RuntimeError(f"No {symbol} H4 candles are available from MT5 or the research cache")

    def m1_provider(from_time: int, to_time: int) -> List[Dict[str, Any]]:
      return _fetch_research_candles(symbol, "M1", from_time, to_time, 1)

    coverage = _research_store.calendar_coverage(currencies)
    result = build_backtest_result(events, h4_candles, m1_provider, coverage, created_at, definition)

    combined_fingerprint = hashlib.sha256(
      f"{event_fingerprint}:{_research_price_fingerprint(h4_candles)}".encode("utf-8")
    ).hexdigest()
    result["datasetFingerprint"] = combined_fingerprint
    result["eventFingerprint"] = event_fingerprint
    result["market"] = symbol
    _research_store.save_backtest_run(
      run_id,
      definition.id,
      combined_fingerprint,
      created_at,
      "completed",
      result=result,
    )
  except Exception as error:
    logger.exception("macro_signal_backtest run_id=%s failed", run_id)
    _research_store.save_backtest_run(
      run_id,
      definition.id,
      event_fingerprint,
      created_at,
      "failed",
      error=str(error),
    )


@app.get("/research/coverage")
def research_coverage() -> Dict[str, Any]:
  coverage = _research_store.calendar_coverage(["EUR", "USD"])
  return {
    **coverage,
    "durable": True,
    "versionId": ACTIVE_VERSION_ID,
    "backfillRecommended": coverage["earliest"] is None
    or int(_time.time()) - int(coverage["earliest"]) < 5 * 365 * 24 * 60 * 60,
    "recommendedBackfill": {
      "currenciesList": "USD,EUR",
      "lookBackDays": 10000,
      "maxEventsPerCurrency": 10000,
      "restoreLookBackDays": 400,
    },
  }


@app.post("/research/cache-market")
def cache_research_market(payload: FmsMarketCacheRequest) -> Dict[str, Any]:
  """Durably cache H4 prices for a declared market; M1 remains lazy and path-only."""
  market = payload.market
  currencies = WORKBENCH_MARKETS[market]["currencies"]
  coverage = _research_store.calendar_coverage(currencies)
  earliest = coverage.get("earliest")
  if earliest is None:
    raise HTTPException(status_code=409, detail=f"No durable {market} calendar history is available")
  candles = _fetch_research_candles(market, "H4", int(earliest) - 60 * 24 * 60 * 60, int(_time.time()), 366)
  if not candles:
    raise HTTPException(status_code=409, detail=f"MT5 did not provide {market} H4 history")
  return {
    "market": market,
    "timeframe": "H4",
    "count": len(candles),
    "earliest": int(candles[0]["time"]),
    "latest": int(candles[-1]["time"]),
    "calendarCoverage": coverage,
    "m1Policy": "Not cached here; fetched only for H4 bars that need intrabar stop/target resolution.",
  }


@app.get("/research/expansion-report")
def research_expansion_report() -> Dict[str, Any]:
  """Return the fixed path/excursion and development-selected stress matrix."""
  source_versions = sorted({str(pattern["sourceVersion"]) for pattern in CHART_SIGNAL_PATTERN_DEFINITIONS})
  sources: List[Dict[str, Any]] = []
  run_ids: List[str] = []
  for source_version in source_versions:
    run = _research_store.latest_backtest_run(source_version)
    result = run.get("result") if run and run.get("status") == "completed" else None
    if not isinstance(result, dict):
      raise HTTPException(status_code=409, detail=f"Run {source_version} before loading the FMS expansion report")
    outcomes = result.get("targets", {}).get("2.0", {}).get("outcomes")
    split_time = result.get("candidateSummary", {}).get("developmentHoldoutBoundary")
    if not isinstance(outcomes, list) or not isinstance(split_time, int):
      raise HTTPException(status_code=409, detail=f"{source_version} lacks the frozen candidate split required by expansion research")
    outcomes_by_target = {
      target_r: target_payload.get("outcomes", [])
      for target_r, target_payload in result.get("targets", {}).items()
      if isinstance(target_payload, dict)
    }
    catalog = build_chart_signal_pattern_catalog(outcomes, split_time, outcomes_by_target, source_version)
    current_patterns = {
      signature: str(pattern["id"])
      for pattern in catalog
      if pattern["currentEligible"]
      for signature in pattern["signatures"]
    }
    sources.append({
      "versionId": source_version,
      "outcomes": outcomes,
      "splitTime": split_time,
      "currentPatterns": current_patterns,
      "generatedAt": int(result.get("generatedAt") or _time.time()),
    })
    run_ids.append(str(run.get("id", "")))

  research_price_cutoff = max(int(source["generatedAt"]) for source in sources)
  h4_candles = _research_store.query_candles("EURUSD", "H4", 0, research_price_cutoff + H4_SECONDS)
  if not h4_candles:
    raise HTTPException(status_code=409, detail="No durable EURUSD H4 candles are available for path research")
  candle_revision = f"{len(h4_candles)}:{int(h4_candles[-1]['time'])}"
  cache_key = hashlib.sha256("|".join([
    *run_ids,
    candle_revision,
    CHART_SIGNAL_MODEL_HASH,
    str(CANDIDATE_STRESS_SCHEMA_VERSION),
  ]).encode("utf-8")).hexdigest()
  with _candidate_stress_lock:
    cached = _candidate_stress_cache.get(cache_key)
  if cached is not None:
    return {**cached, "cached": True}
  durable_cache_key = f"fms_expansion_report:{cache_key}"
  durable_cached = _research_store.get_metadata(durable_cache_key)
  if durable_cached:
    try:
      parsed = json.loads(durable_cached)
      if isinstance(parsed, dict) and parsed.get("schemaVersion") == CANDIDATE_STRESS_SCHEMA_VERSION:
        with _candidate_stress_lock:
          _candidate_stress_cache.clear()
          _candidate_stress_cache[cache_key] = parsed
        return {**parsed, "cached": True}
    except (TypeError, ValueError):
      logger.warning("Ignoring unreadable durable FMS expansion report cache")

  report = build_candidate_stress_report(sources, h4_candles, int(_time.time()))
  report["sourceRunIds"] = run_ids
  _research_store.set_metadata(durable_cache_key, json.dumps(report, separators=(",", ":")))
  _research_store.set_metadata("fms_expansion_report:latest", json.dumps(report, separators=(",", ":")))
  with _candidate_stress_lock:
    _candidate_stress_cache.clear()
    _candidate_stress_cache[cache_key] = report
  return {**report, "cached": False}


def _latest_cached_expansion_report() -> Optional[Dict[str, Any]]:
  candidates: List[Dict[str, Any]] = []
  with _candidate_stress_lock:
    candidates.extend(_candidate_stress_cache.values())
  for raw in _research_store.metadata_values("fms_expansion_report:"):
    try:
      parsed = json.loads(raw)
      if isinstance(parsed, dict) and parsed.get("schemaVersion") == CANDIDATE_STRESS_SCHEMA_VERSION:
        candidates.append(parsed)
    except (TypeError, ValueError):
      continue
  return max(candidates, key=lambda row: int(row.get("generatedAt", 0)), default=None)


def _workbench_source_bundle(market: str = "EURUSD", run_ids: Optional[List[str]] = None) -> Dict[str, Any]:
  normalized_market = market.upper()
  market_definition = WORKBENCH_MARKETS.get(normalized_market)
  if market_definition is None:
    raise HTTPException(status_code=400, detail="Unsupported FMS market")
  source_versions = market_definition["sourceVersions"] or sorted({str(pattern["sourceVersion"]) for pattern in CHART_SIGNAL_PATTERN_DEFINITIONS})
  sources: List[Dict[str, Any]] = []
  resolved_run_ids: List[str] = []
  fingerprints: List[str] = []
  requested_runs = {
    str(run.get("versionId")): run
    for run_id in (run_ids or [])
    if (run := _research_store.get_backtest_run(run_id)) is not None
  }
  if run_ids and len(requested_runs) != len(run_ids):
    raise HTTPException(status_code=409, detail="A recorded source run is no longer available")
  for source_version in source_versions:
    run = (
      requested_runs.get(source_version)
      if run_ids is not None
      else _research_store.latest_backtest_run(source_version)
    )
    result = run.get("result") if run and run.get("status") == "completed" else None
    if not isinstance(result, dict):
      raise HTTPException(status_code=409, detail=f"Run {source_version} before using the FMS workbench")
    outcomes = result.get("targets", {}).get("2.0", {}).get("outcomes")
    split_time = result.get("candidateSummary", {}).get("developmentHoldoutBoundary")
    if not isinstance(outcomes, list) or not isinstance(split_time, int):
      raise HTTPException(status_code=409, detail=f"{source_version} lacks a frozen research split")
    sources.append({
      "versionId": source_version,
      "outcomes": outcomes,
      "splitTime": split_time,
      "generatedAt": int(result.get("generatedAt") or _time.time()),
    })
    resolved_run_ids.append(str(run["id"]))
    fingerprints.append(str(run.get("datasetFingerprint", "")))
  cutoff = max(int(source["generatedAt"]) for source in sources)
  candles = _research_store.query_candles(normalized_market, "H4", 0, cutoff + H4_SECONDS)
  if not candles:
    raise HTTPException(status_code=409, detail=f"No durable {normalized_market} H4 candles are available")
  candle_revision = f"{len(candles)}:{int(candles[-1]['time'])}"
  dataset = hashlib.sha256("|".join([normalized_market, *fingerprints, candle_revision]).encode("utf-8")).hexdigest()
  return {
    "market": normalized_market,
    "sources": sources,
    "runIds": resolved_run_ids,
    "candles": candles,
    "cutoff": cutoff,
    "candleRevision": candle_revision,
    "datasetFingerprint": dataset,
  }


def _workbench_catalog(bundle: Dict[str, Any]) -> Dict[str, Any]:
  market = str(bundle.get("market") or "EURUSD")
  report = _latest_cached_expansion_report()
  report_revision = str(int((report or {}).get("generatedAt", 0)))
  cache_key = f"fms_workbench_catalog_v8:{market}:{bundle['datasetFingerprint']}:{report_revision}:{WORKBENCH_SCORING_ENGINE_VERSION}:{PRACTICAL_MODEL_HASH}"
  durable_cached = _research_store.get_metadata(cache_key)
  if durable_cached:
    try:
      parsed = json.loads(durable_cached)
      if isinstance(parsed, dict) and isinstance(parsed.get("items"), list):
        return parsed
    except (TypeError, ValueError):
      logger.warning("Ignoring unreadable durable FMS workbench catalog")
  report_candidates = {
    (str(row["sourceVersionId"]), str(row["signature"])): row
    for row in (report or {}).get("candidates", [])
  }
  registered = {
    (str(pattern["sourceVersion"]), str(signature)): pattern
    for pattern in PRACTICAL_PATTERN_DEFINITIONS
    if str(pattern.get("market")) == market and pattern.get("current")
    for signature in pattern["signatures"]
  }
  directional_catalog: List[Dict[str, Any]] = []
  for source in bundle["sources"]:
    source_version = str(source["versionId"])
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for outcome in _annotate_numeric_robustness(source["outcomes"]):
      if outcome.get("direction") in {"long", "short"}:
        grouped.setdefault(candidate_pattern_signature(outcome), []).append(outcome)
    for signature, rows in sorted(grouped.items()):
      enriched = report_candidates.get((source_version, signature))
      pattern = registered.get((source_version, signature))
      events = [event for row in rows for event in row.get("events", [])]
      groups = signature.split("|")[1:]
      treatments = [{
        "id": "base",
        "dimension": "none",
        "value": "all",
        "reaction": "continuation",
        "label": "All matching cases",
        "historicalN": int(enriched.get("historicalN", len(rows))) if enriched else len(rows),
      }, {
        "id": "base-contrarian",
        "dimension": "none",
        "value": "all",
        "reaction": "contrarian",
        "label": "All matching cases",
        "historicalN": int(enriched.get("historicalN", len(rows))) if enriched else len(rows),
      }]
      magnitude_counts: Dict[str, int] = {}
      for row in rows:
        category = str((row.get("numericRobustness") or {}).get("relativeMagnitude", "insufficient"))
        magnitude_counts[category] = magnitude_counts.get(category, 0) + 1
      for category in ("ordinary", "large", "exceptional", "insufficient"):
        count = magnitude_counts.get(category, 0)
        if count:
          treatments.append({
            "id": hashlib.sha256(f"relativeMagnitude|{category}|continuation".encode("utf-8")).hexdigest()[:12],
            "dimension": "relativeMagnitude",
            "value": category,
            "reaction": "continuation",
            "label": f"Relative magnitude: {category}",
            "historicalN": count,
          })
      upper_tail_count = magnitude_counts.get("large", 0) + magnitude_counts.get("exceptional", 0)
      if upper_tail_count:
        treatments.append({
          "id": hashlib.sha256(b"relativeMagnitude|upper_tail|continuation").hexdigest()[:12],
          "dimension": "relativeMagnitude",
          "value": "upper_tail",
          "reaction": "continuation",
          "label": "Relative magnitude: top 20%",
          "historicalN": upper_tail_count,
        })
      if enriched:
        seen = {("none", "all", "continuation"), ("none", "all", "contrarian")}
        for variant in enriched.get("numericRobustness", {}).get("variants", []):
          key = (str(variant["dimension"]), str(variant["cohort"]), str(variant["reaction"]))
          if key in seen:
            continue
          seen.add(key)
          treatments.append({
            "id": hashlib.sha256("|".join(key).encode("utf-8")).hexdigest()[:12],
            "dimension": key[0],
            "value": key[1],
            "reaction": key[2],
            "label": f"{variant['dimensionLabel']}: {variant['cohort']}",
            "historicalN": int(variant["historicalN"]),
          })
      catalog_id = hashlib.sha256(f"{market}|{source_version}|{signature}".encode("utf-8")).hexdigest()[:16]
      directional_catalog.append({
        "market": market,
        "id": catalog_id,
        "sourceVersionId": source_version,
        "signature": signature,
        "label": str((enriched or pattern or {}).get("label") or " + ".join(groups)),
        "direction": signature.split("|", 1)[0],
        "family": " + ".join(group.split(":", 1)[-1].replace("_", " ") for group in groups),
        "groups": groups,
        "exactTitles": sorted({str(event.get("title", "")) for event in events if event.get("title")}),
        "historicalN": int(enriched.get("historicalN", len(rows))) if enriched else len(rows),
        "registered": pattern is not None,
        "registeredExecution": dict(pattern["execution"]) if pattern else None,
        "treatments": treatments,
      })
  grouped_catalog: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
  for item in directional_catalog:
    directionless_signature = str(item["signature"]).split("|", 1)[-1]
    grouped_catalog.setdefault((str(item["sourceVersionId"]), directionless_signature), []).append(item)
  catalog: List[Dict[str, Any]] = []
  for (source_version, directionless_signature), variants in grouped_catalog.items():
    variants.sort(key=lambda row: (str(row["direction"]), str(row["signature"])))
    treatment_totals: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
    for variant in variants:
      for treatment in variant["treatments"]:
        key = (str(treatment["dimension"]), str(treatment["value"]), str(treatment["reaction"]))
        existing = treatment_totals.get(key)
        if existing is None:
          treatment_totals[key] = {**treatment, "historicalN": int(treatment["historicalN"])}
        else:
          existing["historicalN"] = int(existing["historicalN"]) + int(treatment["historicalN"])
    registered_variant = next((row for row in variants if row["registered"]), None)
    parent_id = hashlib.sha256(f"{market}|{source_version}|{directionless_signature}".encode("utf-8")).hexdigest()[:16]
    directions = {str(row["direction"]) for row in variants}
    catalog.append({
      "market": market,
      "id": parent_id,
      "sourceVersionId": source_version,
      "signature": str(variants[0]["signature"]),
      "signatures": [str(row["signature"]) for row in variants],
      "label": str((registered_variant or variants[0])["label"]),
      "direction": "both" if len(directions) > 1 else next(iter(directions)),
      "family": str(variants[0]["family"]),
      "groups": list(variants[0]["groups"]),
      "exactTitles": sorted({title for row in variants for title in row["exactTitles"]}),
      "historicalN": sum(int(row["historicalN"]) for row in variants),
      "registered": any(bool(row["registered"]) for row in variants),
      "registeredExecution": dict(registered_variant["registeredExecution"]) if registered_variant else None,
      "directionVariants": [{
        "direction": str(row["direction"]),
        "signature": str(row["signature"]),
        "historicalN": int(row["historicalN"]),
        "treatments": list(row["treatments"]),
      } for row in variants],
      "treatments": sorted(treatment_totals.values(), key=lambda row: (str(row["dimension"]) != "none", str(row["label"]))),
    })
  catalog.sort(key=lambda row: (not row["registered"], -int(row["historicalN"]), str(row["label"])))
  result = {
    "items": catalog,
    "advancedTreatmentsReady": report is not None,
    "generatedAt": int((report or {}).get("generatedAt", _time.time())),
  }
  _research_store.set_metadata(cache_key, json.dumps(result, separators=(",", ":")))
  return result


def _workbench_reaction_atlas(market: str) -> Optional[Dict[str, Any]]:
  raw = _research_store.get_metadata("fms_reaction_atlas:latest")
  if not raw:
    return None
  try:
    artifact = json.loads(raw)
  except (TypeError, ValueError):
    return None
  market_payload = next((
    row for row in artifact.get("markets", [])
    if str(row.get("market", "")).upper() == market.upper()
  ), None)
  if not isinstance(market_payload, dict):
    return None
  labels = {
    "historically_profitable_candidate": "Historically profitable candidate",
    "directional_contender": "Directional contender",
    "avoid_standalone_direction": "Avoid as standalone direction",
    "insufficient_evidence": "Insufficient evidence",
  }
  rows = []
  for row in market_payload.get("rows", []):
    execution = row.get("execution") or {}
    rows.append({
      "id": hashlib.sha256(
        f"{market}|{row.get('sourceVersionId')}|{row.get('identity')}|{row.get('policy')}|{row.get('reaction')}".encode("utf-8")
      ).hexdigest()[:16],
      "label": str(row.get("label", "Economic release package")),
      "classification": str(row.get("classification", "insufficient_evidence")),
      "classificationLabel": labels.get(str(row.get("classification")), "Insufficient evidence"),
      "policy": str(row.get("policy", "baseline")),
      "reaction": str(row.get("reaction", "continuation")),
      "historicalN": int(row.get("historicalN", 0)),
      "horizonH4": int(row.get("selectedHorizonH4", 0)),
      "holdoutAverageR": (execution.get("holdout") or {}).get("stressedAverageR"),
      "recentAverageR": (execution.get("recent") or {}).get("stressedAverageR"),
    })
  order = {
    "historically_profitable_candidate": 0,
    "directional_contender": 1,
    "avoid_standalone_direction": 2,
    "insufficient_evidence": 3,
  }
  rows.sort(key=lambda row: (
    order.get(row["classification"], 4),
    -float(row["holdoutAverageR"] if row["holdoutAverageR"] is not None else -999),
    -int(row["historicalN"]),
    row["label"],
  ))
  return {
    "version": str(artifact.get("version", "")),
    "artifactHash": str(artifact.get("artifactHash", "")),
    "generatedAt": int(artifact.get("generatedAt", 0)),
    "counts": dict(market_payload.get("counts") or {}),
    "rows": rows,
  }


def _experiment_summary(experiment: Dict[str, Any]) -> Dict[str, Any]:
  result = experiment.get("result") or {}
  return {
    **{key: experiment.get(key) for key in (
      "id", "friendlyName", "createdAt", "status", "configurationHash",
      "datasetFingerprint", "error",
    )},
    "catalogSnapshot": experiment.get("catalogSnapshot"),
    "configuration": experiment.get("configuration"),
    "resultSummary": None if not result else {
      "historicalN": result.get("historicalN"),
      "selectedConfiguration": result.get("selectedConfiguration"),
      "checks": result.get("checks"),
      "passesExploratoryScreen": result.get("passesExploratoryScreen"),
      "passesStrictHoldoutCheck": result.get("passesStrictHoldoutCheck"),
    },
  }


QUALIFICATION_V2_ID = "FMS-QUALIFICATION-v2"


def _qv2_metrics(
  rows: List[Dict[str, Any]], seed: int = 0, bootstrap: bool = True,
) -> Dict[str, Any]:
  evaluable = [row for row in rows if row.get("status") in {"target_hit", "stop_hit", "expired"} and row.get("stressedResultR") is not None]
  values = [float(row["stressedResultR"]) for row in evaluable]
  n = len(values)
  mean = statistics.fmean(values) if values else None
  blocks: Dict[int, List[float]] = {}
  for row in evaluable:
    blocks.setdefault(datetime.fromtimestamp(int(row["eventTime"]), timezone.utc).year, []).append(float(row["stressedResultR"]))
  interval_note = None
  intervals = {"80": None, "90": None, "95": None}
  p_value = None
  p_replications = 10_000
  if bootstrap and len(blocks) >= 5 and values:
    rng = random.Random(seed)
    years = sorted(blocks)
    block_stats = {year: (sum(blocks[year]), len(blocks[year])) for year in years}
    def sampled_mean(source: Dict[int, tuple[float, int]]) -> float:
      selected = [years[rng.randrange(len(years))] for _ in years]
      total = sum(source[year][0] for year in selected)
      count = sum(source[year][1] for year in selected)
      return total / count
    reps = [sampled_mean(block_stats) for _ in range(10_000)]
    reps.sort()
    intervals = {str(int(level * 100)): {"lower": reps[int((1 - level) / 2 * 9_999)], "upper": reps[int((1 + level) / 2 * 9_999)]} for level in (.8, .9, .95)}
    centered = {year: [value - mean for value in block] for year, block in blocks.items()}
    centered_stats = {year: (sum(centered[year]), len(centered[year])) for year in years}
    exceedances = sum(sampled_mean(centered_stats) >= mean for _ in range(10_000))
    if exceedances <= 20:
      p_replications = 250_000
      exceedances += sum(sampled_mean(centered_stats) >= mean for _ in range(p_replications - 10_000))
    p_value = (1 + exceedances) / (p_replications + 1)
  elif bootstrap:
    interval_note = "Insufficient year coverage: calendar-year block bootstrap requires at least five represented years."
  return {"n": n, "averageR": mean, "targetRate": sum(row["status"] == "target_hit" for row in evaluable) / n if n else None, "stopRate": sum(row["status"] == "stop_hit" for row in evaluable) / n if n else None, "expiryRate": sum(row["status"] == "expired" for row in evaluable) / n if n else None, "ambiguityRate": sum(row.get("status") == "ambiguous" for row in rows) / len(rows) if rows else None, "intervals": intervals, "representedYears": len(blocks), "intervalNote": interval_note, "oneSidedNoEdgePValue": p_value, "bootstrap": {"method": "calendar-year block bootstrap; percentile intervals; centered-year null; deterministic extreme-tail refinement", "intervalReplications": 10000, "pValueReplications": p_replications}, "values": values}


def _qv2_select(rows_by_contract: Dict[str, List[Dict[str, Any]]], before: int) -> Optional[str]:
  candidates = []
  for contract, rows in rows_by_contract.items():
    values = [
      float(row["stressedResultR"])
      for row in rows
      if int(row["eventTime"]) < before
      and row.get("status") in {"target_hit", "stop_hit", "expired"}
      and row.get("stressedResultR") is not None
    ]
    if values:
      average = statistics.fmean(values)
      margin = 1.959963985 * statistics.stdev(values) / math.sqrt(len(values)) if len(values) > 1 else 0.0
      candidates.append((average - margin, average, contract))
  return max(candidates)[2] if candidates else None


def _qv2_contract_neighbours(
  rows_by_contract: Dict[str, List[Dict[str, Any]]], selected: Optional[str],
) -> List[str]:
  if not selected:
    return []
  parsed = []
  for key in rows_by_contract:
    try:
      stop, target, holding = key.split("|")
      parsed.append((key, float(stop), float(target), int(holding)))
    except (TypeError, ValueError):
      continue
  try:
    selected_stop, selected_target, selected_holding = selected.split("|")
    selected_values = (float(selected_stop), float(selected_target), int(selected_holding))
  except (TypeError, ValueError):
    return []
  stops = sorted({row[1] for row in parsed})
  targets = sorted({row[2] for row in parsed})
  holdings = sorted({row[3] for row in parsed})
  selected_indices = (
    stops.index(selected_values[0]), targets.index(selected_values[1]),
    holdings.index(selected_values[2]),
  )
  return [
    key for key, stop, target, holding in parsed
    if key != selected and all(abs(left - right) <= 1 for left, right in zip(
      (stops.index(stop), targets.index(target), holdings.index(holding)),
      selected_indices,
    ))
  ]


def _qualification_v2(experiment: Dict[str, Any], declared_rules: int = 1, fixed_contract: Optional[str] = None) -> Dict[str, Any]:
  seed = int(hashlib.sha256(f"{QUALIFICATION_V2_ID}|{experiment['configurationHash']}|{experiment['datasetFingerprint']}|standalone".encode()).hexdigest()[:16], 16)
  raw = _research_store.get_metadata(f"fms_raw_audit:{experiment['id']}")
  if not raw:
    raise HTTPException(status_code=409, detail="This immutable experiment has no retained raw path audit")
  audit = json.loads(raw)
  rows_by_contract = {str(key): list(value) for key, value in dict(audit.get("contractResults") or {}).items()}
  reference = next(iter(rows_by_contract.values()), [])
  event_times = sorted({int(row["eventTime"]) for row in reference if row.get("status") in {"target_hit", "stop_hit", "expired"}})
  if len(event_times) < 80:
    return {"version": QUALIFICATION_V2_ID, "tier": "Rejected", "checks": {"minimumCases": False}, "reason": "Five-fold nested walk-forward requires at least 80 evaluable cases."}
  initial = len(event_times) // 2
  remaining = event_times[initial:]
  fold_size = len(remaining) // 5
  folds, pooled, neighbour_fold_results = [], [], []
  for index in range(5):
    test_times = remaining[index * fold_size:(index + 1) * fold_size if index < 4 else len(remaining)]
    if not test_times: continue
    selected = fixed_contract or _qv2_select(rows_by_contract, test_times[0])
    test = [row for row in rows_by_contract.get(selected or "", []) if int(row["eventTime"]) in set(test_times)]
    metrics = _qv2_metrics(test, seed + index, bootstrap=False)
    usable = metrics["n"] >= 8
    neighbour_rows = []
    for neighbour in _qv2_contract_neighbours(rows_by_contract, selected):
      neighbour_test = [
        row for row in rows_by_contract[neighbour]
        if int(row["eventTime"]) in set(test_times)
      ]
      neighbour_metrics = _qv2_metrics(neighbour_test, bootstrap=False)
      if neighbour_metrics["n"] >= 8 and neighbour_metrics["averageR"] is not None:
        neighbour_row = {
          "fold": index + 1, "contract": neighbour,
          "n": neighbour_metrics["n"], "averageR": neighbour_metrics["averageR"],
        }
        neighbour_rows.append(neighbour_row)
        neighbour_fold_results.append(neighbour_row)
    folds.append({"index": index + 1, "start": test_times[0], "end": test_times[-1], "selectedContract": selected, "usable": usable, "neighbours": neighbour_rows, **{key: value for key, value in metrics.items() if key != "values"}})
    if usable: pooled.extend(test)
  pooled_metrics = _qv2_metrics(pooled, seed)
  neighbour_values = [float(row["averageR"]) for row in neighbour_fold_results]
  neighbour_positive = sum(value > 0 for value in neighbour_values)
  neighbour_stability = {
    "evaluatedCount": len(neighbour_values),
    "positiveCount": neighbour_positive,
    "positiveShare": neighbour_positive / len(neighbour_values) if neighbour_values else None,
    "minimumR": min(neighbour_values) if neighbour_values else None,
    "medianR": statistics.median(neighbour_values) if neighbour_values else None,
    "maximumR": max(neighbour_values) if neighbour_values else None,
  }
  years: Dict[int, List[float]] = {}
  for row in pooled:
    if row.get("stressedResultR") is not None: years.setdefault(datetime.fromtimestamp(int(row["eventTime"]), timezone.utc).year, []).append(float(row["stressedResultR"]))
  positive_years = sum(statistics.fmean(values) > 0 for values in years.values())
  positives = sorted([value for value in pooled_metrics["values"] if value > 0], reverse=True)
  total_positive = sum(positives)
  top_three = sum(positives[:3]) / total_positive if total_positive else 1.0
  best_year = max((sum(value for value in values if value > 0) for values in years.values()), default=0.0) / total_positive if total_positive else 1.0
  equity, peak, drawdown = 0.0, 0.0, 0.0
  for row in sorted(pooled, key=lambda row: int(row["eventTime"])):
    equity += float(row.get("stressedResultR") or 0.0); peak = max(peak, equity); drawdown = max(drawdown, peak - equity)
  contract_count = len(rows_by_contract)
  values = pooled_metrics["values"]
  effective_trials = max(1, declared_rules * contract_count)
  existing = experiment.get("result") or {}
  selected = existing.get("selectedConfiguration") or {}
  strict = dict(existing.get("checks") or {})
  wf_positive = sum(bool(fold.get("averageR") and fold["averageR"] > 0) for fold in folds if fold.get("usable"))
  pooled_lower90 = (pooled_metrics["intervals"]["90"] or {}).get("lower")
  checks = {
    "overallPositive": (selected.get("overall", {}).get("stressedAverageR") or 0) > 0,
    "developmentPositive": (selected.get("development", {}).get("stressedAverageR") or 0) > 0,
    "holdoutPositive": (selected.get("holdout", {}).get("stressedAverageR") or 0) > 0,
    "recentPositive": (selected.get("recent", {}).get("stressedAverageR") or 0) > 0,
    "walkForwardPositive": (pooled_metrics["averageR"] or 0) > 0,
    "minimumCases": int(existing.get("historicalN") or 0) >= 80,
    "walkForwardSample": pooled_metrics["n"] >= 30,
    "positiveFolds": wf_positive >= 3,
    "positiveYears": len(years) > 0 and positive_years / len(years) >= .5,
    "ambiguity": (pooled_metrics["ambiguityRate"] or 0) <= .05,
    "concentrationYears": best_year <= .5,
    "concentrationTrades": top_three <= .5,
    "uncertainty90": pooled_lower90 is not None and float(pooled_lower90) >= -.05,
    "neighbourStability": (
      neighbour_stability["positiveShare"] is not None
      and float(neighbour_stability["positiveShare"]) >= .70
    ),
  }
  research = all(checks.values())
  strict_lower = (selected.get("holdout", {}).get("stressedExpectancyCi95") or {}).get("lower")
  raw_p = pooled_metrics.get("oneSidedNoEdgePValue")
  pooled_lower95 = (pooled_metrics["intervals"]["95"] or {}).get("lower")
  confirmed = research and pooled_lower95 is not None and float(pooled_lower95) > 0 and strict_lower is not None and float(strict_lower) > 0 and (positive_years / len(years) if years else 0) >= .6 and raw_p is not None and raw_p <= .05
  return {"version": QUALIFICATION_V2_ID, "tier": "Statistically confirmed" if confirmed else "Research candidate" if research else "Rejected", "fixedContract": fixed_contract, "strictChecks": strict, "checks": checks, "walkForward": {"pooled": {key: value for key, value in pooled_metrics.items() if key != "values"}, "folds": folds, "positiveFoldCount": wf_positive, "positiveYears": positive_years, "calendarYears": len(years), "maximumDrawdownR": drawdown, "topThreeTradeContribution": top_three, "bestYearContribution": best_year, "neighbourStability": neighbour_stability}, "multipleTesting": {"status": "pending sweep context", "method": "Holm-Bonferroni is applied only inside an immutable sweep manifest", "seed": seed, "declaredCandidateRuleCount": None, "contractCount": contract_count, "effectiveTrialCount": None, "rawPValue": raw_p, "holmAdjustedPValue": None, "passes": False, "limitations": "An individual experiment is not a frozen sweep family."}}


@app.get("/research/workbench")
def research_workbench(market: str = "EURUSD") -> Dict[str, Any]:
  normalized_market = market.upper()
  market_definition = WORKBENCH_MARKETS.get(normalized_market)
  if market_definition is None:
    raise HTTPException(status_code=400, detail="Unsupported FMS market")
  calendar_coverage = _research_store.calendar_coverage(market_definition["currencies"])
  required_versions = market_definition["sourceVersions"] or sorted({str(pattern["sourceVersion"]) for pattern in CHART_SIGNAL_PATTERN_DEFINITIONS})
  source_headers = [_research_store.latest_backtest_run_header(version) for version in required_versions]
  missing_source_versions = [version for version, header in zip(required_versions, source_headers) if not header or header.get("status") != "completed"]
  h4_coverage = _research_store.candle_coverage(normalized_market, "H4")
  followup_index = registered_context_followup_index()
  followup_rows = {
    key: value for key, value in (followup_index.get("profiles") or {}).items()
    if str(key).startswith(f"{normalized_market}|")
  }
  followup_summary = {
    "schema": followup_index.get("schema") or "fms-context-followup-index-v1",
    "generatedAt": followup_index.get("generatedAt"),
    "refreshPolicy": followup_index.get("refreshPolicy"),
    "recipesAudited": len(followup_rows),
    "policyInflationSupported": sum(((row.get("policyInflation") or {}).get("selectedCandidate") or {}).get("status") == "later_supported" for row in followup_rows.values()),
    "boundedInteractionsSupported": sum((row.get("boundedInteractions") or {}).get("status") == "later_supported" for row in followup_rows.values()),
    "transferCandidates": [row for row in (followup_index.get("crossMarketTransfers") or []) if row.get("targetMarket") == normalized_market and row.get("status") == "later_supported"],
    "activeRegistryPreserved": True,
  }
  current_model_summary = {
    "id": PRACTICAL_MODEL_ID,
    "researchEngineId": RELEASE_REACTION_ENGINE_ID,
    "friendlyName": "Registered Reaction Atlas",
    "displayId": "Active registered v4",
    "hash": PRACTICAL_MODEL_HASH,
    "activatedAt": PRACTICAL_MODEL_CREATED_AT,
    "timeframe": "H4",
    "registeredSetups": [{
      "id": str(pattern["id"]),
      "label": str(pattern["label"]),
      "condition": str(pattern["condition"]),
      "sourceVersionId": str(pattern["sourceVersion"]),
      "signatures": list(pattern["signatures"]),
      "scoringPolicy": str(pattern.get("scoringPolicy", "forecast_quality")),
      "reaction": str(pattern.get("reaction", "continuation")),
      "cohort": dict(pattern.get("cohort") or {"dimension": "none", "value": "all"}),
      "execution": dict(pattern["execution"]),
      "registrationEvidence": _registration_display_evidence(pattern),
    } for original in PRACTICAL_PATTERN_DEFINITIONS
      for pattern in [_reconciled_pattern(original)]
      if pattern.get("current") and str(pattern.get("market")) == normalized_market],
  }
  static_revision = hashlib.sha256("|".join([
    normalized_market,
    *(str((header or {}).get("id") or "missing") for header in source_headers),
  ]).encode("utf-8")).hexdigest()
  static_key = f"fms_workbench_static_v1:{static_revision}"
  static_cached = _research_store.get_metadata(static_key)
  if not static_cached and not missing_source_versions and h4_coverage.get("count"):
    expected_runs = [str((header or {}).get("id") or "") for header in source_headers]
    for prior_value in reversed(_research_store.metadata_values("fms_workbench_static_v1:")):
      try:
        prior_payload = json.loads(prior_value)
      except (TypeError, ValueError):
        continue
      if (
        isinstance(prior_payload, dict)
        and prior_payload.get("market") == normalized_market
        and list(prior_payload.get("sourceRunIds") or []) == expected_runs
      ):
        static_cached = prior_value
        _research_store.set_metadata(static_key, prior_value)
        break
  if static_cached and not missing_source_versions and h4_coverage.get("count"):
    try:
      static_payload = json.loads(static_cached)
      if isinstance(static_payload, dict):
        return {
          **static_payload,
          "currentModel": current_model_summary,
          "contextFollowup": followup_summary,
          "reactionAtlas": _workbench_reaction_atlas(normalized_market),
          "experiments": _research_store.list_fms_experiment_headers(normalized_market, 500),
          "candidates": [row for row in _research_store.list_fms_candidates() if str((row.get("configuration") or {}).get("market", "EURUSD")) == normalized_market],
          "archive": _research_store.list_signal_version_archive(),
        }
    except (TypeError, ValueError):
      logger.warning("Ignoring unreadable durable FMS workbench shell for %s", normalized_market)
  if missing_source_versions or not h4_coverage.get("count"):
    return {
      "market": normalized_market,
      "currentModel": {**current_model_summary, "registeredSetups": []},
      "catalog": {"items": [], "advancedTreatmentsReady": False, "generatedAt": int(_time.time())},
      "protocol": {"stopAtrValues": list(STRESS_STOP_ATR_VALUES), "targetRValues": list(STRESS_TARGET_R_VALUES), "holdingCandles": list(STRESS_HOLDING_CANDLES), "scoringPolicies": ["baseline", "surprise_only", "momentum_only", "agreement_no_bonus", "forecast_quality"], "entry": "first_h4_open_strictly_after_release", "selection": "development_lower95_then_average"},
      "experiments": [], "candidates": [], "archive": _research_store.list_signal_version_archive(),
      "reactionAtlas": _workbench_reaction_atlas(normalized_market),
      "contextFollowup": followup_summary,
      "dataPeriods": {"durableCalendar": {"start": calendar_coverage.get("earliest"), "end": calendar_coverage.get("latest")}, "workbenchResearch": {"start": None, "end": None}, "h4Prices": {"start": h4_coverage.get("earliest"), "end": h4_coverage.get("latest")}},
      "datasetFingerprint": f"unavailable:{normalized_market}", "sourceRunIds": [], "candleRevision": "unavailable",
      "availability": {"ready": False, "missingSourceVersions": missing_source_versions, "missingH4Prices": not h4_coverage.get("count"), "message": f"{normalized_market} research is blocked until durable calendar history and {normalized_market} H4 prices are backfilled, then its market-labelled source backtests complete."},
    }
  bundle = _workbench_source_bundle(normalized_market)
  catalog = _workbench_catalog(bundle)
  research_times = [
    int(outcome["eventTime"])
    for source in bundle["sources"]
    for outcome in source["outcomes"]
    if outcome.get("eventTime") is not None
  ]
  price_times = [int(candle["time"]) for candle in bundle["candles"]]
  payload = {
    "market": normalized_market,
    "currentModel": current_model_summary,
    "catalog": catalog,
    "protocol": {
      "stopAtrValues": list(STRESS_STOP_ATR_VALUES),
      "targetRValues": list(STRESS_TARGET_R_VALUES),
      "holdingCandles": list(STRESS_HOLDING_CANDLES),
      "scoringPolicies": ["baseline", "surprise_only", "momentum_only", "agreement_no_bonus", "forecast_quality"],
      "entry": "first_h4_open_strictly_after_release",
      "selection": "development_lower95_then_average",
    },
    "experiments": _research_store.list_fms_experiment_headers(normalized_market, 500),
    "candidates": [row for row in _research_store.list_fms_candidates() if str((row.get("configuration") or {}).get("market", "EURUSD")) == normalized_market],
    "archive": _research_store.list_signal_version_archive(),
    "reactionAtlas": _workbench_reaction_atlas(normalized_market),
    "contextFollowup": followup_summary,
    "dataPeriods": {
      "durableCalendar": {
        "start": calendar_coverage.get("earliest"),
        "end": calendar_coverage.get("latest"),
      },
      "workbenchResearch": {
        "start": min(research_times, default=None),
        "end": max(research_times, default=None),
      },
      "h4Prices": {
        "start": min(price_times, default=None),
        "end": max(price_times, default=None),
      },
    },
    "datasetFingerprint": bundle["datasetFingerprint"],
    "sourceRunIds": bundle["runIds"],
    "candleRevision": bundle["candleRevision"],
  }
  _research_store.set_metadata(static_key, json.dumps({
    key: value for key, value in payload.items() if key not in {"experiments", "candidates", "archive"}
  }, separators=(",", ":")))
  return payload


def _validate_experiment_request(payload: FmsExperimentRequest, catalog: Dict[str, Any]) -> Dict[str, Any]:
  item = next((row for row in catalog["items"] if row["id"] == payload.catalogId), None)
  if item is None:
    raise HTTPException(status_code=400, detail="Unknown or stale FMS catalog selection")
  if payload.scoringPolicy not in {"baseline", "surprise_only", "momentum_only", "agreement_no_bonus", "forecast_quality"}:
    raise HTTPException(status_code=400, detail="Unsupported scoring policy")
  variants = list(item.get("directionVariants") or [{
    "direction": item.get("direction"), "signature": item.get("signature"),
    "historicalN": item.get("historicalN"), "treatments": item.get("treatments", []),
  }])
  selected_variants = variants if payload.directionSelection == "both" else [
    row for row in variants if str(row["direction"]) == payload.directionSelection
  ]
  if not selected_variants:
    raise HTTPException(status_code=400, detail="Selected direction is unavailable for this setup")
  available_treatments = item["treatments"] if payload.directionSelection == "both" else selected_variants[0]["treatments"]
  treatment = next((row for row in available_treatments if (
    row["dimension"] == payload.cohort.dimension
    and row["value"] == payload.cohort.value
    and row["reaction"] == payload.reaction
  )), None)
  if treatment is None:
    raise HTTPException(status_code=400, detail="Unsupported evidence-treatment combination")
  allowed_stops = set(float(value) for value in STRESS_STOP_ATR_VALUES)
  allowed_targets = set(float(value) for value in STRESS_TARGET_R_VALUES)
  allowed_holding = set(int(value) for value in STRESS_HOLDING_CANDLES)
  execution = payload.execution
  if not execution.stopAtrValues or not set(execution.stopAtrValues).issubset(allowed_stops):
    raise HTTPException(status_code=400, detail="Unsupported ATR stop selection")
  if not execution.targetRValues or not set(execution.targetRValues).issubset(allowed_targets):
    raise HTTPException(status_code=400, detail="Unsupported R target selection")
  if not execution.holdingCandles or not set(execution.holdingCandles).issubset(allowed_holding):
    raise HTTPException(status_code=400, detail="Unsupported H4 expiry selection")
  if execution.mode == "single" and not (
    len(execution.stopAtrValues) == len(execution.targetRValues) == len(execution.holdingCandles) == 1
  ):
    raise HTTPException(status_code=400, detail="Single-contract experiments require one stop, target, and expiry")
  return {"item": item, "treatment": treatment, "variants": selected_variants}


def _execute_workbench_experiment(experiment_id: str) -> None:
  experiment = _research_store.get_fms_experiment(experiment_id)
  if experiment is None:
    return
  try:
    _research_store.update_fms_experiment(experiment_id, "running")
    configuration = dict(experiment["configuration"])
    bundle = _workbench_source_bundle(str(configuration.get("market", "EURUSD")), list(configuration["sourceRunIds"]))
    if bundle["datasetFingerprint"] != experiment["datasetFingerprint"]:
      raise ValueError("The recorded source dataset changed before this experiment started; submit a new E experiment")
    result = build_workbench_experiment(
      bundle["sources"], bundle["candles"], configuration, int(_time.time())
    )
    raw_audit = result.pop("rawAudit", None)
    result.update({
      "experimentId": experiment_id,
      "configurationHash": experiment["configurationHash"],
      "datasetFingerprint": experiment["datasetFingerprint"],
      "catalogSnapshot": experiment["catalogSnapshot"],
    })
    _research_store.update_fms_experiment(experiment_id, "completed", result=result)
    if isinstance(raw_audit, dict):
      _research_store.set_metadata(f"fms_raw_audit:{experiment_id}", json.dumps(raw_audit, separators=(",", ":")))
  except Exception as exc:  # noqa: BLE001 - persist the complete local research failure
    logger.exception("FMS workbench experiment %s failed", experiment_id)
    _research_store.update_fms_experiment(experiment_id, "failed", error=str(exc))


@app.post("/research/experiments")
def create_research_experiment(payload: FmsExperimentRequest) -> Dict[str, Any]:
  bundle = _workbench_source_bundle(payload.market)
  catalog = _workbench_catalog(bundle)
  selection = _validate_experiment_request(payload, catalog)
  configuration = {
    "market": payload.market,
    "sourceVersionId": selection["item"]["sourceVersionId"],
    "signature": selection["variants"][0]["signature"],
    "signatures": [row["signature"] for row in selection["variants"]],
    "directionSelection": payload.directionSelection,
    "scoringPolicy": payload.scoringPolicy,
    "scoringEngineVersion": WORKBENCH_SCORING_ENGINE_VERSION,
    "pairOrientationVersion": PAIR_ORIENTATION_VERSION,
    "researchDiagnosticsVersion": WORKBENCH_RESEARCH_DIAGNOSTICS_VERSION,
    "cohort": payload.cohort.model_dump(),
    "reaction": payload.reaction,
    "execution": payload.execution.model_dump(),
    "entry": "first_h4_open_strictly_after_release",
    "sourceRunIds": bundle["runIds"],
    "researchPriceCutoff": bundle["cutoff"],
    "candleRevision": bundle["candleRevision"],
  }
  configuration_hash = hashlib.sha256(
    json.dumps(configuration, sort_keys=True, separators=(",", ":")).encode("utf-8")
  ).hexdigest()
  experiment_id = _research_store.allocate_fms_id("E", payload.market)
  _research_store.create_fms_experiment(
    experiment_id,
    payload.friendlyName.strip(),
    int(_time.time()),
    configuration,
    configuration_hash,
    selection["item"],
    bundle["datasetFingerprint"],
  )
  cached = _research_store.find_completed_fms_experiment(
    configuration_hash, bundle["datasetFingerprint"]
  )
  if cached and cached["id"] != experiment_id and cached.get("result"):
    result = {**cached["result"], "experimentId": experiment_id, "reusedResultFrom": cached["id"]}
    _research_store.update_fms_experiment(experiment_id, "completed", result=result)
    cached_audit = _research_store.get_metadata(f"fms_raw_audit:{cached['id']}")
    if cached_audit:
      _research_store.set_metadata(f"fms_raw_audit:{experiment_id}", cached_audit)
  else:
    _research_executor.submit(_execute_workbench_experiment, experiment_id)
  return _research_store.get_fms_experiment(experiment_id) or {}


@app.get("/research/experiments")
def list_research_experiments() -> List[Dict[str, Any]]:
  return [_experiment_summary(row) for row in _research_store.list_fms_experiments(500)]


@app.get("/research/experiments/{experiment_id}")
def get_research_experiment(experiment_id: str) -> Dict[str, Any]:
  experiment = _research_store.get_fms_experiment(experiment_id)
  if experiment is None:
    raise HTTPException(status_code=404, detail="Unknown FMS experiment")
  return experiment


@app.get("/research/experiments/{experiment_id}/qualification-v2")
def get_research_experiment_qualification_v2(experiment_id: str) -> Dict[str, Any]:
  experiment = _research_store.get_fms_experiment(experiment_id)
  if experiment is None:
    raise HTTPException(status_code=404, detail="Unknown FMS experiment")
  if experiment.get("status") != "completed":
    raise HTTPException(status_code=409, detail="Qualification v2 requires a completed experiment")
  fixed_contract = "2|4|60" if experiment_id == "FMS-GBPUSD-H4-E012" else None
  method_hash = hashlib.sha256(b"FMS-QUALIFICATION-v2:year-block-bootstrap:10000:tail-250000:oos-neighbours:holm-pending").hexdigest()
  cached = _research_store.get_fms_qualification_audit(experiment_id, QUALIFICATION_V2_ID, experiment["configurationHash"], experiment["datasetFingerprint"], method_hash)
  if cached: return cached
  result = _qualification_v2(experiment, fixed_contract=fixed_contract)
  now = int(_time.time())
  audit = {**result, "auditId": f"FMS-{experiment['configuration'].get('market','EURUSD')}-Q2-{hashlib.sha256((experiment_id+method_hash).encode()).hexdigest()[:12]}", "experimentId": experiment_id, "market": experiment["configuration"].get("market", "EURUSD"), "configurationHash": experiment["configurationHash"], "datasetFingerprint": experiment["datasetFingerprint"], "sweepManifestHash": None, "createdAt": now}
  _research_store.save_fms_qualification_audit(audit, method_hash)
  return audit


@app.get("/research/experiments/{experiment_id}/raw-cases")
def get_research_experiment_raw_cases(
  experiment_id: str,
  page: int = 1,
  pageSize: int = 50,
  contract: str = "",
  search: str = "",
  direction: str = "all",
  inclusion: str = "all",
  reliability: str = "all",
  outcome: str = "all",
  dateFrom: int = 0,
  dateTo: int = 0,
) -> Dict[str, Any]:
  experiment = _research_store.get_fms_experiment(experiment_id)
  if experiment is None:
    raise HTTPException(status_code=404, detail="Unknown FMS experiment")
  if experiment.get("status") != "completed":
    raise HTTPException(status_code=409, detail="Raw data is available only for completed experiments")
  encoded = _research_store.get_metadata(f"fms_raw_audit:{experiment_id}")
  if not encoded:
    configuration = dict(experiment.get("configuration") or {})
    try:
      bundle = _workbench_source_bundle(list(configuration.get("sourceRunIds") or []))
      if str(bundle["datasetFingerprint"]) != str(experiment.get("datasetFingerprint")):
        raise ValueError("The immutable source fingerprint is no longer available")
      rebuilt = build_workbench_experiment(bundle["sources"], bundle["candles"], configuration, int(_time.time()))
      audit_value = rebuilt.get("rawAudit")
      if not isinstance(audit_value, dict):
        raise ValueError("Raw audit could not be reconstructed")
      encoded = json.dumps(audit_value, separators=(",", ":"))
      _research_store.set_metadata(f"fms_raw_audit:{experiment_id}", encoded)
    except Exception as exc:  # noqa: BLE001 - return an honest immutable-history failure
      raise HTTPException(status_code=409, detail=f"Archived raw audit could not be reconstructed: {exc}") from exc
  audit = json.loads(encoded)
  contract_key = contract or str(audit.get("selectedContractKey", ""))
  results = {str(row["caseId"]): row for row in audit.get("contractResults", {}).get(contract_key, [])}
  query = search.strip().lower()
  rows = []
  for raw_case in audit.get("cases", []):
    row = {**raw_case, "simulation": results.get(str(raw_case["caseId"]))}
    events = list(row.get("events", []))
    is_unreliable = any(bool(event.get("forecastSuspect")) for event in events)
    status = str((row.get("simulation") or {}).get("status", "unavailable"))
    searchable = " ".join(str(event.get(key, "")) for event in events for key in ("currency", "countryCode", "title")).lower()
    if query and query not in searchable:
      continue
    if direction != "all" and str(row.get("direction")) != direction:
      continue
    if inclusion == "included" and not row.get("included"):
      continue
    if inclusion == "excluded" and row.get("included"):
      continue
    if reliability == "unreliable" and not is_unreliable:
      continue
    if reliability == "reliable" and is_unreliable:
      continue
    if outcome != "all" and status != outcome:
      continue
    if dateFrom and int(row.get("eventTime", 0)) < dateFrom:
      continue
    if dateTo and int(row.get("eventTime", 0)) >= dateTo:
      continue
    rows.append({**row, "forecastUnreliable": is_unreliable})
  page = max(1, page)
  pageSize = min(200, max(10, pageSize))
  start = (page - 1) * pageSize
  return {
    "experimentId": experiment_id,
    "datasetFingerprint": experiment.get("datasetFingerprint"),
    "selectedContractKey": str(audit.get("selectedContractKey", "")),
    "activeContractKey": contract_key,
    "contracts": audit.get("contracts", []),
    "page": page,
    "pageSize": pageSize,
    "total": len(rows),
    "rows": rows[start:start + pageSize],
  }


@app.post("/research/experiments/{experiment_id}/freeze")
def freeze_research_experiment(
  experiment_id: str, payload: FmsCandidateFreezeRequest
) -> Dict[str, Any]:
  existing = next((
    row for row in _research_store.list_fms_candidates()
    if row["experimentId"] == experiment_id
  ), None)
  if existing is not None:
    return existing
  experiment = _research_store.get_fms_experiment(experiment_id)
  if experiment is None:
    raise HTTPException(status_code=404, detail="Unknown FMS experiment")
  if experiment["status"] != "completed" or not isinstance(experiment.get("result"), dict):
    raise HTTPException(status_code=409, detail="Only completed experiments can be frozen")
  checks = dict(experiment["result"].get("checks") or {})
  failed = [name for name, passed in checks.items() if not passed]
  if failed and not payload.acknowledgeFailedGates:
    raise HTTPException(
      status_code=409,
      detail=f"Acknowledge failed gates before freezing: {', '.join(failed)}",
    )
  candidate_id = _research_store.allocate_fms_id("C", str(experiment["configuration"].get("market", "EURUSD")))
  _research_store.create_fms_candidate(
    candidate_id,
    experiment_id,
    payload.friendlyName.strip(),
    int(_time.time()),
    payload.acknowledgeFailedGates,
    checks,
    experiment["configurationHash"],
    experiment["datasetFingerprint"],
  )
  return next(row for row in _research_store.list_fms_candidates() if row["id"] == candidate_id)


@app.get("/research/candidates")
def list_research_candidates() -> List[Dict[str, Any]]:
  return _research_store.list_fms_candidates()


@app.get("/research/candidates/{candidate_id}")
def get_research_candidate(candidate_id: str) -> Dict[str, Any]:
  candidate = next((
    row for row in _research_store.list_fms_candidates()
    if row["id"] == candidate_id
  ), None)
  if candidate is None:
    raise HTTPException(status_code=404, detail="Unknown frozen FMS candidate")
  return candidate


@app.get("/research/archive")
def research_archive() -> List[Dict[str, Any]]:
  return _research_store.list_signal_version_archive()


@app.get("/research/versions/current")
def research_current_version() -> Dict[str, Any]:
  definition = SIGNAL_DEFINITIONS[ACTIVE_VERSION_ID]
  return {
    "id": definition.id,
    "hash": definition.configuration_hash,
    "createdAt": definition.created_at,
    "configuration": definition.configuration,
  }


@app.get("/research/versions")
def research_versions(market: Optional[str] = None) -> List[Dict[str, Any]]:
  normalized_market = (market or "EURUSD").upper()
  if normalized_market not in WORKBENCH_MARKETS:
    raise HTTPException(status_code=400, detail="Unsupported FMS market")
  return [
    {
      "id": definition.id,
      "hash": definition.configuration_hash,
      "createdAt": definition.created_at,
      "configuration": definition.configuration,
      "active": definition.id == ACTIVE_VERSION_ID,
    }
    for definition in SIGNAL_DEFINITIONS.values()
    if str(definition.configuration.get("market") or definition.configuration.get("symbol") or "EURUSD") == normalized_market
  ]


@app.get("/research/forward")
def research_forward(versionId: str = V2_VERSION_ID) -> Dict[str, Any]:
  return _forward_paper_payload(versionId)


def _interactive_context_research(research: Any) -> Any:
  """Keep the chart audit useful without shipping the research matrix.

  The complete immutable artifact remains available from readiness/research
  endpoints. Charts only reads the selected candidate and the later reaction
  for the context value shown on a selected arrow.
  """
  if not isinstance(research, dict):
    return research
  dimensions = []
  for row in research.get("dimensions") or []:
    if not isinstance(row, dict):
      continue
    dimensions.append({
      key: row.get(key)
      for key in ("dimension", "value", "historicalN", "laterReaction", "status")
    })
  return {
    key: research.get(key)
    for key in (
      "schema", "researchExperimentId", "recipe", "registryRevision",
      "configurationHash", "candleFingerprint", "datasetFingerprint",
      "activeArrowPreserved", "selectedCandidate", "minimumSamples",
      "activeContract", "conditionedExecution", "activeRegistryPreserved",
    )
  } | {"dimensions": dimensions}


def _interactive_reaction_audit(audit: Any) -> Any:
  """Project immutable reaction research to the fields rendered by Charts."""
  if not isinstance(audit, dict):
    return audit
  profile = audit.get("profile")
  if not isinstance(profile, dict):
    return audit
  interactive_profile = {
    key: profile.get(key)
    for key in (
      "schema", "scope", "experimentId", "evaluableN",
      "standardWindowCandles", "classification", "horizons", "mfe", "mae",
      "givebackAtr", "contractResearch",
    )
  }
  if "contextResearch" in profile:
    interactive_profile["contextResearch"] = _interactive_context_research(profile.get("contextResearch"))
  return {**audit, "profile": interactive_profile}


def _interactive_chart_pattern(pattern: Any) -> Any:
  if not isinstance(pattern, dict):
    return pattern
  # Chart/Shadow Trader render this summary contract. Development folds,
  # yearly metric rows, target grids, and prequential paths belong to the
  # research/readiness endpoints and were the bulk of every pair change.
  projected = {
    key: pattern.get(key)
    for key in (
      "id", "market", "signature", "signatures", "sourceVersionId", "label",
      "condition", "scoringPolicy", "reaction", "cohort",
      "historicalBenchmark", "registrationProvenance", "readiness", "execution",
      "baseExecution", "executionReview", "contextRegistration",
      "requiredExactTitles", "direction", "groups", "currentEligible",
      "uncertaintyIncludesNoEdge",
    )
  }
  overall = pattern.get("overall") or {}
  projected["overall"] = {
    key: overall.get(key)
    for key in ("evaluableCount", "targetHitRate", "stopHitRate", "averageR")
  }
  execution_stress = pattern.get("executionStress") or {}
  projected["executionStress"] = {
    "pips": execution_stress.get("pips"),
    "overall": {
      key: (execution_stress.get("overall") or {}).get(key)
      for key in ("evaluableCount", "targetHitRate", "stopHitRate", "averageR")
    },
  }
  year_stability = pattern.get("yearStability") or {}
  projected["yearStability"] = {
    key: year_stability.get(key)
    for key in ("evaluableYears", "positiveYears", "positiveYearShare")
  }
  projected["reactionAudit"] = _interactive_reaction_audit(pattern.get("reactionAudit"))
  return projected


@app.get("/research/chart-signals")
def research_chart_signals(
  symbol: str = "EURUSD",
  tf: str = "H4",
  mode: str = "current",
  from_: Optional[int] = None,
  to: Optional[int] = None,
  refresh: bool = False,
  compact: bool = False,
) -> Dict[str, Any]:
  def response_for_client(payload: Dict[str, Any]) -> Dict[str, Any]:
    interactive_payload = {
      **payload,
      "patterns": [_interactive_chart_pattern(row) for row in payload.get("patterns", [])],
    }
    if not compact:
      return interactive_payload
    compact_signals = []
    for row in payload.get("signals", []):
      compact_row = {
        key: row.get(key) for key in (
          "id", "patternId", "sourceVersionId", "eventTime", "activationTime",
          "direction", "label", "historicalReplay", "outcomeStatus", "expiryCandles",
        )
      }
      overlay = row.get("contextOverlay")
      if isinstance(overlay, dict):
        # Historical chart markers need only the reviewed-condition match bit.
        # The selected arrow fetches its complete immutable audit on demand.
        compact_row["contextOverlay"] = {"matched": bool(overlay.get("matched"))}
      compact_signals.append(compact_row)
    return {
      **interactive_payload,
      "patterns": [
        {"id": row.get("id"), "currentEligible": row.get("currentEligible", False)}
        for row in payload.get("patterns", [])
      ],
      "signals": compact_signals,
    }
  normalized_symbol = symbol.upper()
  normalized_tf = tf.upper()
  normalized_mode = mode.lower()
  if normalized_mode not in {"current", "research_replay"}:
    raise HTTPException(status_code=400, detail="Macro Bias mode must be current or research_replay")
  market_patterns = [
    _reconciled_pattern(pattern)
    for pattern in PRACTICAL_PATTERN_DEFINITIONS
    if pattern["market"] == normalized_symbol
  ]
  if not market_patterns:
    return {
      "supported": False,
      "versionId": PRACTICAL_MODEL_ID,
      "modelId": PRACTICAL_MODEL_ID,
      "modelHash": PRACTICAL_MODEL_HASH,
      "modelActivatedAt": PRACTICAL_MODEL_CREATED_AT,
      "mode": normalized_mode,
      "symbol": normalized_symbol,
      "timeframe": normalized_tf,
      "modelTimeframe": "H4",
      "targetR": 2.0,
      "contextConditionalModel": {
        "id": CONTEXT_CONDITIONAL_MODEL_ID, "activatedAt": CONTEXT_CONDITIONAL_ACTIVATED_AT,
        "registeredSetups": len(_REVIEWED_CONTEXT_APPROVALS),
      },
      "patterns": [],
      "signals": [],
      "message": "No historically profitable FMS registry is available for this market yet.",
    }
  market_currencies = list(WORKBENCH_MARKETS[normalized_symbol]["currencies"])
  source_versions = sorted({str(pattern["sourceVersion"]) for pattern in market_patterns})
  cacheable = from_ is None and to is None
  response_cache_key: Optional[str] = None
  if cacheable:
    run_headers = [_research_store.latest_backtest_run_header(version) for version in source_versions]
    if all(run is not None and run.get("status") == "completed" for run in run_headers):
      calendar_revision = (
        f"{_research_store.release_observation_revision(market_currencies)}:{int(_time.time()) // 86400}"
        if normalized_mode == "current" else "immutable-replay"
      )
      response_cache_key = hashlib.sha256("|".join([
        "chart-response-v10-offline-recovery", normalized_symbol, normalized_tf, normalized_mode, PRACTICAL_MODEL_HASH,
        str(_research_store.get_metadata("fms_registered_reaction:reconciliation") or ""),
        str(_research_store.get_metadata("fms_live_execution_revision") or ""),
        calendar_revision,
        *(f"{run['id']}:{run['datasetFingerprint']}" for run in run_headers if run),
      ]).encode("utf-8")).hexdigest()
      with _chart_signal_response_lock:
        cached_wrapper = _chart_signal_response_cache.get(response_cache_key)
      if cached_wrapper is None:
        durable_key = (
          f"fms_chart_response:current:{normalized_symbol}"
          if normalized_mode == "current"
          else f"fms_chart_response:replay:{response_cache_key}"
        )
        raw_cached = _research_store.get_metadata(durable_key)
        if raw_cached:
          try:
            parsed = json.loads(raw_cached)
            if parsed.get("key") == response_cache_key and isinstance(parsed.get("response"), dict):
              cached_wrapper = parsed
              with _chart_signal_response_lock:
                _chart_signal_response_cache[response_cache_key] = parsed
          except (TypeError, ValueError):
            logger.warning("Ignoring unreadable FMS chart response cache for %s", normalized_symbol)
      if cached_wrapper is not None:
        cached_response = cached_wrapper["response"]
        assessment_status = str((((cached_response.get("realtime") or {}).get("latestPatternAssessment") or {}).get("status") or ""))
        has_pending_signal = any(
          signal.get("outcomeStatus") == "pending"
          for signal in [*(cached_response.get("signals") or []), *(cached_response.get("recoveredSignals") or [])]
        )
        needs_live_refresh = assessment_status == "awaiting_observation" or has_pending_signal
        if not refresh or normalized_mode == "research_replay" or not needs_live_refresh:
          return response_for_client(cached_response)
  source_runs: Dict[str, Dict[str, Any]] = {}
  source_results: Dict[str, Dict[str, Any]] = {}
  for source_version in source_versions:
    run = _research_store.latest_backtest_run(source_version)
    result = run.get("result") if run and run.get("status") == "completed" else None
    if not isinstance(result, dict):
      raise HTTPException(status_code=409, detail=f"Run the {source_version} historical research baseline before loading chart signals")
    outcomes = result.get("targets", {}).get("2.0", {}).get("outcomes", [])
    split_time = result.get("candidateSummary", {}).get("developmentHoldoutBoundary")
    if not isinstance(outcomes, list) or not isinstance(split_time, int):
      raise HTTPException(status_code=409, detail=f"The latest {source_version} result does not contain a qualifying historical split")
    source_runs[source_version] = run
    source_results[source_version] = result
  dataset_fingerprint = hashlib.sha256(
    "|".join(
      f"{version}:{source_results[version].get('datasetFingerprint', '')}"
      for version in source_versions
    ).encode("utf-8")
  ).hexdigest()
  catalog_key = f"{normalized_symbol}:{':'.join(str(source_runs[version].get('id', '')) for version in source_versions)}:{dataset_fingerprint}:{PRACTICAL_MODEL_HASH}"
  with _chart_signal_catalog_lock:
    catalog = _chart_signal_catalog_cache.get(catalog_key)
  if catalog is None:
    catalog = []
    for source_version in source_versions:
      result = source_results[source_version]
      for scoring_policy in sorted({str(pattern.get("scoringPolicy", "forecast_quality")) for pattern in market_patterns if pattern["sourceVersion"] == source_version}):
        rescored, _audit = rescore_policy_outcomes(result["targets"]["2.0"]["outcomes"], scoring_policy)
        rescored_targets = {
          target_r: rescore_policy_outcomes(target_payload.get("outcomes", []), scoring_policy)[0]
          for target_r, target_payload in result.get("targets", {}).items()
          if isinstance(target_payload, dict)
        }
        catalog.extend(build_chart_signal_pattern_catalog(
          rescored,
          result["candidateSummary"]["developmentHoldoutBoundary"],
          rescored_targets,
          source_version,
          [pattern for pattern in market_patterns if pattern["sourceVersion"] == source_version and pattern.get("scoringPolicy", "forecast_quality") == scoring_policy],
        ))
    with _chart_signal_catalog_lock:
      _chart_signal_catalog_cache.clear()
      _chart_signal_catalog_cache[catalog_key] = catalog
  definitions_by_id = {str(pattern["id"]): pattern for pattern in market_patterns}
  patterns = []
  for pattern in catalog:
    if normalized_mode != "research_replay" and not pattern["currentEligible"]:
      continue
    definition = definitions_by_id.get(str(pattern["id"])) or {}
    enriched_pattern = {
      **pattern,
      "baseExecution": definition.get("baseExecution"),
      "executionReview": definition.get("executionReview"),
      "contextRegistration": definition.get("contextRegistration"),
    }
    provenance = _registration_provenance(enriched_pattern)
    patterns.append({
      **enriched_pattern,
      "reactionAudit": definition.get("reactionAudit"),
      "registrationProvenance": provenance,
      "readiness": _pattern_readiness(enriched_pattern, provenance),
    })
  def matching_pattern(source_version: str, scoring_policy: str, candidate: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    return next(
      (
        pattern for pattern in patterns
        if pattern["sourceVersionId"] == source_version
        and (pattern.get("readiness") or {}).get("actionableInShadowTrader", False)
        and pattern.get("scoringPolicy", "forecast_quality") == scoring_policy
        and candidate_matches_chart_pattern(candidate, pattern)
      ),
      None,
    )
  observed_events = _research_store.query_release_observations(
    from_time=FORWARD_LEDGER_ACTIVATED_AT,
    currencies=market_currencies,
  )
  # Economic observations and cached candles already use epoch UTC. Avoid an
  # unnecessary MT5 IPC call while constructing FMS responses; chart/history
  # routes must remain available while background signal work is running.
  generated_at = int(_time.time())
  first_seen_by_event = {
    (int(event["id"]), int(event["time"])): int(event["firstSeenAt"])
    for event in observed_events if event.get("firstSeenAt") is not None
  }

  observation_coverage_start = min((int(event["time"]) for event in observed_events), default=None)
  candidate_cache_key = hashlib.sha256("|".join([
    normalized_symbol, PRACTICAL_MODEL_HASH, dataset_fingerprint,
    _research_store.release_observation_revision(market_currencies),
  ]).encode("utf-8")).hexdigest()
  with _chart_signal_current_candidates_lock:
    cached_candidates = _chart_signal_current_candidates_cache.get(candidate_cache_key)
  if cached_candidates is not None:
    current_candidates = cached_candidates["current"]
    assessment_candidates = cached_candidates["assessment"]
  else:
    current_candidates: List[Tuple[str, str, Dict[str, Any]]] = []
    assessment_candidates: List[Tuple[str, str, Dict[str, Any]]] = []
    for source_version in source_versions:
      definition = get_signal_definition(source_version)
      if definition is None:
        continue
      observed_source_candidates = build_signal_candidates(observed_events, now=generated_at, definition=definition)
      observed_times = {int(candidate["eventTime"]) for candidate in observed_source_candidates}
      historical_seed = [
        outcome for outcome in source_results[source_version]["targets"]["2.0"]["outcomes"]
        if observation_coverage_start is None or int(outcome["eventTime"]) < observation_coverage_start
      ]
      policies = {str(pattern.get("scoringPolicy", "forecast_quality")) for pattern in market_patterns if pattern["sourceVersion"] == source_version}
      for scoring_policy in policies:
        rescored, _policy_audit = rescore_policy_outcomes([*historical_seed, *observed_source_candidates], scoring_policy)
        rescored = _annotate_numeric_robustness(rescored)
        rescored_observed = [candidate for candidate in rescored if int(candidate["eventTime"]) in observed_times]
        assessment_candidates.extend((source_version, scoring_policy, candidate) for candidate in rescored_observed)
        current_candidates.extend((source_version, scoring_policy, candidate) for candidate in rescored_observed)
    with _chart_signal_current_candidates_lock:
      _chart_signal_current_candidates_cache[candidate_cache_key] = {
        "current": current_candidates,
        "assessment": assessment_candidates,
      }
  # Keep the two views provenance-pure. Current signals must remain based on
  # immutable first-seen EA observations even after a historical backtest is
  # refreshed; replay signals must remain the frozen archive reconstruction.
  candidates = current_candidates if normalized_mode == "current" else [
    (source_version, scoring_policy, outcome)
    for source_version in source_versions
    for scoring_policy in {str(pattern.get("scoringPolicy", "forecast_quality")) for pattern in market_patterns if pattern["sourceVersion"] == source_version}
    for outcome in _annotate_numeric_robustness(rescore_policy_outcomes(source_results[source_version]["targets"]["2.0"]["outcomes"], scoring_policy)[0])
  ]
  window_candidates = [
    (source_version, scoring_policy, candidate)
    for source_version, scoring_policy, candidate in candidates
    if (from_ is None or int(candidate["eventTime"]) >= from_)
    and (to is None or int(candidate["eventTime"]) <= to)
  ]
  direct_evaluation_candidates = [
    (source_version, scoring_policy, candidate, pattern)
    for source_version, scoring_policy, candidate in window_candidates
    for pattern in [matching_pattern(source_version, scoring_policy, candidate)]
    if pattern is not None
  ]
  custom_candles: List[Dict[str, Any]] = []
  custom_candle_times: List[int] = []
  custom_atr_values: List[Optional[float]] = []
  history_backfill_attempted = False
  if direct_evaluation_candidates:
    earliest_custom = min(int(candidate["eventTime"]) for _, _, candidate, _ in direct_evaluation_candidates)
    latest_custom = max(int(candidate["eventTime"]) for _, _, candidate, _ in direct_evaluation_candidates)
    custom_candles = _research_store.query_candles(
      normalized_symbol, "H4", earliest_custom - 45 * 24 * 60 * 60,
      min(generated_at + H4_SECONDS, latest_custom + 120 * 24 * 60 * 60),
    )
    custom_candle_times = [int(candle["time"]) for candle in custom_candles]
    custom_atr_values = calculate_atr_by_candle(custom_candles)
  m1_cache: Dict[Tuple[int, int], List[Dict[str, Any]]] = {}
  def evaluation_m1_provider(start: int, end: int) -> List[Dict[str, Any]]:
    key = (start, end)
    if key not in m1_cache:
      cached_minutes = _research_store.query_candles(normalized_symbol, "M1", start, end)
      cache_covers_interval = bool(
        cached_minutes
        and int(cached_minutes[0]["time"]) <= start + 60
        and int(cached_minutes[-1]["time"]) >= end - 120
      )
      m1_cache[key] = cached_minutes if cache_covers_interval else _fetch_research_candles(normalized_symbol, "M1", start, end, 1)
    return m1_cache[key]
  signals: List[Dict[str, Any]] = []
  recovered_signals: List[Dict[str, Any]] = []
  signal_candidates_by_key: Dict[Tuple[str, int], Dict[str, Any]] = {}
  prospective_capture_by_key: Dict[Tuple[str, int], Dict[str, Any]] = {}
  for source_version, scoring_policy, candidate in window_candidates:
    event_time = int(candidate["eventTime"])
    pattern = matching_pattern(source_version, scoring_policy, candidate)
    if pattern is None:
      continue
    if normalized_mode == "current" and event_time < int(pattern.get("activatedAt", PRACTICAL_MODEL_CREATED_AT)):
      continue
    execution = _execution_for_event(pattern, event_time)
    signal_candidate = apply_chart_pattern_reaction(candidate, pattern)
    evaluated = evaluate_candidate(
      signal_candidate,
      custom_candles,
      custom_candle_times,
      custom_atr_values,
      float(execution["targetR"]),
      m1_provider=evaluation_m1_provider,
      allow_pending=normalized_mode == "current",
      as_of=generated_at,
      stop_atr=float(execution["stopAtr"]),
      holding_candles=int(execution["expiryCandles"]),
      management_family=str(execution.get("managementFamily") or "fixed"),
      management_trigger_r=execution.get("managementTriggerR"),
    )
    if evaluated.get("status") == "unevaluable" and not history_backfill_attempted and direct_evaluation_candidates:
      history_backfill_attempted = True
      earliest_custom = min(int(row[2]["eventTime"]) for row in direct_evaluation_candidates)
      latest_custom = max(int(row[2]["eventTime"]) for row in direct_evaluation_candidates)
      custom_candles = _fetch_research_candles(
        normalized_symbol, "H4", earliest_custom - 45 * 24 * 60 * 60,
        min(generated_at + H4_SECONDS, latest_custom + 120 * 24 * 60 * 60), 365,
      )
      custom_candle_times = [int(candle["time"]) for candle in custom_candles]
      custom_atr_values = calculate_atr_by_candle(custom_candles)
      evaluated = evaluate_candidate(
        signal_candidate,
        custom_candles,
        custom_candle_times,
        custom_atr_values,
        float(execution["targetR"]),
        m1_provider=evaluation_m1_provider,
        allow_pending=normalized_mode == "current",
        as_of=generated_at,
        stop_atr=float(execution["stopAtr"]),
        holding_candles=int(execution["expiryCandles"]),
        management_family=str(execution.get("managementFamily") or "fixed"),
        management_trigger_r=execution.get("managementTriggerR"),
      )
    activation_time = evaluated.get("entryTime")
    prospective_activation_time = (
      int(activation_time) if activation_time is not None
      else _planned_strictly_later_h4_open(event_time, custom_candle_times)
    )
    prospective_capture = _prospective_capture_eligibility(
      list(candidate.get("events") or []), event_time,
      prospective_activation_time, generated_at,
      first_seen_by_event,
    )
    prospective_capture_by_key[(str(pattern["id"]), event_time)] = prospective_capture
    def outcome_value(name: str) -> Any:
      return evaluated.get(name)
    signal_candidates_by_key[(str(pattern["id"]), event_time)] = signal_candidate
    built_signal = {
      "id": f"{pattern['id']}:{event_time}",
      "demoTag": _forward_demo_tag(PRACTICAL_MODEL_ID, normalized_symbol, pattern["id"], event_time),
      "patternId": pattern["id"],
      "sourceVersionId": source_version,
      "eventTime": event_time,
      "direction": signal_candidate["direction"],
      "label": pattern["label"],
      "evidenceReaction": "rejected" if str(pattern.get("reaction")) == "contrarian" else "followed",
      "agreement": candidate["agreement"],
      "pairVote": signal_candidate["pairVote"],
      "backgroundDirection": candidate["backgroundDirection"],
      "backgroundPairVote": candidate["backgroundPairVote"],
      "backgroundAlignment": candidate["backgroundAlignment"],
      "backgroundCoverageComplete": (
        normalized_mode == "research_replay"
        or (
          observation_coverage_start is not None
          and event_time - observation_coverage_start >= 90 * 24 * 60 * 60
        )
      ),
      "highestImpact": candidate["highestImpact"],
      "events": candidate["events"],
      "activationTime": int(activation_time) if activation_time is not None else None,
      "execution": execution,
      "stopAtr": float(execution["stopAtr"]),
      "targetR": float(execution["targetR"]),
      "expiryCandles": int(execution["expiryCandles"]),
      "managementFamily": str(execution.get("managementFamily") or "fixed"),
      "managementTriggerR": execution.get("managementTriggerR"),
      "entry": outcome_value("entry"),
      "atr": outcome_value("atr"),
      "stop": outcome_value("stop"),
      "initialStop": outcome_value("initialStop"),
      "breakEvenArmed": bool(outcome_value("breakEvenArmed")),
      "target": outcome_value("target"),
      "outcomeStatus": evaluated.get("status"),
      "resultR": evaluated.get("resultR"),
      "exitTime": evaluated.get("exitTime"),
      "outcomeReasonCode": evaluated.get("reasonCode"),
      "outcomeReason": evaluated.get("reason"),
      "outcomeCoverage": evaluated.get("coverage"),
      "pendingLifecycle": evaluated.get("pendingLifecycle"),
      "historicalReplay": normalized_mode == "research_replay",
      "prospectiveCapture": prospective_capture if normalized_mode == "current" else None,
      "observationMode": (
        "recovered_offline"
        if normalized_mode == "current" and not prospective_capture["eligible"]
        else "live_captured" if normalized_mode == "current" else "historical_replay"
      ),
    }
    if normalized_mode == "current" and not prospective_capture["eligible"]:
      recovered_signals.append(built_signal)
    else:
      signals.append(built_signal)
  evaluated_signals = [*signals, *recovered_signals]
  signal_activation_times = [int(signal["activationTime"]) for signal in evaluated_signals if signal.get("activationTime") is not None]
  if signal_activation_times:
    signal_candles = _research_store.query_candles(
      normalized_symbol, "H4", min(signal_activation_times) - 140 * H4_SECONDS,
      max(signal_activation_times) + 90 * 24 * 60 * 60,
    )
    signal_candle_times = [int(candle["time"]) for candle in signal_candles]
    for signal in evaluated_signals:
      if signal.get("activationTime") is None or signal.get("entry") is None or signal.get("atr") is None:
        signal["expiryTime"] = None
        signal["maximumAdverseR"] = None
        continue
      path_horizon = max(30, int(signal["expiryCandles"]))
      profile = build_candidate_path_profile({
        "eventTime": int(signal["eventTime"]),
        "entryTime": int(signal["activationTime"]),
        "entry": float(signal["entry"]),
        "atr": float(signal["atr"]),
        "direction": str(signal["direction"]),
        "backgroundDirection": signal.get("backgroundDirection"),
        "backgroundPairVote": signal.get("backgroundPairVote"),
        "backgroundAlignment": signal.get("backgroundAlignment"),
        "highestImpact": signal.get("highestImpact"),
        "events": list(signal.get("events") or []),
      }, signal_candles, signal_candle_times, path_horizon)
      if profile is None:
        signal["expiryTime"] = None
        signal["maximumAdverseR"] = None
        continue
      expiry_candles = int(signal["expiryCandles"])
      signal["marketContext"] = profile.get("marketContext")
      pattern_definition = definitions_by_id.get(str(signal["patternId"])) or {}
      context_overlay = _context_overlay_for_signal(pattern_definition, signal)
      signal["contextOverlay"] = context_overlay
      if context_overlay and context_overlay.get("executionApplied"):
        context_execution = dict(context_overlay.get("contextExecution") or {})
        evaluation_candidate = signal_candidates_by_key.get((str(signal["patternId"]), int(signal["eventTime"])))
        if evaluation_candidate is not None:
          context_evaluated = evaluate_candidate(
            evaluation_candidate,
            custom_candles,
            custom_candle_times,
            custom_atr_values,
            float(context_execution["targetR"]),
            m1_provider=evaluation_m1_provider,
            allow_pending=normalized_mode == "current",
            as_of=generated_at,
            stop_atr=float(context_execution["stopAtr"]),
            holding_candles=int(context_execution["expiryCandles"]),
            management_family=str(context_execution.get("managementFamily") or "fixed"),
            management_trigger_r=context_execution.get("managementTriggerR"),
          )
          signal.update({
            "execution": context_execution,
            "stopAtr": float(context_execution["stopAtr"]),
            "targetR": float(context_execution["targetR"]),
            "expiryCandles": int(context_execution["expiryCandles"]),
            "managementFamily": str(context_execution.get("managementFamily") or "fixed"),
            "managementTriggerR": context_execution.get("managementTriggerR"),
            "activationTime": context_evaluated.get("entryTime"),
            "entry": context_evaluated.get("entry"), "atr": context_evaluated.get("atr"),
            "stop": context_evaluated.get("stop"), "initialStop": context_evaluated.get("initialStop"),
            "breakEvenArmed": bool(context_evaluated.get("breakEvenArmed")),
            "target": context_evaluated.get("target"), "outcomeStatus": context_evaluated.get("status"),
            "resultR": context_evaluated.get("resultR"), "exitTime": context_evaluated.get("exitTime"),
            "outcomeReasonCode": context_evaluated.get("reasonCode"),
            "outcomeReason": context_evaluated.get("reason"),
            "outcomeCoverage": context_evaluated.get("coverage"),
            "pendingLifecycle": context_evaluated.get("pendingLifecycle"),
          })
          expiry_candles = int(signal["expiryCandles"])
          if len(profile.get("candles") or []) < max(30, expiry_candles):
            expanded_profile = build_candidate_path_profile({
              "eventTime": int(signal["eventTime"]),
              "entryTime": int(signal["activationTime"]),
              "entry": float(signal["entry"]),
              "atr": float(signal["atr"]),
              "direction": str(signal["direction"]),
              "backgroundDirection": signal.get("backgroundDirection"),
              "backgroundPairVote": signal.get("backgroundPairVote"),
              "backgroundAlignment": signal.get("backgroundAlignment"),
              "highestImpact": signal.get("highestImpact"),
              "events": list(signal.get("events") or []),
            }, signal_candles, signal_candle_times, max(30, expiry_candles))
            if expanded_profile is not None:
              profile = expanded_profile
      signal["expiryTime"] = int(profile["candles"][expiry_candles - 1]["time"]) if len(profile["candles"]) >= expiry_candles else None
      exit_time = signal.get("exitTime")
      adverse = [
        value for candle, value in zip(profile["candles"], profile["adverse"])
        if exit_time is None or int(candle["time"]) <= int(exit_time)
      ]
      favorable = [
        value for candle, value in zip(profile["candles"], profile["favorable"])
        if exit_time is None or int(candle["time"]) <= int(exit_time)
      ]
      stop_atr = float(signal["stopAtr"])
      atr = float(signal["atr"])
      pip_size = .01 if normalized_symbol.endswith("JPY") else .0001
      maximum_favorable_atr = max(favorable, default=0.0)
      maximum_adverse_atr = max(adverse, default=0.0)
      maximum_favorable_r = maximum_favorable_atr / stop_atr
      maximum_adverse_r = maximum_adverse_atr / stop_atr
      signal["maximumAdverseR"] = maximum_adverse_r
      fixed_horizon_responses = [
        {
          "holdingCandles": horizon,
          "responseR": (
            float(profile["sign"])
            * (float(profile["candles"][horizon - 1]["close"]) - float(profile["entry"]))
            / (atr * stop_atr)
          ),
        }
        for horizon in PATH_RESEARCH_HORIZONS
        if len(profile["candles"]) >= horizon
      ]
      six_h4_response = next((row for row in fixed_horizon_responses if row["holdingCandles"] == 6), None)
      loss_observations: List[str] = []
      if signal.get("resultR") is not None and float(signal["resultR"]) < 0:
        if maximum_favorable_r >= .5:
          loss_observations.append("favourable_then_giveback")
        if maximum_favorable_r < float(signal["targetR"]):
          loss_observations.append("target_not_reached_before_close")
        if favorable and adverse and adverse.index(maximum_adverse_atr) < favorable.index(maximum_favorable_atr):
          loss_observations.append("adverse_before_best_favourable_move")
        if six_h4_response is not None and float(six_h4_response["responseR"]) <= 0:
          loss_observations.append("direction_not_working_at_six_h4")
        if signal.get("outcomeStatus") == "expired":
          loss_observations.append("duration_ended_negative")
      signal["pathAudit"] = {
        "evidenceReaction": signal["evidenceReaction"],
        "reactionHorizonCandles": 6,
        "reactionResponseR": None if six_h4_response is None else float(six_h4_response["responseR"]),
        "directionWorked": None if six_h4_response is None else float(six_h4_response["responseR"]) > 0,
        "lossReview": loss_observations,
        "maximumFavorableR": maximum_favorable_r,
        "maximumFavorablePips": maximum_favorable_atr * atr / pip_size,
        "maximumAdverseR": maximum_adverse_r,
        "maximumAdversePips": maximum_adverse_atr * atr / pip_size,
        "timeToMfeCandles": favorable.index(maximum_favorable_atr) + 1 if favorable else None,
        "timeToMaeCandles": adverse.index(maximum_adverse_atr) + 1 if adverse else None,
        "givebackR": maximum_favorable_r - float(signal.get("resultR")) if signal.get("resultR") is not None else None,
        "fixedHorizonResponses": fixed_horizon_responses,
      }
  latest_matched_event_at = max((int(signal["eventTime"]) for signal in evaluated_signals), default=None)
  latest_arrow_at = max(
    (
      int(signal["activationTime"])
      if signal.get("activationTime") is not None
      else (int(signal["eventTime"]) // H4_SECONDS + 1) * H4_SECONDS
      for signal in evaluated_signals
    ),
    default=None,
  )
  later_unmatched_package_count = sum(
    1
    for source_version, scoring_policy, candidate in window_candidates
    if latest_matched_event_at is not None
    and int(candidate["eventTime"]) > latest_matched_event_at
    and matching_pattern(source_version, scoring_policy, candidate) is None
  )
  scheduled_events = _research_store.query_calendar(
    from_time=generated_at - 7 * 24 * 60 * 60,
    currencies=market_currencies,
  )
  realtime = build_chart_signal_realtime_watch(
    scheduled_events,
    generated_at,
    frozenset(str(pattern["id"]) for pattern in catalog if pattern["currentEligible"]),
    assessment_candidates,
    frozenset(int(event["time"]) for event in observed_events),
    PRACTICAL_MODEL_CREATED_AT,
    market_patterns,
    market_currencies,
    normalized_symbol,
  )
  if normalized_mode == "current":
    realtime_assessments = realtime.get("latestPatternAssessments") or (
      [realtime["latestPatternAssessment"]] if realtime.get("latestPatternAssessment") else []
    )
    signal_by_key = {(str(signal["patternId"]), int(signal["eventTime"])): signal for signal in evaluated_signals}
    existing_live_decisions = {
      (str(row["patternId"]), int(row["eventTime"])): row
      for row in _research_store.list_fms_live_decisions(normalized_symbol, 500)
    }
    existing_execution_cases = {
      (str(row["patternId"]), int(row["eventTime"])): row
      for row in _research_store.list_fms_live_execution_cases(normalized_symbol, 500)
    }
    for assessment in realtime_assessments:
      if assessment.get("status") not in {"qualified", "no_trade"}:
        continue
      event_time = int(assessment["time"])
      if event_time < PRACTICAL_MODEL_CREATED_AT:
        continue
      assessment_key = (str(assessment["patternId"]), event_time)
      prospective_capture = prospective_capture_by_key.get(assessment_key)
      if prospective_capture is None:
        prospective_capture = _prospective_capture_eligibility(
          list(assessment.get("events") or []), event_time,
          _planned_strictly_later_h4_open(event_time, custom_candle_times), generated_at,
          first_seen_by_event,
        )
      assessment["prospectiveCapture"] = prospective_capture
      existing_decision = existing_live_decisions.get(assessment_key)
      release_quote = ((existing_decision or {}).get("assessment") or {}).get("releaseObservationQuote")
      execution_case = existing_execution_cases.get(assessment_key) or {}
      release_quote = release_quote or execution_case.get("entryQuote")
      if release_quote is None and generated_at - event_time <= 15 * 60:
        release_quote = _quote_snapshot_for_forward_case(
          normalized_symbol, int(prospective_capture.get("firstSeenAt") or event_time), generated_at,
        )
      assessment["releaseObservationQuote"] = release_quote
      matching_signal = signal_by_key.get(assessment_key)
      if matching_signal is not None:
        matching_signal["releaseObservationQuote"] = release_quote
        prior_timing = (execution_case.get("signal") or {}).get("entryTimingAudit")
        if prior_timing is not None:
          matching_signal["entryTimingAudit"] = prior_timing
      if assessment.get("status") == "qualified" and not prospective_capture["eligible"]:
        assessment["status"] = "late_for_contract"
        assessment["reason"] = (
          f"The package matched, but it was not processed before the frozen H4 entry "
          f"({prospective_capture['reason']}). Its frozen paper trade is reconstructed from MT5 history, "
          f"but remains separate from true first-seen forward statistics."
        )
      _research_store.record_fms_live_decision(
        PRACTICAL_MODEL_ID,
        normalized_symbol,
        str(assessment["patternId"]),
        event_time,
        generated_at,
        str(assessment["status"]),
        assessment.get("direction"),
        assessment,
        matching_signal,
        bool(prospective_capture["eligible"]),
        str(prospective_capture["reason"]),
      )
    qualified_decision_keys = {
      (str(row["patternId"]), int(row["eventTime"]))
      for row in _research_store.list_fms_live_decisions(normalized_symbol, 500)
      if row.get("status") == "qualified" and row.get("prospectiveEligible") is True
    }
    for signal in signals:
      signal_key = (str(signal["patternId"]), int(signal["eventTime"]))
      if signal_key not in qualified_decision_keys:
        continue
      execution_case = existing_execution_cases.get(signal_key) or {}
      if signal.get("releaseObservationQuote") is None and execution_case.get("entryQuote") is not None:
        signal["releaseObservationQuote"] = execution_case["entryQuote"]
      prior_timing = (execution_case.get("signal") or {}).get("entryTimingAudit")
      if signal.get("entryTimingAudit") is None and prior_timing is not None:
        signal["entryTimingAudit"] = prior_timing
      _research_store.record_fms_live_execution_observation(
        PRACTICAL_MODEL_ID,
        normalized_symbol,
        signal_key[0],
        signal_key[1],
        generated_at,
        signal,
      )
  policy_inflation_context = None
  if normalized_symbol == "EURUSD":
    context_revision = _research_store.get_metadata("last_calendar_ingest_at") or "unversioned"
    context_key = f"{id(_research_store)}:{context_revision}"
    with _chart_signal_context_lock:
      cached_context = _chart_signal_context_cache.get(context_key)
    if cached_context is None:
      context_events = _research_store.query_calendar(from_time=generated_at - 400 * 24 * 60 * 60, to_time=generated_at, currencies=market_currencies)
      cached_context = build_policy_inflation_context(context_events, generated_at)
      with _chart_signal_context_lock:
        _chart_signal_context_cache.clear()
        _chart_signal_context_cache[context_key] = cached_context
    policy_inflation_context = {**cached_context, "asOf": generated_at}
  response = {
    "supported": True,
    "versionId": PRACTICAL_MODEL_ID,
    "versionHash": PRACTICAL_MODEL_HASH,
    "modelId": PRACTICAL_MODEL_ID,
    "modelHash": PRACTICAL_MODEL_HASH,
    "modelActivatedAt": PRACTICAL_MODEL_CREATED_AT,
    "datasetFingerprint": dataset_fingerprint,
    "mode": normalized_mode,
    "symbol": normalized_symbol,
    "timeframe": normalized_tf,
    "modelTimeframe": "H4",
    "targetR": 2.0,
    "contextConditionalModel": {
      "id": CONTEXT_CONDITIONAL_MODEL_ID, "activatedAt": CONTEXT_CONDITIONAL_ACTIVATED_AT,
      "registeredSetups": len(_REVIEWED_CONTEXT_APPROVALS),
    },
    "generatedAt": generated_at,
    "realtime": realtime,
    "policyInflationContext": policy_inflation_context,
    "evaluationSummary": {
      "evaluatedPackageCount": len(window_candidates),
      "matchingPackageCount": len(evaluated_signals),
      "latestEvaluatedAt": max((int(candidate["eventTime"]) for _, _, candidate in window_candidates), default=None),
      "latestMatchedEventAt": latest_matched_event_at,
      "latestArrowAt": latest_arrow_at,
      "laterUnmatchedPackageCount": later_unmatched_package_count,
    },
    "patterns": patterns,
    "signals": signals,
    "recoveredSignals": recovered_signals,
    "currentPatternCount": sum(pattern["currentEligible"] for pattern in catalog),
    "researchPatternCount": len(catalog),
    "message": (
      "Current practical model: historically profitable no-lookahead setups use their frozen scoring policy and execution contract; diagnostics remain visible and no MT5 order is placed."
      if normalized_mode == "current" else
      "Historical research replay: arrows use patterns selected after reviewing the archive and were not available in real time."
    ),
  }
  if response_cache_key is not None:
    wrapper = {"key": response_cache_key, "createdAt": int(_time.time()), "response": response}
    durable_key = (
      f"fms_chart_response:current:{normalized_symbol}"
      if normalized_mode == "current"
      else f"fms_chart_response:replay:{response_cache_key}"
    )
    _research_store.set_metadata(durable_key, json.dumps(wrapper, separators=(",", ":")))
    with _chart_signal_response_lock:
      _chart_signal_response_cache[response_cache_key] = wrapper
  return response_for_client(response)


@app.get("/research/chart-signal-target-ladder")
def research_chart_signal_target_ladder(
  symbol: str,
  patternId: str,
  eventTime: int,
  mode: str = "research_replay",
) -> Dict[str, Any]:
  """Build the expensive multi-target audit only for the arrow the user opened."""
  normalized_symbol = symbol.upper()
  response = research_chart_signals(symbol=normalized_symbol, tf="H4", mode=mode)
  signal = next(
    (
      row for row in response.get("signals", [])
      if str(row.get("patternId")) == patternId and int(row.get("eventTime") or 0) == int(eventTime)
    ),
    None,
  )
  if signal is None:
    raise HTTPException(status_code=404, detail="FMS chart signal was not found")
  activation_time = signal.get("activationTime")
  entry = signal.get("entry")
  atr = signal.get("atr")
  if activation_time is None or entry is None or atr is None:
    return {"signal": signal}
  expiry_candles = int(signal.get("expiryCandles") or 30)
  path_horizon = max(30, expiry_candles)
  candles = _research_store.query_candles(
    normalized_symbol, "H4", int(activation_time), int(activation_time) + (path_horizon + 20) * H4_SECONDS,
  )
  candle_times = [int(candle["time"]) for candle in candles]
  profile = build_candidate_path_profile({
    "eventTime": int(signal["eventTime"]),
    "entryTime": int(activation_time),
    "entry": float(entry),
    "atr": float(atr),
    "direction": str(signal["direction"]),
  }, candles, candle_times, path_horizon)
  if profile is None:
    return {"signal": signal}
  m1_by_h4: Dict[int, List[Dict[str, Any]]] = {}
  profile_times = {int(candle["time"]) for candle in profile.get("candles") or []}
  if profile_times:
    h4_phase = min(profile_times) % H4_SECONDS
    m1_rows = _research_store.query_candles(
      normalized_symbol, "M1", min(profile_times), max(profile_times) + H4_SECONDS - 1,
    )
    for row in m1_rows:
      row_time = int(row["time"])
      containing_h4 = h4_phase + ((row_time - h4_phase) // H4_SECONDS) * H4_SECONDS
      if containing_h4 in profile_times:
        m1_by_h4.setdefault(containing_h4, []).append(row)
  target_ladder = _target_path_ladder(
      profile,
      float(signal.get("stopAtr") or 1.0),
      expiry_candles,
      normalized_symbol,
      signal.get("outcomeStatus") == "pending",
      m1_by_h4,
    )
  return {
    "signal": {
      **signal,
      "pathAudit": {**(signal.get("pathAudit") or {}), "targetLadder": target_ladder},
    },
  }


def _demo_execution_payload(
  cases: List[Dict[str, Any]],
  deals: List[Dict[str, Any]],
  capture_status: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
  case_by_tag = {
    _forward_demo_tag(PRACTICAL_MODEL_ID, row["market"], row["patternId"], row["eventTime"]): row
    for row in cases if row.get("modelId") == PRACTICAL_MODEL_ID
  }
  current_account = (capture_status or {}).get("accountLogin")
  scoped_deals = [
    deal for deal in deals
    if current_account is None or int(deal.get("accountLogin") or 0) == int(current_account)
  ]
  grouped: Dict[Tuple[int, str, int], List[Dict[str, Any]]] = {}
  for deal in scoped_deals:
    if deal.get("signalTag") not in case_by_tag or deal.get("positionId") is None:
      continue
    grouped.setdefault((int(deal.get("accountLogin") or 0), str(deal["signalTag"]), int(deal["positionId"])), []).append(deal)
  entry_in = int(getattr(mt5, "DEAL_ENTRY_IN", 0))
  entry_out = int(getattr(mt5, "DEAL_ENTRY_OUT", 1))
  entry_inout = int(getattr(mt5, "DEAL_ENTRY_INOUT", 2))
  entry_out_by = int(getattr(mt5, "DEAL_ENTRY_OUT_BY", 3))
  trades = []
  for (account_login, tag, position_id), position_deals in sorted(grouped.items(), key=lambda row: row[0]):
    entries = [row for row in position_deals if row.get("entryType") in {entry_in, entry_inout}]
    exits = [row for row in position_deals if row.get("entryType") in {entry_out, entry_inout, entry_out_by}]
    entry_volume = sum(float(row["volume"]) for row in entries)
    exit_volume = sum(float(row["volume"]) for row in exits)
    entry_price = (
      sum(float(row["price"]) * float(row["volume"]) for row in entries) / entry_volume
      if entry_volume > 0 else None
    )
    exit_price = (
      sum(float(row["price"]) * float(row["volume"]) for row in exits) / exit_volume
      if exit_volume > 0 else None
    )
    case = case_by_tag[tag]
    signal = case.get("signal") or {}
    actual_stop = next((row["deal"].get("fms_actual_stop") for row in entries if row.get("deal", {}).get("fms_actual_stop") is not None), None)
    actual_target = next((row["deal"].get("fms_actual_target") for row in entries if row.get("deal", {}).get("fms_actual_target") is not None), None)
    risk_distance = abs(float(entry_price) - float(actual_stop)) if entry_price is not None and actual_stop is not None else None
    direction_sign = 1.0 if signal.get("direction") == "long" else -1.0
    expected_deal_type = int(getattr(mt5, "DEAL_TYPE_BUY", 0)) if direction_sign > 0 else int(getattr(mt5, "DEAL_TYPE_SELL", 1))
    direction_matches = bool(entries) and all(row.get("dealType") == expected_deal_type for row in entries)
    point = next((float(row["deal"].get("fms_symbol_point") or 0) for row in entries if row.get("deal", {}).get("fms_symbol_point")), 0.0)
    tolerance = max(point * 2, 1e-10)
    model_stop = signal.get("initialStop") or signal.get("stop")
    model_target = signal.get("target")
    model_entry = signal.get("entry")
    model_entry_time = signal.get("activationTime")
    stop_matches = actual_stop is not None and model_stop is not None and abs(float(actual_stop) - float(model_stop)) <= tolerance
    target_matches = actual_target is not None and model_target is not None and abs(float(actual_target) - float(model_target)) <= tolerance
    entry_contract_adherent = direction_matches and stop_matches and target_matches
    completed = bool(entries and exits and exit_volume >= entry_volume - 1e-9)
    gross_fill_r = (
      direction_sign * (float(exit_price) - float(entry_price)) / risk_distance
      if completed and entry_price is not None and exit_price is not None and risk_distance and risk_distance > 0
      else None
    )
    initial_risk_account = next((row["deal"].get("fms_initial_risk_account") for row in entries if row.get("deal", {}).get("fms_initial_risk_account") is not None), None)
    net_account_result = sum(
      float(row["profit"]) + float(row["commission"]) + float(row["swap"]) + float(row["fee"])
      for row in position_deals
    )
    expected_result_r = signal.get("resultR")
    expected_exit_time = signal.get("exitTime")
    terminal_state = str(signal.get("outcomeStatus") or "") in {
      "target_hit", "stop_hit", "break_even_hit", "expired",
    }
    lifecycle_matches = (
      not completed
      or (
        terminal_state
        and expected_result_r is not None and gross_fill_r is not None
        and abs(float(gross_fill_r) - float(expected_result_r)) <= .15
        and expected_exit_time is not None
        and abs(max((int(row["time"]) for row in exits), default=0) - int(expected_exit_time)) <= 300
      )
    )
    contract_adherent = entry_contract_adherent and lifecycle_matches
    entry_time = min((int(row["time"]) for row in entries), default=None)
    entry_difference_price = (
      direction_sign * (float(entry_price) - float(model_entry))
      if entry_price is not None and model_entry is not None else None
    )
    entry_difference_points = (
      entry_difference_price / point
      if entry_difference_price is not None and point > 0 else None
    )
    entry_difference_r = (
      entry_difference_price / risk_distance
      if entry_difference_price is not None and risk_distance and risk_distance > 0 else None
    )
    entry_delay_seconds = (
      int(entry_time) - int(model_entry_time)
      if entry_time is not None and model_entry_time is not None else None
    )
    execution_costs_account = sum(
      float(row["commission"]) + float(row["swap"]) + float(row["fee"])
      for row in position_deals
    )
    execution_costs_r = (
      execution_costs_account / float(initial_risk_account)
      if initial_risk_account is not None and float(initial_risk_account) > 0 else None
    )
    trades.append({
      "signalTag": tag, "accountLogin": account_login, "market": case["market"], "patternId": case["patternId"],
      "eventTime": case["eventTime"], "positionId": position_id,
      "status": "completed" if completed else "open_or_partial",
      "entryPrice": entry_price, "exitPrice": exit_price,
      "entryTime": entry_time,
      "exitTime": max((int(row["time"]) for row in exits), default=None),
      "volume": entry_volume, "grossFillR": gross_fill_r,
      "modelEntryPrice": model_entry, "modelEntryTime": model_entry_time,
      "entryDelaySeconds": entry_delay_seconds,
      "entryDifferencePrice": entry_difference_price,
      "entryDifferencePoints": entry_difference_points,
      "entryDifferenceR": entry_difference_r,
      "expectedGrossR": expected_result_r,
      "grossResultDifferenceR": (
        float(gross_fill_r) - float(expected_result_r)
        if gross_fill_r is not None and expected_result_r is not None else None
      ),
      "initialRiskAccount": initial_risk_account,
      "riskPercent": next((row["deal"].get("fms_risk_percent") for row in entries if row.get("deal", {}).get("fms_risk_percent") is not None), None),
      "actualStop": actual_stop, "actualTarget": actual_target,
      "directionMatches": direction_matches, "stopMatches": stop_matches,
      "targetMatches": target_matches, "lifecycleMatches": lifecycle_matches,
      "contractAdherent": contract_adherent,
      "profit": sum(float(row["profit"]) for row in position_deals),
      "commission": sum(float(row["commission"]) for row in position_deals),
      "swap": sum(float(row["swap"]) for row in position_deals),
      "fee": sum(float(row["fee"]) for row in position_deals),
      "netAccountResult": net_account_result,
      "executionCostsAccount": execution_costs_account,
      "executionCostsR": execution_costs_r,
      "netR": (
        net_account_result / float(initial_risk_account)
        if completed and initial_risk_account is not None and float(initial_risk_account) > 0 else None
      ),
      "dealCount": len(position_deals),
    })
  completed_trades = [row for row in trades if row["status"] == "completed"]
  demo_setup_groups: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
  for trade in completed_trades:
    demo_setup_groups.setdefault((str(trade["market"]), str(trade["patternId"])), []).append(trade)
  demo_setup_summaries = []
  for (market, pattern_id), rows in sorted(demo_setup_groups.items()):
    net_rows = [float(row["netR"]) for row in rows if row.get("netR") is not None]
    average_net_r = statistics.mean(net_rows) if net_rows else None
    ready = len(rows) >= 5 and len(net_rows) == len(rows) and average_net_r is not None and average_net_r > 0 and all(row.get("contractAdherent") for row in rows)
    demo_setup_summaries.append({
      "market": market, "patternId": pattern_id, "completedTrades": len(rows),
      "averageNetR": average_net_r, "contractAdherent": all(row.get("contractAdherent") for row in rows),
      "eligibleForDemoReliance": ready,
    })
  demo_ready_setups = sum(bool(row["eligibleForDemoReliance"]) for row in demo_setup_summaries)
  comparable_entries = [row for row in trades if row.get("entryDifferenceR") is not None]
  comparable_results = [row for row in completed_trades if row.get("grossResultDifferenceR") is not None]
  cost_known = [row for row in completed_trades if row.get("executionCostsR") is not None]
  ordered_completed = sorted(completed_trades, key=lambda row: (int(row.get("exitTime") or 0), int(row["positionId"])))
  running_result = 0.0
  peak_result = 0.0
  maximum_drawdown_account = 0.0
  consecutive_losses = 0
  maximum_consecutive_losses = 0
  for trade in ordered_completed:
    result = float(trade["netAccountResult"])
    running_result += result
    peak_result = max(peak_result, running_result)
    maximum_drawdown_account = max(maximum_drawdown_account, peak_result - running_result)
    consecutive_losses = consecutive_losses + 1 if result < 0 else 0
    maximum_consecutive_losses = max(maximum_consecutive_losses, consecutive_losses)
  starting_balance = next((
    float(row["deal"].get("fms_account_balance"))
    for row in scoped_deals if row.get("deal", {}).get("fms_account_balance")
  ), None)
  maximum_drawdown_percent = (
    maximum_drawdown_account / starting_balance * 100
    if starting_balance and starting_balance > 0 else None
  )
  observed_until = int((capture_status or {}).get("checkedAt") or _time.time())
  intervals = sorted(
    (int(row["entryTime"]), int(row.get("exitTime") or observed_until))
    for row in trades if row.get("entryTime") is not None
  )
  boundaries = sorted([*( (start, 1) for start, _end in intervals), *( (end, -1) for _start, end in intervals)], key=lambda row: (row[0], row[1]))
  open_count = 0
  maximum_open_trades = 0
  for _timestamp, change in boundaries:
    open_count += change
    maximum_open_trades = max(maximum_open_trades, open_count)
  risk_known = bool(completed_trades) and all(row.get("riskPercent") is not None for row in completed_trades)
  excessive_risk = any(
    row.get("riskPercent") is None
    or float(row["riskPercent"]) > float(FMS_MANUAL_DEMO_RISK_POLICY["maximumRiskPerTradePercent"])
    for row in trades
  ) if trades else False
  positions_per_tag: Dict[str, set] = {}
  for trade in trades:
    positions_per_tag.setdefault(str(trade["signalTag"]), set()).add(int(trade["positionId"]))
  duplicate_tag_observed = any(len(position_ids) > 1 for position_ids in positions_per_tag.values())
  contract_violation = any(not bool(row.get("contractAdherent")) for row in trades)
  kill_switch_triggered = (
    (maximum_drawdown_percent is not None and maximum_drawdown_percent >= float(FMS_MANUAL_DEMO_RISK_POLICY["maximumPeakToTroughDrawdownPercent"]))
    or maximum_consecutive_losses >= int(FMS_MANUAL_DEMO_RISK_POLICY["maximumConsecutiveLosingTrades"])
    or maximum_open_trades > int(FMS_MANUAL_DEMO_RISK_POLICY["maximumOpenTrades"])
    or excessive_risk
    or contract_violation
    or duplicate_tag_observed
  )
  risk_policy_observed = (
    len(completed_trades) >= 30
    and risk_known
    and not excessive_risk
    and not contract_violation
    and not duplicate_tag_observed
    and maximum_open_trades <= int(FMS_MANUAL_DEMO_RISK_POLICY["maximumOpenTrades"])
    and maximum_drawdown_percent is not None
    and maximum_drawdown_percent <= float(FMS_MANUAL_DEMO_RISK_POLICY["maximumPeakToTroughDrawdownPercent"])
    and maximum_consecutive_losses <= int(FMS_MANUAL_DEMO_RISK_POLICY["maximumConsecutiveLosingTrades"])
    and not kill_switch_triggered
  )
  return {
    "schema": "fms-demo-execution-v1",
    "captureStatus": capture_status or {"status": "not_checked", "orderTransmission": False},
    "taggedDeals": sum(row["dealCount"] for row in trades),
    "matchedTrades": len(trades),
    "completedTrades": len(completed_trades),
    "representedSetups": len(demo_setup_summaries),
    "demoReadySetups": demo_ready_setups,
    "setupSummaries": demo_setup_summaries,
    "openOrPartialTrades": len(trades) - len(completed_trades),
    "totalNetAccountResult": sum(float(row["netAccountResult"]) for row in completed_trades),
    "averageGrossFillR": (
      statistics.mean(float(row["grossFillR"]) for row in completed_trades if row.get("grossFillR") is not None)
      if any(row.get("grossFillR") is not None for row in completed_trades) else None
    ),
    "averageNetR": (
      statistics.mean(float(row["netR"]) for row in completed_trades if row.get("netR") is not None)
      if any(row.get("netR") is not None for row in completed_trades) else None
    ),
    "executionComparison": {
      "completedComparableTrades": len(comparable_results),
      "entryComparableTrades": len(comparable_entries),
      "averageEntryDelaySeconds": (
        statistics.mean(float(row["entryDelaySeconds"]) for row in comparable_entries if row.get("entryDelaySeconds") is not None)
        if any(row.get("entryDelaySeconds") is not None for row in comparable_entries) else None
      ),
      "averageAdverseEntryDifferenceR": (
        statistics.mean(float(row["entryDifferenceR"]) for row in comparable_entries)
        if comparable_entries else None
      ),
      "averageGrossResultDifferenceR": (
        statistics.mean(float(row["grossResultDifferenceR"]) for row in comparable_results)
        if comparable_results else None
      ),
      "averageExecutionCostsR": (
        statistics.mean(float(row["executionCostsR"]) for row in cost_known)
        if cost_known else None
      ),
      "contractAdherentTrades": sum(bool(row.get("contractAdherent")) for row in trades),
      "note": "Entry difference combines manual delay, spread, and market movement; it is observed but cannot be decomposed from MT5 deal history alone.",
    },
    "riskPolicy": {
      **FMS_MANUAL_DEMO_RISK_POLICY,
      "observed": risk_policy_observed,
      "killSwitchImplemented": True,
      "killSwitchTriggered": kill_switch_triggered,
      "operationalTradingAllowed": not kill_switch_triggered,
      "riskKnownForEveryCompletedTrade": risk_known,
      "contractAdherentForEveryTrade": bool(trades) and not contract_violation,
      "excessiveRiskObserved": excessive_risk,
      "contractViolationObserved": contract_violation,
      "duplicateTagObserved": duplicate_tag_observed,
      "maximumOpenTradesObserved": maximum_open_trades,
      "maximumDrawdownAccount": maximum_drawdown_account,
      "maximumDrawdownPercent": maximum_drawdown_percent,
      "maximumConsecutiveLosingTradesObserved": maximum_consecutive_losses,
    },
    "trades": sorted(
      trades, key=lambda row: (int(row.get("entryTime") or 0), int(row["positionId"])), reverse=True,
    )[:50],
    "orderTransmission": False,
    "instructions": "On an MT5 demo account only, manually place the FMS direction and paste its exact FMS demo tag into the order Comment. Fyodor records matching deals but never sends the order.",
  }


def _current_demo_execution_payload() -> Dict[str, Any]:
  demo_status = None
  demo_status_raw = _research_store.get_metadata("fms_demo_capture_status")
  if demo_status_raw:
    try:
      parsed_demo_status = json.loads(demo_status_raw)
      demo_status = parsed_demo_status if isinstance(parsed_demo_status, dict) else None
    except (TypeError, ValueError):
      demo_status = {"status": "unreadable_capture_status", "orderTransmission": False}
  return _demo_execution_payload(
    _research_store.list_fms_live_execution_cases(limit=2000),
    _research_store.list_fms_demo_deals(limit=20000),
    demo_status,
  )


def _fms_operational_preflight(now: Optional[int] = None) -> Dict[str, Any]:
  observed_at = int(now or _time.time())
  last_cycle_raw = _research_store.get_metadata("last_calendar_successful_cycle_at")
  failed_batches_raw = _research_store.get_metadata("last_calendar_cycle_failed_batches")
  last_cycle = int(last_cycle_raw) if last_cycle_raw is not None else None
  age_seconds = None if last_cycle is None else max(0, observed_at - last_cycle)
  failed_batches = int(failed_batches_raw or "0")
  calendar_fresh = age_seconds is not None and age_seconds <= 180
  reasons = []
  if last_cycle is None:
    reasons.append("No successful EA calendar cycle has been recorded.")
  elif not calendar_fresh:
    reasons.append(f"The last successful EA calendar cycle is {age_seconds} seconds old.")
  if failed_batches > 0:
    reasons.append(f"The latest EA calendar cycle reported {failed_batches} failed batch(es).")
  return {
    "schema": "fms-operational-preflight-v1",
    "checkedAt": observed_at,
    "lastSuccessfulCalendarCycleAt": last_cycle,
    "calendarCycleAgeSeconds": age_seconds,
    "failedCalendarBatches": failed_batches,
    "calendarFresh": calendar_fresh,
    "signalMonitoringReadyNow": calendar_fresh and failed_batches == 0,
    "blockingReasons": reasons,
    "orderTransmission": False,
  }


def _forward_validation_payload(
  decisions: List[Dict[str, Any]],
  cases: List[Dict[str, Any]],
  demo_execution: Optional[Dict[str, Any]] = None,
  operational_preflight: Optional[Dict[str, Any]] = None,
  evaluated_at: Optional[int] = None,
) -> Dict[str, Any]:
  evaluated_at = int(evaluated_at or _time.time())
  setup_gate = {
    "id": "FMS-SETUP-FORWARD-GATE-v1",
    "minimumResolvedCases": 10,
    "minimumElapsedDays": 90,
    "minimumNearEntryQuoteCoverage": .8,
  }
  forward_decisions = [
    row for row in decisions
    if row.get("modelId") == PRACTICAL_MODEL_ID and row.get("status") == "qualified" and row.get("prospectiveEligible") is True
  ]
  forward_cases = [row for row in cases if row.get("modelId") == PRACTICAL_MODEL_ID]
  resolved_forward = [
    row for row in forward_cases
    if row.get("resultR") is not None and row.get("state") in {"target_hit", "stop_hit", "expired"}
  ]
  grouped_cases: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
  for row in forward_cases:
    grouped_cases.setdefault((str(row["market"]), str(row["patternId"])), []).append(row)
  setup_summaries = []
  for (market, pattern_id), setup_cases in sorted(grouped_cases.items()):
    setup_resolved = [
      row for row in setup_cases
      if row.get("resultR") is not None and row.get("state") in {"target_hit", "stop_hit", "expired"}
    ]
    setup_quote_eligible = sum(row.get("signal", {}).get("activationTime") is not None for row in setup_cases)
    setup_near_quotes = sum(
      (row.get("entryQuote") or {}).get("quality") in {"first_tick", "near_entry"}
      for row in setup_cases if row.get("signal", {}).get("activationTime") is not None
    )
    setup_average = (
      statistics.mean(float(row["resultR"]) for row in setup_resolved)
      if setup_resolved else None
    )
    setup_quote_coverage = setup_near_quotes / setup_quote_eligible if setup_quote_eligible else None
    observed_times = [
      int(row.get("observedAt") or row.get("eventTime") or 0)
      for row in setup_cases if row.get("observedAt") is not None or row.get("eventTime") is not None
    ]
    first_observed_at = min(observed_times) if observed_times else None
    last_observed_at = max(observed_times) if observed_times else None
    elapsed_days = (
      max(0, (evaluated_at - first_observed_at) // 86_400)
      if first_observed_at is not None else 0
    )
    enough_cases = len(setup_resolved) >= setup_gate["minimumResolvedCases"]
    enough_time = elapsed_days >= setup_gate["minimumElapsedDays"]
    quote_coverage_ready = (
      setup_quote_coverage is not None
      and setup_quote_coverage >= setup_gate["minimumNearEntryQuoteCoverage"]
    )
    setup_ready = (
      enough_cases and enough_time
      and setup_average is not None and setup_average > 0
      and quote_coverage_ready
    )
    if enough_cases and setup_average is not None and setup_average <= 0:
      forward_status = "degraded"
      status_reason = "Forward resolved cases currently have a non-positive average R. The registered historical rule remains unchanged but needs review."
    elif enough_cases and enough_time and not quote_coverage_ready:
      forward_status = "coverage_incomplete"
      status_reason = "The setup has enough elapsed time and resolved cases, but near-entry quote coverage remains below 80%."
    elif setup_ready:
      forward_status = "supportive"
      status_reason = "The setup has positive forward average R with at least 10 resolved cases, 90 elapsed days, and 80% near-entry quote coverage."
    else:
      forward_status = "collecting"
      status_reason = "Forward evidence is still collecting until the setup reaches 10 resolved cases and 90 elapsed days."
    setup_summaries.append({
      "market": market, "patternId": pattern_id, "resolvedCases": len(setup_resolved),
      "averageR": setup_average, "nearEntryQuoteCoverage": setup_quote_coverage,
      "firstObservedAt": first_observed_at, "lastObservedAt": last_observed_at,
      "elapsedDays": elapsed_days, "status": forward_status, "statusReason": status_reason,
      "eligibleForPaperReliance": setup_ready,
    })
  represented_setups = sum(bool(row["resolvedCases"]) for row in setup_summaries)
  paper_ready_setups = sum(bool(row["eligibleForPaperReliance"]) for row in setup_summaries)
  degraded_setups = sum(row["status"] == "degraded" for row in setup_summaries)
  collecting_setups = sum(row["status"] == "collecting" for row in setup_summaries)
  demo_setup_by_key = {
    (str(row.get("market")), str(row.get("patternId"))): row
    for row in (demo_execution or {}).get("setupSummaries", [])
  }
  global_demo_risk_observed = bool(((demo_execution or {}).get("riskPolicy") or {}).get("observed"))
  operational_ready = bool((operational_preflight or {}).get("signalMonitoringReadyNow"))
  for summary in setup_summaries:
    demo_summary = demo_setup_by_key.get((summary["market"], summary["patternId"])) or {}
    demo_ready = bool(demo_summary.get("eligibleForDemoReliance"))
    blockers = []
    if not summary["eligibleForPaperReliance"]:
      blockers.append(summary["statusReason"])
    if not demo_ready:
      blockers.append("At least 5 completed, contract-adherent tagged demo trades with positive average net R are required for this exact setup.")
    if not global_demo_risk_observed:
      blockers.append("The frozen manual-demo risk policy has not yet been observed across 30 completed tagged demo trades.")
    if not operational_ready:
      blockers.append("The EA/calendar operational preflight is not currently ready.")
    summary["demoCompletedTrades"] = int(demo_summary.get("completedTrades") or 0)
    summary["demoAverageNetR"] = demo_summary.get("averageNetR")
    summary["demoContractAdherent"] = bool(demo_summary.get("contractAdherent"))
    summary["eligibleForManualLimitedLiveReview"] = not blockers
    summary["manualLimitedLiveReviewBlockers"] = blockers
  manual_limited_live_candidates = sum(bool(row["eligibleForManualLimitedLiveReview"]) for row in setup_summaries)
  quote_eligible = sum(row.get("signal", {}).get("activationTime") is not None for row in forward_cases)
  near_entry_quotes = sum(
    (row.get("entryQuote") or {}).get("quality") in {"first_tick", "near_entry"}
    for row in forward_cases
    if row.get("signal", {}).get("activationTime") is not None
  )
  forward_average_r = (
    statistics.mean(float(row["resultR"]) for row in resolved_forward)
    if resolved_forward else None
  )
  paper_checks = {
    "minimumResolvedCases": len(resolved_forward) >= 50,
    "minimumPaperReadySetups": paper_ready_setups >= 5,
    "positiveAverageR": forward_average_r is not None and forward_average_r > 0,
    "nearEntryQuoteCoverage": quote_eligible > 0 and near_entry_quotes / quote_eligible >= .8,
  }
  demo_trading_checks = {
    "registeredSetupsAvailable": bool(PRACTICAL_PATTERN_DEFINITIONS),
    "immutableFirstSeenCapture": True,
    "lateCaptureExcluded": True,
    "deterministicEntryAndOutcomeLifecycle": True,
  }
  paper_ready = all(paper_checks.values())
  demo_trading_ready = all(demo_trading_checks.values())
  return {
    "schema": "fms-forward-validation-v1",
    "status": "demo_monitoring_ready" if demo_trading_ready else "collecting_forward_evidence",
    "modelId": PRACTICAL_MODEL_ID,
    "startedAt": FORWARD_LEDGER_ACTIVATED_AT,
    "qualifiedDecisions": len(forward_decisions),
    "trackedCases": len(forward_cases),
    "resolvedCases": len(resolved_forward),
    "pendingCases": sum(row.get("state") == "pending" for row in forward_cases),
    "ambiguousOrUnavailableCases": sum(row.get("state") in {"ambiguous", "unevaluable"} for row in forward_cases),
    "representedSetups": represented_setups,
    "paperReadySetups": paper_ready_setups,
    "degradedSetups": degraded_setups,
    "collectingSetups": collecting_setups,
    "manualLimitedLiveReviewCandidates": manual_limited_live_candidates,
    "setupForwardGate": setup_gate,
    "setupSummaries": setup_summaries,
    "averageR": forward_average_r,
    "nearEntryQuoteCount": near_entry_quotes,
    "quoteEligibleCount": quote_eligible,
    "paperChecks": paper_checks,
    "eligibleForPaperReliance": paper_ready,
    "demoTradingChecks": demo_trading_checks,
    "eligibleForDemoTrading": demo_trading_ready,
    "realMoneyChecks": {"realMoneyExecutionInScope": False},
    "demoExecution": demo_execution,
    "operationalPreflight": operational_preflight,
    "manualLimitedLiveReview": {
      "schema": "fms-manual-limited-live-review-v1",
      "eligibleSetups": manual_limited_live_candidates,
      "globalDemoRiskPolicyObserved": global_demo_risk_observed,
      "operationalPreflightReady": operational_ready,
      "orderTransmission": False,
      "decision": (
        "One or more exact setups have enough forward and observed demo evidence for a later human limited-live review. Fyodor still sends no order."
        if manual_limited_live_candidates else
        "No exact setup has yet satisfied the combined forward, observed-demo, risk-policy, and operational requirements for limited-live review."
      ),
    },
    "eligibleForRealMoneyReliance": False,
    "decision": (
      "Ready for demo-only Shadow Trader monitoring. A trade appears only when a registered setup is captured before its frozen H4 entry; late catch-up data remains audit-only."
      if demo_trading_ready else
      "Demo monitoring is unavailable until the prospective signal lifecycle is operational."
    ),
    "limitations": [
      "Forward cases remain useful evidence, but they do not block demo-only monitoring.",
      "Forward candle-path results are gross; tagged demo trades separately report recorded commission, swap, and fees when available.",
      "Historical and forward profitability cannot guarantee the next demo trade.",
      "Real-money execution is outside the current product boundary.",
    ],
  }


def _prospective_context_ledger(
  patterns: List[Dict[str, Any]],
  decisions: List[Dict[str, Any]],
  cases: List[Dict[str, Any]],
) -> Dict[str, Any]:
  """Compare immutable future context matches with their registered historical expectation."""
  case_by_key = {
    (str(row.get("market")), str(row.get("patternId")), int(row.get("eventTime") or 0)): row
    for row in cases
  }
  rows: List[Dict[str, Any]] = []
  for pattern in patterns:
    registration = pattern.get("contextRegistration") or {}
    if registration.get("status") != "reviewed_active":
      continue
    market = str(pattern.get("market") or "")
    pattern_id = str(pattern.get("id") or "")
    buckets = {
      "matched": {"decisionCount": 0, "resolved": []},
      "notMatched": {"decisionCount": 0, "resolved": []},
    }
    for decision in decisions:
      if (
        decision.get("modelId") != PRACTICAL_MODEL_ID
        or str(decision.get("market")) != market
        or str(decision.get("patternId")) != pattern_id
        or decision.get("status") != "qualified"
        or decision.get("prospectiveEligible") is not True
      ):
        continue
      signal = decision.get("signal") or {}
      overlay = signal.get("contextOverlay") or {}
      matched = bool(
        overlay.get("matched")
        and str((overlay.get("registration") or {}).get("id") or registration.get("id"))
        == str(registration.get("id"))
      )
      bucket = buckets["matched" if matched else "notMatched"]
      bucket["decisionCount"] += 1
      case = case_by_key.get((market, pattern_id, int(decision.get("eventTime") or 0)))
      if case and case.get("resultR") is not None and case.get("state") in {"target_hit", "stop_hit", "expired"}:
        bucket["resolved"].append(float(case["resultR"]))

    def summarize(bucket: Dict[str, Any]) -> Dict[str, Any]:
      values = list(bucket["resolved"])
      return {
        "decisionCount": int(bucket["decisionCount"]),
        "resolvedCount": len(values),
        "averageR": statistics.mean(values) if values else None,
        "positiveRate": sum(value > 0 for value in values) / len(values) if values else None,
      }

    later = registration.get("later") or {}
    rows.append({
      "registrationId": registration.get("id"),
      "market": market,
      "patternId": pattern_id,
      "label": pattern.get("label"),
      "condition": registration.get("condition") or {},
      "historicalExpectation": {
        "evaluableN": later.get("evaluableN"),
        "averageR": later.get("averageR"),
        "alignmentRate": (registration.get("reaction") or {}).get("alignmentRate"),
      },
      "prospective": {
        "matched": summarize(buckets["matched"]),
        "notMatched": summarize(buckets["notMatched"]),
      },
    })
  return {
    "schema": "fms-prospective-context-ledger-v1",
    "immutableFirstSeen": True,
    "rows": rows,
    "matchedDecisions": sum(row["prospective"]["matched"]["decisionCount"] for row in rows),
    "resolvedMatchedCases": sum(row["prospective"]["matched"]["resolvedCount"] for row in rows),
    "usage": "Observation only. Prospective context results cannot rewrite the registered rule or its reused-history expectation.",
  }


@app.get("/research/chart-signals/global")
def research_global_chart_signals(tf: str = "H4", refresh: bool = False) -> Dict[str, Any]:
  """Return every practical current registry without changing the selected chart."""
  effective_patterns = [_reconciled_pattern(pattern) for pattern in PRACTICAL_PATTERN_DEFINITIONS]
  markets = [
    research_chart_signals(symbol=market, tf=tf, mode="current", refresh=refresh)
    for market in sorted({str(pattern["market"]) for pattern in effective_patterns})
  ]
  unresolved_by_reason: Dict[str, int] = {}
  for market_payload in markets:
    for signal in market_payload.get("signals", []):
      if signal.get("outcomeStatus") not in {"pending", "ambiguous", "unevaluable"}:
        continue
      code = str(signal.get("outcomeReasonCode") or signal.get("outcomeStatus") or "unknown")
      unresolved_by_reason[code] = unresolved_by_reason.get(code, 0) + 1
  execution_reviews: List[Dict[str, Any]] = []
  for pattern in effective_patterns:
    profile = ((pattern.get("reactionAudit") or {}).get("profile") or {})
    research = profile.get("executionChallenger") or {}
    for code, count in (research.get("unresolvedByReason") or {}).items():
      unresolved_by_reason[str(code)] = unresolved_by_reason.get(str(code), 0) + int(count)
    active_later = research.get("activeLater")
    challenger = research.get("bestChallenger")
    if not isinstance(active_later, dict) or not isinstance(challenger, dict):
      continue
    if (pattern.get("executionReview") or {}).get("status") == "reviewed_active":
      continue
    active_execution = dict(pattern.get("execution") or {})
    active_ci = active_later.get("expectancyCi95") or {}
    frozen = {**active_execution, **{key: value for key, value in active_later.items() if key != "expectancyCi95"}, "laterAverageR": active_later.get("averageR"), "laterLower95": active_ci.get("lower"), "laterUpper95": active_ci.get("upper"), "holdingCandles": active_execution.get("expiryCandles")}
    challenger_later = challenger.get("later") or {}
    challenger_ci = challenger_later.get("expectancyCi95") or {}
    challenger = {**challenger, **{f"later{key[0].upper()}{key[1:]}": value for key, value in challenger_later.items() if key != "expectancyCi95"}, "laterAverageR": challenger_later.get("averageR"), "laterLower95": challenger_ci.get("lower"), "laterUpper95": challenger_ci.get("upper")}
    review_worthy = bool(research.get("reviewWorthy"))
    weakened = active_later.get("averageR") is not None and float(active_later["averageR"]) <= 0
    if not review_worthy and not weakened:
      continue
    execution_reviews.append({
      "market": pattern["market"], "patternId": pattern["id"], "label": pattern["label"],
      "status": "review_worthy" if review_worthy else "active_evidence_weakened",
      "active": frozen, "challenger": challenger,
      "reason": (
        "The development-selected execution challenger stayed positive later and exceeded the active contract. Codex review is required before any registry change."
        if review_worthy else
        "The active contract's later average is no longer positive. It remains active, but its execution needs review."
      ),
      "artifact": str(research.get("schema") or "fms-execution-challenger-v2"),
      "configurationHash": research.get("configurationHash"),
      "candleFingerprint": research.get("candleFingerprint"),
      "familyWinners": research.get("familyWinners") or [],
    })
  registered = [
    {
      "id": f"registered:{pattern['market']}:{pattern['id']}",
      "status": "registered",
      "market": pattern["market"],
      "label": pattern["label"],
      "evidence": (
        f"Positive no-lookahead walk-forward average "
        f"{float(pattern['historicalBenchmark']['walkForwardAverageR']):+.3f}R across "
        f"{int(pattern['historicalBenchmark']['walkForwardN'])} evaluable cases."
        if pattern.get("historicalBenchmark") else
        "Preserved registered setup with positive frozen historical evidence."
      ),
      "conclusion": "Registered: monitor future matching releases and display historical arrows.",
    }
    for pattern in effective_patterns
  ]

  forward_decisions = _research_store.list_fms_live_decisions(limit=500)
  forward_cases = _research_store.list_fms_live_execution_cases(limit=2000)
  demo_execution = _current_demo_execution_payload()
  forward_validation = _forward_validation_payload(
    forward_decisions, forward_cases, demo_execution, _fms_operational_preflight(),
  )
  prospective_context_ledger = _prospective_context_ledger(
    effective_patterns, forward_decisions, forward_cases,
  )
  followup_index = registered_context_followup_index()
  followup_profiles = list((followup_index.get("profiles") or {}).values())
  policy_candidates = [
    {"recipe": row.get("recipe"), **dict(((row.get("policyInflation") or {}).get("selectedCandidate") or {}))}
    for row in followup_profiles
    if ((row.get("policyInflation") or {}).get("selectedCandidate") or {}).get("status") == "later_supported"
  ]
  interaction_candidates = [
    {"recipe": row.get("recipe"), **dict(((row.get("boundedInteractions") or {}).get("selectedCandidate") or {}))}
    for row in followup_profiles
    if (row.get("boundedInteractions") or {}).get("status") == "later_supported"
  ]
  transfer_candidates = [
    row for row in (followup_index.get("crossMarketTransfers") or [])
    if row.get("status") == "later_supported"
  ]
  atlas_intelligence: List[Dict[str, Any]] = []
  atlas_raw = _research_store.get_metadata("fms_reaction_atlas:latest")
  if atlas_raw:
    try:
      atlas = json.loads(atlas_raw)
      registered_keys = {
        (str(pattern["market"]), str(pattern["sourceVersion"]), str(signature).split("|", 1)[-1])
        for pattern in effective_patterns
        for signature in pattern["signatures"]
      }
      for market_payload in atlas.get("markets", []):
        market = str(market_payload.get("market", ""))
        selected: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for row in market_payload.get("rows", []):
          identity = str(row.get("identity", ""))
          if (market, str(row.get("sourceVersionId", "")), identity) in registered_keys:
            continue
          classification = str(row.get("classification", ""))
          status = (
            "avoid" if classification == "avoid_standalone_direction" else
            "contender" if classification in {"historically_profitable_candidate", "directional_contender"} else
            "insufficient" if classification == "insufficient_evidence" else
            ""
          )
          if not status:
            continue
          execution = row.get("execution") or {}
          fixed_holdout = ((execution.get("holdout") or {}).get("stressedAverageR"))
          directional_holdout = ((row.get("directional") or {}).get("holdout") or {}).get("meanAtr")
          rank = (
            float(fixed_holdout) if fixed_holdout is not None else float(directional_holdout or -999),
            int(row.get("historicalN", 0)),
          )
          key = (status, identity)
          if key not in selected or rank > selected[key]["rank"]:
            selected[key] = {"rank": rank, "row": row}
        by_status = {
          status: sorted(
            (value for (row_status, _identity), value in selected.items() if row_status == status),
            key=lambda value: value["rank"], reverse=status == "contender",
          )
          for status in ("contender", "avoid", "insufficient")
        }
        for status, values in by_status.items():
          for value in values:
            row = value["row"]
            execution = row.get("execution") or {}
            holdout_r = ((execution.get("holdout") or {}).get("stressedAverageR"))
            directional = row.get("directional") or {}
            holdout_atr = (directional.get("holdout") or {}).get("meanAtr")
            recent_atr = (directional.get("recent") or {}).get("meanAtr")
            atlas_intelligence.append({
              "id": f"atlas:{market}:{status}:{hashlib.sha256(str(row.get('identity','')).encode()).hexdigest()[:10]}",
              "status": status,
              "market": market,
              "label": str(row.get("label", "Economic release package")),
              "evidence": (
                f"{int(row.get('historicalN', 0))} cases; fixed-contract later average {float(holdout_r):+.2f}R under {str(row.get('policy', '')).replace('_', ' ')}."
                if holdout_r is not None else
                f"{int(row.get('historicalN', 0))} cases; later directional response {float(holdout_atr or 0):+.2f} ATR and recent response {float(recent_atr or 0):+.2f} ATR."
              ),
              "conclusion": (
                "Research contender only; its frozen checks were not strong enough for registration."
                if status == "contender" else
                "Avoid as a standalone directional rule; retain it as context or volatility information."
                if status == "avoid" else
                "Insufficient evidence: the archive cannot support a directional conclusion yet."
              ),
            })
    except (TypeError, ValueError):
      logger.warning("Ignoring unreadable FMS reaction-atlas intelligence")
  return {
    "modelId": PRACTICAL_MODEL_ID,
    "modelHash": PRACTICAL_MODEL_HASH,
    "generatedAt": max((int(row.get("generatedAt") or 0) for row in markets), default=int(_time.time())),
    "markets": markets,
    "liveDecisions": _research_store.list_fms_live_decisions(limit=50),
    "forwardValidation": forward_validation,
    "prospectiveContextLedger": prospective_context_ledger,
    "contextFollowupResearch": {
      "schema": followup_index.get("schema") or "fms-context-followup-index-v1",
      "generatedAt": followup_index.get("generatedAt"),
      "refreshPolicy": followup_index.get("refreshPolicy"),
      "recipesAudited": len(followup_profiles),
      "policyInflationCandidates": policy_candidates,
      "boundedInteractionCandidates": interaction_candidates,
      "crossMarketTransferCandidates": transfer_candidates,
      "activeRegistryPreserved": True,
    },
    "outcomeReview": {"unresolvedByReason": unresolved_by_reason, "executionReviews": execution_reviews},
    "researchIntelligence": [*registered, *atlas_intelligence, *FMS_RESEARCH_INTELLIGENCE],
    "explanation": "Registered means historically positive under its frozen no-lookahead recipe. Contender means potentially useful but unstable. Avoid means repeated tests did not support a standalone directional rule; it may still matter as context or volatility. Insufficient means the archive cannot support an honest conclusion yet.",
  }


@app.get("/research/execution-challengers")
def research_execution_challengers() -> Dict[str, Any]:
  """Expose immutable audit artifacts; this endpoint cannot mutate the registry."""
  rows = []
  for pattern in (_reconciled_pattern(row) for row in PRACTICAL_PATTERN_DEFINITIONS):
    artifact = (((pattern.get("reactionAudit") or {}).get("profile") or {}).get("executionChallenger"))
    if isinstance(artifact, dict):
      rows.append({"market": pattern["market"], "patternId": pattern["id"], "label": pattern["label"], **artifact})
  return {
    "schema": "fms-execution-challenger-index-v1",
    "registryRevision": PRACTICAL_MODEL_HASH,
    "count": len(rows),
    "rows": rows,
    "promotionAvailable": False,
  }


@app.get("/research/live-decisions")
def research_live_decisions(market: Optional[str] = None, limit: int = 100) -> Dict[str, Any]:
  normalized_market = None if market is None else market.upper()
  if normalized_market is not None and normalized_market not in WORKBENCH_MARKETS:
    raise HTTPException(status_code=400, detail="Unsupported FMS market")
  rows = _research_store.list_fms_live_decisions(normalized_market, limit)
  return {
    "modelId": PRACTICAL_MODEL_ID,
    "immutableFirstSeen": True,
    "count": len(rows),
    "rows": rows,
  }


@app.get("/research/readiness-report")
def research_readiness_report() -> Dict[str, Any]:
  effective_patterns = [_reconciled_pattern(pattern) for pattern in PRACTICAL_PATTERN_DEFINITIONS]
  registered_rows = []
  for pattern in effective_patterns:
    provenance = _registration_provenance(pattern)
    readiness = _pattern_readiness(pattern, provenance)
    registered_rows.append({
      "market": str(pattern.get("market") or "EURUSD"),
      "patternId": str(pattern.get("id") or ""),
      "label": str(pattern.get("label") or "Registered setup"),
      "condition": str(pattern.get("condition") or ""),
      "reaction": str(pattern.get("reaction") or "continuation"),
      "execution": dict(pattern.get("execution") or {}),
      "historicalBenchmark": dict(pattern.get("historicalBenchmark") or {}),
      "reactionAudit": pattern.get("reactionAudit"),
      "contextRegistration": pattern.get("contextRegistration"),
      "readiness": readiness,
      "registrationProvenance": provenance,
    })
  decisions = _research_store.list_fms_live_decisions(limit=500)
  forward_cases = _research_store.list_fms_live_execution_cases(limit=2000)
  demo_execution = _current_demo_execution_payload()
  operational_preflight = _fms_operational_preflight()
  forward_validation = _forward_validation_payload(
    decisions, forward_cases, demo_execution, operational_preflight,
  )
  completed_demo_trades = int(demo_execution.get("completedTrades") or 0)
  matched_demo_trades = int(demo_execution.get("matchedTrades") or 0)
  complete = sum(row["readiness"]["auditStatus"] == "complete" for row in registered_rows)
  quarantined = [
    {
      "id": str(row.get("id") or ""),
      "market": str(row.get("market") or "EURUSD"),
      "label": str(row.get("label") or "Research rule"),
      "status": str(row.get("status") or "avoid"),
      "evidence": str(row.get("evidence") or ""),
      "conclusion": str(row.get("conclusion") or ""),
    }
    for row in FMS_RESEARCH_INTELLIGENCE
    if str(row.get("status")) in {"avoid", "retired"}
  ]
  return {
    "modelId": PRACTICAL_MODEL_ID,
    "researchEngineId": RELEASE_REACTION_ENGINE_ID,
    "generatedAt": int(_time.time()),
    "activeRegisteredSetups": len(effective_patterns),
    "orientationAuditedSetups": sum(bool(row["readiness"].get("orientationAudited")) for row in registered_rows),
    "historicalAuditCompleteSetups": complete,
    "historicalAuditIncompleteSetups": len(registered_rows) - complete,
    "registeredSetups": registered_rows,
    "quarantinedOrRetiredSetups": quarantined,
    "immutableLiveDecisions": len(decisions),
    "qualifiedLiveDecisions": sum(row["status"] == "qualified" and row.get("prospectiveEligible") is True for row in decisions),
    "noTradeLiveDecisions": sum(row["status"] == "no_trade" for row in decisions),
    "paperLiveEvidence": {
      "immutableFirstSeen": True,
      "decisionCount": len(decisions),
      "actualBrokerFillsRecorded": matched_demo_trades,
      "completedDemoTrades": completed_demo_trades,
      "executionComparison": demo_execution.get("executionComparison"),
      "operationalPreflight": operational_preflight,
      "setupForwardGate": forward_validation.get("setupForwardGate"),
      "setupSummaries": forward_validation.get("setupSummaries"),
      "supportiveSetups": forward_validation.get("paperReadySetups"),
      "degradedSetups": forward_validation.get("degradedSetups"),
      "collectingSetups": forward_validation.get("collectingSetups"),
      "manualLimitedLiveReview": forward_validation.get("manualLimitedLiveReview"),
      "status": "demo_execution_observed" if matched_demo_trades else "observation_only",
    },
    "knownCosts": (["commission", "swap", "fee"] if completed_demo_trades else []),
    "unknownOrExcludedCosts": [
      "spread decomposition", "slippage decomposition",
      *([] if completed_demo_trades else ["commission", "swap", "fee"]),
    ],
    "unresolvedIntegrityRisks": [
      "Historical profitability does not prove future profitability.",
      "The registered entry remains the first strictly later H4 open, not an executable release-time fill.",
      "Execution costs are deliberately deferred during demo-only model validation.",
    ],
    "eligibleForDemoShadowUse": complete == len(registered_rows) and bool(registered_rows),
    "eligibleForDemoShadowUseReason": "Yes. Registered recipes are historically audited and prospective late-capture protection is active; use remains demo-only.",
    "eligibleForRuleBasedLiveUse": False,
    "eligibleForRuleBasedLiveUseReason": "No. Real-money execution is outside the current product boundary; FMS is currently scoped to demo-only monitoring.",
  }


@app.post("/research/backtests")
def start_research_backtest(payload: MacroBacktestRequest) -> Dict[str, Any]:
  definition = get_signal_definition(payload.versionId)
  if definition is None:
    raise HTTPException(status_code=400, detail=f"Unsupported signal version: {payload.versionId}")
  _research_store.ensure_signal_version(
    definition.id,
    definition.created_at,
    definition.configuration,
    definition.configuration_hash,
  )
  currencies = list(definition.configuration.get("marketCurrencies") or ["EUR", "USD"])
  symbol = str(definition.configuration.get("symbol") or "EURUSD")
  events = _research_store.query_calendar(currencies=currencies)
  if not events:
    raise HTTPException(status_code=409, detail=f"No durable {symbol} calendar history is available")
  fingerprint = dataset_fingerprint(events, definition)
  latest = _research_store.latest_backtest_run(definition.id)
  if latest and latest["status"] in {"queued", "running"}:
    return {**latest, "cached": True}
  if (
    latest
    and latest["status"] == "completed"
    and isinstance(latest.get("result"), dict)
    and latest["result"].get("eventFingerprint") == fingerprint
    and latest["result"].get("resultSchemaVersion") == RESULT_SCHEMA_VERSION
    and latest["result"].get("targets", {}).get("2.0", {}).get("overall", {}).get("unevaluableCount", 1) == 0
  ):
    return {**latest, "cached": True}

  run_id = f"{definition.id}-{int(_time.time())}-{uuid.uuid4().hex[:8]}"
  created_at = int(_time.time())
  _research_store.save_backtest_run(
    run_id, definition.id, fingerprint, created_at, "queued"
  )
  _research_executor.submit(_execute_macro_backtest, run_id, fingerprint, definition.id)
  return {
    "id": run_id,
    "versionId": definition.id,
    "datasetFingerprint": fingerprint,
    "createdAt": created_at,
    "status": "queued",
    "result": None,
    "error": None,
    "cached": False,
  }


@app.get("/research/backtests/latest")
def latest_research_backtest(versionId: str = ACTIVE_VERSION_ID) -> Dict[str, Any]:
  if get_signal_definition(versionId) is None:
    raise HTTPException(status_code=400, detail=f"Unsupported signal version: {versionId}")
  run = _research_store.latest_backtest_run(versionId)
  if run is None:
    raise HTTPException(status_code=404, detail="No backtest has been run for this version")
  return run


@app.get("/research/backtests/{run_id}")
def research_backtest(run_id: str) -> Dict[str, Any]:
  run = _research_store.get_backtest_run(run_id)
  if run is None:
    raise HTTPException(status_code=404, detail="Unknown backtest run")
  return run


@app.websocket("/stream")
async def stream(websocket: WebSocket, symbol: str, tf: str) -> None:
  await websocket.accept()

  await websocket.send_json(
    {
      "type": "status",
      "message": "connected",
      "symbol": symbol,
      "tf": tf,
      "timestamp": datetime.utcnow().isoformat() + "Z",
    }
  )

  try:
    timeframe = mt5_timeframe(tf)
  except HTTPException as exc:
    await websocket.send_json(
      {
        "type": "status",
        "message": "bad_timeframe",
        "error": exc.detail,
      }
    )
    await websocket.close()
    return

  last_bar_time: Optional[int] = None

  try:
    while True:
      try:
        with _mt5_access(.5):
          if not _ensure_mt5_initialized():
            error = _get_last_error()
            rates = None
          else:
            ensure_symbol_selected(symbol)
            rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, 2)
            error = _get_last_error() if rates is None or len(rates) == 0 else None
      except Mt5BusyError:
        await websocket.send_json(
          {
            "type": "status",
            "message": "mt5_busy",
            "error": "Another bridge operation is using MT5; cached candles remain available.",
          }
        )
        await asyncio.sleep(1.0)
        continue
      except HTTPException as exc:
        await websocket.send_json(
          {"type": "status", "message": "symbol_error", "error": exc.detail}
        )
        await websocket.close()
        return

      if rates is None or len(rates) == 0:
        await websocket.send_json(
          {
            "type": "status",
            "message": "mt5_not_connected" if not terminal_connected else "no_data",
            "error": error,
          }
        )
        await asyncio.sleep(1.0)
        continue

      row = rates[-1]
      candle = convert_rate_row(row)

      if last_bar_time is None:
        last_bar_time = candle["time"]
        await websocket.send_json({"type": "candle_update", "candle": candle})
      else:
        if candle["time"] != last_bar_time:
          last_bar_time = candle["time"]
          await websocket.send_json({"type": "candle_new", "candle": candle})
        else:
          await websocket.send_json({"type": "candle_update", "candle": candle})

      await asyncio.sleep(1.0)
  except WebSocketDisconnect:
    # Client disconnected; just exit the handler
    return
  except Exception as exc:  # pragma: no cover - defensive logging path
    _update_last_error()
    await websocket.send_json(
      {
        "type": "status",
        "message": "mt5_error",
        "error": _get_last_error(),
        "details": str(exc),
      }
    )
    # Back off a bit before terminating
    await asyncio.sleep(2.0)
    await websocket.close()


if __name__ == "__main__":
  import uvicorn

  uvicorn.run("server:app", host="127.0.0.1", port=8001, reload=True)
