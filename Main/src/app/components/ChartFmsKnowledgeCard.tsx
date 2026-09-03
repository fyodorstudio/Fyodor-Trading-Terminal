import { BookOpen, ClipboardCopy } from "lucide-react";
import { memo, useMemo, useState } from "react";
import type { ChartMacroBiasRealtimeCardData } from "@/app/components/ChartMacroBiasRealtimeCard";
import type { MacroSignalChartPattern } from "@/app/types";

function average(pattern: MacroSignalChartPattern): number | null {
  const reviewed = pattern.executionReview?.status === "reviewed_active" ? pattern.executionReview.later : null;
  return typeof reviewed?.averageR === "number" ? reviewed.averageR : pattern.historicalBenchmark?.walkForwardAverageR ?? pattern.executionStress.overall.averageR ?? null;
}

function accuracy(pattern: MacroSignalChartPattern): number | null {
  const reviewed = pattern.executionReview?.status === "reviewed_active" ? pattern.executionReview.later : null;
  return typeof reviewed?.tpBeforeSl === "number" ? reviewed.tpBeforeSl : pattern.historicalBenchmark?.targetFirstRate ?? pattern.overall.targetHitRate ?? null;
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
] as const;

export const ChartFmsKnowledgeCard = memo(function ChartFmsKnowledgeCard({ data }: { data: ChartMacroBiasRealtimeCardData }) {
  const [copied, setCopied] = useState(false);
  const markets = data.globalResponse?.markets.filter((market) => market.supported) ?? [data.response];
  const weakened = useMemo(() => new Set((data.globalResponse?.outcomeReview?.executionReviews ?? []).filter((row) => row.status === "active_evidence_weakened").map((row) => `${row.market}:${row.patternId}`)), [data.globalResponse?.outcomeReview]);
  const patterns = useMemo(() => markets.flatMap((market) => market.patterns.filter((pattern) => pattern.currentEligible).map((pattern) => ({ market: market.symbol, pattern }))), [markets]);
  const summary = patterns.map(({ market, pattern }) => ({ market, label: pattern.label, health: health(pattern, weakened, market), average: average(pattern), accuracy: accuracy(pattern), reaction: pattern.reaction === "contrarian" ? "Historically rejected evidence" : "Historically followed evidence" }));
  const markdown = [
    "# Current FMS knowledge snapshot",
    "",
    ...FINDINGS.map(([title, detail]) => `- **${title}:** ${detail}`),
    "",
    "## Registered setup health",
    ...summary.map((row) => `- ${row.market} · ${row.label}: ${row.health}; average ${row.average == null ? "unavailable" : `${row.average >= 0 ? "+" : ""}${row.average.toFixed(2)}R`}; TP-before-SL ${row.accuracy == null ? "unavailable" : `${(row.accuracy * 100).toFixed(1)}%`}; ${row.reaction}.`),
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
        <h2>Registered setup health</h2>
        <p>Health describes the reproducibility of the registered record. It is not a promise that the next trade wins.</p>
        <table><thead><tr><th>Market and setup</th><th>Health</th><th>Average</th><th>TP before SL</th><th>Observed mapping</th></tr></thead><tbody>{summary.map((row) => <tr key={`${row.market}:${row.label}`}><td><b>{row.market}</b><span>{row.label}</span></td><td><strong className={`is-${row.health.toLowerCase()}`}>{row.health}</strong></td><td>{row.average == null ? "—" : `${row.average >= 0 ? "+" : ""}${row.average.toFixed(2)}R`}</td><td>{row.accuracy == null ? "—" : `${(row.accuracy * 100).toFixed(1)}%`}</td><td>{row.reaction}</td></tr>)}</tbody></table>
      </section>
      {data.globalResponse?.researchIntelligence?.length ? <section><h2>Tested but not registered</h2><p>Failed and unresolved findings are retained so future research does not unknowingly repeat them.</p><div className="fms-knowledge-research">{data.globalResponse.researchIntelligence.map((row) => <article key={row.id}><strong>{row.market} · {row.label} · {row.status.replaceAll("_", " ")}</strong><p>{row.conclusion}</p><small>{row.evidence}</small></article>)}</div></section> : null}
      <footer>Source: immutable FMS experiment, reaction, context, execution, and forward-observation artifacts.</footer>
    </section>
  );
});
