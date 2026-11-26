from contextlib import closing, contextmanager
from threading import Lock
import json
import sqlite3
import zlib

from .currency_indices import INDEX_DIGITS, MEMBERS, SERVER, index_price
from .hourly_volume_profile import HOUR, HOURLY_PROFILE_PAGE_SECONDS as CHUNK, weighted_profile
from .mt5_worker import Mt5UnavailableError


def account_scope(source):
    return source["account_server"], source["account_login"]


def chunk_starts(start, end):
    return range(start // CHUNK * CHUNK, end, CHUNK) if start < end else ()


def overlaps_gap(page, start, end):
    return any(left < end and right > start for left, right in page["gaps"])


class HourlyProfiles:
    def __init__(self, path):
        self.path = path
        self.ready = False
        self.initialize = Lock()
        self.locks = tuple(Lock() for _ in range(32))
        # Index reads can load broker chunks, so the two lock sets stay separate.
        self.index_locks = tuple(Lock() for _ in range(16))

    @contextmanager
    def database(self):
        with self.initialize:
            if not self.ready:
                self.path.parent.mkdir(parents=True, exist_ok=True)
                with closing(sqlite3.connect(self.path)) as db:
                    db.execute("PRAGMA journal_mode=WAL")
                    db.executescript("""
                        CREATE TABLE IF NOT EXISTS hourly_chunks_v1 (
                            broker TEXT NOT NULL, login INTEGER NOT NULL, symbol TEXT NOT NULL,
                            start INTEGER NOT NULL, stop INTEGER NOT NULL, payload BLOB NOT NULL,
                            PRIMARY KEY (broker, login, symbol, start)
                        ) WITHOUT ROWID;
                        CREATE TABLE IF NOT EXISTS hourly_references_v1 (
                            broker TEXT NOT NULL, login INTEGER NOT NULL, symbol TEXT NOT NULL,
                            payload TEXT NOT NULL, PRIMARY KEY (broker, login, symbol)
                        ) WITHOUT ROWID;
                    """)
                self.ready = True
        with closing(sqlite3.connect(self.path)) as db:
            yield db

    def cached(self, scope, symbol, start):
        with self.database() as db:
            row = db.execute("""
                SELECT stop, payload FROM hourly_chunks_v1
                WHERE broker = ? AND login = ? AND symbol = ? AND start = ?
            """, (*scope, symbol, start)).fetchone()
        if row is None:
            return None
        try:
            return {**json.loads(zlib.decompress(row[1])), "stop": row[0]}
        except (ValueError, zlib.error):
            return None

    def store(self, scope, symbol, start, stop, page):
        payload = zlib.compress(json.dumps(page, separators=(",", ":")).encode(), level=1)
        with self.database() as db, db:
            db.execute("""
                INSERT INTO hourly_chunks_v1 (broker, login, symbol, start, stop, payload) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT (broker, login, symbol, start) DO UPDATE SET stop = excluded.stop, payload = excluded.payload
                WHERE excluded.stop >= hourly_chunks_v1.stop
            """, (*scope, symbol, start, stop, payload))

    def check_source(self, worker, source):
        current = worker.snapshot()
        if (not current["connected"] or current["generation"] != source["generation"]
                or account_scope(current) != account_scope(source)):
            raise Mt5UnavailableError("MT5 session changed during the hourly profile read")

    def read_mt5(self, worker, source, operation, arguments, priority):
        self.check_source(worker, source)
        result = worker.submit("volume-profile", operation, arguments, priority=priority, supersede=False)
        self.check_source(worker, source)
        return result

    def earliest(self, worker, source, symbol, end, known, priority):
        members = MEMBERS.get(symbol) if source["account_server"] == SERVER else None
        pairs = [pair for pair, _ in members] if members else [symbol]
        starts = []
        for pair in pairs:
            if pair not in known:
                known[pair] = self.read_mt5(worker, source, "volume-profile-hourly-first",
                                            {"symbol": pair, "end": end}, priority)
            starts.append(known[pair])
        # A basket can begin only after every constituent has H1 history.
        return None if None in starts else max(starts)

    def index_reference(self, worker, source, symbol, priority):
        key = (*account_scope(source), symbol)
        with self.database() as db:
            row = db.execute("""
                SELECT payload FROM hourly_references_v1 WHERE broker = ? AND login = ? AND symbol = ?
            """, key).fetchone()
        if row is not None:
            return json.loads(row[0])
        reference = self.read_mt5(worker, source, "volume-profile-hourly-reference", {"symbol": symbol}, priority)
        with self.database() as db, db:
            db.execute("INSERT OR IGNORE INTO hourly_references_v1 VALUES (?, ?, ?, ?)", (*key, json.dumps(reference)))
        return reference

    def load_chunk(self, worker, source, symbol, start, closed_until, priority=10, retry=False, through=None):
        scope = account_scope(source)
        stop = min(start + CHUNK, closed_until)
        needed = stop if through is None else min(stop, through)
        cached = self.cached(scope, symbol, start)
        if cached and cached["stop"] >= needed and not (retry and cached["gaps"]):
            return cached
        members = MEMBERS.get(symbol) if scope[0] == SERVER else None
        locks = self.index_locks if members else self.locks
        lock = locks[hash((*scope, symbol, start)) % len(locks)]

        with lock:
            cached = self.cached(scope, symbol, start)
            if cached and cached["stop"] >= needed and not (retry and cached["gaps"]):
                return cached
            # A retry can repair earlier gaps. Normal refreshes append only newly closed hours.
            first = cached["stop"] if cached and not (retry and cached["gaps"]) else start
            stop = max(stop, cached["stop"]) if cached else stop
            page = self.read_page(worker, source, symbol, members, first, stop, closed_until, priority, retry)
            if cached and first > start:
                if cached["digits"] != page["digits"]:
                    page = self.read_page(worker, source, symbol, members, start, stop, closed_until, priority, retry)
                else:
                    page = {**page, "bars": cached["bars"] + page["bars"], "gaps": cached["gaps"] + page["gaps"]}
            self.check_source(worker, source)
            self.store(scope, symbol, start, stop, page)
            return {**page, "stop": stop}

    def read_page(self, worker, source, symbol, members, start, end, closed_until, priority, retry=False):
        def broker_page(pair):
            if members and end <= closed_until:
                return self.load_chunk(worker, source, pair, start // CHUNK * CHUNK, closed_until, priority, retry, end)
            return self.read_mt5(worker, source, "volume-profile-hourly-bars",
                                 {"symbol": pair, "start": start, "end": end}, priority)

        if not members:
            return broker_page(symbol)
        pages = [broker_page(pair) for pair, _ in members]
        legs = [{at: (close, count) for at, close, count in page["bars"] if start <= at < end} for page in pages]
        common = set.intersection(*(set(leg) for leg in legs))
        gaps = [gap for page in pages for gap in page["gaps"] if gap[0] < end and start < gap[1]]
        gaps.extend((at, at + HOUR) for at in sorted(set.union(*(set(leg) for leg in legs)) - common))
        bars = []
        if common:
            reference = self.index_reference(worker, source, symbol, priority)
            for at in sorted(common):
                prices, activity = zip(*(leg[at] for leg in legs))
                bars.append((at, index_price(prices, reference), sum(activity)))
        return {"digits": INDEX_DIGITS, "bars": bars, "gaps": gaps}

    def profile(self, worker, source, symbol, start, end, observed_until, retry=False):
        closed_until = observed_until // HOUR * HOUR
        first_hour = start // HOUR * HOUR
        end = min(end, observed_until)
        closed_end = min(end, closed_until)
        pages = [
            self.load_chunk(worker, source, symbol, first, closed_until, retry=retry,
                            through=(closed_end + HOUR - 1) // HOUR * HOUR)
            for first in chunk_starts(first_hour, closed_end)
        ]
        if end > max(first_hour, closed_until):
            members = MEMBERS.get(symbol) if source["account_server"] == SERVER else None
            pages.append(self.read_page(worker, source, symbol, members, max(first_hour, closed_until), end, closed_until, 10))
        self.check_source(worker, source)
        digits = pages[-1]["digits"] if pages else 0
        incomplete = any(overlaps_gap(page, start, end) or page["digits"] != digits for page in pages)
        bars = (bar for page in pages if page["digits"] == digits for bar in page["bars"])
        return weighted_profile(bars, digits, incomplete, start, end, observed_until)
