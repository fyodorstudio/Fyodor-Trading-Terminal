import { useState } from "react";
import snapshot from "./fmsRecipeCatalogue.v4.json";

type Partition = "overall" | "development" | "holdout";

function countRate(count: number | null, total: number | null): string {
  if (count == null || total == null || total === 0) return "— · no evaluable denominator";
  return `${count}/${total} · ${(count / total * 100).toFixed(1)}%`;
}

function number(value: number | null | undefined, unit = ""): string {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(2)}${unit}`;
}

function reviewLabel(status: string): string {
  if (status === "previously_declined") return "Previously declined execution study";
  if (status === "baseline_identity_reconciled") return "Baseline approval identity reconciled";
  return "Unregistered review evidence · not approved";
}

export function FmsRecipeCatalogue() {
  const [market, setMarket] = useState("all");
  const [horizon, setHorizon] = useState(12);
  const [partition, setPartition] = useState<Partition>("holdout");
  const [expanded, setExpanded] = useState<string | null>(null);
  const recipes = snapshot.recipes.filter((recipe) => market === "all" || recipe.market === market);

  return <section className="fms-recipe-catalogue" aria-label="Saved event-pair catalogue and execution decisions">
    <header><strong>Event–pair catalogue · research only</strong><span>{snapshot.summary.recipes} recipes · {snapshot.summary.newRegistrations} new registrations</span></header>
    <p className="fms-recipe-catalogue-warning">Timing unverified: calendar server time and candle UTC alignment require verification. These are as-recorded comparisons—not approved FMS v2 trades.</p>
    <p>Goal: more or better registered recipes. Method: one fixed 1-ATR stop, 0.5R/1R/2R targets, 6/12/30-H4 horizons. All results are gross; reused holdout history is not fresh validation.</p>
    <div className="fms-recipe-catalogue-controls">
      <label>Pair<select value={market} onChange={(event) => { setMarket(event.target.value); setExpanded(null); }}><option value="all">All baseline pairs</option>{snapshot.universe.map((pair) => <option key={pair} value={pair}>{pair}</option>)}</select></label>
      <label>Horizon<select value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>{[6, 12, 30].map((value) => <option key={value} value={value}>{value} H4 candles</option>)}</select></label>
      <label>Evidence<select value={partition} onChange={(event) => setPartition(event.target.value as Partition)}><option value="holdout">Reused holdout</option><option value="development">Development</option><option value="overall">All saved history</option></select></label>
    </div>
    <p>{recipes.length} saved recipes shown. Changing these controls is inspection, not contract optimization or approval.</p>
    {recipes.length === 0 ? <p>No baseline recipe in this saved inventory for {market}. This does not establish that the pair is unresearched or has no useful event response.</p> : null}
    {recipes.map((recipe) => {
      const followup = recipe.followup.find((row) => row.horizonCandles === horizon)!.partitions[partition];
      const contracts = recipe.contracts.filter((row) => row.horizonCandles === horizon);
      return <details key={recipe.recipe} open={expanded === recipe.recipe} onToggle={(event) => {
        const open = event.currentTarget.open;
        setExpanded((current) => open ? recipe.recipe : current === recipe.recipe ? null : current);
      }}>
        <summary>{recipe.market} · {recipe.label}<small>{reviewLabel(recipe.review.status)}</small></summary>
        {expanded === recipe.recipe ? <>
          <p>Frozen scoring: {recipe.scoringPolicy} · treatment: {recipe.reaction}. Conditions: {recipe.signatures.join("; ")}. Cohort: {recipe.cohort?.dimension}={recipe.cohort?.value}.</p>
          <table><colgroup><col className="is-measure"/><col className="is-value"/><col className="is-evidence"/></colgroup><thead><tr><th>Measure</th><th>Value</th><th>Evidence / meaning</th></tr></thead><tbody>
            <tr><th>Economic reading followed</th><td>{countRate(followup.economicReadingAlignedCount, followup.economicReadingEvaluableCount)}</td><td>Final horizon direction; not TP-before-SL.</td></tr>
            <tr><th>Recipe trade direction followed</th><td>{countRate(followup.tradeDirectionAlignedCount, followup.observedCount)}</td><td>Can differ from economic reading for rejection recipes.</td></tr>
            <tr><th>Complete follow-up coverage</th><td>{followup.observedCount}/{followup.attemptedCount}</td><td>{followup.unavailableCount} unavailable · {Object.entries(followup.unavailableByReason).map(([reason, count]) => `${reason}: ${count}`).join("; ") || "No unavailable paths"}</td></tr>
            <tr><th>Median movement / excursions</th><td>{number(followup.finalAtr.median)} / {number(followup.mfeAtr.median)} / {number(followup.maeAtr.median)} ATR</td><td>Trade-signed final / favorable / adverse. Excursions are not captured returns.</td></tr>
            {contracts.map((contract) => {
              const metrics = contract.partitions[partition];
              const touch = followup.targetTouches.find((row) => row.targetR === contract.targetR)!;
              return <tr key={contract.targetR}><th>{contract.targetR}R target · fixed 1-ATR stop</th><td>TP first {countRate(metrics.targetHitCount, metrics.evaluableCount)}<br/>Gross mean {number(metrics.averageGrossR, "R")}</td><td>Stop {metrics.stopHitCount} (gap stops {metrics.stopGapCount}); expiry {metrics.expiredCount}; ambiguous {metrics.ambiguousCount}; unavailable {metrics.unevaluableCount}; attempted {metrics.attemptedCount}.<br/>Eventual touch {countRate(touch.touchedCount, touch.observedCount)} · median first touch {number(touch.timeToTouchH4.median)} H4 candles.<br/>Descriptive mean interval {number(metrics.expectancyCi95?.lower, "R")} to {number(metrics.expectancyCi95?.upper, "R")}; overlapping releases are shared evidence.</td></tr>;
            })}
            <tr><th>Original execution review</th><td>{recipe.review.originalDecision}</td><td>{recipe.review.reason}<br/>Failed checks: {recipe.review.failedChecks.join(", ") || "None recorded"}. This is the original protocol decision, not a new manual case audit.</td></tr>
            <tr><th>Source lineage</th><td>{recipe.experimentId}</td><td>Split {new Date(recipe.splitTime * 1000).toISOString().slice(0, 10)} · UTC-labelled stored boundary; clock warning above applies.<br/>{recipe.noteKeys.length} saved note references. Originals unchanged.</td></tr>
          </tbody></table>
        </> : null}
      </details>;
    })}
    <details><summary>Research article / provenance</summary><p>Question: which event–pair rules produce repeatable directional responses and useful target-before-stop outcomes? Recipe: fixed reference geometry above, separate continuation/rejection interpretation, and exact incomplete/ambiguous counts. Result: a descriptive baseline—not a successor approval. Next: verify source clocks, review bounded entry/zone/geometry/expiry hypotheses, challenge candidates and explicitly register qualifying recipes.</p><p>Saved evaluation: {new Date(snapshot.evaluatedAt * 1000).toISOString()}. No live registry freshness is implied. Prior archived contracts remain separate in the full offline catalogue.</p><p>Catalogue hash: {snapshot.catalogueHash}<br/>Manifest hash: {snapshot.manifestHash}</p><ul>{snapshot.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></details>
  </section>;
}

export default FmsRecipeCatalogue;
