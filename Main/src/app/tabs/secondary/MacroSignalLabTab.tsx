import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Archive, Beaker, BookOpen, Check, Copy, Database, Download, FlaskConical, Play, RefreshCw, Snowflake } from "lucide-react";
import { createFmsExperiment, fetchFmsExperiment, fetchFmsWorkbench, freezeFmsExperiment } from "@/app/lib/bridge";
import { FmsWorkbenchTutorial } from "@/app/components/FmsWorkbenchTutorial";
import { FmsRawDataAudit } from "@/app/components/FmsRawDataAudit";
import { formatUtcDisplayDate, formatUtcDisplayDateTime } from "@/app/lib/format";
import type { FmsCatalogItem, FmsCatalogTreatment, FmsExperiment, FmsExperimentResult, FmsFrozenCandidate, FmsResearchMarket, FmsWorkbench, MacroSignalStressMetrics } from "@/app/types";

const DEFAULT_STOPS = [1, 1.5, 2];
const DEFAULT_TARGETS = [1, 1.5, 2];
const DEFAULT_HOLDING = [18, 30, 42];
const workbenchMarketCache = new Map<FmsResearchMarket, FmsWorkbench>();

function formatR(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function formatPercent(value: number | null | undefined): string {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function formatAtr(value: number | null | undefined): string {
  return value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)} ATR`;
}

function formatTime(value: number | null | undefined): string {
  return value == null ? "—" : formatUtcDisplayDateTime(value);
}

function readable(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function scoringPolicyLabel(policy: string): string {
  if (policy === "forecast_quality") return "Forecast Guard";
  if (policy === "surprise_only") return "Surprise only";
  if (policy === "momentum_only") return "Momentum only";
  if (policy === "agreement_no_bonus") return "Surprise + Momentum (no bonus)";
  if (policy === "baseline") return "Surprise + Momentum";
  return readable(policy);
}

function reactionLabel(reaction: string): string {
  return reaction === "contrarian" ? "Rejection" : "Continuation";
}

function selectionLabel(selection: string): string {
  return selection === "single_declared_contract"
    ? "Single Contract"
    : selection === "development_lower95_then_average"
      ? "Development-selected Combined Contract"
      : readable(selection);
}

function formatPeriod(period: { start: number | null; end: number | null }): { years: string; dates: string } {
  const date = (value: number | null) => value == null ? "Unavailable" : formatUtcDisplayDate(value);
  const year = (value: number | null) => value == null ? "?" : String(new Date(value * 1000).getUTCFullYear());
  return { years: `${year(period.start)} → ${year(period.end)}`, dates: `${date(period.start)} → ${date(period.end)} · UTC` };
}

function scoringPolicyExplanation(policy: "baseline" | "surprise_only" | "momentum_only" | "agreement_no_bonus" | "forecast_quality"): string {
  if (policy === "surprise_only") return "Surprise only: compare Actual with Forecast. Previous is ignored.";
  if (policy === "momentum_only") return "Momentum only: compare Actual with Previous. Forecast is ignored.";
  if (policy === "agreement_no_bonus") return "Surprise and Momentum keep equal weight, but agreeing directions receive no third bonus point.";
  if (policy === "baseline") return "Original baseline: Actual vs Forecast and Actual vs Previous receive equal weight.";
  return "Forecast Guard: use the same two comparisons, but discard the Surprise vote when the broker Forecast looks historically unreliable. Momentum remains.";
}

function cohortExplanation(treatment: FmsCatalogTreatment | null): string {
  if (!treatment || treatment.dimension === "none") return "All matching releases are included. No historical cases are filtered out.";
  return `Only the ${treatment.label.toLowerCase()} subset is included; all other matching historical releases are excluded from this experiment.`;
}

function compoundAccount(results: number[], startingBalance: number, riskPercent: number) {
  let balance = startingBalance;
  let peak = balance;
  let maximumDrawdown = 0;
  for (const result of results) {
    balance *= Math.max(0, 1 + (riskPercent / 100) * result);
    peak = Math.max(peak, balance);
    maximumDrawdown = Math.max(maximumDrawdown, peak > 0 ? (peak - balance) / peak : 0);
  }
  return { balance, maximumDrawdown };
}

function buildAiSummary(experiment: FmsExperiment): string {
  const result = experiment.result;
  if (!result) return `${experiment.id} has no completed result.`;
  const selected = result.selectedConfiguration;
  const failures = Object.entries(result.checks).filter(([, passed]) => !passed).map(([name]) => readable(name));
  return [
    `# ${experiment.id} · ${experiment.friendlyName}`,
    `- Setup: ${experiment.catalogSnapshot.label} (${(result.signatures ?? [experiment.catalogSnapshot.signature]).join(" || ")})`,
    `- Direction selection: ${readable(result.directionSelection ?? experiment.catalogSnapshot.direction)}`,
    `- Evidence: ${scoringPolicyLabel(result.scoringPolicy)}; ${result.cohort.dimension === "none" ? "all matching cases" : `${readable(result.cohort.dimension)} = ${readable(result.cohort.value)}`}; ${reactionLabel(result.reaction)}`,
    `- Contract: SL ${selected.stopAtr} ATR; TP ${selected.targetR}R = ${selected.stopAtr * selected.targetR} ATR; ${selected.holdingCandles} H4; ${result.selection}; ${result.configurationsTested} configurations`,
    `- Historical N: ${result.historicalN}`,
    `- Development: ${formatR(selected.development.stressedAverageR)} (N ${selected.development.evaluableCount})`,
    `- Holdout: ${formatR(selected.holdout.stressedAverageR)} (N ${selected.holdout.evaluableCount}; lower 95% ${formatR(selected.holdout.stressedExpectancyCi95?.lower)})`,
    `- Recent: ${formatR(selected.recent.stressedAverageR)} (N ${selected.recent.evaluableCount})`,
    `- Positive years: ${selected.yearStability.positiveYears}/${selected.yearStability.evaluableYears}`,
    `- Checks: ${failures.length ? `failed — ${failures.join(", ")}` : "all passed"}`,
    `- Configuration hash: ${experiment.configurationHash}`,
    `- Dataset fingerprint: ${experiment.datasetFingerprint}`,
    `- Caveat: reused historical research; spread, commission, slippage, and swap are excluded.`,
  ].join("\n");
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="fms-workbench-metric"><span>{label}</span><strong>{value}</strong>{detail ? <small>{detail}</small> : null}</div>;
}

function PartitionMetrics({ label, metrics }: { label: string; metrics: MacroSignalStressMetrics }) {
  return <article className="fms-result-partition"><h4>{label}</h4><div><Metric label="Average" value={formatR(metrics.stressedAverageR)} /><Metric label="N" value={String(metrics.evaluableCount)} /><Metric label="Target first" value={formatPercent(metrics.targetHitRate)} /><Metric label="Stop first" value={formatPercent(metrics.stopHitRate)} /><Metric label="Lower 95%" value={formatR(metrics.stressedExpectancyCi95?.lower)} /></div></article>;
}

function ResultPanel({ experiment, onFreeze, busy }: { experiment: FmsExperiment | null; onFreeze: (name: string, acknowledge: boolean) => void; busy: boolean }) {
  const [candidateName, setCandidateName] = useState("");
  const [acknowledge, setAcknowledge] = useState(false);
  const [startingBalance, setStartingBalance] = useState(1000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [rawOpen, setRawOpen] = useState(false);
  useEffect(() => { setCandidateName(experiment?.friendlyName ?? ""); setAcknowledge(false); }, [experiment?.id]);
  if (!experiment) return <div className="fms-workbench-empty"><Beaker size={24} /><strong>No recorded experiment selected</strong><span>Choose a signature and run a declared contract or controlled matrix.</span></div>;
  if (experiment.status === "queued" || experiment.status === "running") return <div className="fms-workbench-empty"><RefreshCw className="animate-spin" /><strong>{experiment.id} is running</strong><span>The recorded job continues in the bridge without blocking this tab.</span></div>;
  if (experiment.status === "failed") return <div className="fms-workbench-empty is-error"><AlertTriangle /><strong>{experiment.id} failed</strong><span>{experiment.error}</span></div>;
  const result = experiment.result;
  if (!result) return null;
  const selected = result.selectedConfiguration;
  const configuredContracts = experiment.configuration.execution.stopAtrValues.length
    * experiment.configuration.execution.targetRValues.length
    * experiment.configuration.execution.holdingCandles.length;
  const failed = Object.entries(result.checks).filter(([, passed]) => !passed).map(([name]) => name);
  const account = compoundAccount(result.sequentialAccount.grossResultsR ?? [], startingBalance, riskPercent);
  const copySummary = async () => { await navigator.clipboard.writeText(buildAiSummary(experiment)); };
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(experiment, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${experiment.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return <div className="fms-result-stack">
    <section className="fms-workbench-card fms-result-heading"><div><span>Recorded experiment</span><h3>{experiment.friendlyName}</h3><p>{experiment.id} · {(result.directionSelection ?? experiment.catalogSnapshot.direction).toUpperCase()} {result.market ?? experiment.configuration.market ?? experiment.catalogSnapshot.market ?? "EURUSD"} · {result.historicalN} historical cases</p></div><div className="fms-result-actions"><button type="button" onClick={() => setRawOpen(true)}><Database size={13} />View raw data</button><button type="button" onClick={copySummary}><Copy size={13} />Copy AI summary</button><button type="button" onClick={downloadJson}><Download size={13} />Download JSON</button></div></section>
    <section className="fms-workbench-card fms-recorded-recipe"><div className="fms-section-title"><h3>Recorded recipe</h3><span>Immutable configuration</span></div><div className="fms-recorded-recipe-grid"><Metric label="Economic setup" value={experiment.catalogSnapshot.label} detail={(result.signatures ?? experiment.configuration.signatures ?? [experiment.configuration.signature]).join(" | ")} /><Metric label="Direction" value={readable(result.directionSelection ?? experiment.configuration.directionSelection ?? experiment.catalogSnapshot.direction)} /><Metric label="Scoring" value={scoringPolicyLabel(result.scoringPolicy)} /><Metric label="Cases included" value={result.cohort.dimension === "none" ? "All matching releases" : `${readable(result.cohort.dimension)} · ${readable(result.cohort.value)}`} /><Metric label="Price reaction" value={reactionLabel(result.reaction)} /><Metric label="Entry" value="First strictly later H4 open" /><Metric label="Configured contracts" value={`${experiment.configuration.execution.mode === "single" ? "Single Contract" : "Combined Contracts"} · ${configuredContracts}`} /><Metric label="Highlighted contract" value={`SL ${selected.stopAtr} ATR · TP ${selected.targetR}R = ${selected.stopAtr * selected.targetR} ATR · ${selected.holdingCandles} H4`} detail={selectionLabel(result.selection)} /></div>{result.scoringPolicy === "forecast_quality" ? <p className="fms-forecast-result"><strong>{result.forecastQualityAudit.excludedForecastCount} Forecast{result.forecastQualityAudit.excludedForecastCount === 1 ? "" : "s"} flagged unreliable by Forecast Guard.</strong> Their raw values remain auditable; Surprise was excluded while Momentum remained eligible.</p> : null}</section>
    <section className="fms-workbench-card fms-evidence-answer"><div className="fms-section-title"><h3>How strong, stable, repeatable, and usable is this evidence?</h3><span>Factual research summary</span></div><div><Metric label="Strength" value={formatR(selected.overall.stressedAverageR)} detail={`${selected.overall.evaluableCount} evaluable cases`} /><Metric label="Stability" value={`${selected.yearStability.positiveYears}/${selected.yearStability.evaluableYears} positive years`} detail={`Nearby holdout positive ${formatPercent(result.configurationStability.holdout.positiveShare)}`} /><Metric label="Repeatability" value={`Holdout ${formatR(selected.holdout.stressedAverageR)}`} detail={`Recent ${formatR(selected.recent.stressedAverageR)} · holdout N ${selected.holdout.evaluableCount}`} /><Metric label="Economic usability" value={selected.development.stressedAverageR != null && selected.holdout.stressedAverageR != null && selected.development.stressedAverageR > 0 && selected.holdout.stressedAverageR > 0 ? "Positive in older and later data" : "Not consistently positive"} detail="Costs excluded · not a guarantee or order" /></div></section>
    {result.configurations && result.configurations.length > 1 ? <section className="fms-workbench-card"><div className="fms-section-title"><h3>Combined Contracts</h3><span>Independent simulations · no partial exits</span></div><div className="fms-contract-comparison"><div><span>Contract</span><span>Development</span><span>Holdout</span><span>Recent</span><span>Overall</span></div>{result.configurations.map((item) => { const highlighted = item.stopAtr === selected.stopAtr && item.targetR === selected.targetR && item.holdingCandles === selected.holdingCandles; return <div key={`${item.stopAtr}-${item.targetR}-${item.holdingCandles}`} className={highlighted ? "is-highlighted" : ""}><span>SL {item.stopAtr} ATR · TP {item.targetR}R = {item.stopAtr * item.targetR} ATR · {item.holdingCandles} H4{highlighted ? " · Highlighted" : ""}</span><span>{formatR(item.development.stressedAverageR)} · N {item.development.evaluableCount}</span><span>{formatR(item.holdout.stressedAverageR)} · N {item.holdout.evaluableCount}</span><span>{formatR(item.recent.stressedAverageR)} · N {item.recent.evaluableCount}</span><span>{formatR(item.overall.stressedAverageR)} · N {item.overall.evaluableCount}</span></div>; })}</div></section> : null}
    <section className="fms-result-partitions"><PartitionMetrics label="Overall" metrics={selected.overall} /><PartitionMetrics label="Development" metrics={selected.development} /><PartitionMetrics label="Holdout" metrics={selected.holdout} /><PartitionMetrics label="Recent" metrics={selected.recent} /></section>
    <section className="fms-workbench-card"><div className="fms-section-title"><h3>Stability and path audit</h3><span>Known only after historical simulation</span></div><div className="fms-contract-strip"><Metric label="Positive years" value={`${selected.yearStability.positiveYears}/${selected.yearStability.evaluableYears}`} /><Metric label="Nearby holdout positive" value={formatPercent(result.configurationStability.holdout.positiveShare)} detail={`${result.configurationStability.holdout.positiveCount}/${result.configurationStability.holdout.count}`} /><Metric label="Median favorable move" value={formatAtr(result.path.mfeR.median)} /><Metric label="Median adverse move" value={formatAtr(result.path.maeR.median)} /><Metric label={`Unmanaged close · ${selected.holdingCandles} H4`} value={formatAtr(result.path.unmanagedCloseR?.mean)} detail="Final close with no TP/SL · hindsight research" /><Metric label="Unmanaged positive" value={formatPercent(result.path.unmanagedPositiveRate)} /><Metric label="Room to prior barrier" value={formatAtr(result.path.directionalRoomAtr?.median)} detail="Entry-known H4 zones" /><Metric label="S/R coverage" value={formatPercent(result.path.supportResistanceCoverageRate)} /><Metric label="Adverse first" value={formatPercent(result.path.adverseBeforeFavorableRate)} /></div><p className="fms-control-explanation">Maximum favorable movement is known only afterward. Support/resistance uses confirmed zones from the 120 completed H4 candles before entry; neither diagnostic changes this recorded recipe.</p></section>
    <section className="fms-workbench-card"><div className="fms-section-title"><h3>Gross sequential account replay</h3><span>One position at a time · costs excluded</span></div><div className="fms-account-controls"><label>Starting balance<input type="number" min="1" value={startingBalance} onChange={(event) => setStartingBalance(Math.max(1, Number(event.target.value) || 1))} /></label><label>Risk per trade %<input type="number" min="0.01" max="100" step="0.01" value={riskPercent} onChange={(event) => setRiskPercent(Math.min(100, Math.max(.01, Number(event.target.value) || .01)))} /></label><Metric label="Taken trades" value={String(result.sequentialAccount.takenTrades)} /><Metric label="Ending balance" value={`$${account.balance.toFixed(2)}`} /><Metric label="Max closed-trade DD" value={formatPercent(account.maximumDrawdown)} /></div></section>
    <section className="fms-workbench-card"><div className="fms-section-title"><h3>Qualification checks</h3><span>{failed.length ? `${failed.length} not met` : "All checks passed"}</span></div><div className="fms-check-grid">{Object.entries(result.checks).map(([name, passed]) => <div key={name} className={passed ? "is-pass" : "is-fail"}><span>{passed ? "Pass" : "Not met"}</span><strong>{readable(name)}</strong></div>)}</div></section>
    <section className="fms-workbench-card fms-freeze-card"><div><Snowflake size={16} /><div><h3>Freeze for review</h3><p>Creates an immutable C record. It cannot change Charts or execute an order.</p></div></div><div className="fms-freeze-controls"><input aria-label="Frozen candidate friendly name" value={candidateName} onChange={(event) => setCandidateName(event.target.value)} />{failed.length ? <label><input type="checkbox" checked={acknowledge} onChange={(event) => setAcknowledge(event.target.checked)} />I acknowledge the failed checks remain part of this candidate.</label> : null}<button type="button" disabled={busy || !candidateName.trim() || (failed.length > 0 && !acknowledge)} onClick={() => onFreeze(candidateName.trim(), acknowledge)}><Snowflake size={13} />Freeze candidate</button></div></section>
    <FmsRawDataAudit experiment={experiment} open={rawOpen} onClose={() => setRawOpen(false)} />
  </div>;
}

function ValuePicker({ label, values, selected, multiple, onChange, formatValue }: { label: string; values: number[]; selected: number[]; multiple: boolean; onChange: (values: number[]) => void; formatValue?: (value: number) => string }) {
  return <fieldset className="fms-value-picker"><legend>{label}</legend>{values.map((value) => { const active = selected.includes(value); return <button key={value} type="button" className={active ? "is-active" : ""} onClick={() => { if (!multiple) onChange([value]); else if (active && selected.length > 1) onChange(selected.filter((item) => item !== value)); else if (!active) onChange([...selected, value].sort((a, b) => a - b)); }}>{formatValue ? formatValue(value) : value}</button>; })}</fieldset>;
}

interface MacroSignalLabViewProps {
  market?: FmsResearchMarket;
  workbench: FmsWorkbench | null;
  selectedExperiment: FmsExperiment | null;
  loading: boolean;
  running: boolean;
  error: string | null;
  onRun: (payload: Parameters<typeof createFmsExperiment>[0]) => void;
  onSelectExperiment: (experimentId: string) => void;
  onFreeze: (name: string, acknowledge: boolean) => void;
  onRefresh: () => void;
  onMarketChange?: (market: FmsResearchMarket) => void;
}

function InspectorDisclosure({
  title,
  count,
  icon,
  children,
}: {
  title: string;
  count: number;
  icon: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return <details className="fms-workbench-card fms-archive fms-inspector" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>{icon}{title}<span>{count}</span></summary>
    {open ? <div>{children(close)}</div> : null}
  </details>;
}

export function MacroSignalLabView({ market = "EURUSD", workbench, selectedExperiment, loading, running, error, onRun, onSelectExperiment, onFreeze, onRefresh, onMarketChange = () => {} }: MacroSignalLabViewProps) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [catalogId, setCatalogId] = useState("");
  const [directionSelection, setDirectionSelection] = useState<"long" | "short" | "both">("both");
  const [treatmentId, setTreatmentId] = useState("base");
  const [friendlyName, setFriendlyName] = useState("");
  const [policy, setPolicy] = useState<"baseline" | "surprise_only" | "momentum_only" | "agreement_no_bonus" | "forecast_quality">("forecast_quality");
  const [mode, setMode] = useState<"single" | "matrix">("single");
  const [stops, setStops] = useState([1]);
  const [targets, setTargets] = useState([2]);
  const [holding, setHolding] = useState([30]);
  const catalog = workbench?.catalog.items ?? [];
  const filtered = useMemo(() => { const query = search.trim().toLowerCase(); return query ? catalog.filter((item) => [item.label, item.family, item.signature, ...item.exactTitles].join(" ").toLowerCase().includes(query)) : catalog; }, [catalog, search]);
  const selectedItem = catalog.find((item) => item.id === catalogId) ?? catalog[0] ?? null;
  const selectedVariant = directionSelection === "both" ? null : selectedItem?.directionVariants.find((item) => item.direction === directionSelection) ?? null;
  const availableTreatments = selectedVariant?.treatments ?? selectedItem?.treatments ?? [];
  const selectedTreatment = availableTreatments.find((item) => item.id === treatmentId) ?? availableTreatments[0] ?? null;
  const directionCount = directionSelection === "both" ? selectedItem?.historicalN ?? 0 : selectedVariant?.historicalN ?? 0;
  const registeredSetup = selectedItem ? workbench?.currentModel.registeredSetups.find((setup) => setup.signatures.some((signature) => selectedItem.signatures.includes(signature))) ?? null : null;
  const calendarPeriod = workbench?.dataPeriods ? formatPeriod(workbench.dataPeriods.durableCalendar) : null;
  const researchPeriod = workbench?.dataPeriods ? formatPeriod(workbench.dataPeriods.workbenchResearch) : null;
  const pricePeriod = workbench?.dataPeriods ? formatPeriod(workbench.dataPeriods.h4Prices) : null;
  useEffect(() => { if (!catalogId && catalog[0]) { setCatalogId(catalog[0].id); setFriendlyName(`${catalog[0].label} experiment`); } }, [catalogId, catalog]);
  useEffect(() => {
    if (!selectedItem) return;
    setDirectionSelection(selectedItem.direction === "both" ? "both" : selectedItem.direction);
    setTreatmentId("base");
  }, [selectedItem?.id]);
  useEffect(() => { if (availableTreatments.length && !availableTreatments.some((item) => item.id === treatmentId)) setTreatmentId(availableTreatments[0]?.id ?? "base"); }, [availableTreatments, treatmentId]);
  useEffect(() => {
    if (!registeredSetup) return;
    setPolicy(registeredSetup.scoringPolicy);
    const registeredTreatment = availableTreatments.find((item) => item.dimension === registeredSetup.cohort.dimension && item.value === registeredSetup.cohort.value && item.reaction === registeredSetup.reaction);
    setTreatmentId(registeredTreatment?.id ?? "base");
    setMode("single");
    setStops([registeredSetup.execution.stopAtr]);
    setTargets([registeredSetup.execution.targetR]);
    setHolding([registeredSetup.execution.expiryCandles]);
  }, [registeredSetup?.id, selectedItem?.signature, availableTreatments]);
  const switchMode = (next: "single" | "matrix") => { setMode(next); if (next === "single") { setStops([1]); setTargets([2]); setHolding([30]); } else { setStops(DEFAULT_STOPS); setTargets(DEFAULT_TARGETS); setHolding(DEFAULT_HOLDING); } };
  const submit = () => { if (!selectedItem || !selectedTreatment || !friendlyName.trim()) return; onRun({ market, friendlyName: friendlyName.trim(), catalogId: selectedItem.id, directionSelection, scoringPolicy: policy, cohort: { dimension: selectedTreatment.dimension, value: selectedTreatment.value }, reaction: selectedTreatment.reaction, execution: { mode, stopAtrValues: stops, targetRValues: targets, holdingCandles: holding } }); };
  if (!workbench && loading) return <section className="macro-signal-page"><div className="fms-workbench-empty"><RefreshCw className="animate-spin" /><strong>Loading FMS workbench</strong></div></section>;
  return <section className="macro-signal-page fms-workbench" data-macro-signal-lab="">
    <header className="fms-workbench-header"><div><div className="macro-signal-kicker"><FlaskConical size={14} />Active FMS research tool</div><h2>FMS Experiment Workbench</h2><p>Recorded {market}/H4 research—not an order, guarantee, or automatic optimizer.</p></div><div><button type="button" onClick={() => setGuideOpen(true)}><BookOpen size={15} />How to use the Workbench</button><button type="button" onClick={onRefresh} disabled={loading}><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh</button></div></header>
    <div className="fms-market-picker"><label className="fms-field">Research market<select value={market} onChange={(event) => onMarketChange(event.target.value as FmsResearchMarket)}><option value="EURUSD">EURUSD</option><option value="GBPUSD">GBPUSD</option><option value="USDJPY">USDJPY</option><option value="AUDUSD">AUDUSD</option><option value="USDCAD">USDCAD</option><option value="NZDUSD">NZDUSD</option><option value="USDCHF">USDCHF</option></select></label><small>{workbench?.currentModel.registeredSetups.length ? `${market} has ${workbench.currentModel.registeredSetups.length} active registered setup${workbench.currentModel.registeredSetups.length === 1 ? "" : "s"}.` : `${market} is research-only; no arrows are registered.`}</small></div>
    {error ? <div className="macro-signal-error"><AlertTriangle size={16} />{error}</div> : null}
    {workbench?.availability && !workbench.availability.ready ? <div className="macro-signal-error"><AlertTriangle size={16} />{workbench.availability.message}</div> : null}
    {workbench ? <section className="fms-current-strip"><div><span>Current Charts model</span><strong>{workbench.currentModel.friendlyName} · {workbench.currentModel.displayId}</strong><small>{workbench.currentModel.id}{workbench.currentModel.researchEngineId ? ` · ${workbench.currentModel.researchEngineId}` : ""}</small></div><div><Metric label="Market" value={market} /><Metric label="Backtest timeframe" value="H4" /><Metric label="Registered setups" value={String(workbench.currentModel.registeredSetups.length)} /><Metric label="Promotion" value="Reviewed only" /></div></section> : null}
    {workbench && calendarPeriod && researchPeriod && pricePeriod ? <section className="fms-data-periods" aria-label="FMS data periods"><div><span>Data periods</span><small>Fixed and reported—not user-selected</small></div><Metric label="Durable EUR/USD calendar" value={calendarPeriod.years} detail={calendarPeriod.dates} /><Metric label="Workbench research cases" value={researchPeriod.years} detail={researchPeriod.dates} /><Metric label="Stored H4 prices" value={pricePeriod.years} detail={pricePeriod.dates} /></section> : null}
    <div className="fms-workbench-body">
      <aside className="fms-builder">
        <section className="fms-workbench-card"><div className="fms-section-title"><h3>1 · Choose economic setup</h3><span>{catalog.length} detected</span></div><input className="fms-search" placeholder="Search family, title, or setup" value={search} onChange={(event) => setSearch(event.target.value)} /><div className="fms-catalog-list">{filtered.map((item) => <button key={item.id} type="button" className={item.id === selectedItem?.id ? "is-active" : ""} onClick={() => { setCatalogId(item.id); setTreatmentId("base"); setFriendlyName(`${item.label} experiment`); }}><span>{item.registered ? "Registered" : "Research"} · N {item.historicalN}</span><strong>{item.label}</strong><small>{item.exactTitles.join(" · ") || item.family}</small></button>)}</div>{selectedItem ? <div className="fms-direction-picker" role="group" aria-label="Direction to test">{selectedItem.directionVariants.map((variant) => <button key={variant.direction} type="button" className={directionSelection === variant.direction ? "is-active" : ""} onClick={() => { setDirectionSelection(variant.direction); setTreatmentId("base"); }}>{variant.direction === "long" ? "Long" : "Short"} · N {variant.historicalN}</button>)}{selectedItem.directionVariants.length > 1 ? <button type="button" className={directionSelection === "both" ? "is-active" : ""} onClick={() => { setDirectionSelection("both"); setTreatmentId("base"); }}>Both directions · N {selectedItem.historicalN}</button> : null}</div> : null}<p className="fms-control-explanation">{directionSelection === "both" ? "Both directions follows the evidence each time: improving evidence uses Long and weakening evidence uses Short. It never opens both at once." : `${readable(directionSelection)} tests only that historical direction.`}</p></section>
        {registeredSetup ? <section className="fms-workbench-card fms-registered-recipe">
          <div className="fms-section-title"><h3>Registered recipe</h3><span>Loaded below</span></div>
          <strong>{registeredSetup.label}</strong>
          <p>{registeredSetup.condition}</p>
          {registeredSetup.registrationEvidence ? <>
            <div className="fms-recipe-grid"><span><small>Frozen scoring</small>{scoringPolicyLabel(registeredSetup.scoringPolicy)}</span><span><small>Cases included</small>{registeredSetup.cohort.dimension === "none" ? "All matching releases" : `${readable(registeredSetup.cohort.dimension)} · ${readable(registeredSetup.cohort.value)}`}</span><span><small>Price reaction</small>{reactionLabel(registeredSetup.reaction)}</span><span><small>Execution</small>{registeredSetup.execution.stopAtr} ATR / {registeredSetup.execution.targetR}R / {registeredSetup.execution.expiryCandles} H4</span></div>
            <div className="fms-recipe-result"><strong>Why it was registered</strong><span>{registeredSetup.registrationEvidence.evaluable} cases · {registeredSetup.registrationEvidence.targetFirst} target first · {registeredSetup.registrationEvidence.stopFirst} stop first · {registeredSetup.registrationEvidence.expired} expired</span><span>{formatR(registeredSetup.registrationEvidence.stressedAverageR)} average after its historical {registeredSetup.registrationEvidence.stressPips}-pip stress · {registeredSetup.registrationEvidence.positiveYears}/{registeredSetup.registrationEvidence.evaluatedYears} positive years</span><small>Development {formatR(registeredSetup.registrationEvidence.developmentAverageR)} · Holdout {formatR(registeredSetup.registrationEvidence.holdoutAverageR)} · Recent {formatR(registeredSetup.registrationEvidence.recentAverageR)}</small></div>
          </> : <p className="fms-inline-note">This signature is registered, but its original qualification snapshot is available in the Research Archive.</p>}
          <small className="fms-current-guard-note">Charts and Shadow Trader use this exact frozen scoring, reaction, and execution recipe.</small>
        </section> : null}
        <section className="fms-workbench-card"><div className="fms-section-title"><h3>2 · How to score and filter</h3><span>{registeredSetup ? "Current model values loaded" : "One filter maximum"}</span></div><label className="fms-field">How each release is scored<select value={policy} onChange={(event) => setPolicy(event.target.value as typeof policy)}><option value="forecast_quality">Forecast Guard</option><option value="baseline">Surprise + Momentum</option><option value="agreement_no_bonus">Surprise + Momentum (no bonus)</option><option value="surprise_only">Surprise only</option><option value="momentum_only">Momentum only</option></select></label><p className="fms-control-explanation">{scoringPolicyExplanation(policy)}</p>{policy === "forecast_quality" ? <div className="fms-forecast-guard"><strong>How Forecast Guard works</strong><span>It uses only earlier releases of the same exact series. After at least 12 observations, an unusually large Forecast-versus-Previous gap is checked against its historical median/MAD and scale.</span><span><b>Forecast unreliable:</b> the raw Forecast stays visible, but Surprise contributes nothing. Actual-versus-Previous Momentum remains eligible and no Surprise agreement bonus is added.</span></div> : null}<label className="fms-field">Cases included<select value={selectedTreatment?.id ?? "base"} onChange={(event) => setTreatmentId(event.target.value)}>{availableTreatments.map((item) => <option key={item.id} value={item.id}>{item.label} · {reactionLabel(item.reaction)} · N {item.historicalN}</option>)}</select></label><p className="fms-control-explanation">{cohortExplanation(selectedTreatment)} {selectedTreatment?.dimension === "relativeMagnitude" ? "Magnitude compares this exact series only with its own earlier releases." : ""} {selectedTreatment?.reaction === "contrarian" ? "Rejection tests price moving against the evidence direction." : "Continuation tests price moving in the evidence direction."}</p>{!workbench?.catalog.advancedTreatmentsReady ? <p className="fms-inline-note">Advanced case filters are unavailable until the durable stress catalog has been generated. All matching cases remain usable.</p> : null}</section>
        <section className="fms-workbench-card"><div className="fms-section-title"><h3>3 · Trade simulation rules</h3><span>{registeredSetup ? `Registered: SL ${registeredSetup.execution.stopAtr} ATR · TP ${registeredSetup.execution.targetR}R = ${registeredSetup.execution.stopAtr * registeredSetup.execution.targetR} ATR · ${registeredSetup.execution.expiryCandles} H4` : "Entry: first later H4 open"}</span></div><div className="fms-mode-toggle"><button type="button" className={mode === "single" ? "is-active" : ""} onClick={() => switchMode("single")}>Single Contract</button><button type="button" className={mode === "matrix" ? "is-active" : ""} onClick={() => switchMode("matrix")}>Combined Contracts</button></div>{workbench ? <><ValuePicker label="SL (ATR)" values={workbench.protocol.stopAtrValues} selected={stops} multiple={mode === "matrix"} onChange={setStops} formatValue={(value) => `${value}`} /><ValuePicker label="TP (R + ATR)" values={workbench.protocol.targetRValues} selected={targets} multiple={mode === "matrix"} onChange={setTargets} formatValue={(value) => stops.length === 1 ? `${value}R = ${value * stops[0]} ATR` : `${value}R`} /><ValuePicker label="Maximum trade duration (H4 candles)" values={workbench.protocol.holdingCandles} selected={holding} multiple={mode === "matrix"} onChange={setHolding} /></> : null}<p className="fms-control-explanation">TP distance in ATR = SL in ATR × TP in R. Combined Contracts tests every selected combination independently; it does not split one trade into several take-profits.</p><div className="fms-run-preview"><span>{stops.length * targets.length * holding.length} contract{stops.length * targets.length * holding.length === 1 ? "" : "s"}</span><span>{selectedTreatment?.historicalN ?? directionCount} catalog cases before rescoring</span></div></section>
        <section className="fms-workbench-card"><label className="fms-field">Experiment name<input value={friendlyName} maxLength={80} onChange={(event) => setFriendlyName(event.target.value)} /></label><button type="button" className="fms-run-button" disabled={running || !selectedItem || !friendlyName.trim()} onClick={submit}>{running ? <RefreshCw className="animate-spin" size={15} /> : <Play size={15} />}{running ? "Running recorded experiment" : "Run recorded experiment"}</button><p className="fms-inline-note">Every run receives an immutable E identifier, including failures.</p></section>
      </aside>
      <main className="fms-workbench-results"><ResultPanel experiment={selectedExperiment} onFreeze={onFreeze} busy={loading} /></main>
      <aside className="fms-history-rail">
        <InspectorDisclosure title="Current registered setups" count={workbench?.currentModel.registeredSetups.length ?? 0} icon={<Check size={14} />}>
          {() => workbench?.currentModel.registeredSetups.length ? workbench.currentModel.registeredSetups.map((setup) => <article key={setup.id}><strong>{setup.label}</strong><span>{setup.execution.stopAtr} ATR / {setup.execution.targetR}R / {setup.execution.expiryCandles} H4</span><small>{setup.condition}</small></article>) : <p>No setup is registered for this market.</p>}
        </InspectorDisclosure>
        <InspectorDisclosure title="Reaction Atlas" count={workbench?.reactionAtlas?.rows.length ?? 0} icon={<FlaskConical size={14} />}>
          {() => workbench?.reactionAtlas ? <><article className="fms-atlas-summary"><strong>What the archive says</strong><span>{workbench.reactionAtlas.counts.historically_profitable_candidate ?? 0} candidates · {workbench.reactionAtlas.counts.directional_contender ?? 0} contenders</span><small>{workbench.reactionAtlas.counts.avoid_standalone_direction ?? 0} avoid as standalone direction · {workbench.reactionAtlas.counts.insufficient_evidence ?? 0} insufficient</small></article>{workbench.reactionAtlas.rows.map((row) => <article key={row.id}><strong>{row.label}</strong><span>{row.classificationLabel}</span><small>{scoringPolicyLabel(row.policy)} · {readable(row.reaction)} · N {row.historicalN} · {row.horizonH4} H4 · later {formatR(row.holdoutAverageR)}</small></article>)}</> : <p>No durable atlas is available.</p>}
        </InspectorDisclosure>
        <InspectorDisclosure title="Recorded experiments" count={workbench?.experiments.length ?? 0} icon={<Beaker size={14} />}>
          {(close) => <div className="fms-record-list">{workbench?.experiments.map((experiment) => <button key={experiment.id} type="button" className={experiment.id === selectedExperiment?.id ? "is-active" : ""} onClick={() => { onSelectExperiment(experiment.id); close(); }}><span>{experiment.id} · {readable(experiment.status)}</span><strong>{experiment.friendlyName}</strong><small>{experiment.catalogSnapshot?.label}</small></button>)}{!workbench?.experiments.length ? <p>No recorded experiments yet.</p> : null}</div>}
        </InspectorDisclosure>
        <InspectorDisclosure title="Frozen candidates" count={workbench?.candidates.length ?? 0} icon={<Snowflake size={14} />}>
          {() => <div className="fms-candidate-list">{workbench?.candidates.map((candidate: FmsFrozenCandidate) => { const passed = Object.values(candidate.checks).filter(Boolean).length; const failed = Object.keys(candidate.checks).length - passed; return <article key={candidate.id} className={failed ? "has-failed-gates" : ""}><span>{candidate.id} · Review required</span><strong>{candidate.friendlyName}</strong><small>{candidate.catalogSnapshot.label} · {passed}/{Object.keys(candidate.checks).length} checks</small><small>{failed ? `${failed} failed gate${failed === 1 ? "" : "s"} · acknowledged` : "All recorded checks passed"}</small></article>; })}{!workbench?.candidates.length ? <p>No candidate frozen for review.</p> : null}</div>}
        </InspectorDisclosure>
        <InspectorDisclosure title="Context follow-up" count={(workbench?.contextFollowup?.policyInflationSupported ?? 0) + (workbench?.contextFollowup?.boundedInteractionsSupported ?? 0) + (workbench?.contextFollowup?.transferCandidates.length ?? 0)} icon={<FlaskConical size={14} />}>
          {() => workbench?.contextFollowup ? <>
            <article className="fms-atlas-summary"><strong>{workbench.contextFollowup.recipesAudited} recipes audited</strong><span>{workbench.contextFollowup.policyInflationSupported} Policy/Inflation · {workbench.contextFollowup.boundedInteractionsSupported} combined</span><small>{workbench.contextFollowup.transferCandidates.length} cross-market transfer candidates · review only</small></article>
            {workbench.contextFollowup.transferCandidates.map((row) => <article key={row.id}><strong>{row.targetLabel}</strong><span>{row.sourceRegistrationId} → {row.targetMarket}</span><small>{readable(row.condition.dimension ?? "context")} = {readable(row.condition.value ?? "unknown")} · later N {row.laterExecution.evaluableN} · {formatR(row.laterExecution.averageR)}</small></article>)}
            <p>{workbench.contextFollowup.refreshPolicy}</p>
          </> : <p>No context follow-up artifact is available.</p>}
        </InspectorDisclosure>
        <InspectorDisclosure title="Research Archive" count={workbench?.archive.length ?? 0} icon={<Archive size={14} />}>
          {() => workbench?.archive.map((item) => <article key={item.id}><strong>{item.id}</strong><span>{item.latestRun?.status ?? "No run"}</span><small>{item.configurationHash.slice(0, 12)} · {formatTime(item.createdAt)}</small></article>)}
        </InspectorDisclosure>
      </aside>
    </div>
    <FmsWorkbenchTutorial open={guideOpen} onClose={() => setGuideOpen(false)} />
  </section>;
}

export function MacroSignalLabTab() {
  const [market, setMarket] = useState<FmsResearchMarket>("EURUSD");
  const [workbench, setWorkbench] = useState<FmsWorkbench | null>(null);
  const [selectedExperiment, setSelectedExperiment] = useState<FmsExperiment | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadRequestRef = useRef(0);
  const load = async (preserveSelection = true) => {
    const requestId = ++loadRequestRef.current;
    const cached = workbenchMarketCache.get(market);
    if (cached) setWorkbench(cached);
    setLoading(!cached);
    try {
      const next = await fetchFmsWorkbench(market);
      if (requestId !== loadRequestRef.current) return;
      workbenchMarketCache.set(market, next);
      setWorkbench(next);
      if (!preserveSelection || !next.experiments.some((row) => row.id === selectedExperiment?.id)) setSelectedExperiment(null);
      setError(null);
    } catch (loadError) { if (requestId === loadRequestRef.current) setError(loadError instanceof Error ? loadError.message : "FMS workbench unavailable"); }
    finally { if (requestId === loadRequestRef.current) setLoading(false); }
  };
  useEffect(() => { void load(false); }, [market]);
  useEffect(() => {
    if (!selectedExperiment || !["queued", "running"].includes(selectedExperiment.status)) return;
    let cancelled = false;
    const timer = window.setInterval(() => { fetchFmsExperiment(selectedExperiment.id).then((next) => { if (cancelled) return; setSelectedExperiment(next); if (!["queued", "running"].includes(next.status)) { setRunning(false); void load(true); } }).catch((pollError) => { if (!cancelled) setError(pollError instanceof Error ? pollError.message : "Experiment polling failed"); }); }, 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [selectedExperiment?.id, selectedExperiment?.status]);
  const run = async (payload: Parameters<typeof createFmsExperiment>[0]) => { setRunning(true); setError(null); try { const experiment = await createFmsExperiment(payload); setSelectedExperiment(experiment); setRunning(["queued", "running"].includes(experiment.status)); setWorkbench((current) => current ? { ...current, experiments: [experiment, ...current.experiments] } : current); } catch (runError) { setError(runError instanceof Error ? runError.message : "Experiment could not start"); setRunning(false); } };
  const selectExperiment = async (id: string) => { try { setSelectedExperiment(await fetchFmsExperiment(id)); setError(null); } catch (selectError) { setError(selectError instanceof Error ? selectError.message : "Experiment could not load"); } };
  const freeze = async (name: string, acknowledge: boolean) => { if (!selectedExperiment) return; setLoading(true); try { await freezeFmsExperiment(selectedExperiment.id, { friendlyName: name, acknowledgeFailedGates: acknowledge }); await load(true); } catch (freezeError) { setError(freezeError instanceof Error ? freezeError.message : "Candidate could not be frozen"); setLoading(false); } };
  return <MacroSignalLabView market={market} workbench={workbench} selectedExperiment={selectedExperiment} loading={loading} running={running} error={error} onRun={run} onSelectExperiment={selectExperiment} onFreeze={freeze} onRefresh={() => void load(true)} onMarketChange={(nextMarket) => { loadRequestRef.current += 1; setSelectedExperiment(null); setMarket(nextMarket); }} />;
}
