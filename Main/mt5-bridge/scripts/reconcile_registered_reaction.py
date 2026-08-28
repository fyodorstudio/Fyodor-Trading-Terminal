from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys
import time
from typing import Any, Dict

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server
from macro_signal import WORKBENCH_RESEARCH_DIAGNOSTICS_VERSION, WORKBENCH_SCORING_ENGINE_VERSION, build_workbench_experiment


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
    "researchDiagnosticsVersion": WORKBENCH_RESEARCH_DIAGNOSTICS_VERSION,
    "cohort": pattern.get("cohort", {"dimension": "none", "value": "all"}),
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
    "reconciliation": "registered-reaction-v3-current-engine-fixed-contract",
  }


def main() -> None:
  output = []
  for pattern in server.PRACTICAL_PATTERN_DEFINITIONS:
    provenance = server._registration_provenance(pattern)
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
    row = {
      "patternId": pattern["id"],
      "id": experiment_id,
      "historicalN": result.get("historicalN"),
      "walkForwardN": pooled.get("n"),
      "walkForwardAverageR": pooled.get("averageR"),
      "targetFirstRate": pooled.get("targetRate"),
      "stopFirstRate": pooled.get("stopRate"),
      "developmentAverageR": (selected.get("development") or {}).get("stressedAverageR"),
      "holdoutAverageR": (selected.get("holdout") or {}).get("stressedAverageR"),
      "recentAverageR": (selected.get("recent") or {}).get("stressedAverageR"),
      "qualificationTier": qualification.get("tier"),
    }
    output.append(row)
    print(json.dumps(row), flush=True)
  if output:
    server._research_store.set_metadata(
      "fms_registered_reaction:reconciliation",
      json.dumps({"createdAt": int(time.time()), "rows": output}, separators=(",", ":")),
    )
  else:
    print(json.dumps({"reconciled": 0, "message": "All current registrations already verify."}))


if __name__ == "__main__":
  main()
