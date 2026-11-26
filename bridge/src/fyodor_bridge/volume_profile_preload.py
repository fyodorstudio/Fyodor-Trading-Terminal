import asyncio
from dataclasses import dataclass, field
from itertools import combinations

from fastapi.concurrency import run_in_threadpool

from .currency_indices import CURRENCIES, MEMBERS
from .hourly_profile_cache import account_scope, chunk_starts, overlaps_gap
from .mt5_worker import Mt5UnavailableError

PRELOAD_SYMBOLS = tuple(base + quote for base, quote in combinations(CURRENCIES, 2)) + ("USDX", "EURX", "JPYX", *MEMBERS)
PRELOAD_PRIORITY = 20


@dataclass
class PreloadJob:
    scope: tuple
    symbols: tuple
    start: int
    end: int
    chunks: tuple
    state: str = "running"
    completed: int = 0
    chunk: int = 0
    symbol_has_bars: bool = False
    symbol_incomplete: bool = False
    incomplete_symbols: list = field(default_factory=list)
    message: str | None = None

    def snapshot(self):
        return {
            "state": self.state, "start": self.start, "end": self.end,
            "symbol": self.symbols[self.completed] if self.completed < len(self.symbols) else None,
            "completed_symbols": self.completed, "total_symbols": len(self.symbols),
            "completed_chunks": self.chunk, "total_chunks": len(self.chunks),
            "incomplete_symbols": list(self.incomplete_symbols), "message": self.message,
        }


class VolumeProfilePreload:
    def __init__(self, profiles):
        self.profiles = profiles
        self.job = None
        self.task = None

    def status(self, source):
        if self.job is None or self.job.scope != account_scope(source):
            return None
        return self.job.snapshot()

    def start(self, worker, source, symbols, start, end):
        if self.task is not None and not self.task.done():
            raise ValueError("A preload is running or finishing its current batch")
        if self.status(source) and self.job.state == "paused":
            raise ValueError("Resume or cancel the paused preload first")
        chunks = tuple(reversed(chunk_starts(start, end)))
        self.job = PreloadJob(account_scope(source), symbols, start, end, chunks)
        self.task = asyncio.create_task(self.run(worker, self.job))
        return self.job.snapshot()

    def control(self, worker, source, action):
        if self.status(source) is None:
            raise ValueError("There is no preload for this MT5 account")
        job = self.job
        if action == "pause" and job.state == "running":
            job.state = "paused"
        elif action == "resume" and job.state == "paused":
            if not source["connected"]:
                raise ValueError("Connect MT5 to resume the preload")
            job.state, job.message = "running", None
            if self.task is None or self.task.done():
                self.task = asyncio.create_task(self.run(worker, job))
        elif action == "cancel" and job.state in ("running", "paused"):
            job.state, job.message = "cancelled", None
        else:
            raise ValueError(f"Cannot {action} a {job.state} preload")
        return job.snapshot()

    async def run(self, worker, job):
        while job.state == "running" and job.completed < len(job.symbols):
            current = worker.snapshot()
            if not current["connected"] or account_scope(current) != job.scope:
                job.state, job.message = "paused", "MT5 disconnected or switched accounts"
                return
            symbol = job.symbols[job.completed]
            first = job.chunks[job.chunk]
            try:
                page = await run_in_threadpool(self.profiles.load_chunk, worker, current, symbol,
                                               first, job.end, PRELOAD_PRIORITY)
                job.symbol_has_bars |= any(job.start <= bar[0] < job.end for bar in page["bars"])
                job.symbol_incomplete |= overlaps_gap(page, max(job.start, first), job.end)
            except Mt5UnavailableError:
                if job.state != "cancelled":
                    job.state, job.message = "paused", "MT5 could not finish the current batch. Resume to retry."
                return
            except Exception:
                job.symbol_incomplete = True
            job.chunk += 1
            if job.chunk == len(job.chunks):
                if job.symbol_incomplete or not job.symbol_has_bars:
                    job.incomplete_symbols.append(symbol)
                job.completed += 1
                job.chunk = 0
                job.symbol_has_bars = False
                job.symbol_incomplete = False
        if job.state == "running":
            job.state = "complete"

    async def stop(self):
        if self.task is not None and not self.task.done():
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
