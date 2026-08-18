from __future__ import annotations

from pathlib import Path

from research_store import ResearchStore


def event(event_id: int, timestamp: int, actual: str = "1.0") -> dict:
  return {
    "id": event_id,
    "time": timestamp,
    "countryCode": "US",
    "currency": "USD",
    "title": "GDP q/q",
    "impact": "high",
    "actual": actual,
    "forecast": "0.8",
    "previous": "0.7",
  }


def test_calendar_history_survives_store_reopen_and_is_not_pruned(tmp_path: Path) -> None:
  path = tmp_path / "research.sqlite3"
  first = ResearchStore(path)
  result = first.upsert_calendar_events([event(1, 100), event(1, 200)], ingested_at=300)

  assert result == {"inserted": 2, "updated": 0, "total": 2}
  reopened = ResearchStore(path)
  assert [row["time"] for row in reopened.query_calendar()] == [100, 200]
  assert reopened.calendar_coverage(["USD"]) == {
    "count": 2,
    "earliest": 100,
    "latest": 200,
    "currencies": [{"currency": "USD", "count": 2, "earliest": 100, "latest": 200}],
  }


def test_calendar_ingest_updates_a_scheduled_row_when_actual_arrives(tmp_path: Path) -> None:
  store = ResearchStore(tmp_path / "research.sqlite3")
  scheduled = event(2, 400, actual="")
  released = event(2, 400, actual="1.2")

  assert store.upsert_calendar_events([scheduled], ingested_at=401)["inserted"] == 1
  result = store.upsert_calendar_events([released], ingested_at=402)

  assert result == {"inserted": 0, "updated": 1, "total": 1}
  assert store.query_calendar()[0]["actual"] == "1.2"


def test_signal_versions_are_immutable(tmp_path: Path) -> None:
  store = ResearchStore(tmp_path / "research.sqlite3")
  store.ensure_signal_version("v1", 1, {"rule": "fixed"}, "hash-a")
  store.ensure_signal_version("v1", 1, {"rule": "fixed"}, "hash-a")

  try:
    store.ensure_signal_version("v1", 2, {"rule": "changed"}, "hash-b")
    raise AssertionError("expected an immutable version conflict")
  except ValueError as error:
    assert "different configuration" in str(error)


def test_unfinished_research_runs_are_failed_after_bridge_restart(tmp_path: Path) -> None:
  store = ResearchStore(tmp_path / "research.sqlite3")
  store.ensure_signal_version("v1", 1, {"rule": "fixed"}, "hash-a")
  store.save_backtest_run("queued", "v1", "dataset-a", 10, "queued")
  store.save_backtest_run("running", "v1", "dataset-a", 11, "running")
  store.save_backtest_run("completed", "v1", "dataset-a", 12, "completed", result={"ok": True})

  assert store.mark_unfinished_runs_failed("Bridge restarted") == 2
  assert store.get_backtest_run("queued") == {
    "id": "queued",
    "versionId": "v1",
    "datasetFingerprint": "dataset-a",
    "createdAt": 10,
    "status": "failed",
    "result": None,
    "error": "Bridge restarted",
  }
  assert store.get_backtest_run("running")["status"] == "failed"
  assert store.get_backtest_run("completed")["status"] == "completed"
