from __future__ import annotations

import json
from ..calendar_clock import PROFILES, project
from ..currencies import CURRENCIES
from .support import canonical, DAY, HISTORY_START, missing_intervals


class StoreQueries:

    @staticmethod
    def event_rows(rows, chart=True):
        return [{**json.loads(row["payload"]), "origin": row["origin"], "observed_at": row["observed_at"],
            "availability": "not-returned-by-latest-query" if row["absence_job"] else "observed",
            "absence_job_id": row["absence_job"], "release_at": row["release_at"] if chart else None,
            "chart_time_seconds": row["chart_time_seconds"] if chart else None,
            "timing_basis": row["basis"], "chart_clock_profile": row["profile"],
            "capture_offset_seconds": row["capture_offset_seconds"]} for row in rows]

    def values(self, source_id, value_ids):
        with self.lock:
            result = []
            ids = list(dict.fromkeys(value_ids))
            for start in range(0, len(ids), 500):
                chunk = ids[start:start + 500]
                rows = self.db.execute(f"""SELECT e.*,a.job_id absence_job,t.release_at,t.chart_time_seconds,
                    t.capture_offset_seconds,t.basis,t.profile FROM events e
                    LEFT JOIN event_timing t ON t.source_id=e.source_id AND t.value_id=e.value_id
                    LEFT JOIN query_absences a ON a.source_id=e.source_id AND a.value_id=e.value_id
                    WHERE e.source_id=? AND e.value_id IN ({','.join('?' for _ in chunk)})""", (source_id, *chunk)).fetchall()
                result.extend(self.event_rows(rows))
            return sorted(result, key=lambda event: (event['server_time_seconds'], event['value_id']))

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

    def query(self, source_id, start, end, currency=None, limit=1000, after_time=None, after_id=None, time_basis="raw", event_ids=None, r1_as_of=None, r1_history=False, currencies=None):
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
            if currencies:
                where += " AND e.currency IN (" + ",".join("?" for _ in currencies) + ")"
                params.extend(currencies)
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
            events = self.event_rows(rows, chart)
            if r1_as_of is not None or r1_history:
                vintages = self.r1_vintages(source_id, [row['value_id'] for row in rows])
                for event in events:
                    if event['currency'] == 'USD':
                        event['r1_vintages'] = vintages.get(event['value_id'], '[]')
            source = self.db.execute("SELECT server_now FROM sources WHERE id=?", (source_id,)).fetchone()
            scoped = (currency,) if currency else tuple(currencies) if currencies else CURRENCIES
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
