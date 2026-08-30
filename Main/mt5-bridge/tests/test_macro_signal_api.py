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


def test_qualification_v2_refines_extreme_bootstrap_tails() -> None:
  rows = [
    {
      "eventTime": int(server.datetime(2020 + year, 1, 1, tzinfo=server.timezone.utc).timestamp()) + index,
      "status": "target_hit",
      "stressedResultR": 1.0,
    }
    for year in range(6)
    for index in range(10)
  ]

  result = server._qv2_metrics(rows, seed=7)

  assert result["oneSidedNoEdgePValue"] < (0.05 / 1_128)
  assert result["bootstrap"]["intervalReplications"] == 10_000
  assert result["bootstrap"]["pValueReplications"] == 250_000


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


def test_workbench_validation_rejects_unrestricted_treatment_combinations() -> None:
  catalog = {"items": [{
    "id": "catalog-a",
    "treatments": [{"dimension": "none", "value": "all", "reaction": "continuation"}],
  }]}
  payload = server.FmsExperimentRequest.model_validate({
    "friendlyName": "Invalid intersection",
    "catalogId": "catalog-a",
    "scoringPolicy": "forecast_quality",
    "cohort": {"dimension": "evidenceMode", "value": "agreement"},
    "reaction": "continuation",
    "execution": {
      "mode": "single",
      "stopAtrValues": [1],
      "targetRValues": [2],
      "holdingCandles": [30],
    },
  })

  try:
    server._validate_experiment_request(payload, catalog)
    raise AssertionError("expected unsupported treatment rejection")
  except server.HTTPException as error:
    assert error.status_code == 400
    assert "Unsupported evidence-treatment" in str(error.detail)


def test_workbench_catalog_groups_long_and_short_variants_without_duplicate_packages(monkeypatch) -> None:
  class MetadataStore:
    values = {}
    def get_metadata(self, key: str):
      return self.values.get(key)
    def set_metadata(self, key: str, value: str) -> None:
      self.values[key] = value

  monkeypatch.setattr(server, "_research_store", MetadataStore())
  monkeypatch.setattr(server, "_latest_cached_expansion_report", lambda: None)
  base_event = {"currency": "EUR", "countryCode": "EU", "title": "Consumer Confidence Index", "scoreGroup": "consumer_sentiment"}
  bundle = {
    "datasetFingerprint": "grouping-test",
    "sources": [{
      "versionId": SENTIMENT_VERSION_ID,
      "outcomes": [
        {"eventTime": 100, "direction": "long", "events": [{**base_event, "actual": "1"}]},
        {"eventTime": 200, "direction": "short", "events": [{**base_event, "actual": "-1"}]},
      ],
    }],
  }
  catalog = server._workbench_catalog(bundle)
  assert len(catalog["items"]) == 1
  item = catalog["items"][0]
  assert item["direction"] == "both"
  assert item["historicalN"] == 2
  assert [row["direction"] for row in item["directionVariants"]] == ["long", "short"]
  assert item["treatments"][0]["historicalN"] == 2


def test_failed_gate_freeze_requires_acknowledgement_and_never_promotes_charts(tmp_path: Path, monkeypatch) -> None:
  store = ResearchStore(tmp_path / "research.sqlite3")
  experiment_id = store.allocate_fms_id("E")
  store.create_fms_experiment(
    experiment_id,
    "Weak holdout",
    100,
    {"market": "EURUSD", "sourceVersionId": "source-v3", "signature": "long|EUR:sentiment", "signatures": ["long|EUR:sentiment"], "scoringPolicy": "forecast_quality", "scoringEngineVersion": server.WORKBENCH_SCORING_ENGINE_VERSION, "pairOrientationVersion": server.PAIR_ORIENTATION_VERSION, "researchDiagnosticsVersion": server.WORKBENCH_RESEARCH_DIAGNOSTICS_VERSION},
    "config-a",
    {"id": "catalog-a"},
    "dataset-a",
  )
  store.update_fms_experiment(
    experiment_id,
    "completed",
    result={"checks": {"holdoutLower95Positive": False}, "market": "EURUSD", "sourceVersionId": "source-v3", "historicalN": 48, "selectedConfiguration": {"stopAtr": 1, "targetR": 2, "holdingCandles": 30}},
  )
  store.save_fms_qualification_audit({
    "auditId": "audit-1", "experimentId": experiment_id, "version": "FMS-QUALIFICATION-v2",
    "configurationHash": "config-a", "datasetFingerprint": "dataset-a", "createdAt": 101,
    "walkForward": {"pooled": {"n": 35, "averageR": .14, "targetRate": .75, "stopRate": .17}},
  }, "method-a")
  monkeypatch.setattr(server, "_research_store", store)

  rejected = client.post(
    f"/research/experiments/{experiment_id}/freeze",
    json={"friendlyName": "Review", "acknowledgeFailedGates": False},
  )
  assert rejected.status_code == 409
  assert "Acknowledge failed gates" in rejected.text

  accepted = client.post(
    f"/research/experiments/{experiment_id}/freeze",
    json={"friendlyName": "Review", "acknowledgeFailedGates": True},
  )
  assert accepted.status_code == 200
  assert accepted.json()["id"] == "FMS-EURUSD-H4-C001"
  assert accepted.json()["failedGateAcknowledged"] is True
  assert client.get("/research/candidates/FMS-EURUSD-H4-C001").json()["experimentId"] == experiment_id
  assert client.post("/research/candidates/FMS-EURUSD-H4-C001/promote").status_code == 404
  provenance = server._registration_provenance({
    "market": "EURUSD", "sourceVersionId": "source-v3", "signatures": ["long|EUR:sentiment"],
    "scoringPolicy": "forecast_quality", "execution": {"stopAtr": 1, "targetR": 2, "expiryCandles": 30},
    "historicalBenchmark": {"experimentId": experiment_id, "historicalN": 48, "walkForwardN": 35, "walkForwardAverageR": .14, "targetFirstRate": .75, "stopFirstRate": .17},
  })
  assert provenance["status"] == "verified"
  assert provenance["qualificationAuditId"] == "audit-1"
  assert all(provenance["checks"].values())
  readiness = server._pattern_readiness({"historicalBenchmark": {"strength": "stronger_history"}}, provenance)
  assert readiness == {
    "auditStatus": "complete",
    "historicalStatus": "historically_qualified",
    "liveStatus": "not_live_validated",
    "orientationAudited": True,
    "label": "Historical audit complete · orientation audited",
    "actionableInShadowTrader": True,
  }
  incomplete = server._pattern_readiness({}, {"status": "mismatch"})
  assert incomplete["auditStatus"] == "incomplete"
  assert incomplete["actionableInShadowTrader"] is False

  saved_experiment = store.get_fms_experiment(experiment_id)
  legacy_usd_configuration = dict(saved_experiment["configuration"])
  legacy_usd_configuration["market"] = "USDJPY"
  legacy_usd_configuration.pop("pairOrientationVersion")
  monkeypatch.setattr(server._research_store, "get_fms_experiment", lambda _experiment_id: {
    **saved_experiment,
    "configuration": legacy_usd_configuration,
  })
  usd_pattern = {
    "market": "USDJPY", "sourceVersionId": "source-v3", "signatures": ["long|EUR:sentiment"],
    "scoringPolicy": "forecast_quality", "execution": {"stopAtr": 1, "targetR": 2, "expiryCandles": 30},
    "historicalBenchmark": {"experimentId": experiment_id, "historicalN": 48, "walkForwardN": 35, "walkForwardAverageR": .14, "targetFirstRate": .75, "stopFirstRate": .17},
  }
  legacy_usd = server._registration_provenance(usd_pattern)
  assert legacy_usd["checks"]["pairOrientation"] is False
  assert legacy_usd["status"] == "mismatch"


def test_completed_experiment_raw_cases_are_paginated_and_contract_specific(tmp_path: Path, monkeypatch) -> None:
  store = ResearchStore(tmp_path / "research.sqlite3")
  experiment_id = store.allocate_fms_id("E")
  store.create_fms_experiment(experiment_id, "Raw audit", 100, {"signature": "long|EUR:sentiment"}, "config", {"id": "catalog"}, "dataset")
  store.update_fms_experiment(experiment_id, "completed", result={"checks": {}})
  store.set_metadata(f"fms_raw_audit:{experiment_id}", server.json.dumps({
    "selectedContractKey": "1|2|30",
    "contracts": [{"key": "1|2|30", "stopAtr": 1, "targetR": 2, "targetAtr": 2, "holdingCandles": 30}],
    "cases": [{
      "caseId": "case-1", "eventTime": 100, "direction": "long", "included": True,
      "inclusionReason": "Included by Cases included", "events": [{"currency": "EUR", "countryCode": "EU", "title": "Consumer Confidence", "actual": "1", "forecast": "0", "previous": "-1", "surprisePoint": 1, "momentumPoint": 1, "agreementBonus": 1, "score": 3, "forecastSuspect": True}],
    }],
    "contractResults": {"1|2|30": [{"caseId": "case-1", "status": "target_hit", "stressedResultR": 1.9, "targetAtr": 2}]},
  }))
  monkeypatch.setattr(server, "_research_store", store)

  response = client.get(f"/research/experiments/{experiment_id}/raw-cases", params={"reliability": "unreliable", "pageSize": 10})
  assert response.status_code == 200
  payload = response.json()
  assert payload["total"] == 1
  assert payload["rows"][0]["events"][0]["score"] == 3
  assert payload["rows"][0]["forecastUnreliable"] is True
  assert payload["rows"][0]["simulation"]["targetAtr"] == 2


def test_readiness_report_exposes_setup_level_evidence_and_keeps_live_gate_closed(monkeypatch) -> None:
  class ReadinessStore:
    def get_metadata(self, _key: str):
      return None
    def get_fms_experiment(self, _experiment_id: str):
      return None
    def latest_fms_qualification_audit(self, _experiment_id: str):
      return None
    def list_fms_live_decisions(self, limit: int = 500):
      assert limit == 500
      return [{"status": "no_trade"}, {"status": "qualified"}]

  monkeypatch.setattr(server, "_research_store", ReadinessStore())
  report = server.research_readiness_report()
  assert report["activeRegisteredSetups"] == len(server.PRACTICAL_PATTERN_DEFINITIONS)
  assert len(report["registeredSetups"]) == len(server.PRACTICAL_PATTERN_DEFINITIONS)
  assert report["registeredSetups"][0]["execution"]
  assert "historicalBenchmark" in report["registeredSetups"][0]
  assert report["quarantinedOrRetiredSetups"]
  assert report["paperLiveEvidence"] == {
    "immutableFirstSeen": True,
    "decisionCount": 2,
    "actualBrokerFillsRecorded": 0,
    "status": "observation_only",
  }
  assert report["eligibleForRuleBasedLiveUse"] is False
