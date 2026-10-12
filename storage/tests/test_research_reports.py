from datetime import datetime, timezone
import asyncio
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError

from storage.calendar_store import CalendarStore
from storage.contracts import CalendarEvent
from storage.research_reports import ResearchRequest, collect_evidence, save_report
from storage.app import create_app

START = int(datetime(2026, 9, 9, tzinfo=timezone.utc).timestamp())
DAY = 86400


def request(**overrides):
    return ResearchRequest.model_validate({"source_id": "Elev8-Demo2", "title": "EURUSD September research",
        "scope": "EURUSD", "kind": "historical", "from_date": "2026-09-09", "to_date": "2026-09-10",
        "from_utc_ms": START * 1000, "to_utc_ms": (START + 2 * DAY) * 1000, "timezone": "UTC",
        "context_days": 0, **overrides})


def event(value_id, at=START, **overrides):
    return CalendarEvent.model_validate({"value_id": str(value_id), "event_id": "987654321",
        "server_time_seconds": at + 10800, "period_seconds": START - 31 * DAY, "revision": 0,
        "currency": "EUR", "country_code": "EU", "country_name": "Euro area", "name": "New | series\nreading",
        "event_code": "new-series", "importance": "low", "unit": 1, "multiplier": 0, "digits": 3,
        "time_mode": 0, "impact": "none", "actual": .3, "forecast": .4, "previous": .1,
        "revised_previous": .2, "actual_raw_scaled_1e6": "300001", **overrides}).model_dump()


class ResearchReportsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name)
        self.store = CalendarStore(self.directory / "data" / "calendar.sqlite3", lambda: START + 10 * DAY)
        with self.store.lock, self.store.db:
            self.store._source("Elev8-Demo2", START + 10 * DAY)
            self.store.db.execute("UPDATE sources SET offset_seconds=10800 WHERE id='Elev8-Demo2'")
            for currency in ("EUR", "USD"):
                self.store._coverage("Elev8-Demo2", currency, START - 180 * DAY, START + 10 * DAY, START + 10 * DAY, "seed")

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def add(self, rows):
        with self.store.lock, self.store.db:
            for row in rows:
                self.store._observe("Elev8-Demo2", row, "test", START + 10 * DAY, {"capture_offset_seconds": 10800})

    def test_all_pages_all_series_currencies_and_exact_values_without_inventory_changes(self):
        self.add([event(i, currency="EUR" if i % 2 else "USD", country_code="EU" if i % 2 else "US") for i in range(5003)])
        self.add([event("other", currency="JPY", country_code="JP"), event("outside", at=START + 2 * DAY), event("before", at=START - 1)])
        before = self.store.db.execute("SELECT count(*) FROM observations").fetchone()[0]
        result = save_report(self.store, request(), self.directory / "report")
        self.assertEqual(result["readings"], 5003)
        self.assertFalse(result["coverage_incomplete"])
        text = Path(result["path"]).read_text(encoding="utf-8")
        self.assertIn("0.300001%", text)
        self.assertIn("+0.200001 pp", text)
        self.assertIn("-0.099999 pp", text)
        self.assertIn("New \\| series reading", text)
        for excluded in ("other", "outside", "before"):
            self.assertNotIn(f"| {excluded} |", text)
        self.assertEqual(self.store.db.execute("SELECT count(*) FROM observations").fetchone()[0], before)

    def test_context_date_only_missing_values_revisions_absence_and_gaps(self):
        self.add([event("context", at=START - 10 * DAY), event("selected", revision=2),
                  event("date-only", at=START + DAY - 10800, time_mode=1, actual=None, actual_raw_scaled_1e6=None),
                  event("pending", at=START + DAY, actual=None, actual_raw_scaled_1e6=None, forecast=None)])
        with self.store.db:
            self.store.db.execute("INSERT INTO query_absences VALUES (?,?,?,?)", ("Elev8-Demo2", "selected", "missing-query", START))
            self.store.db.execute("DELETE FROM coverage WHERE currency='USD'")
        result = save_report(self.store, request(context_days=30, kind="upcoming", focus="Fed decision", focus_ids=["840050014"]), self.directory / "report")
        self.assertEqual(result["readings"], 3)
        self.assertEqual(result["context_readings"], 1)
        self.assertTrue(result["coverage_incomplete"])
        text = Path(result["path"]).read_text(encoding="utf-8")
        self.assertIn("2026-09-10 (source date; hour unverified)", text)
        self.assertIn("not-returned-by-latest-query", text)
        self.assertIn("## Preceding context", text)
        self.assertIn("Event IDs: 840050014", text)
        self.assertIn("Blank values remain unavailable", text)
        self.assertIn("- USD:", text)

    def test_display_day_edges_and_date_only_do_not_use_guessed_hours(self):
        self.add([event("before", at=START - 7 * 3600 - 1), event("start", at=START - 7 * 3600),
                  event("last", at=START + 2 * DAY - 7 * 3600 - 1), event("end", at=START + 2 * DAY - 7 * 3600),
                  event("date-only-last", at=START + DAY - 10800, time_mode=1)])
        selected, _, _, _ = collect_evidence(self.store, request(from_utc_ms=(START - 7 * 3600) * 1000,
            to_utc_ms=(START + 2 * DAY - 7 * 3600) * 1000, timezone="UTC+07:00"))
        self.assertEqual({row["value_id"] for row in selected}, {"start", "last", "date-only-last"})

    def test_safe_unique_names_unknown_source_and_invalid_requests(self):
        seed = request(title="../CON:<test>\\report")
        first = save_report(self.store, seed, self.directory / "report")
        second = save_report(self.store, seed, self.directory / "report")
        self.assertNotEqual(first["path"], second["path"])
        self.assertEqual(Path(first["path"]).parent, (self.directory / "report").resolve())
        self.assertIn("No stored releases", Path(first["path"]).read_text(encoding="utf-8"))
        with self.assertRaises(HTTPException) as error:
            save_report(self.store, request(source_id="unknown"), self.directory / "report")
        self.assertEqual(error.exception.status_code, 404)
        for invalid in ({"scope": "EURJPYUSD"}, {"scope": "USDUSD"}, {"scope": "XYZ"}, {"title": " "},
                        {"to_utc_ms": START * 1000}, {"from_utc_ms": (START - 4 * DAY) * 1000}):
            with self.assertRaises(ValidationError):
                request(**invalid)

    def test_http_endpoint_validates_scope_and_returns_saved_path(self):
        self.add([event("selected")])
        app = create_app(self.directory / "data", run_collector=False)
        app.state.store = self.store

        async def post(body):
            messages = []
            async def receive():
                return {"type": "http.request", "body": json.dumps(body).encode(), "more_body": False}
            async def send(message):
                messages.append(message)
            await app({"type": "http", "http_version": "1.1", "method": "POST", "scheme": "http",
                "path": "/api/v1/reports", "raw_path": b"/api/v1/reports", "query_string": b"",
                "headers": [(b"content-type", b"application/json")], "client": ("127.0.0.1", 1),
                "server": ("127.0.0.1", 8002)}, receive, send)
            return messages[0]["status"], json.loads(messages[1]["body"])

        with patch("storage.app.save_report", side_effect=lambda store, payload: save_report(store, payload, self.directory / "report")):
            status, body = asyncio.run(post(request().model_dump(mode="json")))
            self.assertEqual(status, 200)
            self.assertEqual(body["readings"], 1)
            self.assertTrue(Path(body["path"]).is_file())
            status, _ = asyncio.run(post({**request().model_dump(mode="json"), "families": ["us-cpi"]}))
            self.assertEqual(status, 422, "A client cannot silently constrain the export with display filters")
            status, _ = asyncio.run(post(request(source_id="unknown").model_dump(mode="json")))
            self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
