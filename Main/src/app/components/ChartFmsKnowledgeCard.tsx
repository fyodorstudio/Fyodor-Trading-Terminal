import { BookOpen, ClipboardCopy } from "lucide-react";
import { memo, useMemo, useState } from "react";
import type { ChartMacroBiasRealtimeCardData } from "@/app/components/ChartMacroBiasRealtimeCard";
import { macroSignalSetupCredibility } from "@/app/components/ChartMacroBiasSetupCatalog";
import type { MacroSignalChartPattern } from "@/app/types";
import entryResearch from "@/app/lib/fmsEntryResearchSummary.json";
import coverageResearch from "@/app/lib/fmsCoverageSummary.json";

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
  ["An arrow is not an entry-price marker", "Arrows sit above or below the activation candle. The Entry line shows the price. Moving an arrow to the release candle does not change the frozen trade."],
] as const;

type KnowledgeSort = "credibility" | "expectancy" | "profit_frequency" | "tp_first";
const CREDIBILITY_ORDER = { Strong: 4, Moderate: 3, Fragile: 2, Unproven: 1 } as const;

export const ChartFmsKnowledgeCard = memo(function ChartFmsKnowledgeCard({ data }: { data: ChartMacroBiasRealtimeCardData }) {
  const [copied, setCopied] = useState(false);
  const [sort, setSort] = useState<KnowledgeSort>("credibility");
  const markets = data.globalResponse?.markets.filter((market) => market.supported) ?? [data.response];
  const weakened = useMemo(() => new Set((data.globalResponse?.outcomeReview?.executionReviews ?? []).filter((row) => row.status === "active_evidence_weakened").map((row) => `${row.market}:${row.patternId}`)), [data.globalResponse?.outcomeReview]);
  const patterns = useMemo(() => markets.flatMap((market) => market.patterns.filter((pattern) => pattern.currentEligible).map((pattern) => ({ market: market.symbol, pattern }))), [markets]);
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
      <section>
        <details>
          <summary>View entry-research records · {entryResearch.recordedOn}</summary>
          <p>Frozen campaign summaries include every recipe, exclusion counts, selection rules and source fingerprints. These historical fixed-contract comparisons do not simulate the active management overlays.</p>
          <p><a download="fms-entry-research-summary.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(entryResearch, null, 2))}`}>Download timing research JSON</a></p>
        </details>
      </section>
      {data.globalResponse?.researchIntelligence?.length ? <section><h2>Tested but not registered</h2><p>Failed and unresolved findings are retained so future research does not unknowingly repeat them.</p><div className="fms-knowledge-research">{data.globalResponse.researchIntelligence.map((row) => <article key={row.id}><strong>{row.market} · {row.label} · {row.status.replaceAll("_", " ")}</strong><p>{row.conclusion}</p><small>{row.evidence}</small></article>)}</div></section> : null}
      <footer>Source: immutable FMS experiment, reaction, context, execution, and forward-observation artifacts.</footer>
    </section>
  );
});
