from __future__ import annotations

import os
import subprocess
from contextlib import asynccontextmanager
from datetime import date as Date
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .bridge_collector import BridgeCollector
from .calendar_store import CalendarStore
from .currencies import CURRENCIES
from .contracts import BackfillChunk, BackfillFailure, PublisherContext
from .data_lock import data_lock
from .alert_calendar import day_snapshot
from .recent_calendar import recent_snapshot
from .detail_registry import resolve_scope
from .currency_ledger import ledger_snapshot
from .market_watch_daily import DailyMarketWatch
from .heatmap import HeatmapHistory
from .heatmap_intraday import HeatmapIntraday
from .wildcards import WildcardChange, WildcardEntry, wildcard_snapshot, change_wildcard
from .fed_forecasts import read_forecasts


class DailyMarketRequest(BaseModel):
    source_id: str = Field(min_length=1, max_length=160)
    generation: int = Field(ge=0)
    symbols: list[str] = Field(max_length=5000)
    selected: str = Field(default='', max_length=128)
    date: Date | None = None
    retry: bool = False


class HeatmapRequest(BaseModel):
    source_id: str = Field(min_length=1, max_length=160)
    generation: int = Field(ge=0)
    symbols: list[str] = Field(max_length=128)
    year: int = Field(ge=2015, le=2100)
    retry: bool = False

class HeatmapIntradayRequest(BaseModel):
    source_id: str = Field(min_length=1, max_length=160)
    generation: int = Field(ge=0)
    symbols: list[str] = Field(max_length=128)
    from_utc: int = Field(ge=1420070400)
    through_utc: int = Field(ge=1420070400)
    retry: bool = False


# The eight-currency Alert catalog exceeds the original pair-only 64-series cap.
# Keep a bound below SQLite's conservative 999-parameter limit, including dates.
MAX_CALENDAR_SERIES = 512


def data_directory():
    return Path(os.environ.get("FYODOR_STORAGE_DATA_DIR", Path(__file__).resolve().parent / "data")).resolve()


def create_app(directory=None, run_collector=True):
    @asynccontextmanager
    async def lifespan(app):
        with data_lock(directory or data_directory()):
            app.state.store = CalendarStore((directory or data_directory()) / "calendar.sqlite3")
            app.state.collector = BridgeCollector(app.state.store)
            if run_collector:
                app.state.collector.start()
            try:
                yield
            finally:
                app.state.collector.stop()
                app.state.store.close()

    app = FastAPI(title="Fyodor Calendar Storage", version="1.1.0", lifespan=lifespan)
    daily_market = DailyMarketWatch()
    heatmap = HeatmapHistory()
    heatmap_intraday = HeatmapIntraday()
    wildcard_root = directory or data_directory()

    @app.get('/api/v1/wildcards')
    def wildcards():
        try:
            return wildcard_snapshot(wildcard_root)
        except (ValueError, OSError, KeyError, TypeError) as error:
            raise HTTPException(503, 'Could not load Wildcards; saved entries are preserved') from error

    def change(request=None, identity=None, delete=False, revision=0):
        try:
            entry = WildcardEntry.model_validate(request.model_dump(exclude={'expected_revision'})) if request else None
            return change_wildcard(wildcard_root, request.expected_revision if request else revision, entry, identity, delete)
        except (ValueError, OSError, KeyError, TypeError) as error:
            raise HTTPException(503, 'Could not save Wildcards; your draft is preserved') from error

    @app.post('/api/v1/wildcards')
    def add_wildcard(request: WildcardChange):
        return change(request)

    @app.put('/api/v1/wildcards/{identity}')
    def edit_wildcard(identity: str, request: WildcardChange):
        return change(request, identity)

    @app.delete('/api/v1/wildcards/{identity}')
    def delete_wildcard(identity: str, expected_revision: int = Query(ge=0)):
        return change(identity=identity, delete=True, revision=expected_revision)

    @app.get('/api/v1/fed-forecasts')
    def fed_forecasts():
        try:
            return read_forecasts((directory or data_directory()) / 'fed-forecasts')
        except (ValueError, OSError, KeyError) as error:
            raise HTTPException(503, 'Fed forecasts unavailable; saved evidence is preserved') from error

    @app.get('/api/v1/currency-ledger')
    def currency_ledger(source_id: str = Query(min_length=1, max_length=160),
                        after_revision: str | None = Query(default=None, max_length=64),
                        year: int | None = Query(default=None, ge=2015, le=2100),
                        scope: str = Query(default='USDCAD',max_length=128)):
        try:
            return ledger_snapshot(app.state.store, source_id, after_revision, year=year, currencies=resolve_scope(scope))
        except ValueError as error:
            raise HTTPException(422, str(error)) from error

    @app.post('/api/v1/market-watch/daily')
    def market_watch_daily(request: DailyMarketRequest):
        if any(not symbol or len(symbol) > 128 for symbol in request.symbols):
            raise HTTPException(422, 'Invalid symbol')
        try:
            return daily_market.snapshot(request.source_id, request.generation, request.symbols, request.selected, request.date, request.retry)
        except (ValueError, OSError, subprocess.TimeoutExpired) as error:
            raise HTTPException(503, 'Pepperstone daily candles unavailable') from error

    @app.post('/api/v1/heatmap/intraday')
    def intraday_history(request: HeatmapIntradayRequest):
        try:
            return heatmap_intraday.snapshot(request.source_id, request.generation, request.symbols,
                request.from_utc, request.through_utc, request.retry)
        except (ValueError, OSError, subprocess.TimeoutExpired) as error:
            raise HTTPException(503, 'Intraday history unavailable: ' + str(error)) from error

    @app.post('/api/v1/heatmap/history')
    def heatmap_history(request: HeatmapRequest):
        if any(not s or len(s) > 128 for s in request.symbols):
            raise HTTPException(422, 'Invalid heatmap symbol')
        try:
            return heatmap.snapshot(request.source_id, request.generation, request.symbols, request.year, request.retry)
        except (ValueError, OSError, subprocess.TimeoutExpired) as error:
            raise HTTPException(503, 'Heatmap history unavailable; connect the matching Pepperstone terminal and retry') from error

    @app.exception_handler(ValueError)
    async def invalid_transfer(_, error):
        return JSONResponse(status_code=409, content={"detail": {"code": "storage-invalid-transfer", "message": str(error)}})

    @app.get("/api/v1/health")
    def health():
        return {**app.state.store.status(), "collector_error": app.state.collector.error}

    @app.post("/api/v1/publisher")
    def register(context: PublisherContext):
        app.state.store.register(context)
        return {"accepted": True}

    @app.post("/api/v1/jobs/next")
    def next_job(context: PublisherContext):
        return app.state.store.next_job(context)

    @app.post("/api/v1/jobs/chunk")
    def chunk(payload: BackfillChunk):
        return app.state.store.receive(payload)

    @app.post("/api/v1/jobs/fail")
    def fail(payload: BackfillFailure):
        return app.state.store.fail(payload)

    @app.get("/api/v1/calendar")
    def calendar(source_id: str = Query(min_length=1, max_length=160),
                 from_server_seconds: int = Query(ge=0), to_server_seconds: int = Query(ge=0),
                 currency: str | None = Query(default=None, pattern="^(" + "|".join(CURRENCIES) + ")$"),
                 currencies: str | None = Query(default=None, pattern=r"^[A-Z]{3}(,[A-Z]{3}){0,7}$"),
                 limit: int = Query(default=1000, ge=1, le=5000),
                 after_time: int | None = Query(default=None, ge=0), after_id: str | None = Query(default=None, max_length=32),
                 time_basis: str = Query(default="raw", pattern="^(raw|chart)$"),
                 r1_as_of: int | None = Query(default=None, ge=0),
                 r1_history: bool = False,
                 event_ids: str | None = Query(default=None, max_length=21 * MAX_CALENDAR_SERIES - 1,
                                              pattern=rf"^[0-9]{{1,20}}(,[0-9]{{1,20}}){{0,{MAX_CALENDAR_SERIES - 1}}}$")):
        if from_server_seconds >= to_server_seconds or (after_time is None) != (after_id is None):
            raise HTTPException(status_code=422, detail="Invalid date interval or incomplete cursor")
        selected = currencies.split(",") if currencies else None
        if selected and (currency or len(set(selected)) != len(selected) or any(item not in CURRENCIES for item in selected)):
            raise HTTPException(status_code=422, detail="Invalid currency scope")
        return app.state.store.query(source_id, from_server_seconds, to_server_seconds, currency, limit,
                                     after_time, after_id, time_basis, event_ids.split(",") if event_ids else None, r1_as_of, r1_history, selected)

    @app.get('/api/v1/alert-calendar')
    def alert_calendar(source_id: str = Query(min_length=1, max_length=160), date: str = Query(pattern=r'^\d{4}-\d{2}-\d{2}$'),
                       after_revision: str | None = Query(default=None, max_length=100)):
        try:
            return day_snapshot(app.state.store, source_id, date, after_revision)
        except ValueError as error:
            raise HTTPException(422, 'Invalid calendar date') from error

    @app.get('/api/v1/recent-calendar')
    def recent_calendar(source_id: str = Query(min_length=1, max_length=160),
                        from_utc_ms: int = Query(ge=0), to_utc_ms: int = Query(ge=0),
                        currencies: str = Query(pattern=r'^[A-Z]{3}(,[A-Z]{3}){0,7}$')):
        selected = currencies.split(',')
        if (not 0 < to_utc_ms - from_utc_ms <= 31 * 86400000
                or len(set(selected)) != len(selected) or any(item not in CURRENCIES for item in selected)):
            raise HTTPException(422, 'Invalid recent calendar interval or currency scope')
        return recent_snapshot(app.state.store, source_id, from_utc_ms, to_utc_ms, selected)

    return app


app = create_app()
