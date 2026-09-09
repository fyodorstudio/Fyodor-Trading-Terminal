import { X } from "lucide-react";
import { buildChartMacroBiasAuditViewModel } from "@/app/lib/chartMacroBiasAuditViewModel";
import type { ChartMacroBiasAuditData } from "@/app/lib/chartMacroBiasAuditViewModel";

export type { ChartMacroBiasAuditData } from "@/app/lib/chartMacroBiasAuditViewModel";

export function ChartMacroBiasAudit({ data }: { data: ChartMacroBiasAuditData }) {
  const view = buildChartMacroBiasAuditViewModel(data);
  return (
    <aside className="chart-macro-bias-audit" aria-label={view.ariaLabel}>
      <header>
        <div>
          <span>{view.kicker}</span>
          <strong>{view.title}</strong>
          <small>{view.subtitle}</small>
        </div>
        <button type="button" onClick={data.onClose} aria-label="Close macro bias audit"><X size={15} /></button>
      </header>

      <table className="chart-macro-bias-audit-table" aria-label="Past result audit table">
        <colgroup><col className="is-field" /><col className="is-value" /><col className="is-detail" /></colgroup>
        <thead><tr><th>Field</th><th>Value</th><th>Details</th></tr></thead>
        <tbody>{view.rows.map((row, index) => row.kind === "section"
          ? <tr key={`section:${row.label}:${index}`} className="is-section"><th colSpan={3}>{row.label}</th></tr>
          : <tr key={`row:${row.field}:${index}`} className={row.tone ? `is-${row.tone}` : undefined}>
              <th>{row.field}</th><td>{row.value}</td><td>{row.details}{row.action === "retry-detail" ? <button type="button" onClick={data.onRetryDetail}>Retry detail</button> : null}</td>
            </tr>)}</tbody>
      </table>
    </aside>
  );
}
