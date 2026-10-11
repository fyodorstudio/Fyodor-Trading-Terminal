from __future__ import annotations

from ..currencies import CURRENCIES
import json
from ..calendar_clock import PROFILES, project
from .support import canonical, DAY, HISTORY_START, merged_intervals


class StoreCoverage:

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
                imported = {row[0] for row in self.db.execute(
                    "SELECT DISTINCT currency FROM coverage WHERE source_id=? AND reference=?", (source_id, import_id))}
                currencies = set(CURRENCIES).intersection(manifest["calendar_currencies"].split(",")) - imported
                if not currencies:
                    return {"already_imported": True, "rows": existing["row_count"], "source_id": source_id}
            else:
                currencies = set(CURRENCIES).intersection(manifest["calendar_currencies"].split(","))
            self._source(source_id, server_now)
            count = 0
            for event in rows:
                if event["currency"] not in currencies:
                    continue
                if not start <= event["server_time_seconds"] < end:
                    raise ValueError("Archive release lies outside its manifest interval")
                self._observe(source_id, event, "archive", observed_at, {"import_id": import_id,
                    "capture_offset_seconds": server_now - observed_at}, priority=0)
                count += 1
            count += existing["row_count"] if existing else 0
            if existing:
                self.db.execute("UPDATE imports SET row_count=? WHERE id=?", (count, import_id))
            else:
                self.db.execute("INSERT INTO imports VALUES (?,?,?,?,?,?)",
                                (import_id, source_id, canonical(manifest), canonical(hashes), self.clock(), count))
            for currency in currencies:
                self._coverage(source_id, currency, start, end, server_now, import_id)
            return {"already_imported": False, "rows": count, "source_id": source_id}
