from __future__ import annotations

import csv
import json
import socket
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import uvicorn

from storage.app import create_app
from storage.archive_import import import_export
from storage.bridge_collector import BridgeCollector
from storage.calendar_store import CalendarStore, DAY, HISTORY_START, missing_intervals
from storage.contracts import BackfillChunk, BackfillFailure, CalendarEvent, PublisherContext

NOW = 1790993976


def context(**overrides):
    return PublisherContext.model_validate({"protocol_version": 1, "publisher_version": "2.0.0",
        "source_id": "Broker-Demo", "instance_id": "publisher-1", "server_time_seconds": NOW,
        "server_utc_offset_seconds": 10800, **overrides})


def event(**overrides):
    return CalendarEvent.model_validate({"value_id": "9223372036854775001", "event_id": "840030005",
        "server_time_seconds": NOW - 29 * DAY, "period_seconds": 1785542400, "revision": 0,
        "currency": "EUR", "country_code": "EU", "country_name": "European Union", "name": "Price reading",
        "event_code": "price-reading", "importance": "high", "unit": 1, "multiplier": 0, "digits": 3,
        "time_mode": 0, "impact": "none", "actual": 0, "previous": .1, **overrides}).model_dump()


def chunk(job, rows=(), index=0, count=1, total=None):
    return BackfillChunk.model_validate({"protocol_version": 1, "job_id": job["job_id"], "lease_token": job["lease_token"],
        "chunk_index": index, "chunk_count": count, "event_count": len(rows) if total is None else total, "events": list(rows)})


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "calendar.sqlite3"
        self.time = 2000000000.0
        self.store = CalendarStore(self.path, lambda: self.time)

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def query(self, **overrides):
        return self.store.query("Broker-Demo", HISTORY_START, NOW + 60 * DAY, **overrides)

    def test_atomic_chunks_restart_and_lost_final_ack(self):
        job = self.store.next_job(context())
        row = event()
        first = chunk(job, [row], count=2, total=2)
        self.assertFalse(self.store.receive(first)["committed"])
        self.assertEqual(self.query()["events"], [])
        self.store.close()
        self.store = CalendarStore(self.path, lambda: self.time)
        self.assertFalse(self.store.receive(first)["committed"])
        second = chunk(job, [event(value_id="2")], index=1, count=2, total=2)
        self.assertTrue(self.store.receive(second)["committed"])
        self.assertTrue(self.store.receive(second)["committed"], "A lost commit reply can be retried")
        self.assertEqual(len(self.query()["events"]), 2)
        self.assertEqual(self.store.db.execute("SELECT count(*) FROM coverage").fetchone()[0], 1)

    def test_restart_new_publisher_reissues_only_incomplete_batch(self):
        first = self.store.next_job(context())
        self.store.receive(chunk(first))
        second = self.store.next_job(context())
        self.store.receive(chunk(second, [event(currency=second["currency"], server_time_seconds=second["from_server_seconds"])], count=2, total=2))
        self.store.close()
        self.store = CalendarStore(self.path, lambda: self.time)
        resumed = self.store.next_job(context(instance_id="publisher-2"))
        self.assertEqual(resumed["job_id"], second["job_id"])
        self.assertNotEqual(resumed["lease_token"], second["lease_token"])
        with self.assertRaisesRegex(ValueError, "superseded"):
            self.store.receive(chunk(second))
        self.store.receive(chunk(resumed))
        self.assertEqual(self.store.db.execute("SELECT count(*) FROM jobs WHERE state='complete'").fetchone()[0], 2)

    def test_bad_currency_date_count_duplicate_and_mutated_retry_are_rejected(self):
        job = self.store.next_job(context())
        for row in (event(currency="USD"), event(server_time_seconds=HISTORY_START)):
            with self.assertRaisesRegex(ValueError, "scope"):
                self.store.receive(chunk(job, [row]))
        with self.assertRaisesRegex(ValueError, "duplicate"):
            self.store.receive(chunk(job, [event(), event()]))
        with self.assertRaisesRegex(ValueError, "count mismatch"):
            self.store.receive(chunk(job, [event()], total=2))
        self.store.receive(chunk(job, [event()], count=2, total=2))
        with self.assertRaisesRegex(ValueError, "Retry changed"):
            self.store.receive(chunk(job, [event(actual=9)], count=2, total=2))
        self.assertEqual(self.store.db.execute("SELECT count(*) FROM coverage").fetchone()[0], 0)

    def test_empty_days_are_covered_and_live_rows_do_not_certify_a_window(self):
        job = self.store.next_job(context())
        self.store.collect("Broker-Demo", [event()], "publisher-1")
        self.assertEqual(self.store.db.execute("SELECT count(*) FROM coverage").fetchone()[0], 0)
        self.store.receive(chunk(job))
        result = self.store.query("Broker-Demo", job["from_server_seconds"], job["to_server_seconds"], currency="EUR")
        self.assertEqual(result["coverage"]["EUR"]["missing"], [])

    def test_timeout_shrinks_batch_and_backoff_survives_restart(self):
        job = self.store.next_job(context())
        self.store.fail(BackfillFailure(protocol_version=1, job_id=job["job_id"], lease_token=job["lease_token"], error_code=5401))
        other = self.store.next_job(context())
        self.assertTrue(other["available"], "A cooling EUR job must not block USD")
        self.assertNotEqual(other["job_id"], job["job_id"])
        self.store.receive(chunk(other))
        self.store.close()
        self.store = CalendarStore(self.path, lambda: self.time)
        self.time += 6
        retry = self.store.next_job(context())
        self.assertEqual(retry["job_id"], job["job_id"])
        self.assertLess(retry["to_server_seconds"] - retry["from_server_seconds"], 7 * DAY)
        self.assertEqual(self.store.status()["pending_jobs"][0]["attempts"], 1)

    def test_failing_future_job_does_not_starve_historical_gap_or_duplicate_reserved_interval(self):
        with self.store.lock, self.store.db:
            for currency in ("EUR", "USD"):
                self.store._source("Broker-Demo", NOW)
                self.store._coverage("Broker-Demo", currency, HISTORY_START, NOW - 35 * DAY, NOW, "archive")
                self.store._coverage("Broker-Demo", currency, NOW - 30 * DAY, NOW + 60 * DAY, NOW, "live-window")
        failed = self.store.next_job(context())
        self.assertGreaterEqual(failed["from_server_seconds"], NOW + 60 * DAY)
        self.store.fail(BackfillFailure(protocol_version=1, job_id=failed["job_id"], lease_token=failed["lease_token"], error_code=4001))
        jobs = [failed]
        for _ in range(8):
            job = self.store.next_job(context())
            if not job["available"]:
                break
            jobs.append(job)
            self.store.receive(chunk(job))
        self.assertTrue(any(job["from_server_seconds"] == NOW - 35 * DAY for job in jobs))
        status = self.store.status()
        self.assertTrue(status["pending_jobs"], "Failed dates stay visibly pending")
        for currency in ("EUR", "USD"):
            self.assertEqual(self.store.query("Broker-Demo", NOW - 35 * DAY, NOW - 30 * DAY, currency)["coverage"][currency]["missing"], [])
        self.assertEqual(len({job["job_id"] for job in jobs}), len(jobs))

    def test_revision_tracks_data_changes_and_survives_reopen(self):
        self.store.register(context())
        before = self.store.status()["revision"]
        self.store.collect("Broker-Demo", [event()], "publisher-1")
        revision = self.query()["revision"]
        self.assertGreater(revision, before)
        self.store.collect("Broker-Demo", [event()], "publisher-1")
        self.assertEqual(self.query()["revision"], revision)
        self.store.close()
        self.store = CalendarStore(self.path, lambda: self.time)
        self.assertEqual(self.query()["revision"], revision)

    def test_long_absence_expired_future_coverage_and_recent_priority(self):
        with self.store.lock, self.store.db:
            self.store._source("Broker-Demo", NOW)
            self.store._coverage("Broker-Demo", "EUR", HISTORY_START, NOW + 60 * DAY, NOW, "old")
            self.store._coverage("Broker-Demo", "USD", HISTORY_START, NOW + 60 * DAY, NOW, "old")
        later = context(server_time_seconds=NOW + 150 * DAY, instance_id="returning")
        job = self.store.next_job(later)
        self.assertEqual(job["from_server_seconds"], later.server_time_seconds - 30 * DAY)
        missing = self.store.status()["sources"][0]["coverage"]["EUR"]["missing"]
        self.assertEqual(missing[0][0], NOW - 30 * DAY, "Stored future coverage must not hide missed releases")
        self.assertTrue(any(left <= NOW <= right for left, right in missing))
        missed_release = NOW + 45 * DAY
        for _ in range(150):
            if not job["available"]:
                break
            rows = [event(currency="USD", server_time_seconds=missed_release)] if job["currency"] == "USD" and job["from_server_seconds"] <= missed_release < job["to_server_seconds"] else []
            self.store.receive(chunk(job, rows))
            job = self.store.next_job(later)
        else:
            self.fail("Recovery did not finish its bounded date batches")
        self.assertFalse(job["available"])
        coverage = self.store.status()["sources"][0]["coverage"]
        self.assertEqual(coverage["EUR"]["missing"], [])
        self.assertEqual(coverage["USD"]["missing"], [])
        recovered = self.store.query("Broker-Demo", missed_release, missed_release + 1)["events"]
        self.assertEqual(len(recovered), 1, "A release older than DaysBack is recovered through backfill")

    def test_unchanged_live_rows_keep_raw_precision(self):
        self.store.register(context())
        raw = event(actual=.008, actual_raw_scaled_1e6="8000")
        self.store.collect("Broker-Demo", [raw], "publisher-1")
        self.store.collect("Broker-Demo", [event(actual=.008)], "publisher-1")
        self.assertEqual(self.query()["events"][0]["actual_raw_scaled_1e6"], "8000")
        self.assertEqual(self.store.db.execute("SELECT count(*) FROM observations").fetchone()[0], 1)

    def test_query_absence_is_explicit_without_erasing_history_or_newer_live_updates(self):
        self.store.register(context())
        self.store.collect("Broker-Demo", [event(), event(value_id="newer")], "publisher-1")
        self.time += 1
        job = self.store.next_job(context())
        self.time += 1
        self.store.collect("Broker-Demo", [event(value_id="newer", actual=.8)], "publisher-1")
        self.store.receive(chunk(job))
        rows = {row["value_id"]: row for row in self.query()["events"]}
        self.assertEqual(rows[event()["value_id"]]["availability"], "not-returned-by-latest-query")
        self.assertEqual(rows["newer"]["availability"], "observed")
        self.assertEqual(rows["newer"]["actual"], .8)
        # An unchanged copy of the older bridge cache is not proof of reappearance.
        self.store.collect("Broker-Demo", [event()], "publisher-1")
        self.assertEqual(self.query()["events"][0]["availability"], "not-returned-by-latest-query")
        self.time += 1
        self.store.collect("Broker-Demo", [event(actual=.9)], "publisher-1")
        self.assertEqual(self.query()["events"][0]["availability"], "observed")

    def test_newer_live_update_wins_backfill_and_old_bridge_snapshot(self):
        job = self.store.next_job(context())
        self.time += 2
        self.store.collect("Broker-Demo", [event(actual=.4)], "publisher-1", self.time)
        self.store.receive(chunk(job, [event(actual=.2)]))
        self.assertEqual(self.query()["events"][0]["actual"], .4)
        self.store.collect("Broker-Demo", [event(actual=.1)], "publisher-1", self.time - 3)
        self.assertEqual(self.query()["events"][0]["actual"], .4)
        self.assertEqual(self.store.db.execute("SELECT count(*) FROM observations").fetchone()[0], 3)

    def test_exact_raw_missing_revisions_pagination_and_broker_separation(self):
        self.store.register(context())
        rows = [event(value_id=str(i), actual_raw_scaled_1e6="8000", actual=.01) for i in range(3)]
        rows.append(event(value_id="missing", actual=None, revised_previous=.2))
        self.store.collect("Broker-Demo", rows, "publisher-1")
        self.store.register(context(source_id="Another-Broker"))
        self.store.collect("Another-Broker", [event(actual=8)], "publisher-1")
        first = self.query(limit=2)
        self.assertEqual(first["events"][0]["actual"], .008)
        self.assertEqual(first["events"][0]["actual_raw_scaled_1e6"], "8000")
        self.assertIsNone(first["events"][0]["release_at"], "Historical UTC must not be fabricated")
        second = self.query(limit=2, **first["next_cursor"])
        self.assertEqual([e["value_id"] for e in first["events"] + second["events"]], ["0", "1", "2", "missing"])
        self.assertIsNone(second["events"][1]["actual"])
        self.assertEqual(second["events"][1]["previous"], .1)
        self.assertEqual(second["events"][1]["revised_previous"], .2)

    def test_collector_generation_validation_and_failure_preserves_history(self):
        self.store.register(context())
        health = {"instance_id": "publisher-1", "last_snapshot_at": 1, "last_update_at": 2000000000000, "event_count": 1}
        responses = {"/health": {"calendar": health}, "/calendar": {"source": health, "events": [{**event(), "release_at": 123}]}}
        calls = []
        def fetch(path):
            calls.append(path)
            return responses[path]
        collector = BridgeCollector(self.store, fetch=fetch)
        collector.poll()
        collector.poll()
        self.assertEqual(calls.count("/calendar"), 1)
        self.assertEqual(len(self.query()["events"]), 1)
        responses["/health"] = {"calendar": {**health, "instance_id": "unregistered"}}
        collector.poll()
        self.assertEqual(calls.count("/calendar"), 1)
        responses.clear()
        collector.poll()
        self.assertIsNotNone(collector.error)
        self.assertEqual(len(self.query()["events"]), 1)


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.folder = self.root / "export"
        self.folder.mkdir()
        self.store = CalendarStore(self.root / "calendar.sqlite3")
        self.manifest = {"schema_version": "fyodor-mt5-research-export/4.0.0", "export_id": "test_export",
            "account_server": "Broker-Demo", "timestamp_convention": "trade_server_time", "calendar_completed": "true",
            "calendar_from_timestamp": str(HISTORY_START), "calendar_to_timestamp": str(NOW), "calendar_to_server_text": "2026.10.03",
            "snapshot_trade_server_timestamp": str(NOW), "snapshot_gmt_timestamp": str(NOW - 10800),
            "calendar_currencies": "EUR", "calendar_events_exported": "1", "calendar_releases_exported": "1"}
        for key in ("calendar_country_lookup_failures", "calendar_event_query_failures", "calendar_currencies_without_events",
                    "calendar_value_query_failures", "calendar_event_id_mismatches"):
            self.manifest[key] = "0"
        self.write("manifest.csv", [{"key": key, "value": value} for key, value in self.manifest.items()])
        self.write("calendar_events.csv", [{"event_id": "1", "country_name": "European Union", "unit_code": "1", "multiplier_code": "0", "time_mode_code": "0"}])
        self.release = {"value_id": "9223372036854775001", "event_id": "1", "value_event_id": "1", "country_lookup_ok": "true",
            "timestamp": str(NOW - DAY), "period": "", "revision": "0", "currency": "EUR", "country_code": "EU", "event_name": 'A, "quoted" event',
            "event_code": "reading", "importance": "medium", "digits": "3", "impact_type_code": "0", "timestamp_convention": "trade_server_time"}
        for field in ("actual", "forecast", "previous", "revised_previous"):
            self.release[field] = "0.01" if field == "actual" else ""
            self.release[field + "_raw_scaled_1e6"] = "8000" if field == "actual" else ""
        self.write("calendar_releases.csv", [self.release])
        self.write("calendar_currencies.csv", [{"currency": "EUR", "releases": "1", "status": "ok", "query_error": "0"}])

    def write(self, name, rows):
        with (self.folder / name).open("w", encoding="utf-8", newline="") as stream:
            writer = csv.DictWriter(stream, list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def test_import_copy_exact_values_idempotence_and_no_source_mutation(self):
        before = {p.name: p.read_bytes() for p in self.folder.iterdir()}
        result = import_export(self.store, self.folder, self.root / "inventory")
        self.assertEqual(result["rows"], 1)
        self.assertTrue(import_export(self.store, self.folder, self.root / "inventory")["already_imported"])
        row = self.store.query("Broker-Demo", HISTORY_START, NOW)["events"][0]
        self.assertEqual(row["actual"], .008)
        self.assertEqual(row["name"], 'A, "quoted" event')
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.folder.iterdir()})
        self.assertEqual(self.store.db.execute("SELECT count(*) FROM imports").fetchone()[0], 1)
        changed = {**self.release, "actual_raw_scaled_1e6": "9000"}
        self.write("calendar_releases.csv", [changed])
        with self.assertRaisesRegex(ValueError, "refusing to overwrite"):
            import_export(self.store, self.folder, self.root / "inventory")

    def test_incomplete_manifest_and_duplicate_rows_never_publish(self):
        self.manifest["calendar_completed"] = "false"
        self.write("manifest.csv", [{"key": k, "value": v} for k, v in self.manifest.items()])
        with self.assertRaisesRegex(ValueError, "incomplete"):
            import_export(self.store, self.folder, self.root / "inventory")
        self.manifest["calendar_completed"] = "true"
        self.write("manifest.csv", [{"key": k, "value": v} for k, v in self.manifest.items()])
        self.write("calendar_releases.csv", [self.release, self.release])
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            import_export(self.store, self.folder, self.root / "inventory")
        self.assertEqual(self.store.db.execute("SELECT count(*) FROM imports").fetchone()[0], 0)


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        app = create_app(Path(cls.temp.name), run_collector=False)
        cls.ready = threading.Event()
        class Server(uvicorn.Server):
            async def startup(self, sockets=None):
                await super().startup(sockets)
                cls.ready.set()
        cls.sock = socket.socket()
        cls.sock.bind(("127.0.0.1", 0))
        cls.url = f"http://127.0.0.1:{cls.sock.getsockname()[1]}"
        cls.server = Server(uvicorn.Config(app, log_level="error", access_log=False))
        cls.thread = threading.Thread(target=lambda: cls.server.run(sockets=[cls.sock]), daemon=True)
        cls.thread.start()
        if not cls.ready.wait(10):
            raise RuntimeError("Test storage server did not start")

    @classmethod
    def tearDownClass(cls):
        cls.server.should_exit = True
        cls.thread.join(10)
        cls.sock.close()
        cls.temp.cleanup()

    def request(self, path, body=None):
        request = Request(self.url + "/api/v1" + path, data=json.dumps(body).encode() if body is not None else None,
                          headers={"Content-Type": "application/json"})
        try:
            with urlopen(request, timeout=5) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    def test_real_http_job_validation_commit_and_stored_query(self):
        status, job = self.request("/jobs/next", context().model_dump())
        self.assertEqual(status, 200)
        self.assertTrue(job["available"])
        status, _ = self.request("/jobs/chunk", chunk(job, [event(currency="USD")]).model_dump())
        self.assertEqual(status, 409)
        status, result = self.request("/jobs/chunk", chunk(job, [event()]).model_dump())
        self.assertEqual((status, result["committed"]), (200, True))
        status, result = self.request(f"/calendar?source_id=Broker-Demo&from_server_seconds={HISTORY_START}&to_server_seconds={NOW}")
        self.assertEqual(status, 200)
        self.assertEqual(len(result["events"]), 1)
        self.assertEqual(self.request("/calendar?source_id=Broker-Demo&from_server_seconds=2&to_server_seconds=1")[0], 422)
        self.assertEqual(self.request("/jobs/next", {**context().model_dump(), "publisher_version": "1.0.0"})[0], 422)
        self.assertEqual(self.request("/health")[1]["service_version"], "1.1.0")
        self.assertEqual(self.request("/calendar?source_id=Broker-Demo&from_server_seconds=0&to_server_seconds=2000000000&time_basis=chart")[1]["time_basis"], "chart")


if __name__ == "__main__":
    unittest.main()
