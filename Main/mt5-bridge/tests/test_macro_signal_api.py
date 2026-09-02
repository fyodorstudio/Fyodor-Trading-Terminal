from __future__ import annotations

import copy
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import server
from scripts.materialize_registered_reaction_profiles import simulate_managed
from macro_signal import ACTIVE_VERSION_ID, GROWTH_VERSION_ID, POLICY_INFLATION_VERSION_ID, SENTIMENT_VERSION_ID, VERSION_ID, V2_VERSION_ID
from research_store import ResearchStore


client = TestClient(server.app)


def test_chart_projection_keeps_visible_context_audit_and_omits_heavy_research_grids() -> None:
  later_reaction = {"evaluableN": 18, "alignmentRate": .61}
  projected = server._interactive_chart_pattern({
    "id": "setup",
    "overall": {"evaluableCount": 40, "targetHitRate": .5, "stopHitRate": .4, "averageR": .2, "outcomes": [1] * 500},
    "executionStress": {"pips": 3, "overall": {"averageR": .1}, "development": {"outcomes": [1] * 500}},
    "yearStability": {"evaluableYears": 8, "positiveYears": 6, "positiveYearShare": .75, "byYear": [{"large": [1] * 500}]},
    "targetRobustness": [{"large": [1] * 500}],
    "reactionAudit": {
      "schema": "registered-reaction-audit-v1",
      "profile": {
        "schema": "registered-reaction-profile-v2",
        "horizons": [], "mfe": {}, "mae": {}, "givebackAtr": {}, "contractResearch": {},
        "executionChallenger": {"familyWinners": [{"large": [1] * 500}]},
        "contextResearch": {
          "schema": "fms-context-challenger-v1", "selectedCandidate": {"dimension": "macroBackground", "value": "aligned"},
          "dimensions": [{"dimension": "macroBackground", "value": "aligned", "historicalN": 20, "laterReaction": later_reaction, "developmentExecution": {"large": [1] * 500}, "status": "promising_context"}],
        },
      },
    },
  })

  assert projected["overall"] == {"evaluableCount": 40, "targetHitRate": .5, "stopHitRate": .4, "averageR": .2}
  assert "targetRobustness" not in projected
  assert "byYear" not in projected["yearStability"]
  assert "executionChallenger" not in projected["reactionAudit"]["profile"]
  context = projected["reactionAudit"]["profile"]["contextResearch"]
  assert context["selectedCandidate"]["value"] == "aligned"
  assert context["dimensions"] == [{"dimension": "macroBackground", "value": "aligned", "historicalN": 20, "laterReaction": later_reaction, "status": "promising_context"}]


def test_global_chart_refresh_reaches_each_current_market_request(monkeypatch) -> None:
  calls = []

  class StopAfterFirstMarket(Exception):
    pass

  def capture_request(**kwargs):
    calls.append(kwargs)
    raise StopAfterFirstMarket

  monkeypatch.setattr(server, "research_chart_signals", capture_request)
  try:
    server.research_global_chart_signals(refresh=True)
  except StopAfterFirstMarket:
    pass

  assert calls
  assert calls[0]["mode"] == "current"
  assert calls[0]["refresh"] is True


def test_prospective_context_ledger_keeps_matches_separate_and_immutable() -> None:
  patterns = [{
    "market": "EURUSD", "id": "setup", "label": "Setup",
    "contextRegistration": {
      "id": "CTX-C001", "status": "reviewed_active",
      "condition": {"dimension": "trendRelation", "value": "aligned", "knownAt": "entry"},
      "later": {"evaluableN": 12, "averageR": .25},
      "reaction": {"alignmentRate": .6},
    },
  }]
  decisions = [
    {"modelId": server.PRACTICAL_MODEL_ID, "market": "EURUSD", "patternId": "setup", "eventTime": 10, "status": "qualified", "prospectiveEligible": True, "signal": {"contextOverlay": {"matched": True, "registration": {"id": "CTX-C001"}}}},
    {"modelId": server.PRACTICAL_MODEL_ID, "market": "EURUSD", "patternId": "setup", "eventTime": 20, "status": "qualified", "prospectiveEligible": True, "signal": {"contextOverlay": {"matched": False}}},
  ]
  cases = [
    {"market": "EURUSD", "patternId": "setup", "eventTime": 10, "state": "target_hit", "resultR": 2},
    {"market": "EURUSD", "patternId": "setup", "eventTime": 20, "state": "stop_hit", "resultR": -1},
  ]
  ledger = server._prospective_context_ledger(patterns, decisions, cases)
  row = ledger["rows"][0]
  assert ledger["immutableFirstSeen"] is True
  assert row["prospective"]["matched"] == {"decisionCount": 1, "resolvedCount": 1, "averageR": 2.0, "positiveRate": 1.0}
  assert row["prospective"]["notMatched"] == {"decisionCount": 1, "resolvedCount": 1, "averageR": -1.0, "positiveRate": 0.0}
  assert row["historicalExpectation"] == {"evaluableN": 12, "averageR": .25, "alignmentRate": .6}


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


def test_execution_management_rules_are_deterministic_and_preserve_ambiguity() -> None:
  profile = {"sign": 1, "entry": 100.0, "atr": 1.0, "candles": [
    {"time": 1, "open": 100, "high": 100.6, "low": 99.5, "close": 100.2},
    {"time": 2, "open": 100.2, "high": 100.4, "low": 99.9, "close": 100.1},
  ]}
  break_even = simulate_managed(profile, "break_even", 1, 2, 2, .5)
  assert break_even == {"status": "stop_hit", "resultR": 0.0}

  same_bar = {**profile, "candles": [{"time": 1, "open": 100, "high": 101.1, "low": 98.9, "close": 100}]}
  partial = simulate_managed(same_bar, "partial", 1, 3, 1, 1)
  assert partial == {"status": "ambiguous", "resultR": None}
  resolved_partial = simulate_managed(same_bar, "partial", 1, 3, 1, 1, lambda *_args: "target_hit")
  assert resolved_partial == {"status": "stop_hit", "resultR": 0.0}


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
    def list_fms_live_execution_cases(self, limit: int = 2000):
      assert limit == 2000
      return []
    def list_fms_demo_deals(self, limit: int = 20000):
      assert limit == 20000
      return []

  monkeypatch.setattr(server, "_research_store", ReadinessStore())
  report = server.research_readiness_report()
  assert report["activeRegisteredSetups"] == len(server.PRACTICAL_PATTERN_DEFINITIONS)
  assert len(report["registeredSetups"]) == len(server.PRACTICAL_PATTERN_DEFINITIONS)
  assert all(row["reactionAudit"]["profile"]["schema"] == "registered-reaction-profile-v2" for row in report["registeredSetups"])
  assert all(row["reactionAudit"]["profile"]["evaluableN"] > 0 for row in report["registeredSetups"])
  assert report["registeredSetups"][0]["execution"]
  assert "historicalBenchmark" in report["registeredSetups"][0]
  assert report["registeredSetups"][0]["reactionAudit"]["profile"]["schema"] == "registered-reaction-profile-v2"
  assert [row["holdingCandles"] for row in report["registeredSetups"][0]["reactionAudit"]["profile"]["horizons"]] == [1, 3, 6, 12, 30]
  assert all(row["reactionAudit"]["profile"]["contextResearch"]["schema"] == "fms-context-challenger-v1" for row in report["registeredSetups"])
  assert all(row["reactionAudit"]["profile"]["contextResearch"]["activeArrowPreserved"] is True for row in report["registeredSetups"])
  assert all(row["reactionAudit"]["profile"]["contextResearch"]["configurationHash"] for row in report["registeredSetups"])
  selected_contexts = [row["reactionAudit"]["profile"]["contextResearch"]["selectedCandidate"] for row in report["registeredSetups"] if row["reactionAudit"]["profile"]["contextResearch"]["selectedCandidate"]]
  assert len(selected_contexts) == 27
  assert sum(row["status"] == "later_supported" for row in selected_contexts) == 5
  assert all(row["dimension"] != "releaseSession" for row in selected_contexts)
  assert all(row["activeArrowChanged"] is False for row in selected_contexts)
  assert all("later cases were untouched during selection" in row["selectionBasis"] for row in selected_contexts)
  for setup in report["registeredSetups"]:
    research = setup["reactionAudit"]["profile"]["contextResearch"]
    selected = research["selectedCandidate"]
    if not selected:
      continue
    row = next(item for item in research["dimensions"] if item["dimension"] == selected["dimension"] and item["value"] == selected["value"])
    assert row["developmentReaction"]["evaluableN"] + row["outsideDevelopmentReaction"]["evaluableN"] == research["baseline"]["developmentReaction"]["evaluableN"]
    assert row["laterReaction"]["evaluableN"] + row["outsideLaterReaction"]["evaluableN"] == research["baseline"]["laterReaction"]["evaluableN"]
  context_registrations = [row["contextRegistration"] for row in report["registeredSetups"] if row.get("contextRegistration")]
  assert len(context_registrations) == 4
  assert all(row["status"] == "reviewed_active" for row in context_registrations)
  assert all(row["researchExperimentId"].startswith(f"FMS-{row['market']}-H4-CTX-E") for row in context_registrations)
  assert {row["id"] for row in context_registrations} == {
    "FMS-NZDUSD-H4-CTX-C001",
    "FMS-USDJPY-H4-CTX-C001",
    "FMS-USDJPY-H4-CTX-C002",
    "FMS-USDJPY-H4-CTX-C003",
  }
  retail = next(row for row in report["registeredSetups"] if row["market"] == "USDCAD" and row["patternId"] == "usdcad-canada-retail-sales")
  assert retail.get("contextRegistration") is None
  assert retail["reactionAudit"]["profile"]["contextResearch"]["selectedCandidate"]["status"] == "later_supported"
  assert report["quarantinedOrRetiredSetups"]
  assert report["paperLiveEvidence"]["immutableFirstSeen"] is True
  assert report["paperLiveEvidence"]["decisionCount"] == 2
  assert report["paperLiveEvidence"]["actualBrokerFillsRecorded"] == 0
  assert report["paperLiveEvidence"]["completedDemoTrades"] == 0
  assert report["paperLiveEvidence"]["status"] == "observation_only"
  assert report["paperLiveEvidence"]["executionComparison"]["entryComparableTrades"] == 0
  assert report["eligibleForRuleBasedLiveUse"] is False


def test_context_registration_matches_exact_entry_state_and_fails_closed_on_artifact_drift() -> None:
  pattern = next(
    row for row in server.PRACTICAL_PATTERN_DEFINITIONS
    if row["market"] == "USDJPY" and row["id"] == "usdjpy-us-manufacturing-employment"
  )
  signal = {
    "eventTime": server.CONTEXT_CONDITIONAL_ACTIVATED_AT + 60,
    "marketContext": {"macroBackground": {"relationToSignal": "aligned"}},
  }
  matched = server._context_overlay_for_signal(pattern, signal)
  assert matched["matched"] is True
  assert matched["executionApplied"] is True
  assert matched["contextExecution"] == {
    "managementFamily": "fixed", "managementTriggerR": None,
    "stopAtr": .75, "targetR": 3.0, "expiryCandles": 18,
  }
  nonmatch = server._context_overlay_for_signal(
    pattern,
    {**signal, "marketContext": {"macroBackground": {"relationToSignal": "conflicted"}}},
  )
  assert nonmatch["matched"] is False
  assert nonmatch["executionApplied"] is False
  assert nonmatch["parentBehaviorWhenContextDoesNotMatch"] == "retain_parent"

  historical = server._context_overlay_for_signal(
    pattern,
    {**signal, "eventTime": server.CONTEXT_CONDITIONAL_ACTIVATED_AT - 60},
  )
  assert historical["matched"] is True
  assert historical["activeForEvent"] is False
  assert historical["executionApplied"] is False

  drifted = copy.deepcopy(pattern)
  drifted.pop("contextRegistration", None)
  drifted["reactionAudit"]["profile"]["contextResearch"]["configurationHash"] = "drifted"
  blocked = server._apply_reviewed_context(drifted)
  assert blocked["contextRegistration"]["status"] == "blocked_artifact_mismatch"
  assert blocked["execution"] == pattern["execution"]


def test_forward_validation_requires_prospective_breadth_and_never_claims_real_fills() -> None:
  empty = server._forward_validation_payload([], [])
  assert empty["status"] == "demo_monitoring_ready"
  assert empty["eligibleForDemoTrading"] is True
  assert empty["eligibleForPaperReliance"] is False
  assert empty["eligibleForRealMoneyReliance"] is False

  class OperationalStore:
    def __init__(self, last_cycle: int | None, failed_batches: int):
      self.last_cycle = last_cycle
      self.failed_batches = failed_batches
    def get_metadata(self, key: str):
      if key == "last_calendar_successful_cycle_at":
        return None if self.last_cycle is None else str(self.last_cycle)
      if key == "last_calendar_cycle_failed_batches":
        return str(self.failed_batches)
      return None

  original_store = server._research_store
  try:
    server._research_store = OperationalStore(900, 0)
    assert server._fms_operational_preflight(1000)["signalMonitoringReadyNow"] is True
    server._research_store = OperationalStore(700, 0)
    stale = server._fms_operational_preflight(1000)
    assert stale["signalMonitoringReadyNow"] is False
    assert "300 seconds old" in stale["blockingReasons"][0]
    server._research_store = OperationalStore(900, 2)
    failed = server._fms_operational_preflight(1000)
    assert failed["signalMonitoringReadyNow"] is False
    assert failed["failedCalendarBatches"] == 2
  finally:
    server._research_store = original_store

  event = {"id": 7, "time": 100}
  first_seen = {(7, 100): 110}
  assert server._prospective_capture_eligibility([event], 100, 200, 120, first_seen)["eligible"] is True
  assert server._prospective_capture_eligibility([event], 100, 200, 200, first_seen)["reason"] == "decision_after_frozen_entry"
  assert server._prospective_capture_eligibility([event], 100, 200, 120, {(7, 100): 200})["reason"] == "observed_after_frozen_entry"
  assert server._prospective_capture_eligibility([event], 100, 200, 120, {})["reason"] == "missing_first_seen_timestamp"
  assert server._planned_strictly_later_h4_open(14_500, [0, 14_400]) == 28_800
  assert server._planned_strictly_later_h4_open(14_400, [0, 14_400]) == 28_800
  assert server._planned_strictly_later_h4_open(10_000, [0, 14_400]) == 14_400

  decisions = []
  cases = []
  for index in range(50):
    pattern_id = f"setup-{index % 5}"
    decisions.append({
        "modelId": server.PRACTICAL_MODEL_ID, "market": "EURUSD", "patternId": pattern_id,
        "eventTime": index, "status": "qualified", "prospectiveEligible": True,
    })
    cases.append({
      "modelId": server.PRACTICAL_MODEL_ID, "market": "EURUSD", "patternId": pattern_id,
      "eventTime": index, "state": "target_hit" if index % 2 == 0 else "stop_hit",
      "resultR": 2.0 if index % 2 == 0 else -1.0,
      "signal": {"activationTime": index + 1},
      "entryQuote": {"quality": "near_entry" if index < 40 else "late_snapshot"},
    })
  ready = server._forward_validation_payload(decisions, cases)
  assert ready["resolvedCases"] == 50
  assert ready["representedSetups"] == 5
  assert ready["paperReadySetups"] == 5
  assert ready["degradedSetups"] == 0
  assert ready["collectingSetups"] == 0
  assert all(row["status"] == "supportive" for row in ready["setupSummaries"])
  assert ready["averageR"] == .5
  assert ready["nearEntryQuoteCount"] == 40
  assert ready["eligibleForPaperReliance"] is True
  assert ready["eligibleForDemoTrading"] is True
  assert ready["eligibleForRealMoneyReliance"] is False
  assert ready["realMoneyChecks"]["realMoneyExecutionInScope"] is False

  degraded_cases = [{
    "modelId": server.PRACTICAL_MODEL_ID, "market": "EURUSD", "patternId": "degraded",
    "eventTime": index, "state": "stop_hit", "resultR": -1.0,
    "signal": {"activationTime": index + 1}, "entryQuote": {"quality": "near_entry"},
  } for index in range(10)]
  degraded = server._forward_validation_payload([], degraded_cases)
  assert degraded["degradedSetups"] == 1
  assert degraded["setupSummaries"][0]["status"] == "degraded"
  assert degraded["setupSummaries"][0]["eligibleForPaperReliance"] is False

  demo_case = {
    "modelId": server.PRACTICAL_MODEL_ID, "market": "EURUSD", "patternId": "setup-demo",
    "eventTime": 100, "signal": {"entry": 1.1, "activationTime": 100, "initialStop": 1.09, "target": 1.12, "direction": "long", "outcomeStatus": "expired", "resultR": .98, "exitTime": 120},
  }
  demo_tag = server._forward_demo_tag(server.PRACTICAL_MODEL_ID, "EURUSD", "setup-demo", 100)
  demo = server._demo_execution_payload([demo_case], [
    {"signalTag": demo_tag, "positionId": 7, "entryType": 0, "dealType": 0, "time": 110, "volume": .1, "price": 1.1001, "profit": 0, "commission": -1, "swap": 0, "fee": 0, "deal": {"fms_actual_stop": 1.09, "fms_actual_target": 1.12, "fms_symbol_point": .0001, "fms_initial_risk_account": 100, "fms_risk_percent": .2, "fms_account_balance": 50000}},
    {"signalTag": demo_tag, "positionId": 7, "entryType": 1, "dealType": 1, "time": 120, "volume": .1, "price": 1.11, "profit": 100, "commission": -1, "swap": -.5, "fee": 0, "deal": {}},
  ], {"status": "capturing_demo_deals", "orderTransmission": False})
  assert demo["completedTrades"] == 1
  assert demo["totalNetAccountResult"] == 97.5
  assert demo["trades"][0]["grossFillR"] > 0
  assert demo["trades"][0]["contractAdherent"] is True
  assert demo["trades"][0]["netR"] == .975
  assert demo["trades"][0]["entryDelaySeconds"] == 10
  assert demo["trades"][0]["entryDifferencePoints"] == pytest.approx(1)
  assert demo["trades"][0]["executionCostsR"] == -.025
  assert demo["executionComparison"]["completedComparableTrades"] == 1
  assert demo["executionComparison"]["averageEntryDelaySeconds"] == 10
  assert demo["executionComparison"]["averageExecutionCostsR"] == -.025
  assert demo["orderTransmission"] is False

  demo_cases = []
  sequential_deals = []
  for index in range(30):
    demo_case_index = index % 5
    event_time = 100 + index
    exit_time = 1005 + index * 20
    demo_cases.append({
      **demo_case, "patternId": f"setup-{demo_case_index}", "eventTime": event_time,
      "signal": {**demo_case["signal"], "outcomeStatus": "expired", "resultR": .1, "exitTime": exit_time},
    })
    setup_tag = server._forward_demo_tag(
      server.PRACTICAL_MODEL_ID, "EURUSD", f"setup-{demo_case_index}", event_time,
    )
    sequential_deals.extend([
      {"accountLogin": 123, "signalTag": setup_tag, "positionId": index + 1, "entryType": 0, "dealType": 0, "time": 1000 + index * 20, "volume": .1, "price": 1.1, "profit": 0, "commission": -.25, "swap": 0, "fee": 0, "deal": {"fms_actual_stop": 1.09, "fms_actual_target": 1.12, "fms_symbol_point": .0001, "fms_initial_risk_account": 100, "fms_risk_percent": .2, "fms_account_balance": 50000}},
      {"accountLogin": 123, "signalTag": setup_tag, "positionId": index + 1, "entryType": 1, "dealType": 1, "time": exit_time, "volume": .1, "price": 1.101, "profit": 10, "commission": -.25, "swap": 0, "fee": 0, "deal": {}},
    ])
  sufficient_demo = server._demo_execution_payload(
    demo_cases, sequential_deals,
    {"status": "capturing_demo_deals", "accountLogin": 123, "orderTransmission": False, "checkedAt": 2000},
  )
  assert sufficient_demo["riskPolicy"]["observed"] is True
  assert sufficient_demo["demoReadySetups"] == 5
  fully_ready = server._forward_validation_payload(
    decisions, cases, sufficient_demo, {"signalMonitoringReadyNow": True},
  )
  assert fully_ready["eligibleForDemoTrading"] is True
  assert fully_ready["manualLimitedLiveReviewCandidates"] == 5
  assert fully_ready["manualLimitedLiveReview"]["eligibleSetups"] == 5
  assert fully_ready["manualLimitedLiveReview"]["orderTransmission"] is False
  assert all(row["eligibleForManualLimitedLiveReview"] for row in fully_ready["setupSummaries"])
  assert fully_ready["eligibleForRealMoneyReliance"] is False


def test_demo_deal_capture_requires_explicit_tag_and_demo_account(tmp_path: Path, monkeypatch) -> None:
  from collections import namedtuple

  store = ResearchStore(tmp_path / "research.sqlite3")
  assessment = {"patternId": "claims", "time": 500, "status": "qualified", "direction": "long"}
  assert store.record_fms_live_decision(
    server.PRACTICAL_MODEL_ID, "EURUSD", "claims", 500, 501, "qualified", "long", assessment, None,
    True, "captured_before_frozen_entry",
  )
  assert store.record_fms_live_execution_observation(
    server.PRACTICAL_MODEL_ID, "EURUSD", "claims", 500, 502,
    {"direction": "long", "entry": 1.1, "initialStop": 1.09, "stop": 1.09, "target": 1.12, "outcomeStatus": "pending"},
  )
  tag = server._forward_demo_tag(server.PRACTICAL_MODEL_ID, "EURUSD", "claims", 500)
  Account = namedtuple("Account", "login trade_mode balance")
  Deal = namedtuple("Deal", "ticket time symbol position_id entry type volume price commission swap profit fee comment")
  Position = namedtuple("Position", "sl tp")
  SymbolInfo = namedtuple("SymbolInfo", "point")
  tagged = Deal(1, 600, "EURUSD", 10, 0, 0, .1, 1.1, -1, 0, 0, 0, tag)
  untagged = Deal(2, 601, "EURUSD", 20, 0, 0, .1, 1.2, -1, 0, 0, 0, "manual")
  monkeypatch.setattr(server, "_research_store", store)
  monkeypatch.setattr(server, "_ensure_mt5_initialized", lambda: True)
  monkeypatch.setattr(server.mt5, "account_info", lambda: Account(123, 0, 10000))
  monkeypatch.setattr(server.mt5, "history_deals_get", lambda *_args: [tagged, untagged])
  monkeypatch.setattr(server.mt5, "positions_get", lambda **_kwargs: [Position(1.09, 1.12)])
  monkeypatch.setattr(server.mt5, "history_orders_get", lambda **_kwargs: [])
  monkeypatch.setattr(server.mt5, "symbol_info", lambda _symbol: SymbolInfo(.0001))
  monkeypatch.setattr(server.mt5, "order_calc_profit", lambda *_args: -25)

  result = server._capture_tagged_demo_deals(700)
  assert result["status"] == "capturing_demo_deals"
  assert result["captured"] == 1
  assert result["orderTransmission"] is False
  assert [row["dealTicket"] for row in store.list_fms_demo_deals()] == [1]
  saved = store.list_fms_demo_deals()[0]["deal"]
  assert saved["fms_actual_stop"] == 1.09
  assert saved["fms_actual_target"] == 1.12
  assert saved["fms_risk_percent"] == .25

  monkeypatch.setattr(server.mt5, "account_info", lambda: Account(999, 2, 10000))
  blocked = server._capture_tagged_demo_deals(701)
  assert blocked["status"] == "blocked_non_demo_account"
  assert blocked["captured"] == 0


def test_execution_challengers_are_immutable_and_only_explicitly_reviewed_contracts_activate() -> None:
  payload = server.research_execution_challengers()
  assert payload["schema"] == "fms-execution-challenger-index-v1"
  assert payload["count"] == len(server.PRACTICAL_PATTERN_DEFINITIONS)
  assert payload["promotionAvailable"] is False
  assert all(row["configurationHash"] and row["candleFingerprint"] for row in payload["rows"])
  assert all(row["activeContractPreserved"] is True for row in payload["rows"])
  assert {winner["family"] for row in payload["rows"] for winner in row["familyWinners"]} == {"fixed", "break_even", "trailing", "partial"}
  assert all(row["targetFrontier"]["rows"] for row in payload["rows"])
  assert all(row["targetFrontier"]["definition"].startswith("Independent full-position targets") for row in payload["rows"])
  reviewed = {
    (row["market"], row["id"]): row
    for row in server.PRACTICAL_PATTERN_DEFINITIONS
    if (row.get("executionReview") or {}).get("status") == "reviewed_active"
  }
  assert set(reviewed) == {
    ("AUDUSD", "audusd-us-producer-inflation"),
    ("NZDUSD", "nzdusd-us-producer-inflation"),
    ("USDJPY", "usdjpy-jpy-inflation"),
  }
  assert all(row["execution"]["managementFamily"] == "break_even" for row in reviewed.values())
  assert all(row["baseExecution"] != row["execution"] for row in reviewed.values())
  for row in reviewed.values():
    activation = int(row["executionReview"]["activatedAt"])
    assert server._execution_for_event(row, activation - 1) == row["baseExecution"]
    assert server._execution_for_event(row, activation) == row["execution"]


def test_target_path_ladder_keeps_frozen_result_separate_and_does_not_invent_intrabar_order(monkeypatch) -> None:
  class NoM1Store:
    def query_candles(self, *_args, **_kwargs):
      return []

  monkeypatch.setattr(server, "_research_store", NoM1Store())
  profile = {
    "entry": 1.0, "atr": .1, "sign": 1.0,
    "candles": [
      {"time": 100, "open": 1.0, "high": 1.06, "low": .98, "close": 1.04},
      {"time": 200, "open": 1.04, "high": 1.12, "low": .89, "close": .91},
    ],
  }
  rows = server._target_path_ladder(profile, 1.0, 2, "EURUSD")
  by_target = {row["targetR"]: row for row in rows}
  assert by_target[.25]["status"] == "target_before_sl"
  assert by_target[.25]["timeToTargetCandles"] == 1
  assert by_target[.5]["distancePips"] == 500
  assert by_target[1.0]["status"] == "ambiguous"
  assert by_target[1.5]["status"] == "sl_before_target"


def test_post_release_quote_is_observed_not_relabelled_as_a_fill(monkeypatch) -> None:
  from collections import namedtuple

  Tick = namedtuple("Tick", "bid ask time")
  Info = namedtuple("Info", "point digits")
  monkeypatch.setattr(server, "_ensure_mt5_initialized", lambda: True)
  monkeypatch.setattr(server.mt5, "symbol_select", lambda *_args: True)
  monkeypatch.setattr(server.mt5, "copy_ticks_range", lambda *_args: [Tick(1.1, 1.1004, 112)])
  monkeypatch.setattr(server.mt5, "symbol_info_tick", lambda *_args: Tick(1.1, 1.1004, 112))
  monkeypatch.setattr(server.mt5, "symbol_info", lambda *_args: Info(.0001, 5))
  quote = server._quote_snapshot_for_forward_case("EURUSD", 100, 113)
  assert quote is not None
  assert quote["entryLagSeconds"] == 12
  assert quote["spreadPoints"] == pytest.approx(4)
  assert quote["quality"] == "first_tick"
  assert quote["source"] == "first_tick_after_observation"
  assert "not a broker fill" in quote["disclosure"]

  timing = server._entry_timing_audit(
    100, 110, "short", quote,
    {
      "M1": [{"time": 120, "open": 1.1000}],
      "H1": [{"time": 3_600, "open": 1.1010}],
      "H4": [],
    },
  )
  assert timing["status"] == "prospective_observation_only"
  assert timing["firstSeenDelaySeconds"] == 10
  assert timing["decisionDelaySeconds"] is None
  assert timing["quoteDelaySeconds"] == 12
  assert timing["entries"][0]["status"] == "observed"
  assert timing["entries"][0]["gapPips"] == pytest.approx(-2)
  assert timing["entries"][0]["directionAdjustedGapPips"] == pytest.approx(2)
  assert timing["entries"][2]["status"] == "waiting_for_candle"
  assert "not broker fills" in timing["disclosure"]
