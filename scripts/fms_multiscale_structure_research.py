"""Audit registered targets against entry-known D1 and weekly swing barriers.

The challenger is a no-trade filter only. It never moves a frozen TP/SL and
cannot register itself. Daily/weekly bars are considered only after their whole
UTC bucket and the two following pivot-confirmation bars have closed.
"""
from __future__ import annotations
import argparse, hashlib, json, os, sqlite3, statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def digest(value): return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

def aggregate(candles, seconds, offset=0):
  groups = {}
  for row in candles:
    key = ((int(row["time"]) - offset) // seconds) * seconds + offset
    groups.setdefault(key, []).append(row)
  return [{"time": key, "end": key + seconds, "open": rows[0]["open"], "high": max(r["high"] for r in rows),
    "low": min(r["low"] for r in rows), "close": rows[-1]["close"]} for key, rows in sorted(groups.items())]

def barrier(entry, target, direction, atr, bars, entry_time, lookback):
  known = [row for row in bars if row["end"] <= entry_time][-lookback:]
  pivots = []
  for index in range(2, len(known) - 2):
    row, neighbours = known[index], known[index-2:index] + known[index+1:index+3]
    if row["high"] >= max(x["high"] for x in neighbours): pivots.append(("resistance", row["high"], row["time"]))
    if row["low"] <= min(x["low"] for x in neighbours): pivots.append(("support", row["low"], row["time"]))
  zones = []
  tolerance = max(float(atr) * .75, 1e-12)
  for kind, level, time in pivots:
    match = next((zone for zone in zones if zone["kind"] == kind and abs(zone["level"] - level) <= tolerance), None)
    if match: match["levels"].append(level); match["times"].append(time); match["level"] = statistics.median(match["levels"])
    else: zones.append({"kind": kind, "level": level, "levels": [level], "times": [time]})
  zones = [zone for zone in zones if len(zone["times"]) >= 2]
  opposing = [zone for zone in zones if (direction == "long" and zone["kind"] == "resistance" and entry < zone["level"] <= target)
    or (direction == "short" and zone["kind"] == "support" and target <= zone["level"] < entry)]
  if not opposing: return None
  selected = min(opposing, key=lambda zone: abs(zone["level"] - entry))
  return {"level": selected["level"], "touches": len(selected["times"]), "distanceAtr": abs(selected["level"] - entry) / atr}

def metrics(rows):
  values = [float(row["grossResultR"]) for row in rows if row.get("grossResultR") is not None]
  return {"n": len(values), "averageR": statistics.fmean(values) if values else None,
    "medianR": statistics.median(values) if values else None,
    "tpBeforeSl": sum(row.get("status") == "target_hit" for row in rows) / len(values) if values else None}

def main():
  parser=argparse.ArgumentParser(description=__doc__); parser.add_argument("--output",type=Path,required=True)
  parser.add_argument("--database",type=Path,default=Path(os.environ["LOCALAPPDATA"])/"Fyodor Trading Terminal/fyodor-research.sqlite3"); args=parser.parse_args()
  profile_path=ROOT/"Main/mt5-bridge/registered_reaction_profiles.json"; profiles=json.loads(profile_path.read_text(encoding="utf-8-sig"))["profiles"]
  manifest={"schema":"fms-multiscale-structure-manifest-v1","profileSha256":hashlib.sha256(profile_path.read_bytes()).hexdigest(),
    "timeframes":{"D1":{"bucketSeconds":86400,"lookbackBars":260},"W1":{"bucketSeconds":604800,"lookbackBars":156}},
    "pivot":"two bars on each side; pivot and both confirmation bars fully closed before entry","clusterTolerance":"0.75 entry H4 ATR; minimum two pivots",
    "challengers":["avoid when D1 barrier lies before frozen target","avoid when W1 barrier lies before frozen target","avoid when either barrier lies before frozen target"],
    "selection":"older development only: parent N >=20, kept N >=10, kept average >0 and uplift >=0.05R; later review N >=8, average >0 and uplift >=0.05R",
    "costs":"gross only","activeRegistryMutable":False}
  connection=sqlite3.connect(args.database.resolve().as_uri()+"?mode=ro",uri=True); results=[]; cache={}
  try:
    for recipe,profile in sorted(profiles.items()):
      market=recipe.split("|",1)[0]
      if market not in cache:
        h4=[{"time":r[0],"open":r[1],"high":r[2],"low":r[3],"close":r[4]} for r in connection.execute("SELECT time,open,high,low,close FROM candle_cache WHERE symbol=? AND timeframe='H4' ORDER BY time",(market,))]
        cache[market]={"D1":aggregate(h4,86400),"W1":aggregate(h4,604800,4*86400)}
      stored=connection.execute("SELECT result_json FROM fms_experiments WHERE id=?",(profile["experimentId"],)).fetchone(); raw=connection.execute("SELECT value FROM metadata WHERE key=?",(f"fms_raw_audit:{profile['experimentId']}",)).fetchone()
      if not stored or not raw: continue
      experiment=json.loads(stored[0]); audit=json.loads(raw[0]); outcomes=audit["contractResults"][audit["selectedContractKey"]]; split=int(experiment["splitTime"])
      annotated=[]
      for row in outcomes:
        if row.get("entry") is None or row.get("target") is None or row.get("atr") in (None,0) or row.get("entryTime") is None: continue
        barriers={tf:barrier(float(row["entry"]),float(row["target"]),row["direction"],float(row["atr"]),cache[market][tf],int(row["entryTime"]),spec["lookbackBars"]) for tf,spec in manifest["timeframes"].items()}
        annotated.append({**row,"barriers":barriers})
      development=[row for row in annotated if int(row["eventTime"])<split]; later=[row for row in annotated if int(row["eventTime"])>=split]
      variants=[]
      for name,predicate in (("avoid_D1",lambda r:r["barriers"]["D1"] is None),("avoid_W1",lambda r:r["barriers"]["W1"] is None),("avoid_either",lambda r:not any(r["barriers"].values()))):
        dev_kept=[row for row in development if predicate(row)]; later_kept=[row for row in later if predicate(row)]
        parent_dev,kept_dev,parent_later,kept_later=metrics(development),metrics(dev_kept),metrics(later),metrics(later_kept)
        dev_uplift=None if kept_dev["averageR"] is None or parent_dev["averageR"] is None else kept_dev["averageR"]-parent_dev["averageR"]
        later_uplift=None if kept_later["averageR"] is None or parent_later["averageR"] is None else kept_later["averageR"]-parent_later["averageR"]
        selected=parent_dev["n"]>=20 and kept_dev["n"]>=10 and kept_dev["averageR"]>0 and dev_uplift>=.05
        supported=selected and kept_later["n"]>=8 and kept_later["averageR"]>0 and later_uplift>=.05
        variants.append({"id":name,"development":{"parent":parent_dev,"kept":kept_dev,"upliftR":dev_uplift},"later":{"parent":parent_later,"kept":kept_later,"upliftR":later_uplift},"selectedOnDevelopment":selected,"laterSupported":supported})
      results.append({"recipe":recipe,"cases":len(annotated),"barrierCounts":{tf:sum(row["barriers"][tf] is not None for row in annotated) for tf in ("D1","W1")},"variants":variants})
  finally: connection.close()
  manifest["manifestHash"]=digest(manifest); supported=[{"recipe":row["recipe"],"variant":variant} for row in results for variant in row["variants"] if variant["laterSupported"]]
  payload={"schema":"fms-multiscale-structure-result-v1","manifest":manifest,"results":results,"summary":{"recipes":len(results),"declaredConfigurations":len(results)*3,"developmentSelected":sum(v["selectedOnDevelopment"] for r in results for v in r["variants"]),"laterSupported":len(supported),"registrations":0},"supported":supported,"activeRegistryPreserved":True}
  payload["resultHash"]=digest(payload); args.output.parent.mkdir(parents=True,exist_ok=True); args.output.write_text(json.dumps(payload,indent=2)+"\n",encoding="utf-8")
  compact={"schema":"fms-multiscale-structure-summary-v1","manifestHash":manifest["manifestHash"],"resultHash":payload["resultHash"],"summary":payload["summary"],"supported":supported,"disclosure":"Entry-known D1/weekly barrier no-trade research; gross reused history; no registered contract changed."}
  (ROOT/"Main/src/app/lib/fmsMultiscaleStructureSummary.json").write_text(json.dumps(compact,indent=2)+"\n",encoding="utf-8")
  print(json.dumps({**payload["summary"],"manifestHash":manifest["manifestHash"],"resultHash":payload["resultHash"]}))
if __name__=="__main__": main()
