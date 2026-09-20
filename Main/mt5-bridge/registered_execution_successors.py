"""Load and apply explicitly reviewed event-specific execution successors."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Mapping, Tuple


REGISTRY_PATH = Path(__file__).with_name("registered_execution_successors.json")
REGISTRY_SCHEMA = "fms-registered-execution-successors-v1"


def _digest(value: Any) -> str:
  encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
  return hashlib.sha256(encoded).hexdigest()


def _normalized_execution(source: Mapping[str, Any]) -> Dict[str, Any]:
  return {
    "stopAtr": float(source.get("stopAtr") or 0),
    "targetR": float(source.get("targetR") or 0),
    "expiryCandles": int(source.get("expiryCandles") or 0),
    "managementFamily": str(source.get("managementFamily") or "fixed"),
    "managementTriggerR": source.get("managementTriggerR"),
    "entryTimeframe": str(source.get("entryTimeframe") or "H4"),
    "expiryTimeframe": str(source.get("expiryTimeframe") or "H4"),
  }


def load_registered_execution_successors(
  path: Path = REGISTRY_PATH,
) -> Tuple[Dict[str, Any], Dict[Tuple[str, str], Dict[str, Any]]]:
  payload = json.loads(path.read_text(encoding="utf-8"))
  registry_hash = payload.pop("registryHash", None)
  if payload.get("schema") != REGISTRY_SCHEMA or registry_hash != _digest(payload):
    raise ValueError("FMS v2 execution successor registry failed schema/hash validation")
  profiles = payload.get("profiles")
  if not isinstance(profiles, dict) or len(profiles) != int(payload.get("profileCount") or 0):
    raise ValueError("FMS v2 execution successor registry profile count is invalid")
  exclusions = payload.get("reviewedExclusions") or {}
  if not isinstance(exclusions, dict) or any(key in profiles or not isinstance(reason, str) or not reason.strip()
                                              for key, reason in exclusions.items()):
    raise ValueError("FMS v2 reviewed exclusions are invalid")
  indexed: Dict[Tuple[str, str], Dict[str, Any]] = {}
  registration_ids = set()
  for recipe, profile in profiles.items():
    market, separator, pattern_id = str(recipe).partition("|")
    if not separator or profile.get("market") != market or profile.get("patternId") != pattern_id:
      raise ValueError(f"FMS v2 successor profile identity mismatch: {recipe}")
    registration_id = str(profile.get("registrationId") or "")
    if not registration_id or registration_id in registration_ids:
      raise ValueError(f"FMS v2 successor registration identity is invalid: {recipe}")
    registration_ids.add(registration_id)
    for scope in ("development", "holdout", "overall"):
      evidence = profile.get(scope) or {}
      attempted = int(evidence.get("attemptedCount") or 0)
      evaluable = int(evidence.get("evaluableCount") or 0)
      ambiguous = int(evidence.get("ambiguousCount") or 0)
      unavailable = int(evidence.get("unevaluableCount") or 0)
      resolved = sum(int(evidence.get(key) or 0) for key in ("targetHitCount", "stopHitCount", "expiredCount"))
      if attempted != evaluable + ambiguous + unavailable or evaluable != resolved:
        raise ValueError(f"FMS v2 successor evidence does not partition: {recipe} {scope}")
    comparison = profile.get("matchedV1Comparison") or {}
    if not comparison.get("matchedCohort") or not comparison.get("improvesDevelopmentAndReusedHoldout"):
      raise ValueError(f"FMS v2 successor lacks matched improvement evidence: {recipe}")
    indexed[(market, pattern_id)] = dict(profile)
  metadata = {**payload, "registryHash": registry_hash}
  return metadata, indexed


def apply_registered_execution_successor(
  pattern: Dict[str, Any],
  registry: Mapping[Tuple[str, str], Dict[str, Any]],
  metadata: Mapping[str, Any],
) -> Dict[str, Any]:
  """Attach a successor only when the immediately preceding contract matches."""
  key = (str(pattern["market"]), str(pattern["id"]))
  approval = registry.get(key)
  if not approval:
    return pattern
  previous = _normalized_execution(pattern.get("execution") or {})
  expected = _normalized_execution(approval.get("previousExecution") or {})
  if previous != expected:
    return {
      **pattern,
      "successorReview": {
        "id": approval.get("registrationId"),
        "status": "blocked_artifact_mismatch",
        "displayVersion": metadata.get("displayVersion"),
        "activatedAt": metadata.get("activatedAt"),
        "registryHash": metadata.get("registryHash"),
        "reason": "The reviewed v1 source contract no longer matches; the preceding registered contract remains active.",
      },
    }
  current = _normalized_execution(approval["currentExecution"])
  return {
    **pattern,
    "successorReview": {
      "id": approval["registrationId"],
      "status": "reviewed_active",
      "displayVersion": metadata["displayVersion"],
      "activatedAt": metadata["activatedAt"],
      "registryHash": metadata["registryHash"],
      "sourceResearchHash": metadata["sourceResearchHash"],
      "sourceManifestHash": metadata["sourceManifestHash"],
      "previousExecution": previous,
      "currentExecution": current,
      "development": dict(approval["development"]),
      "holdout": dict(approval["holdout"]),
      "overall": dict(approval["overall"]),
      "matchedV1Comparison": dict(approval["matchedV1Comparison"]),
      "approvalPolicy": dict(metadata["approvalPolicy"]),
      "limitations": approval["limitations"],
      "preservesV1History": bool(metadata.get("preservesV1History")),
    },
  }
