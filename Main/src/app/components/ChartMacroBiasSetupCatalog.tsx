import { BookOpen, ChevronDown, Clock3, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatUtcDisplayDateTime } from "@/app/lib/format";
import type { MacroSignalChartPattern, MacroSignalRealtimeWatch } from "@/app/types";

type NextPatternWatch = NonNullable<MacroSignalRealtimeWatch["nextPatternWatch"]>;

function formatUtc(value: number): string {
  return formatUtcDisplayDateTime(value);
}

function formatPercent(value: number | null | undefined): string {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function formatR(value: number | null | undefined): string {
  return value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

export function macroSignalSetupCredibility(pattern: MacroSignalChartPattern): { label: "Strong" | "Moderate" | "Fragile" | "Unproven"; detail: string } {
  const benchmark = pattern.historicalBenchmark;
  if (pattern.readiness?.auditStatus !== "complete" || !benchmark || benchmark.walkForwardAverageR <= 0) {
    return { label: "Unproven", detail: "The immutable audit is incomplete or later-test average R is not positive." };
  }
  if (benchmark.strength === "positive_but_fragile" || benchmark.walkForwardN < 20 || pattern.yearStability.evaluableYears < 5) {
    return { label: "Fragile", detail: "Positive later history, but sample, represented years, stability, or uncertainty remains weak." };
  }
  if (
    benchmark.walkForwardN >= 60
    && benchmark.walkForwardAverageR >= .15
    && pattern.yearStability.evaluableYears >= 8
    && pattern.yearStability.positiveYearShare >= .65
    && (pattern.reactionAudit?.evaluableN ?? 0) >= 30
    && pattern.uncertaintyIncludesNoEdge === false
  ) {
    return { label: "Strong", detail: "Stronger positive later history across sample, years, direction audit, and uncertainty checks." };
  }
  return { label: "Moderate", detail: "Verified positive later history, with one or more strength checks below the Strong threshold." };
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Awaiting released Actual";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  return [
    days > 0 ? `${days}d` : null,
    `${String(hours).padStart(2, "0")}h`,
    `${String(minutes).padStart(2, "0")}m`,
    `${String(remainingSeconds).padStart(2, "0")}s`,
  ].filter(Boolean).join(" ");
}

function buildOutcomeRows(pattern: MacroSignalChartPattern, watch: NextPatternWatch, symbol: string): Array<[string, string]> {
  const currency = watch.events[0]?.currency ?? watch.requiredGroups[0]?.split(":")[0] ?? "EUR";
  if (pattern.direction === "both") {
    const improvingAction = symbol.startsWith(currency) ? `Long ${symbol}` : `Short ${symbol}`;
    const weakeningAction = symbol.startsWith(currency) ? `Short ${symbol}` : `Long ${symbol}`;
    return [
      [`Registered ${currency} evidence improves`, improvingAction],
      [`Registered ${currency} evidence weakens`, weakeningAction],
      ["Zero, missing, or nonmatching", "No trade"],
    ];
  }
  return [
    ["Frozen condition matches", pattern.direction === "long" ? `Long ${symbol}` : `Short ${symbol}`],
    ["Opposite, partial, conflicted, or zero", "No trade"],
    ["Actual is not available yet", "Wait"],
  ];
}

export function ChartMacroBiasNextSetup({
  watch,
  pattern,
  asOf,
  symbol,
}: {
  watch: NextPatternWatch | null;
  pattern: MacroSignalChartPattern | null;
  asOf: number;
  symbol: string;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (!watch) return undefined;
    const startedAt = Date.now();
    const update = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1_000)));
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [asOf, watch?.time]);

  const outcomeRows = useMemo(
    () => watch && pattern ? buildOutcomeRows(pattern, watch, symbol) : [],
    [pattern, symbol, watch],
  );

  return (
    <section className="chart-shadow-next" aria-label="Possible next registered setup">
      <div className="chart-shadow-next-heading">
        <div>
          <span><Clock3 size={14} /> Possible next setup</span>
          <small>Automatically selected from registered setups</small>
        </div>
        {watch ? <strong>{formatCountdown(Math.max(0, watch.time - (asOf + elapsedSeconds)))}</strong> : null}
      </div>
      {watch && pattern ? (
        <>
          <div className="chart-shadow-next-identity">
            <div><span>Release time</span><strong>{formatUtc(watch.time)}</strong></div>
            <div><span>Registered setup</span><strong>{pattern.label}</strong></div>
            <p>{watch.events.map((event) => `${event.currency} · ${event.title}`).join(" + ")}</p>
          </div>
          <div className="chart-shadow-trigger-plan">
            {outcomeRows.map(([evidence, action]) => (
              <div key={evidence}><span>{evidence}</span><strong>{action}</strong></div>
            ))}
          </div>
          <p className="chart-shadow-next-condition"><b>Trade rule:</b> {pattern.condition}</p>
        </>
      ) : <p>No registered setup is scheduled in the loaded calendar window.</p>}
    </section>
  );
}

export function ChartMacroBiasSetupCatalog({ patterns }: { patterns: MacroSignalChartPattern[] }) {
  const [guideOpen, setGuideOpen] = useState(false);
  const registered = useMemo(
    () => [...patterns].filter((pattern) => pattern.currentEligible).sort((left, right) => left.label.localeCompare(right.label)),
    [patterns],
  );
  return (
    <section className="chart-shadow-catalog" aria-label="Registered current setup benchmarks">
      <div className="chart-shadow-catalog-heading">
        <div><span>Registered setups</span><strong>{registered.length}</strong></div>
        <div className="chart-shadow-catalog-actions">
          <small>Frozen gross historical benchmarks—not guaranteed win rates</small>
          <button type="button" onClick={() => setGuideOpen((open) => !open)} aria-expanded={guideOpen} aria-controls="chart-shadow-score-guide">
            {guideOpen ? <X size={12} /> : <BookOpen size={12} />} {guideOpen ? "Close guide" : "How to read"}
          </button>
        </div>
      </div>
      {guideOpen ? (
        <section id="chart-shadow-score-guide" className="chart-shadow-score-guide" aria-label="How to read FMS setup benchmarks">
          <h4>Stops, targets, and time</h4>
          <dl>
            <div><dt>ATR</dt><dd>Average H4 movement over the previous 14 completed H4 candles.</dd></div>
            <div><dt>1 / 2 ATR</dt><dd>The stop is one or two ATR from entry. A wider stop produces a smaller position for the same dollar risk.</dd></div>
            <div><dt>R</dt><dd>Your initial risk. A stop is about −1R; a 1R, 1.25R, or 2R target pays that multiple of the risk.</dd></div>
            <div><dt>6 / 18 / 30 H4</dt><dd>Maximum completed H4 candles before an unresolved trade expires.</dd></div>
          </dl>
          <h4>Benchmark boxes</h4>
          <dl>
            <div><dt>All matching events</dt><dd>Past releases that matched this exact setup.</dd></div>
            <div><dt>TP / SL first</dt><dd>How often the registered trade rules reached take profit or stop loss first.</dd></div>
            <div><dt>Average per trade</dt><dd>Average historical result measured in R, before spread, commission, slippage, and swap.</dd></div>
            <div><dt>Later test trades</dt><dd>Trades from the later part of history used to check whether the pattern continued.</dd></div>
            <div><dt>Direction worked after 6 H4</dt><dd>How often price was in this registered recipe&apos;s direction six H4 candles after entry. It is separate from TP/SL.</dd></div>
            <div><dt>Worked, but trade lost</dt><dd>Price was in the registered direction after six H4 candles, but the exact SL/TP/duration contract still finished without a profit.</dd></div>
            <div><dt>1R / 1.5R / 2R</dt><dd>Gross average at each alternative target; this checks dependence on one target.</dd></div>
          </dl>
          <h4>Historical credibility</h4>
          <dl>
            <div><dt>Strong</dt><dd>Verified, at least 60 later trades, +0.15R average, 8 represented years with at least 65% positive, at least 30 direction-audit cases, and an uncertainty interval that excludes zero.</dd></div>
            <div><dt>Moderate</dt><dd>Verified positive later history that does not satisfy every Strong threshold.</dd></div>
            <div><dt>Fragile</dt><dd>Positive history with a fragile registry flag, fewer than 20 later trades, or fewer than 5 represented years.</dd></div>
            <div><dt>Unproven</dt><dd>The immutable audit is incomplete or later-test average R is not positive.</dd></div>
          </dl>
          <p>Credibility summarizes historical evidence only. Live validation and real execution costs remain separate and can keep a setup ineligible for live use.</p>
          <p>Example: with a $1,000 account risking 1%, 1R is $10. A stop loses about $10 and a 2R target gains about $20. ATR changes position size, not the chosen $10 risk.</p>
        </section>
      ) : null}
      {registered.map((pattern) => {
        const credibility = macroSignalSetupCredibility(pattern);
        return (
        <details key={`${pattern.market ?? "EURUSD"}:${pattern.id}`} open={registered.length <= 4}>
          <summary>
            <span><b>{pattern.label}</b></span>
            <strong>{pattern.execution?.targetR ?? 2}R<small>{pattern.execution?.stopAtr ?? 1} ATR · {pattern.execution?.expiryCandles ?? 30} H4</small></strong>
            <em className="chart-shadow-disclosure-cue">View details <ChevronDown size={13} /></em>
          </summary>
          <p className="chart-shadow-catalog-rule"><b>Trade rule:</b> {pattern.condition}</p>
          <section className={`chart-shadow-credibility is-${credibility.label.toLowerCase()}`} aria-label={`${pattern.label} historical credibility`}>
            <div><span>Historical credibility</span><strong>{credibility.label}</strong></div>
            <p>{credibility.detail} This is a historical evidence rating, not permission to follow the setup blindly.</p>
          </section>
          <div className="chart-shadow-benchmark-grid">
            <div><span>All matching events</span><strong>{pattern.historicalBenchmark?.historicalN ?? pattern.overall.evaluableCount}</strong></div>
            <div><span>Trade rules</span><strong>SL {pattern.execution?.stopAtr ?? 1} ATR · TP {pattern.execution?.targetR ?? 2}R · {pattern.execution?.expiryCandles ?? 30} H4</strong></div>
            {pattern.historicalBenchmark ? (
              <>
                <div><span>Later test trades</span><strong>{pattern.historicalBenchmark.walkForwardN}</strong></div>
                <div><span>TP before SL</span><strong>{formatPercent(pattern.historicalBenchmark.targetFirstRate)}</strong></div>
                <div><span>SL before TP</span><strong>{formatPercent(pattern.historicalBenchmark.stopFirstRate)}</strong></div>
                <div><span>Average per trade</span><strong>{formatR(pattern.historicalBenchmark.walkForwardAverageR)}</strong></div>
                <div><span>Positive years</span><strong>{pattern.yearStability.positiveYears} / {pattern.yearStability.evaluableYears}</strong></div>
                <div><span>Uncertainty</span><strong>{pattern.uncertaintyIncludesNoEdge ? "Still includes no edge" : "Positive interval"}</strong></div>
                <div><span>Live evidence</span><strong>{pattern.readiness?.liveStatus === "not_live_validated" ? "Not live validated" : pattern.readiness?.liveStatus ?? "Unavailable"}</strong></div>
                <div><span>Execution costs</span><strong>Spread, commission, slippage, and swap excluded</strong></div>
                <div><span>Backtest record</span><strong>{pattern.historicalBenchmark.experimentId}</strong></div>
                {pattern.reactionAudit ? (
                  <>
                    <div><span>Direction worked after {pattern.reactionAudit.horizonCandles} H4</span><strong>{formatPercent(pattern.reactionAudit.positiveResponseRate)}</strong></div>
                    <div><span>Direction worked + trade profited</span><strong>{pattern.reactionAudit.directionWorkedTradeProfited} / {pattern.reactionAudit.evaluableN}</strong></div>
                    <div><span>Direction worked + trade lost</span><strong>{pattern.reactionAudit.directionWorkedTradeLost} / {pattern.reactionAudit.evaluableN}</strong></div>
                    <div><span>Direction failed + trade profited</span><strong>{pattern.reactionAudit.directionFailedTradeProfited} / {pattern.reactionAudit.evaluableN}</strong></div>
                    <div><span>Direction failed + trade lost</span><strong>{pattern.reactionAudit.directionFailedTradeLost} / {pattern.reactionAudit.evaluableN}</strong></div>
                    <div><span>Median {pattern.reactionAudit.horizonCandles}-H4 response</span><strong>{formatR(pattern.reactionAudit.medianResponseR)}</strong></div>
                  </>
                ) : null}
              </>
            ) : <><div><span>Benchmark status</span><strong>Archived snapshot</strong></div><div><span>Exact contract metrics</span><strong>Not linked</strong></div></>}
          </div>
          {pattern.reactionAudit ? <p className="chart-shadow-reaction-note"><b>Direction and execution are separate:</b> the six-H4 response checks whether price moved in this registered recipe&apos;s direction; TP/SL and average R judge whether its frozen trade rules captured that movement.</p> : null}
          {pattern.registrationProvenance ? <p className={`chart-shadow-provenance is-${pattern.registrationProvenance.status}`}><b>{pattern.registrationProvenance.status === "verified" ? "Backtest record verified" : pattern.registrationProvenance.status === "mismatch" ? "Backtest mismatch" : pattern.registrationProvenance.status === "unavailable" ? "Backtest unavailable" : "Older saved setup"}:</b> {pattern.registrationProvenance.note}</p> : null}
        </details>
      )})}
    </section>
  );
}
