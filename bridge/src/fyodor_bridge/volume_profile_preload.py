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
    start: int | None
    end: int
    chunks: tuple = ()
    state: str = "running"
    completed: int = 0
    chunk: int = 0
    symbol_start: int | None = None
    symbol_first_bar: int | None = None
    symbol_incomplete: bool = False
    discovered: dict = field(default_factory=dict)
    first_candles: dict = field(default_factory=dict)
    incomplete_symbols: list = field(default_factory=list)
    unavailable_symbols: list = field(default_factory=list)
    message: str | None = None

    def snapshot(self):
        return {
            "state": self.state, "start": self.start, "end": self.end,
            "symbol": self.symbols[self.completed] if self.completed < len(self.symbols) else None,
            "completed_symbols": self.completed, "total_symbols": len(self.symbols),
            "completed_chunks": self.chunk, "total_chunks": len(self.chunks),
            "symbol_start": self.symbol_start, "available_symbols": len(self.first_candles),
            "first_candles": dict(self.first_candles), "unavailable_symbols": list(self.unavailable_symbols),
            "incomplete_symbols": list(self.incomplete_symbols), "message": self.message,
        }

    def finish_symbol(self, symbol):
        if self.symbol_first_bar is None:
            self.unavailable_symbols.append(symbol)
        else:
            self.first_candles[symbol] = self.symbol_first_bar
            if self.symbol_incomplete:
                self.incomplete_symbols.append(symbol)
        self.completed += 1
        self.chunk = 0
        self.chunks = ()
        self.symbol_start = None
        self.symbol_first_bar = None
        self.symbol_incomplete = False


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
        self.job = PreloadJob(account_scope(source), symbols, start, end)
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
            try:
                if not job.chunks:
                    start = job.start
                    if start is None:
                        start = await run_in_threadpool(self.profiles.earliest, worker, current, symbol, job.end,
                                                        job.discovered, PRELOAD_PRIORITY)
                    if start is None or start >= job.end:
                        job.finish_symbol(symbol)
                        continue
                    job.symbol_start = start
                    job.chunks = tuple(reversed(chunk_starts(start, job.end)))
                    if job.state != "running":
                        break
                first = job.chunks[job.chunk]
                page = await run_in_threadpool(self.profiles.load_chunk, worker, current, symbol,
                                               first, job.end, PRELOAD_PRIORITY)
                head = min((at for at, _, _ in page["bars"] if job.symbol_start <= at < job.end), default=None)
                if head is not None:
                    job.symbol_first_bar = head if job.symbol_first_bar is None else min(job.symbol_first_bar, head)
                job.symbol_incomplete |= overlaps_gap(page, max(job.symbol_start, first), job.end)
            except Mt5UnavailableError:
                if job.state != "cancelled":
                    job.state, job.message = "paused", "MT5 could not finish the current batch. Resume to retry."
                return
            except Exception:
                if not job.chunks:
                    if job.state == "running":
                        job.state, job.message = "paused", f"Could not find the first H1 candle for {symbol}. Resume to retry."
                    return
                job.symbol_incomplete = True
            job.chunk += 1
            if job.chunk == len(job.chunks):
                job.finish_symbol(symbol)
        if job.state == "running":
            job.state = "complete"

    async def stop(self):
        if self.task is not None and not self.task.done():
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
