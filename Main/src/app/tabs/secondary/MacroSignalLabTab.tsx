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
  fetchMacroSignalForwardPaper,
  fetchMacroSignalVersions,
  startMacroSignalBacktest,
  fetchMacroSignalExpansionReport,
} from "@/app/lib/bridge";
import { MacroSignalExpansionResearch } from "@/app/components/MacroSignalExpansionResearch";
import type {
  MacroSignalBacktestRun,
  MacroSignalCoverage,
  MacroSignalForwardPaper,
  MacroSignalExpansionReport,
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

function formatCountryScope(value: Record<string, string[]> | string | undefined): string {
  if (!value) return "All EUR/USD sources (legacy v1)";
  if (typeof value === "string") return value;
  return Object.entries(value).map(([currency, countries]) => `${currency}: ${countries.join("/")}`).join(" · ");
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
  if (outcome.status === "pending") return "Monitoring";
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
                <small>{outcome.events.map((event) => `${event.currency}/${event.countryCode || "?"} ${event.title}`).join(" · ")}</small>
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
  versions?: MacroSignalVersion[];
  run: MacroSignalBacktestRun | null;
  forwardPaper?: MacroSignalForwardPaper | null;
  expansionReport?: MacroSignalExpansionReport | null;
  expansionLoading?: boolean;
  expansionError?: string | null;
  loading: boolean;
  error: string | null;
  onRun: () => void;
  onRefresh: () => void;
  onSelectVersion?: (versionId: string) => void;
  onRefreshExpansion?: () => void;
}

function versionUsesForwardLedger(version: MacroSignalVersion | null | undefined): boolean {
  return version?.configuration.historicalEligibility === "disabled_due_to_reused_history";
}

export function MacroSignalLabView({
  coverage,
  version,
  versions = version ? [version] : [],
  run,
  forwardPaper = null,
  expansionReport = null,
  expansionLoading = false,
  expansionError = null,
  loading,
  error,
  onRun,
  onRefresh,
  onSelectVersion = () => {},
  onRefreshExpansion = () => {},
}: MacroSignalLabViewProps) {
  const result = run?.result ?? null;
  const running = run?.status === "queued" || run?.status === "running";
  const highlighted = result?.targets["2.0"] ?? null;
  const runDisabled = loading || running || !coverage || coverage.count === 0;
  const isSentimentVersion = version?.id.includes("SENTIMENT") ?? false;
  const isLaborVersion = version?.id.includes("LABOR") ?? false;
  const isPolicyInflationVersion = version?.id.includes("POLICY-INFL") ?? false;
  const isGrowthVersion = version?.id.includes("GROWTH") ?? false;
  const versionNumber = isGrowthVersion ? "v7" : isPolicyInflationVersion ? "v5" : isSentimentVersion ? "v3" : isLaborVersion ? "v2" : "v1";

  return (
    <section className="macro-signal-page" data-macro-signal-lab="">
      <header className="macro-signal-header">
        <div className="min-w-0">
          <div className="macro-signal-kicker"><FlaskConical size={14} /> Active research experiment</div>
          <div className="macro-signal-title-line">
            <h2>Macro Signal Lab</h2>
            <span>EURUSD</span><span>H4</span><span>{version?.id ?? "FMS-EURUSD-ECO-H4-v1"}</span>
          </div>
          <p>{isGrowthVersion ? "Country-aware Growth research for strict GDP/output, PMI/ISM, retail-demand, and trade/current-account releases. Rules were frozen before v7 results were inspected." : isPolicyInflationVersion ? "Country-aware Policy/Inflation context research. Direct decision arrows and broad inflation arrows remain unqualified unless a frozen pattern passes every gate." : isSentimentVersion ? "Country-aware Sentiment evidence model. Reused history is exploratory; only post-registration observations can validate it." : isLaborVersion ? "Country-aware Labor evidence model. Reused history is exploratory; forward evidence starts at registration." : "Frozen Economy evidence model. Historical behavior research—not an order, guarantee, or proof of causation."}</p>
        </div>
        <button type="button" className="macro-signal-run-button" disabled={runDisabled} onClick={onRun}>
          {running ? <RefreshCw className="animate-spin" size={17} /> : <Play size={17} />}
          {running ? "Running frozen backtest" : result ? "Refresh frozen backtest" : "Run frozen backtest"}
        </button>
      </header>

      <div className="macro-signal-notice">
        <ShieldCheck size={17} />
        <strong>Gross simulation:</strong> exact historical spread, slippage, swap, and commission are unavailable. Charts v9 separates frozen current patterns from hindsight Research Replay and shows a three-pip result stress.
      </div>

      {versions.length > 1 ? (
        <div className="macro-signal-version-switch" aria-label="Research version">
          <span>Research version</span>
          {versions.map((item) => (
            <button key={item.id} type="button" className={item.id === version?.id ? "is-active" : ""} onClick={() => onSelectVersion(item.id)}>
              {item.id.includes("GROWTH") ? "v7 · Country-aware Growth" : item.id.includes("POLICY-INFL") ? "v5 · Policy / Inflation" : item.id.includes("SENTIMENT") ? "v3 · Country-aware Sentiment" : item.id.includes("LABOR") ? "v2 · Country-aware Labor" : "v1 · Economy baseline"}
            </button>
          ))}
        </div>
      ) : null}

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
              <li>{version?.id.includes("LABOR") ? "Aggregate EU and US Labor releases only." : "Equal capped Economy factor votes."}</li>
              <li>{version?.id.includes("LABOR") ? "Series identity includes country/region provenance." : "Legacy series identity uses currency and title."}</li>
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
                <div><dt>Collisions</dt><dd>{result.dataQuality.countryTitleCollisionRows ?? result.dataQuality.duplicateExactSeriesTimestampRows}</dd></div>
                <div><dt>Series key</dt><dd>{result.dataQuality.seriesIdentity ?? "currency + title (legacy v1)"}</dd></div>
                <div><dt>Country scope</dt><dd>{formatCountryScope(result.dataQuality.countryScope)}</dd></div>
              </dl>
              <p className="macro-signal-audit-note">Collisions are legitimate countries/regions sharing a currency, title, and timestamp—not duplicate ingestion. Missing values contribute nothing.</p>
              {(result.dataQuality.countryTitleCollisionGroups ?? []).length ? <details className="macro-signal-collision-details"><summary>Review collision examples</summary><div>{(result.dataQuality.countryTitleCollisionGroups ?? []).slice(0, 12).map((row) => <div key={`${row.currency}-${row.normalizedTitle}-${row.time}`}><strong>{row.title}</strong><span>{row.countryCodes.join(" / ")}</span></div>)}</div></details> : null}
            </section>
          ) : null}
        </aside>

        <main className="macro-signal-results">
          <MacroSignalExpansionResearch
            report={expansionReport}
            loading={expansionLoading}
            error={expansionError}
            onRefresh={onRefreshExpansion}
          />
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
                  <div className="macro-signal-section-title"><ShieldCheck size={16} /><h3>What {versionNumber} means</h3><span>Plain-language decision</span></div>
                  <div className="macro-signal-verdict-grid">
                    <div><span>1 · Build</span><strong>Development {formatR(result.conclusion.developmentAverageR)}</strong><p>The older 70% was used to observe how the frozen rule behaved.</p></div>
                    <div><span>2 · Check</span><strong>Holdout {formatR(result.conclusion.holdoutAverageR)}</strong><p>The newer 30% checked whether that behavior survived later data.</p></div>
                    <div className={result.conclusion.code === "eligible_for_paper_validation" || result.conclusion.code === "forward_paper_validated" ? "is-eligible" : "is-rejected"}><span>3 · Decision</span><strong>{result.conclusion.title}</strong><p>{result.conclusion.summary}</p></div>
                  </div>
                  <div className="macro-signal-verdict-foot">
                    <span>Holdout uncertainty: {formatRange(result.conclusion.holdoutExpectancyCi95)}</span>
                    <span>Chart indicator: {isGrowthVersion ? "v9 current source + explicit Research Replay" : isPolicyInflationVersion ? "v9 context + failed-gate replay only" : isLaborVersion || isSentimentVersion ? "v9 current source + explicit Research Replay" : result.conclusion.code === "forward_paper_validated" ? "Pending cost-model and product review" : "Not allowed"}</span>
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

              {result.status === "exploratory_reused_history" ? (
                <section className="macro-signal-panel macro-signal-forward">
                  <div className="macro-signal-section-title"><Clock3 size={16} /><h3>Automatic forward paper ledger</h3><span>Immutable first-seen releases only</span></div>
                  <div className="macro-signal-forward-grid">
                    <div><span>Activated</span><strong>{formatTimestamp(forwardPaper?.activatedAt)}</strong></div>
                    <div><span>Elapsed</span><strong>{forwardPaper?.elapsedDays ?? 0} / 365 days</strong></div>
                    <div><span>Frozen releases</span><strong>{forwardPaper?.observationCount ?? 0}</strong></div>
                    <div><span>Paper cases</span><strong>{forwardPaper?.caseCount ?? 0}</strong></div>
                    <div><span>Monitoring</span><strong>{forwardPaper?.monitoringCount ?? 0}</strong></div>
                    <div><span>2R evaluable</span><strong>{forwardPaper?.targets["2.0"]?.evaluableCount ?? 0} / 100</strong></div>
                    <div><span>2R average</span><strong>{formatR(forwardPaper?.targets["2.0"]?.averageR ?? null)}</strong></div>
                    <div><span>EA cycle</span><strong>{forwardPaper?.lastSuccessfulCycleAt ? formatTimestamp(forwardPaper.lastSuccessfulCycleAt) : "Waiting for upgraded EA"}</strong></div>
                    <div><span>Ledger integrity</span><strong>{forwardPaper?.immutable ? "First-seen locked" : "Unavailable"}</strong></div>
                  </div>
                  <p>The EA records candidates automatically after each complete upload cycle. Historical rows, late-seen releases, and later broker revisions cannot retroactively improve this evidence.</p>
                  {forwardPaper?.recentCases.length ? (
                    <details className="macro-signal-forward-cases">
                      <summary>Recent forward cases <span>{forwardPaper.recentCases.length}</span></summary>
                      <div>{forwardPaper.recentCases.map((paperCase) => (
                        <div key={paperCase.eventTime}>
                          <strong>{formatTimestamp(paperCase.eventTime)}</strong>
                          <span>{paperCase.candidate.direction === "long" ? "Long bias" : paperCase.candidate.direction === "short" ? "Short bias" : "No direction"}</span>
                          <span>{paperCase.state.replaceAll("_", " ")}</span>
                          <span>{paperCase.candidate.events.map((event) => event.title).join(" · ")}</span>
                        </div>
                      ))}</div>
                    </details>
                  ) : null}
                </section>
              ) : null}

              <section className="macro-signal-overview macro-signal-panel">
                <div className="macro-signal-result-heading">
                  <div>
                    <span className="macro-signal-kicker">Overall model · highlighted 2R</span>
                    <h3>{result.status === "eligible_for_paper_validation" ? "Eligible for paper validation" : result.status === "exploratory_reused_history" ? "Exploratory reused history" : "Research evidence only"}</h3>
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
  const [versions, setVersions] = useState<MacroSignalVersion[]>([]);
  const [run, setRun] = useState<MacroSignalBacktestRun | null>(null);
  const [forwardPaper, setForwardPaper] = useState<MacroSignalForwardPaper | null>(null);
  const [expansionReport, setExpansionReport] = useState<MacroSignalExpansionReport | null>(null);
  const [expansionLoading, setExpansionLoading] = useState(true);
  const [expansionError, setExpansionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMacroSignalCoverage(), fetchMacroSignalVersions()])
      .then(async ([nextCoverage, nextVersions]) => {
        const nextVersion = nextVersions.find((item) => item.active) ?? nextVersions[nextVersions.length - 1] ?? null;
        const nextRun = nextVersion ? await fetchLatestMacroSignalBacktest(nextVersion.id) : null;
        const nextForward = versionUsesForwardLedger(nextVersion) ? await fetchMacroSignalForwardPaper(nextVersion.id) : null;
        if (cancelled) return;
        setCoverage(nextCoverage);
        setVersions(nextVersions);
        setVersion(nextVersion);
        setRun(nextRun);
        setForwardPaper(nextForward);
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

  const refreshExpansionReport = () => {
    setExpansionLoading(true);
    setExpansionError(null);
    fetchMacroSignalExpansionReport()
      .then(setExpansionReport)
      .catch((loadError: unknown) => setExpansionError(loadError instanceof Error ? loadError.message : "Path research could not load"))
      .finally(() => setExpansionLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    setExpansionLoading(true);
    fetchMacroSignalExpansionReport()
      .then((next) => { if (!cancelled) setExpansionReport(next); })
      .catch((loadError: unknown) => { if (!cancelled) setExpansionError(loadError instanceof Error ? loadError.message : "Path research could not load"); })
      .finally(() => { if (!cancelled) setExpansionLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const versionId = version?.id;
    if (!versionId || !versionUsesForwardLedger(version)) {
      setForwardPaper(null);
      return;
    }
    let cancelled = false;
    const refreshForward = () => {
      fetchMacroSignalForwardPaper(versionId)
        .then((next) => { if (!cancelled) setForwardPaper(next); })
        .catch(() => { /* Historical research remains usable if forward polling is temporarily unavailable. */ });
    };
    refreshForward();
    const timer = window.setInterval(refreshForward, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [version?.id]);

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
    if (!version) return;
    setError(null);
    setLoading(true);
    startMacroSignalBacktest(version.id)
      .then(setRun)
      .catch((runError: unknown) => setError(runError instanceof Error ? runError.message : "Backtest could not start"))
      .finally(() => setLoading(false));
  };

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    Promise.all([fetchMacroSignalCoverage(), fetchMacroSignalVersions(), version ? fetchLatestMacroSignalBacktest(version.id) : Promise.resolve(null), version && versionUsesForwardLedger(version) ? fetchMacroSignalForwardPaper(version.id) : Promise.resolve(null)])
      .then(([nextCoverage, nextVersions, nextRun, nextForward]) => {
        setCoverage(nextCoverage);
        setVersions(nextVersions);
        setVersion((current) => nextVersions.find((item) => item.id === current?.id) ?? nextVersions.find((item) => item.active) ?? null);
        setRun(nextRun);
        setForwardPaper(nextForward);
      })
      .catch((refreshError: unknown) => setError(refreshError instanceof Error ? refreshError.message : "Research state could not refresh"))
      .finally(() => setLoading(false));
  };

  const handleSelectVersion = (versionId: string) => {
    const nextVersion = versions.find((item) => item.id === versionId);
    if (!nextVersion || nextVersion.id === version?.id) return;
    setVersion(nextVersion);
    setRun(null);
    setForwardPaper(null);
    setLoading(true);
    setError(null);
    fetchLatestMacroSignalBacktest(versionId)
      .then(setRun)
      .catch((selectError: unknown) => setError(selectError instanceof Error ? selectError.message : "Research version could not load"))
      .finally(() => setLoading(false));
  };

  return <MacroSignalLabView coverage={coverage} version={version} versions={versions} run={run} forwardPaper={forwardPaper} expansionReport={expansionReport} expansionLoading={expansionLoading} expansionError={expansionError} loading={loading} error={error} onRun={handleRun} onRefresh={handleRefresh} onSelectVersion={handleSelectVersion} onRefreshExpansion={refreshExpansionReport} />;
}
