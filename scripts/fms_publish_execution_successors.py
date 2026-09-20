"""Publish explicitly reviewed FMS v2 execution successors from frozen research.

This publisher is deliberately non-discovering: the approved identities and the
review rule are code-owned below. It reads only the frozen research JSON, never
the bridge, database, FastAPI or MetaTrader5.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path
from typing import Any


SCHEMA = "fms-registered-execution-successors-v1"
DISPLAY_VERSION = "FMS v2"

# These identities were reviewed after the frozen 480-contract-per-recipe pass.
# Adding an identity requires a source change and a newly hashed registry file;
# regenerating research cannot silently promote another recipe.
APPROVED_RECIPES = (
  "AUDJPY|audjpy-jpy-inflation-short",
  "AUDUSD|audusd-business-confidence-rejection",
  "EURCAD|eurcad-eur-consumer-sentiment",
  "EURJPY|eurjpy-eur-composite-services-pmi",
  "EURUSD|eurusd-cpi-package",
  "EURUSD|eurusd-ism-manufacturing-employment-package",
  "EURUSD|eurusd-us-payroll-short-restored",
  "EURUSD|eurusd-us-producer-inflation-cooling-restored",
  "EURUSD|us-industrial-output-directional",
  "GBPUSD|gbpusd-gdp-sales-q-q-package",
  "NZDUSD|nzdusd-gdp-annual-change-package",
  "NZDUSD|nzdusd-gdp-sales-q-q-package",
  "USDCAD|usdcad-canada-retail-sales",
  "USDCAD|usdcad-us-producer-inflation",
  "USDCHF|usdchf-fed-industrial-production-m-m-package",
  "USDJPY|usdjpy-us-employment-release",
  "USDJPY|usdjpy-us-trade-balance-ordinary",
)

REVIEWED_EXCLUSIONS = {
  "USDJPY|usdjpy-us-manufacturing-employment": (
    "The fixed-H4 parent improved in the frozen grid, but a separately registered context contract "
    "can override its live execution. The candidate is not an exact match for that composite runtime "
    "and remains FMS v1 until a matched context-aware comparison is declared."
  ),
}


def digest(value: Any) -> str:
  encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
  return hashlib.sha256(encoded).hexdigest()


def verified_payload(path: Path) -> dict:
  payload = json.loads(path.read_text(encoding="utf-8"))
  expected = payload.pop("researchHash", None)
  if expected != digest(payload):
    raise ValueError("Frozen execution research failed hash validation")
  payload["researchHash"] = expected
  manifest = deepcopy(payload.get("manifest") or {})
  manifest_hash = manifest.pop("manifestHash", None)
  if manifest_hash != digest(manifest):
    raise ValueError("Frozen execution manifest failed hash validation")
  if payload.get("schema") != "fms-event-specific-execution-research-v1":
    raise ValueError("Unsupported execution research schema")
  return payload


def compact_partition(source: dict) -> dict:
  return {
    key: source.get(key)
    for key in (
      "attemptedCount", "evaluableCount", "targetHitCount", "targetHitRate",
      "stopHitCount", "stopHitRate", "expiredCount", "ambiguousCount",
      "unevaluableCount", "averageGrossR", "pessimisticSelectionAverageR",
      "expectancyCi95", "evaluableYears", "positiveYears", "unavailableByReason",
    )
  }


def contract(source: dict) -> dict:
  return {
    "stopAtr": float(source["stopAtr"]),
    "targetR": float(source["targetR"]),
    "expiryCandles": int(source["horizonCandles"]),
    "managementFamily": "fixed",
    "managementTriggerR": None,
    "entryTimeframe": "H4",
    "expiryTimeframe": "H4",
  }


def _write_frozen_json(path: Path, payload: dict, label: str) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  encoded = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
  if path.exists() and path.read_text(encoding="utf-8") != encoded:
    raise ValueError(f"{label} already exists with different content; declare a new version")
  path.write_text(encoded, encoding="utf-8")


def successor_surface(source: dict, registry: dict) -> dict:
  profiles = registry["profiles"]
  exclusions = registry["reviewedExclusions"]
  rows = []
  for source_row in source.get("recipes") or []:
    recipe = str(source_row["recipe"])
    selected = source_row.get("selectedContract") or {}
    baseline = source_row.get("matchedV1Contract") or None
    comparison = source_row.get("matchedV1Comparison") or None
    if recipe in profiles:
      decision = "registered_fms_v2"
      reason = "Exact matched fixed-H4 improvement approved with a new activation boundary."
      registration_id = profiles[recipe]["registrationId"]
    elif recipe in exclusions:
      decision = "reviewed_excluded"
      reason = exclusions[recipe]
      registration_id = None
    elif source_row.get("status") == "matched_v1_improvement_lead":
      decision = "research_lead_not_registered"
      reason = "The historical lead was not included in the explicit reviewed allowlist."
      registration_id = None
    elif source_row.get("status") == "positive_reused_history_lead":
      decision = "research_lead_not_comparable"
      reason = "Positive reused-history lead, but the current runtime contract was not an exact fixed-H4 comparator or did not improve it in both partitions."
      registration_id = None
    else:
      decision = "retain_fms_v1"
      reason = "The development-selected candidate did not stay positive in reused holdout."
      registration_id = None
    rows.append({
      "recipe": recipe, "market": source_row["market"], "patternId": source_row["patternId"],
      "label": source_row["label"], "researchStatus": source_row["status"],
      "decision": decision, "decisionReason": reason, "registrationId": registration_id,
      "selectedContract": {
        "stopAtr": selected.get("stopAtr"), "targetR": selected.get("targetR"),
        "expiryCandles": selected.get("horizonCandles"),
        "partitions": {scope: compact_partition((selected.get("partitions") or {}).get(scope) or {})
                       for scope in ("development", "holdout", "overall")},
      },
      "matchedV1Contract": None if baseline is None else {
        "stopAtr": baseline.get("stopAtr"), "targetR": baseline.get("targetR"),
        "expiryCandles": baseline.get("horizonCandles"),
      },
      "matchedV1Comparison": comparison,
      "commonPathAttemptedN": source_row.get("commonPathAttemptedN"),
      "commonPathObservedN": source_row.get("commonPathObservedN"),
      "originalReview": {
        "status": (source_row.get("originalExecutionReview") or {}).get("status"),
        "failedChecks": (source_row.get("originalExecutionReview") or {}).get("failedChecks") or [],
      },
      "noteCount": len(source_row.get("noteKeys") or []),
    })
  payload = {
    "schema": "fms-execution-successor-surface-v1",
    "evaluatedAt": source["manifest"]["evaluatedAt"],
    "activatedAt": registry["activatedAt"],
    "sourceResearchHash": source["researchHash"],
    "sourceManifestHash": source["manifest"]["manifestHash"],
    "registryHash": registry["registryHash"],
    "clockAudit": source["clockAudit"],
    "approvalPolicy": registry["approvalPolicy"],
    "summary": {
      "recipes": len(rows), "markets": len({row["market"] for row in rows}),
      "contractsPerRecipe": source["summary"]["contractsPerRecipe"],
      "matchedImprovementLeads": sum(row["researchStatus"] == "matched_v1_improvement_lead" for row in rows),
      "registeredSuccessors": sum(row["decision"] == "registered_fms_v2" for row in rows),
      "reviewedExclusions": sum(row["decision"] == "reviewed_excluded" for row in rows),
      "researchOnlyLeads": sum(row["decision"].startswith("research_lead") for row in rows),
      "retainedV1": sum(row["decision"] == "retain_fms_v1" for row in rows),
    },
    "limitations": source["limitations"],
    "rows": rows,
  }
  payload["surfaceHash"] = digest(payload)
  return payload


def publish(source_path: Path, output_path: Path, activated_at: int, surface_path: Path | None = None) -> dict:
  if activated_at <= 0:
    raise ValueError("A positive immutable activation timestamp is required")
  source = verified_payload(source_path)
  if not (source.get("clockAudit") or {}).get("relativeExecutionResearchEligible"):
    raise ValueError("Frozen clock audit does not permit relative execution research")
  rows = {str(row["recipe"]): row for row in source.get("recipes") or []}
  if set(APPROVED_RECIPES) - set(rows):
    raise ValueError("An explicitly approved recipe is absent from frozen research")

  profiles: dict[str, dict] = {}
  for index, recipe in enumerate(APPROVED_RECIPES, start=1):
    row = rows[recipe]
    selected = row.get("selectedContract") or {}
    baseline = row.get("matchedV1Contract") or {}
    comparison = row.get("matchedV1Comparison") or {}
    partitions = comparison.get("partitions") or {}
    if row.get("status") != "matched_v1_improvement_lead":
      raise ValueError(f"Approved recipe no longer has matched improvement status: {recipe}")
    if not comparison.get("matchedCohort") or not comparison.get("configurationChanged") \
        or not comparison.get("improvesDevelopmentAndReusedHoldout"):
      raise ValueError(f"Approved recipe failed the declared matched-cohort rule: {recipe}")
    if any(float((partitions.get(scope) or {}).get("deltaPessimisticAverageR") or 0) <= 0
           for scope in ("development", "holdout")):
      raise ValueError(f"Approved recipe lacks positive development/holdout improvement: {recipe}")
    if float(((selected.get("partitions") or {}).get("holdout") or {}).get("pessimisticSelectionAverageR") or 0) <= 0:
      raise ValueError(f"Approved recipe lacks positive reused-holdout evidence: {recipe}")
    market, pattern_id = recipe.split("|", 1)
    profiles[recipe] = {
      "registrationId": f"FMS-V2-EXEC-{index:03d}",
      "market": market,
      "patternId": pattern_id,
      "label": row["label"],
      "previousExecution": contract(baseline),
      "currentExecution": contract(selected),
      "development": compact_partition(selected["partitions"]["development"]),
      "holdout": compact_partition(selected["partitions"]["holdout"]),
      "overall": compact_partition(selected["partitions"]["overall"]),
      "matchedV1Comparison": deepcopy(comparison),
      "commonPathAttemptedN": int(row["commonPathAttemptedN"]),
      "commonPathObservedN": int(row["commonPathObservedN"]),
      "limitations": (
        "Gross reused history; the chronological holdout was revealed after development selection, "
        "is not fresh validation, and may share release episodes with other pair recipes."
      ),
    }

  payload = {
    "schema": SCHEMA,
    "displayVersion": DISPLAY_VERSION,
    "activatedAt": int(activated_at),
    "sourceResearchHash": source["researchHash"],
    "sourceManifestHash": source["manifest"]["manifestHash"],
    "sourceClockSha256": source["manifest"]["sourceClockSha256"],
    "approvalPolicy": {
      "selection": source["manifest"]["selectionPolicy"],
      "entry": source["manifest"]["entryPolicy"],
      "cohort": source["manifest"]["cohortPolicy"],
      "ordering": source["manifest"]["orderingPolicy"],
      "review": (
        "Exact fixed-H4 v1 baseline matched on the same complete 60-H4 cohort; "
        "development-selected contract is distinct, positive, and improves pessimistic average gross R "
        "in both development and reused holdout; reused holdout is also positive."
      ),
      "automaticPromotion": False,
      "uncertaintyAutomaticVeto": False,
    },
    "profileCount": len(profiles),
    "profiles": profiles,
    "reviewedExclusions": REVIEWED_EXCLUSIONS,
    "preservesV1History": True,
    "orderTransmission": False,
  }
  payload["registryHash"] = digest(payload)
  _write_frozen_json(output_path, payload, "Successor registry")
  if surface_path is not None:
    _write_frozen_json(surface_path, successor_surface(source, payload), "Successor surface")
  return payload


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--source", type=Path, required=True)
  parser.add_argument("--output", type=Path, required=True)
  parser.add_argument("--activated-at", type=int, required=True)
  parser.add_argument("--surface-output", type=Path)
  args = parser.parse_args()
  payload = publish(args.source, args.output, args.activated_at, args.surface_output)
  print(json.dumps({"profiles": payload["profileCount"], "registryHash": payload["registryHash"]}))


if __name__ == "__main__":
  main()
