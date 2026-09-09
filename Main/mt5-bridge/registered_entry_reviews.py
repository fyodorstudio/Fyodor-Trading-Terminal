"""Load and apply explicitly reviewed H1 entry registrations.

The JSON record is the single runtime owner of reviewed metrics and provenance.
This module is pure and safe to import from offline tools.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Mapping, Tuple


REGISTRY_PATH = Path(__file__).with_name("registered_entry_review_evidence.json")
REGISTRY_SCHEMA = "fms-reviewed-h1-entry-registration-v1"


def _digest(value: Any) -> str:
  encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
  return hashlib.sha256(encoded).hexdigest()


def load_registered_entry_reviews(path: Path = REGISTRY_PATH) -> Tuple[Dict[str, Any], Dict[Tuple[str, str], Dict[str, Any]]]:
  payload = json.loads(path.read_text(encoding="utf-8"))
  registry_hash = payload.pop("registryHash", None)
  if payload.get("schema") != REGISTRY_SCHEMA or registry_hash != _digest(payload):
    raise ValueError("Reviewed-H1 registration record failed schema/hash validation")
  profiles = payload.get("profiles")
  if not isinstance(profiles, dict) or not profiles:
    raise ValueError("Reviewed-H1 registration record has no profiles")
  indexed: Dict[Tuple[str, str], Dict[str, Any]] = {}
  for recipe, profile in profiles.items():
    market, separator, pattern_id = str(recipe).partition("|")
    if not separator or profile.get("market") != market or profile.get("patternId") != pattern_id:
      raise ValueError(f"Reviewed-H1 profile identity mismatch: {recipe}")
    later = profile.get("later") or {}
    outcome_total = sum(int(later.get(key) or 0) for key in (
      "targetHitCount", "stopHitCount", "expiredCount", "breakEvenCount",
    ))
    if outcome_total != int(later.get("laterN") or 0):
      raise ValueError(f"Reviewed-H1 evaluable outcome partition mismatch: {recipe}")
    if int(later.get("ambiguousCount") or 0) or int(later.get("unevaluableCount") or 0):
      raise ValueError(f"Reviewed-H1 matched cohort contains a non-evaluable outcome: {recipe}")
    indexed[(market, pattern_id)] = dict(profile)
  metadata = {**payload, "registryHash": registry_hash}
  return metadata, indexed


def apply_reviewed_h1_entry(
  pattern: Dict[str, Any],
  registry: Mapping[Tuple[str, str], Dict[str, Any]],
  metadata: Mapping[str, Any],
) -> Dict[str, Any]:
  """Apply an existing registration only when its frozen contract still matches."""
  key = (str(pattern["market"]), str(pattern["id"]))
  approval = registry.get(key)
  if not approval:
    return pattern
  active_execution = dict(pattern["execution"])
  frozen_contract = dict(approval.get("contract") or {})
  comparable_execution = {field: active_execution.get(field) for field in frozen_contract}
  if comparable_execution != frozen_contract:
    return {
      **pattern,
      "entryReview": {
        "id": approval.get("reviewId"),
        "status": "blocked_artifact_mismatch",
        "activatedAt": metadata.get("activatedAt"),
        "manifestHash": metadata.get("sourceManifestHash"),
        "registryHash": metadata.get("registryHash"),
        "reason": "The reviewed H1 source contract no longer matches the active execution contract; H4 remains active.",
      },
    }
  previous = {**active_execution, "entryTimeframe": "H4", "expiryTimeframe": "H4"}
  current = {**previous, "entryTimeframe": "H1"}
  return {
    **pattern,
    "execution": current,
    "entryReview": {
      "id": approval["reviewId"],
      "status": "reviewed_active",
      "activatedAt": metadata["activatedAt"],
      "manifestHash": metadata["sourceManifestHash"],
      "sourceResultSha256": metadata["sourceResultSha256"],
      "registryHash": metadata["registryHash"],
      "previousExecution": previous,
      "currentExecution": current,
      "entryRule": approval["entryRule"],
      "expiryRule": approval["expiryRule"],
      "developmentSelected": approval["developmentSelected"],
      "later": dict(approval["later"]),
      "limitations": "Gross scheduled-release simulation; prospective signals additionally require the complete package before entry.",
    },
  }
