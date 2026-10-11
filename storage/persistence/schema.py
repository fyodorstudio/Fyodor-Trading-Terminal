from __future__ import annotations

import sqlite3
import threading
import time
from pathlib import Path
from typing import Callable


class StoreSchema:

    def __init__(self, path: Path, clock: Callable[[], float] = time.time, readonly=False):
        self.path = path
        self.clock = clock
        self.lock = threading.RLock()
        if not readonly:
            path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path.resolve().as_uri() + "?mode=ro" if readonly else path,
                                  uri=readonly, check_same_thread=False, timeout=10)
        self.db.row_factory = sqlite3.Row
        if readonly:
            if self.db.execute("PRAGMA user_version").fetchone()[0] != 2:
                self.db.close()
                raise ValueError("Status needs storage schema 2; start storage to migrate supported older data")
            self.db.execute("BEGIN")  # All status queries use one read-only snapshot.
            return
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA foreign_keys=ON")
        version = self.db.execute("PRAGMA user_version").fetchone()[0]
        if version not in (0, 1, 2):
            raise ValueError(f"Unsupported storage schema version: {version}")
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS sources (
                id TEXT PRIMARY KEY, server_now INTEGER NOT NULL,
                instance_id TEXT, offset_seconds INTEGER, publisher_seen_at REAL);
            CREATE TABLE IF NOT EXISTS imports (
                id TEXT PRIMARY KEY, source_id TEXT NOT NULL, manifest TEXT NOT NULL,
                hashes TEXT NOT NULL, imported_at REAL NOT NULL, row_count INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS observations (
                source_id TEXT NOT NULL, value_id TEXT NOT NULL, digest TEXT NOT NULL,
                payload TEXT NOT NULL, origin TEXT NOT NULL, observed_at REAL NOT NULL,
                provenance TEXT NOT NULL, PRIMARY KEY(source_id, value_id, digest));
            CREATE TABLE IF NOT EXISTS events (
                source_id TEXT NOT NULL, value_id TEXT NOT NULL, server_time INTEGER NOT NULL,
                currency TEXT NOT NULL, payload TEXT NOT NULL, priority INTEGER NOT NULL,
                observed_at REAL NOT NULL, origin TEXT NOT NULL,
                PRIMARY KEY(source_id, value_id));
            CREATE INDEX IF NOT EXISTS events_range ON events(source_id, server_time, currency);
            CREATE TABLE IF NOT EXISTS coverage (
                source_id TEXT NOT NULL, currency TEXT NOT NULL,
                start INTEGER NOT NULL, end INTEGER NOT NULL, expires INTEGER,
                reference TEXT NOT NULL, UNIQUE(source_id, currency, start, end, reference));
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY, source_id TEXT NOT NULL, currency TEXT NOT NULL,
                start INTEGER NOT NULL, end INTEGER NOT NULL, state TEXT NOT NULL,
                token TEXT, instance_id TEXT, touched_at REAL, issued_at REAL,
                captured_server_now INTEGER, chunk_count INTEGER, event_count INTEGER,
                attempts INTEGER NOT NULL DEFAULT 0, error_code INTEGER,
                retry_at REAL NOT NULL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS chunks (
                job_id TEXT NOT NULL REFERENCES jobs(id), chunk_index INTEGER NOT NULL,
                payload TEXT NOT NULL, PRIMARY KEY(job_id, chunk_index));
            CREATE TABLE IF NOT EXISTS query_absences (
                source_id TEXT NOT NULL,value_id TEXT NOT NULL,job_id TEXT NOT NULL,
                observed_at REAL NOT NULL,PRIMARY KEY(source_id,value_id));
            PRAGMA user_version=1;
        """)
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS data_revision (id INTEGER PRIMARY KEY CHECK(id=1), value INTEGER NOT NULL);
            INSERT OR IGNORE INTO data_revision VALUES (1,0);
            CREATE TABLE IF NOT EXISTS event_timing (
                source_id TEXT NOT NULL, value_id TEXT NOT NULL,
                capture_offset_seconds INTEGER, release_at INTEGER, chart_time_seconds INTEGER,
                basis TEXT NOT NULL, profile TEXT,
                PRIMARY KEY(source_id,value_id));
            CREATE INDEX IF NOT EXISTS timing_range ON event_timing(source_id,chart_time_seconds);
        """)
        if "captured_offset_seconds" not in {row[1] for row in self.db.execute("PRAGMA table_info(jobs)")}:
            self.db.execute("ALTER TABLE jobs ADD COLUMN captured_offset_seconds INTEGER")
        for table in ("events", "coverage", "query_absences", "event_timing"):
            for operation in ("INSERT", "UPDATE", "DELETE"):
                self.db.execute(f"""CREATE TRIGGER IF NOT EXISTS revision_{table}_{operation}
                    AFTER {operation} ON {table} BEGIN UPDATE data_revision SET value=value+1 WHERE id=1; END""")
        # An earlier planned observation can change an R1 as-of schedule even
        # when source priority leaves the current event payload untouched.
        self.db.execute("""CREATE TRIGGER IF NOT EXISTS revision_planned_observation
            AFTER INSERT ON observations WHEN json_extract(new.payload,'$.actual') IS NULL
            AND json_extract(new.payload,'$.currency')='USD'
            BEGIN UPDATE data_revision SET value=value+1 WHERE id=1; END""")
        self.db.execute("""CREATE TRIGGER IF NOT EXISTS revision_usd_observation
            AFTER INSERT ON observations WHEN json_extract(new.payload,'$.currency')='USD'
            AND json_extract(new.payload,'$.actual') IS NOT NULL
            BEGIN UPDATE data_revision SET value=value+1 WHERE id=1; END""")
        self._restore_timing()
        self.db.execute("PRAGMA user_version=2")
        self.db.commit()

    def close(self):
        self.db.close()
