from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys
import time
from typing import Any, Dict

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server
from macro_signal import PAIR_ORIENTATION_VERSION, WORKBENCH_RESEARCH_DIAGNOSTICS_VERSION, WORKBENCH_SCORING_ENGINE_VERSION, build_workbench_experiment


def configuration_for(pattern: Dict[str, Any], bundle: Dict[str, Any]) -> Dict[str, Any]:
  execution = pattern["execution"]
  signatures = list(pattern["signatures"])
  return {
    "market": pattern["market"],
    "sourceVersionId": pattern["sourceVersion"],
    "signature": signatures[0],
    "signatures": signatures,
    "directionSelection": "both" if len(signatures) > 1 else signatures[0].split("|", 1)[0],
    "scoringPolicy": pattern.get("scoringPolicy", "forecast_quality"),
    "scoringEngineVersion": WORKBENCH_SCORING_ENGINE_VERSION,
    "pairOrientationVersion": PAIR_ORIENTATION_VERSION,
    "researchDiagnosticsVersion": WORKBENCH_RESEARCH_DIAGNOSTICS_VERSION,
    "cohort": pattern.get("cohort", {"dimension": "none", "value": "all"}),
    "requiredExactTitles": list(pattern.get("requiredExactTitles", ())),
    "reaction": pattern.get("reaction", "continuation"),
    "execution": {
      "mode": "single",
      "stopAtrValues": [float(execution["stopAtr"])],
      "targetRValues": [float(execution["targetR"])],
      "holdingCandles": [int(execution["expiryCandles"])],
    },
    "entry": "first_h4_open_strictly_after_release",
    "sourceRunIds": bundle["runIds"],
    "researchPriceCutoff": bundle["cutoff"],
    "candleRevision": bundle["candleRevision"],
    "reconciliation": "registered-reaction-v4-current-engine-fixed-contract",
  }


def main() -> None:
  existing_payload = json.loads(server._research_store.get_metadata("fms_registered_reaction:reconciliation") or "{}")
  output_by_pattern = {
    str(row["patternId"]): row
    for row in existing_payload.get("rows", ())
    if isinstance(row, dict) and row.get("patternId")
  }
  reconciled_count = 0
  for pattern in server.PRACTICAL_PATTERN_DEFINITIONS:
    provenance = server._registration_provenance(server._reconciled_pattern(pattern))
    if provenance.get("status") == "verified":
      continue
    bundle = server._workbench_source_bundle(pattern["market"])
    configuration = configuration_for(pattern, bundle)
    configuration_hash = hashlib.sha256(
      json.dumps(configuration, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    existing = server._research_store.find_completed_fms_experiment(configuration_hash, bundle["datasetFingerprint"])
    if existing:
      experiment_id = existing["id"]
    else:
      experiment_id = server._research_store.allocate_fms_id("E", pattern["market"])
      catalog_snapshot = {
        "id": f"registered:{pattern['id']}",
        "label": pattern["label"],
        "sourceVersionId": pattern["sourceVersion"],
        "signatures": list(pattern["signatures"]),
        "direction": "both",
        "historicalN": pattern["historicalBenchmark"]["historicalN"],
      }
      server._research_store.create_fms_experiment(
        experiment_id,
        f"Registered reconciliation · {pattern['label']}",
        int(time.time()),
        configuration,
        configuration_hash,
        catalog_snapshot,
        bundle["datasetFingerprint"],
      )
      server._research_store.update_fms_experiment(experiment_id, "running")
      try:
        result = build_workbench_experiment(bundle["sources"], bundle["candles"], configuration, int(time.time()))
        raw_audit = result.pop("rawAudit", None)
        result.update({
          "experimentId": experiment_id,
          "configurationHash": configuration_hash,
          "datasetFingerprint": bundle["datasetFingerprint"],
          "catalogSnapshot": catalog_snapshot,
        })
        server._research_store.update_fms_experiment(experiment_id, "completed", result=result)
        if isinstance(raw_audit, dict):
          server._research_store.set_metadata(f"fms_raw_audit:{experiment_id}", json.dumps(raw_audit, separators=(",", ":")))
      except Exception as exc:
        server._research_store.update_fms_experiment(experiment_id, "failed", error=str(exc))
        print(json.dumps({"patternId": pattern["id"], "id": experiment_id, "error": str(exc)}), flush=True)
        continue
    experiment = server._research_store.get_fms_experiment(experiment_id) or {}
    qualification = server.get_research_experiment_qualification_v2(experiment_id)
    result = experiment.get("result") or {}
    selected = result.get("selectedConfiguration") or {}
    pooled = (qualification.get("walkForward") or {}).get("pooled") or {}
    holdout = selected.get("holdout") or {}
    benchmark = pattern.get("historicalBenchmark") or {}
    uses_chronological_holdout = benchmark.get("basis") == "chronological_holdout"
    row = {
      "patternId": pattern["id"],
      "id": experiment_id,
      "historicalN": result.get("historicalN"),
      "walkForwardN": holdout.get("evaluableCount") if uses_chronological_holdout else pooled.get("n"),
      "walkForwardAverageR": holdout.get("stressedAverageR") if uses_chronological_holdout else pooled.get("averageR"),
      "targetFirstRate": holdout.get("targetHitRate") if uses_chronological_holdout else pooled.get("targetRate"),
      "stopFirstRate": holdout.get("stopHitRate") if uses_chronological_holdout else pooled.get("stopRate"),
      "developmentAverageR": (selected.get("development") or {}).get("stressedAverageR"),
      "holdoutAverageR": (selected.get("holdout") or {}).get("stressedAverageR"),
      "recentAverageR": (selected.get("recent") or {}).get("stressedAverageR"),
      "qualificationTier": qualification.get("tier"),
    }
    output_by_pattern[str(pattern["id"])] = row
    reconciled_count += 1
    print(json.dumps(row), flush=True)
  if reconciled_count:
    server._research_store.set_metadata(
      "fms_registered_reaction:reconciliation",
      json.dumps({"createdAt": int(time.time()), "rows": list(output_by_pattern.values())}, separators=(",", ":")),
    )
  else:
    print(json.dumps({"reconciled": 0, "message": "All current registrations already verify."}))


if __name__ == "__main__":
  main()
