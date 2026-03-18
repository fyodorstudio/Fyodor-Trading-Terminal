from __future__ import annotations

import asyncio
import json
import logging
import time as _time
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any, Dict, List, Optional, Set, Tuple

import MetaTrader5 as mt5
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ValidationError, field_validator

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


# In-memory store for calendar events. Keyed by (id, time).
_calendar_events: List[Dict[str, Any]] = []
_calendar_event_keys: Set[Tuple[int, int]] = set()
_calendar_lock: Lock = Lock()

# Last symbol used successfully in GET /history; used by GET /server_time when no symbol param.
_last_history_symbol: Optional[str] = None

# UNIX timestamp of last successful POST /calendar_ingest; exposed in GET /health.
_last_calendar_ingest_at: Optional[float] = None


def _namedtuple_to_dict(value: Any) -> Dict[str, Any]:
  if value is None:
    return {}
  if hasattr(value, "_asdict"):
    return value._asdict()
  if isinstance(value, dict):
    return value
  return {}


def _infer_asset_class(symbol: str, path: Optional[str]) -> str:
  text = f"{symbol} {path or ''}".lower()
  if "crypto" in text:
    return "crypto"
  if "metal" in text or "xau" in text or "xag" in text:
    return "metals"
  if "forex" in text or "fx" in text or len(symbol) == 6:
    return "forex"
  if "index" in text or "indices" in text:
    return "index"
  if "stock" in text or "share" in text or "equity" in text:
    return "equity"
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
  terminal_info = mt5.terminal_info()
  if terminal_info is None:
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

  if not mt5.initialize():
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


@app.get("/health")
def health() -> Dict[str, Any]:
  # Determine connection status directly from MT5, rather than relying on
  # cached globals, so this reflects the real-time terminal state.
  terminal_info = mt5.terminal_info()
  terminal_connected = terminal_info is not None

  # Optional metadata
  version = mt5.version() if terminal_connected else None
  account = mt5.account_info() if terminal_connected else None

  # Last error is purely informational and does not affect `ok`
  err_code, err_message = mt5.last_error()
  last_error_info = {"code": err_code, "message": err_message}

  payload: Dict[str, Any] = {
    "ok": terminal_connected,
    "terminal_connected": terminal_connected,
    "mt5_version": version,
    "account_login": account.login if account is not None else None,
    "last_error": last_error_info,
    "calendar_events_count": len(_calendar_events),
    "last_calendar_ingest_at": _last_calendar_ingest_at,
  }
  return payload


def _get_server_time_from_mt5(symbol: Optional[str] = None) -> Optional[int]:
  """Get MT5 server time. If symbol is set, try only that symbol. Else try _last_history_symbol, then fallbacks."""
  if mt5.terminal_info() is None:
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
  if mt5.terminal_info() is None:
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
  if mt5.terminal_info() is None:
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

  if mt5.terminal_info() is None:
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

  ingested = 0
  with _calendar_lock:
    for event in payload.events:
      key = (event.id, event.time)
      if key in _calendar_event_keys:
        continue
      record = event.model_copy().model_dump()
      _calendar_events.append(record)
      _calendar_event_keys.add(key)
      ingested += 1

  # Keep enough history for quarterly CPI and prior policy decisions.
  horizon_days = 400
  cutoff_ts = int(_time.time()) - horizon_days * 24 * 60 * 60
  with _calendar_lock:
    if _calendar_events:
      recent: List[Dict[str, Any]] = []
      recent_keys: Set[Tuple[int, int]] = set()
      for e in _calendar_events:
        t = int(e.get("time", 0))
        if t >= cutoff_ts:
          key = (int(e.get("id", 0)), t)
          recent.append(e)
          recent_keys.add(key)
      _calendar_events.clear()
      _calendar_events.extend(recent)
      _calendar_event_keys.clear()
      _calendar_event_keys.update(recent_keys)

  total = len(_calendar_events)
  global _last_calendar_ingest_at
  _last_calendar_ingest_at = _time.time()
  duration_ms = int((_time.perf_counter() - t0) * 1000)
  logger.info(
    "calendar_ingest method=POST path=/calendar_ingest status=200 body_size=%s ingested=%s total=%s duration_ms=%s",
    body_size,
    ingested,
    total,
    duration_ms,
  )
  return {"ingested": ingested, "total": total}


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

  with _calendar_lock:
    events = list(_calendar_events)

  def include(e: Dict[str, Any]) -> bool:
    t = int(e.get("time", 0))
    if from_ is not None and t < from_:
      return False
    if to is not None and t > to:
      return False

    if impacts is not None:
      lvl = str(e.get("impact", "")).lower()
      if lvl not in impacts:
        return False

    if countries is not None:
      code = str(e.get("countryCode", "")).upper()
      if code not in countries:
        return False

    return True

  filtered = [e for e in events if include(e)]
  filtered.sort(key=lambda e: int(e.get("time", 0)))
  return filtered


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
  if mt5.terminal_info() is None:
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
      if mt5.terminal_info() is None:
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
