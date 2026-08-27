"""Run the frozen FMS Qualification-v2 major-pair sweep through the local bridge.

This is deliberately an offline research runner, not an app orchestration API.
It freezes the complete rule universe before submitting work, checkpoints after
every transition, and can resume safely after interruption.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


MANIFEST_VERSION = "FMS-GUARDED-SWEEP-v1"
QUALIFICATION_VERSION = "FMS-QUALIFICATION-v2"
DEFAULT_MARKETS = ("EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "NZDUSD", "USDCHF")
TERMINAL_STATES = {"completed", "rejected", "insufficient", "unsupported", "cancelled"}
EXECUTION = {
  "mode": "matrix",
  "stopAtrValues": [0.5, 0.75, 1.0, 1.25, 1.5, 2.0],
  "targetRValues": [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0],
  "holdingCandles": [6, 12, 18, 30, 42, 60],
}


def canonical_json(value: Any) -> str:
  return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def digest(value: Any) -> str:
  return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def atomic_write(path: Path, value: Any) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  temporary = path.with_suffix(path.suffix + ".tmp")
  temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
  for attempt in range(8):
    try:
      os.replace(temporary, path)
      return
    except PermissionError:
      if attempt == 7:
        raise
      time.sleep(.05 * (attempt + 1))


class BridgeClient:
  def __init__(self, base_url: str) -> None:
    self.base_url = base_url.rstrip("/")

  def request(self, method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Any:
    payload = canonical_json(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(
      f"{self.base_url}{path}", data=payload, method=method,
      headers={"Content-Type": "application/json; charset=utf-8"} if payload else {},
    )
    last_error: Optional[Exception] = None
    for attempt in range(4):
      try:
        with urllib.request.urlopen(request, timeout=120) as response:
          return json.loads(response.read().decode("utf-8"))
      except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Bridge {method} {path} returned {exc.code}: {detail}") from exc
      except (urllib.error.URLError, TimeoutError) as exc:
        last_error = exc
        if attempt < 3:
          time.sleep(2 ** attempt)
    raise RuntimeError(f"Bridge {method} {path} failed: {last_error}")

  def get(self, path: str) -> Any:
    return self.request("GET", path)

  def post(self, path: str, body: Dict[str, Any]) -> Any:
    return self.request("POST", path, body)


def treatment(item: Dict[str, Any], dimension: str, value: str, reaction: str = "continuation") -> Optional[Dict[str, Any]]:
  return next((
    row for row in item.get("treatments", [])
    if row.get("dimension") == dimension and row.get("value") == value and row.get("reaction") == reaction
  ), None)


def direction_variant(item: Dict[str, Any], direction: str) -> Optional[Dict[str, Any]]:
  return next((row for row in item.get("directionVariants", []) if row.get("direction") == direction), None)


def manifest_entry(
  market: str,
  item: Dict[str, Any],
  stage: str,
  variant: str,
  direction: str,
  scoring: str,
  cohort_dimension: str,
  cohort_value: str,
  reaction: str,
  expected_n: int,
  supported: bool,
  reason: Optional[str] = None,
) -> Dict[str, Any]:
  rule = {
    "market": market,
    "catalogId": item["id"],
    "sourceVersionId": item["sourceVersionId"],
    "catalogLabel": item["label"],
    "stage": stage,
    "variant": variant,
    "directionSelection": direction,
    "scoringPolicy": scoring,
    "cohort": {"dimension": cohort_dimension, "value": cohort_value},
    "reaction": reaction,
    "execution": EXECUTION,
    "expectedN": int(expected_n),
    "supported": bool(supported),
    "preflightReason": reason,
  }
  return {"id": digest(rule)[:20], **rule}


def build_entries(market: str, catalog_items: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
  entries: List[Dict[str, Any]] = []
  for item in sorted(catalog_items, key=lambda row: (str(row.get("sourceVersionId")), str(row.get("id")))):
    historical_n = int(item.get("historicalN") or 0)
    if historical_n < 80:
      continue
    directions = {str(row.get("direction")) for row in item.get("directionVariants", [])}
    both_supported = {"long", "short"}.issubset(directions)
    entries.append(manifest_entry(
      market, item, "A", "baseline", "both", "forecast_quality", "none", "all", "continuation",
      historical_n, both_supported, None if both_supported else "Both directional variants are unavailable.",
    ))
    for selected_direction in ("long", "short"):
      selected = direction_variant(item, selected_direction)
      selected_n = int((selected or {}).get("historicalN") or 0)
      entries.append(manifest_entry(
        market, item, "B", selected_direction, selected_direction, "forecast_quality", "none", "all", "continuation",
        selected_n, selected is not None and selected_n >= 80,
        None if selected is not None and selected_n >= 80 else f"{selected_direction.title()} variant has fewer than 80 cases or is unavailable.",
      ))
    entries.append(manifest_entry(
      market, item, "B", "momentum_only", "both", "momentum_only", "none", "all", "continuation",
      historical_n, both_supported, None if both_supported else "Both directional variants are unavailable.",
    ))
    declared_treatments = (
      ("agreement", "evidenceMode", "agreement", "continuation"),
      ("before_aligned", "backgroundAlignment", "aligned", "continuation"),
      ("complete_package", "packageCompleteness", "full", "continuation"),
      ("rejection", "reaction", "contrarian", "contrarian"),
    )
    for variant, dimension, value, reaction in declared_treatments:
      selected = treatment(item, dimension, value, reaction)
      selected_n = int((selected or {}).get("historicalN") or 0)
      entries.append(manifest_entry(
        market, item, "B", variant, "both", "forecast_quality", dimension, value, reaction,
        selected_n, both_supported and selected is not None and selected_n >= 80,
        None if both_supported and selected is not None and selected_n >= 80 else f"{variant} has fewer than 80 cases or is unavailable.",
      ))
  unique = {row["id"]: row for row in entries}
  return [unique[key] for key in sorted(unique)]


def build_manifest(client: BridgeClient, markets: Iterable[str]) -> Dict[str, Any]:
  market_snapshots = []
  entries = []
  for market in markets:
    workbench = client.get(f"/research/workbench?market={urllib.parse.quote(market)}")
    availability = workbench.get("availability") or {"ready": True}
    if not availability.get("ready", True):
      raise RuntimeError(f"{market} Workbench is unavailable: {availability.get('message')}")
    market_snapshots.append({
      "market": market,
      "datasetFingerprint": workbench["datasetFingerprint"],
      "sourceRunIds": sorted(workbench.get("sourceRunIds") or []),
      "candleRevision": workbench.get("candleRevision"),
      "catalogGeneratedAt": (workbench.get("catalog") or {}).get("generatedAt"),
    })
    entries.extend(build_entries(market, (workbench.get("catalog") or {}).get("items") or []))
  core = {
    "version": MANIFEST_VERSION,
    "qualificationVersion": QUALIFICATION_VERSION,
    "minimumCases": 80,
    "markets": market_snapshots,
    "execution": EXECUTION,
    "entries": sorted(entries, key=lambda row: row["id"]),
  }
  return {**core, "manifestHash": digest(core), "createdAt": int(time.time())}


def experiment_match_key(entry: Dict[str, Any], dataset_fingerprint: str) -> str:
  return digest({
    "market": entry["market"], "catalogId": entry["catalogId"],
    "directionSelection": entry["directionSelection"], "scoringPolicy": entry["scoringPolicy"],
    "cohort": entry["cohort"], "reaction": entry["reaction"], "execution": entry["execution"],
    "datasetFingerprint": dataset_fingerprint,
  })


def existing_experiment_index(client: BridgeClient) -> Dict[str, Dict[str, Any]]:
  result: Dict[str, Dict[str, Any]] = {}
  for experiment in client.get("/research/experiments"):
    configuration = experiment.get("configuration") or {}
    snapshot = experiment.get("catalogSnapshot") or {}
    entry_shape = {
      "market": configuration.get("market", "EURUSD"),
      "catalogId": snapshot.get("id"),
      "directionSelection": configuration.get("directionSelection"),
      "scoringPolicy": configuration.get("scoringPolicy"),
      "cohort": configuration.get("cohort"),
      "reaction": configuration.get("reaction"),
      "execution": configuration.get("execution"),
      "datasetFingerprint": experiment.get("datasetFingerprint"),
    }
    key = digest(entry_shape)
    current = result.get(key)
    if current is None or int(experiment.get("createdAt") or 0) > int(current.get("createdAt") or 0):
      result[key] = experiment
  return result


def post_experiment(client: BridgeClient, entry: Dict[str, Any]) -> Dict[str, Any]:
  name = f"{entry['market']} sweep {entry['stage']} {entry['variant']} {entry['catalogLabel']}"[:80]
  return client.post("/research/experiments", {
    "market": entry["market"], "friendlyName": name,
    "catalogId": entry["catalogId"], "directionSelection": entry["directionSelection"],
    "scoringPolicy": entry["scoringPolicy"], "cohort": entry["cohort"],
    "reaction": entry["reaction"], "execution": entry["execution"],
  })


def poll_experiment(client: BridgeClient, experiment_id: str, poll_seconds: float) -> Dict[str, Any]:
  while True:
    experiment = client.get(f"/research/experiments/{urllib.parse.quote(experiment_id)}")
    if experiment.get("status") in {"completed", "failed"}:
      return experiment
    time.sleep(poll_seconds)


def holm_adjust(raw_rows: List[Tuple[str, float]]) -> Dict[str, Dict[str, Any]]:
  ordered = sorted(raw_rows, key=lambda row: (row[1], row[0]))
  family_size = len(ordered)
  adjusted: Dict[str, Dict[str, Any]] = {}
  running = 0.0
  for index, (entry_id, raw_p) in enumerate(ordered):
    value = min(1.0, float(raw_p) * (family_size - index))
    running = max(running, value)
    adjusted[entry_id] = {
      "rawPValue": float(raw_p), "holmAdjustedPValue": running,
      "rank": index + 1, "familySize": family_size, "passes": running <= .05,
    }
  return adjusted


def summary_markdown(result: Dict[str, Any]) -> str:
  rows = list(result["entries"])
  counts: Dict[str, int] = {}
  for row in rows:
    state = str(row.get("finalState") or row.get("state"))
    counts[state] = counts.get(state, 0) + 1
  candidates = [row for row in rows if row.get("finalTier") in {"Research candidate", "Statistically confirmed"}]
  strongest = sorted(
    [row for row in rows if row.get("audit") and row.get("finalTier") == "Rejected"],
    key=lambda row: float((((row.get("audit") or {}).get("walkForward") or {}).get("pooled") or {}).get("averageR") or -999),
    reverse=True,
  )[:10]
  lines = [
    f"# FMS guarded sweep `{result['manifestHash'][:12]}`", "",
    f"- Started: {result['startedAt']}", f"- Completed: {result['completedAt']}",
    f"- Entries: {len(rows)}", f"- States: `{canonical_json(counts)}`", "",
    "## Candidates", "",
  ]
  if not candidates:
    lines.append("No Research candidate or Statistically confirmed setup was found.")
  for row in candidates:
    pooled = row["audit"]["walkForward"]["pooled"]
    lines.append(f"- **{row['finalTier']}** — {row['market']} · {row['catalogLabel']} · {row['variant']} · N {pooled.get('n')} · {float(pooled.get('averageR') or 0):+.3f}R · Holm p {row['multipleTesting']['holmAdjustedPValue']:.4f}")
  lines.extend(["", "## Strongest rejected", ""])
  for row in strongest:
    pooled = row["audit"]["walkForward"]["pooled"]
    lines.append(f"- {row['market']} · {row['catalogLabel']} · {row['variant']} · N {pooled.get('n')} · {float(pooled.get('averageR') or 0):+.3f}R · {row['audit']['walkForward'].get('positiveFoldCount')}/5 positive folds")
  return "\n".join(lines) + "\n"


def run(args: argparse.Namespace) -> int:
  client = BridgeClient(args.bridge_url)
  markets = tuple(value.strip().upper() for value in args.markets.split(",") if value.strip())
  artifacts = Path(args.artifacts_dir).resolve()
  artifacts.mkdir(parents=True, exist_ok=True)
  manifest = build_manifest(client, markets)
  manifest_path = artifacts / f"guarded-sweep-{manifest['manifestHash']}.manifest.json"
  checkpoint_path = artifacts / f"guarded-sweep-{manifest['manifestHash']}.checkpoint.json"
  result_path = artifacts / f"guarded-sweep-{manifest['manifestHash']}.result.json"
  summary_path = artifacts / f"guarded-sweep-{manifest['manifestHash']}.md"
  if manifest_path.exists():
    stored_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if stored_manifest.get("manifestHash") != manifest["manifestHash"]:
      raise RuntimeError("Stored manifest hash does not match the current frozen universe")
  else:
    atomic_write(manifest_path, manifest)
  if args.manifest_only:
    print(canonical_json({"manifestHash": manifest["manifestHash"], "entries": len(manifest["entries"]), "path": str(manifest_path)}))
    return 0
  market_fingerprints = {row["market"]: row["datasetFingerprint"] for row in manifest["markets"]}
  if checkpoint_path.exists():
    checkpoint = json.loads(checkpoint_path.read_text(encoding="utf-8"))
    if checkpoint.get("manifestHash") != manifest["manifestHash"]:
      raise RuntimeError("Checkpoint belongs to a different manifest")
  else:
    checkpoint = {
      "manifestHash": manifest["manifestHash"], "startedAt": int(time.time()),
      "updatedAt": int(time.time()), "entries": {},
    }
  existing = existing_experiment_index(client)
  entries_by_id = {row["id"]: row for row in manifest["entries"]}
  try:
    for position, entry in enumerate(manifest["entries"], 1):
      runtime = checkpoint["entries"].setdefault(entry["id"], {"state": "pending", "attempts": 0})
      if runtime.get("state") in TERMINAL_STATES:
        continue
      if not entry["supported"]:
        runtime.update({"state": "insufficient", "error": entry.get("preflightReason")})
        checkpoint["updatedAt"] = int(time.time())
        atomic_write(checkpoint_path, checkpoint)
        continue
      print(f"[{position}/{len(manifest['entries'])}] {entry['market']} {entry['catalogLabel']} {entry['variant']}", flush=True)
      key = experiment_match_key(entry, market_fingerprints[entry["market"]])
      experiment = existing.get(key)
      if experiment is None or experiment.get("status") == "failed":
        runtime["state"] = "submitting"
        runtime["attempts"] = int(runtime.get("attempts") or 0) + 1
        atomic_write(checkpoint_path, checkpoint)
        experiment = post_experiment(client, entry)
      runtime.update({"state": experiment.get("status", "queued"), "experimentId": experiment["id"]})
      atomic_write(checkpoint_path, checkpoint)
      experiment = poll_experiment(client, experiment["id"], args.poll_seconds)
      if experiment.get("status") != "completed":
        error = experiment.get("error") or "Experiment failed"
        state = "insufficient" if "No evaluable historical cases" in str(error) else "failed"
        runtime.update({"state": state, "error": error})
        atomic_write(checkpoint_path, checkpoint)
        continue
      try:
        audit = client.get(f"/research/experiments/{urllib.parse.quote(experiment['id'])}/qualification-v2")
        runtime.update({
          "state": "completed", "auditId": audit.get("auditId"), "audit": audit,
          "experimentId": experiment["id"], "error": None,
        })
      except Exception as exc:  # retain the experiment and continue the declared family
        runtime.update({"state": "failed", "error": f"Qualification audit failed: {exc}"})
      checkpoint["updatedAt"] = int(time.time())
      atomic_write(checkpoint_path, checkpoint)
  except KeyboardInterrupt:
    checkpoint["updatedAt"] = int(time.time())
    checkpoint["interrupted"] = True
    atomic_write(checkpoint_path, checkpoint)
    print(f"Interrupted safely. Resume with the same command. Checkpoint: {checkpoint_path}", file=sys.stderr)
    return 130

  raw_rows = []
  for entry in manifest["entries"]:
    runtime = checkpoint["entries"].get(entry["id"], {})
    raw_p = (((runtime.get("audit") or {}).get("multipleTesting") or {}).get("rawPValue"))
    raw_rows.append((entry["id"], float(raw_p) if raw_p is not None else 1.0))
  holm = holm_adjust(raw_rows)
  final_entries = []
  for entry in manifest["entries"]:
    runtime = checkpoint["entries"].get(entry["id"], {"state": "failed", "error": "Missing checkpoint state"})
    adjustment = holm[entry["id"]]
    audit = runtime.get("audit")
    standalone_tier = str((audit or {}).get("tier") or "Rejected")
    final_tier = (
      "Statistically confirmed"
      if standalone_tier == "Statistically confirmed" and adjustment["passes"]
      else "Research candidate" if standalone_tier in {"Research candidate", "Statistically confirmed"}
      else "Rejected"
    )
    final_state = runtime.get("state") if runtime.get("state") != "completed" else final_tier.lower().replace(" ", "_")
    final_entries.append({
      **entry, **{key: value for key, value in runtime.items() if key != "audit"},
      "finalState": final_state, "finalTier": final_tier,
      "multipleTesting": adjustment, "audit": audit,
    })
  completed_at = int(time.time())
  result = {
    "version": MANIFEST_VERSION, "qualificationVersion": QUALIFICATION_VERSION,
    "manifestHash": manifest["manifestHash"], "startedAt": checkpoint["startedAt"],
    "completedAt": completed_at, "entries": final_entries,
    "holm": {
      "method": "Holm-Bonferroni across every frozen manifest entry; missing/insufficient/failed p-values are 1",
      "familySize": len(final_entries), "alpha": .05,
    },
  }
  atomic_write(result_path, result)
  summary_path.write_text(summary_markdown(result), encoding="utf-8")
  checkpoint["completedAt"] = completed_at
  checkpoint["updatedAt"] = completed_at
  checkpoint["state"] = "completed"
  atomic_write(checkpoint_path, checkpoint)
  print(canonical_json({
    "manifestHash": manifest["manifestHash"], "entries": len(final_entries),
    "result": str(result_path), "summary": str(summary_path),
  }))
  return 0


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--bridge-url", default=os.environ.get("FMS_BRIDGE_URL", "http://127.0.0.1:8001"))
  parser.add_argument("--markets", default=",".join(DEFAULT_MARKETS))
  parser.add_argument("--artifacts-dir", default=str(Path(__file__).resolve().parents[1] / "research-artifacts"))
  parser.add_argument("--poll-seconds", type=float, default=1.0)
  parser.add_argument("--manifest-only", action="store_true")
  return parser.parse_args()


if __name__ == "__main__":
  raise SystemExit(run(parse_args()))
