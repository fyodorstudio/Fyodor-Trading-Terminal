import { AlertTriangle, FlaskConical, RefreshCw } from "lucide-react";
import type { MacroSignalExpansionReport, MacroSignalRobustnessVariant, MacroSignalStressCandidate } from "@/app/types";

interface MacroSignalExpansionResearchProps {
  report: MacroSignalExpansionReport | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function formatR(value: number | null | undefined): string {
  if (value == null) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function selectedExit(candidate: MacroSignalStressCandidate): string {
  const row = candidate.currentRegistered && candidate.registeredExecution
    ? { ...candidate.registeredExecution, holdingCandles: candidate.registeredExecution.expiryCandles }
    : candidate.selectedConfiguration;
  return `${row.stopAtr} ATR / ${row.targetR}R / ${row.holdingCandles} H4`;
}

function CandidateTable({ rows, registered }: { rows: MacroSignalStressCandidate[]; registered: boolean }) {
  return (
    <div className="macro-signal-expansion-table-scroll">
      <table className="macro-signal-expansion-table">
        <thead>
          <tr>
            <th>Setup</th>
            <th>N</th>
            <th>{registered ? "Frozen exit" : "Best tested exit"}</th>
            <th>Development</th>
            <th>Holdout</th>
            <th>Recent</th>
            <th>Positive years</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((candidate) => {
            const selected = registered
              ? candidate.registeredConfiguration ?? candidate.selectedConfiguration
              : candidate.selectedConfiguration;
            return (
              <tr key={`${candidate.sourceVersionId}-${candidate.signature}`}>
                <td>
                  <strong>{candidate.direction === "long" ? "Long" : "Short"} EURUSD · {candidate.label}</strong>
                  <small title={candidate.exampleTitles.join(" | ")}>{candidate.groups.join(" + ")}</small>
                </td>
                <td>{candidate.historicalN}</td>
                <td>{selectedExit(candidate)}</td>
                <td>{formatR(selected.development.stressedAverageR)}<small>N {selected.development.evaluableCount}</small></td>
                <td>{formatR(selected.holdout.stressedAverageR)}<small>N {selected.holdout.evaluableCount}</small></td>
                <td>{formatR(selected.recent.stressedAverageR)}<small>N {selected.recent.evaluableCount}</small></td>
                <td>{selected.yearStability.positiveYears}/{selected.yearStability.evaluableYears}</td>
                <td>
                  <strong>{registered ? "Registered v10" : candidate.passesExploratoryScreen ? "Passed screen" : "Needs work"}</strong>
                  {!registered && !candidate.passesStrictHoldoutCheck ? <small>95% holdout check not met</small> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function readableCohort(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readablePolicy(value: string): string {
  return value === "momentum_only" ? "Momentum only" : value === "forecast_quality" ? "Forecast-quality gate" : "Forecast + Previous baseline";
}

function RobustnessTable({ rows }: { rows: MacroSignalRobustnessVariant[] }) {
  return (
    <div className="macro-signal-expansion-table-scroll">
      <table className="macro-signal-expansion-table macro-signal-robustness-table">
        <thead><tr><th>Pattern</th><th>Numeric cohort</th><th>N</th><th>Best tested exit</th><th>Development</th><th>Holdout</th><th>Recent</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((variant, index) => {
            const selected = variant.selectedConfiguration;
            const baseDirection = variant.direction ?? "long";
            const direction = variant.reaction === "contrarian"
              ? (baseDirection === "long" ? "Short" : "Long")
              : (baseDirection === "long" ? "Long" : "Short");
            return (
              <tr key={`${variant.sourceVersionId}-${variant.signature}-${variant.dimension}-${variant.cohort}-${index}`}>
                <td><strong>{direction} EURUSD · {variant.label}</strong><small>{variant.reaction === "contrarian" ? "Opposite/rejection response" : "Evidence-direction response"}</small></td>
                <td><strong>{variant.dimensionLabel}</strong><small>{readableCohort(variant.cohort)}</small></td>
                <td>{variant.historicalN}</td>
                <td>{selected.stopAtr} ATR / {selected.targetR}R / {selected.holdingCandles} H4</td>
                <td>{formatR(selected.development.stressedAverageR)}<small>N {selected.development.evaluableCount}</small></td>
                <td>{formatR(selected.holdout.stressedAverageR)}<small>N {selected.holdout.evaluableCount}</small></td>
                <td>{formatR(selected.recent.stressedAverageR)}<small>N {selected.recent.evaluableCount}</small></td>
                <td><strong>{variant.passesStrictHoldoutCheck ? "Strict pass" : variant.passesExploratoryScreen ? "Passed screen" : "Research split"}</strong><small>Reused history</small></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function MacroSignalExpansionResearch({ report, loading, error, onRefresh }: MacroSignalExpansionResearchProps) {
  if (!report) {
    return (
      <section className="macro-signal-panel macro-signal-expansion" aria-busy={loading}>
        <div className="macro-signal-section-title">
          <FlaskConical size={16} /><h3>Path and exit stress research</h3>
          <button type="button" className="macro-signal-refresh-button" onClick={onRefresh} disabled={loading} aria-label="Refresh FMS path and exit research">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="macro-signal-expansion-loading">
          {error ? <AlertTriangle size={16} /> : <RefreshCw size={16} className={loading ? "animate-spin" : ""} />}
          <span>{error ?? "Loading the cached setup registry and research candidates."}</span>
        </div>
      </section>
    );
  }

  const registered = report.candidates.filter((candidate) => candidate.currentRegistered);
  const potential = report.candidates.filter((candidate) => !candidate.currentRegistered);
  const robustnessLeads = report.robustnessLeads ?? [];
  const passedRobustness = robustnessLeads.filter((variant) => variant.passesExploratoryScreen);
  const visibleRobustness = passedRobustness.length ? passedRobustness : robustnessLeads.slice(0, 16);
  const v12 = report.v12Challenger;

  return (
    <section className="macro-signal-panel macro-signal-expansion" data-fms-expansion-report="">
      <div className="macro-signal-section-title">
        <FlaskConical size={16} /><h3>Path and exit stress research</h3>
        <span>{report.researchVersionId?.split("-").slice(-1)[0] ?? "v11"} research · Charts stays {report.modelId.split("-").slice(-1)[0]}</span>
        <button type="button" className="macro-signal-refresh-button" onClick={onRefresh} disabled={loading} aria-label="Refresh FMS path and exit research">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {v12 ? (
        <section className="macro-signal-expansion-list" aria-label="FMS v12 challenger decision">
          <header>
            <h4>V12 scoring and setup decision</h4>
            <span>{v12.registryDecision === "create_v12" ? `${v12.promotedPatternIds.length} promoted` : "No promotion · v10 retained"}</span>
          </header>
          <p className="macro-signal-expansion-note">
            <b>Selected input:</b> {readablePolicy(v12.selectedPolicy)}. {v12.policyComparisons.map((row) => `${readablePolicy(row.policy)} H ${formatR(row.holdout.stressedAverageR)} / recent ${formatR(row.recent.stressedAverageR)}`).join(" · ")}. {v12.forecastQualityAudits.reduce((sum, row) => sum + row.excludedForecastCount, 0)} suspect Forecast values were ignored only by the quality challenger; raw MT5 values remain unchanged.
          </p>
          <div className="macro-signal-expansion-table-scroll">
            <table className="macro-signal-expansion-table">
              <thead><tr><th>Fixed challenger</th><th>N</th><th>Tested exit</th><th>Development</th><th>Holdout</th><th>Recent</th><th>Typical move</th><th>Decision</th></tr></thead>
              <tbody>{v12.candidates.map((candidate) => (
                <tr key={candidate.id}>
                  <td><strong>{candidate.direction === "long" ? "Long" : "Short"} EURUSD · {candidate.label}</strong><small>{candidate.condition}</small></td>
                  <td>{candidate.historicalN}</td>
                  <td>{candidate.selectedConfiguration.stopAtr} ATR / {candidate.selectedConfiguration.targetR}R / {candidate.selectedConfiguration.holdingCandles} H4</td>
                  <td>{formatR(candidate.selectedConfiguration.development.stressedAverageR)}</td>
                  <td>{formatR(candidate.selectedConfiguration.holdout.stressedAverageR)}</td>
                  <td>{formatR(candidate.selectedConfiguration.recent.stressedAverageR)}</td>
                  <td>{candidate.typicalMfePips == null ? "—" : `${candidate.typicalMfePips.toFixed(0)} favorable pips`}<small>{candidate.typicalMaePips == null ? "" : `${candidate.typicalMaePips.toFixed(0)} adverse pips`}</small></td>
                  <td><strong>{candidate.promoted ? "Registered v12" : "Failed gate"}</strong><small>{Object.entries(candidate.checks).filter(([, passed]) => !passed).map(([name]) => readableCohort(name)).join(", ") || "All checks passed"}</small></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="macro-signal-expansion-list" aria-label="Registered FMS setups">
        <header><h4>Registered setups</h4><span>{registered.length} directional variants</span></header>
        {registered.length ? <CandidateTable rows={registered} registered /> : <p>No setup is registered in this model.</p>}
      </section>

      <section className="macro-signal-expansion-list" aria-label="Potential FMS setups">
        <header><h4>Potential setups · not registered</h4><span>{potential.length} researched variants</span></header>
        {potential.length ? <CandidateTable rows={potential} registered={false} /> : <p>No unregistered candidate is available.</p>}
      </section>

      <section className="macro-signal-expansion-list" aria-label="FMS v11 numeric robustness cohorts">
        <header><h4>V11 numeric robustness cohorts</h4><span>{passedRobustness.length} passed screen · {report.robustnessVariantsTested ?? 0} tested</span></header>
        {visibleRobustness.length ? <RobustnessTable rows={visibleRobustness} /> : <p>No numeric cohort has enough evaluable history yet.</p>}
      </section>

      <p className="macro-signal-expansion-note">
        V11 separately tests S/M agreement, revision reliability, package completeness, Before alignment, vote strength, and opposite/rejection responses. Development selects each exit; holdout and recent history only check it. V10 arrows are unchanged.
      </p>
    </section>
  );
}
