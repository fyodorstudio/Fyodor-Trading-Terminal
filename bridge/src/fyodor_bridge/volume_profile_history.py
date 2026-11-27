from __future__ import annotations

from collections import Counter
from contextlib import closing, contextmanager
from functools import lru_cache
from pathlib import Path
from threading import Lock
from time import time
import json
import sqlite3
import zlib

from .volume_profile import MAX_PROFILE_PAGE_SECONDS as DAY

TEMPORARY_TTL = 3_600
KNOWN_GAP_TTL = 7 * DAY
TICK_SLICE_BATCH = 6 * 3600
ARCHIVED_GAP = 253402214400


def encode(value):
    return zlib.compress(json.dumps(value, separators=(",", ":")).encode(), level=1)


@lru_cache(maxsize=12)
def decode_slices(payload):
    return json.loads(zlib.decompress(payload))


def slice_profile(snapshot, start, stop):
    _, digits, minutes, gaps = snapshot
    levels = Counter()
    for minute, entries in minutes:
        if start <= minute < stop:
            for price, count in entries:
                levels[price] += count
    missing = None if gaps is None else sum(start <= minute < stop for minute in gaps)
    return dict(digits=digits, levels=list(levels.items()), missing_minutes=missing)


def fill_profile_slices(cache, scope, day, stop, load, *, empty_digits=None, retry=False, require_cache=False):
    with cache.slice_locks[hash((*scope, day)) % len(cache.slice_locks)]:
        return _fill_profile_slices(cache, scope, day, stop, load, empty_digits, retry, require_cache)


def _fill_profile_slices(cache, scope, day, stop, load, empty_digits, retry, require_cache):
    snapshot = cache.read_slices(scope, day, retry)
    if snapshot is not None and snapshot[0] >= stop:
        return snapshot
    previous, digits, minutes, gaps = snapshot or (day, empty_digits, [], [])
    minutes, gaps = list(minutes), None if gaps is None else list(gaps)
    if empty_digits is None:
        for first in range(previous, stop, TICK_SLICE_BATCH):
            end = min(stop, first + TICK_SLICE_BATCH)
            page = load(first, end)
            if digits is not None and page["digits"] != digits:
                raise ValueError("Tick history precision changed during the read")
            digits = page["digits"]
            minutes.extend(page["slices"])
            if page["missing_slices"] is None:
                gaps = None
            elif gaps is not None:
                gaps.extend(page["missing_slices"])
    snapshot = (stop, digits, minutes, gaps)
    page = slice_profile(snapshot, day, stop)
    page.update(slices=minutes, missing_slices=gaps)
    confirmed_empty = empty_digits is not None
    day_saved = stop - day < DAY or cache.write_day(scope, day, stop, page, confirmed_empty=confirmed_empty)
    slices_saved = (day_saved or not require_cache) and cache.write_slices(scope, day, stop, page, confirmed_empty=confirmed_empty)
    if require_cache and not slices_saved:
        raise OSError("Could not save exact tick profiles")
    return snapshot


def profile_windows(start, end, page_seconds=DAY):
    while end > start:
        first = max(start, (end - 1) // page_seconds * page_seconds)
        yield first, end
        end = first


def window_days(start, end):
    return (end - 1) // DAY - start // DAY + 1


class VolumeProfileCache:
    def __init__(self, path: Path):
        self.path = path
        self.ready = False
        self.lock = Lock()
        self.slice_locks = tuple(Lock() for _ in range(128))

    @contextmanager
    def database(self):
        with self.lock:
            if not self.ready:
                self.path.parent.mkdir(parents=True, exist_ok=True)
                with closing(sqlite3.connect(self.path)) as db:
                    db.execute("PRAGMA journal_mode=WAL")
                    db.execute("""
                        CREATE TABLE IF NOT EXISTS profile_days_v1 (
                            broker TEXT NOT NULL, login INTEGER NOT NULL, symbol TEXT NOT NULL,
                            start INTEGER NOT NULL, digits INTEGER NOT NULL, missing_minutes INTEGER,
                            levels BLOB NOT NULL, expires INTEGER NOT NULL,
                            PRIMARY KEY (broker, login, symbol, start)
                        ) WITHOUT ROWID
                    """)
                    with db:
                        db.execute("BEGIN IMMEDIATE")
                        db.execute("""
                            CREATE TABLE IF NOT EXISTS profile_slices_v1 (
                                broker TEXT NOT NULL, login INTEGER NOT NULL, symbol TEXT NOT NULL,
                                start INTEGER NOT NULL, stop INTEGER NOT NULL, digits INTEGER NOT NULL,
                                payload BLOB NOT NULL, expires INTEGER NOT NULL,
                                PRIMARY KEY (broker, login, symbol, start)
                            ) WITHOUT ROWID
                        """)
                        db.execute("""
                            CREATE TABLE IF NOT EXISTS profile_preload_v1 (
                                broker TEXT NOT NULL, login INTEGER NOT NULL, state TEXT NOT NULL,
                                PRIMARY KEY (broker, login)
                            ) WITHOUT ROWID
                        """)
                        if db.execute("PRAGMA user_version").fetchone()[0] == 0:
                            db.execute("""
                                UPDATE profile_days_v1 SET expires = expires + ?
                                WHERE expires > 0 AND missing_minutes > 0 AND levels = ?
                            """, (KNOWN_GAP_TTL - TEMPORARY_TTL, zlib.compress(b"[]", level=1)))
                            db.execute("PRAGMA user_version = 1")
                self.ready = True
        with closing(sqlite3.connect(self.path)) as db:
            yield db

    def read(self, scope, start, end, retry=False):
        first = (start + DAY - 1) // DAY * DAY
        stop = end // DAY * DAY
        for edge in {(start, min(end, first)), (max(start, stop), end)}:
            if edge[0] < edge[1]:
                page = self.read_window(scope, *edge, retry)
                if page is not None:
                    yield edge, page
        if first >= stop:
            return
        try:
            with self.database() as db:
                rows = db.execute("""
                    SELECT start, digits, missing_minutes, levels FROM profile_days_v1
                    WHERE broker = ? AND login = ? AND symbol = ? AND start >= ? AND start < ?
                    AND (expires = 0 OR (? = 0 AND expires > ?))
                """, (*scope, first, stop, retry, int(time())))
                for at, digits, missing, payload in rows:
                    try:
                        levels = json.loads(zlib.decompress(payload))
                    except (ValueError, zlib.error):
                        continue
                    yield (at, at + DAY), dict(digits=digits, missing_minutes=missing, levels=levels)
        except (OSError, sqlite3.Error):
            return

    def read_slices(self, scope, day, retry=False):
        try:
            with self.database() as db:
                row = db.execute("""
                    SELECT stop,digits,payload FROM profile_slices_v1
                    WHERE broker=? AND login=? AND symbol=? AND start=?
                    AND (expires=0 OR (?=0 AND expires>?))
                """, (*scope, day, retry, int(time()))).fetchone()
            if row is not None:
                stop, digits, payload = row
                minutes, gaps = decode_slices(payload)
                return stop, digits, minutes, gaps
        except (OSError, sqlite3.Error, ValueError, zlib.error):
            return None

    def read_window(self, scope, start, end, retry=False):
        snapshot = self.read_slices(scope, start // DAY * DAY, retry)
        if snapshot is not None and end <= snapshot[0]:
            return slice_profile(snapshot, start, end)

    def save_job(self, scope, state):
        with self.database() as db, db:
            db.execute("INSERT OR REPLACE INTO profile_preload_v1 VALUES (?,?,?)", (*scope, json.dumps(state)))

    def read_job(self, scope):
        with self.database() as db:
            row = db.execute("SELECT state FROM profile_preload_v1 WHERE broker=? AND login=?", scope).fetchone()
        return json.loads(row[0]) if row else None

    def write_slices(self, scope, day, stop, page, *, confirmed_empty=False):
        if not day < stop <= day + DAY or day % DAY or stop % 60 or "slices" not in page:
            return False
        missing = page["missing_minutes"]
        complete = missing == 0 and (page["levels"] or confirmed_empty)
        ttl = KNOWN_GAP_TTL if missing and not page["levels"] else TEMPORARY_TTL
        now = int(time())
        expires = 0 if complete else ARCHIVED_GAP if stop <= now - KNOWN_GAP_TTL else now + ttl
        payload = encode((page["slices"], page["missing_slices"]))
        try:
            with self.database() as db, db:
                db.execute("""
                    INSERT INTO profile_slices_v1 VALUES (?,?,?,?,?,?,?,?)
                    ON CONFLICT (broker, login, symbol, start) DO UPDATE SET
                        stop=excluded.stop,digits=excluded.digits,payload=excluded.payload,expires=excluded.expires
                    WHERE excluded.stop>profile_slices_v1.stop OR
                        (excluded.stop=profile_slices_v1.stop AND profile_slices_v1.expires!=0)
                """, (*scope, day, stop, page["digits"], payload, expires))
        except (OSError, sqlite3.Error):
            return False
        return True

    def write_day(self, scope, start, end, page, *, confirmed_empty=False):
        if end - start != DAY or start % DAY:
            return False
        # Retry empty or incomplete days later as MT5 may still synchronize them.
        missing = page["missing_minutes"]
        complete = missing == 0 and (page["levels"] or confirmed_empty)
        ttl = KNOWN_GAP_TTL if missing and not page["levels"] else TEMPORARY_TTL
        now = int(time())
        expires = 0 if complete else ARCHIVED_GAP if "slices" in page and end <= now - KNOWN_GAP_TTL else now + ttl
        levels = encode(page["levels"])
        try:
            with self.database() as db, db:
                db.execute("""
                    INSERT INTO profile_days_v1
                    (broker, login, symbol, start, digits, missing_minutes, levels, expires)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (broker, login, symbol, start) DO UPDATE SET
                        digits = excluded.digits, missing_minutes = excluded.missing_minutes,
                        levels = excluded.levels, expires = excluded.expires
                    WHERE profile_days_v1.expires != 0
                """, (*scope, start, page["digits"], page["missing_minutes"], levels, expires))
        except (OSError, sqlite3.Error):
            # The live profile can still use the page if the cache is unavailable.
            return False
        return True


class ProfileHistory:
    def __init__(self, start, end, cached, page_seconds=DAY):
        self.checked = 0
        self.incomplete = False
        self.digits = None
        self.levels = Counter()
        available = set()
        for window, page in cached:
            self.add(page)
            available.add(window)
        self.pending = [window for window in profile_windows(start, end, page_seconds) if window not in available]
        self.total = window_days(start, end)

    def add(self, page, days=1):
        self.checked += days
        if page is None or (self.digits is not None and self.digits != page["digits"]):
            self.incomplete = True
            return
        self.digits = page["digits"]
        self.incomplete |= page["missing_minutes"] != 0
        for price, count in page["levels"]:
            self.levels[price] += count

    def snapshot(self, generation, *, done):
        return dict(source_generation=generation, done=done, checked=self.checked, total=self.total,
                    incomplete=self.incomplete, digits=self.digits, levels=list(self.levels.items()))
