from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import time

BRIDGE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(BRIDGE_ROOT))

from fms_reaction_campaign import (  # noqa: E402
  build_campaign_manifest,
  build_development_atlas,
  canonical_hash,
  challenge_candidates,
  declare_candidates,
)
from research_store import ResearchStore  # noqa: E402


KEYS = {
  "manifest": "fms_event_respect_campaign:v4:manifest",
  "atlas": "fms_event_respect_campaign:v4:development_atlas",
  "declaration": "fms_event_respect_campaign:v4:declaration",
  "challenge": "fms_event_respect_campaign:v4:challenge",
  "activation": "fms_event_respect_campaign:v4:prospective_activation",
  "latest": "fms_event_respect_campaign:latest",
}


def load_json(store: ResearchStore, key: str) -> dict:
  raw = store.get_metadata(key)
  if not raw:
    raise RuntimeError(f"Required campaign stage is missing: {key}")
  value = json.loads(raw)
  if not isinstance(value, dict):
    raise RuntimeError(f"Campaign stage is invalid: {key}")
  return value


def store_json(store: ResearchStore, key: str, value: dict) -> None:
  store.set_metadata(key, json.dumps(value, sort_keys=True, separators=(",", ":")))


def store_frozen_json(store: ResearchStore, key: str, value: dict) -> None:
  encoded = json.dumps(value, sort_keys=True, separators=(",", ":"))
  stored = store.set_metadata_if_absent(key, encoded)
  if stored != encoded:
    raise RuntimeError(f"Frozen campaign stage already exists with different content: {key}")


def command_freeze(store: ResearchStore) -> dict:
  existing = store.get_metadata(KEYS["manifest"])
  if existing:
    return json.loads(existing)
  raw_snapshot = store.get_metadata("fms_global_chart_response:v1")
  snapshot = json.loads(raw_snapshot) if raw_snapshot else {}
  legacy_model = {
    "modelId": snapshot.get("modelId"),
    "modelHash": snapshot.get("modelHash"),
    "generatedAt": snapshot.get("generatedAt"),
    "registeredMarketCount": len(snapshot.get("markets") or []),
    "displayLineage": "Legacy registered atlas (pre event-respect campaign)",
    "preserved": True,
  }
  ledger = REPO_ROOT / "docs" / "Development Logs" / "artifacts" / "fms-exhaustion-ledger-2026-09-07.json"
  manifest = build_campaign_manifest(store, legacy_model, ledger, int(time.time()))
  prior_raw = store.get_metadata("fms_event_respect_campaign:v3:manifest")
  if prior_raw:
    prior = json.loads(prior_raw)
    manifest["protocolCorrection"] = {
      "supersedesManifestHash": prior.get("manifestHash"),
      "reason": "The v3 reaction path could reuse entry geometry embedded in an older execution result. It was normally equivalent, but this direction-first campaign must derive its own first strictly later H4 open and completed pre-entry ATR independently. Prospective completion also now follows the actual nth H4 candle timestamp across market gaps.",
      "changedField": "reaction entry/ATR derivation and prospective horizon completion timestamp",
    }
    manifest.pop("manifestHash", None)
    manifest["manifestHash"] = canonical_hash(manifest)
  store_frozen_json(store, KEYS["manifest"], manifest)
  return manifest


def command_atlas(store: ResearchStore) -> dict:
  existing = store.get_metadata(KEYS["atlas"])
  if existing:
    return json.loads(existing)
  manifest = load_json(store, KEYS["manifest"])
  atlas = build_development_atlas(manifest, store)
  store_frozen_json(store, KEYS["atlas"], atlas)
  return atlas


def command_declare(store: ResearchStore) -> dict:
  existing = store.get_metadata(KEYS["declaration"])
  if existing:
    return json.loads(existing)
  atlas = load_json(store, KEYS["atlas"])
  declaration = declare_candidates(atlas)
  store_frozen_json(store, KEYS["declaration"], declaration)
  return declaration


def command_challenge(store: ResearchStore) -> dict:
  existing = store.get_metadata(KEYS["challenge"])
  if existing:
    return json.loads(existing)
  manifest = load_json(store, KEYS["manifest"])
  declaration = load_json(store, KEYS["declaration"])
  challenge = challenge_candidates(manifest, declaration, store)
  store_frozen_json(store, KEYS["challenge"], challenge)
  store_json(store, KEYS["latest"], {
    "schema": "fms-event-respect-campaign-index-v1",
    "manifestHash": manifest["manifestHash"],
    "developmentAtlasHash": load_json(store, KEYS["atlas"])["artifactHash"],
    "declarationHash": declaration["declarationHash"],
    "challengeHash": challenge["challengeHash"],
    "state": "chronological_challenge_complete",
    "legacyPreserved": True,
    "automaticPromotion": False,
  })
  return challenge


def command_activate(store: ResearchStore) -> dict:
  challenge = load_json(store, KEYS["challenge"])
  existing = store.get_metadata(KEYS["activation"])
  if existing:
    activation = json.loads(existing)
    if activation.get("challengeHash") != challenge.get("challengeHash"):
      raise RuntimeError("Existing prospective activation belongs to a different challenge")
    return activation
  activation = {
    "schema": "fms-event-respect-prospective-activation-v1",
    "campaignVersion": "FMS-EVENT-RESPECT-CAMPAIGN-v4",
    "challengeHash": challenge["challengeHash"],
    "activatedAt": int(time.time()),
    "candidateCount": sum(
      row.get("classification") in {"challenge_supported", "prospective_only"}
      for row in challenge.get("rows", [])
    ),
    "firstSeenOnly": True,
    "executionAttached": False,
  }
  store_frozen_json(store, KEYS["activation"], activation)
  latest = load_json(store, KEYS["latest"])
  store_json(store, KEYS["latest"], {
    **latest,
    "state": "prospective_observation_active",
    "prospectiveActivatedAt": activation["activatedAt"],
  })
  return activation


def summary(stage: str, artifact: dict) -> dict:
  if stage == "freeze":
    coverage = artifact["coverage"]
    return {
      "stage": stage,
      "manifestHash": artifact["manifestHash"],
      "eligibleMarkets": sum(row["eligible"] for row in coverage),
      "blockedMarkets": [row["market"] for row in coverage if not row["eligible"]],
    }
  if stage == "atlas":
    return {
      "stage": stage,
      "artifactHash": artifact["artifactHash"],
      "rows": len(artifact["rows"]),
      "coverageBlocked": len(artifact["coverageBlocked"]),
      "holdoutRead": artifact["holdoutRead"],
    }
  if stage == "declare":
    return {
      "stage": stage,
      "declarationHash": artifact["declarationHash"],
      "literalGate": artifact["familyRowsPassingLiteralGates"],
      "multiplicityGate": artifact["familyRowsPassingMultiplicity"],
      "declared": artifact["declaredCandidateCount"],
      "holdoutRead": artifact["holdoutRead"],
    }
  if stage == "activate":
    return {
      "stage": stage,
      "challengeHash": artifact["challengeHash"],
      "activatedAt": artifact["activatedAt"],
      "candidateCount": artifact["candidateCount"],
      "firstSeenOnly": artifact["firstSeenOnly"],
    }
  return {
    "stage": stage,
    "challengeHash": artifact["challengeHash"],
    "candidates": artifact["candidateCount"],
    "supported": artifact["supportedCount"],
    "prospectiveOnly": artifact["prospectiveOnlyCount"],
    "rejected": artifact["rejectedCount"],
  }


def main() -> None:
  parser = argparse.ArgumentParser(
    description="Run the immutable event-respect campaign one stage at a time."
  )
  parser.add_argument("stage", choices=("freeze", "atlas", "declare", "challenge", "activate"))
  args = parser.parse_args()
  store = ResearchStore()
  action = {
    "freeze": command_freeze,
    "atlas": command_atlas,
    "declare": command_declare,
    "challenge": command_challenge,
    "activate": command_activate,
  }[args.stage]
  artifact = action(store)
  print(json.dumps(summary(args.stage, artifact), indent=2))


if __name__ == "__main__":
  main()
