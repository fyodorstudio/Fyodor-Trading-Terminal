import { ChevronDown, ChevronUp, ExternalLink, Pause, Play, RotateCcw, StepForward, X } from "lucide-react";
import type { MacroFactorRow } from "@/app/lib/macroDrivers";
import type { CalendarEvent } from "@/app/types";

export interface ChartEventReleaseRow {
  key: string;
  event: CalendarEvent;
  timeLabel: string;
  actualLabel: string;
  forecastLabel: string;
  previousLabel: string;
  isFuture: boolean;
  replayAvailable: boolean;
}

export interface ChartEventLensData {
  releaseRows: ChartEventReleaseRow[];
  selectedEvent: CalendarEvent;
  selectedEventKey: string;
  selectedEventIsFuture: boolean;
  timeLabel: string;
  actualLabel: string;
  forecastLabel: string;
  previousLabel: string;
  surpriseLabel: string;
  observedMoveLabel: string;
  observedMoveDetail: string;
  replayAvailable: boolean;
  replayPlaying: boolean;
  replayProgressLabel: string;
  replaySpeed: number;
  replaySpeedOptions: number[];
  factorRows: MacroFactorRow[];
  coverageLabel: string;
  expanded: boolean;
  onSelectRelease: (event: CalendarEvent) => void;
  onToggleExpanded: () => void;
  onClose: () => void;
  onTogglePlayback: () => void;
  onResetReplay: () => void;
  onStepReplay: () => void;
  onReplaySpeedChange: (speed: number) => void;
  onOpenCalendar: (event: CalendarEvent) => void;
}

function formatFactorEvidence(row: MacroFactorRow): string {
  if (!row.latestEvent) return "No loaded release";
  return row.summary;
}

function formatNextEvent(row: MacroFactorRow): string {
  if (!row.nextEvent) return "No loaded event";
  return row.nextEvent.title;
}

export function ChartEventLens({ data }: { data: ChartEventLensData }) {
  return (
    <section className={`chart-event-lens ${data.expanded ? "is-expanded" : ""}`} aria-label="Lens">
      {!data.expanded ? (
        <button type="button" className="chart-event-lens-bookmark" onClick={data.onToggleExpanded} aria-expanded={false}>
          <span>Lens</span>
          <strong>Details</strong>
          <ChevronUp size={14} />
        </button>
      ) : (
        <>
          <div className="chart-event-lens-strip">
            <div className="chart-event-lens-title">
              <span>{data.selectedEventIsFuture ? "Scheduled Lens" : "Lens"}</span>
              <strong>{data.selectedEvent.currency} / {data.selectedEvent.title}</strong>
              <small>{data.timeLabel}</small>
              <small>{data.coverageLabel}</small>
            </div>
            <div className="chart-event-lens-actions">
              <button
                type="button"
                className="chart-event-lens-play"
                disabled={!data.replayAvailable}
                onClick={data.onTogglePlayback}
              >
                {data.replayPlaying ? <Pause size={14} /> : <Play size={14} />}
                {data.replayPlaying ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                className="chart-event-lens-toggle"
                onClick={data.onToggleExpanded}
                aria-expanded={data.expanded}
              >
                <ChevronDown size={14} />
                Collapse
              </button>
              <button type="button" className="chart-event-lens-icon" onClick={data.onClose} aria-label="Close Lens">
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="chart-event-lens-body chart-event-lens-table-body">
            <section className="chart-lens-table-section">
              <div className="chart-event-lens-section-head"><span>Selected release</span><button type="button" onClick={() => data.onOpenCalendar(data.selectedEvent)}><ExternalLink size={13} />Open in Calendar</button></div>
              <table className="chart-lens-table" aria-label="Selected event snapshot"><thead><tr><th>Actual</th><th>Forecast</th><th>Previous</th><th>Surprise</th><th>Observed move</th></tr></thead><tbody><tr><td>{data.actualLabel}</td><td>{data.forecastLabel}</td><td>{data.previousLabel}</td><td>{data.surpriseLabel}</td><td>{data.observedMoveLabel}<small>{data.observedMoveDetail}</small></td></tr></tbody></table>
            </section>

            <section className="chart-lens-table-section chart-lens-release-section">
              <div className="chart-event-lens-section-head"><span>Release navigator</span><strong>{data.releaseRows.length} loaded</strong></div>
              <div className="chart-lens-table-scroll"><table className="chart-lens-table chart-lens-selectable-table"><thead><tr><th>Release time</th><th>Status</th><th>Event</th><th>Actual</th><th>Forecast</th><th>Previous</th></tr></thead><tbody>
                {data.releaseRows.map((row) => <tr key={row.key} className={row.key === data.selectedEventKey ? "is-active" : ""} onClick={() => data.onSelectRelease(row.event)}><td><button type="button" onClick={() => data.onSelectRelease(row.event)}>{row.timeLabel}</button></td><td>{row.isFuture ? "Scheduled" : row.replayAvailable ? "Replay ready" : "Candles unavailable"}</td><td>{row.event.currency} · {row.event.title}</td><td>{row.actualLabel}</td><td>{row.forecastLabel}</td><td>{row.previousLabel}</td></tr>)}
                {!data.releaseRows.length ? <tr><td colSpan={6}>No loaded releases match this event name and currency.</td></tr> : null}
              </tbody></table></div>
            </section>

            <section className="chart-lens-table-section">
              <div className="chart-event-lens-section-head"><span>{data.selectedEventIsFuture ? "Replay unavailable" : "Replay controls"}</span><strong>{data.replayProgressLabel}</strong></div>
              <div className="chart-event-lens-replay-grid">
                <button type="button" onClick={data.onTogglePlayback} disabled={!data.replayAvailable}>{data.replayPlaying ? <Pause size={14} /> : <Play size={14} />}{data.replayPlaying ? "Pause" : "Play"}</button>
                <button type="button" onClick={data.onResetReplay} disabled={!data.replayAvailable}><RotateCcw size={14} />Reset</button>
                <button type="button" onClick={data.onStepReplay} disabled={!data.replayAvailable}><StepForward size={14} />Step</button>
                <label><span>Speed</span><select value={data.replaySpeed} onChange={(event) => data.onReplaySpeedChange(Number(event.target.value))}>{data.replaySpeedOptions.map((speed) => <option key={speed} value={speed}>{speed}x</option>)}</select></label>
              </div>
              {data.selectedEventIsFuture ? <p>This scheduled row cannot replay until matching candles are loaded.</p> : null}
            </section>

            <section className="chart-lens-table-section chart-lens-factor-section">
              <div className="chart-event-lens-section-head"><span>Base / quote evidence</span><strong>Loaded calendar evidence only</strong></div>
              <div className="chart-lens-table-scroll"><table className="chart-lens-table"><thead><tr><th>Currency</th><th>Factor</th><th>Latest loaded release</th><th>Next loaded event</th></tr></thead><tbody>{data.factorRows.map((row) => <tr key={`${row.currency}:${row.factor.id}`}><td>{row.currency}</td><td>{row.factor.label}</td><td>{formatFactorEvidence(row)}</td><td>{formatNextEvent(row)}</td></tr>)}{!data.factorRows.length ? <tr><td colSpan={4}>No base/quote evidence rows are loaded.</td></tr> : null}</tbody></table></div>
            </section>
          </div>
        </>
      )}
    </section>
  );
}
