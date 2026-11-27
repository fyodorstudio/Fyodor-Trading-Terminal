import asyncio
from dataclasses import asdict, dataclass, field
from itertools import combinations
from sqlite3 import Error as DatabaseError
from time import time

from fastapi.concurrency import run_in_threadpool

from .currency_indices import CURRENCIES, MEMBERS
from .mt5_worker import Mt5UnavailableError
from .volume_profile_history import DAY, fill_profile_slices

FX_PAIRS = tuple(combinations(CURRENCIES, 2))
PRELOAD_SYMBOL_GROUPS = {
    "Currency indices": ("USDX", "EURX", "JPYX", *MEMBERS),
    "Forex majors": tuple(base + quote for base, quote in FX_PAIRS if "USD" in (base, quote)),
    "Forex crosses": tuple(base + quote for base, quote in FX_PAIRS if "USD" not in (base, quote)),
}
PRELOAD_SYMBOLS = tuple(base + quote for base, quote in FX_PAIRS) + PRELOAD_SYMBOL_GROUPS["Currency indices"]
PRELOAD_PRIORITY = 20


def account_scope(source):
    return source["account_server"], source["account_login"]


@dataclass
class PreloadJob:
    symbols: tuple
    start: int | None
    end: int
    broker_offset: int | None = None
    catchup_start: int | None = None
    state: str = "running"
    completed: int = 0
    chunk: int = 0
    total_chunks: int = 0
    symbol_start: int | None = None
    symbol_first_bar: int | None = None
    symbol_incomplete: bool = False
    first_candles: dict = field(default_factory=dict)
    incomplete_symbols: list = field(default_factory=list)
    unavailable_symbols: list = field(default_factory=list)
    message: str | None = None
    timeout_seconds: int | None = None

    def snapshot(self):
        return {
            "state": self.state, "start": self.start, "end": self.end,
            "symbol": self.symbols[self.completed] if self.completed < len(self.symbols) else None,
            "completed_symbols": self.completed, "total_symbols": len(self.symbols),
            "completed_chunks": self.chunk, "total_chunks": self.total_chunks,
            "symbol_start": self.symbol_start, "available_symbols": len(self.first_candles),
            "first_candles": dict(self.first_candles), "unavailable_symbols": list(self.unavailable_symbols),
            "incomplete_symbols": list(self.incomplete_symbols), "message": self.message,
        }

    def finish_symbol(self, symbol):
        if self.symbol_first_bar is None:
            if symbol not in self.first_candles and symbol not in self.unavailable_symbols:
                self.unavailable_symbols.append(symbol)
        else:
            self.first_candles[symbol] = min(self.first_candles.get(symbol, self.symbol_first_bar), self.symbol_first_bar)
            if symbol in self.unavailable_symbols:
                self.unavailable_symbols.remove(symbol)
        if self.symbol_incomplete and symbol not in self.incomplete_symbols:
            self.incomplete_symbols.append(symbol)
        self.completed += 1
        self.chunk = self.total_chunks = 0
        self.symbol_start = self.symbol_first_bar = None
        self.symbol_incomplete = False


class VolumeProfilePreload:
    def __init__(self, cache, read_ticks):
        self.cache = cache
        self.read_ticks = read_ticks
        self.scope = None
        self.job = None
        self.task = None

    def restore(self, source):
        scope = account_scope(source)
        if not all(scope):
            return None
        if scope == self.scope:
            return self.job
        if self.task is not None and not self.task.done():
            return None
        self.scope, self.job = scope, None
        try:
            state = self.cache.read_job(scope)
            if state:
                self.job = PreloadJob(**state)
                if self.job.state == "running":
                    self.job.state, self.job.message = "paused", "Resume the saved preload"
        except (OSError, DatabaseError, TypeError, ValueError):
            pass
        return self.job

    def checkpoint(self, job):
        try:
            self.cache.save_job(self.scope, asdict(job))
        except (OSError, DatabaseError):
            job.message = "Could not save the preload position"

    def status(self, source):
        job = self.restore(source)
        return job.snapshot() if job is not None else None

    def start(self, worker, source, symbols, start, end, broker_offset=None, timeout_seconds=None):
        if self.task is not None and not self.task.done():
            raise ValueError("A preload is running or finishing its current batch")
        if self.status(source) and self.job.state == "paused":
            raise ValueError("Resume or cancel the paused preload first")
        self.scope = account_scope(source)
        self.job = PreloadJob(symbols, start, end, broker_offset, timeout_seconds=timeout_seconds)
        self.checkpoint(self.job)
        self.task = asyncio.create_task(self.run(worker, self.job, self.scope))
        return self.job.snapshot()

    def control(self, worker, source, action, timeout_seconds=None):
        job = self.restore(source)
        if job is None:
            raise ValueError("There is no preload for this MT5 account")
        if action == "pause" and job.state == "running":
            job.state = "paused"
        elif action == "resume" and job.state == "paused":
            if not source["connected"]:
                raise ValueError("Connect MT5 to resume the preload")
            job.timeout_seconds = timeout_seconds
            job.state, job.message = "running", None
            if self.task is None or self.task.done():
                self.task = asyncio.create_task(self.run(worker, job, self.scope))
        elif action == "cancel" and job.state in ("running", "paused"):
            job.state, job.message = "cancelled", None
        else:
            raise ValueError(f"Cannot {action} a {job.state} preload")
        self.checkpoint(job)
        return job.snapshot()

    async def run(self, worker, job, scope):
        calendar = None
        while job.state == "running" and job.completed < len(job.symbols):
            current = worker.snapshot()
            if not current["connected"] or account_scope(current) != scope:
                job.state, job.message = "paused", "MT5 disconnected or switched accounts"
                break
            symbol = job.symbols[job.completed]
            timeout = {"adapter_timeout": job.timeout_seconds} if job.timeout_seconds is not None else {}
            try:
                if calendar is None:
                    start = job.catchup_start if job.catchup_start is not None else job.start
                    result = await run_in_threadpool(worker.submit, "volume-profile", "volume-profile-days",
                        dict(symbol=symbol, start=start or 0, end=job.end),
                        priority=PRELOAD_PRIORITY, supersede=False, **timeout)
                    if job.state != "running":
                        break
                    if worker.snapshot()["generation"] != current["generation"]:
                        raise Mt5UnavailableError("MT5 session changed during history discovery")
                    dates, digits = result["days"], result["digits"]
                    if not dates:
                        job.finish_symbol(symbol)
                        self.checkpoint(job)
                        continue
                    calendar = set(dates), min(dates), max(dates), digits
                    if job.symbol_start is None:
                        job.symbol_start = start if start is not None else min(dates)
                        job.total_chunks = (job.end - 1) // DAY - job.symbol_start // DAY + 1
                    if job.total_chunks <= 0:
                        job.finish_symbol(symbol)
                        calendar = None
                        self.checkpoint(job)
                        continue
                days, first, last, digits = calendar
                day = ((job.end - 1) // DAY - job.chunk) * DAY
                stop = min(day + DAY, job.end)
                closed = first <= day <= last and day not in days
                scope_for_symbol = (*scope, symbol)
                def load(start, end):
                    try:
                        return self.read_ticks(symbol, start, end, current["generation"], priority=PRELOAD_PRIORITY, slices=True, **timeout)
                    except Mt5UnavailableError:
                        raise
                    except RuntimeError:
                        missing = list(range(start, end, 60))
                        return dict(digits=digits, levels=[], missing_minutes=len(missing), slices=[], missing_slices=missing)
                _, _, minutes, gaps = await run_in_threadpool(fill_profile_slices, self.cache, scope_for_symbol,
                    day, stop, load, empty_digits=digits if closed else None, require_cache=True)
                if minutes:
                    earliest = minutes[0][0]
                    job.symbol_first_bar = earliest if job.symbol_first_bar is None else min(job.symbol_first_bar, earliest)
                job.symbol_incomplete |= gaps is None or bool(gaps)
            except Mt5UnavailableError as error:
                if job.state != "cancelled":
                    job.state, job.message = "paused", f"{error}. Resume to retry."
                break
            except (OSError, DatabaseError):
                if job.state != "cancelled":
                    job.state, job.message = "paused", "Could not save the tick cache. Resume to retry."
                break
            except Exception:
                if calendar is None:
                    if job.state == "running":
                        job.state, job.message = "paused", f"Could not find the tick history for {symbol}. Resume to retry."
                    break
                job.symbol_incomplete = True
            job.chunk += 1
            if job.chunk == job.total_chunks:
                job.finish_symbol(symbol)
                calendar = None
            self.checkpoint(job)
        if job.state == "running":
            if job.broker_offset is not None and job.catchup_start is None:
                now = (int(time()) + job.broker_offset) // 60 * 60
                if now > job.end:
                    job.catchup_start = job.end // DAY * DAY
                    job.end, job.completed = now, 0
                    job.message = "Catching up on ticks collected during the preload"
                    self.checkpoint(job)
                    await self.run(worker, job, scope)
                    return
            job.state = "complete"
            job.message = None
        self.checkpoint(job)

    async def stop(self):
        if self.task is not None and not self.task.done():
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
