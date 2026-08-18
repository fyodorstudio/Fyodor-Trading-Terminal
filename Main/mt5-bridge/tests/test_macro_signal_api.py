from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

import server
from macro_signal import ACTIVE_VERSION_ID, VERSION_ID, V2_VERSION_ID
from research_store import ResearchStore


client = TestClient(server.app)


def event(timestamp: int) -> dict:
  return {
    "id": 77,
    "time": timestamp,
    "countryCode": "EU",
    "currency": "EUR",
    "title": "GDP q/q",
    "impact": "high",
    "actual": "2.0",
    "forecast": "1.5",
    "previous": "1.0",
  }


def test_research_coverage_reports_durable_currency_boundaries(tmp_path: Path, monkeypatch) -> None:
  store = ResearchStore(tmp_path / "research.sqlite3")
  store.upsert_calendar_events([event(100), {**event(200), "id": 78, "currency": "USD", "countryCode": "US"}], 300)
  monkeypatch.setattr(server, "_research_store", store)

  response = client.get("/research/coverage")

  assert response.status_code == 200
  payload = response.json()
  assert payload["durable"] is True
  assert payload["count"] == 2
  assert payload["earliest"] == 100
  assert payload["latest"] == 200
  assert payload["recommendedBackfill"]["lookBackDays"] == 10000


def test_start_backtest_records_one_background_job_without_running_it_inline(tmp_path: Path, monkeypatch) -> None:
  store = ResearchStore(tmp_path / "research.sqlite3")
  store.upsert_calendar_events([event(100)], 300)
  submitted = []

  class FakeExecutor:
    def submit(self, function, *args):
      submitted.append((function, args))

  monkeypatch.setattr(server, "_research_store", store)
  monkeypatch.setattr(server, "_research_executor", FakeExecutor())

  response = client.post("/research/backtests", json={"versionId": VERSION_ID})

  assert response.status_code == 200
  payload = response.json()
  assert payload["status"] == "queued"
  assert payload["cached"] is False
  assert len(submitted) == 1
  stored = store.get_backtest_run(payload["id"])
  assert stored and stored["status"] == "queued"


def test_unknown_signal_version_is_rejected(tmp_path: Path, monkeypatch) -> None:
  monkeypatch.setattr(server, "_research_store", ResearchStore(tmp_path / "research.sqlite3"))

  response = client.post("/research/backtests", json={"versionId": "made-up"})

  assert response.status_code == 400
  assert "Unsupported signal version" in response.text


def test_version_registry_exposes_failed_v1_and_active_country_aware_v2() -> None:
  response = client.get("/research/versions")

  assert response.status_code == 200
  versions = response.json()
  assert [row["id"] for row in versions] == [VERSION_ID, V2_VERSION_ID]
  active = next(row for row in versions if row["active"])
  assert active["id"] == ACTIVE_VERSION_ID
  assert active["configuration"]["seriesIdentity"] == "currency_country_code_normalized_title"
  assert active["configuration"]["historicalEligibility"] == "disabled_due_to_reused_history"
