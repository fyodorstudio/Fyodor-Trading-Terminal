import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Beaker,
  CheckCircle2,
  Clock3,
  Database,
  FlaskConical,
  Play,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  fetchLatestMacroSignalBacktest,
  fetchMacroSignalBacktest,
  fetchMacroSignalCoverage,
  fetchMacroSignalVersion,
  startMacroSignalBacktest,
} from "@/app/lib/bridge";
import type {
  MacroSignalBacktestRun,
  MacroSignalCoverage,
  MacroSignalMetrics,
  MacroSignalOutcome,
  MacroSignalVersion,
} from "@/app/types";

const TARGET_KEYS = ["1.0", "1.5", "2.0"] as const;

function formatTimestamp(value: number | null | undefined): string {
  if (value == null) return "Not available";
  return new Date(value * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function formatPercent(value: number | null): string {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function formatR(value: number | null): string {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function formatRange(value: { lower: number; upper: number } | null | undefined): string {
  if (!value) return "—";
  return `${formatR(value.lower)} to ${formatR(value.upper)}`;
}

function formatPrice(value: number | undefined): string {
  return value == null ? "—" : value.toFixed(5);
}

function resultLabel(outcome: MacroSignalOutcome): string {
  if (outcome.status === "target_hit") return "Target first";
  if (outcome.status === "stop_hit") return "Stop first";
  if (outcome.status === "expired") return "Expired";
  if (outcome.status === "ambiguous") return "Both touched — order unknown";
  if (outcome.status === "no_direction") return "No direction";
  return "Unevaluable";
}

function MetricsGrid({ metrics }: { metrics: MacroSignalMetrics }) {
  const cells = [
    ["Evaluable", String(metrics.evaluableCount)],
    ["Target first", formatPercent(metrics.targetHitRate)],
    ["Stop first", formatPercent(metrics.stopHitRate)],
    ["Expired", formatPercent(metrics.expiredRate)],
    ["Average", formatR(metrics.averageR)],
    ["Ambiguous", String(metrics.ambiguousCount)],
  ];
  return (
    <div className="macro-signal-metrics-grid">
      {cells.map(([label, value]) => (
        <div key={label} className="macro-signal-metric">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function OutcomeTable({ outcomes }: { outcomes: MacroSignalOutcome[] }) {
  const rows = useMemo(
    () => [...outcomes].sort((left, right) => right.eventTime - left.eventTime),
    [outcomes],
  );
  return (
    <div className="macro-signal-table-scroll">
      <table className="macro-signal-table">
        <thead>
          <tr>
            <th>Release package</th>
            <th>Bias</th>
            <th>Evidence</th>
            <th>Entry</th>
            <th>Stop</th>
            <th>2R target</th>
            <th>Outcome</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((outcome) => (
            <tr key={`${outcome.eventTime}-${outcome.targetR}`}>
              <td>
                <strong>{formatTimestamp(outcome.eventTime)}</strong>
                <small>{outcome.events.map((event) => `${event.currency} ${event.title}`).join(" · ")}</small>
              </td>
              <td><strong>{outcome.direction === "long" ? "Long bias" : outcome.direction === "short" ? "Short bias" : "No direction"}</strong></td>
              <td title={`Before evidence: ${outcome.backgroundAlignment}`}>{outcome.agreement === "consensus" ? "Consensus" : outcome.agreement === "conflicted_weak" ? "Conflicted / weak" : "Exact tie"}</td>
              <td>{formatPrice(outcome.entry)}</td>
              <td>{formatPrice(outcome.stop)}</td>
              <td>{formatPrice(outcome.target)}</td>
              <td title={outcome.reason}>{resultLabel(outcome)}</td>
              <td><strong>{formatR(outcome.resultR)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface MacroSignalLabViewProps {
  coverage: MacroSignalCoverage | null;
  version: MacroSignalVersion | null;
  run: MacroSignalBacktestRun | null;
  loading: boolean;
  error: string | null;
  onRun: () => void;
  onRefresh: () => void;
}

export function MacroSignalLabView({
  coverage,
  version,
  run,
  loading,
  error,
  onRun,
  onRefresh,
}: MacroSignalLabViewProps) {
  const result = run?.result ?? null;
  const running = run?.status === "queued" || run?.status === "running";
  const highlighted = result?.targets["2.0"] ?? null;
  const runDisabled = loading || running || !coverage || coverage.count === 0;

  return (
    <section className="macro-signal-page" data-macro-signal-lab="">
      <header className="macro-signal-header">
        <div className="min-w-0">
          <div className="macro-signal-kicker"><FlaskConical size={14} /> Active research experiment</div>
          <div className="macro-signal-title-line">
            <h2>Macro Signal Lab</h2>
            <span>EURUSD</span><span>H4</span><span>{version?.id ?? "FMS-EURUSD-ECO-H4-v1"}</span>
          </div>
          <p>Frozen Economy evidence model. Historical behavior research—not an order, guarantee, or proof of causation.</p>
        </div>
        <button type="button" className="macro-signal-run-button" disabled={runDisabled} onClick={onRun}>
          {running ? <RefreshCw className="animate-spin" size={17} /> : <Play size={17} />}
          {running ? "Running frozen backtest" : result ? "Refresh frozen backtest" : "Run frozen backtest"}
        </button>
      </header>

      <div className="macro-signal-notice">
        <ShieldCheck size={17} />
        <strong>Gross simulation:</strong> spread, slippage, swap, and commission are excluded. Chart arrows remain disabled.
      </div>

      {error ? <div className="macro-signal-error"><AlertTriangle size={18} />{error}</div> : null}

      <div className="macro-signal-body">
        <aside className="macro-signal-sidebar">
          <section className="macro-signal-panel">
            <div className="macro-signal-section-title">
              <Database size={16} /><h3>Durable coverage</h3>
              <button type="button" className="macro-signal-refresh-button" onClick={onRefresh} disabled={loading} aria-label="Refresh Macro Signal coverage"><RefreshCw size={13} className={loading ? "animate-spin" : ""} /></button>
            </div>
            <dl className="macro-signal-definition-list">
              <div><dt>Rows</dt><dd>{coverage?.count ?? 0}</dd></div>
              <div><dt>Earliest</dt><dd>{formatTimestamp(coverage?.earliest)}</dd></div>
              <div><dt>Latest</dt><dd>{formatTimestamp(coverage?.latest)}</dd></div>
              <div><dt>Storage</dt><dd>{coverage?.durable ? "SQLite / persistent" : "Unavailable"}</dd></div>
              {result ? <div><dt>H4 prices</dt><dd>{result.priceCoverage.count} candles</dd></div> : null}
              {result ? <div><dt>H4 primary</dt><dd>{result.priceCoverage.coversPrimaryWindow ? "Covered" : "Incomplete"}</dd></div> : null}
            </dl>
          </section>

          {coverage?.backfillRecommended ? (
            <section className="macro-signal-panel macro-signal-backfill">
              <div className="macro-signal-section-title"><Clock3 size={16} /><h3>Historical backfill needed</h3></div>
              <p>Run one controlled MT5 import now that durable storage exists.</p>
              <ol>
                <li><code>CurrenciesList = "{coverage.recommendedBackfill.currenciesList}"</code></li>
                <li><code>LookBackDays = {coverage.recommendedBackfill.lookBackDays}</code></li>
                <li><code>MaxEventsPerCur = {coverage.recommendedBackfill.maxEventsPerCurrency}</code></li>
                <li>Wait for <code>failed_batches=0</code>, verify coverage here, then restore the normal currency list, <code>LookBackDays = {coverage.recommendedBackfill.restoreLookBackDays}</code>, and <code>MaxEventsPerCur = 1000</code>.</li>
              </ol>
            </section>
          ) : null}

          <section className="macro-signal-panel">
            <div className="macro-signal-section-title"><Beaker size={16} /><h3>Frozen method</h3></div>
            <ul className="macro-signal-compact-list">
              <li>One candidate per exact release-time package.</li>
              <li>Equal capped Economy factor votes.</li>
              <li>Entry at the first strictly later H4 open.</li>
              <li>ATR(14) Wilder stop; 30-H4-candle expiry.</li>
              <li>M1 resolves same-H4 target/stop order.</li>
            </ul>
            <div className="macro-signal-hash" title={version?.hash}>Version hash {version?.hash?.slice(0, 12) ?? "loading"}</div>
          </section>

          {result?.dataQuality ? (
            <section className="macro-signal-panel">
              <div className="macro-signal-section-title"><Database size={16} /><h3>Data-quality audit</h3></div>
              <dl className="macro-signal-definition-list">
                <div><dt>EUR/USD rows</dt><dd>{result.dataQuality.pairRows}</dd></div>
                <div><dt>Economy rows</dt><dd>{result.dataQuality.registeredEconomyRows}</dd></div>
                <div><dt>Scored rows</dt><dd>{result.dataQuality.scoredEconomyRows}</dd></div>
                <div><dt>Packages</dt><dd>{result.dataQuality.candidatePackages}</dd></div>
                <div><dt>Missing A</dt><dd>{result.dataQuality.missingActualRows}</dd></div>
                <div><dt>Missing F</dt><dd>{result.dataQuality.missingForecastRows}</dd></div>
                <div><dt>Missing P</dt><dd>{result.dataQuality.missingPreviousRows}</dd></div>
                <div><dt>Duplicates</dt><dd>{result.dataQuality.duplicateExactSeriesTimestampRows}</dd></div>
              </dl>
              <p className="macro-signal-audit-note">Missing values contribute nothing. Unregistered rows remain outside v1 rather than being guessed into a factor.</p>
            </section>
          ) : null}
        </aside>

        <main className="macro-signal-results">
          {loading && !run ? (
            <div className="macro-signal-empty"><RefreshCw className="animate-spin" /><strong>Loading research state</strong></div>
          ) : running ? (
            <div className="macro-signal-empty"><RefreshCw className="animate-spin" /><strong>Building the frozen historical simulation</strong><span>MT5 H4 history is loaded first; M1 is requested only for ambiguous H4 bars.</span></div>
          ) : run?.status === "failed" ? (
            <div className="macro-signal-empty"><AlertTriangle /><strong>Backtest could not finish</strong><span>{run.error}</span></div>
          ) : !result ? (
            <div className="macro-signal-empty"><Beaker /><strong>No frozen backtest result yet</strong><span>{coverage?.count ? "Run the model when MT5 is connected." : "Complete the durable calendar backfill first."}</span></div>
          ) : (
            <>
              {result.conclusion ? (
                <section className="macro-signal-panel macro-signal-verdict">
                  <div className="macro-signal-section-title"><ShieldCheck size={16} /><h3>What v1 means</h3><span>Plain-language decision</span></div>
                  <div className="macro-signal-verdict-grid">
                    <div><span>1 · Build</span><strong>Development {formatR(result.conclusion.developmentAverageR)}</strong><p>The older 70% was used to observe how the frozen rule behaved.</p></div>
                    <div><span>2 · Check</span><strong>Holdout {formatR(result.conclusion.holdoutAverageR)}</strong><p>The newer 30% checked whether that behavior survived later data.</p></div>
                    <div className={result.conclusion.code === "eligible_for_paper_validation" ? "is-eligible" : "is-rejected"}><span>3 · Decision</span><strong>{result.conclusion.title}</strong><p>{result.conclusion.summary}</p></div>
                  </div>
                  <div className="macro-signal-verdict-foot">
                    <span>Holdout uncertainty: {formatRange(result.conclusion.holdoutExpectancyCi95)}</span>
                    <span>Chart indicator: {result.conclusion.code === "eligible_for_paper_validation" ? "Still disabled until paper validation" : "Not allowed"}</span>
                  </div>
                  {result.conclusion.exploratoryFactorLeads.length ? (
                    <div className="macro-signal-research-leads">
                      <strong>Ideas worth researching next—not proven signals</strong>
                      <div>{result.conclusion.exploratoryFactorLeads.map((lead) => <span key={lead.key}>{lead.key}: development {formatR(lead.developmentAverageR)}, holdout {formatR(lead.holdoutAverageR)}</span>)}</div>
                      <small>{result.conclusion.selectionWarning}</small>
                    </div>
                  ) : null}
                </section>
              ) : null}

              <section className="macro-signal-overview macro-signal-panel">
                <div className="macro-signal-result-heading">
                  <div>
                    <span className="macro-signal-kicker">Overall model · highlighted 2R</span>
                    <h3>{result.status === "eligible_for_paper_validation" ? "Eligible for paper validation" : "Research evidence only"}</h3>
                    <p>Chronological holdout begins {formatTimestamp(result.candidateSummary.developmentHoldoutBoundary)}.</p>
                  </div>
                  <div className="macro-signal-headline-number">
                    <span>Holdout target-first</span>
                    <strong>{formatPercent(highlighted?.holdout.targetHitRate ?? null)}</strong>
                    <small>{highlighted?.holdout.evaluableCount ?? 0} evaluable cases</small>
                  </div>
                </div>
                {highlighted ? <MetricsGrid metrics={highlighted.holdout} /> : null}
              </section>

              <section className="macro-signal-target-grid">
                {TARGET_KEYS.map((key) => {
                  const target = result.targets[key];
                  return (
                    <article key={key} className={`macro-signal-panel macro-signal-target ${key === "2.0" ? "is-highlighted" : ""}`}>
                      <div><span>{key.replace(".0", "")}R target</span>{key === "2.0" ? <b>Highlighted</b> : null}</div>
                      <strong>{formatPercent(target?.holdout.targetHitRate ?? null)}</strong>
                      <p>Holdout average {formatR(target?.holdout.averageR ?? null)} · N {target?.holdout.evaluableCount ?? 0}</p>
                    </article>
                  );
                })}
              </section>

              <section className="macro-signal-panel">
                <div className="macro-signal-section-title"><CheckCircle2 size={16} /><h3>Paper-eligibility gate</h3></div>
                <div className="macro-signal-gate-grid">
                  {Object.entries(result.eligibility.checks).map(([key, passed]) => (
                    <div key={key} className={passed ? "is-passed" : ""}>
                      <span>{passed ? "Pass" : "Not met"}</span><strong>{key.replace(/([A-Z])/g, " $1")}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="macro-signal-panel">
                <div className="macro-signal-section-title"><h3>Time robustness · 2R</h3><span>Fixed windows, never best-picked</span></div>
                <div className="macro-signal-robustness-grid">
                  {[
                    ["Latest 5 years", result.robustness.latestFiveYears],
                    ["Earlier 5 years", result.robustness.earlierFiveYears],
                    ["Full archive", result.robustness.fullAvailable],
                  ].map(([label, metrics]) => {
                    const row = metrics as MacroSignalMetrics | undefined;
                    return <div key={label as string}><span>{label as string}</span><strong>{formatR(row?.averageR ?? null)}</strong><small>N {row?.evaluableCount ?? 0} · TP {formatPercent(row?.targetHitRate ?? null)}</small></div>;
                  })}
                </div>
                <details className="macro-signal-year-details">
                  <summary>Calendar-year stability <span>{result.robustness.byYear.length} years</span></summary>
                  <div>{result.robustness.byYear.map((row) => <div key={row.year}><strong>{row.year}</strong><span>N {row.metrics.evaluableCount}</span><span>TP {formatPercent(row.metrics.targetHitRate)}</span><span>{formatR(row.metrics.averageR)}</span></div>)}</div>
                </details>
              </section>

              <section className="macro-signal-panel macro-signal-cases-panel">
                <div className="macro-signal-section-title"><h3>2R historical cases</h3><span>{highlighted?.outcomes.length ?? 0} primary-window packages</span></div>
                <OutcomeTable outcomes={highlighted?.outcomes ?? []} />
              </section>

              <section className="macro-signal-panel">
                <div className="macro-signal-section-title"><h3>Development versus holdout</h3><span>Consistency matters more than the prettiest number</span></div>
                <div className="macro-signal-cohort-grid">
                  {(["agreement", "backgroundAlignment", "impact", "factor", "exactSeries"] as const).map((cohort) => (
                    <details key={cohort}>
                      <summary>{cohort === "exactSeries" ? "Exact series" : cohort} <span>{result.cohorts[cohort]?.length ?? 0}</span></summary>
                      <div className="macro-signal-cohort-comparison">
                        <div className="is-heading"><strong>Cohort</strong><span>Development</span><span>Holdout</span></div>
                        {(result.cohorts[cohort] ?? []).map((row) => (
                          <div key={row.key}>
                            <strong title={row.key}>{row.key}</strong>
                            <span title={`Development: N ${row.development?.evaluableCount ?? 0}; target-first ${formatPercent(row.development?.targetHitRate ?? null)}`}>{formatR(row.development?.averageR ?? null)}<small>N {row.development?.evaluableCount ?? 0}</small></span>
                            <span title={`Holdout: N ${row.holdout?.evaluableCount ?? 0}; target-first ${formatPercent(row.holdout?.targetHitRate ?? null)}`}>{formatR(row.holdout?.averageR ?? null)}<small>N {row.holdout?.evaluableCount ?? 0}</small></span>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </section>

              <section className="macro-signal-panel macro-signal-limitations">
                <div className="macro-signal-section-title"><AlertTriangle size={16} /><h3>Read before interpreting</h3></div>
                <ul>{result.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
              </section>
            </>
          )}
        </main>
      </div>
    </section>
  );
}

export function MacroSignalLabTab() {
  const [coverage, setCoverage] = useState<MacroSignalCoverage | null>(null);
  const [version, setVersion] = useState<MacroSignalVersion | null>(null);
  const [run, setRun] = useState<MacroSignalBacktestRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMacroSignalCoverage(), fetchMacroSignalVersion(), fetchLatestMacroSignalBacktest()])
      .then(([nextCoverage, nextVersion, nextRun]) => {
        if (cancelled) return;
        setCoverage(nextCoverage);
        setVersion(nextVersion);
        setRun(nextRun);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Research bridge unavailable");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!run || (run.status !== "queued" && run.status !== "running")) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      fetchMacroSignalBacktest(run.id)
        .then((nextRun) => {
          if (!cancelled) setRun(nextRun);
        })
        .catch((pollError: unknown) => {
          if (!cancelled) setError(pollError instanceof Error ? pollError.message : "Backtest polling failed");
        });
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [run?.id, run?.status]);

  const handleRun = () => {
    setError(null);
    setLoading(true);
    startMacroSignalBacktest()
      .then(setRun)
      .catch((runError: unknown) => setError(runError instanceof Error ? runError.message : "Backtest could not start"))
      .finally(() => setLoading(false));
  };

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    Promise.all([fetchMacroSignalCoverage(), fetchMacroSignalVersion(), fetchLatestMacroSignalBacktest()])
      .then(([nextCoverage, nextVersion, nextRun]) => {
        setCoverage(nextCoverage);
        setVersion(nextVersion);
        setRun(nextRun);
      })
      .catch((refreshError: unknown) => setError(refreshError instanceof Error ? refreshError.message : "Research state could not refresh"))
      .finally(() => setLoading(false));
  };

  return <MacroSignalLabView coverage={coverage} version={version} run={run} loading={loading} error={error} onRun={handleRun} onRefresh={handleRefresh} />;
}
