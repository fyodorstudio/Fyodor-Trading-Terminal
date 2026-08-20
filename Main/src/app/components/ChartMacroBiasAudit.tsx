import { X } from "lucide-react";
import type { MacroSignalChartPattern, MacroSignalChartSignal } from "@/app/types";

export interface ChartMacroBiasAuditData {
  signal: MacroSignalChartSignal;
  pattern: MacroSignalChartPattern;
  versionId: string;
  targetR: number;
  generatedAt?: number;
  onClose: () => void;
}

function formatPercent(value: number | null): string {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function formatR(value: number | null): string {
  return value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

export function ChartMacroBiasAudit({ data }: { data: ChartMacroBiasAuditData }) {
  const { signal, pattern } = data;
  const historicalReplay = data.generatedAt != null && signal.eventTime <= data.generatedAt;
  return (
    <aside className="chart-macro-bias-audit" aria-label={`${signal.direction} macro bias audit`}>
      <header>
        <div>
          <span>{historicalReplay ? "Historical research replay" : "Post-qualification pattern"} · experimental</span>
          <strong>{signal.direction === "long" ? "Long EURUSD bias" : "Short EURUSD bias"}</strong>
          <small>{pattern.label} · {new Date(signal.eventTime * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC</small>
        </div>
        <button type="button" onClick={data.onClose} aria-label="Close macro bias audit"><X size={15} /></button>
      </header>
      <div className="chart-macro-bias-stats">
        <div><span>Historical N</span><strong>{pattern.overall.evaluableCount}</strong></div>
        <div><span>{data.targetR}R target first</span><strong>{formatPercent(pattern.overall.targetHitRate)}</strong></div>
        <div><span>Average</span><strong>{formatR(pattern.overall.averageR)}</strong></div>
        <div><span>Holdout</span><strong>{formatR(pattern.holdout.averageR)}</strong></div>
      </div>
      <div className="chart-macro-bias-splits">
        <span>Development: N {pattern.development.evaluableCount} · {formatR(pattern.development.averageR)}</span>
        <span>Later holdout: N {pattern.holdout.evaluableCount} · {formatR(pattern.holdout.averageR)}</span>
      </div>
      <div className="chart-macro-bias-events">
        {signal.events.map((event) => (
          <div key={`${event.id}:${event.time}`}>
            <strong>{event.currency}/{event.countryCode} · {event.title}</strong>
            <span>A {event.actual || "—"} · F {event.forecast || "—"} · P {event.previous || "—"} · score {event.score > 0 ? "+" : ""}{event.score}</span>
          </div>
        ))}
      </div>
      <footer>
        {data.versionId} · Gross historical simulation; spread, slippage, swap, and commission are excluded. {historicalReplay ? "This old arrow is a hindsight research replay and was not available in real time." : "This release matched a pattern fixed from earlier history."} Not a guaranteed outcome or automatic order.
      </footer>
    </aside>
  );
}
