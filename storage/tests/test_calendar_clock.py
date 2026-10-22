import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from storage.calendar_clock import broker_offset, project, chart_utc
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
            "calendar_currencies": "EUR,USD,JPY"}
        self.store.import_rows("seed", "Elev8-Demo2", manifest, {}, rows)

    def test_pepperstone_uses_us_dst_and_rebuilds_only_derived_clocks(self):
        for text, offset in [('2015-01-09T13:30:00', 7200), ('2015-07-09T12:30:00', 10800),
                             ('2026-03-11T12:30:00', 10800), ('2026-10-28T12:30:00', 10800),
                             ('2026-11-04T13:30:00', 7200)]:
            self.assertEqual(broker_offset('Pepperstone-Demo', at(text)), offset)
            self.assertEqual(chart_utc('Pepperstone-Demo', at(text)+offset), at(text))
        for boundary in ['2026-03-08T07:00:00', '2026-11-01T06:00:00']:
            stamp = at(boundary)
            self.assertNotEqual(broker_offset('Pepperstone-Demo', stamp-1), broker_offset('Pepperstone-Demo', stamp))
        self.assertIsNone(broker_offset('Pepperstone-Lookalike', at('2026-10-23T12:00:00')))
        self.assertIsNone(chart_utc('Pepperstone-Lookalike', at('2026-10-23T12:00:00')))
        self.assertIsNone(chart_utc('Pepperstone-Demo', at('2026-03-08T09:30:00')))
        self.assertIsNone(chart_utc('Pepperstone-Demo', at('2026-11-01T08:30:00')))
        self.assertIsNone(broker_offset('Pepperstone-Demo', at('2032-01-01T12:00:00')))
        manifest = {'calendar_from_timestamp': HISTORY_START, 'calendar_to_timestamp': NOW,
                    'snapshot_trade_server_timestamp': NOW, 'snapshot_gmt_timestamp': NOW-10800,
                    'calendar_currencies': 'EUR,USD,JPY'}
        utc = at('2026-01-09T21:30:00')
        rows = [event(value_id='winter', server_time_seconds=utc+10800),
                event(value_id='date-only', time_mode=1, server_time_seconds=utc+10800)]
        self.store.import_rows('pepper-export', 'Pepperstone-Demo', manifest, {}, rows)
        self.store.db.execute("UPDATE event_timing SET profile=NULL,chart_time_seconds=NULL WHERE source_id='Pepperstone-Demo'")
        self.store.db.commit()
        evidence = [tuple(r) for r in self.store.db.execute('SELECT * FROM observations')]
        payloads = [tuple(r) for r in self.store.db.execute('SELECT * FROM events')]
        self.store.close()
        self.store = CalendarStore(self.path)
        page = self.store.query('Pepperstone-Demo', at('2026-01-09T00:00:00'), at('2026-01-10T00:00:00'), time_basis='chart')
        row = next(e for e in page['events'] if e['value_id']=='winter')
        self.assertEqual((row['release_at'], row['chart_time_seconds']), (utc*1000, utc+7200))
        self.assertEqual(row['chart_clock_profile'], 'pepperstone-ny-close-v1')
        uncertain = self.store.values('Pepperstone-Demo', ['date-only'])[0]
        self.assertIsNone(uncertain['release_at'])
        self.assertIsNone(uncertain['chart_time_seconds'])
        self.assertEqual(evidence, [tuple(r) for r in self.store.db.execute('SELECT * FROM observations')])
        self.assertEqual(payloads, [tuple(r) for r in self.store.db.execute('SELECT * FROM events')])
        revision = self.store.status()['revision']
        self.store.close()
        self.store = CalendarStore(self.path)
        self.assertEqual(self.store.status()['revision'], revision)

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

    def test_date_only_events_keep_null_exact_clocks_and_unknown_broker_is_not_guessed(self):
        self.import_history([event(time_mode=1, server_time_seconds=at("2026-01-09T16:30:00"))])
        row = self.store.query("Elev8-Demo2", at("2026-01-09T00:00:00"), at("2026-01-10T00:00:00"), time_basis="chart")["events"][0]
        self.assertIsNone(row["chart_time_seconds"])
        self.assertIsNone(row["release_at"])
        self.store.register(context())
        self.store.collect("Broker-Demo", [event()], "publisher-1")
        row = self.store.query("Broker-Demo", HISTORY_START, NOW, time_basis="chart")["events"][0]
        self.assertIsNone(row["chart_time_seconds"])
        self.assertIsNotNone(row["release_at"], "Recorded offset can establish UTC without guessing native candle DST")

    def test_boj_tentative_series_has_a_clock_after_numeric_publication(self):
        stamp = 1789710840  # Supplied publication clock for stored MT5 value 264440.
        self.import_history([event(value_id='264440', event_id='392060022', currency='JPY', country_code='JP',
            name='BoJ Interest Rate Decision', time_mode=3, actual=1.3, previous=1.0, server_time_seconds=stamp),
            event(value_id='future', time_mode=3, actual=None, server_time_seconds=stamp),
            event(value_id='date-only', time_mode=3, actual=1.3, server_time_seconds=at('2026-09-18T00:00:00'))])
        evidence = [tuple(row) for row in self.store.db.execute('SELECT * FROM observations ORDER BY value_id')]
        rows = {row['value_id']: row for row in self.store.query('Elev8-Demo2', stamp-86400, stamp+86400, time_basis='chart')['events']}
        self.assertEqual(rows['264440']['chart_time_seconds'], stamp)
        self.assertEqual(rows['264440']['release_at'], (stamp-10800)*1000)
        self.assertEqual(rows['264440']['time_mode'], 3)
        # Older inventories discarded this derived clock. Recover it once,
        # preserving raw observations and native midnight paging semantics.
        self.store.db.execute("UPDATE event_timing SET release_at=NULL,chart_time_seconds=NULL WHERE value_id='264440'")
        self.store.db.commit()
        self.store.close()
        self.store = CalendarStore(self.path)
        recovered = self.store.query('Elev8-Demo2', stamp-86400, stamp+86400, time_basis='chart')['events']
        self.assertEqual(next(row for row in recovered if row['value_id']=='264440')['chart_time_seconds'], stamp)
        revision = self.store.status()['revision']
        self.store.close()
        self.store = CalendarStore(self.path)
        self.assertEqual(self.store.status()['revision'], revision)
        for id in ['future', 'date-only']:
            self.assertIsNone(rows[id]['release_at'])
            self.assertIsNone(rows[id]['chart_time_seconds'])
        self.assertEqual(evidence, [tuple(row) for row in self.store.db.execute('SELECT * FROM observations ORDER BY value_id')])


if __name__ == "__main__":
    unittest.main()
