from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

import server
from macro_signal import ACTIVE_VERSION_ID, GROWTH_VERSION_ID, POLICY_INFLATION_VERSION_ID, SENTIMENT_VERSION_ID, VERSION_ID, V2_VERSION_ID
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
  assert [row["id"] for row in versions] == [VERSION_ID, V2_VERSION_ID, SENTIMENT_VERSION_ID, POLICY_INFLATION_VERSION_ID, GROWTH_VERSION_ID]
  active = next(row for row in versions if row["active"])
  assert active["id"] == ACTIVE_VERSION_ID
  assert active["configuration"]["seriesIdentity"] == "currency_country_code_normalized_title"
  assert active["configuration"]["historicalEligibility"] == "disabled_due_to_reused_history"


def test_policy_inflation_source_has_an_independent_forward_ledger(tmp_path: Path, monkeypatch) -> None:
  monkeypatch.setattr(server, "_research_store", ResearchStore(tmp_path / "research.sqlite3"))

  response = client.get("/research/forward", params={"versionId": POLICY_INFLATION_VERSION_ID})

  assert response.status_code == 200
  payload = response.json()
  assert payload["versionId"] == POLICY_INFLATION_VERSION_ID
  assert payload["immutable"] is True
  assert payload["activatedAt"] > 0


def test_growth_source_has_an_independent_forward_ledger(tmp_path: Path, monkeypatch) -> None:
  monkeypatch.setattr(server, "_research_store", ResearchStore(tmp_path / "research.sqlite3"))

  response = client.get("/research/forward", params={"versionId": GROWTH_VERSION_ID})

  assert response.status_code == 200
  assert response.json()["versionId"] == GROWTH_VERSION_ID


def test_expansion_report_uses_actual_current_catalog_not_declared_candidates(monkeypatch) -> None:
  class FakeStore:
    def __init__(self) -> None:
      self.metadata = {}

    def latest_backtest_run(self, version_id: str) -> dict:
      return {
        "id": f"run-{version_id}",
        "status": "completed",
        "result": {
          "targets": {
            "1.0": {"outcomes": []},
            "1.5": {"outcomes": []},
            "2.0": {"outcomes": []},
          },
          "candidateSummary": {"developmentHoldoutBoundary": 100},
        },
      }

    def query_candles(self, _symbol: str, _timeframe: str, _from: int, _to: int) -> list[dict]:
      return [{"time": 100, "open": 1.1, "high": 1.2, "low": 1.0, "close": 1.15, "volume": 1}]

    def get_metadata(self, key: str):
      return self.metadata.get(key)

    def set_metadata(self, key: str, value: str) -> None:
      self.metadata[key] = value

  captured = {}

  def fake_catalog(_outcomes, _split, _by_target, source_version):
    return [{
      "id": f"eligible-{source_version}",
      "signatures": [f"long|{source_version}:eligible"],
      "currentEligible": True,
    }, {
      "id": f"rejected-{source_version}",
      "signatures": [f"short|{source_version}:rejected"],
      "currentEligible": False,
    }]

  def fake_report(sources, _candles, _generated_at):
    captured["reportCalls"] = captured.get("reportCalls", 0) + 1
    captured["sources"] = sources
    return {"schemaVersion": 2, "modelId": "test", "candidates": [], "candidateCount": 0, "configurationsTested": 0}

  monkeypatch.setattr(server, "_research_store", FakeStore())
  monkeypatch.setattr(server, "build_chart_signal_pattern_catalog", fake_catalog)
  monkeypatch.setattr(server, "build_candidate_stress_report", fake_report)
  server._candidate_stress_cache.clear()

  response = client.get("/research/expansion-report")

  assert response.status_code == 200
  assert response.json()["modelId"] == "test"
  assert captured["sources"]
  for source in captured["sources"]:
    assert source["currentPatterns"] == {
      f"long|{source['versionId']}:eligible": f"eligible-{source['versionId']}"
    }
  second = client.get("/research/expansion-report")
  assert second.status_code == 200
  assert second.json()["cached"] is True
  assert captured["reportCalls"] == 1
