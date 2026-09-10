import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BookOpen, Copy, Database, Download, Play, RefreshCw, Snowflake } from "lucide-react";
import { createFmsExperiment, fetchFmsExperiment, fetchFmsWorkbench, freezeFmsExperiment } from "@/app/lib/bridge";
import { FmsWorkbenchTutorial } from "@/app/components/FmsWorkbenchTutorial";
import { FmsRawDataAudit } from "@/app/components/FmsRawDataAudit";
import { formatUtcDisplayDate, formatUtcDisplayDateTime } from "@/app/lib/format";
import type { FmsCatalogItem, FmsCatalogTreatment, FmsExperiment, FmsExperimentResult, FmsFrozenCandidate, FmsResearchMarket, FmsWorkbench, MacroSignalStressMetrics } from "@/app/types";
import { FX_PAIRS } from "@/app/config/fxPairs";

const DEFAULT_STOPS = [1, 1.5, 2];
const DEFAULT_TARGETS = [1, 1.5, 2];
const DEFAULT_HOLDING = [18, 30, 42];
const workbenchMarketCache = new Map<FmsResearchMarket, FmsWorkbench>();

function formatR(value: number | null | undefined): string {
  if (value == null) return "Unavailable";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function formatPercent(value: number | null | undefined): string {
  return value == null ? "Unavailable" : `${(value * 100).toFixed(1)}%`;
}

function formatAtr(value: number | null | undefined): string {
  return value == null ? "Unavailable" : `${value >= 0 ? "+" : ""}${value.toFixed(2)} ATR`;
}

function formatTime(value: number | null | undefined): string {
  return value == null ? "Unavailable" : formatUtcDisplayDateTime(value);
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

function ResultPanel({ experiment, onFreeze, busy }: { experiment: FmsExperiment | null; onFreeze: (name: string, acknowledge: boolean) => void; busy: boolean }) {
  const [candidateName, setCandidateName] = useState("");
  const [acknowledge, setAcknowledge] = useState(false);
  const [startingBalance, setStartingBalance] = useState(1000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [rawOpen, setRawOpen] = useState(false);
  useEffect(() => {
    setCandidateName(experiment?.friendlyName ?? "");
    setAcknowledge(false);
  }, [experiment?.id]);

  if (!experiment) {
    return <div className="fms-table-empty"><strong>No recorded experiment selected</strong><span>Select a row in Run status or Archive, or declare a new bounded experiment.</span></div>;
  }
  if (experiment.status === "queued" || experiment.status === "running") {
    return <div className="fms-table-empty"><RefreshCw className="animate-spin" /><strong>{experiment.id} is {experiment.status}</strong><span>The recorded bridge job continues without blocking navigation.</span></div>;
  }
  if (experiment.status === "failed") {
    return <div className="fms-table-empty is-error"><AlertTriangle /><strong>{experiment.id} failed</strong><span>{experiment.error ?? "Failure reason unavailable in the stored record."}</span></div>;
  }
  const result = experiment.result;
  if (!result) return <div className="fms-table-empty is-error"><strong>Result unavailable</strong><span>The stored experiment has no completed result payload.</span></div>;

  const selected = result.selectedConfiguration;
  const configurations = result.configurations?.length ? result.configurations : [selected];
  const failed = Object.entries(result.checks).filter(([, passed]) => !passed).map(([name]) => name);
  const account = compoundAccount(result.sequentialAccount.grossResultsR ?? [], startingBalance, riskPercent);
  const copySummary = async () => navigator.clipboard.writeText(buildAiSummary(experiment));
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(experiment, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${experiment.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const partitionRows: Array<[string, MacroSignalStressMetrics]> = [
    ["Overall", selected.overall],
    ["Development", selected.development],
    ["Holdout", selected.holdout],
    ["Recent", selected.recent],
  ];

  return (
    <div className="fms-result-tables">
      <header className="fms-table-toolbar">
        <div><strong>{experiment.friendlyName}</strong><span>{experiment.id} · immutable completed experiment</span></div>
        <div>
          <button type="button" onClick={() => setRawOpen(true)}><Database size={13} />View raw data</button>
          <button type="button" onClick={copySummary}><Copy size={13} />Copy AI summary</button>
          <button type="button" onClick={downloadJson}><Download size={13} />Download JSON</button>
        </div>
      </header>

      <section className="fms-table-section">
        <h3>Recorded recipe <span>Immutable configuration</span></h3>
        <table className="fms-literal-table fms-key-value-table"><tbody>
          <tr><th>Economic setup</th><td>{experiment.catalogSnapshot.label}</td><th>Market</th><td>{result.market ?? experiment.configuration.market ?? experiment.catalogSnapshot.market ?? "EURUSD"}</td></tr>
          <tr><th>Signatures</th><td>{(result.signatures ?? experiment.configuration.signatures ?? [experiment.configuration.signature]).join(" | ")}</td><th>Direction rule</th><td>{readable(result.directionSelection ?? experiment.configuration.directionSelection ?? experiment.catalogSnapshot.direction)}</td></tr>
          <tr><th>Scoring policy</th><td>{scoringPolicyLabel(result.scoringPolicy)}</td><th>Cases included</th><td>{result.cohort.dimension === "none" ? "All matching releases" : `${readable(result.cohort.dimension)} · ${readable(result.cohort.value)}`}</td></tr>
          <tr><th>Price reaction</th><td>{reactionLabel(result.reaction)}</td><th>Entry rule</th><td>First strictly later H4 open</td></tr>
          <tr><th>Selection rule</th><td>{selectionLabel(result.selection)}</td><th>Configurations tested</th><td>{result.configurationsTested}</td></tr>
        </tbody></table>
        {result.scoringPolicy === "forecast_quality" ? <p className="fms-table-note"><strong>{result.forecastQualityAudit.excludedForecastCount} Forecast{result.forecastQualityAudit.excludedForecastCount === 1 ? "" : "s"} flagged unreliable.</strong> Raw values remain stored; Surprise was excluded while Momentum remained eligible.</p> : null}
      </section>

      <section className="fms-table-section">
        <h3>Execution-contract results <span>Selected: SL {selected.stopAtr} ATR · TP {selected.targetR}R = {selected.stopAtr * selected.targetR} ATR · {selected.holdingCandles} H4</span></h3>
        <p className="fms-table-note">Independent simulations · no partial exits. Gross outcomes exclude spread, commission, slippage, and swap.</p>
        <div className="fms-table-scroll"><table className="fms-literal-table">
          <thead><tr><th>Entry rule</th><th>SL ATR</th><th>TP R</th><th>TP ATR</th><th>Duration</th><th>TP</th><th>SL</th><th>Expired</th><th>Ambiguous</th><th>Unavailable</th><th>Average gross R</th><th>Stressed R</th><th>Qualification</th></tr></thead>
          <tbody>{configurations.map((item) => {
            const highlighted = item.stopAtr === selected.stopAtr && item.targetR === selected.targetR && item.holdingCandles === selected.holdingCandles;
            const localPassed = item.overall.stressedAverageR != null && item.overall.stressedAverageR > 0;
            return <tr key={`${item.stopAtr}-${item.targetR}-${item.holdingCandles}`} className={highlighted ? "is-selected" : ""}>
              <td>First later H4 open</td><td>{item.stopAtr}</td><td>{item.targetR}R</td><td>{item.stopAtr * item.targetR} ATR</td><td>{item.holdingCandles} H4</td>
              <td>{item.overall.targetHitCount}</td><td>{item.overall.stopHitCount}</td><td>{item.overall.expiredCount}</td><td>{item.overall.ambiguousCount}</td><td>{item.overall.unevaluableCount}</td>
              <td>{formatR(item.overall.grossAverageR)}</td><td>{formatR(item.overall.stressedAverageR)}</td><td>{highlighted ? "Selected" : localPassed ? "Positive gross row" : "Not positive"}</td>
            </tr>;
          })}</tbody>
        </table></div>
      </section>

      <section className="fms-table-section">
        <h3>Evidence partitions <span>Identical selected contract</span></h3>
        <table className="fms-literal-table"><thead><tr><th>Partition</th><th>Attempted</th><th>Evaluable</th><th>TP</th><th>SL</th><th>Expired</th><th>Ambiguous</th><th>Unavailable</th><th>TP rate</th><th>Average gross R</th><th>Stressed R</th><th>Lower 95%</th></tr></thead>
          <tbody>{partitionRows.map(([label, metrics]) => <tr key={label}><th>{label}</th><td>{metrics.attemptedCount}</td><td>{metrics.evaluableCount}</td><td>{metrics.targetHitCount}</td><td>{metrics.stopHitCount}</td><td>{metrics.expiredCount}</td><td>{metrics.ambiguousCount}</td><td>{metrics.unevaluableCount}</td><td>{formatPercent(metrics.targetHitRate)}</td><td>{formatR(metrics.grossAverageR)}</td><td>{formatR(metrics.stressedAverageR)}</td><td>{formatR(metrics.stressedExpectancyCi95?.lower)}</td></tr>)}</tbody>
        </table>
      </section>

      <section className="fms-table-section fms-two-table-grid">
        <div><h3>Path audit <span>Hindsight diagnostics</span></h3><table className="fms-literal-table fms-key-value-table"><tbody>
          <tr><th>Positive years</th><td>{selected.yearStability.positiveYears}/{selected.yearStability.evaluableYears}</td></tr>
          <tr><th>Median MFE</th><td>{formatR(result.path.mfeR.median)}</td></tr>
          <tr><th>Median MAE magnitude</th><td>{formatR(result.path.maeR.median)}</td></tr>
          <tr><th>Unmanaged close</th><td>{formatR(result.path.unmanagedCloseR?.mean)}</td></tr>
          <tr><th>Directional room</th><td>{formatAtr(result.path.directionalRoomAtr?.median)}</td></tr>
          <tr><th>Adverse before favorable</th><td>{formatPercent(result.path.adverseBeforeFavorableRate)}</td></tr>
        </tbody></table></div>
        <div><h3>Qualification checks <span>{failed.length ? `${failed.length} not met` : "All passed"}</span></h3><table className="fms-literal-table"><thead><tr><th>Check</th><th>Recorded result</th></tr></thead><tbody>{Object.entries(result.checks).map(([name, passed]) => <tr key={name}><td>{readable(name)}</td><td className={passed ? "is-pass" : "is-fail"}>{passed ? "Pass" : "Not met"}</td></tr>)}</tbody></table></div>
      </section>

      <section className="fms-table-section">
        <h3>Provenance <span>Stored record is authoritative</span></h3>
        <table className="fms-literal-table fms-key-value-table"><tbody>
          <tr><th>Experiment ID</th><td>{experiment.id}</td><th>Configuration hash</th><td>{experiment.configurationHash}</td></tr>
          <tr><th>Dataset fingerprint</th><td>{experiment.datasetFingerprint}</td><th>Catalog snapshot</th><td>{experiment.catalogSnapshot.sourceVersionId}</td></tr>
          <tr><th>Data cutoff</th><td>{formatTime(experiment.configuration.researchPriceCutoff)}</td><th>First-seen policy</th><td>{experiment.configuration.entry}</td></tr>
          <tr><th>Scoring policy</th><td>{result.scoringPolicy}</td><th>Code/model version</th><td>{result.sourceVersionId}</td></tr>
          <tr><th>Created</th><td>{formatTime(experiment.createdAt)}</td><th>Completed</th><td>{formatTime(result.generatedAt)}</td></tr>
          <tr><th>Source classification</th><td>Stored immutable experiment</td><th>Costs</th><td>Unavailable · deliberately excluded</td></tr>
        </tbody></table>
      </section>

      <section className="fms-table-section">
        <h3>Gross sequential account replay <span>Calculator only · no order transmission</span></h3>
        <table className="fms-literal-table fms-key-value-table"><tbody>
          <tr><th>Starting balance</th><td><input type="number" min="1" value={startingBalance} onChange={(event) => setStartingBalance(Math.max(1, Number(event.target.value) || 1))} /></td><th>Risk per trade %</th><td><input type="number" min="0.01" max="100" step="0.01" value={riskPercent} onChange={(event) => setRiskPercent(Math.min(100, Math.max(.01, Number(event.target.value) || .01)))} /></td></tr>
          <tr><th>Taken trades</th><td>{result.sequentialAccount.takenTrades}</td><th>Ending balance</th><td>${account.balance.toFixed(2)}</td></tr>
          <tr><th>Max closed-trade drawdown</th><td>{formatPercent(account.maximumDrawdown)}</td><th>Gross cumulative R</th><td>{formatR(result.sequentialAccount.cumulativeStressedR)}</td></tr>
        </tbody></table>
      </section>

      <section className="fms-table-section fms-freeze-row">
        <h3>Freeze for review <span>Separate, immutable C record · never automatic promotion</span></h3>
        <label>Name<input aria-label="Frozen candidate friendly name" value={candidateName} onChange={(event) => setCandidateName(event.target.value)} /></label>
        {failed.length ? <label><input type="checkbox" checked={acknowledge} onChange={(event) => setAcknowledge(event.target.checked)} />I acknowledge the failed checks remain part of this candidate.</label> : null}
        <button type="button" disabled={busy || !candidateName.trim() || (failed.length > 0 && !acknowledge)} onClick={() => onFreeze(candidateName.trim(), acknowledge)}><Snowflake size={13} />Freeze candidate</button>
      </section>
      <FmsRawDataAudit experiment={experiment} open={rawOpen} onClose={() => setRawOpen(false)} />
    </div>
  );
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

export function MacroSignalLabView({ market = "EURUSD", workbench, selectedExperiment, loading, running, error, onRun, onSelectExperiment, onFreeze, onRefresh, onMarketChange = () => {} }: MacroSignalLabViewProps) {
  const [workspaceMode, setWorkspaceMode] = useState<"declare" | "run" | "results" | "archive">(selectedExperiment ? "results" : "declare");
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
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
  const comparisonRows = useMemo(() => (workbench?.experiments ?? []).filter((item) => comparisonIds.includes(item.id)), [comparisonIds, workbench?.experiments]);
  useEffect(() => { if (!catalogId && catalog[0]) { setCatalogId(catalog[0].id); setFriendlyName(`${catalog[0].label} experiment`); } }, [catalogId, catalog]);
  useEffect(() => {
    if (!selectedItem) return;
    setDirectionSelection(selectedItem.direction === "both" ? "both" : selectedItem.direction);
    setTreatmentId("base");
  }, [selectedItem?.id]);
  useEffect(() => { if (availableTreatments.length && !availableTreatments.some((item) => item.id === treatmentId)) setTreatmentId(availableTreatments[0]?.id ?? "base"); }, [availableTreatments, treatmentId]);
  useEffect(() => {
    if (selectedExperiment) setWorkspaceMode("results");
  }, [selectedExperiment?.id]);
  useEffect(() => {
    setComparisonIds([]);
  }, [market]);
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

  if (!workbench && loading) return <div className="fms-table-empty"><RefreshCw className="animate-spin" /><strong>Loading FMS Workbench</strong></div>;
  if (!workbench) return <div className="fms-table-empty is-error"><AlertTriangle /><strong>FMS Workbench unavailable</strong><span>{error ?? "The bridge returned no workbench record."}</span><button type="button" onClick={onRefresh}>Retry</button></div>;

  const registrationEvidence = registeredSetup?.registrationEvidence ?? null;
  const periods = [
    ["Durable EUR/USD calendar", calendarPeriod],
    ["Workbench research cases", researchPeriod],
    ["Stored H4 prices", pricePeriod],
  ] as const;

  return (
    <main className="fms-workbench fms-workbench-table-ui">
      <header className="fms-workbench-header">
        <div><span className="fms-eyebrow">Retained research workspace</span><h2>FMS Experiment Workbench</h2><p>Declare bounded experiments, inspect immutable results, and freeze review candidates. No automatic setup promotion.</p></div>
        <div><button type="button" onClick={() => setGuideOpen(true)}><BookOpen size={14} />How to use the Workbench</button><button type="button" onClick={onRefresh} disabled={loading}><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh</button></div>
      </header>

      <nav className="fms-workbench-mode-tabs" aria-label="Workbench jobs">
        {(["declare", "run", "results", "archive"] as const).map((item) => <button key={item} type="button" className={workspaceMode === item ? "is-active" : ""} onClick={() => setWorkspaceMode(item)}>{item === "run" ? "Run status" : readable(item)}</button>)}
      </nav>

      {error ? <div className="fms-workbench-error"><AlertTriangle size={14} />{error}</div> : null}

      <section className="fms-table-section fms-workbench-context">
        <h3>Research context <span>Current model and stored-source coverage</span></h3>
        <table className="fms-literal-table fms-key-value-table"><tbody>
          <tr><th>Market</th><td><select aria-label="Research market" value={market} onChange={(event) => onMarketChange(event.target.value as FmsResearchMarket)}>{FX_PAIRS.map((pair) => <option key={pair.name} value={pair.name}>{pair.name}</option>)}</select></td><th>Reviewed Charts model</th><td>{workbench.currentModel.friendlyName} · {workbench.currentModel.displayId}</td></tr>
          <tr><th>Model ID</th><td>{workbench.currentModel.id}</td><th>Dataset fingerprint</th><td>{workbench.datasetFingerprint}</td></tr>
          <tr><th>Timeframe</th><td>{workbench.currentModel.timeframe}</td><th>Registered setups</th><td>{workbench.currentModel.registeredSetups.length} · promotion remains reviewed-only</td></tr>
        </tbody></table>
        <div className="fms-table-scroll"><table className="fms-literal-table"><thead><tr><th>Stored source</th><th>Years</th><th>Exact UTC range</th></tr></thead><tbody>{periods.map(([label, period]) => <tr key={label}><th>{label}</th><td>{period?.years ?? "Unavailable"}</td><td>{period?.dates ?? "Unavailable"}</td></tr>)}</tbody></table></div>
      </section>

      {workspaceMode === "declare" ? <div className="fms-workbench-declare-grid">
        <section className="fms-table-section">
          <h3>Choose economic setup <span>{filtered.length} catalog rows</span></h3>
          <label className="fms-inline-field">Search catalog<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Event family, title, or signature" /></label>
          <div className="fms-table-scroll fms-catalog-table-scroll"><table className="fms-literal-table fms-selectable-table"><thead><tr><th>Setup</th><th>Scope</th><th>N</th><th>Source</th></tr></thead><tbody>
            {filtered.map((item) => <tr key={item.id} className={selectedItem?.id === item.id ? "is-selected" : ""} onClick={() => { setCatalogId(item.id); setFriendlyName(`${item.label} experiment`); }}><td><button type="button" onClick={() => { setCatalogId(item.id); setFriendlyName(`${item.label} experiment`); }}>{item.label}</button><small>{item.family}</small></td><td>{item.direction === "both" ? "Both directions" : readable(item.direction)}</td><td>{item.historicalN}</td><td>{item.registered ? "Registered model" : item.sourceVersionId}</td></tr>)}
            {!filtered.length ? <tr><td colSpan={4}>No catalog rows match this search.</td></tr> : null}
          </tbody></table></div>
        </section>

        <section className="fms-table-section fms-declaration-form">
          <h3>Declare experiment <span>Nothing changes the reviewed Charts model</span></h3>
          {selectedItem ? <>
            <table className="fms-literal-table fms-key-value-table"><tbody>
              <tr><th>Selected setup</th><td>{selectedItem.label}</td><th>Catalog N</th><td>{selectedItem.historicalN}</td></tr>
              <tr><th>Signature</th><td>{selectedItem.signature}</td><th>Source version</th><td>{selectedItem.sourceVersionId}</td></tr>
            </tbody></table>

            <fieldset className="fms-button-field"><legend>Direction selection</legend>
              {selectedItem.directionVariants.map((variant) => <button key={variant.direction} type="button" className={directionSelection === variant.direction ? "is-active" : ""} onClick={() => setDirectionSelection(variant.direction)}>{readable(variant.direction)} · N {variant.historicalN}</button>)}
              {selectedItem.direction === "both" ? <button type="button" className={directionSelection === "both" ? "is-active" : ""} onClick={() => setDirectionSelection("both")}>Both directions · N {selectedItem.historicalN}</button> : null}
            </fieldset>

            {registeredSetup ? <div className="fms-registration-record"><h4>Registered recipe</h4><table className="fms-literal-table"><thead><tr><th>Why it was registered</th><th>Scoring</th><th>Reaction</th><th>Execution</th><th>Original outcomes</th><th>Gross evidence</th></tr></thead><tbody><tr><td>{registeredSetup.condition}</td><td>{scoringPolicyLabel(registeredSetup.scoringPolicy)}</td><td>{reactionLabel(registeredSetup.reaction)}</td><td>SL {registeredSetup.execution.stopAtr} ATR · TP {registeredSetup.execution.targetR}R · {registeredSetup.execution.expiryCandles} H4</td><td>{registrationEvidence ? `${registrationEvidence.evaluable} cases · ${registrationEvidence.targetFirst} target first · ${registrationEvidence.stopFirst} stop first · ${registrationEvidence.expired} expired` : "Unavailable in stored registration"}</td><td>{registrationEvidence ? `${formatR(registrationEvidence.stressedAverageR)} · ${registrationEvidence.positiveYears}/${registrationEvidence.evaluatedYears} positive years` : "Unavailable in stored registration"}</td></tr></tbody></table><p>Charts and Shadow Trader use this exact frozen scoring, reaction, and execution recipe.</p></div> : null}

            <div className="fms-declaration-fields">
              <label>How each release is scored<select value={policy} onChange={(event) => setPolicy(event.target.value as typeof policy)}>{workbench.protocol.scoringPolicies.map((item) => <option key={item} value={item}>{scoringPolicyLabel(item)}</option>)}</select><small>{scoringPolicyExplanation(policy)}</small></label>
              <label>Cases included<select value={selectedTreatment?.id ?? "base"} onChange={(event) => setTreatmentId(event.target.value)}>{availableTreatments.map((item) => <option key={item.id} value={item.id}>{item.label} · N {item.historicalN}</option>)}</select><small>{cohortExplanation(selectedTreatment)}</small></label>
            </div>
            {policy === "forecast_quality" ? <p className="fms-table-note"><strong>How Forecast Guard works:</strong> historically unreliable broker forecasts lose only the Surprise vote; Momentum and the original raw values remain available for audit.</p> : null}

            <fieldset className="fms-button-field"><legend>Execution search</legend><button type="button" className={mode === "single" ? "is-active" : ""} onClick={() => switchMode("single")}>Single Contract</button><button type="button" className={mode === "matrix" ? "is-active" : ""} onClick={() => switchMode("matrix")}>Combined Contracts</button></fieldset>
            <div className="fms-picker-grid"><ValuePicker label="SL (ATR)" values={workbench.protocol.stopAtrValues} selected={stops} multiple={mode === "matrix"} onChange={setStops} /><ValuePicker label="TP (R + ATR)" values={workbench.protocol.targetRValues} selected={targets} multiple={mode === "matrix"} onChange={setTargets} formatValue={(value) => `${value}R (${value * (stops[0] ?? 1)} ATR)`} /><ValuePicker label="Maximum trade duration (H4 candles)" values={workbench.protocol.holdingCandles} selected={holding} multiple={mode === "matrix"} onChange={setHolding} /></div>
            <label className="fms-inline-field">Experiment name<input value={friendlyName} onChange={(event) => setFriendlyName(event.target.value)} /></label>
            <button className="fms-primary-action" type="button" disabled={running || !friendlyName.trim() || !selectedTreatment} onClick={submit}><Play size={14} />Run recorded experiment</button>
            <p className="fms-table-note">Declared N {directionCount}. Entry is the first strictly later H4 open. Results are gross; spread, commission, slippage, and swap are excluded.</p>
          </> : <div className="fms-table-empty"><strong>No setup selected</strong></div>}
        </section>
      </div> : null}

      {workspaceMode === "run" ? <section className="fms-table-section">
        <h3>Run status <span>Recorded bridge jobs · select up to 4 rows for comparison</span></h3>
        <div className="fms-table-toolbar"><span>{comparisonIds.length} selected</span><button type="button" disabled={!comparisonIds.length} onClick={() => setWorkspaceMode("results")}>Compare selected</button></div>
        <table className="fms-literal-table fms-selectable-table"><thead><tr><th>Compare</th><th>Experiment</th><th>Setup</th><th>Status</th><th>Created</th><th>Configuration hash</th><th>Dataset fingerprint</th><th>Error</th></tr></thead><tbody>
          {workbench.experiments.map((item) => <tr key={item.id} className={selectedExperiment?.id === item.id ? "is-selected" : ""} onClick={() => { onSelectExperiment(item.id); setWorkspaceMode("results"); }}><td onClick={(event) => event.stopPropagation()}><input aria-label={`Compare ${item.friendlyName}`} type="checkbox" checked={comparisonIds.includes(item.id)} disabled={!comparisonIds.includes(item.id) && comparisonIds.length >= 4} onChange={(event) => setComparisonIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /></td><td><button type="button" onClick={(event) => { event.stopPropagation(); onSelectExperiment(item.id); setWorkspaceMode("results"); }}>{item.friendlyName}</button><small>{item.id}</small></td><td>{item.catalogSnapshot.label}</td><td>{readable(item.status)}</td><td>{formatTime(item.createdAt)}</td><td>{item.configurationHash}</td><td>{item.datasetFingerprint}</td><td>{item.error ?? "None recorded"}</td></tr>)}
          {!workbench.experiments.length ? <tr><td colSpan={8}>No recorded experiments for {market}.</td></tr> : null}
        </tbody></table>
      </section> : null}

      {workspaceMode === "results" ? <div className="fms-workbench-results-layout">
        {comparisonRows.length ? <section className="fms-table-section"><h3>Selected experiment comparison <span>{comparisonRows.length} immutable records</span></h3>{comparisonRows.length > 1 ? <p className="fms-table-note"><strong>Compatibility warning:</strong> the queue contract exposes identity and status only, not full scoring-policy, cohort, execution, or partition facts. Open each stored result before making cross-row performance inferences.</p> : null}<div className="fms-table-scroll"><table className="fms-literal-table"><thead><tr><th>Experiment</th><th>Setup</th><th>Status</th><th>Created</th><th>Configuration hash</th><th>Dataset fingerprint</th><th>Error</th></tr></thead><tbody>{comparisonRows.map((item) => <tr key={item.id}><td><button type="button" onClick={() => onSelectExperiment(item.id)}>{item.friendlyName}</button><small>{item.id}</small></td><td>{item.catalogSnapshot.label}</td><td>{readable(item.status)}</td><td>{formatTime(item.createdAt)}</td><td>{item.configurationHash}</td><td>{item.datasetFingerprint}</td><td>{item.error ?? "None recorded"}</td></tr>)}</tbody></table></div></section> : null}
        <section className="fms-table-section">
          <h3>Reaction Atlas <span>Stored cross-event reference · unavailable fields are not inferred</span></h3>
          {workbench.reactionAtlas ? <><div className="fms-table-scroll"><table className="fms-literal-table"><thead><tr><th>Event family</th><th>Currency</th><th>Pair</th><th>Direction rule</th><th>N</th><th>Respect rate</th><th>Signed MFE</th><th>Signed MAE</th><th>Horizon</th><th>Development</th><th>Holdout</th><th>Recent</th><th>Coverage</th><th>Classification</th></tr></thead><tbody>{workbench.reactionAtlas.rows.map((row) => <tr key={row.id}><td>{row.label}</td><td>Unavailable in stored atlas</td><td>{market}</td><td>Unavailable in stored atlas</td><td>{row.historicalN}</td><td>Unavailable in stored atlas</td><td>Unavailable in stored atlas</td><td>Unavailable in stored atlas</td><td>{row.horizonH4} H4</td><td>Unavailable in stored atlas</td><td>{formatR(row.holdoutAverageR)}</td><td>{formatR(row.recentAverageR)}</td><td>Unavailable in stored atlas</td><td>{row.classificationLabel}</td></tr>)}</tbody></table></div><table className="fms-literal-table fms-key-value-table"><tbody><tr><th>Atlas version</th><td>{workbench.reactionAtlas.version}</td><th>Artifact hash</th><td>{workbench.reactionAtlas.artifactHash}</td></tr><tr><th>Generated</th><td>{formatTime(workbench.reactionAtlas.generatedAt)}</td><th>Rows</th><td>{workbench.reactionAtlas.rows.length}</td></tr></tbody></table></> : <div className="fms-table-empty"><strong>Reaction Atlas unavailable</strong><span>No stored atlas artifact was returned for this market.</span></div>}
        </section>
        <ResultPanel experiment={selectedExperiment} onFreeze={onFreeze} busy={loading} />
      </div> : null}

      {workspaceMode === "archive" ? <div className="fms-workbench-archive">
        <section className="fms-table-section"><h3>Current registered setups <span>Reviewed Charts model</span></h3><table className="fms-literal-table"><thead><tr><th>ID</th><th>Setup</th><th>Condition</th><th>Scoring</th><th>Reaction</th><th>Execution</th><th>Registration evidence</th></tr></thead><tbody>{workbench.currentModel.registeredSetups.map((item) => <tr key={item.id}><td>{item.id}</td><td>{item.label}</td><td>{item.condition}</td><td>{scoringPolicyLabel(item.scoringPolicy)}</td><td>{reactionLabel(item.reaction)}</td><td>SL {item.execution.stopAtr} ATR · TP {item.execution.targetR}R · {item.execution.expiryCandles} H4</td><td>{item.registrationEvidence ? `N ${item.registrationEvidence.evaluable} · ${formatR(item.registrationEvidence.stressedAverageR)}` : "Unavailable in stored registration"}</td></tr>)}</tbody></table></section>
        <section className="fms-table-section"><h3>Frozen review candidates <span>Never promoted automatically</span></h3><table className="fms-literal-table fms-selectable-table"><thead><tr><th>Candidate</th><th>Experiment</th><th>Setup</th><th>Created</th><th>Failed gates acknowledged</th><th>Checks</th></tr></thead><tbody>{workbench.candidates.map((item) => <tr key={item.id} onClick={() => { onSelectExperiment(item.experimentId); setWorkspaceMode("results"); }}><td><button type="button" onClick={(event) => { event.stopPropagation(); onSelectExperiment(item.experimentId); setWorkspaceMode("results"); }}>{item.friendlyName}</button><small>{item.id}</small></td><td>{item.experimentId}</td><td>{item.catalogSnapshot.label}</td><td>{formatTime(item.createdAt)}</td><td>{item.failedGateAcknowledged ? "Yes" : "No"}</td><td>{Object.values(item.checks).filter(Boolean).length}/{Object.keys(item.checks).length} passed</td></tr>)}{!workbench.candidates.length ? <tr><td colSpan={6}>No frozen review candidates.</td></tr> : null}</tbody></table></section>
        <section className="fms-table-section"><h3>Research Archive <span>Legacy records remain available</span></h3><table className="fms-literal-table"><thead><tr><th>Record</th><th>Created</th><th>Latest run</th><th>Run status</th><th>Configuration hash</th><th>Dataset fingerprint</th><th>Error</th></tr></thead><tbody>{workbench.archive.map((item) => <tr key={item.id}><td>{item.id}</td><td>{formatTime(item.createdAt)}</td><td>{item.latestRun?.id ?? "Unavailable"}</td><td>{item.latestRun?.status ?? "Unavailable"}</td><td>{item.configurationHash}</td><td>{item.latestRun?.datasetFingerprint ?? "Unavailable"}</td><td>{item.latestRun?.error ?? "None recorded"}</td></tr>)}{!workbench.archive.length ? <tr><td colSpan={7}>No legacy research records.</td></tr> : null}</tbody></table></section>
        {workbench.contextFollowup ? <section className="fms-table-section"><h3>Context follow-up index <span>{workbench.contextFollowup.refreshPolicy ?? "Stored refresh policy unavailable"}</span></h3><table className="fms-literal-table"><thead><tr><th>Target</th><th>Source registration</th><th>Condition</th><th>Execution N</th><th>Average gross R</th><th>Reaction alignment</th></tr></thead><tbody>{workbench.contextFollowup.transferCandidates.map((item) => <tr key={item.id}><td>{item.targetMarket} · {item.targetLabel}</td><td>{item.sourceRegistrationId}</td><td>{item.condition.dimension ? `${readable(item.condition.dimension)} · ${readable(item.condition.value ?? "")}` : "All matching cases"}</td><td>{item.laterExecution.evaluableN}</td><td>{formatR(item.laterExecution.averageR)}</td><td>{formatPercent(item.laterReaction.alignmentRate)}</td></tr>)}{!workbench.contextFollowup.transferCandidates.length ? <tr><td colSpan={6}>No stored transfer candidates.</td></tr> : null}</tbody></table></section> : null}
      </div> : null}

      <FmsWorkbenchTutorial open={guideOpen} onClose={() => setGuideOpen(false)} />
    </main>
  );
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
