from __future__ import annotations

import hashlib
import json
from ..calendar_clock import PROFILES, broker_offset, project
from ..contracts import PublisherContext
from .support import canonical


class StoreObservations:

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
