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

function formatPercent(value: number | null | undefined): string {
  return value == null ? "-" : `${(value * 100).toFixed(0)}%`;
}

function configurationLabel(candidate: MacroSignalStressCandidate): string {
  const row = candidate.selectedConfiguration;
  return `${row.stopAtr} ATR stop / ${row.targetR}R target / ${row.holdingCandles} H4`;
}

function evidenceCondition(candidate: MacroSignalStressCandidate): string {
  const currencies = new Set(candidate.groups.map((group) => group.split(":", 1)[0]));
  const currency = currencies.size === 1 ? [...currencies][0] : "Mixed";
  const inflation = candidate.groups.some((group) => group.includes("inflation"));
  const evidenceSupportsLong = (currency === "EUR" && candidate.direction === "long")
    || (currency === "USD" && candidate.direction === "short");
  const evidenceState = inflation
    ? (evidenceSupportsLong ? "heating" : "cooling")
    : (evidenceSupportsLong ? "improving" : "weakening");
  return `${currency} ${inflation ? "inflation" : "evidence"} ${evidenceState}`;
}

function CandidateRows({ rows }: { rows: MacroSignalStressCandidate[] }) {
  return (
    <div className="macro-signal-expansion-table-scroll">
      <table className="macro-signal-expansion-table">
        <thead>
          <tr>
            <th>Setup</th>
            <th>Historical N</th>
            <th>Development</th>
            <th>Holdout</th>
            <th>Recent</th>
            <th>Years</th>
            <th>Nearby holdout +</th>
            <th>30-H4 path</th>
            <th>Development-selected exit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((candidate) => {
            const selected = candidate.selectedConfiguration;
            return (
              <tr key={`${candidate.sourceVersionId}-${candidate.signature}`}>
                <td>
                  <strong>{candidate.direction === "long" ? "Long" : "Short"} EURUSD - {candidate.label}</strong>
                  <small title={candidate.exampleTitles.join(" | ")}>{evidenceCondition(candidate)} - {candidate.groups.join(" + ")}</small>
                </td>
                <td>{candidate.historicalN}</td>
                <td>{formatR(selected.development.stressedAverageR)}<small>N {selected.development.evaluableCount}</small></td>
                <td>{formatR(selected.holdout.stressedAverageR)}<small>N {selected.holdout.evaluableCount}</small></td>
                <td>{formatR(selected.recent.stressedAverageR)}<small>N {selected.recent.evaluableCount}</small></td>
                <td>{selected.yearStability.positiveYears}/{selected.yearStability.evaluableYears}</td>
                <td title={candidate.configurationStability.definition}>
                  {formatPercent(candidate.configurationStability.holdout.positiveShare)}
                  <small>{candidate.configurationStability.holdout.positiveCount}/{candidate.configurationStability.holdout.count} nearby</small>
                </td>
                <td>
                  MFE {formatR(candidate.path30.mfeR.median)}
                  <small>MAE {formatR(candidate.path30.maeR.median)}</small>
                </td>
                <td>{configurationLabel(candidate)}</td>
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
          <span>{error ?? "Testing full post-signal paths and the declared stop/target/holding matrix in the background."}</span>
        </div>
      </section>
    );
  }

  const registered = report.candidates.filter((candidate) => candidate.currentRegistered);
  const screened = report.candidates.filter((candidate) => !candidate.currentRegistered && candidate.passesExploratoryScreen);
  const rejectedLeads = report.candidates
    .filter((candidate) => !candidate.currentRegistered && !candidate.passesExploratoryScreen)
    .slice(0, 8);
  const nextCandidate = screened[0] ?? null;
  const currentPassing = registered.filter((candidate) => candidate.passesExploratoryScreen).length;
  const registeredPatternCount = new Set(registered.map((candidate) => candidate.currentPatternId).filter(Boolean)).size;

  return (
    <section className="macro-signal-panel macro-signal-expansion" data-fms-expansion-report="">
      <div className="macro-signal-section-title">
        <FlaskConical size={16} /><h3>Path and exit stress research</h3>
        <button type="button" className="macro-signal-refresh-button" onClick={onRefresh} disabled={loading} aria-label="Refresh FMS path and exit research">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="macro-signal-expansion-summary">
        <div><span>Reportable / tested signatures</span><strong>{report.candidateCount}/{report.signaturesTested}</strong></div>
        <div><span>Exit configurations</span><strong>{report.configurationsTested.toLocaleString()}</strong></div>
        <div><span>Registered variants passing screen</span><strong>{currentPassing}/{registered.length}</strong></div>
        <div><span>New candidates passing screen</span><strong>{screened.length}</strong></div>
      </div>

      <div className="macro-signal-expansion-decision">
        <span>Best next setup to discuss</span>
        <strong>{nextCandidate ? `${evidenceCondition(nextCandidate)} -> ${nextCandidate.direction === "long" ? "Long" : "Short"} EURUSD` : "No unregistered candidate cleared the screen"}</strong>
        <p>{nextCandidate
          ? `${configurationLabel(nextCandidate)} was selected using development history only. It is reused-history research, its strict positive holdout lower-95 check did not pass, and it has not been registered.`
          : "The current matrix did not produce another candidate suitable for a freeze discussion."}</p>
      </div>

      <details open className="macro-signal-expansion-group">
        <summary>Registered current setups <span>{registeredPatternCount} setups / {registered.length} variants</span></summary>
        <CandidateRows rows={registered} />
        <p className="macro-signal-expansion-note">Rows are exact directional variants. This new flexible-exit screen diagnoses them; it does not remove or rewrite the frozen v9 registry.</p>
      </details>

      <details open className="macro-signal-expansion-group">
        <summary>Unregistered candidates clearing the exploratory screen <span>{screened.length}</span></summary>
        {screened.length ? <CandidateRows rows={screened} /> : <p className="macro-signal-expansion-note">No candidate cleared every declared screen.</p>}
      </details>

      <details className="macro-signal-expansion-group">
        <summary>Nearest rejected research leads <span>{rejectedLeads.length}</span></summary>
        <CandidateRows rows={rejectedLeads} />
      </details>

      <div className="macro-signal-expansion-foot">
        <p><strong>How to read this:</strong> MFE is the best move available after entry; MAE is the worst adverse move. Neither was knowable at signal time. The selected exit maximizes the older development lower-confidence bound, not the newer holdout result.</p>
        <p><strong>Boundary:</strong> this report tried many configurations on reused history. Passing its screen identifies a candidate for a separately frozen version; it does not authorize a new current arrow.</p>
        <span>Protocol {report.protocolHash.slice(0, 12)} - {report.protocol.stressPips} pip result stress - exact costs excluded</span>
      </div>
    </section>
  );
}
