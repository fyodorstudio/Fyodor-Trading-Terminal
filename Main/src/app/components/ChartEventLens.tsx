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
    <section className={`chart-event-lens ${data.expanded ? "is-expanded" : ""}`} aria-label="Event Lens">
      {!data.expanded ? (
        <button type="button" className="chart-event-lens-bookmark" onClick={data.onToggleExpanded} aria-expanded={false}>
          <span>Event Lens</span>
          <strong>Details</strong>
          <ChevronUp size={14} />
        </button>
      ) : (
        <>
          <div className="chart-event-lens-strip">
            <div className="chart-event-lens-title">
              <span>{data.selectedEventIsFuture ? "Scheduled Event Lens" : "Event Lens"}</span>
              <strong>{data.selectedEvent.currency} / {data.selectedEvent.title}</strong>
              <small>{data.timeLabel}</small>
              <small>{data.coverageLabel}</small>
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
              <button
                type="button"
                className="chart-event-lens-toggle"
                onClick={data.onToggleExpanded}
                aria-expanded={data.expanded}
              >
                <ChevronDown size={14} />
                Collapse
              </button>
              <button type="button" className="chart-event-lens-icon" onClick={data.onClose} aria-label="Close Event Lens">
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="chart-event-lens-body">
              <div className="chart-event-lens-left">
                <div className="chart-event-lens-section chart-event-lens-release-section">
                  <div className="chart-event-lens-section-head">
                    <span>Release navigator</span>
                    <strong>{data.releaseRows.length} loaded</strong>
                  </div>
                  <div className="chart-event-lens-release-list">
                    {data.releaseRows.map((row) => {
                      return (
                        <button
                          key={row.key}
                          type="button"
                          className={row.key === data.selectedEventKey ? "is-active" : ""}
                          onClick={() => data.onSelectRelease(row.event)}
                        >
                          <span>
                            <b>{row.timeLabel}</b>
                            <small>{row.isFuture ? "Scheduled" : row.replayAvailable ? "Replay ready" : "No candles"}</small>
                          </span>
                          <strong>{row.event.title}</strong>
                          <em>
                            Actual {row.actualLabel} / Forecast {row.forecastLabel} / Previous {row.previousLabel}
                          </em>
                        </button>
                      );
                    })}
                    {data.releaseRows.length === 0 ? (
                      <p>No loaded releases match this event name and currency yet.</p>
                    ) : null}
                  </div>
                </div>

                <div className="chart-event-lens-section chart-event-lens-replay-section">
                  <div className="chart-event-lens-section-head">
                    <span>{data.selectedEventIsFuture ? "Replay unavailable" : "Replay"}</span>
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
                  <p>
                    {data.selectedEventIsFuture
                      ? "This is a future scheduled calendar row. Replay becomes available after matching candles are loaded."
                      : data.observedMoveDetail}
                  </p>
                </div>
              </div>

              <div className="chart-event-lens-right chart-event-lens-evidence-panel">
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
        </>
      )}
    </section>
  );
}
