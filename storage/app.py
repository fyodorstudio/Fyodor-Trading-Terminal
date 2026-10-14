from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse

from .bridge_collector import BridgeCollector
from .calendar_store import CalendarStore
from .currencies import CURRENCIES
from .contracts import BackfillChunk, BackfillFailure, PublisherContext
from .data_lock import data_lock
from .research_reports import ResearchRequest, save_report
from .highlights import HIGHLIGHTS_PATH, HighlightRequest, pin_release, delete_pin, archive_pin, highlight_snapshot
from .highlight_metadata import limitations_snapshot
from .external_sources import DIRECTORY, ExternalRequest, LifecycleRequest, external_snapshot, external_history, append_external, archive_external

# The eight-currency Alert catalog exceeds the original pair-only 64-series cap.
# Keep a bound below SQLite's conservative 999-parameter limit, including dates.
MAX_CALENDAR_SERIES = 512


def data_directory():
    return Path(os.environ.get("FYODOR_STORAGE_DATA_DIR", Path(__file__).resolve().parent / "data")).resolve()


def create_app(directory=None, run_collector=True, highlights_path=HIGHLIGHTS_PATH, external_directory=DIRECTORY):
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

    @app.post("/api/v1/reports")
    def research_report(request: ResearchRequest):
        try:
            return save_report(app.state.store, request)
        except OSError as error:
            raise HTTPException(503, "Could not save the report; check the report folder's permissions") from error

    @app.get('/api/v1/highlights')
    def highlights(source_id: str = Query(min_length=1, max_length=160), after_revision: str | None = Query(default=None, max_length=100),
                   visibility: str = Query(default='active', pattern='^(active|archived|all)$')):
        try:
            return highlight_snapshot(app.state.store, source_id, highlights_path, after_revision, persist_related=True, visibility=visibility)
        except OSError as error:
            raise HTTPException(503, 'Highlight storage unavailable') from error

    @app.post('/api/v1/highlights')
    def add_highlight(request: HighlightRequest):
        try:
            return pin_release(app.state.store, request, highlights_path)
        except OSError as error:
            raise HTTPException(503, 'Could not save Highlight') from error

    @app.delete('/api/v1/highlights/{identity}')
    def remove_highlight(identity: str, source_id: str = Query(min_length=1, max_length=160)):
        try:
            return delete_pin(identity, source_id, highlights_path, app.state.store)
        except OSError as error:
            raise HTTPException(503, 'Could not archive Highlight') from error

    @app.post('/api/v1/highlights/{identity}/archive')
    def archive_highlight(identity: str, source_id: str = Query(min_length=1, max_length=160)):
        try:
            return archive_pin(identity, source_id, highlights_path, app.state.store)
        except OSError as error:
            raise HTTPException(503, 'Could not archive Highlight') from error

    @app.post('/api/v1/highlights/{identity}/restore')
    def restore_highlight(identity: str, source_id: str = Query(min_length=1, max_length=160)):
        try:
            return archive_pin(identity, source_id, highlights_path, app.state.store, restore=True)
        except OSError as error:
            raise HTTPException(503, 'Could not restore Highlight') from error

    @app.get('/api/v1/highlight-limitations')
    def highlight_limitations(source_id: str = Query(min_length=1, max_length=160),
                              after_revision: str | None = Query(default=None, max_length=100)):
        try:
            return limitations_snapshot(source_id, highlights_path, after_revision)
        except OSError as error:
            raise HTTPException(503, 'Discovered limitations unavailable') from error

    @app.get('/api/v1/external-sources')
    def external_sources(after_revision: str | None = Query(default=None, max_length=100),
                         visibility: str = Query(default='active', pattern='^(active|archived|all)$'),
                         scope: str = Query(default='all', max_length=6),
                         limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0)):
        try:
            return external_snapshot(external_directory, after_revision, visibility, scope, limit=limit, offset=offset)
        except OSError as error:
            raise HTTPException(503, 'External Sources unavailable') from error

    @app.get('/api/v1/external-sources/{key}')
    def external_versions(key: str):
        try:
            return {'key': key, 'items': external_history(key, external_directory)}
        except OSError as error:
            raise HTTPException(503, 'External Sources unavailable') from error

    @app.post('/api/v1/external-sources')
    def save_external(request: ExternalRequest):
        try:
            return append_external(request, external_directory)
        except OSError as error:
            raise HTTPException(503, 'Could not save External Source') from error

    @app.post('/api/v1/external-sources/{key}/{action}')
    def external_lifecycle(key: str, action: str, request: LifecycleRequest):
        if action not in ('archive', 'restore'):
            raise HTTPException(404, 'Unknown External Source action')
        try:
            return archive_external(key, request.expected_version, external_directory, restore=action == 'restore')
        except OSError as error:
            raise HTTPException(503, 'Could not update External Source') from error

    return app


app = create_app()
