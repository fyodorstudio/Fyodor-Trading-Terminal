from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys
import time
from typing import Any, Dict

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server
from macro_signal import (
  PAIR_ORIENTATION_VERSION,
  WORKBENCH_RESEARCH_DIAGNOSTICS_VERSION,
  WORKBENCH_SCORING_ENGINE_VERSION,
  build_workbench_experiment,
)


def configuration_for(pattern: Dict[str, Any], bundle: Dict[str, Any], matrix: bool) -> Dict[str, Any]:
  execution = pattern["execution"]
  signatures = list(pattern["signatures"])
  return {
    "market": "EURUSD",
    "sourceVersionId": pattern["sourceVersion"],
    "signature": signatures[0],
    "signatures": signatures,
    "directionSelection": "both" if len(signatures) > 1 else signatures[0].split("|", 1)[0],
    "scoringPolicy": "forecast_quality",
    "scoringEngineVersion": WORKBENCH_SCORING_ENGINE_VERSION,
    "pairOrientationVersion": PAIR_ORIENTATION_VERSION,
    "researchDiagnosticsVersion": WORKBENCH_RESEARCH_DIAGNOSTICS_VERSION,
    "cohort": {"dimension": "none", "value": "all"},
    "requiredExactTitles": list(pattern.get("requiredExactTitles", ())),
    "reaction": "continuation",
    "execution": ({
      "mode": "matrix",
      "stopAtrValues": [.5, .75, 1, 1.25, 1.5, 2],
      "targetRValues": [.5, .75, 1, 1.25, 1.5, 2, 2.5, 3, 4],
      "holdingCandles": [6, 12, 18, 30, 42, 60],
    } if matrix else {
      "mode": "single",
      "stopAtrValues": [float(execution["stopAtr"])],
      "targetRValues": [float(execution["targetR"])],
      "holdingCandles": [int(execution["expiryCandles"])],
    }),
    "entry": "first_h4_open_strictly_after_release",
    "sourceRunIds": bundle["runIds"],
    "researchPriceCutoff": bundle["cutoff"],
    "candleRevision": bundle["candleRevision"],
    "reconstruction": "legacy-current-engine-exact-package-v1",
    "legacyPatternId": pattern["id"],
  }


def materialize(pattern: Dict[str, Any], bundle: Dict[str, Any], matrix: bool) -> Dict[str, Any]:
  configuration = configuration_for(pattern, bundle, matrix)
  configuration_hash = hashlib.sha256(
    json.dumps(configuration, sort_keys=True, separators=(",", ":")).encode("utf-8")
  ).hexdigest()
  existing = server._research_store.find_completed_fms_experiment(
    configuration_hash, bundle["datasetFingerprint"]
  )
  if existing:
    experiment_id = existing["id"]
  else:
    experiment_id = server._research_store.allocate_fms_id("E", "EURUSD")
    snapshot = {
      "id": f"legacy-reconstruction:{pattern['id']}:{'matrix' if matrix else 'fixed'}",
      "label": pattern["label"],
      "sourceVersionId": pattern["sourceVersion"],
      "signatures": list(pattern["signatures"]),
      "requiredExactTitles": list(pattern.get("requiredExactTitles", ())),
      "legacyExecution": dict(pattern["execution"]),
    }
    server._research_store.create_fms_experiment(
      experiment_id,
      f"EURUSD reconstruction · {pattern['label']} · {'matrix' if matrix else 'legacy fixed'}",
      int(time.time()), configuration, configuration_hash, snapshot, bundle["datasetFingerprint"],
    )
    server._research_store.update_fms_experiment(experiment_id, "running")
    try:
      result = build_workbench_experiment(bundle["sources"], bundle["candles"], configuration, int(time.time()))
      raw_audit = result.pop("rawAudit", None)
      result.update({
        "experimentId": experiment_id,
        "configurationHash": configuration_hash,
        "datasetFingerprint": bundle["datasetFingerprint"],
        "catalogSnapshot": snapshot,
      })
      server._research_store.update_fms_experiment(experiment_id, "completed", result=result)
      if isinstance(raw_audit, dict):
        server._research_store.set_metadata(
          f"fms_raw_audit:{experiment_id}", json.dumps(raw_audit, separators=(",", ":"))
        )
    except Exception as exc:
      server._research_store.update_fms_experiment(experiment_id, "failed", error=str(exc))
      return {"id": experiment_id, "patternId": pattern["id"], "mode": "matrix" if matrix else "fixed", "error": str(exc)}
  experiment = server._research_store.get_fms_experiment(experiment_id) or {}
  result = experiment.get("result") or {}
  selected = result.get("selectedConfiguration") or {}
  return {
    "id": experiment_id,
    "patternId": pattern["id"],
    "mode": "matrix" if matrix else "fixed",
    "historicalN": result.get("historicalN"),
    "contract": [selected.get("stopAtr"), selected.get("targetR"), selected.get("holdingCandles")],
    "developmentAverageR": (selected.get("development") or {}).get("stressedAverageR"),
    "holdoutN": (selected.get("holdout") or {}).get("evaluableCount"),
    "holdoutAverageR": (selected.get("holdout") or {}).get("stressedAverageR"),
    "holdoutTargetRate": (selected.get("holdout") or {}).get("targetHitRate"),
    "holdoutStopRate": (selected.get("holdout") or {}).get("stopHitRate"),
    "recentAverageR": (selected.get("recent") or {}).get("stressedAverageR"),
    "overallAverageR": (selected.get("overall") or {}).get("stressedAverageR"),
  }


def main() -> None:
  bundle = server._workbench_source_bundle("EURUSD")
  rows = [
    materialize(pattern, bundle, matrix)
    for pattern in server._preserved_eurusd_patterns
    for matrix in (False, True)
  ]
  server._research_store.set_metadata(
    "fms_eurusd_legacy:reconstruction",
    json.dumps({"createdAt": int(time.time()), "rows": rows}, separators=(",", ":")),
  )
  print(json.dumps(rows, indent=2))


if __name__ == "__main__":
  main()
