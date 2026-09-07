import { BookOpen, ClipboardCopy } from "lucide-react";
import { memo, useMemo, useState } from "react";
import type { ChartMacroBiasRealtimeCardData } from "@/app/components/ChartMacroBiasRealtimeCard";
import { macroSignalSetupCredibility } from "@/app/components/ChartMacroBiasSetupCatalog";
import type { MacroSignalChartPattern } from "@/app/types";
import entryResearch from "@/app/lib/fmsEntryResearchSummary.json";
import coverageResearch from "@/app/lib/fmsCoverageSummary.json";
import exhaustionResearch from "@/app/lib/fmsExhaustionSummary.json";
import controlledMining from "@/app/lib/fmsControlledMiningSummary.json";
import multiscaleStructure from "@/app/lib/fmsMultiscaleStructureSummary.json";
import extendedCorelease from "@/app/lib/fmsExtendedCoreleaseSummary.json";

function average(pattern: MacroSignalChartPattern): number | null {
  const reviewed = pattern.executionReview?.status === "reviewed_active" ? pattern.executionReview.later : null;
  return typeof reviewed?.averageR === "number" ? reviewed.averageR : pattern.historicalBenchmark?.walkForwardAverageR ?? pattern.executionStress.overall.averageR ?? null;
}

function accuracy(pattern: MacroSignalChartPattern): number | null {
  const reviewed = pattern.executionReview?.status === "reviewed_active" ? pattern.executionReview.later : null;
  return typeof reviewed?.tpBeforeSl === "number" ? reviewed.tpBeforeSl : pattern.historicalBenchmark?.targetFirstRate ?? pattern.overall.targetHitRate ?? null;
}

function profitFrequency(pattern: MacroSignalChartPattern): number | null {
  const reviewed = pattern.executionReview?.status === "reviewed_active" ? pattern.executionReview.later : null;
  if (typeof reviewed?.positiveRate === "number") return reviewed.positiveRate;
  const activeLater = pattern.reactionAudit?.profile?.executionChallenger?.activeLater;
  return typeof activeLater?.positiveRate === "number" ? activeLater.positiveRate : null;
}

function health(pattern: MacroSignalChartPattern, weakened: ReadonlySet<string>, market: string): "Healthy" | "Weakening" | "Suspended" {
  if (pattern.readiness?.actionableInShadowTrader === false || pattern.readiness?.auditStatus !== "complete") return "Suspended";
  return weakened.has(`${market}:${pattern.id}`) ? "Weakening" : "Healthy";
}

const FINDINGS = [
  ["Direction and execution are different", "Price can initially follow an arrow and still hit the frozen SL later. FMS preserves both answers."],
  ["Low TP rate can still be profitable", "A high-R contract may need fewer wins than losses. Average R and break-even rate must be read together."],
  ["Frequent news is not automatically tradable", "Large sample size helps confidence, but many frequent releases still showed no dependable directional edge."],
  ["Magnitude is setup-specific", "Ordinary, large, and exceptional Surprise/Momentum improved some exact recipes but did not work as a universal filter."],
  ["Context is not universal", "Trend, volatility, support/resistance, and macro background supported only a small number of exact setup rules."],
  ["Offline recovery is separate", "Recovered trades reconstruct the frozen result from MT5 history but never count as true first-seen forward observations."],
  ["A reversal price is hindsight", "FMS can detect a completed reversal pattern, but it cannot truthfully exit at the exact future wick. Reversal research exits at the next H4 open."],
  ["Support and resistance must be entry-known", "Only zones confirmed by completed candles before entry may inform research. Later arrow clustering is audit evidence, not a historical input."],
  ["Controlled overfitting stays exploratory", "A finite filter search may reveal candidates worth watching, but reused-history winners remain visibly high risk and cannot become registered or actionable without fresh forward evidence."],
  ["Avoiding a setup is measurable", "A no-trade filter earns credit only when it improves the exact parent chronology after counting both avoided losses and removed winners."],
  ["An arrow is not an entry-price marker", "Arrows sit above or below the activation candle. The Entry line shows the price. Moving an arrow to the release candle does not change the frozen trade."],
] as const;

type KnowledgeSort = "credibility" | "expectancy" | "profit_frequency" | "tp_first";
const CREDIBILITY_ORDER = { Strong: 4, Moderate: 3, Fragile: 2, Unproven: 1 } as const;

function unresolvedTriage(reason: string): { bucket: string; action: string } {
  if (reason.includes("ambiguous") || reason.includes("both_touched")) return { bucket: "Ambiguous ordering", action: "Retain as unevaluable; acquire M1 history only if the broker can provide the exact interval." };
  if (reason.includes("candle") || reason.includes("price") || reason.includes("history")) return { bucket: "Missing candle coverage", action: "Run the named symbol/time-range MT5 history backfill, then retry once." };
  if (reason.includes("calendar") || reason.includes("series") || reason.includes("event")) return { bucket: "Missing calendar series", action: "Keep EA calendar capture running; backfill the named broker window if available." };
  if (reason.includes("artifact") || reason.includes("fingerprint") || reason.includes("configuration")) return { bucket: "Artifact mismatch", action: "Reconcile the named immutable fingerprint before interpreting the result." };
  return { bucket: "Review worthy", action: "Inspect the exact recorded reason; do not infer or hand-label an outcome." };
}

function controlAverage(metric: { n: number; averageR?: number | null }): string {
  return metric.averageR == null ? "—" : `${metric.averageR.toFixed(2)}R`;
}

export const ChartFmsKnowledgeCard = memo(function ChartFmsKnowledgeCard({ data }: { data: ChartMacroBiasRealtimeCardData }) {
  const [copied, setCopied] = useState(false);
  const [sort, setSort] = useState<KnowledgeSort>("credibility");
  const markets = data.globalResponse?.markets.filter((market) => market.supported) ?? [data.response];
  const weakened = useMemo(() => new Set((data.globalResponse?.outcomeReview?.executionReviews ?? []).filter((row) => row.status === "active_evidence_weakened").map((row) => `${row.market}:${row.patternId}`)), [data.globalResponse?.outcomeReview]);
  const triage = useMemo(() => Object.entries(data.globalResponse?.outcomeReview?.unresolvedByReason ?? {}).map(([reason, count]) => ({ reason, count, ...unresolvedTriage(reason) })), [data.globalResponse?.outcomeReview]);
  const patterns = useMemo(() => markets.flatMap((market) => market.patterns.filter((pattern) => pattern.currentEligible).map((pattern) => ({ market: market.symbol, pattern }))), [markets]);
  const minedShadow = useMemo(() => controlledMining.finalists.filter((row) => row.finalAuditPositive).map((candidate) => {
    const [market, patternId] = candidate.recipe.split("|", 2);
    const source = markets.find((row) => row.symbol === market);
    const candidateSignals = [...(source?.signals ?? []), ...(source?.recoveredSignals ?? [])]
      .filter((signal) => signal.patternId === patternId)
      .sort((left, right) => left.eventTime - right.eventTime);
    const matches = candidateSignals.filter((signal, index) => {
      if (signal.patternId !== patternId || signal.eventTime < (source?.modelActivatedAt ?? Infinity)) return false;
      const hour = new Date((signal.eventTime + 7 * 3_600) * 1_000).getUTCHours();
      const signalEvents = signal.events ?? [];
      const surprise = signalEvents.map((event) => event.surprisePoint).filter((value): value is number => value != null);
      const momentum = signalEvents.map((event) => event.momentumPoint).filter((value): value is number => value != null);
      const shape = (values: number[]) => values.length === 0 || values.reduce((sum, value) => sum + value, 0) === 0 ? "flat_or_missing" : values.reduce((sum, value) => sum + value, 0) > 0 ? "positive" : "negative";
      const robustness = signal.numericRobustness;
      const crossStates = [...new Set(signalEvents.map((event) => event.currency))].flatMap((currency) => {
        const votes = new Map<string, number>();
        markets.forEach((otherMarket) => [...otherMarket.signals, ...(otherMarket.recoveredSignals ?? [])].filter((other) => other.eventTime === signal.eventTime && (other.events ?? []).some((event) => event.currency === currency)).forEach((other) => {
          if (currency !== otherMarket.symbol.slice(0, 3) && currency !== otherMarket.symbol.slice(3, 6)) return;
          const directionVote = other.direction === "long" ? 1 : -1;
          votes.set(otherMarket.symbol, currency === otherMarket.symbol.slice(0, 3) ? directionVote : -directionVote);
        }));
        return votes.size < 2 ? [] : [new Set(votes.values()).size === 1 ? "confirmed" : "conflicted"];
      });
      const observed: Record<string, string | undefined> = {
        evidenceMode: robustness?.evidenceMode, revisionReliability: robustness?.revisionReliability,
        backgroundAlignment: robustness?.backgroundAlignment ?? signal.backgroundAlignment,
        scoreStrength: robustness?.scoreStrength, packageCompleteness: robustness?.packageCompleteness,
        relativeMagnitude: robustness?.relativeMagnitude,
        priorSeriesSurpriseShape: robustness?.priorSeriesSurpriseShape,
        crossPairConfirmation: crossStates.includes("conflicted") ? "conflicted" : crossStates.length ? "confirmed" : "isolated",
        sessionJakarta: hour < 8 ? "asia" : hour < 15 ? "europe" : "us",
        releaseWindow: `${String(Math.floor(hour / 4) * 4).padStart(2, "0")}-${String(Math.floor(hour / 4) * 4 + 4).padStart(2, "0")}`,
        forecastQuality: signalEvents.some((event) => event.forecastSuspect) ? "suspect" : "ordinary",
        surpriseShape: shape(surprise), momentumShape: shape(momentum),
        packageDisagreement: new Set(signalEvents.filter((event) => event.score !== 0).map((event) => event.score > 0)).size > 1 ? "disagrees" : "aligned_or_single",
        priorRecipeDirectionShape: index === 0 ? "unknown" : candidateSignals[index - 1].direction === signal.direction ? "same" : "reversal",
      };
      return Object.entries(candidate.rule).every(([key, value]) => observed[key] === value);
    });
    const live = matches.filter((signal) => signal.observationMode === "live_captured");
    const recovered = matches.filter((signal) => signal.observationMode === "recovered_offline");
    const resolvedLive = live.filter((signal) => signal.resultR != null);
    const resolvedRecovered = recovered.filter((signal) => signal.resultR != null);
    return { ...candidate, liveN: live.length, recoveredN: recovered.length,
      liveR: resolvedLive.reduce((sum, signal) => sum + Number(signal.resultR), 0),
      recoveredR: resolvedRecovered.reduce((sum, signal) => sum + Number(signal.resultR), 0) };
  }), [markets]);
  const summary = useMemo(() => patterns.map(({ market, pattern }) => ({
    market,
    label: pattern.label,
    health: health(pattern, weakened, market),
    average: average(pattern),
    accuracy: accuracy(pattern),
    profitFrequency: profitFrequency(pattern),
    credibility: macroSignalSetupCredibility(pattern),
    reaction: pattern.reaction === "contrarian" ? "Historically rejected evidence" : "Historically followed evidence",
  })).sort((left, right) => {
    const difference = sort === "expectancy"
      ? (right.average ?? -Infinity) - (left.average ?? -Infinity)
      : sort === "profit_frequency"
        ? (right.profitFrequency ?? -Infinity) - (left.profitFrequency ?? -Infinity)
      : sort === "tp_first"
        ? (right.accuracy ?? -Infinity) - (left.accuracy ?? -Infinity)
        : CREDIBILITY_ORDER[right.credibility.label] - CREDIBILITY_ORDER[left.credibility.label]
          || (right.average ?? -Infinity) - (left.average ?? -Infinity);
    return difference || left.market.localeCompare(right.market) || left.label.localeCompare(right.label);
  }), [patterns, sort, weakened]);
  const ledger = useMemo(() => {
    const executionArtifacts = patterns.map(({ pattern }) => pattern.reactionAudit?.profile?.executionChallenger).filter(Boolean);
    const reversalArtifacts = patterns.map(({ pattern }) => pattern.reactionAudit?.profile?.reversalExitResearch).filter(Boolean);
    return [
      {
        id: coverageResearch.coverageHash, status: coverageResearch.summary.ready === coverageResearch.summary.markets ? "Ready" : "Preparing", title: "Major Forex Extended coverage",
        evidence: `${coverageResearch.summary.ready} of ${coverageResearch.summary.markets} markets have H4 coverage and all four frozen source baselines; ${coverageResearch.summary.completedSources} of ${coverageResearch.summary.requiredSources} source baselines are complete.`,
        conclusion: "The original markets and crosses share one coverage ledger. AUDJPY, EURCAD, and EURJPY now have reviewed immutable setups; the remaining crosses stay research-only.",
      },
      {
        id: "reaction-path-v2", status: "Available", title: "Reaction and path atlas",
        evidence: `${patterns.length} registered recipes expose fixed-horizon direction, MFE, MAE, giveback, and target ladders.`,
        conclusion: "Directional reaction and frozen trade outcome remain separate measurements.",
      },
      {
        id: "execution-challenger-v2", status: "Completed", title: "Execution challenger v2",
        evidence: `${executionArtifacts.length} recipes; ${executionArtifacts.reduce((sum, row) => sum + Number(row?.declaredConfigurationCount ?? 0), 0).toLocaleString()} declared fixed, break-even, trailing, and partial configurations.`,
        conclusion: `${patterns.filter(({ pattern }) => pattern.executionReview?.status === "reviewed_active").length} reviewed management overlays are active; every other registered contract stayed unchanged.`,
      },
      {
        id: "entry-context-v1", status: "Completed", title: "Entry-known market context",
        evidence: `${patterns.length} recipes audited trend, volatility, directional room, macro background, and session using information available by entry.`,
        conclusion: `${patterns.filter(({ pattern }) => pattern.contextRegistration?.status === "reviewed_active" && !pattern.contextRegistration.retiredAt).length} context contracts remain active; ${patterns.filter(({ pattern }) => pattern.contextRegistration?.retiredAt).length} was archived after corrected direction research. Context is not a universal filter.`,
      },
      {
        id: "reversal-exit-v1", status: "Research only", title: "Completed-H4 reversal exits",
        evidence: reversalArtifacts.length
          ? `${reversalArtifacts.length} recipes; ${reversalArtifacts.reduce((sum, row) => sum + Number(row?.declaredConfigurationCount ?? 0), 0).toLocaleString()} predeclared H4 and entry-known-zone reversal configurations.`
          : "Artifact generation has not completed in this runtime.",
        conclusion: reversalArtifacts.length
          ? `${reversalArtifacts.reduce((sum, row) => sum + Number(row?.reviewWorthy?.length ?? 0), 0)} development-selected family winners passed the practical later comparison. No active contract was changed.`
          : "The design remains research-only and cannot change a registered trade.",
      },
      {
        id: entryResearch.hourly.manifestHash, status: "Research only", title: "Earlier H1 entry versus H4",
        evidence: `${entryResearch.hourly.recipeCount} recipes; ${entryResearch.hourly.matched} of ${entryResearch.hourly.attempted} cases had matched evaluable paths.`,
        conclusion: `${entryResearch.hourly.developmentSelectedH1} development selections favored H1; ${entryResearch.hourly.laterPositiveImprovements} retained positive later improvement. Full elapsed-path coverage excludes weekends and many longer trades. This selective reused-history sample does not justify a universal entry change.`,
      },
      {
        id: entryResearch.sessionHourly.manifestHash, status: "Research only", title: "Trading-session H1 entry versus H4",
        evidence: `${entryResearch.sessionHourly.recipeCount} recipes; ${entryResearch.sessionHourly.matched} of ${entryResearch.sessionHourly.attempted} cases had matched evaluable paths.`,
        conclusion: `${entryResearch.sessionHourly.developmentSelectedH1} development selections favored H1; ${entryResearch.sessionHourly.laterPositiveImprovements} retained positive later improvement. These are candidates for active-contract review, not registrations.`,
      },
      {
        id: entryResearch.activeEntryReview.manifestHash, status: "8 registered successors", title: "Exact active-contract H1 review",
        evidence: `${entryResearch.activeEntryReview.reviewed} timing candidates were replayed with their exact registered fixed or break-even contract.`,
        conclusion: `${entryResearch.activeEntryReview.supported} retained positive development and later H1 improvement and now use immutable H1 successor contracts. Future signals require the complete first-seen package before the H1 boundary; older occurrences retain H4.`,
      },
      {
        id: entryResearch.preH4Reaction.manifestHash, status: "Completed", title: "Reaction before H4 entry",
        evidence: `${entryResearch.preH4Reaction.evaluated.toLocaleString()} recipe cases measured the direction-adjusted move, favorable excursion and adverse excursion between the first H1 proxy and H4 entry.`,
        conclusion: "Earlier-entry improvements did not universally come from capturing an immediate directional reaction; each recipe must be read separately.",
      },
      {
        id: entryResearch.minute.manifestHash, status: "Limited evidence", title: "Near-release minute entry",
        evidence: `${entryResearch.minute.matched} of ${entryResearch.minute.attempted} recent cases were comparable across M1, H1 and H4 entries.`,
        conclusion: "Results were mixed and samples sparse. These scheduled-release candle proxies cannot prove when the complete release package was available or an actual fill. No faster contract was registered.",
      },
      {
        id: "offline-provenance-v1", status: "Operational", title: "Live versus recovered provenance",
        evidence: "Recent activity, arrows, and trade details preserve whether a decision was captured live or reconstructed from MT5 history.",
        conclusion: "Only live-captured decisions may ever become eligible for later demo-order automation.",
      },
      {
        id: exhaustionResearch.ledgerHash, status: "Completed", title: "Search exhaustion ledger",
        evidence: `${exhaustionResearch.registeredRecipeCount} registered recipes cover ${exhaustionResearch.registeredMarkets.length} of ${exhaustionResearch.universe.length} markets; ${exhaustionResearch.marketsWithoutRegisteredRecipe.length} markets have no registered recipe. Calendar-family inventory: ${exhaustionResearch.calendarFamilyInventory.filter((row) => row.status === "available_not_registered").length} currency/family cells available but unregistered and ${exhaustionResearch.calendarFamilyInventory.filter((row) => row.status === "broker_series_absent").length} absent from the broker archive. The controlled filter lane recorded ${exhaustionResearch.hypothesisLanes.find((row) => row.family.includes("categorical"))?.attempts?.toLocaleString() ?? 0} attempts.`,
        conclusion: exhaustionResearch.conclusion,
      },
      {
        id: multiscaleStructure.resultHash, status: "Completed · no promotion", title: "D1/weekly target-barrier filters",
        evidence: `${multiscaleStructure.summary.declaredConfigurations} frozen D1, weekly, and combined no-trade filters across ${multiscaleStructure.summary.recipes} registered recipes; ${multiscaleStructure.summary.developmentSelected} cleared the older-development gate and ${multiscaleStructure.summary.laterSupported} cleared later chronology.`,
        conclusion: "Keep wider structure as descriptive chart context. This exact multi-scale filter family did not justify withholding or changing a registered trade.",
      },
    ];
  }, [patterns]);
  const markdown = [
    "# Current FMS knowledge snapshot",
    "",
    ...FINDINGS.map(([title, detail]) => `- **${title}:** ${detail}`),
    "",
    "## Registered setup health",
    ...summary.map((row) => `- ${row.market} · ${row.label}: ${row.credibility.label}; ${row.health}; average ${row.average == null ? "unavailable" : `${row.average >= 0 ? "+" : ""}${row.average.toFixed(2)}R`}; positive final R ${row.profitFrequency == null ? "unavailable" : `${(row.profitFrequency * 100).toFixed(1)}%`}; TP-before-SL ${row.accuracy == null ? "unavailable" : `${(row.accuracy * 100).toFixed(1)}%`}; ${row.reaction}.`),
    "",
    "## Research ledger",
    ...ledger.map((row) => `- **${row.title} (${row.status}):** ${row.evidence} ${row.conclusion}`),
    "",
    `Entry research recorded ${entryResearch.recordedOn}. Session-hourly manifest: ${entryResearch.sessionHourly.manifestHash}; minute manifest: ${entryResearch.minute.manifestHash}.`,
    `Saved artifacts: ${entryResearch.hourly.sourceDirectory}; ${entryResearch.minute.sourceDirectory}.`,
  ].join("\n");
  const copy = async () => {
    await navigator.clipboard?.writeText(markdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  };

  return (
    <section className="fms-knowledge-card" aria-label="FMS durable knowledge">
      <header><div><BookOpen size={15} /><span>FMS Knowledge</span></div><button type="button" onClick={() => void copy()}><ClipboardCopy size={13} />{copied ? "Copied" : "Copy snapshot"}</button></header>
      <section>
        <h2>What the research has taught us</h2>
        <p>This is the compact operational memory. Detailed immutable experiments remain in the Workbench and research archive.</p>
        <div className="fms-knowledge-findings">{FINDINGS.map(([title, detail]) => <article key={title}><strong>{title}</strong><p>{detail}</p></article>)}</div>
      </section>
      <section>
        <div className="fms-knowledge-section-heading"><div><h2>Registered evidence grading</h2><p>Evidence grades compare reproducibility, not the probability that the next trade wins.</p></div><label>Sort<select value={sort} onChange={(event) => setSort(event.target.value as KnowledgeSort)}><option value="credibility">Evidence grade</option><option value="expectancy">Expected payoff</option><option value="profit_frequency">Profit frequency</option><option value="tp_first">TP before SL</option></select></label></div>
        <table><thead><tr><th>Market and setup</th><th>Evidence / health</th><th>Expected payoff</th><th>Profit frequency</th><th>TP before SL</th><th>Observed mapping</th></tr></thead><tbody>{summary.map((row) => <tr key={`${row.market}:${row.label}`}><td><b>{row.market}</b><span>{row.label}</span></td><td title={row.credibility.detail}><strong className={`is-${row.credibility.label.toLowerCase()}`}>{row.credibility.label}</strong><span className={`is-${row.health.toLowerCase()}`}>{row.health}</span></td><td>{row.average == null ? "—" : `${row.average >= 0 ? "+" : ""}${row.average.toFixed(2)}R`}</td><td>{row.profitFrequency == null ? "—" : `${(row.profitFrequency * 100).toFixed(1)}%`}</td><td>{row.accuracy == null ? "—" : `${(row.accuracy * 100).toFixed(1)}%`}</td><td>{row.reaction}</td></tr>)}</tbody></table>
      </section>
      <section><h2>Research ledger</h2><p>Completed, failed, and research-only work is retained here so a later Codex pass can build on it instead of repeating it.</p><div className="fms-knowledge-research">{ledger.map((row) => <article key={row.id}><strong>{row.title} · {row.status}</strong><p>{row.evidence}</p><small>{row.conclusion}</small></article>)}</div></section>
      <section><h2>Next-search map</h2><p>The current campaigns are bounded and complete; the available calendar/OHLC hypothesis space is still open.</p><div className="fms-knowledge-research">{exhaustionResearch.rankedNextSearch.map((row) => <article key={row.rank}><strong>{row.rank}. {row.family}</strong><p>{row.why}</p></article>)}</div></section>
      <section><h2>Extended-pair co-release campaign</h2><p>An exact new-package hypothesis searched the 18 markets without registrations after excluding every Stage-A package identity.</p><div className="fms-knowledge-research"><article><strong>Completed · no promotion</strong><p>{extendedCorelease.configurationsTested.toLocaleString()} frozen configurations across {extendedCorelease.packagesTested} qualifying multi-factor packages and {extendedCorelease.marketsCompleted} markets produced {extendedCorelease.exploratoryFinalists} final-positive candidates.</p><small>{extendedCorelease.disclosure}</small></article></div></section>
      <section><h2>Exploratory mined candidates</h2><p>{controlledMining.disclosure} {controlledMining.summary.recipeFinalists} recipe-level selections survived nested development and selection; {minedShadow.length} also stayed positive in the final reused-history audit and are monitored against post-registration observations.</p><div className="fms-knowledge-research">{minedShadow.sort((left, right) => (right.final.upliftAverageR ?? -Infinity) - (left.final.upliftAverageR ?? -Infinity)).slice(0, 8).map((row) => <article key={row.recipe}><strong>{row.recipe.replace("|", " · ")} · Exploratory / high overfit risk</strong><p>Keep only {Object.entries(row.rule).map(([key, value]) => `${key.replaceAll(/([A-Z])/g, " $1").toLowerCase()} = ${value}`).join(" and ")}.</p><small>Reused-history final N {row.final.kept.n} · uplift {row.final.upliftAverageR == null ? "—" : `${row.final.upliftAverageR >= 0 ? "+" : ""}${row.final.upliftAverageR.toFixed(2)}R`}. Controls: always-long {controlAverage(row.controlMetrics.alwaysLong)}; always-short {controlAverage(row.controlMetrics.alwaysShort)}; opposite {controlAverage(row.controlMetrics.oppositeDirection)}; shifted non-event {controlAverage(row.controlMetrics.nonEventSevenDaysEarlier)}. Shadow: {row.liveN} first-seen / {row.liveR >= 0 ? "+" : ""}{row.liveR.toFixed(2)}R gross; {row.recoveredN} recovered / {row.recoveredR >= 0 ? "+" : ""}{row.recoveredR.toFixed(2)}R gross. Never actionable.</small></article>)}</div></section>
      <section><h2>Owner action needed</h2><p>Codex can continue research without case-picking. Owner action is limited to source capture and execution records.</p><div className="fms-knowledge-research">
        <article><strong>Keep MT5 calendar capture running</strong><p>This preserves future first-seen Actual/Forecast/Previous packages and creates the chronology needed to judge exploratory candidates honestly.</p></article>
        <article><strong>Resolve missing source only when named</strong><p>If FMS reports a missing broker series, candle window, or symbol, run the stated backfill or confirm that the broker does not supply it. Do not choose winners or favorable cases.</p></article>
        <article><strong>Optional manual record</strong><p>Use the exact FMS tag when manually placing a 0.01-lot demo or live observation so Journal can attach the broker result. Fyodor still sends no order.</p></article>
      </div></section>
      <section>
        <details>
          <summary>View entry-research records · {entryResearch.recordedOn}</summary>
          <p>Frozen campaign summaries include every recipe, exclusion counts, selection rules and source fingerprints. These historical fixed-contract comparisons do not simulate the active management overlays.</p>
          <p><a download="fms-entry-research-summary.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(entryResearch, null, 2))}`}>Download timing research JSON</a></p>
        </details>
      </section>
      {data.globalResponse?.researchIntelligence?.length ? <section><h2>Tested but not registered</h2><p>Failed and unresolved findings are retained so future research does not unknowingly repeat them.</p><div className="fms-knowledge-research">{data.globalResponse.researchIntelligence.map((row) => <article key={row.id}><strong>{row.market} · {row.label} · {row.status.replaceAll("_", " ")}</strong><p>{row.conclusion}</p><small>{row.evidence}</small></article>)}</div></section> : null}
      <section><h2>Automatic review queue</h2><p>Each unresolved result is assigned a reason and next action; favorable cases never require owner labelling.</p><div className="fms-knowledge-research">{triage.length ? triage.map((row) => <article key={row.reason}><strong>{row.bucket} · {row.count}</strong><p>{row.reason.replaceAll("_", " ")}</p><small>{row.action}</small></article>) : <article><strong>No unresolved result is currently queued</strong><p>New missing-data or ordering cases will be classified here when observed.</p></article>}</div></section>
      <footer>Source: immutable FMS experiment, reaction, context, execution, and forward-observation artifacts.</footer>
    </section>
  );
});
