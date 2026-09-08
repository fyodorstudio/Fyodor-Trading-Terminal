"""Build a compact search-coverage ledger from existing immutable FMS artifacts."""
from __future__ import annotations
import hashlib, json, os, sqlite3, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "docs/Development Logs/artifacts"
sys.path.insert(0, str(ROOT / "Main/mt5-bridge"))
from macro_signal import ALL_SIGNAL_RULES, normalize_title  # noqa: E402
def load(path): return json.loads(path.read_text(encoding="utf-8-sig"))
def digest(value): return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

def main():
  coverage = load(ARTIFACTS / "fms-extended-markets-2026-09-06/coverage.json")
  profiles = load(ROOT / "Main/mt5-bridge/registered_reaction_profiles.json")["profiles"]
  mining_path = ARTIFACTS / "fms-controlled-mining-2026-09-07/result.json"
  mining = load(mining_path) if mining_path.exists() else None
  multiscale_path = ARTIFACTS / "fms-multiscale-structure-2026-09-07/result.json"
  multiscale = load(multiscale_path) if multiscale_path.exists() else None
  corelease_path = ARTIFACTS / "fms-extended-corelease-2026-09-07/result.json"
  corelease = load(corelease_path) if corelease_path.exists() else None
  entry_state_path = ARTIFACTS / "fms-entry-state-2026-09-08/result.json"
  entry_state = load(entry_state_path) if entry_state_path.exists() else None
  manifests = sorted(ARTIFACTS.glob("fms-extended-stage*/**/*.manifest.json"))
  guarded = []
  for path in manifests:
    value = load(path)
    guarded.append({"artifact": str(path.relative_to(ROOT)).replace("\\", "/"), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
      "marketCount": len(value.get("markets") or value.get("sources") or []), "declaredConfigurationCount": value.get("declaredConfigurationCount")})
  profile_markets = sorted({key.split("|", 1)[0] for key in profiles})
  all_markets = [row["market"] for row in coverage["markets"]]
  recipes = []
  identities = {}
  database = Path(os.environ["LOCALAPPDATA"]) / "Fyodor Trading Terminal/fyodor-research.sqlite3"
  connection = sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)
  try:
    for recipe, profile in sorted(profiles.items()):
      stored = connection.execute("SELECT configuration_json,result_json FROM fms_experiments WHERE id=?", (profile["experimentId"],)).fetchone()
      raw = connection.execute("SELECT value FROM metadata WHERE key=?", (f"fms_raw_audit:{profile['experimentId']}",)).fetchone()
      if not stored or not raw: continue
      configuration, result, audit = json.loads(stored[0]), json.loads(stored[1]), json.loads(raw[0])
      contract = next(row for row in audit["contracts"] if row["key"] == audit["selectedContractKey"])
      event_times = sorted({int(row["eventTime"]) for row in audit["cases"] if row.get("included")})
      identity = str(configuration.get("signature", "")).split("|", 1)[-1]
      identities.setdefault(identity, []).append(recipe.split("|", 1)[0])
      recipes.append({"recipe": recipe, "economicIdentity": identity, "directionTreatment": configuration.get("directionSelection"),
        "reaction": configuration.get("reaction"), "scoringPolicy": configuration.get("scoringPolicy"), "entry": configuration.get("entry"),
        "selectedExecution": {key: contract.get(key) for key in ("stopAtr", "targetR", "holdingCandles")},
        "caseCount": len(event_times), "firstRelease": event_times[0] if event_times else None, "lastRelease": event_times[-1] if event_times else None,
        "datasetFingerprint": result.get("datasetFingerprint"), "experimentId": profile["experimentId"]})
    calendar_rows = connection.execute("SELECT currency,title,count(*) FROM calendar_events GROUP BY currency,title").fetchall()
  finally: connection.close()
  registered_groups = {identity.split(":", 1)[-1] for identity in identities}
  calendar_families = []
  for currency in ("USD", "EUR", "GBP", "JPY", "AUD", "CAD", "NZD", "CHF"):
    for rule in {row.id: row for row in ALL_SIGNAL_RULES}.values():
      if rule.currencies and currency not in rule.currencies: continue
      matched = [(title, count) for row_currency, title, count in calendar_rows if row_currency == currency
        and not any(normalize_title(term) in normalize_title(title) for term in rule.exclude_any)
        and any(normalize_title(term) in normalize_title(title) for term in rule.include_any)]
      count = sum(row[1] for row in matched)
      calendar_families.append({"currency": currency, "family": rule.score_group, "brokerRows": count,
        "distinctTitles": len(matched), "sampleTitles": sorted(title for title, _count in matched)[:5],
        "status": "broker_series_absent" if count == 0 else "represented_in_registration" if rule.score_group in registered_groups else "available_not_registered"})
  lanes = [
    {"family": "registered exact recipes and frozen executions", "status": "exhausted exact hypothesis", "attempts": len(profiles), "reason": "Every current recipe has one immutable selected scoring and execution contract."},
    {"family": "H1/H4 and limited M1 entry timing", "status": "partially searched", "reason": "Registered parents were compared; minute coverage remains sparse."},
    {"family": "H4 support/resistance target and sequential-zone exits", "status": "exhausted exact hypothesis", "attempts": 102, "reason": "Two frozen 51-recipe families produced no later-chronology promotion."},
    {"family": "entry-known context and execution management", "status": "review pending", "reason": "Bounded recipe-specific challengers exist; most were rejected or retained unchanged."},
    {"family": "categorical no-trade filters on registered cases", "status": "partially searched" if mining else "unsearched", "attempts": (mining or {}).get("summary", {}).get("attempts", 0), "reason": "Controlled reused-history lane; survivors remain exploratory and unregistered."},
    {"family": "multi-scale D1/weekly price structure", "status": "exhausted exact hypothesis" if multiscale else "unsearched", "attempts": (multiscale or {}).get("summary", {}).get("declaredConfigurations", 0), "reason": "The frozen D1/weekly no-trade challenger produced no promotion; higher-timeframe zones remain descriptive."},
    {"family": "unregistered event packages across all pair mappings", "status": "partially searched", "attempts": 278 + int((corelease or {}).get("configurationsTested", 0)), "reason": "Stage A/B covered declared source packages and direction variants; the exact multi-factor co-release followup also produced no development-qualified contract."},
    {"family": "entry-known H4 state on high-sample unregistered packages", "status": "partially searched" if entry_state else "unsearched", "attempts": int((entry_state or {}).get("completedVariants", 0)), "reason": "One frozen three-cell range/trend campaign produced no later survivor; those 12 exact variants are complete, while orthogonal interactions remain unsearched."},
  ]
  priority = [
    {"rank": 1, "family": "prospective first-seen evidence", "why": "Adds genuinely new chronology for registered and exploratory rules without reusing the selection archive."},
    {"rank": 2, "family": "minute-entry coverage expansion", "why": "Existing M1 comparisons are too sparse; revisit only after materially more broker candle coverage exists."},
    {"rank": 3, "family": "orthogonal entry-known interactions on unregistered packages", "why": "Only after a new protocol: exclude the completed prior-range and prior-trend variants and use different cells or state dimensions."},
  ]
  core = {"schema": "fms-exhaustion-ledger-v1", "universe": all_markets, "coverageHash": coverage["coverageHash"],
    "registeredRecipeCount": len(profiles), "registeredMarkets": profile_markets, "marketsWithoutRegisteredRecipe": sorted(set(all_markets)-set(profile_markets)),
    "registeredRecipeAudit": recipes, "deduplicatedEconomicIdentities": [{"identity": key, "markets": sorted(set(markets))} for key, markets in sorted(identities.items())],
    "calendarFamilyInventory": calendar_families,
    "sourceBaselines": coverage["summary"], "guardedCampaigns": guarded, "hypothesisLanes": lanes, "rankedNextSearch": priority,
    "campaignFacts": {"sourceBaselinesCompleted": 111, "sourceBaselinesRequired": 112, "crossBaselinesCompleted": 278,
      "entryStateVariantsCompleted": int((entry_state or {}).get("completedVariants", 0)), "entryStateSurvivors": int((entry_state or {}).get("survivorCount", 0)),
      "note": "Counts retained from the immutable extended-market campaign handoff; they describe completed bounded baselines, not all possible hypotheses."},
    "statusDefinitions": ["exhausted exact hypothesis", "partially searched", "coverage blocked", "under-sampled", "review pending", "unsearched"],
    "conclusion": "The existing bounded campaigns are complete, but the economic-event/OHLC hypothesis space is not exhausted."}
  payload = {**core, "ledgerHash": digest(core)}
  output = ARTIFACTS / "fms-exhaustion-ledger-2026-09-07.json"; output.write_text(json.dumps(payload, indent=2)+"\n", encoding="utf-8")
  client = ROOT / "Main/src/app/lib/fmsExhaustionSummary.json"; client.write_text(json.dumps(payload, indent=2)+"\n", encoding="utf-8")
  print(json.dumps({"ledgerHash": payload["ledgerHash"], "registered": len(profiles), "marketsWithoutRecipes": len(payload["marketsWithoutRegisteredRecipe"]), "lanes": len(lanes)}))
if __name__ == "__main__": main()
