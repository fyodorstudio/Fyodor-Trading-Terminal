from __future__ import annotations

from contextlib import asynccontextmanager
import json
from pathlib import Path
from time import monotonic, perf_counter, time
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .calendar_ingestion import CalendarStore
from .candle_activity import MAX_TICK_HISTORY_CANDLES, MAX_TICK_HISTORY_SECONDS
from .contracts import CalendarIngestPayload
from .currency_indices import STEPS
from .market_data import TIMEFRAME_NAMES
from .mt5_worker import Mt5UnavailableError, Mt5Worker, SupersededRequest
from .runtime_activity import ActivityLedger, HeartbeatRegistry, utc_milliseconds
from .settings import load_settings
from .volume_profile import MAX_PROFILE_PAGE_SECONDS
from .volume_profile_history import ProfileHistory, VolumeProfileCache

API_VERSION = "1"
BRIDGE_VERSION = "1.0.0"
settings = load_settings()
activity = ActivityLedger()
heartbeat = HeartbeatRegistry()
calendar_store = CalendarStore(activity)
mt5_worker = Mt5Worker(settings, activity)
volume_profile_cache = VolumeProfileCache(Path(__file__).resolve().parents[3] / "storage" / "data" / "volume-profile.sqlite3")
started_at = utc_milliseconds()


@asynccontextmanager
async def lifespan(_: FastAPI):
    activity.append("Bridge", "Bridge started", f"API v{API_VERSION}", "success")
    mt5_worker.start()
    try:
        yield
    finally:
        mt5_worker.stop()
        activity.append("Bridge", "Bridge stopped")


app = FastAPI(
    title="Fyodor MT5 Bridge",
    version=BRIDGE_VERSION,
    docs_url=None,
    redoc_url=None,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.allowed_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Fyodor-Calendar-Protocol"],
)


def bridge_error(error: Exception) -> HTTPException:
    if isinstance(error, SupersededRequest):
        return HTTPException(status_code=409, detail={"code": "superseded", "message": str(error)})
    if isinstance(error, Mt5UnavailableError):
        return HTTPException(status_code=503, detail={"code": "mt5-unavailable", "message": str(error)})
    message = str(error)
    if "history returned for" in message or "Unable to select" in message:
        return HTTPException(status_code=404, detail={"code": "ohlc-history-unavailable", "message": message})
    return HTTPException(status_code=502, detail={"code": "mt5-call-failed", "message": message})


@app.get("/api/v1/health")
def get_health() -> dict[str, object]:
    now = utc_milliseconds()
    return {
        "api_version": API_VERSION,
        "bridge": {
            "status": "running",
            "version": BRIDGE_VERSION,
            "started_at": started_at,
            "now": now,
            "uptime_ms": now - started_at,
        },
        "mt5": mt5_worker.snapshot(),
        "calendar": calendar_store.health(),
        "operations": heartbeat.snapshot(),
    }


@app.get("/api/v1/activity")
def get_activity(after: int = Query(default=0, ge=0)) -> dict[str, object]:
    return activity.after(after)


@app.get("/api/v1/market-watch")
def get_market_watch() -> dict[str, object]:
    component = "market_watch"
    token = heartbeat.begin(component, "Reading visible MT5 symbols")
    try:
        symbols = mt5_worker.submit(component, "market-watch", priority=5)
    except Exception as error:
        heartbeat.fail(component, token, str(error))
        raise bridge_error(error) from error
    duration = heartbeat.succeed(component, token, len(symbols))
    return {"symbols": symbols, "observed_at": utc_milliseconds(), "duration_ms": duration}


@app.get("/api/v1/ohlc")
def get_ohlc(
    symbol: str = Query(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._#-]+$"),
    timeframe: str = Query(pattern="^(M1|M5|M15|M30|H1|H4|D1)$"),
    start_pos: int = Query(default=0, ge=0, le=10_000_000),
    count: int = Query(default=800, ge=2, le=5000),
    before: int | None = Query(default=None, ge=1, le=253402300799),
    trend_alert: bool = False,
) -> dict[str, object]:
    if timeframe not in TIMEFRAME_NAMES:
        raise HTTPException(status_code=422, detail={"code": "invalid-timeframe", "message": timeframe})
    component = "ohlc"
    operation_name = f"Reading {symbol} {timeframe}"
    token = heartbeat.begin(component, operation_name)
    started = perf_counter()
    older = start_pos > 0 or before is not None
    try:
        page = mt5_worker.submit(
            f"ohlc-trend:{symbol}:{timeframe}" if trend_alert else "ohlc-history" if older else "ohlc-live",
            "ohlc",
            {
                "symbol": symbol,
                "timeframe": timeframe,
                "start_pos": start_pos,
                "count": count,
                "before": before,
            },
            priority=6 if trend_alert else 8 if older else 1,
            supersede=not trend_alert,
        )
    except Exception as error:
        heartbeat.fail(component, token, str(error))
        raise bridge_error(error) from error
    bars = page["bars"]
    duration = heartbeat.succeed(component, token, len(bars))
    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "bars": bars,
        "start_pos": page["start_pos"],
        "next_start_pos": page["next_start_pos"],
        "has_older": page["has_older"],
        "next_before": page.get("next_before"),
        "observed_at": utc_milliseconds(),
        "duration_ms": max(duration, round((perf_counter() - started) * 1000)),
        "source_generation": mt5_worker.snapshot()["generation"],
    }


CandleTimeframe = Literal["M1", "M5", "M15", "M30", "H1", "H4", "D1"]
CandleStart = Annotated[int, Query(ge=1, le=253402214399)]


@app.get("/api/v1/candle-ticks")
async def get_candle_ticks(
    request: Request,
    symbol: Annotated[str, Query(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._#-]+$")],
    timeframe: CandleTimeframe,
    start: CandleStart,
) -> dict[str, object]:
    return await read_candle_ticks(request, symbol, timeframe, start)


@app.get("/api/v1/candle-tick-history")
async def get_candle_tick_history(
    request: Request,
    symbol: Annotated[str, Query(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._#-]+$")],
    timeframe: CandleTimeframe,
    start: Annotated[list[CandleStart], Query(min_length=1, max_length=MAX_TICK_HISTORY_CANDLES)],
) -> dict[str, object]:
    step = STEPS[timeframe]
    candles = sorted(set(start))
    if candles[-1] - candles[0] + step > max(step, MAX_TICK_HISTORY_SECONDS):
        raise HTTPException(status_code=422, detail="Tick history requires one bounded candle window")
    return await read_candle_ticks(request, symbol, timeframe, candles[0], candles)


async def read_candle_ticks(request, symbol, timeframe, start, history=None):
    arguments = dict(symbol=symbol, timeframe=timeframe, start=start, read_id=uuid4().hex, begin=True, history=history)
    priority = 7 if history is None else 9
    try:
        while not await request.is_disconnected():
            reading = await run_in_threadpool(
                mt5_worker.submit, "candle-ticks", "candle-ticks", arguments, priority=priority, supersede=False,
            )
            if reading is not None:
                return reading
            arguments["begin"] = False
    except Exception as error:
        raise bridge_error(error) from error
    raise HTTPException(status_code=499, detail="Candle tick read cancelled")


def read_volume_profile_page(symbol, start, end, generation):
    if mt5_worker.snapshot()["generation"] != generation:
        raise Mt5UnavailableError("MT5 session changed during the volume profile read")
    result = mt5_worker.submit("volume-profile", "volume-profile", dict(symbol=symbol, start=start, end=end),
                               priority=10, supersede=False)
    if mt5_worker.snapshot()["generation"] != generation:
        raise Mt5UnavailableError("MT5 session changed during the volume profile read")
    return result


@app.get("/api/v1/volume-profile")
def get_volume_profile(
    symbol: Annotated[str, Query(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._#-]+$")],
    start: CandleStart,
    end: CandleStart,
) -> dict[str, object]:
    if not 0 < end - start <= MAX_PROFILE_PAGE_SECONDS or start % 60 or end % 60:
        raise HTTPException(status_code=422, detail="Volume profile requires a minute-aligned window of at most one day")
    generation = mt5_worker.snapshot()["generation"]
    try:
        result = read_volume_profile_page(symbol, start, end, generation)
    except Exception as error:
        raise bridge_error(error) from error
    return {**result, "source_generation": generation}


@app.get("/api/v1/volume-profile/range")
async def get_volume_profile_range(
    request: Request,
    symbol: Annotated[str, Query(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._#-]+$")],
    start: CandleStart,
    end: CandleStart,
    broker_offset: Annotated[int, Query(ge=-50_400, le=50_400)] = 0,
    retry: bool = False,
) -> StreamingResponse:
    day = MAX_PROFILE_PAGE_SECONDS
    today = (int(time()) + broker_offset) // day * day
    if not start < end <= today or start % 60 or end % 60:
        raise HTTPException(status_code=422, detail="Historical profiles require completed dates and minute-aligned bounds")
    source = mt5_worker.snapshot()
    if not source["connected"] or source["account_login"] is None:
        raise bridge_error(Mt5UnavailableError("MT5 account is unavailable"))
    generation = source["generation"]
    scope = (source["account_server"], source["account_login"], symbol)

    def prepare():
        cached = volume_profile_cache.read(scope, start, end, retry)
        return ProfileHistory(start, end, cached)

    def read_calendar():
        return mt5_worker.submit("volume-profile", "volume-profile-days", dict(symbol=symbol, start=start, end=end),
                                 priority=10, supersede=False)

    def read_and_save(first, stop, known_day, empty_page):
        if empty_page is None:
            page = read_volume_profile_page(symbol, first, stop, generation)
            if known_day and not page["levels"] and page["missing_minutes"] == 0:
                page["missing_minutes"] = None
        else:
            page = empty_page
        # Commit in the same operation as the read so switching the chart
        # cannot discard a day that finished loading while the request closed.
        volume_profile_cache.write_day(scope, first, stop, page, confirmed_empty=empty_page is not None)
        return page

    def frame(history, done):
        return json.dumps(history.snapshot(generation, done=done), separators=(",", ":")) + "\n"

    async def stream():
        history = await run_in_threadpool(prepare)
        if not history.pending:
            yield await run_in_threadpool(frame, history, True)
            return
        yield await run_in_threadpool(frame, history, False)
        calendar = None
        if len(history.pending) >= 7 and not await request.is_disconnected():
            try:
                calendar = await run_in_threadpool(read_calendar)
            except Exception:
                pass
        dates = calendar["days"] if calendar else []
        trading_days = set(dates)
        empty = dict(digits=calendar["digits"], missing_minutes=0, levels=[]) if dates else None
        last_update = monotonic() - 1
        for first, stop in history.pending:
            if await request.is_disconnected() or mt5_worker.snapshot()["generation"] != generation:
                return
            try:
                closed_day = stop - first == day and dates and dates[0] <= first <= dates[-1] and first not in trading_days
                known_day = first in trading_days and stop - first == day
                page = await run_in_threadpool(read_and_save, first, stop, known_day, empty if closed_day else None)
            except Mt5UnavailableError:
                # Leave the remaining days unprocessed so a resumed range can retry.
                history.incomplete = True
                yield await run_in_threadpool(frame, history, True)
                return
            except Exception:
                page = None
            history.add(page)
            if monotonic() - last_update >= 1:
                yield await run_in_threadpool(frame, history, False)
                last_update = monotonic()
        yield await run_in_threadpool(frame, history, True)

    return StreamingResponse(stream(), media_type="application/x-ndjson")


@app.get("/api/v1/currency-activity")
def get_currency_activity(timeframe: CandleTimeframe, start: CandleStart) -> dict[str, object]:
    try:
        rows = mt5_worker.submit(
            "currency-activity", "currency-activity", dict(timeframe=timeframe, start=start), priority=7, supersede=False,
        )
    except Exception as error:
        raise bridge_error(error) from error
    return {"rows": rows}


@app.get("/api/v1/calendar")
def get_calendar() -> dict[str, object]:
    return calendar_store.events()


@app.post("/api/v1/calendar/ingest")
def ingest_calendar(payload: CalendarIngestPayload) -> dict[str, object]:
    component = "calendar"
    token = heartbeat.begin(component, f"Receiving calendar {payload.kind}")
    try:
        result = calendar_store.ingest(payload.model_dump())
    except ValueError as error:
        heartbeat.fail(component, token, str(error))
        raise HTTPException(status_code=409, detail={"code": "calendar-transfer-invalid", "message": str(error)}) from error
    heartbeat.succeed(component, token, int(result["event_count"]))
    return result
