from __future__ import annotations

from collections import Counter
from contextlib import closing, contextmanager
from pathlib import Path
from threading import Lock
from time import time
import json
import sqlite3
import zlib

from .volume_profile import MAX_PROFILE_PAGE_SECONDS as DAY


def profile_windows(start, end):
    while end > start:
        first = max(start, (end - 1) // DAY * DAY)
        yield first, end
        end = first


class VolumeProfileCache:
    def __init__(self, path: Path):
        self.path = path
        self.ready = False
        self.lock = Lock()

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
                self.ready = True
        with closing(sqlite3.connect(self.path)) as db:
            yield db

    def read(self, scope, start, end, retry=False):
        # A day histogram cannot be sliced to answer a partial-day request.
        first = (start + DAY - 1) // DAY * DAY
        stop = end // DAY * DAY
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

    def write_day(self, scope, start, end, page, *, confirmed_empty=False):
        if end - start != DAY or start % DAY:
            return
        # Retry empty or incomplete days later as MT5 may still synchronize them.
        complete = page["missing_minutes"] == 0 and (page["levels"] or confirmed_empty)
        expires = 0 if complete else int(time()) + 3600
        levels = zlib.compress(json.dumps(page["levels"], separators=(",", ":")).encode(), level=1)
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
            pass


class ProfileHistory:
    def __init__(self, start, end, cached):
        self.checked = 0
        self.incomplete = False
        self.digits = None
        self.levels = Counter()
        available = set()
        for window, page in cached:
            self.add(page)
            available.add(window)
        self.pending = [window for window in profile_windows(start, end) if window not in available]
        self.total = self.checked + len(self.pending)

    def add(self, page):
        self.checked += 1
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
