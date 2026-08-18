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
  FORWARD_PAPER_GATE,
  H4_SECONDS,
  RESULT_SCHEMA_VERSION,
  SIGNAL_DEFINITIONS,
  TARGET_R_VALUES,
  V2_VERSION_ID,
  aggregate_outcomes,
  build_backtest_result,
  build_signal_candidates,
  calculate_atr_by_candle,
  dataset_fingerprint,
  evaluate_candidate,
  get_signal_definition,
)
from research_store import ResearchStore

logger = logging.getLogger("mt5_bridge")

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


class CalendarIngestCycleRequest(BaseModel):
  completedAt: int
  failedBatches: int = 0

  @field_validator("completedAt", "failedBatches", mode="before")
  @classmethod
  def coerce_cycle_int_fields(cls, v: Any) -> int:
    return _coerce_int(v)


_research_store = ResearchStore()
_research_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="fyodor-research")
_forward_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="fyodor-forward")
_research_mt5_lock = Lock()
_forward_schedule_lock = Lock()
_forward_reconcile_scheduled = False

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
def calendar_ingest_cycle(payload: CalendarIngestCycleRequest) -> Dict[str, Any]:
  """Acknowledge one complete EA upload cycle before freezing forward releases."""
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
    FORWARD_LEDGER_ACTIVATED_AT, observed_at
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


def _reconcile_forward_paper(observed_at: int) -> None:
  """Freeze newly observed v2 packages and advance open paper outcomes."""
  definition = get_signal_definition(V2_VERSION_ID)
  if definition is None:
    return
  observations = _research_store.query_release_observations(
    from_time=FORWARD_LEDGER_ACTIVATED_AT,
    currencies=["EUR", "USD"],
  )
  candidates = build_signal_candidates(observations, now=observed_at, definition=definition)
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
  if version_id != V2_VERSION_ID:
    raise HTTPException(status_code=400, detail="Forward paper ledger is available for v2 only")
  cases = _research_store.query_paper_cases(version_id)
  eligible_cases = [case for case in cases if case["state"] != "late_for_contract"]
  target_metrics: Dict[str, Dict[str, Any]] = {}
  for target in TARGET_R_VALUES:
    key = str(target)
    outcomes = [case["outcomes"][key] for case in eligible_cases if key in case["outcomes"]]
    target_metrics[key] = aggregate_outcomes(outcomes)
  highlighted = target_metrics[str(2.0)]
  now = int(_time.time())
  elapsed_days = max(0, (now - FORWARD_LEDGER_ACTIVATED_AT) // (24 * 60 * 60))
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
    "activatedAt": FORWARD_LEDGER_ACTIVATED_AT,
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
    events = _research_store.query_calendar(currencies=["EUR", "USD"])
    candidates = build_signal_candidates(events, now=created_at, definition=definition)
    if not candidates:
      raise RuntimeError("No registered EUR/USD Economy release packages are stored yet")

    earliest = min(int(candidate["eventTime"]) for candidate in candidates) - 60 * 24 * 60 * 60
    latest = min(
      created_at,
      max(int(candidate["eventTime"]) for candidate in candidates),
    ) + 10 * 24 * 60 * 60

    with _research_mt5_lock:
      h4_candles = _fetch_research_candles("EURUSD", "H4", earliest, latest, 366)
      if not h4_candles:
        raise RuntimeError("No EURUSD H4 candles are available from MT5 or the research cache")

      def m1_provider(from_time: int, to_time: int) -> List[Dict[str, Any]]:
        return _fetch_research_candles("EURUSD", "M1", from_time, to_time, 1)

      coverage = _research_store.calendar_coverage(["EUR", "USD"])
      result = build_backtest_result(events, h4_candles, m1_provider, coverage, created_at, definition)

    combined_fingerprint = hashlib.sha256(
      f"{event_fingerprint}:{_research_price_fingerprint(h4_candles)}".encode("utf-8")
    ).hexdigest()
    result["datasetFingerprint"] = combined_fingerprint
    result["eventFingerprint"] = event_fingerprint
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
def research_versions() -> List[Dict[str, Any]]:
  return [
    {
      "id": definition.id,
      "hash": definition.configuration_hash,
      "createdAt": definition.created_at,
      "configuration": definition.configuration,
      "active": definition.id == ACTIVE_VERSION_ID,
    }
    for definition in SIGNAL_DEFINITIONS.values()
  ]


@app.get("/research/forward")
def research_forward(versionId: str = V2_VERSION_ID) -> Dict[str, Any]:
  return _forward_paper_payload(versionId)


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
  events = _research_store.query_calendar(currencies=["EUR", "USD"])
  if not events:
    raise HTTPException(status_code=409, detail="No durable EUR/USD calendar history is available")
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
