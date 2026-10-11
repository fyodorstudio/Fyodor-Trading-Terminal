from __future__ import annotations

import json
import uuid
from ..contracts import BackfillChunk, BackfillFailure, CalendarEvent, PublisherContext
from ..currencies import publisher_currencies
from .support import canonical, DAY, HISTORY_START, missing_intervals


class StoreBackfill:

    def next_job(self, context: PublisherContext):
        self.register(context)
        now = self.clock()
        admitted = publisher_currencies(context.publisher_version)
        placeholders = ','.join('?' for _ in admitted)
        with self.lock, self.db:
            job = self.db.execute(f"""SELECT * FROM jobs WHERE source_id=? AND state!='complete'
                AND retry_at<=? AND currency IN ({placeholders})
                ORDER BY CASE WHEN state='leased' THEN 0 ELSE 1 END,rowid LIMIT 1""",
                                  (context.source_id, now, *admitted)).fetchone()
            if job and job["state"] == "leased" and job["instance_id"] == context.instance_id and now - job["touched_at"] < 120:
                self.db.execute("UPDATE jobs SET touched_at=? WHERE id=?", (now, job["id"]))
                return self._job_response(job)
            if job is None:
                target_end = ((context.server_time_seconds // DAY) + 1 + 60) * DAY
                candidates = []
                recent_start = context.server_time_seconds - 30 * DAY
                for currency in admitted:
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
