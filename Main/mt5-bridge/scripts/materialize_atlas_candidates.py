from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys
import time
from typing import Any, Dict, List, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server
from macro_signal import (
  PAIR_ORIENTATION_VERSION,
  WORKBENCH_RESEARCH_DIAGNOSTICS_VERSION,
  WORKBENCH_SCORING_ENGINE_VERSION,
  build_workbench_experiment,
)


def candidate_rows(artifact: Dict[str, Any]) -> List[Dict[str, Any]]:
  """Return one practical, development-selected direction per market/package.

  The atlas already froze its candidate grid. This screen deliberately keeps
  academic confidence diagnostics separate from practical registration: the
  recipe must have at least 40 cases and positive stressed average R in the
  development, later holdout, recent, and full-history partitions. Follow and
  reject variants compete for one package slot so the live registry can never
  emit contradictory arrows for the same release package.
  """
  best: Dict[Tuple[str, str], Tuple[Tuple[float, float, int, int], Dict[str, Any]]] = {}
  for market in [*artifact.get("markets", []), *artifact.get("magnitudeMarkets", [])]:
    for row in market["rows"]:
      if int(row.get("historicalN", 0)) < 40:
        continue
      execution = row.get("execution") or {}
      averages = [
        (execution.get(partition) or {}).get("stressedAverageR")
        for partition in ("development", "holdout", "recent", "overall")
      ]
      if any(value is None or float(value) <= 0 for value in averages):
        continue
      development = execution["development"]
      rank = (
        float(((development.get("stressedExpectancyCi95") or {}).get("lower")) or -999),
        float(development.get("stressedAverageR") or -999),
        int(row.get("historicalN", 0)),
        1 if row["policy"] == "forecast_quality" else 0,
      )
      key = (str(market["market"]), str(row["identity"]))
      if key not in best or rank > best[key][0]:
        best[key] = (rank, {
          **row,
          "market": market["market"],
          "datasetFingerprint": market["datasetFingerprint"],
          "cohort": str(row.get("cohort") or market.get("cohort") or "all"),
          "practicalScreen": "positive development + holdout + recent + overall; N >= 40",
        })
  return sorted((value[1] for value in best.values()), key=lambda row: (row["market"], row["label"]))


def main() -> None:
  artifact = json.loads(server._research_store.get_metadata("fms_reaction_atlas:latest") or "{}")
  rows = candidate_rows(artifact)
  output = []
  for row in rows:
    bundle = server._workbench_source_bundle(row["market"])
    identity = str(row["identity"])
    signatures = [f"long|{identity}", f"short|{identity}"]
    execution = row["execution"]
    configuration = {
      "market": row["market"],
      "sourceVersionId": row["sourceVersionId"],
      "signature": signatures[0],
      "signatures": signatures,
      "directionSelection": "both",
      "scoringPolicy": row["policy"],
      "scoringEngineVersion": WORKBENCH_SCORING_ENGINE_VERSION,
      "pairOrientationVersion": PAIR_ORIENTATION_VERSION,
      "researchDiagnosticsVersion": WORKBENCH_RESEARCH_DIAGNOSTICS_VERSION,
      "cohort": (
        {"dimension": "none", "value": "all"}
        if row.get("cohort", "all") == "all" else
        {"dimension": "relativeMagnitude", "value": row["cohort"]}
      ),
      "reaction": "contrarian" if row["reaction"] == "rejection" else "continuation",
      "execution": {
        "mode": "single",
        "stopAtrValues": [float(execution["stopAtr"])],
        "targetRValues": [float(execution["targetR"])],
        "holdingCandles": [int(execution["holdingCandles"])],
      },
      "entry": "first_h4_open_strictly_after_release",
      "sourceRunIds": bundle["runIds"],
      "researchPriceCutoff": bundle["cutoff"],
      "candleRevision": bundle["candleRevision"],
      "atlasVersion": artifact["version"],
      "atlasArtifactHash": artifact["artifactHash"],
      "atlasSelection": "development-only reaction/horizon and fixed execution contract",
    }
    configuration_hash = hashlib.sha256(
      json.dumps(configuration, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    existing = server._research_store.find_completed_fms_experiment(configuration_hash, bundle["datasetFingerprint"])
    if existing:
      experiment_id = existing["id"]
    else:
      experiment_id = server._research_store.allocate_fms_id("E", row["market"])
      server._research_store.create_fms_experiment(
        experiment_id, f"Atlas · {row['label']} · {row['policy']} · {row['reaction']}",
        int(time.time()), configuration, configuration_hash, row, bundle["datasetFingerprint"],
      )
      server._research_store.update_fms_experiment(experiment_id, "running")
      try:
        result = build_workbench_experiment(bundle["sources"], bundle["candles"], configuration, int(time.time()))
        raw_audit = result.pop("rawAudit", None)
        result.update({
          "experimentId": experiment_id,
          "configurationHash": configuration_hash,
          "datasetFingerprint": bundle["datasetFingerprint"],
          "catalogSnapshot": row,
        })
        server._research_store.update_fms_experiment(experiment_id, "completed", result=result)
        if isinstance(raw_audit, dict):
          server._research_store.set_metadata(
            f"fms_raw_audit:{experiment_id}", json.dumps(raw_audit, separators=(",", ":"))
          )
      except Exception as exc:
        server._research_store.update_fms_experiment(experiment_id, "failed", error=str(exc))
        output.append({"id": experiment_id, "market": row["market"], "label": row["label"], "error": str(exc)})
        print(json.dumps(output[-1]), flush=True)
        continue
    experiment = server._research_store.get_fms_experiment(experiment_id)
    qualification = server.get_research_experiment_qualification_v2(experiment_id)
    selected = (experiment or {}).get("result", {}).get("selectedConfiguration", {})
    summary = {
      "id": experiment_id,
      "market": row["market"],
      "label": row["label"],
      "policy": row["policy"],
      "reaction": row["reaction"],
      "historicalN": (experiment or {}).get("result", {}).get("historicalN"),
      "developmentAverageR": (selected.get("development") or {}).get("stressedAverageR"),
      "holdoutAverageR": (selected.get("holdout") or {}).get("stressedAverageR"),
      "recentAverageR": (selected.get("recent") or {}).get("stressedAverageR"),
      "qualificationTier": qualification.get("tier"),
      "qualification": qualification,
    }
    output.append(summary)
    print(json.dumps({key: value for key, value in summary.items() if key != "qualification"}), flush=True)
  server._research_store.set_metadata(
    "fms_reaction_atlas:candidate_audits", json.dumps({
      "artifactHash": artifact["artifactHash"], "createdAt": int(time.time()), "rows": output,
    }, separators=(",", ":"))
  )
  print(json.dumps({"completed": len(output)}), flush=True)


if __name__ == "__main__":
  main()
