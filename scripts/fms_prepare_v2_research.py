"""Freeze a v2 research source inventory without importing/running the bridge.

This joins existing evidence and durable notes. It runs no optimization, opens
no MT5 connection, changes no database rows, and creates no registration.
"""
from __future__ import annotations

import argparse
import ast
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Main/mt5-bridge"))
from fms_recipe_review import audit_note_signal, project_recipe_review  # noqa: E402
from registered_entry_reviews import load_registered_entry_reviews  # noqa: E402


def digest_bytes(value: bytes) -> str:
  return hashlib.sha256(value).hexdigest()


def digest(value: object) -> str:
  return digest_bytes(json.dumps(value, sort_keys=True, separators=(",", ":")).encode())


def baseline_approval_keys(source: str) -> set[tuple[str, str]]:
  # Inspect the literal code-owned approval map; do not import the live adapter.
  tree = ast.parse(source)
  for node in tree.body:
    if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and node.target.id == "_REVIEWED_EXECUTION_APPROVALS":
      return set(ast.literal_eval(node.value))
  raise ValueError("Code-owned execution approval map was not found")


def prepare(database: Path) -> dict:
  bridge = ROOT / "Main/mt5-bridge"
  paths = {
    "profiles": bridge / "registered_reaction_profiles.json",
    "entryRegistry": bridge / "registered_entry_review_evidence.json",
    "registryAdapter": bridge / "server.py",
    "exhaustion": ROOT / "docs/Development Logs/artifacts/fms-exhaustion-ledger-2026-09-07.json",
  }
  source_bytes = {key: path.read_bytes() for key, path in paths.items()}
  profiles = json.loads(source_bytes["profiles"])["profiles"]
  entry_metadata, entry_profiles = load_registered_entry_reviews(paths["entryRegistry"])
  approvals = baseline_approval_keys(source_bytes["registryAdapter"].decode("utf-8-sig"))
  connection = sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)
  connection.execute("BEGIN")
  try:
    snapshot_row = connection.execute("SELECT value FROM metadata WHERE key=?", ("fms_global_chart_response:v1",)).fetchone()
    if not snapshot_row:
      raise ValueError("Saved registry snapshot missing; do not infer registrations from profiles")
    snapshot = json.loads(snapshot_row[0])
    registered = {(market["symbol"], pattern["id"]): pattern for market in snapshot["markets"]
                  for pattern in market["patterns"] if pattern.get("currentEligible")}
    if set(profiles) != {f"{market}|{pattern}" for market, pattern in registered}:
      raise ValueError("Saved registry and source-profile identities differ; reconcile before freezing")
    notes = [dict(zip(("recordKey", "label", "note", "market", "patternId", "eventTime", "updatedAt"), row))
             for row in connection.execute("SELECT record_key,label,note,market,pattern_id,event_time,updated_at FROM fms_review_notes ORDER BY record_key")]
    recipes = []
    for key, profile in sorted(profiles.items()):
      market, pattern_id = key.split("|", 1)
      pattern = registered[(market, pattern_id)]
      experiment_id = profile["experimentId"]
      stored = connection.execute("SELECT configuration_json,result_json FROM fms_experiments WHERE id=?", (experiment_id,)).fetchone()
      raw_row = connection.execute("SELECT value FROM metadata WHERE key=?", (f"fms_raw_audit:{experiment_id}",)).fetchone()
      if not stored or not raw_row:
        raise ValueError(f"Frozen experiment/case source missing: {key}")
      configuration, result, raw = json.loads(stored[0]), json.loads(stored[1]), json.loads(raw_row[0])
      selected = next((row for row in raw["contracts"] if row["key"] == raw["selectedContractKey"]), None)
      if selected is None:
        raise ValueError(f"Selected immutable source contract missing: {key}")
      included = [row for row in raw["cases"] if row.get("included")]
      identity = (market, pattern_id)
      recipes.append({
        "recipe": key, "market": market, "patternId": pattern_id, "label": pattern["label"],
        "displayBaseline": "FMS v1", "snapshotExecution": pattern.get("execution"),
        "experimentId": experiment_id, "configuration": configuration,
        "configurationSha256": digest_bytes(stored[0].encode()),
        "resultSha256": digest_bytes(stored[1].encode()),
        "rawAuditSha256": digest_bytes(raw_row[0].encode()),
        "splitTime": result.get("splitTime"), "caseCount": len(included),
        "distinctReleaseEpisodes": len({row["eventTime"] for row in included}),
        "savedSelectedContract": selected,
        "response": {field: profile.get(field) for field in ("scope", "classification", "horizons", "mfe", "mae", "givebackAtr")},
        "executionReview": project_recipe_review(profile, approved_in_baseline=identity in approvals),
        "reviewedH1": entry_profiles.get(identity),
        "noteKeys": [row["recordKey"] for row in notes if row["market"] == market and row["patternId"] == pattern_id],
      })
    coverage = [dict(zip(("market", "timeframe", "candles", "first", "last"), row))
                for row in connection.execute("SELECT symbol,timeframe,count(*),min(time),max(time) FROM candle_cache GROUP BY symbol,timeframe ORDER BY symbol,timeframe")]
    manifest = {
      "schema": "fms-v2-research-source-manifest-v1",
      "objective": "More registered event–pair recipes and/or better execution recipes; preserve FMS v1",
      "sourceSha256": {key: digest_bytes(value) for key, value in source_bytes.items()},
      "registrySnapshotSha256": digest_bytes(snapshot_row[0].encode()),
      "registrySnapshotGeneratedAt": snapshot.get("generatedAt"),
      "snapshotModelId": snapshot.get("modelId"), "snapshotModelHash": snapshot.get("modelHash"),
      "recipesSha256": digest(recipes), "notesSha256": digest(notes), "coverageSha256": digest(coverage),
      "entryRegistryHash": entry_metadata["registryHash"],
      "codeOwnedExecutionApprovals": sorted(f"{market}|{pattern}" for market, pattern in approvals),
      "status": "source_inventory_only_not_successor_registration",
      "newRegistrations": 0, "originalProtocolsPreserved": True,
    }
    manifest["manifestHash"] = digest(manifest)
    return {
      "schema": "fms-v2-research-inventory-v1", "manifest": manifest,
      "recipes": recipes, "notes": notes, "coverage": coverage,
      "summary": {"recipes": len(recipes), "markets": len({row["market"] for row in recipes}),
                  "executionReviewStatuses": dict(Counter(row["executionReview"]["status"] for row in recipes)),
                  "reviewedH1Recipes": sum(row["reviewedH1"] is not None for row in recipes),
                  "notes": len(notes), "newRegistrations": 0},
      "limitations": [
        "The saved registry snapshot is dated evidence, not proof of current runtime readiness or final eligibility.",
        "Code-owned approval membership still requires exact current contract/artifact identity reconciliation.",
        "Response alignment is in each frozen recipe's trade direction, not necessarily economic following.",
        "Selected-contract TP-before-SL evidence is not a common-policy TP1/TP2/TP3 ladder.",
        "Previous declined/approved outcomes and reused holdouts remain unchanged; this is not fresh validation.",
        "Notes supply hypotheses, not replacement outcomes or an optimization-only sample.",
        "Cached candle coverage is not contiguous-path coverage or proof of package availability/executable fills.",
      ],
    }
  finally:
    connection.rollback()
    connection.close()


def audit_notes(database: Path, source: Path) -> dict:
  inventory = json.loads(source.read_text(encoding="utf-8"))
  hashed = dict(inventory)
  expected = hashed.pop("inventoryHash")
  if digest(hashed) != expected:
    raise ValueError("Note source inventory failed hash verification")
  notes = [row for row in inventory["notes"] if row["label"] == "documented"]
  connection = sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)
  connection.execute("BEGIN")
  try:
    inputs, results = {}, []
    for market in sorted({note["market"] for note in notes}):
      raw = connection.execute("SELECT value FROM metadata WHERE key=?", (f"fms_chart_response:current:{market}",)).fetchone()
      response = json.loads(raw[0])["response"] if raw else {}
      market_notes = [note for note in notes if note["market"] == market]
      selected = {}
      historical_sources = {}
      for note in market_notes:
        chosen, source_key = response, f"fms_chart_response:current:{market}"
        expected_id = f"{note['patternId']}:{note['eventTime']}"
        if not any(row["id"] == expected_id for row in response.get("signals", []) + response.get("recoveredSignals", [])) and response.get("modelHash"):
          cached = connection.execute(
            "SELECT key,value FROM metadata WHERE key LIKE ? AND instr(value,?)>0 "
            "AND json_extract(value,'$.response.modelHash')=? "
            "ORDER BY json_extract(value,'$.createdAt') DESC LIMIT 1",
            ("fms_chart_response:replay:%", expected_id, response["modelHash"])).fetchone()
          if cached:
            historical = json.loads(cached[1])["response"]
            if historical.get("symbol") == market:
              chosen, source_key = historical, cached[0]
              historical_sources[source_key] = {"hash": digest(historical), "generatedAt": historical.get("generatedAt")}
        selected[note["recordKey"]] = (chosen, source_key)
      start = min(note["eventTime"] for note in market_notes) - 45 * 86400
      end = max(int(chosen.get("generatedAt") or 0) for chosen, _ in selected.values())
      candles = {timeframe: [dict(zip(("time", "open", "high", "low", "close", "volume"), row)) for row in connection.execute(
          "SELECT time,open,high,low,close,volume FROM candle_cache WHERE symbol=? AND timeframe=? AND time BETWEEN ? AND ? ORDER BY time",
          (market, timeframe, start, end))] for timeframe in ("H4", "H1")}
      inputs[market] = {"snapshotHash": digest(response), "generatedAt": response.get("generatedAt"),
                        "historicalSources": historical_sources,
                        "candles": {timeframe: {"hash": digest(rows), "count": len(rows)} for timeframe, rows in candles.items()}}
      results.extend({**audit_note_signal(note, selected[note["recordKey"]][0], candles["H4"], candles["H1"]),
                      "snapshotSource": selected[note["recordKey"]][1]} for note in market_notes)
    return {"schema": "fms-documented-note-path-audit-v1", "sourceInventoryHash": expected,
            "runnerHash": digest_bytes(Path(__file__).read_bytes()),
            "evaluatorHash": digest_bytes((ROOT / "Main/mt5-bridge/macro_signal.py").read_bytes()),
            "auditSourceHash": digest_bytes((ROOT / "Main/mt5-bridge/fms_recipe_review.py").read_bytes()),
            "inputs": inputs, "rows": results, "statuses": dict(Counter(row["status"] for row in results)),
            "newRegistrations": 0, "timestampsChanged": False,
            "limitations": ["Clock basis unverified; this verifies as-recorded canonical path consistency, not post-information eligibility.",
                            "Frozen signal ATR is replayed, not recalculated from revised broker candles; scoring/package selection is not rerun.",
                            "Current snapshots/cached paths are dated evidence; missing legacy rows are not deleted notes.",
                            "No M1 ordering is invented; unresolved finer ordering stays explicit. No outcome correction or promotion occurs."]}
  finally:
    connection.rollback()
    connection.close()


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--database", type=Path, default=Path(os.environ.get("FYODOR_RESEARCH_DB") or
      str(Path(os.environ["LOCALAPPDATA"]) / "Fyodor Trading Terminal/fyodor-research.sqlite3")))
  parser.add_argument("--output", type=Path, required=True)
  parser.add_argument("--audit-notes-from", type=Path, help="Audit documented note paths from a hash-verified inventory instead of preparing a new inventory")
  args = parser.parse_args()
  result = audit_notes(args.database, args.audit_notes_from) if args.audit_notes_from else prepare(args.database)
  result["inventoryHash"] = digest(result)
  encoded = json.dumps(result, indent=2) + "\n"
  if args.output.exists():
    if args.output.read_text(encoding="utf-8") != encoded:
      raise ValueError("Output differs from frozen inventory; choose a new versioned path")
  else:
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(encoded, encoding="utf-8")
  print(json.dumps({"statuses": result["statuses"], "auditHash": result["inventoryHash"]} if args.audit_notes_from else
                   {**result["summary"], "manifestHash": result["manifest"]["manifestHash"], "inventoryHash": result["inventoryHash"]}))


if __name__ == "__main__":
  main()
