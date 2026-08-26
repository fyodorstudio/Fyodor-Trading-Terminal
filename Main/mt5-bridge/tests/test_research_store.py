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


def test_forward_observation_keeps_first_seen_values_after_calendar_revision(tmp_path: Path) -> None:
  store = ResearchStore(tmp_path / "research.sqlite3")
  released = event(3, 500, actual="1.2")
  store.upsert_calendar_events([released], ingested_at=501)

  assert store.capture_release_observations(activated_at=400, observed_at=502) == 1
  revised = {**released, "actual": "1.4", "previous": "0.9"}
  store.upsert_calendar_events([revised], ingested_at=503)
  assert store.capture_release_observations(activated_at=400, observed_at=504) == 0

  frozen = store.query_release_observations(from_time=400, currencies=["USD"])[0]
  assert frozen["actual"] == "1.2"
  assert frozen["previous"] == "0.7"
  assert frozen["firstSeenAt"] == 502


def test_paper_case_candidate_is_immutable_while_outcomes_advance(tmp_path: Path) -> None:
  store = ResearchStore(tmp_path / "research.sqlite3")
  store.ensure_signal_version("v2", 1, {"rule": "fixed"}, "hash-v2")
  candidate = {"eventTime": 600, "direction": "long"}
  assert store.save_paper_case("v2", 600, 605, "monitoring", candidate, {"2.0": {"status": "pending"}}, 605)
  assert not store.save_paper_case("v2", 600, 700, "monitoring", {"direction": "short"}, {}, 700)

  store.update_paper_case("v2", 600, "completed", {"2.0": {"status": "target_hit"}}, 800)
  saved = store.query_paper_cases("v2")[0]
  assert saved["candidate"] == candidate
  assert saved["frozenAt"] == 605
  assert saved["state"] == "completed"
  assert saved["outcomes"]["2.0"]["status"] == "target_hit"


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


def test_fms_experiments_and_candidates_are_durable_immutable_snapshots(tmp_path: Path) -> None:
  path = tmp_path / "research.sqlite3"
  store = ResearchStore(path)
  experiment_id = store.allocate_fms_id("E")
  configuration = {"signature": "long|EUR:pmi", "execution": {"targetR": 2}}
  catalog = {"id": "catalog-a", "exactTitles": ["Manufacturing PMI"]}
  store.create_fms_experiment(
    experiment_id, "EUR PMI", 100, configuration, "config-a", catalog, "dataset-a"
  )
  store.update_fms_experiment(
    experiment_id,
    "completed",
    result={"checks": {"holdout": False}, "configurationHash": "config-a"},
  )
  candidate_id = store.allocate_fms_id("C")
  store.create_fms_candidate(
    candidate_id,
    experiment_id,
    "EUR PMI review",
    110,
    True,
    {"holdout": False},
    "config-a",
    "dataset-a",
  )

  reopened = ResearchStore(path)
  assert reopened.allocate_fms_id("E") == "FMS-EURUSD-H4-E002"
  assert reopened.allocate_fms_id("C") == "FMS-EURUSD-H4-C002"
  saved = reopened.get_fms_experiment("FMS-EURUSD-H4-E001")
  assert saved["configuration"] == configuration
  assert saved["catalogSnapshot"] == catalog
  assert saved["configurationHash"] == "config-a"
  assert saved["datasetFingerprint"] == "dataset-a"
  candidate = reopened.list_fms_candidates()[0]
  assert candidate["experimentId"] == experiment_id
  assert candidate["failedGateAcknowledged"] is True
  assert candidate["checks"] == {"holdout": False}


def test_unfinished_fms_experiments_are_retained_as_failures(tmp_path: Path) -> None:
  store = ResearchStore(tmp_path / "research.sqlite3")
  for status in ("queued", "running", "completed"):
    experiment_id = store.allocate_fms_id("E")
    store.create_fms_experiment(
      experiment_id, status, 100, {"status": status}, status, {"id": status}, "dataset"
    )
    store.update_fms_experiment(
      experiment_id,
      status,
      result={"ok": True} if status == "completed" else None,
    )

  assert store.mark_unfinished_fms_experiments_failed("Bridge restarted") == 2
  rows = {row["friendlyName"]: row for row in store.list_fms_experiments()}
  assert rows["queued"]["status"] == "failed"
  assert rows["running"]["error"] == "Bridge restarted"
  assert rows["completed"]["status"] == "completed"
