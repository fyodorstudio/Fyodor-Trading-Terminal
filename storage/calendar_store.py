from __future__ import annotations

import hashlib
import json
import sqlite3
import threading
import time
import uuid
from pathlib import Path
from typing import Callable

from .contracts import BackfillChunk, BackfillFailure, CalendarEvent, PublisherContext
from .calendar_clock import PROFILES, broker_offset, project

HISTORY_START = 1420070400  # 2015-01-01, raw broker-server calendar clock.
DAY = 86400
CURRENCIES = ("EUR", "USD")


def canonical(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def merged_intervals(intervals):
    result = []
    for start, end in sorted(intervals):
        if result and start <= result[-1][1]:
            result[-1] = (result[-1][0], max(end, result[-1][1]))
        else:
            result.append((start, end))
    return result


def missing_intervals(start: int, end: int, covered):
    result = []
    cursor = start
    for left, right in merged_intervals(covered):
        if right <= cursor or left >= end:
            continue
        if left > cursor:
            result.append((cursor, min(left, end)))
        cursor = max(cursor, right)
    if cursor < end:
        result.append((cursor, end))
    return result


class CalendarStore:
    """Transactions preserve observations and acknowledge whole date batches only.

    Coverage is half-open in broker-server seconds, scoped by broker and currency.
    Recent/future intervals expire daily so pre-release snapshots never certify
    those dates indefinitely. Old history is retained after every restart.
    """

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

    def _capture_offset(self, source_id, observed_at, provenance):
        if provenance.get("capture_offset_seconds") is not None:
            return int(provenance["capture_offset_seconds"]), "recorded-offset"
        if provenance.get("import_id"):
            row = self.db.execute("SELECT manifest FROM imports WHERE id=?", (provenance["import_id"],)).fetchone()
            if row:
                manifest = json.loads(row[0])
                return int(manifest["snapshot_trade_server_timestamp"]) - int(manifest["snapshot_gmt_timestamp"]), "export-snapshot"
        if provenance.get("job_id"):
            row = self.db.execute("SELECT captured_offset_seconds,captured_server_now,issued_at FROM jobs WHERE id=?", (provenance["job_id"],)).fetchone()
            if row:
                if row[0] is not None:
                    return row[0], "recorded-offset"
                # Legacy leases have both clocks. Accept only a near-exact
                # whole-hour offset, allowing request transit time.
                difference = row[1] - row[2]
                offset = round(difference / 3600) * 3600
                if abs(difference - offset) <= 120 and abs(offset) <= 18 * 3600:
                    return offset, "legacy-lease-clocks"
        offset = broker_offset(source_id, observed_at)
        return offset, "legacy-broker-profile" if offset is not None else "unavailable"

    def _save_timing(self, source_id, event, observed_at, provenance):
        offset, basis = self._capture_offset(source_id, observed_at, provenance)
        utc, chart = project(source_id, event["server_time_seconds"], offset) if event["time_mode"] == 0 else (None, None)
        self.db.execute("""INSERT INTO event_timing VALUES (?,?,?,?,?,?,?)
            ON CONFLICT(source_id,value_id) DO UPDATE SET capture_offset_seconds=excluded.capture_offset_seconds,
            release_at=excluded.release_at,chart_time_seconds=excluded.chart_time_seconds,
            basis=excluded.basis,profile=excluded.profile""",
            (source_id, event["value_id"], offset, utc, chart, basis, PROFILES.get(source_id)))

    def _restore_timing(self):
        # Upgrade existing local databases without rewriting raw observations.
        rows = self.db.execute("""SELECT e.source_id,e.payload,o.observed_at,o.provenance,t.profile,t.value_id
            FROM events e JOIN observations o ON o.source_id=e.source_id AND o.value_id=e.value_id AND o.payload=e.payload
            LEFT JOIN event_timing t ON t.source_id=e.source_id AND t.value_id=e.value_id
            """).fetchall()
        for row in rows:
            if row[5] is None or row[4] != PROFILES.get(row[0]):
                self._save_timing(row[0], json.loads(row[1]), row[2], json.loads(row[3]))

    def close(self):
        self.db.close()

    def _source(self, source_id, server_now):
        self.db.execute("""INSERT INTO sources(id, server_now) VALUES (?,?)
            ON CONFLICT(id) DO UPDATE SET server_now=max(server_now, excluded.server_now)""",
            (source_id, server_now))

    def _observe(self, source_id, event, origin, observed_at, provenance, priority=1):
        previous = self.db.execute("SELECT * FROM events WHERE source_id=? AND value_id=?",
                                   (source_id, event["value_id"])).fetchone()
        if previous:
            # A collector has no raw integers; retain exact raw fields from an
            # earlier observation only when the matching numeric value agrees.
            old = json.loads(previous["payload"])
            for field in ("actual", "forecast", "previous", "revised_previous"):
                raw = field + "_raw_scaled_1e6"
                if event.get(raw) is None and old.get(raw) is not None and event[field] == old[field]:
                    event = {**event, raw: old[raw]}
        payload = canonical(event)
        digest = hashlib.sha256(payload.encode()).hexdigest()
        self.db.execute("INSERT OR IGNORE INTO observations VALUES (?,?,?,?,?,?,?)",
                        (source_id, event["value_id"], digest, payload, origin, observed_at, canonical(provenance)))
        if previous:
            if payload == previous["payload"]:
                if priority > previous["priority"]:
                    self.db.execute("UPDATE events SET priority=?,observed_at=?,origin=? WHERE source_id=? AND value_id=?",
                                    (priority, observed_at, origin, source_id, event["value_id"]))
                return
            if priority < previous["priority"] or (priority == previous["priority"] and observed_at < previous["observed_at"]):
                return
            if event["revision"] < old["revision"]:
                return
        self.db.execute("""INSERT INTO events VALUES (?,?,?,?,?,?,?,?)
            ON CONFLICT(source_id,value_id) DO UPDATE SET server_time=excluded.server_time,
            currency=excluded.currency,payload=excluded.payload,priority=excluded.priority,
            observed_at=excluded.observed_at,origin=excluded.origin""",
            (source_id, event["value_id"], event["server_time_seconds"], event["currency"],
             payload, priority, observed_at, origin))
        self._save_timing(source_id, event, observed_at, provenance)
        if priority > 0:
            self.db.execute("DELETE FROM query_absences WHERE source_id=? AND value_id=? AND observed_at<=?",
                            (source_id, event["value_id"], observed_at))

    def _coverage(self, source_id, currency, start, end, server_now, reference):
        # Reconcile the last 30 days and all future schedules daily. Preserve
        # the original archive as evidence, without making recent rows immutable.
        boundary = server_now - 30 * DAY
        if start < min(end, boundary):
            self.db.execute("INSERT OR IGNORE INTO coverage VALUES (?,?,?,?,?,?)",
                            (source_id, currency, start, min(end, boundary), None, reference))
        if end > max(start, boundary):
            self.db.execute("INSERT OR IGNORE INTO coverage VALUES (?,?,?,?,?,?)",
                            (source_id, currency, max(start, boundary), end, server_now + DAY, reference))

    def _covered(self, source_id, currency, server_now):
        return merged_intervals((row[0], row[1]) for row in self.db.execute(
            "SELECT start,end FROM coverage WHERE source_id=? AND currency=? AND (expires IS NULL OR expires>?)",
            (source_id, currency, server_now)))

    def _covered_chart(self, source_id, currency, server_now):
        intervals = []
        for row in self.db.execute("""SELECT start,end,reference FROM coverage
            WHERE source_id=? AND currency=? AND (expires IS NULL OR expires>?)""",
            (source_id, currency, server_now)):
            # Imports and leases record the retrieval clock for their entire
            # query, including empty dates. Transform coverage with that same
            # clock rather than reporting a spurious midnight gap.
            offset, _ = self._capture_offset(source_id, 0, {"import_id": row[2], "job_id": row[2]})
            _, left = project(source_id, row[0], offset)
            _, right = project(source_id, row[1], offset)
            if left is not None and right is not None:
                intervals.append((left, right))
            elif source_id not in PROFILES:
                intervals.append((row[0], row[1]))
            elif row[1] - row[0] > 7200:
                intervals.append((row[0] + 3600, row[1] - 3600))
        return merged_intervals(intervals)

    def import_rows(self, import_id, source_id, manifest, hashes, rows):
        start = int(manifest["calendar_from_timestamp"])
        end = int(manifest["calendar_to_timestamp"]) + 1  # Exporter query includes cutoff.
        server_now = int(manifest["snapshot_trade_server_timestamp"])
        observed_at = int(manifest["snapshot_gmt_timestamp"])
        with self.lock, self.db:
            existing = self.db.execute("SELECT * FROM imports WHERE id=?", (import_id,)).fetchone()
            if existing:
                if json.loads(existing["hashes"]) != hashes:
                    raise ValueError("Export identity already imported with different file hashes")
                return {"already_imported": True, "rows": existing["row_count"], "source_id": source_id}
            self._source(source_id, server_now)
            count = 0
            for event in rows:
                if event["currency"] not in CURRENCIES:
                    continue
                if not start <= event["server_time_seconds"] < end:
                    raise ValueError("Archive release lies outside its manifest interval")
                self._observe(source_id, event, "archive", observed_at, {"import_id": import_id,
                    "capture_offset_seconds": server_now - observed_at}, priority=0)
                count += 1
            self.db.execute("INSERT INTO imports VALUES (?,?,?,?,?,?)",
                            (import_id, source_id, canonical(manifest), canonical(hashes), self.clock(), count))
            for currency in CURRENCIES:
                if currency in manifest["calendar_currencies"].split(","):
                    self._coverage(source_id, currency, start, end, server_now, import_id)
            return {"already_imported": False, "rows": count, "source_id": source_id}

    def register(self, context: PublisherContext):
        with self.lock, self.db:
            self._source(context.source_id, context.server_time_seconds)
            self.db.execute("UPDATE sources SET instance_id=?,offset_seconds=?,publisher_seen_at=? WHERE id=?",
                            (context.instance_id, context.server_utc_offset_seconds, self.clock(), context.source_id))

    def collect(self, source_id, events, instance_id, observed_at=None, capture_offset_seconds=None):
        with self.lock, self.db:
            source = self.db.execute("SELECT * FROM sources WHERE id=?", (source_id,)).fetchone()
            if not source or source["instance_id"] != instance_id:
                return False
            for event in events:
                self._observe(source_id, event, "live", self.clock() if observed_at is None else observed_at,
                    {"instance_id": instance_id, "capture_offset_seconds": capture_offset_seconds if capture_offset_seconds is not None else source["offset_seconds"]})
            # Bridge windows roll on heartbeat; they do NOT certify queried
            # coverage. Only completed imports and explicit backfill jobs do.
            return True

    def next_job(self, context: PublisherContext):
        self.register(context)
        now = self.clock()
        with self.lock, self.db:
            job = self.db.execute("""SELECT * FROM jobs WHERE source_id=? AND state!='complete'
                AND retry_at<=? ORDER BY CASE WHEN state='leased' THEN 0 ELSE 1 END,rowid LIMIT 1""",
                                  (context.source_id, now)).fetchone()
            if job and job["state"] == "leased" and job["instance_id"] == context.instance_id and now - job["touched_at"] < 120:
                self.db.execute("UPDATE jobs SET touched_at=? WHERE id=?", (now, job["id"]))
                return self._job_response(job)
            if job is None:
                target_end = ((context.server_time_seconds // DAY) + 1 + 60) * DAY
                candidates = []
                recent_start = context.server_time_seconds - 30 * DAY
                for currency in CURRENCIES:
                    # Cooling jobs remain unconfirmed coverage, but reserve their
                    # intervals so other gaps can proceed without duplicate jobs.
                    reserved = [(row[0], row[1]) for row in self.db.execute(
                        "SELECT start,end FROM jobs WHERE source_id=? AND currency=? AND state!='complete'",
                        (context.source_id, currency))]
                    gaps = missing_intervals(HISTORY_START, target_end,
                        [*self._covered(context.source_id, currency, context.server_time_seconds), *reserved])
                    for left, right in gaps:
                        if right > recent_start:
                            candidates.append((0, max(left, recent_start), right, currency))
                        if left < recent_start:
                            candidates.append((1, left, min(right, recent_start), currency))
                if not candidates:
                    return {"available": False, "retry_after_seconds": 30}
                _, start, end, currency = min(candidates)
                end = min(end, start + 7 * DAY)
                job_id = uuid.uuid4().hex
                self.db.execute("INSERT INTO jobs(id,source_id,currency,start,end,state) VALUES (?,?,?,?,?,'pending')",
                                (job_id, context.source_id, currency, start, end))
                job = self.db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
            token = uuid.uuid4().hex
            self.db.execute("DELETE FROM chunks WHERE job_id=?", (job["id"],))
            self.db.execute("""UPDATE jobs SET state='leased',token=?,instance_id=?,touched_at=?,issued_at=?,
                captured_server_now=?,captured_offset_seconds=?,chunk_count=NULL,event_count=NULL WHERE id=?""",
                (token, context.instance_id, now, now, context.server_time_seconds, context.server_utc_offset_seconds, job["id"]))
            return self._job_response(self.db.execute("SELECT * FROM jobs WHERE id=?", (job["id"],)).fetchone())

    @staticmethod
    def _job_response(job):
        return {"available": True, "job_id": job["id"], "lease_token": job["token"],
                "currency": job["currency"], "from_server_seconds": job["start"],
                "to_server_seconds": job["end"]}

    def _leased_job(self, job_id, token):
        job = self.db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        if not job or job["token"] != token:
            raise ValueError("Unknown job or superseded lease")
        if job["state"] not in ("leased", "complete"):
            raise ValueError("Job must be leased before submission")
        return job

    def receive(self, chunk: BackfillChunk):
        payload = canonical(chunk.model_dump())
        with self.lock, self.db:
            job = self._leased_job(chunk.job_id, chunk.lease_token)
            previous = self.db.execute("SELECT payload FROM chunks WHERE job_id=? AND chunk_index=?",
                                       (chunk.job_id, chunk.chunk_index)).fetchone()
            if previous and previous[0] != payload:
                raise ValueError("Retry changed an already acknowledged chunk")
            if job["state"] == "complete":
                if not previous:
                    raise ValueError("Completed transfer has no matching chunk")
                return {"accepted": True, "committed": True}
            if job["chunk_count"] is not None and (job["chunk_count"] != chunk.chunk_count or job["event_count"] != chunk.event_count):
                raise ValueError("Transfer metadata changed")
            for event in chunk.events:
                if event.currency != job["currency"] or not job["start"] <= event.server_time_seconds < job["end"]:
                    raise ValueError("Backfill row lies outside job currency/date scope")
            self.db.execute("UPDATE jobs SET chunk_count=?,event_count=?,touched_at=? WHERE id=?",
                            (chunk.chunk_count, chunk.event_count, self.clock(), job["id"]))
            self.db.execute("INSERT OR IGNORE INTO chunks VALUES (?,?,?)", (chunk.job_id, chunk.chunk_index, payload))
            chunks = self.db.execute("SELECT payload FROM chunks WHERE job_id=? ORDER BY chunk_index", (chunk.job_id,)).fetchall()
            if len(chunks) != chunk.chunk_count:
                return {"accepted": True, "committed": False}
            rows = [event for saved in chunks for event in json.loads(saved[0])["events"]]
            if len(rows) != chunk.event_count or len({event["value_id"] for event in rows}) != len(rows):
                raise ValueError("Transferred count mismatch or duplicate value identity")
            seen = {event["value_id"] for event in rows}
            for saved in self.db.execute("""SELECT value_id FROM events WHERE source_id=? AND currency=?
                AND server_time>=? AND server_time<? AND observed_at<=?""",
                (job["source_id"], job["currency"], job["start"], job["end"], job["issued_at"])).fetchall():
                if saved[0] not in seen:
                    self.db.execute("""INSERT INTO query_absences VALUES (?,?,?,?)
                        ON CONFLICT(source_id,value_id) DO UPDATE SET job_id=excluded.job_id,observed_at=excluded.observed_at""",
                        (job["source_id"], saved[0], job["id"], job["issued_at"]))
            for event in rows:
                self._observe(job["source_id"], event, "backfill", job["issued_at"], {"job_id": job["id"],
                    "capture_offset_seconds": job["captured_offset_seconds"]})
                self.db.execute("DELETE FROM query_absences WHERE source_id=? AND value_id=? AND observed_at<=?",
                                (job["source_id"], event["value_id"], job["issued_at"]))
            self._coverage(job["source_id"], job["currency"], job["start"], job["end"], job["captured_server_now"], job["id"])
            self.db.execute("UPDATE jobs SET state='complete',error_code=NULL WHERE id=?", (job["id"],))
            return {"accepted": True, "committed": True}

    def fail(self, failure: BackfillFailure):
        with self.lock, self.db:
            job = self._leased_job(failure.job_id, failure.lease_token)
            if job["state"] == "complete":
                return {"accepted": True}
            attempts = job["attempts"] + 1
            # Timeout/memory/array limits reduce the date request, not its data.
            end = job["end"]
            if failure.error_code in (5401, 5400, 4004, 4001, -1001) and end - job["start"] > DAY:
                end = job["start"] + max(DAY, (end - job["start"]) // 2)
            self.db.execute("""UPDATE jobs SET state='pending',token=NULL,attempts=?,error_code=?,end=?,retry_at=? WHERE id=?""",
                            (attempts, failure.error_code, end, self.clock() + min(300, 5 * 2 ** min(attempts - 1, 6)), job["id"]))
            self.db.execute("DELETE FROM chunks WHERE job_id=?", (job["id"],))
            return {"accepted": True}

    def publisher_sources(self):
        with self.lock:
            return [dict(row) for row in self.db.execute("SELECT * FROM sources WHERE instance_id IS NOT NULL")]

    def status(self):
        with self.lock:
            sources = []
            for row in self.db.execute("SELECT * FROM sources"):
                source = dict(row)
                source["chart_clock_profile"] = PROFILES.get(row["id"])
                source["publisher_status"] = "live" if row["publisher_seen_at"] and self.clock() - row["publisher_seen_at"] < 30 else "offline"
                source["events"] = self.db.execute("SELECT count(*) FROM events WHERE source_id=?", (row["id"],)).fetchone()[0]
                source["completed_batches"] = self.db.execute("SELECT count(*) FROM jobs WHERE source_id=? AND state='complete'", (row["id"],)).fetchone()[0]
                end = ((row["server_now"] // DAY) + 1 + 60) * DAY
                source["coverage"] = {currency: {"covered": self._covered(row["id"], currency, row["server_now"]),
                    "missing": missing_intervals(HISTORY_START, end, self._covered(row["id"], currency, row["server_now"]))} for currency in CURRENCIES}
                sources.append(source)
            jobs = [dict(row) for row in self.db.execute("SELECT id,source_id,currency,start,end,state,attempts,error_code FROM jobs WHERE state!='complete'")]
            return {"service_version": "1.1.0", "schema_version": 2, "timestamp_convention": "trade_server_time",
                    "sources": sources, "pending_jobs": jobs,
                    "revision": self.db.execute("SELECT value FROM data_revision WHERE id=1").fetchone()[0]}

    def planned_schedules(self, source_id, as_of):
        """Dates actually captured before the chosen clock, never inferred from actuals."""
        with self.lock:
            rows = self.db.execute("""SELECT value_id,payload,observed_at,provenance FROM observations
                WHERE source_id=? AND observed_at<=? AND json_extract(payload,'$.currency')='USD'
                AND json_extract(payload,'$.actual') IS NULL
                ORDER BY observed_at,value_id,digest""", (source_id, as_of / 1000)).fetchall()
            schedules, previous = [], {}
            for row in rows:
                event = json.loads(row["payload"])
                if event.get("time_mode") != 0 or event.get("actual_raw_scaled_1e6") is not None:
                    continue
                offset, basis = self._capture_offset(source_id, row["observed_at"], json.loads(row["provenance"]))
                due, _ = project(source_id, event["server_time_seconds"], offset)
                known = row["observed_at"] * 1000
                if due is None or due <= known:
                    continue
                item = {"seriesId": event["event_id"], "dueAt": due, "knownAt": known,
                        "source": f"stored-planned-observation/{row['value_id']}/{basis}"}
                earlier = previous.get(row["value_id"])
                if earlier is not None and earlier != due:
                    item["supersedesDueAt"] = earlier
                if earlier != due:
                    schedules.append(item)
                previous[row["value_id"]] = due
            return schedules

    def r1_vintages(self, source_id, value_ids):
        """Captured actual snapshots; capture time is not a publisher correction time."""
        if not value_ids:
            return {}
        rows = self.db.execute(f"""SELECT value_id,payload,observed_at,provenance FROM observations
            WHERE source_id=? AND value_id IN ({','.join('?' for _ in value_ids)})
            AND json_extract(payload,'$.currency')='USD'
            AND (json_extract(payload,'$.actual') IS NOT NULL OR json_extract(payload,'$.actual_raw_scaled_1e6') IS NOT NULL)
            ORDER BY observed_at,digest""", (source_id, *value_ids)).fetchall()
        vintages = {}
        for row in rows:
            event = json.loads(row['payload'])
            offset, basis = self._capture_offset(source_id, row['observed_at'], json.loads(row['provenance']))
            release_at, _ = project(source_id, event['server_time_seconds'], offset) if event['time_mode'] == 0 else (None, None)
            vintages.setdefault(row['value_id'], []).append({
                'knownAt': row['observed_at'] * 1000,
                'event': {**event, 'release_at': release_at},
                'source': f"stored-observation/{row['value_id']}/{basis}"})
        # A scalar JSON field preserves calendar row identity across unchanged polls.
        return {value_id: canonical(items) for value_id, items in vintages.items()}

    def query(self, source_id, start, end, currency=None, limit=1000, after_time=None, after_id=None, time_basis="raw", event_ids=None, r1_as_of=None, r1_history=False):
        with self.lock:
            chart = time_basis == "chart"
            axis = "coalesce(t.chart_time_seconds,e.server_time)" if chart else "e.server_time"
            # Native chart dates can differ from raw calendar dates near midnight.
            params = [source_id, max(0, start - DAY) if chart else start, end + DAY if chart else end]
            where = "e.source_id=? AND e.server_time>=? AND e.server_time<?"
            if chart:
                where += f" AND {axis}>=? AND {axis}<?"
                params.extend((start, end))
            if currency:
                where += " AND e.currency=?"
                params.append(currency)
            if event_ids is not None:
                where += " AND CAST(json_extract(e.payload,'$.event_id') AS TEXT) IN (" + ",".join("?" for _ in event_ids) + ")"
                params.extend(event_ids)
            if after_time is not None and after_id is not None:
                where += f" AND ({axis}>? OR ({axis}=? AND e.value_id>?))"
                params.extend((after_time, after_time, after_id))
            rows = self.db.execute(f"""SELECT e.*,a.job_id absence_job,t.release_at,t.chart_time_seconds,
                t.capture_offset_seconds,t.basis,t.profile,{axis} axis_time FROM events e
                LEFT JOIN event_timing t ON t.source_id=e.source_id AND t.value_id=e.value_id
                LEFT JOIN query_absences a ON a.source_id=e.source_id AND a.value_id=e.value_id WHERE {where}
                ORDER BY {axis},e.value_id LIMIT ?""", (*params, limit + 1)).fetchall()
            has_more = len(rows) > limit
            rows = rows[:limit]
            events = [{**json.loads(row["payload"]), "origin": row["origin"], "observed_at": row["observed_at"],
                       "availability": "not-returned-by-latest-query" if row["absence_job"] else "observed",
                       "absence_job_id": row["absence_job"], "release_at": row["release_at"] if chart else None,
                       "chart_time_seconds": row["chart_time_seconds"] if chart else None,
                       "timing_basis": row["basis"], "chart_clock_profile": row["profile"],
                       "capture_offset_seconds": row["capture_offset_seconds"]} for row in rows]
            if r1_as_of is not None or r1_history:
                vintages = self.r1_vintages(source_id, [row['value_id'] for row in rows])
                for event in events:
                    if event['currency'] == 'USD':
                        event['r1_vintages'] = vintages.get(event['value_id'], '[]')
            source = self.db.execute("SELECT server_now FROM sources WHERE id=?", (source_id,)).fetchone()
            scoped = (currency,) if currency else CURRENCIES
            coverage = {}
            for item in scoped:
                intervals = (self._covered_chart if chart else self._covered)(source_id, item, source[0] if source else 0)
                coverage[item] = {"missing": missing_intervals(start, end, intervals)}
            last = rows[-1] if rows and has_more else None
            return {"source_id": source_id, "timestamp_convention": "trade_server_time", "events": events,
                    **({'r1_source_version': 1} if r1_as_of is not None or r1_history else {}),
                    **({"r1_schedules": self.planned_schedules(source_id, r1_as_of)} if r1_as_of is not None and after_time is None else {}),
                    "time_basis": time_basis, "event_ids": event_ids, "coverage": coverage, "revision": self.db.execute("SELECT value FROM data_revision WHERE id=1").fetchone()[0],
                    "next_cursor": {"after_time": last["axis_time"], "after_id": last["value_id"]} if last else None}
