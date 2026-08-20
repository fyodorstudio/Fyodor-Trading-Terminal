import { AlertTriangle, FlaskConical, RefreshCw } from "lucide-react";
import type { MacroSignalExpansionReport, MacroSignalStressCandidate } from "@/app/types";

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

  return (
    <section className="macro-signal-panel macro-signal-expansion" data-fms-expansion-report="">
      <div className="macro-signal-section-title">
        <FlaskConical size={16} /><h3>Path and exit stress research</h3>
        <span>Charts registry {report.modelId.split("-").slice(-1)[0]}</span>
        <button type="button" className="macro-signal-refresh-button" onClick={onRefresh} disabled={loading} aria-label="Refresh FMS path and exit research">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <section className="macro-signal-expansion-list" aria-label="Registered FMS setups">
        <header><h4>Registered setups</h4><span>{registered.length} directional variants</span></header>
        {registered.length ? <CandidateTable rows={registered} registered /> : <p>No setup is registered in this model.</p>}
      </section>

      <section className="macro-signal-expansion-list" aria-label="Potential FMS setups">
        <header><h4>Potential setups · not registered</h4><span>{potential.length} researched variants</span></header>
        {potential.length ? <CandidateTable rows={potential} registered={false} /> : <p>No unregistered candidate is available.</p>}
      </section>

      <p className="macro-signal-expansion-note">
        Development selected each tested exit. Holdout and recent history are checks, not selectors. Results reuse history and exclude exact trading costs.
      </p>
    </section>
  );
}
