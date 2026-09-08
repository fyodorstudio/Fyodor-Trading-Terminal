"""Run one frozen, bounded entry-known OHLC-state campaign.

The campaign evaluates four predeclared no-trade filters on three high-sample
unregistered Stage-A cells. It reuses immutable gross outcomes, never changes
the setup registry, and never contacts MT5 or an external feed.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import statistics
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATABASE = Path(os.environ["LOCALAPPDATA"]) / "Fyodor Trading Terminal/fyodor-research.sqlite3"
STAGE_A_DIRECTORY = ROOT / "docs/Development Logs/artifacts/fms-extended-stage-a-2026-09-06"
CLIENT_SUMMARY = ROOT / "Main/src/app/lib/fmsEntryStateSummary.json"
CELLS = (
  {"market": "EURCAD", "experimentId": "FMS-EURCAD-H4-E014", "label": "EUR:business_sentiment", "expectedN": 213},
  {"market": "AUDJPY", "experimentId": "FMS-AUDJPY-H4-E001", "label": "JPY:core_consumer_inflation + JPY:headline_consumer_inflation", "expectedN": 210},
  {"market": "GBPCHF", "experimentId": "FMS-GBPCHF-H4-E001", "label": "GBP:retail_headline", "expectedN": 163},
)
VARIANTS = (
  {"id": "prior_range_compressed", "feature": "priorRange", "value": "compressed", "definition": "mean range of six completed H4 candles < 0.80 entry ATR"},
  {"id": "prior_range_expanded", "feature": "priorRange", "value": "expanded", "definition": "mean range of six completed H4 candles > 1.20 entry ATR"},
  {"id": "prior_trend_aligned", "feature": "priorTrend", "value": "aligned", "definition": "12-completed-H4 close change >= 0.25 entry ATR in trade direction"},
  {"id": "prior_trend_opposed", "feature": "priorTrend", "value": "opposed", "definition": "12-completed-H4 close change >= 0.25 entry ATR against trade direction"},
)


def canonical(value: object) -> str:
  return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def digest(value: object) -> str:
  return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def save(path: Path, value: object) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  temporary = path.with_suffix(path.suffix + ".tmp")
  temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
  os.replace(temporary, path)


def read_only(database: Path) -> sqlite3.Connection:
  return sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)


def source_rows(connection: sqlite3.Connection, market: str) -> list[list[float | int]]:
  return [list(row) for row in connection.execute(
    "SELECT time,open,high,low,close FROM candle_cache WHERE symbol=? AND timeframe='H4' ORDER BY time", (market,),
  )]


def stage_a_fingerprint() -> dict[str, str]:
  paths = sorted(STAGE_A_DIRECTORY.glob("*.result.json"))
  if len(paths) != 1:
    raise RuntimeError("Exactly one frozen Stage-A result is required")
  return {"path": str(paths[0].relative_to(ROOT)).replace("\\", "/"), "sha256": hashlib.sha256(paths[0].read_bytes()).hexdigest()}


def prepare(database: Path, directory: Path) -> None:
  manifest_path = directory / "manifest.json"
  if manifest_path.exists():
    raise ValueError("Manifest already exists; run the frozen campaign instead of replacing it")
  connection = read_only(database)
  frozen_cells = []
  try:
    for cell in CELLS:
      raw = connection.execute("SELECT value FROM metadata WHERE key=?", (f"fms_raw_audit:{cell['experimentId']}",)).fetchone()
      if raw is None:
        raise RuntimeError(f"Missing immutable audit for {cell['experimentId']}")
      candles = source_rows(connection, cell["market"])
      if not candles:
        raise RuntimeError(f"Missing cached H4 candles for {cell['market']}")
      frozen_cells.append({**cell, "auditSha256": hashlib.sha256(raw[0].encode("utf-8")).hexdigest(),
        "candleSha256": digest(candles), "candleCount": len(candles), "firstCandle": candles[0][0], "lastCandle": candles[-1][0]})
  finally:
    connection.close()
  core = {
    "schema": "fms-entry-state-campaign-manifest-v1",
    "family": "entry-known H4 state on high-sample unregistered packages",
    "hypothesis": "A predeclared H4 range or directional-trend state can isolate a more stable subset of an unconditional Stage-A package that was not registered.",
    "cells": frozen_cells,
    "variants": VARIANTS,
    "declaredCellCount": len(CELLS),
    "declaredVariantCount": len(CELLS) * len(VARIANTS),
    "contract": "Reuse each Stage-A audit's immutable selected gross execution outcome; filter only, with no execution reselection.",
    "chronology": "First 50% development, next 25% validation, final 25% reused-history audit; one adjacent case embargoed on each side of both boundaries.",
    "minimumEvaluablePerPartition": 5,
    "acceptance": "Exploratory survivor only when kept validation and final each have N>=5, positive gross mean R, and positive mean-R uplift versus their unfiltered parent.",
    "sourceBoundary": "Read-only local MT5 H4 OHLC cache plus immutable broker-calendar-derived Stage-A audit.",
    "costs": "gross only; no new cost model",
    "promotion": "No registration or automatic setup promotion. Any survivor remains reused-history research.",
    "limitations": ["The archive was used by prior FMS research, so no partition is globally fresh.", "The four variants are correlated and the three cells are a deliberately small coverage probe, not an exhaustive search."],
    "stageA": stage_a_fingerprint(),
  }
  save(manifest_path, {**core, "manifestHash": digest(core)})
  print(json.dumps({"manifestHash": digest(core), "cells": len(CELLS), "variants": len(CELLS) * len(VARIANTS)}))


def outcome_metrics(rows: list[dict[str, Any]]) -> dict[str, Any]:
  evaluable = [row for row in rows if row.get("grossResultR") is not None]
  values = [float(row["grossResultR"]) for row in evaluable]
  if not values:
    return {"n": 0, "averageGrossR": None, "totalGrossR": None, "targetHitCount": 0, "stopHitCount": 0, "expiredCount": 0, "ambiguousOrUnevaluableCount": len(rows), "years": []}
  return {"n": len(values), "averageGrossR": statistics.fmean(values), "totalGrossR": sum(values),
    "targetHitCount": sum(row.get("status") == "target_hit" for row in evaluable),
    "stopHitCount": sum(row.get("status") == "stop_hit" for row in evaluable),
    "expiredCount": sum(row.get("status") == "expired" for row in evaluable),
    "ambiguousOrUnevaluableCount": len(rows) - len(evaluable),
    "years": sorted({dt.datetime.fromtimestamp(int(row["eventTime"]), dt.timezone.utc).year for row in evaluable})}


def add_features(cases: list[dict[str, Any]], candles: list[list[float | int]]) -> None:
  candle_times = [int(row[0]) for row in candles]
  import bisect
  for case in cases:
    index = bisect.bisect_right(candle_times, int(case["eventTime"]))
    prior = candles[max(0, index - 12):index]
    atr = float(case.get("atr") or 0)
    features = {"priorRange": "insufficient", "priorTrend": "insufficient"}
    if atr > 0 and len(prior) >= 12:
      range_ratio = statistics.fmean(float(row[2]) - float(row[3]) for row in prior[-6:]) / atr
      features["priorRange"] = "compressed" if range_ratio < .8 else "expanded" if range_ratio > 1.2 else "ordinary"
      direction_sign = 1 if case.get("direction") == "long" else -1
      signed_change = (float(prior[-1][4]) - float(prior[0][4])) / atr * direction_sign
      features["priorTrend"] = "aligned" if signed_change >= .25 else "opposed" if signed_change <= -.25 else "flat"
    case["features"] = features


def run(database: Path, directory: Path) -> None:
  manifest_path = directory / "manifest.json"
  manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
  manifest_hash = manifest.pop("manifestHash")
  if digest(manifest) != manifest_hash:
    raise ValueError("Frozen manifest hash does not match")
  results = []
  connection = read_only(database)
  try:
    for cell in manifest["cells"]:
      raw_text = connection.execute("SELECT value FROM metadata WHERE key=?", (f"fms_raw_audit:{cell['experimentId']}",)).fetchone()[0]
      candles = source_rows(connection, cell["market"])
      if hashlib.sha256(raw_text.encode("utf-8")).hexdigest() != cell["auditSha256"] or digest(candles) != cell["candleSha256"]:
        raise ValueError(f"Frozen source changed for {cell['market']}")
      audit = json.loads(raw_text)
      outcomes = {row["caseId"]: row for row in audit["contractResults"][audit["selectedContractKey"]]}
      cases = [{**outcomes[row["caseId"]], "atr": row.get("atr"), "direction": outcomes[row["caseId"]].get("direction") or row.get("direction")}
        for row in audit["cases"] if row.get("included") and row["caseId"] in outcomes]
      cases.sort(key=lambda row: int(row["eventTime"]))
      add_features(cases, candles)
      first, second = len(cases) // 2, len(cases) * 3 // 4
      partitions = {"development": cases[:max(0, first - 1)],
        "validation": cases[min(len(cases), first + 1):max(first + 1, second - 1)],
        "final": cases[min(len(cases), second + 1):]}
      variants = []
      for definition in manifest["variants"]:
        measured = {}
        for name, parent in partitions.items():
          kept = [row for row in parent if row["features"][definition["feature"]] == definition["value"]]
          parent_metrics, kept_metrics = outcome_metrics(parent), outcome_metrics(kept)
          measured[name] = {"parent": parent_metrics, "kept": kept_metrics,
            "upliftAverageGrossR": None if kept_metrics["n"] == 0 else kept_metrics["averageGrossR"] - parent_metrics["averageGrossR"]}
        minimum = int(manifest["minimumEvaluablePerPartition"])
        later = [measured["validation"], measured["final"]]
        survives = all(row["kept"]["n"] >= minimum and row["kept"]["averageGrossR"] > 0 and row["upliftAverageGrossR"] > 0 for row in later)
        variants.append({**definition, "status": "exploratory_later_survivor" if survives else "later_rejected", "partitions": measured})
      selected_contract = next(row for row in audit["contracts"] if row["key"] == audit["selectedContractKey"])
      results.append({"market": cell["market"], "experimentId": cell["experimentId"], "label": cell["label"], "caseCount": len(cases),
        "frozenExecution": {key: selected_contract[key] for key in ("stopAtr", "targetR", "holdingCandles")}, "variants": variants})
  finally:
    connection.close()
  survivors = [{"market": cell["market"], "label": cell["label"], "variant": row["id"], "partitions": row["partitions"]}
    for cell in results for row in cell["variants"] if row["status"] == "exploratory_later_survivor"]
  core = {"schema": "fms-entry-state-campaign-result-v1", "manifestHash": manifest_hash,
    "declaredVariants": int(manifest["declaredVariantCount"]), "completedVariants": sum(len(row["variants"]) for row in results),
    "status": "exploratory_survivors" if survivors else "no_later_survivor", "survivorCount": len(survivors),
    "registrations": 0, "results": results}
  payload = {**core, "resultHash": digest(core)}
  save(directory / "result.json", payload)
  summary = {"schema": "fms-entry-state-campaign-summary-v1", "manifestHash": manifest_hash, "resultHash": payload["resultHash"],
    "family": manifest["family"], "hypothesis": manifest["hypothesis"], "declaredCellCount": manifest["declaredCellCount"],
    "declaredVariants": payload["declaredVariants"], "completedVariants": payload["completedVariants"], "status": payload["status"],
    "survivorCount": payload["survivorCount"], "registrations": 0, "sourceFingerprints": [{"market": row["market"], "auditSha256": row["auditSha256"], "candleSha256": row["candleSha256"]} for row in manifest["cells"]],
    "survivors": survivors, "disclosure": manifest["promotion"], "limitations": manifest["limitations"]}
  save(CLIENT_SUMMARY, summary)
  print(json.dumps({key: payload[key] for key in ("declaredVariants", "completedVariants", "status", "survivorCount", "registrations", "resultHash")}))


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("action", choices=("prepare", "run"))
  parser.add_argument("--directory", type=Path, required=True)
  parser.add_argument("--database", type=Path, default=DEFAULT_DATABASE)
  args = parser.parse_args()
  prepare(args.database, args.directory) if args.action == "prepare" else run(args.database, args.directory)


if __name__ == "__main__":
  main()
