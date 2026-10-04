import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from storage.calendar_clock import broker_offset, project
from storage.calendar_store import CalendarStore, HISTORY_START
from storage.tests.test_calendar_storage import context, event, chunk, NOW


def at(text):
    return int(datetime.fromisoformat(text).replace(tzinfo=timezone.utc).timestamp())


class CalendarClockTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "calendar.sqlite3"
        self.store = CalendarStore(self.path, lambda: NOW - 10800)

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def test_native_clock_uses_historical_broker_dst_not_current_or_us_dst(self):
        for utc_text, chart_text in [
            ("2026-01-09T13:30:00", "2026-01-09T15:30:00"),
            ("2026-03-11T12:30:00", "2026-03-11T14:30:00"),
            ("2026-04-03T12:30:00", "2026-04-03T15:30:00"),
            ("2025-10-31T12:30:00", "2025-10-31T14:30:00"),
        ]:
            utc = at(utc_text)
            self.assertEqual(project("Elev8-Demo2", utc + 10800, 10800), (utc * 1000, at(chart_text)))
        transition = at("2026-03-29T01:00:00")
        self.assertEqual(broker_offset("Elev8-Demo2", transition - 1), 7200)
        self.assertEqual(broker_offset("Elev8-Demo2", transition), 10800)
        self.assertIsNone(broker_offset("Unknown-Broker", transition))
        self.assertEqual(project("Unknown-Broker", transition + 10800, 10800), (transition * 1000, None))

    def import_history(self, rows):
        manifest = {"calendar_from_timestamp": HISTORY_START, "calendar_to_timestamp": NOW,
            "snapshot_trade_server_timestamp": NOW, "snapshot_gmt_timestamp": NOW - 10800,
            "calendar_currencies": "EUR,USD"}
        self.store.import_rows("seed", "Elev8-Demo2", manifest, {}, rows)

    def test_chart_query_midnight_paging_raw_payload_and_reopen(self):
        # Summer export places a winter midnight event on the following raw
        # date. Both midnight boundary and keyset cursor use the chart clock.
        rows = [event(value_id=str(i), server_time_seconds=at("2026-01-10T00:30:00") + i * 60)
                for i in range(3)]
        self.import_history(rows)
        beginning = self.store.query("Elev8-Demo2", HISTORY_START, HISTORY_START + 86400, time_basis="chart")
        self.assertEqual(beginning["coverage"]["EUR"]["missing"], [], "Export capture clock certifies the full first historical day")
        raw_before = [tuple(row) for row in self.store.db.execute("SELECT * FROM observations ORDER BY value_id")]
        start, end = at("2026-01-09T00:00:00"), at("2026-01-10T00:00:00")
        raw = self.store.query("Elev8-Demo2", start, end)
        self.assertEqual(raw["events"], [])
        first = self.store.query("Elev8-Demo2", start, end, limit=1, time_basis="chart")
        self.assertEqual(first["events"][0]["server_time_seconds"], rows[0]["server_time_seconds"])
        self.assertEqual(first["events"][0]["chart_time_seconds"], at("2026-01-09T23:30:00"))
        self.assertEqual(first["events"][0]["release_at"], at("2026-01-09T21:30:00") * 1000)
        self.assertEqual(first["coverage"]["EUR"]["missing"], [])
        cursor = first["next_cursor"]
        second = self.store.query("Elev8-Demo2", start, end, limit=2, time_basis="chart", **cursor)
        self.assertEqual([row["value_id"] for row in second["events"]], ["1", "2"])
        self.assertIsNone(second["next_cursor"])
        self.store.close()
        self.store = CalendarStore(self.path)
        self.assertEqual(self.store.query("Elev8-Demo2", start, end, limit=1, time_basis="chart")["events"], first["events"])
        self.assertEqual([tuple(row) for row in self.store.db.execute("SELECT * FROM observations ORDER BY value_id")], raw_before)

    def test_existing_database_recovers_export_offset_without_mutating_evidence(self):
        self.import_history([event(server_time_seconds=at("2026-01-09T16:30:00"))])
        # Simulate the old service's provenance and absent derived timing.
        self.store.db.execute("UPDATE observations SET provenance=?", (json.dumps({"import_id": "seed"}),))
        self.store.db.execute("DROP TABLE event_timing")
        self.store.db.execute("PRAGMA user_version=1")
        self.store.db.commit()
        evidence = [tuple(row) for row in self.store.db.execute("SELECT * FROM observations")]
        self.store.close()
        self.store = CalendarStore(self.path)
        result = self.store.query("Elev8-Demo2", at("2026-01-09T00:00:00"), at("2026-01-10T00:00:00"), time_basis="chart")["events"][0]
        self.assertEqual(result["timing_basis"], "export-snapshot")
        self.assertEqual(result["chart_time_seconds"], at("2026-01-09T15:30:00"))
        self.assertEqual(evidence, [tuple(row) for row in self.store.db.execute("SELECT * FROM observations")])
        revision = self.store.status()["revision"]
        self.store.close()
        self.store = CalendarStore(self.path)
        self.assertEqual(self.store.status()["revision"], revision, "Migration is idempotent")

    def test_leased_capture_offset_survives_publisher_offset_change(self):
        job = self.store.next_job(context(source_id="Elev8-Demo2"))
        start, end = at("2026-01-09T00:00:00"), at("2026-01-10T00:00:00")
        self.store.db.execute("UPDATE jobs SET start=?,end=? WHERE id=?", (start, end, job["job_id"]))
        self.store.db.commit()
        self.store.register(context(source_id="Elev8-Demo2", server_utc_offset_seconds=7200))
        self.store.receive(chunk(job, [event(server_time_seconds=at("2026-01-09T16:30:00"))]))
        row = self.store.query("Elev8-Demo2", start, end, time_basis="chart")["events"][0]
        self.assertEqual(row["capture_offset_seconds"], 10800)
        self.assertEqual(row["release_at"], at("2026-01-09T13:30:00") * 1000)
        self.assertEqual(row["chart_time_seconds"], at("2026-01-09T15:30:00"))

    def test_date_only_events_remain_list_only_and_unknown_broker_is_not_guessed(self):
        self.import_history([event(time_mode=1, server_time_seconds=at("2026-01-09T16:30:00"))])
        row = self.store.query("Elev8-Demo2", at("2026-01-09T00:00:00"), at("2026-01-10T00:00:00"), time_basis="chart")["events"][0]
        self.assertIsNone(row["chart_time_seconds"])
        self.assertIsNone(row["release_at"])
        self.store.register(context())
        self.store.collect("Broker-Demo", [event()], "publisher-1")
        row = self.store.query("Broker-Demo", HISTORY_START, NOW, time_basis="chart")["events"][0]
        self.assertIsNone(row["chart_time_seconds"])
        self.assertIsNotNone(row["release_at"], "Recorded offset can establish UTC without guessing native candle DST")


if __name__ == "__main__":
    unittest.main()
