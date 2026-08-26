from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time as _time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any, Dict, List, Optional, Set, Tuple

import MetaTrader5 as mt5
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ValidationError, field_validator

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
  RESULT_SCHEMA_VERSION,
  SIGNAL_DEFINITIONS,
  STRESS_HOLDING_CANDLES,
  STRESS_STOP_ATR_VALUES,
  STRESS_TARGET_R_VALUES,
  TARGET_R_VALUES,
  V2_VERSION_ID,
  aggregate_outcomes,
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
  rescore_forecast_quality_outcomes,
)
from research_store import ResearchStore

logger = logging.getLogger("mt5_bridge")

WORKBENCH_MARKETS = {
  "EURUSD": {
    "currencies": ["EUR", "USD"],
    "sourceVersions": None,  # Retains the existing immutable EURUSD source registry.
  },
  "GBPUSD": {
    "currencies": ["GBP", "USD"],
    "sourceVersions": [
      GBPUSD_V2_VERSION_ID,
      GBPUSD_SENTIMENT_VERSION_ID,
      GBPUSD_POLICY_INFLATION_VERSION_ID,
      GBPUSD_GROWTH_VERSION_ID,
    ],
  },
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
    if normalized not in {"EURUSD", "GBPUSD"}:
      raise ValueError("FMS market must be EURUSD or GBPUSD")
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
_research_mt5_lock = Lock()
_forward_schedule_lock = Lock()
_forward_reconcile_scheduled = False
_chart_signal_catalog_lock = Lock()
_chart_signal_catalog_cache: Dict[str, List[Dict[str, Any]]] = {}
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

def _ensure_mt5_initialized() -> bool:
  """Return True when the Python MT5 API has an active terminal connection.

  Calendar ingestion reaches this bridge over HTTP from the EA and can keep
  working even when the Python package has lost its IPC session. Price, symbol,
  server-time, and streaming endpoints need this connection.
  """
  global terminal_connected, last_error

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


def _session_snapshot(symbol: str) -> Dict[str, Any]:
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


def _update_last_error() -> None:
  global last_error
  code, message = mt5.last_error()
  if code != 0:
    last_error = {"code": code, "message": message}
  else:
    last_error = None


def _get_last_error() -> Optional[Dict[str, Any]]:
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
  if _research_store.query_release_observations(
    from_time=FORWARD_LEDGER_ACTIVATED_AT, currencies=["EUR", "USD"]
  ):
    _schedule_forward_reconcile(int(_time.time()))

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
  # Determine connection status directly from MT5, rather than relying on
  # cached globals, so this reflects the real-time terminal state.
  terminal_connected = _ensure_mt5_initialized()

  # Optional metadata
  version = mt5.version() if terminal_connected else None
  account = mt5.account_info() if terminal_connected else None

  # Last error is purely informational and does not affect `ok`
  err_code, err_message = mt5.last_error()
  last_error_info = {"code": err_code, "message": err_message}

  payload: Dict[str, Any] = {
    "ok": True,
    "bridge_connected": True,
    "api_revision": BRIDGE_API_REVISION,
    "terminal_connected": terminal_connected,
    "mt5_version": version,
    "account_login": account.login if account is not None else None,
    "last_error": last_error_info,
    "calendar_events_count": _research_store.calendar_count(),
    "last_calendar_ingest_at": _metadata_float("last_calendar_ingest_at"),
  }
  return payload


def _get_server_time_from_mt5(symbol: Optional[str] = None) -> Optional[int]:
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

  return result


@app.get("/market_status")
def market_status(symbol: str) -> Dict[str, Any]:
  return _session_snapshot(symbol)


@app.get("/history")
def history(symbol: str, tf: str, bars: int = 500) -> List[Dict[str, Any]]:
  if bars <= 0:
    raise HTTPException(status_code=400, detail="bars must be > 0")
  if bars > 5000:
    raise HTTPException(status_code=400, detail="bars must be <= 5000")

  # Check live terminal state instead of relying on cached globals.
  if not _ensure_mt5_initialized():
    raise HTTPException(status_code=503, detail="MT5 terminal not connected")

  timeframe = mt5_timeframe(tf)
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
  global _last_history_symbol
  _last_history_symbol = symbol
  return candles


@app.get("/history_range")
def history_range(symbol: str, tf: str, from_: int, to: int) -> List[Dict[str, Any]]:
  if from_ >= to:
    raise HTTPException(status_code=400, detail="from_ must be < to")

  max_range_seconds = 40 * 24 * 60 * 60
  if to - from_ > max_range_seconds:
    raise HTTPException(status_code=400, detail="requested range is too large")

  if not _ensure_mt5_initialized():
    raise HTTPException(status_code=503, detail="MT5 terminal not connected")

  timeframe = mt5_timeframe(tf)
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
  global _last_history_symbol
  _last_history_symbol = symbol
  return candles


@app.get("/history_boundary")
def history_boundary(symbol: str, tf: str) -> Dict[str, Any]:
  if not _ensure_mt5_initialized():
    raise HTTPException(status_code=503, detail="MT5 terminal not connected")

  timeframe = mt5_timeframe(tf)
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
  global _last_history_symbol
  _last_history_symbol = symbol
  return {"oldest_time": candle["time"], "approximate": True}


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


def _fetch_research_candles(
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
  with _research_mt5_lock:
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
  except Exception:
    logger.exception("forward_paper_reconcile failed observed_at=%s", observed_at)
  finally:
    with _forward_schedule_lock:
      _forward_reconcile_scheduled = False


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

    with _research_mt5_lock:
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
  cache_key = f"fms_workbench_catalog_v3:{market}:{bundle['datasetFingerprint']}:{report_revision}"
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
    for pattern in CHART_SIGNAL_PATTERN_DEFINITIONS
    if market == "EURUSD" and pattern.get("current")
    for signature in pattern["signatures"]
  }
  directional_catalog: List[Dict[str, Any]] = []
  for source in bundle["sources"]:
    source_version = str(source["versionId"])
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for outcome in source["outcomes"]:
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
      }]
      if enriched:
        seen = {("none", "all", "continuation")}
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


@app.get("/research/workbench")
def research_workbench(market: str = "EURUSD") -> Dict[str, Any]:
  normalized_market = market.upper()
  market_definition = WORKBENCH_MARKETS.get(normalized_market)
  if market_definition is None:
    raise HTTPException(status_code=400, detail="Unsupported FMS market")
  calendar_coverage = _research_store.calendar_coverage(market_definition["currencies"])
  required_versions = market_definition["sourceVersions"] or sorted({str(pattern["sourceVersion"]) for pattern in CHART_SIGNAL_PATTERN_DEFINITIONS})
  missing_source_versions = [
    version for version in required_versions
    if not (_research_store.latest_backtest_run(version) or {}).get("status") == "completed"
  ]
  h4_prices = _research_store.query_candles(normalized_market, "H4", 0, int(_time.time()))
  if missing_source_versions or not h4_prices:
    return {
      "market": normalized_market,
      "currentModel": {"id": CHART_SIGNAL_MODEL_ID, "friendlyName": "Forecast Guard", "displayId": "Legacy v13", "hash": CHART_SIGNAL_MODEL_HASH, "activatedAt": CHART_SIGNAL_MODEL_CREATED_AT, "timeframe": "H4", "registeredSetups": []},
      "catalog": {"items": [], "advancedTreatmentsReady": False, "generatedAt": int(_time.time())},
      "protocol": {"stopAtrValues": list(STRESS_STOP_ATR_VALUES), "targetRValues": list(STRESS_TARGET_R_VALUES), "holdingCandles": list(STRESS_HOLDING_CANDLES), "scoringPolicies": ["baseline", "momentum_only", "forecast_quality"], "entry": "first_h4_open_strictly_after_release", "selection": "development_lower95_then_average"},
      "experiments": [], "candidates": [], "archive": _research_store.list_signal_version_archive(),
      "dataPeriods": {"durableCalendar": {"start": calendar_coverage.get("earliest"), "end": calendar_coverage.get("latest")}, "workbenchResearch": {"start": None, "end": None}, "h4Prices": {"start": min((int(row["time"]) for row in h4_prices), default=None), "end": max((int(row["time"]) for row in h4_prices), default=None)}},
      "datasetFingerprint": f"unavailable:{normalized_market}", "sourceRunIds": [], "candleRevision": "unavailable",
      "availability": {"ready": False, "missingSourceVersions": missing_source_versions, "missingH4Prices": not h4_prices, "message": f"{normalized_market} research is blocked until durable GBP/USD calendar history and {normalized_market} H4 prices are backfilled, then its four market-labelled source backtests complete."},
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
  return {
    "market": normalized_market,
    "currentModel": {
      "id": CHART_SIGNAL_MODEL_ID,
      "friendlyName": "Forecast Guard",
      "displayId": "Legacy v13",
      "hash": CHART_SIGNAL_MODEL_HASH,
      "activatedAt": CHART_SIGNAL_MODEL_CREATED_AT,
      "timeframe": "H4",
      "registeredSetups": [{
        "id": str(pattern["id"]),
        "label": str(pattern["label"]),
        "condition": str(pattern["condition"]),
        "sourceVersionId": str(pattern["sourceVersion"]),
        "signatures": list(pattern["signatures"]),
        "execution": dict(pattern["execution"]),
        "registrationEvidence": dict(CHART_SIGNAL_REGISTRATION_EVIDENCE[str(pattern["id"])]) if str(pattern["id"]) in CHART_SIGNAL_REGISTRATION_EVIDENCE else None,
      } for pattern in CHART_SIGNAL_PATTERN_DEFINITIONS if pattern.get("current")],
    },
    "catalog": catalog,
    "protocol": {
      "stopAtrValues": list(STRESS_STOP_ATR_VALUES),
      "targetRValues": list(STRESS_TARGET_R_VALUES),
      "holdingCandles": list(STRESS_HOLDING_CANDLES),
      "scoringPolicies": ["baseline", "momentum_only", "forecast_quality"],
      "entry": "first_h4_open_strictly_after_release",
      "selection": "development_lower95_then_average",
    },
    "experiments": [row for row in (_experiment_summary(row) for row in _research_store.list_fms_experiments(500)) if str((row.get("configuration") or {}).get("market", "EURUSD")) == normalized_market],
    "candidates": [row for row in _research_store.list_fms_candidates() if str((row.get("configuration") or {}).get("market", "EURUSD")) == normalized_market],
    "archive": _research_store.list_signal_version_archive(),
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


def _validate_experiment_request(payload: FmsExperimentRequest, catalog: Dict[str, Any]) -> Dict[str, Any]:
  item = next((row for row in catalog["items"] if row["id"] == payload.catalogId), None)
  if item is None:
    raise HTTPException(status_code=400, detail="Unknown or stale FMS catalog selection")
  if payload.scoringPolicy not in {"baseline", "momentum_only", "forecast_quality"}:
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
      raise HTTPException(status_code=409, detail=f"Legacy raw audit could not be reconstructed: {exc}") from exc
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


@app.get("/research/chart-signals")
def research_chart_signals(
  symbol: str = "EURUSD",
  tf: str = "H4",
  mode: str = "current",
  from_: Optional[int] = None,
  to: Optional[int] = None,
) -> Dict[str, Any]:
  normalized_symbol = symbol.upper()
  normalized_tf = tf.upper()
  normalized_mode = mode.lower()
  if normalized_mode not in {"current", "research_replay"}:
    raise HTTPException(status_code=400, detail="Macro Bias mode must be current or research_replay")
  if normalized_symbol != "EURUSD" or normalized_tf not in {"H1", "H4"}:
    return {
      "supported": False,
      "versionId": CHART_SIGNAL_MODEL_ID,
      "modelId": CHART_SIGNAL_MODEL_ID,
      "modelHash": CHART_SIGNAL_MODEL_HASH,
      "modelActivatedAt": CHART_SIGNAL_MODEL_CREATED_AT,
      "mode": normalized_mode,
      "symbol": normalized_symbol,
      "timeframe": normalized_tf,
      "modelTimeframe": "H4",
      "targetR": 2.0,
      "patterns": [],
      "signals": [],
      "message": "Fyodor Macro Bias currently supports EURUSD H4 and an H4-model view on H1 only.",
    }
  source_versions = sorted({str(pattern["sourceVersion"]) for pattern in CHART_SIGNAL_PATTERN_DEFINITIONS})
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
  catalog_key = f"{':'.join(str(source_runs[version].get('id', '')) for version in source_versions)}:{dataset_fingerprint}:{CHART_SIGNAL_MODEL_HASH}"
  with _chart_signal_catalog_lock:
    catalog = _chart_signal_catalog_cache.get(catalog_key)
  if catalog is None:
    catalog = []
    for source_version in source_versions:
      result = source_results[source_version]
      catalog.extend(build_chart_signal_pattern_catalog(
        result["targets"]["2.0"]["outcomes"],
        result["candidateSummary"]["developmentHoldoutBoundary"],
        {
          target_r: target_payload.get("outcomes", [])
          for target_r, target_payload in result.get("targets", {}).items()
          if isinstance(target_payload, dict)
        },
        source_version,
      ))
    with _chart_signal_catalog_lock:
      _chart_signal_catalog_cache.clear()
      _chart_signal_catalog_cache[catalog_key] = catalog
  patterns = [
    pattern for pattern in catalog
    if normalized_mode == "research_replay" or pattern["currentEligible"]
  ]
  def matching_pattern(source_version: str, candidate: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    return next(
      (
        pattern for pattern in patterns
        if pattern["sourceVersionId"] == source_version
        and candidate_matches_chart_pattern(candidate, pattern)
      ),
      None,
    )
  observed_events = _research_store.query_release_observations(
    from_time=FORWARD_LEDGER_ACTIVATED_AT,
    currencies=["EUR", "USD"],
  )
  generated_at = _get_server_time_from_mt5(normalized_symbol) or int(_time.time())
  observation_coverage_start = min((int(event["time"]) for event in observed_events), default=None)
  current_candidates: List[Tuple[str, Dict[str, Any]]] = []
  assessment_candidates: List[Tuple[str, Dict[str, Any]]] = []
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
    rescored, _forecast_audit = rescore_forecast_quality_outcomes([*historical_seed, *observed_source_candidates])
    rescored_observed = [candidate for candidate in rescored if int(candidate["eventTime"]) in observed_times]
    assessment_candidates.extend((source_version, candidate) for candidate in rescored_observed)
    current_candidates.extend(
      (source_version, candidate)
      for candidate in rescored_observed
      if int(candidate["eventTime"]) >= CHART_SIGNAL_MODEL_CREATED_AT
    )
  paper_cases = {
    (source_version, int(case["eventTime"])): case
    for source_version in source_versions
    for case in _research_store.query_paper_cases(source_version)
  }
  # Keep the two views provenance-pure. Current signals must remain based on
  # immutable first-seen EA observations even after a historical backtest is
  # refreshed; replay signals must remain the frozen archive reconstruction.
  candidates = current_candidates if normalized_mode == "current" else [
    (source_version, outcome)
    for source_version in source_versions
    for outcome in source_results[source_version]["targets"]["2.0"]["outcomes"]
  ]
  window_candidates = [
    (source_version, candidate)
    for source_version, candidate in candidates
    if (from_ is None or int(candidate["eventTime"]) >= from_)
    and (to is None or int(candidate["eventTime"]) <= to)
  ]
  direct_evaluation_candidates = [
    (source_version, candidate, pattern)
    for source_version, candidate in window_candidates
    for pattern in [matching_pattern(source_version, candidate)]
    if pattern is not None and (
      normalized_mode == "current"
      or pattern.get("execution") != {"stopAtr": 1.0, "targetR": 2.0, "expiryCandles": 30}
    )
  ]
  custom_candles: List[Dict[str, Any]] = []
  custom_candle_times: List[int] = []
  custom_atr_values: List[Optional[float]] = []
  if direct_evaluation_candidates:
    earliest_custom = min(int(candidate["eventTime"]) for _, candidate, _ in direct_evaluation_candidates)
    latest_custom = max(int(candidate["eventTime"]) for _, candidate, _ in direct_evaluation_candidates)
    custom_candles = _research_store.query_candles(
      "EURUSD", "H4", earliest_custom - 45 * 24 * 60 * 60,
      min(generated_at + H4_SECONDS, latest_custom + 75 * 24 * 60 * 60),
    )
    custom_candle_times = [int(candle["time"]) for candle in custom_candles]
    custom_atr_values = calculate_atr_by_candle(custom_candles)
  signals: List[Dict[str, Any]] = []
  for source_version, candidate in window_candidates:
    event_time = int(candidate["eventTime"])
    pattern = matching_pattern(source_version, candidate)
    if pattern is None:
      continue
    paper_outcome = paper_cases.get((source_version, event_time), {}).get("outcomes", {}).get("2.0", {})
    execution = pattern["execution"]
    evaluated = candidate
    uses_custom_execution = execution != {"stopAtr": 1.0, "targetR": 2.0, "expiryCandles": 30}
    uses_direct_evaluation = normalized_mode == "current" or uses_custom_execution
    if uses_direct_evaluation and custom_candles:
      evaluated = evaluate_candidate(
        candidate,
        custom_candles,
        custom_candle_times,
        custom_atr_values,
        float(execution["targetR"]),
        allow_pending=normalized_mode == "current",
        as_of=generated_at,
        stop_atr=float(execution["stopAtr"]),
        holding_candles=int(execution["expiryCandles"]),
      )
    activation_time = evaluated.get("entryTime") or (None if uses_direct_evaluation else paper_outcome.get("entryTime"))
    def outcome_value(name: str) -> Any:
      if uses_direct_evaluation:
        return evaluated.get(name)
      return evaluated.get(name) if evaluated.get(name) is not None else paper_outcome.get(name)
    signals.append({
      "id": f"{pattern['id']}:{event_time}",
      "patternId": pattern["id"],
      "sourceVersionId": source_version,
      "eventTime": event_time,
      "direction": candidate["direction"],
      "label": pattern["label"],
      "agreement": candidate["agreement"],
      "pairVote": candidate["pairVote"],
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
      "execution": pattern["execution"],
      "stopAtr": float(pattern["execution"]["stopAtr"]),
      "targetR": float(pattern["execution"]["targetR"]),
      "expiryCandles": int(pattern["execution"]["expiryCandles"]),
      "entry": outcome_value("entry"),
      "atr": outcome_value("atr"),
      "stop": outcome_value("stop"),
      "target": outcome_value("target"),
      "outcomeStatus": evaluated.get("status") or (None if uses_custom_execution else paper_outcome.get("status")),
      "resultR": evaluated.get("resultR") if uses_direct_evaluation else (evaluated.get("resultR") if evaluated.get("resultR") is not None else paper_outcome.get("resultR")),
      "exitTime": evaluated.get("exitTime") or (None if uses_direct_evaluation else paper_outcome.get("exitTime")),
      "historicalReplay": normalized_mode == "research_replay",
    })
  signal_activation_times = [int(signal["activationTime"]) for signal in signals if signal.get("activationTime") is not None]
  if signal_activation_times:
    signal_candles = _research_store.query_candles(
      "EURUSD", "H4", min(signal_activation_times), max(signal_activation_times) + 90 * 24 * 60 * 60,
    )
    signal_candle_times = [int(candle["time"]) for candle in signal_candles]
    for signal in signals:
      if signal.get("activationTime") is None or signal.get("entry") is None or signal.get("atr") is None:
        signal["expiryTime"] = None
        signal["maximumAdverseR"] = None
        continue
      profile = build_candidate_path_profile({
        "eventTime": int(signal["eventTime"]),
        "entryTime": int(signal["activationTime"]),
        "entry": float(signal["entry"]),
        "atr": float(signal["atr"]),
        "direction": str(signal["direction"]),
      }, signal_candles, signal_candle_times, int(signal["expiryCandles"]))
      if profile is None:
        signal["expiryTime"] = None
        signal["maximumAdverseR"] = None
        continue
      expiry_candles = int(signal["expiryCandles"])
      signal["expiryTime"] = int(profile["candles"][expiry_candles - 1]["time"]) if len(profile["candles"]) >= expiry_candles else None
      exit_time = signal.get("exitTime")
      adverse = [
        value for candle, value in zip(profile["candles"], profile["adverse"])
        if exit_time is None or int(candle["time"]) <= int(exit_time)
      ]
      signal["maximumAdverseR"] = min(1.0, max(adverse, default=0.0) / float(signal["stopAtr"]))
  latest_matched_event_at = max((int(signal["eventTime"]) for signal in signals), default=None)
  latest_arrow_at = max(
    (
      int(signal["activationTime"])
      if signal.get("activationTime") is not None
      else (int(signal["eventTime"]) // H4_SECONDS + 1) * H4_SECONDS
      for signal in signals
    ),
    default=None,
  )
  later_unmatched_package_count = sum(
    1
    for source_version, candidate in window_candidates
    if latest_matched_event_at is not None
    and int(candidate["eventTime"]) > latest_matched_event_at
    and matching_pattern(source_version, candidate) is None
  )
  scheduled_events = _research_store.query_calendar(
    from_time=generated_at - 7 * 24 * 60 * 60,
    currencies=["EUR", "USD"],
  )
  realtime = build_chart_signal_realtime_watch(
    scheduled_events,
    generated_at,
    frozenset(str(pattern["id"]) for pattern in catalog if pattern["currentEligible"]),
    assessment_candidates,
    frozenset(int(event["time"]) for event in observed_events),
    CHART_SIGNAL_MODEL_CREATED_AT,
  )
  context_revision = _research_store.get_metadata("last_calendar_ingest_at") or "unversioned"
  context_key = f"{id(_research_store)}:{context_revision}"
  with _chart_signal_context_lock:
    cached_context = _chart_signal_context_cache.get(context_key)
  if cached_context is None:
    context_events = _research_store.query_calendar(
      from_time=generated_at - 400 * 24 * 60 * 60,
      to_time=generated_at,
      currencies=["EUR", "USD"],
    )
    cached_context = build_policy_inflation_context(context_events, generated_at)
    with _chart_signal_context_lock:
      _chart_signal_context_cache.clear()
      _chart_signal_context_cache[context_key] = cached_context
  policy_inflation_context = {**cached_context, "asOf": generated_at}
  return {
    "supported": True,
    "versionId": CHART_SIGNAL_MODEL_ID,
    "versionHash": CHART_SIGNAL_MODEL_HASH,
    "modelId": CHART_SIGNAL_MODEL_ID,
    "modelHash": CHART_SIGNAL_MODEL_HASH,
    "modelActivatedAt": CHART_SIGNAL_MODEL_CREATED_AT,
    "datasetFingerprint": dataset_fingerprint,
    "mode": normalized_mode,
    "symbol": normalized_symbol,
    "timeframe": normalized_tf,
    "modelTimeframe": "H4",
    "targetR": 2.0,
    "generatedAt": generated_at,
    "realtime": realtime,
    "policyInflationContext": policy_inflation_context,
    "evaluationSummary": {
      "evaluatedPackageCount": len(window_candidates),
      "matchingPackageCount": len(signals),
      "latestEvaluatedAt": max((int(candidate["eventTime"]) for _, candidate in window_candidates), default=None),
      "latestMatchedEventAt": latest_matched_event_at,
      "latestArrowAt": latest_arrow_at,
      "laterUnmatchedPackageCount": later_unmatched_package_count,
    },
    "patterns": patterns,
    "signals": signals,
    "currentPatternCount": sum(pattern["currentEligible"] for pattern in catalog),
    "researchPatternCount": len(catalog),
    "message": (
      "Current v10 model: only post-activation releases matching the frozen registry and each setup's declared execution contract are eligible; policy/inflation context is descriptive only."
      if normalized_mode == "current" else
      "Historical research replay: arrows use patterns selected after reviewing the archive and were not available in real time."
    ),
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

  # If the MT5 terminal is not currently available, fail fast.
  if not _ensure_mt5_initialized():
    await websocket.send_json(
      {
        "type": "status",
        "message": "mt5_not_connected",
        "error": _get_last_error(),
      }
    )
    await websocket.close()
    return

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

  try:
    ensure_symbol_selected(symbol)
  except HTTPException as exc:
    await websocket.send_json(
      {"type": "status", "message": "symbol_error", "error": exc.detail}
    )
    await websocket.close()
    return

  last_bar_time: Optional[int] = None

  try:
    while True:
      if not _ensure_mt5_initialized():
        await websocket.send_json(
          {
            "type": "status",
            "message": "mt5_not_connected",
            "error": _get_last_error(),
          }
        )
        await asyncio.sleep(2.0)
        continue

      rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, 2)
      if rates is None or len(rates) == 0:
        _update_last_error()
        await websocket.send_json(
          {
            "type": "status",
            "message": "no_data",
            "error": _get_last_error(),
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
