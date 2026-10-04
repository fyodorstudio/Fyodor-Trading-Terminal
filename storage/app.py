from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse

from .bridge_collector import BridgeCollector
from .calendar_store import CalendarStore
from .contracts import BackfillChunk, BackfillFailure, PublisherContext


def data_directory():
    return Path(os.environ.get("FYODOR_STORAGE_DATA_DIR", Path(__file__).resolve().parent / "data")).resolve()


def create_app(directory=None, run_collector=True):
    @asynccontextmanager
    async def lifespan(app):
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
                 currency: str | None = Query(default=None, pattern="^(EUR|USD)$"),
                 limit: int = Query(default=1000, ge=1, le=5000),
                 after_time: int | None = Query(default=None, ge=0), after_id: str | None = Query(default=None, max_length=32),
                 time_basis: str = Query(default="raw", pattern="^(raw|chart)$"),
                 event_ids: str | None = Query(default=None, max_length=1343,
                                              pattern=r"^[0-9]{1,20}(,[0-9]{1,20}){0,63}$")):
        if from_server_seconds >= to_server_seconds or (after_time is None) != (after_id is None):
            raise HTTPException(status_code=422, detail="Invalid date interval or incomplete cursor")
        return app.state.store.query(source_id, from_server_seconds, to_server_seconds, currency, limit,
                                     after_time, after_id, time_basis, event_ids.split(",") if event_ids else None)

    return app


app = create_app()
