import { CalendarDays, ChevronDown, ExternalLink, Pause, Pin, Play, RotateCcw, StepForward, X } from "lucide-react";
import { getChartEventKey } from "@/app/lib/chartEvents";
import type { MacroFactorRow } from "@/app/lib/macroDrivers";
import type { CalendarEvent } from "@/app/types";

export interface ChartEventLensData {
  clusterEvents: Array<{ event: CalendarEvent; timeLabel: string }>;
  selectedEvent: CalendarEvent;
  selectedEventKey: string;
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
  pinned: boolean;
  onSelectEvent: (event: CalendarEvent) => void;
  onTogglePinned: () => void;
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
    <section className={`chart-event-lens ${data.pinned ? "is-pinned" : ""}`} aria-label="Event Lens">
      <div className="chart-event-lens-strip">
        <div className="chart-event-lens-title">
          <span>Event Lens</span>
          <strong>{data.selectedEvent.currency} / {data.selectedEvent.title}</strong>
          <small>{data.timeLabel}</small>
        </div>
        <div className="chart-event-lens-metrics" aria-label="Selected event snapshot">
          <span><b>Actual</b>{data.actualLabel}</span>
          <span><b>Forecast</b>{data.forecastLabel}</span>
          <span><b>Previous</b>{data.previousLabel}</span>
          <span><b>Surprise</b>{data.surpriseLabel}</span>
          <span><b>Move</b>{data.observedMoveLabel}</span>
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
          <button type="button" className="chart-event-lens-icon" onClick={data.onTogglePinned} aria-label={data.pinned ? "Unpin Event Lens" : "Pin Event Lens"}>
            <Pin size={14} />
          </button>
          <button type="button" className="chart-event-lens-icon" onClick={data.onClose} aria-label="Close Event Lens">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="chart-event-lens-body">
        <div className="chart-event-lens-left">
          <div className="chart-event-lens-section">
            <div className="chart-event-lens-section-head">
              <span>Loaded cluster</span>
              <strong>{data.clusterEvents.length} event{data.clusterEvents.length === 1 ? "" : "s"}</strong>
            </div>
            <div className="chart-event-lens-cluster-list">
              {data.clusterEvents.map(({ event, timeLabel }) => {
                const key = getChartEventKey(event);
                return (
                  <button
                    key={key}
                    type="button"
                    className={key === data.selectedEventKey ? "is-active" : ""}
                    onClick={() => data.onSelectEvent(event)}
                  >
                    <span>
                      <b>{event.currency}</b>
                      <small>{event.impact}</small>
                    </span>
                    <strong>{event.title}</strong>
                    <em>{timeLabel}</em>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="chart-event-lens-section">
            <div className="chart-event-lens-section-head">
              <span>Replay</span>
              <strong>{data.replayProgressLabel}</strong>
            </div>
            <div className="chart-event-lens-replay-grid">
              <button type="button" onClick={data.onTogglePlayback} disabled={!data.replayAvailable}>
                {data.replayPlaying ? <Pause size={14} /> : <Play size={14} />}
                {data.replayPlaying ? "Pause" : "Play"}
              </button>
              <button type="button" onClick={data.onResetReplay} disabled={!data.replayAvailable}>
                <RotateCcw size={14} />
                Reset
              </button>
              <button type="button" onClick={data.onStepReplay} disabled={!data.replayAvailable}>
                <StepForward size={14} />
                Step
              </button>
              <label>
                <span>Speed</span>
                <select value={data.replaySpeed} onChange={(event) => data.onReplaySpeedChange(Number(event.target.value))}>
                  {data.replaySpeedOptions.map((speed) => (
                    <option key={speed} value={speed}>{speed}x</option>
                  ))}
                </select>
              </label>
            </div>
            <p>{data.observedMoveDetail}</p>
          </div>
        </div>

        <div className="chart-event-lens-right">
          <div className="chart-event-lens-section-head">
            <span>Base / quote evidence</span>
            <button type="button" onClick={() => data.onOpenCalendar(data.selectedEvent)}>
              <ExternalLink size={13} />
              Open in Calendar
            </button>
          </div>
          <div className="chart-event-lens-factor-table">
            <div className="chart-event-lens-factor-head">
              <span>Factor</span>
              <span>Latest loaded release</span>
              <span>Next loaded event</span>
            </div>
            {data.factorRows.map((row) => (
              <div key={`${row.currency}:${row.factor.id}`} className="chart-event-lens-factor-row">
                <strong>
                  <small>{row.currency}</small>
                  {row.factor.label}
                </strong>
                <span>{formatFactorEvidence(row)}</span>
                <em>{formatNextEvent(row)}</em>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button type="button" className="chart-event-lens-expand-hint" onClick={data.onTogglePinned}>
        <ChevronDown size={14} />
      </button>
    </section>
  );
}
