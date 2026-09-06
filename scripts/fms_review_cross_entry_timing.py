"""Compare H1 entry with each newly registered cross recipe's frozen H4 contract."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import statistics
import sys

ROOT = Path(__file__).resolve().parents[1]
BRIDGE = ROOT / "Main/mt5-bridge"
sys.path.insert(0, str(BRIDGE))

from macro_signal import evaluate_candidate_h1_entry  # noqa: E402
from research_store import ResearchStore  # noqa: E402
from fms_compare_entries import atr_values  # noqa: E402
import server  # noqa: E402

OUTPUT = ROOT / "docs/Development Logs/artifacts/fms-cross-entry-review-2026-09-06"
ACTIVATION = 1788700000


def digest(value: object) -> str:
  return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def summarize(rows: list[dict]) -> dict:
  if not rows:
    return {"n": 0, "h1AverageR": None, "h4AverageR": None, "pairedUpliftR": None}
  h1 = [float(row["h1"]) for row in rows]
  h4 = [float(row["h4"]) for row in rows]
  return {
    "n": len(rows), "h1AverageR": statistics.fmean(h1), "h4AverageR": statistics.fmean(h4),
    "pairedUpliftR": statistics.fmean(a - b for a, b in zip(h1, h4)),
    "h1ProfitFrequency": sum(value > 0 for value in h1) / len(h1),
    "h4ProfitFrequency": sum(value > 0 for value in h4) / len(h4),
  }


def main() -> None:
  store = ResearchStore()
  patterns = [
    row for row in server.PRACTICAL_PATTERN_DEFINITIONS
    if (row.get("registrationReview") or {}).get("status") == "reviewed_active"
    and int(row.get("activatedAt") or 0) == ACTIVATION
  ]
  manifest_core = {
    "schema": "fms-cross-exact-contract-entry-review-v1", "createdAt": ACTIVATION,
    "selection": "H1 must have positive paired development and later uplift, positive later average, and at least 10 matched later cases.",
    "entryAlternatives": ["first H1 open strictly after scheduled release", "registered first H4 open strictly after release"],
    "expiry": "Same final H4 boundary as the registered parent contract",
    "limitations": ["Gross scheduled-release OHLC simulation", "H1 same-candle order remains ambiguous without M1", "No proof of complete-package availability or live fill"],
    "recipes": [{
      "recipe": f"{row['market']}|{row['id']}", "experimentId": row["historicalBenchmark"]["experimentId"],
      "execution": row["execution"], "registrationReview": row["registrationReview"],
    } for row in patterns],
  }
  manifest = {**manifest_core, "manifestHash": digest(manifest_core)}
  findings = []
  for pattern in patterns:
    market = str(pattern["market"]); experiment_id = str(pattern["historicalBenchmark"]["experimentId"])
    experiment = store.get_fms_experiment(experiment_id); result = experiment["result"]
    raw = json.loads(store.get_metadata(f"fms_raw_audit:{experiment_id}"))
    selected = {str(row["caseId"]): row for row in raw["contractResults"][raw["selectedContractKey"]]}
    h1 = store.query_candles(market, "H1", 0, 2_000_000_000)
    h4 = store.query_candles(market, "H4", 0, 2_000_000_000)
    atrs = atr_values(h4)
    cases = []
    for case in raw["cases"]:
      frozen = selected.get(str(case["caseId"]))
      if not case.get("included") or not frozen or frozen.get("grossResultR") is None:
        continue
      candidate = {
        "eventTime": int(case["eventTime"]), "direction": frozen["direction"],
        "agreement": False, "pairVote": 0, "backgroundDirection": case.get("backgroundDirection"),
        "backgroundPairVote": case.get("backgroundPairVote"), "backgroundAlignment": case.get("backgroundAlignment"),
        "highestImpact": case.get("highestImpact"), "factorVotes": [], "events": case.get("events") or [],
      }
      execution = pattern["execution"]
      evaluated = evaluate_candidate_h1_entry(
        candidate, h1, h4, atrs, float(execution["targetR"]), stop_atr=float(execution["stopAtr"]),
        holding_candles=int(execution["expiryCandles"]),
        management_family=str(execution.get("managementFamily") or "fixed"),
        management_trigger_r=execution.get("managementTriggerR"), as_of=2_000_000_000,
      )
      if evaluated.get("resultR") is None:
        continue
      cases.append({"caseId": case["caseId"], "eventTime": int(case["eventTime"]), "h1": evaluated["resultR"], "h4": frozen["grossResultR"]})
    split = int(result["splitTime"])
    development = [row for row in cases if row["eventTime"] < split]
    later = [row for row in cases if row["eventTime"] >= split]
    dev, hold = summarize(development), summarize(later)
    supported = bool(dev["n"] and hold["n"] >= 10 and dev["pairedUpliftR"] > 0 and hold["pairedUpliftR"] > 0 and hold["h1AverageR"] > 0)
    findings.append({
      "recipe": f"{market}|{pattern['id']}", "experimentId": experiment_id, "splitTime": split,
      "contract": pattern["execution"], "development": dev, "later": hold,
      "matchedCases": len(cases), "supportedForH1Successor": supported,
    })
  payload = {"schema": manifest["schema"], "manifestHash": manifest["manifestHash"], "findings": findings, "registrationsChanged": 0, "limitations": manifest_core["limitations"]}
  OUTPUT.mkdir(parents=True, exist_ok=True)
  (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
  (OUTPUT / "result.json").write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
  print(json.dumps({"reviewed": len(findings), "supported": [row["recipe"] for row in findings if row["supportedForH1Successor"]]}))


if __name__ == "__main__":
  main()
