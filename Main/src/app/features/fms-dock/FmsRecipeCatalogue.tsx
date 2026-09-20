import { useState } from "react";
import snapshot from "./fmsRecipeCatalogue.v4.json";
import executionSnapshot from "./fmsExecutionSuccessors.v1.json";

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

function successorDecisionLabel(decision: string): string {
  if (decision === "registered_fms_v2") return "Registered FMS v2";
  if (decision === "reviewed_excluded") return "Reviewed · retained FMS v1";
  if (decision === "research_lead_not_comparable") return "Research lead · unmatched comparator";
  if (decision === "research_lead_not_registered") return "Research lead · not registered";
  return "Retain FMS v1";
}

function executionRule(contract: { stopAtr: number | null; targetR: number | null; expiryCandles: number | null } | null): string {
  return contract == null ? "No exact fixed-H4 comparator" : `SL ${number(contract.stopAtr)} ATR · TP ${number(contract.targetR)}R · ${contract.expiryCandles ?? "—"} H4`;
}

export function FmsRecipeCatalogue() {
  const [market, setMarket] = useState("all");
  const [horizon, setHorizon] = useState(12);
  const [partition, setPartition] = useState<Partition>("holdout");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedDecision, setExpandedDecision] = useState<string | null>(null);
  const recipes = snapshot.recipes.filter((recipe) => market === "all" || recipe.market === market);
  const decisions = executionSnapshot.rows.filter((recipe) => market === "all" || recipe.market === market);

  return <section className="fms-recipe-catalogue" aria-label="Saved event-pair catalogue and execution decisions">
    <header><strong>FMS v2 · event-specific execution review</strong><span>{executionSnapshot.summary.registeredSuccessors} registered · {executionSnapshot.summary.reviewedExclusions} explicit exclusion</span></header>
    <p className="fms-recipe-catalogue-warning">Current-source clock matching passed for relative event-to-candle order. Historical UTC offsets were not inferred. New live decisions still require the broker-scoped runtime v2 clock and complete first-seen package before entry.</p>
    <p>Goal: use a different bounded execution recipe where each event–pair needs different “medicine.” Each of 51 recipes tested 480 fixed-H4 SL/TP/expiry contracts on one matched complete-path cohort. Development selected the contract; reused holdout was opened afterward. Seventeen exact runtime comparisons are registered as FMS v2. Results remain gross and are not promises of future profit.</p>
    <div className="fms-recipe-catalogue-controls">
      <label>Pair<select value={market} onChange={(event) => { setMarket(event.target.value); setExpanded(null); setExpandedDecision(null); }}><option value="all">All baseline pairs</option>{snapshot.universe.map((pair) => <option key={pair} value={pair}>{pair}</option>)}</select></label>
      <label>Evidence<select value={partition} onChange={(event) => setPartition(event.target.value as Partition)}><option value="holdout">Reused holdout</option><option value="development">Development</option><option value="overall">All saved history</option></select></label>
    </div>
    <p>{decisions.length} reviewed recipe decisions shown · {executionSnapshot.summary.matchedImprovementLeads} matched improvement leads overall · {executionSnapshot.summary.researchOnlyLeads} unmatched/research-only positive leads.</p>
    {decisions.map((decision) => {
      const metrics = decision.selectedContract.partitions[partition];
      const comparison = decision.matchedV1Comparison?.partitions?.[partition];
      return <details key={decision.recipe} open={expandedDecision === decision.recipe} onToggle={(event) => {
        const open = event.currentTarget.open;
        setExpandedDecision((current) => open ? decision.recipe : current === decision.recipe ? null : current);
      }}>
        <summary>{decision.market} · {decision.label}<small>{successorDecisionLabel(decision.decision)}</small></summary>
        {expandedDecision === decision.recipe ? <>
          <p>{decision.decisionReason}</p>
          <table><colgroup><col className="is-measure"/><col className="is-value"/><col className="is-evidence"/></colgroup><thead><tr><th>Measure</th><th>Value</th><th>Evidence / meaning</th></tr></thead><tbody>
            <tr><th>Selected execution</th><td>{executionRule(decision.selectedContract)}</td><td>Development-only selection from the declared 480-contract grid.</td></tr>
            <tr><th>Exact v1 comparator</th><td>{executionRule(decision.matchedV1Contract)}</td><td>{comparison ? `Pessimistic mean-R change ${number(comparison.deltaPessimisticAverageR, "R")} in this partition.` : "No exact current fixed-H4 comparator; no improvement claim."}</td></tr>
            <tr><th>TP before SL</th><td>{countRate(metrics.targetHitCount, metrics.evaluableCount)}</td><td>Stop {metrics.stopHitCount}; expiry {metrics.expiredCount}; ambiguous {metrics.ambiguousCount}; unavailable {metrics.unevaluableCount}; attempted {metrics.attemptedCount}.</td></tr>
            <tr><th>Gross mean</th><td>{number(metrics.averageGrossR, "R")}</td><td>Pessimistic selection mean {number(metrics.pessimisticSelectionAverageR, "R")} · descriptive interval {number(metrics.expectancyCi95?.lower, "R")} to {number(metrics.expectancyCi95?.upper, "R")}.</td></tr>
            <tr><th>Chronology breadth</th><td>{metrics.positiveYears}/{metrics.evaluableYears} positive years</td><td>{decision.commonPathObservedN}/{decision.commonPathAttemptedN} complete maximum-horizon paths · overlapping releases across pairs are shared evidence.</td></tr>
            <tr><th>Decision lineage</th><td>{decision.registrationId ?? decision.originalReview.status}</td><td>Original failed checks retained: {decision.originalReview.failedChecks.join(", ") || "none"}. {decision.noteCount} durable note references.</td></tr>
          </tbody></table>
        </> : null}
      </details>;
    })}
    <details><summary>FMS v2 research article / provenance</summary><p><b>Question:</b> can event-specific fixed execution improve the exact v1 rule without changing its economic release/scoring direction? <b>Recipe:</b> first strictly later H4 open, completed pre-entry ATR, stops 0.5–3 ATR, targets 0.25–4R and 6–60 H4 expiry; same-candle order remains ambiguous and is scored stop-first only for selection. <b>Result:</b> 18 matched leads improved both development and reused holdout; 17 became explicit successors. USDJPY manufacturing employment was excluded because a separate context contract makes its live behavior composite. <b>Next:</b> collect immutable first-seen outcomes; never rewrite v1 arrows.</p><p>Evaluated {new Date(executionSnapshot.evaluatedAt * 1000).toISOString()} · activated {new Date(executionSnapshot.activatedAt * 1000).toISOString()}.</p><p>Research {executionSnapshot.sourceResearchHash}<br/>Manifest {executionSnapshot.sourceManifestHash}<br/>Registry {executionSnapshot.registryHash}<br/>Surface {executionSnapshot.surfaceHash}</p><ul>{executionSnapshot.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></details>
    <details><summary>Archived common-policy TP ladder · descriptive baseline</summary>
      <p className="fms-recipe-catalogue-warning">This earlier v4 surface predates the verified current clock path and made zero registrations. It remains useful for common 1-ATR TP ladders and directional follow-up, not current approval state.</p>
      <div className="fms-recipe-catalogue-controls"><label>Horizon<select value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>{[6, 12, 30].map((value) => <option key={value} value={value}>{value} H4 candles</option>)}</select></label></div>
      {recipes.map((recipe) => {
        const followup = recipe.followup.find((row) => row.horizonCandles === horizon)!.partitions[partition];
        const contracts = recipe.contracts.filter((row) => row.horizonCandles === horizon);
        return <details key={recipe.recipe} open={expanded === recipe.recipe} onToggle={(event) => {
          const open = event.currentTarget.open;
          setExpanded((current) => open ? recipe.recipe : current === recipe.recipe ? null : current);
        }}>
          <summary>{recipe.market} · {recipe.label}<small>{reviewLabel(recipe.review.status)}</small></summary>
          {expanded === recipe.recipe ? <><p>Frozen scoring: {recipe.scoringPolicy} · treatment: {recipe.reaction}. Conditions: {recipe.signatures.join("; ")}.</p><table><thead><tr><th>Measure</th><th>Value</th><th>Evidence / meaning</th></tr></thead><tbody>
            <tr><th>Economic reading followed</th><td>{countRate(followup.economicReadingAlignedCount, followup.economicReadingEvaluableCount)}</td><td>Final horizon direction; not TP-before-SL.</td></tr>
            <tr><th>Recipe direction followed</th><td>{countRate(followup.tradeDirectionAlignedCount, followup.observedCount)}</td><td>Can differ for rejection recipes.</td></tr>
            {contracts.map((contract) => { const metrics = contract.partitions[partition]; const touch = followup.targetTouches.find((row) => row.targetR === contract.targetR)!; return <tr key={contract.targetR}><th>{contract.targetR}R · fixed 1-ATR stop</th><td>TP first {countRate(metrics.targetHitCount, metrics.evaluableCount)}<br/>Gross {number(metrics.averageGrossR, "R")}</td><td>Eventual touch {countRate(touch.touchedCount, touch.observedCount)} · ambiguous {metrics.ambiguousCount} · unavailable {metrics.unevaluableCount}.</td></tr>; })}
          </tbody></table></> : null}
        </details>;
      })}
      <p>Catalogue {snapshot.catalogueHash} · manifest {snapshot.manifestHash}</p>
    </details>
  </section>;
}

export default FmsRecipeCatalogue;
