import { formatDateOnly, formatRelativeAge } from "@/app/lib/format";
import type { BridgeStatus, CentralBankSnapshot } from "@/app/types";

interface CentralBanksTabProps {
  snapshots: CentralBankSnapshot[];
  logs: string[];
  status: BridgeStatus;
  lastCalendarIngestAt: number | null;
}

function renderValue(value: string | null): string {
  return value && value.trim() !== "" ? value : "N/A";
}

export function CentralBanksTab({
  snapshots,
  logs,
  status,
  lastCalendarIngestAt,
}: CentralBanksTabProps) {
  const okCount = snapshots.filter((item) => item.status === "ok").length;
  const partialCount = snapshots.filter((item) => item.status === "partial").length;
  const missingCount = snapshots.filter((item) => item.status === "missing").length;

  return (
    <section className="tab-panel">
      <div className="section-head">
        <div>
          <h2>Central Banks Data</h2>
          <p>Strictly derived from MT5 calendar events for the major eight currencies.</p>
        </div>
        <div className="section-metrics">
          <span className="metric-chip">{okCount}/8 mapped</span>
          <span className="metric-chip">{partialCount} partial</span>
          <span className="metric-chip">{missingCount} missing</span>
        </div>
      </div>

      <div className="status-strip">
        <span className={`status-pill status-${status}`}>
          {status === "live" && "Live MT5 feed"}
          {status === "loading" && "Loading feed"}
          {status === "stale" && "Feed may be stale"}
          {status === "no_data" && "NO DATA"}
          {status === "error" && "Bridge unavailable"}
        </span>
        <span className="status-note">Calendar ingest: {formatRelativeAge(lastCalendarIngestAt)}</span>
      </div>

      <div className="data-table-shell">
        <table className="data-table central-table">
          <thead>
            <tr>
              <th>Bank</th>
              <th>Policy Rate</th>
              <th>Previous</th>
              <th>Inflation YoY</th>
              <th>Previous</th>
              <th>Last Releases</th>
              <th>Next Events</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((snapshot) => (
              <tr key={snapshot.currency}>
                <td>
                  <div className="bank-cell">
                    <span className="code-flag">{snapshot.flag}</span>
                    <div>
                      <strong>{snapshot.bankName}</strong>
                      <span>{snapshot.currency}</span>
                    </div>
                  </div>
                </td>
                <td>{renderValue(snapshot.currentPolicyRate)}</td>
                <td>{renderValue(snapshot.previousPolicyRate)}</td>
                <td>{renderValue(snapshot.currentInflationRate)}</td>
                <td>{renderValue(snapshot.previousInflationRate)}</td>
                <td>
                  <div className="stacked-cell">
                    <span>Rate: {formatDateOnly(snapshot.lastRateReleaseAt)}</span>
                    <span>CPI: {formatDateOnly(snapshot.lastCpiReleaseAt)}</span>
                  </div>
                </td>
                <td>
                  <div className="stacked-cell">
                    <span>{snapshot.nextRateEventAt ? formatDateOnly(snapshot.nextRateEventAt) : "Rate: N/A"}</span>
                    <span>{snapshot.nextCpiEventAt ? formatDateOnly(snapshot.nextCpiEventAt) : "CPI: N/A"}</span>
                  </div>
                </td>
                <td>
                  <span className={`table-state table-state-${snapshot.status}`}>
                    {snapshot.status === "ok" && "OK"}
                    {snapshot.status === "partial" && "Partial"}
                    {snapshot.status === "missing" && "N/A"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="log-panel">
        <div className="log-head">
          <h3>Mapping Audit</h3>
          <span>{logs.length === 0 ? "No unresolved mapping notes." : `${logs.length} notes`}</span>
        </div>
        <div className="log-body" role="log">
          {logs.length === 0 ? (
            <div className="log-empty">All eight mappings resolved with the current bridge feed.</div>
          ) : (
            logs.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)
          )}
        </div>
      </div>
    </section>
  );
}
