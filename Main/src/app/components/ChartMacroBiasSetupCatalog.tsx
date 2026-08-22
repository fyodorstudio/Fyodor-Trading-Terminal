import { BookOpen, Clock3, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MacroSignalChartPattern, MacroSignalRealtimeWatch } from "@/app/types";

type NextPatternWatch = NonNullable<MacroSignalRealtimeWatch["nextPatternWatch"]>;

function formatUtc(value: number): string {
  return `${new Date(value * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function formatPercent(value: number | null | undefined): string {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function formatR(value: number | null | undefined): string {
  return value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
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

function buildOutcomeRows(pattern: MacroSignalChartPattern, watch: NextPatternWatch): Array<[string, string]> {
  const currency = watch.events[0]?.currency ?? watch.requiredGroups[0]?.split(":")[0] ?? "EUR";
  if (pattern.direction === "both") {
    return currency === "USD"
      ? [["Registered USD evidence improves", "Short EURUSD"], ["Registered USD evidence weakens", "Long EURUSD"], ["Zero, missing, or nonmatching", "No trade"]]
      : [["Registered EUR evidence improves", "Long EURUSD"], ["Registered EUR evidence weakens", "Short EURUSD"], ["Zero, missing, or nonmatching", "No trade"]];
  }
  return [
    ["Frozen condition matches", pattern.direction === "long" ? "Long EURUSD" : "Short EURUSD"],
    ["Opposite, partial, conflicted, or zero", "No trade"],
    ["Actual is not available yet", "Wait"],
  ];
}

export function ChartMacroBiasNextSetup({
  watch,
  pattern,
  asOf,
}: {
  watch: NextPatternWatch | null;
  pattern: MacroSignalChartPattern | null;
  asOf: number;
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
    () => watch && pattern ? buildOutcomeRows(pattern, watch) : [],
    [pattern, watch],
  );

  return (
    <section className="chart-shadow-next" aria-label="Possible next registered setup">
      <div className="chart-shadow-next-heading">
        <div>
          <span><Clock3 size={14} /> Possible next setup</span>
          <small>Automatically selected from the frozen current registry</small>
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
          <p className="chart-shadow-next-condition"><b>Frozen rule:</b> {pattern.condition}</p>
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
        <div><span>Registered current setups</span><strong>{registered.length}</strong></div>
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
            <div><dt>Historical N</dt><dd>Evaluable historical releases matching this exact frozen setup.</dd></div>
            <div><dt>Target / stop first</dt><dd>How often price reached the source 2R target or stop first. The registered contract may use a different target.</dd></div>
            <div><dt>Gross average R</dt><dd>Average historical result measured in R, before spread, commission, slippage, and swap.</dd></div>
            <div><dt>Development / holdout</dt><dd>Older research sample versus the later chronological check sample.</dd></div>
            <div><dt>Recent window</dt><dd>The setup's result in the latest fixed recent-history slice.</dd></div>
            <div><dt>Positive years</dt><dd>Calendar years above 0R divided by evaluable years.</dd></div>
            <div><dt>Past-only audit</dt><dd>Cases that would have qualified using only information from earlier cases.</dd></div>
            <div><dt>1R / 1.5R / 2R</dt><dd>Gross average at each alternative target; this checks dependence on one target.</dd></div>
          </dl>
          <p>Example: with a $1,000 account risking 1%, 1R is $10. A stop loses about $10 and a 2R target gains about $20. ATR changes position size, not the chosen $10 risk.</p>
        </section>
      ) : null}
      {registered.map((pattern) => (
        <details key={pattern.id} open>
          <summary>
            <span><b>{pattern.label}</b></span>
            <strong>{pattern.execution?.targetR ?? 2}R<small>{pattern.execution?.stopAtr ?? 1} ATR · {pattern.execution?.expiryCandles ?? 30} H4</small></strong>
          </summary>
          <p className="chart-shadow-catalog-rule"><b>Frozen rule:</b> {pattern.condition}</p>
          <div className="chart-shadow-benchmark-grid">
            <div><span>Historical N</span><strong>{pattern.overall.evaluableCount}</strong></div>
            <div><span>Registered contract</span><strong>{pattern.execution?.stopAtr ?? 1} ATR stop · {pattern.execution?.targetR ?? 2}R · {pattern.execution?.expiryCandles ?? 30} H4</strong></div>
            <div><span>Source 2R target first</span><strong>{pattern.overall.targetHitCount} / {pattern.overall.evaluableCount} · {formatPercent(pattern.overall.targetHitRate)}</strong></div>
            <div><span>Source 2R stop first</span><strong>{pattern.overall.stopHitCount} / {pattern.overall.evaluableCount} · {formatPercent(pattern.overall.stopHitRate)}</strong></div>
            <div><span>Source 2R gross average</span><strong>{formatR(pattern.overall.averageR)}</strong></div>
            <div><span>Recent window</span><strong>{formatR(pattern.recentWindow.metrics.averageR)} · N {pattern.recentWindow.metrics.evaluableCount}</strong></div>
            <div><span>Positive years</span><strong>{pattern.yearStability.positiveYears}/{pattern.yearStability.evaluableYears}</strong></div>
            <div><span>Development</span><strong>{formatR(pattern.development.averageR)} · N {pattern.development.evaluableCount}</strong></div>
            <div><span>Holdout</span><strong>{formatR(pattern.holdout.averageR)} · N {pattern.holdout.evaluableCount}</strong></div>
            <div><span>Past-only audit</span><strong>{formatR(pattern.prequentialAudit.gross.averageR)} · N {pattern.prequentialAudit.evaluableCount}</strong></div>
          </div>
          <div className="chart-shadow-target-strip">
            {pattern.targetRobustness.map((target) => (
              <span key={target.targetR}><b>{target.targetR}R</b> {formatR(target.gross.averageR)} · N {target.gross.evaluableCount}</span>
            ))}
          </div>
        </details>
      ))}
    </section>
  );
}
