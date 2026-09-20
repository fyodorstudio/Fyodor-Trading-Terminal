"""Declare then build a non-promoting catalogue from pinned existing evidence.

Archive SL/TP counts are reused, not recalculated or optimized. Eventual touches
use a separately pinned complete-H4 follow-up cohort with explicit unknowns.
"""
from __future__ import annotations

import argparse
import ast
from collections import Counter
import json
import os
from pathlib import Path
import re
import sqlite3
import sys
import time

from fms_prepare_v2_research import ROOT, digest, digest_bytes
sys.path.insert(0, str(ROOT / "Main/mt5-bridge"))
from fms_recipe_catalogue import REFERENCE_HORIZONS, REFERENCE_TARGETS_R, archive_contract_evidence, assess_source_clock, fixed_reference_case, project_catalogue_surface, reference_followup_case, summarize_followup, summarize_reference  # noqa: E402
from macro_signal import calculate_atr_by_candle  # noqa: E402
from registered_entry_reviews import load_registered_entry_reviews  # noqa: E402
from fms_recipe_review import select_event_specific_references  # noqa: E402


def load_verified_inventory(path: Path) -> dict:
  inventory = json.loads(path.read_text())
  copy = dict(inventory)
  expected = copy.pop("inventoryHash")
  if digest(copy) != expected or digest(inventory["recipes"]) != inventory["manifest"]["recipesSha256"]:
    raise ValueError("Frozen source inventory failed hash validation")
  return inventory


def write_frozen(path: Path, value: dict, *, compact: bool = False) -> None:
  encoded = (json.dumps(value, separators=(",", ":")) if compact else json.dumps(value, indent=2)) + "\n"
  if path.exists():
    if path.read_text(encoding="utf-8") != encoded:
      raise ValueError(f"Frozen output changed; declare a new version: {path}")
  else:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(encoded, encoding="utf-8")


def prepare(database: Path, source: Path, directory: Path) -> dict:
  inventory = load_verified_inventory(source)
  source_manifest = inventory["manifest"]
  adapter = (ROOT / "Main/mt5-bridge/server.py").read_bytes()
  profiles_bytes = (ROOT / "Main/mt5-bridge/registered_reaction_profiles.json").read_bytes()
  if digest_bytes(adapter) != source_manifest["sourceSha256"]["registryAdapter"] or digest_bytes(profiles_bytes) != source_manifest["sourceSha256"]["profiles"]:
    raise ValueError("Registry/profile source changed since inventory; reconcile a new source version")
  tree = ast.parse(adapter.decode("utf-8-sig"))
  approvals = next(ast.literal_eval(node.value) for node in tree.body if isinstance(node, ast.AnnAssign)
                   and isinstance(node.target, ast.Name) and node.target.id == "_REVIEWED_EXECUTION_APPROVALS")
  profiles = json.loads(profiles_bytes)["profiles"]
  entry_metadata, entry_profiles = load_registered_entry_reviews()
  if entry_metadata["registryHash"] != source_manifest["entryRegistryHash"]:
    raise ValueError("Reviewed H1 source changed since inventory")
  connection = sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)
  connection.execute("BEGIN")
  try:
    candles, raw_sources, source_fingerprints = {}, {}, {}
    for market in sorted({row["market"] for row in inventory["recipes"]}):
      rows = [dict(zip(("time", "open", "high", "low", "close", "volume"), row)) for row in connection.execute(
        "SELECT time,open,high,low,close,volume FROM candle_cache WHERE symbol=? AND timeframe=? ORDER BY time", (market, "H4"))]
      candles[market] = rows
      source_fingerprints[market] = {"sha256": digest(rows), "count": len(rows),
                                   "first": rows[0]["time"] if rows else None, "last": rows[-1]["time"] if rows else None}
    for recipe in inventory["recipes"]:
      raw_row = connection.execute("SELECT value FROM metadata WHERE key=?", (f"fms_raw_audit:{recipe['experimentId']}",)).fetchone()
      if not raw_row or digest_bytes(raw_row[0].encode()) != recipe["rawAuditSha256"]:
        raise ValueError(f"Immutable case source changed: {recipe['recipe']}")
      raw_sources[recipe["recipe"]] = json.loads(raw_row[0])
    prior_manifest = json.loads((directory / "manifest.json").read_text()) if (directory / "manifest.json").exists() else None
    clock_rows = [dict(zip(("ea_completed_at", "bridge_acknowledged_at"), row)) for row in connection.execute(
      "SELECT DISTINCT ea_completed_at,bridge_acknowledged_at FROM release_observations "
      "WHERE ea_completed_at IS NOT NULL AND bridge_acknowledged_at IS NOT NULL "
      "ORDER BY ea_completed_at,bridge_acknowledged_at")]
    clock_evidence = {**assess_source_clock(clock_rows), "acknowledgementPairsSha256": digest(clock_rows)}
    as_of = prior_manifest["evaluatedAt"] if prior_manifest else int(time.time())
    manifest = {
      "schema": "fms-reference-recipe-catalogue-manifest-v4", "sourceInventoryHash": inventory["inventoryHash"],
      "evaluatedAt": as_of,
      "sourceManifestHash": source_manifest["manifestHash"], "referenceStopAtr": 1.0,
      "targetsR": list(REFERENCE_TARGETS_R), "horizonsH4": list(REFERENCE_HORIZONS),
      "entryPolicy": "As-recorded timestamp comparison only: first later pinned H4 open; cross-source release/candle clock alignment unverified; no change to source entries",
      "atrPolicy": "Canonical completed-pre-entry H4 Wilder ATR14 from the same pinned snapshot; never release-containing future values",
      "archivePolicy": "Reused immutable partitions where the reference contract was recorded; absent archive geometry remains unavailable",
      "referencePolicy": "All recipes: same pinned full-H4 cohort, fixed 1-ATR stop, opening gaps first, both touched remains ambiguous, no M1 inference",
      "touchPolicy": "Same new reference geometry and complete-H4 cohort; weekday gaps unavailable, declared weekend gaps only; source price/time changes counted explicitly",
      "followupCandles": source_fingerprints, "selection": "No candidate selection or registration",
      "economicReading": "Each recipe's frozen scoring/orientation; distinguish trade continuation/rejection",
      "holdoutStatus": "Reused archive, not untouched validation; recent archive can overlap holdout",
      "sourceClock": clock_evidence,
    }
    manifest["manifestHash"] = digest(manifest)
    # Freeze policies and source geometry before computing catalogue outcomes.
    write_frozen(directory / "clock-samples.json", clock_rows)
    write_frozen(directory / "manifest.json", manifest)
    prepared_candles = {market: (series, [row["time"] for row in series], calculate_atr_by_candle(series)) for market, series in candles.items()}
    results, reconciliation = [], []
    for recipe in inventory["recipes"]:
      key, market = recipe["recipe"], recipe["market"]
      raw = raw_sources[key]
      identity = (market, recipe["patternId"])
      profile = profiles[key]
      approval = approvals.get(identity)
      if approval:
        research = profile.get("executionChallenger") or {}
        best = research.get("bestChallenger") or {}
        expected = {"family": approval["family"], "stopAtr": approval["stopAtr"], "targetR": approval["targetR"],
                    "holdingCandles": approval["expiryCandles"], "triggerR": approval["triggerR"]}
        matches = all(best.get(field) == value for field, value in expected.items()) and all(
          research.get(field) == approval[field] for field in ("candleFingerprint", "datasetFingerprint"))
        matches = matches and (research.get("registryReview") or {}).get("decision") == "approved_for_registry_review"
        reconciliation.append({"recipe": key, "kind": "execution_approval", "artifactMatches": matches})
        if not matches:
          raise ValueError(f"Code-owned baseline approval does not match evidence: {key}")
      if identity in entry_profiles:
        frozen = entry_profiles[identity]["contract"]
        geometry = recipe["snapshotExecution"] or {}
        matches = all(geometry.get(field) == value for field, value in frozen.items())
        reconciliation.append({"recipe": key, "kind": "H1_source_contract", "artifactMatches": matches})
        if not matches:
          raise ValueError(f"Reviewed H1 source contract mismatches registry snapshot: {key}")
      included = [case for case in raw["cases"] if case.get("included")]
      if len({case["caseId"] for case in included}) != len(included):
        raise ValueError(f"Duplicate immutable case IDs: {key}")
      selected_rows = {row["caseId"]: row for row in raw["contractResults"][raw["selectedContractKey"]]}
      series, times, atrs = prepared_candles[market]
      contracts, followup = [], []
      for horizon in REFERENCE_HORIZONS:
        rows = [reference_followup_case(case, (selected_rows.get(case["caseId"]) or {}).get("direction", ""), series, times, atrs, horizon, as_of=as_of) for case in included]
        followup.append({"horizonCandles": horizon, "all": summarize_followup(rows),
                         "development": summarize_followup([row for row in rows if row["eventTime"] < recipe["splitTime"]]),
                         "holdout": summarize_followup([row for row in rows if row["eventTime"] >= recipe["splitTime"]])})
        for target in REFERENCE_TARGETS_R:
          contract = next((row for row in raw["contracts"] if row["stopAtr"] == 1.0 and row["targetR"] == target and row["holdingCandles"] == horizon), None)
          benchmark_rows = [fixed_reference_case(row, target) for row in rows]
          contracts.append({"key": f"1|{target:g}|{horizon}", "stopAtr": 1.0, "targetR": target, "horizonCandles": horizon,
                            "partitions": {"overall": summarize_reference(benchmark_rows, "overall"),
                              "development": summarize_reference([row for row in benchmark_rows if row["eventTime"] < recipe["splitTime"]], "development"),
                              "holdout": summarize_reference([row for row in benchmark_rows if row["eventTime"] >= recipe["splitTime"]], "holdout")},
                            "archiveReference": {scope: archive_contract_evidence(contract, scope) for scope in ("overall", "development", "holdout", "recent")} if contract else None})
      results.append({"recipe": key, "market": market, "patternId": recipe["patternId"], "label": recipe["label"],
                      "configuration": recipe["configuration"], "experimentId": recipe["experimentId"],
                      "caseCount": recipe["caseCount"], "distinctReleaseEpisodes": recipe["distinctReleaseEpisodes"],
                      "splitTime": recipe["splitTime"], "executionReview": recipe["executionReview"],
                      "noteKeys": recipe["noteKeys"], "referenceContracts": contracts, "followup": followup})
    universe = re.findall(r'name: "([A-Z]{6})"', (ROOT / "Main/src/app/config/fxPairs.ts").read_text())
    payload = {
      "schema": "fms-reference-recipe-catalogue-v1", "manifest": manifest, "recipes": results,
      "baselineReconciliation": reconciliation, "universe": universe,
      "marketsWithoutBaselineRecipe": sorted(set(universe) - {row["market"] for row in results}),
      "summary": {"recipes": len(results), "referenceContracts": sum(len(row["referenceContracts"]) for row in results),
                  "markets": len({row["market"] for row in results}), "newRegistrations": 0,
                  "archiveReferenceContracts": sum(row["archiveReference"] is not None for recipe in results for row in recipe["referenceContracts"]),
                  "reconciledApprovals": len(reconciliation)},
      "limitations": inventory["limitations"] + [
        "Pinned H4 reference returns and touches use the same attempted cohort; target-dependent ambiguous cases have explicit separate evaluable denominators.",
        "Reused archive SL/TP evidence can have finer ordering and different coverage/snapshot dates; it stays separately labeled, never merged with the coarse reference.",
        "A later touch after stop is not a win. Direction/excursion/target touch statistics are not captured returns.",
        "Exact current runtime activation behavior still needs lifecycle verification; this catalogue is not a trading successor.",
        "Calendar server-clock and candle UTC alignment is unverified. Reference results are as-recorded descriptive evidence, not verified post-information execution; do not approve a successor from these timings.",
      ],
    }
    payload["catalogueHash"] = digest(payload)
    write_frozen(directory / "catalogue.json", payload)
    return payload
  finally:
    connection.rollback()
    connection.close()


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--database", type=Path, default=Path(os.environ.get("FYODOR_RESEARCH_DB") or str(Path(os.environ["LOCALAPPDATA"]) / "Fyodor Trading Terminal/fyodor-research.sqlite3")))
  parser.add_argument("--source", type=Path, required=True)
  parser.add_argument("--directory", type=Path, required=True)
  parser.add_argument("--publish-surface", type=Path, help="Publish a compact presentation of an existing hash-verified catalogue without querying SQLite")
  parser.add_argument("--select-event-specific", type=Path, help="Freeze development-only per-recipe selections from an existing verified catalogue; never promote")
  args = parser.parse_args()
  if args.publish_surface or args.select_event_specific:
    result = json.loads((args.directory / "catalogue.json").read_text(encoding="utf-8"))
    hashed = dict(result)
    expected = hashed.pop("catalogueHash")
    manifest = dict(result["manifest"])
    manifest_hash = manifest.pop("manifestHash")
    if digest(hashed) != expected or digest(manifest) != manifest_hash:
      raise ValueError("Catalogue/manifest failed hash verification; presentation refused")
    if args.publish_surface and args.select_event_specific:
      raise ValueError("Choose one frozen-source projection at a time")
    if args.select_event_specific:
      selection = select_event_specific_references(result)
      selection["sourceSha256"] = {"selector": digest_bytes((ROOT / "Main/mt5-bridge/fms_recipe_review.py").read_bytes()),
                                   "runner": digest_bytes(Path(__file__).read_bytes())}
      selection["selectionHash"] = digest(selection)
      write_frozen(args.select_event_specific, selection)
      print(json.dumps({**selection["summary"], "selectionHash": selection["selectionHash"], "newRegistrations": 0}))
      return
    write_frozen(args.publish_surface, project_catalogue_surface(result), compact=True)
  else:
    result = prepare(args.database, args.source, args.directory)
  print(json.dumps({**result["summary"], "manifestHash": result["manifest"]["manifestHash"], "catalogueHash": result["catalogueHash"]}))


if __name__ == "__main__":
  main()
