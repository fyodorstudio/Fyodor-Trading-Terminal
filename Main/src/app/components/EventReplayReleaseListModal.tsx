import { X } from "lucide-react";
import { getReplayCalendarTitle } from "@/app/lib/eventReplayView";
import { formatUtcDateTime } from "@/app/lib/format";
import type { ReactionReplaySample } from "@/app/types";

function formatReplaySurprise(value: number): string {
  if (!Number.isFinite(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(4)}`;
}

function EventSampleButton(props: {
  sample: ReactionReplaySample;
  active: boolean;
  onSelect: () => void;
}) {
  const valueCardClass = props.active ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50";
  const labelClass = "text-slate-400";
  const surpriseTone =
    props.sample.surprise > 0
      ? props.active
        ? "text-emerald-200"
        : "text-emerald-700"
      : props.sample.surprise < 0
        ? props.active
          ? "text-rose-200"
          : "text-rose-700"
        : props.active
          ? "text-slate-100"
          : "text-slate-950";

  return (
    <button
      type="button"
      onClick={props.onSelect}
      className={`min-w-0 w-full overflow-hidden rounded-xl border px-4 py-3 text-left transition-colors ${
        props.active
          ? "border-slate-900 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-900 hover:border-blue-200 hover:bg-blue-50/40"
      }`}
    >
      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <span className="min-w-0">
          <span className={`block text-[10px] font-black uppercase tracking-[0.16em] ${labelClass}`}>Release time</span>
          <strong className="mt-1 block min-w-0 break-words text-base leading-6">{formatUtcDateTime(props.sample.eventTime)}</strong>
        </span>
        <span
          className={`inline-flex h-7 items-center justify-center self-start rounded-full border px-2.5 text-[11px] font-black ${
            props.active ? "border-slate-700 bg-slate-800 text-slate-100" : "border-blue-100 bg-blue-50 text-blue-700"
          }`}
        >
          vs {props.sample.comparisonBasis === "forecast" ? "Forecast" : "Previous"}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <span className={`rounded-lg border px-2.5 py-2 ${valueCardClass}`}>
          <span className={`block text-[10px] font-black uppercase tracking-[0.12em] ${labelClass}`}>Actual</span>
          <strong className="mt-1 block break-words text-xs leading-5">{props.sample.actual || "N/A"}</strong>
        </span>
        <span className={`rounded-lg border px-2.5 py-2 ${valueCardClass}`}>
          <span className={`block text-[10px] font-black uppercase tracking-[0.12em] ${labelClass}`}>Forecast</span>
          <strong className="mt-1 block break-words text-xs leading-5">{props.sample.forecast || "N/A"}</strong>
        </span>
        <span className={`rounded-lg border px-2.5 py-2 ${valueCardClass}`}>
          <span className={`block text-[10px] font-black uppercase tracking-[0.12em] ${labelClass}`}>Previous</span>
          <strong className="mt-1 block break-words text-xs leading-5">{props.sample.previous || "N/A"}</strong>
        </span>
        <span className={`rounded-lg border px-2.5 py-2 ${valueCardClass}`}>
          <span className={`block text-[10px] font-black uppercase tracking-[0.12em] ${labelClass}`}>Surprise</span>
          <strong className={`mt-1 block break-words text-xs leading-5 ${surpriseTone}`}>
            {formatReplaySurprise(props.sample.surprise)}
          </strong>
        </span>
      </div>
    </button>
  );
}

function EventReplayReleaseCalendar(props: {
  focusTime: number | null;
  cells: Array<{
    key: string;
    day: number;
    inMonth: boolean;
    hasRelease: boolean;
  }>;
  selectedDateKey: string | null;
  hoveredDateKey: string | null;
}) {
  return (
    <aside className="event-replay-release-calendar">
      <div className="event-replay-release-calendar-head">
        <span>Release calendar</span>
        <strong>{props.focusTime ? getReplayCalendarTitle(props.focusTime) : "Loaded month"}</strong>
      </div>
      <div className="event-replay-calendar-weekdays" aria-hidden="true">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="event-replay-calendar-grid">
        {props.cells.map((cell) => {
          const selected = props.selectedDateKey === cell.key;
          const hovered = props.hoveredDateKey === cell.key;
          return (
            <span
              key={cell.key}
              className={`${cell.inMonth ? "" : "is-outside"} ${cell.hasRelease ? "has-release" : ""} ${selected ? "is-selected" : ""} ${hovered ? "is-hovered" : ""}`}
            >
              {cell.day}
            </span>
          );
        })}
      </div>
      <p>Hover a release row to see its calendar date. Highlighted dates are loaded replay samples.</p>
    </aside>
  );
}

export function EventReplayReleaseListModal(props: {
  samplePosition: string;
  samples: ReactionReplaySample[];
  selectedSampleIndex: number;
  calendarFocusTime: number | null;
  calendarCells: Array<{
    key: string;
    day: number;
    inMonth: boolean;
    hasRelease: boolean;
  }>;
  selectedDateKey: string | null;
  hoveredDateKey: string | null;
  onClose: () => void;
  onHoverRelease: (index: number) => void;
  onSelectRelease: (index: number) => void;
}) {
  return (
    <div
      className="event-replay-modal-overlay fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/25 backdrop-blur-sm"
      onClick={props.onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Past Releases"
    >
      <section
        className="event-replay-modal-panel flex w-full max-w-[1040px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="m-0 text-base font-black text-slate-950">Past Releases</h3>
            <p className="mt-1 text-xs text-slate-600">{props.samplePosition}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600"
            onClick={props.onClose}
            aria-label="Close release list"
          >
            <X size={15} />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden bg-slate-50 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-h-0 overflow-y-auto pr-1">
            <div className="grid gap-2">
              {props.samples.length === 0 ? (
                <div className="border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  No historical releases with usable actual/comparison values.
                </div>
              ) : (
                props.samples.map((sample, index) => (
                  <div
                    key={sample.eventId}
                    onMouseEnter={() => props.onHoverRelease(index)}
                    onFocus={() => props.onHoverRelease(index)}
                  >
                    <EventSampleButton
                      sample={sample}
                      active={index === props.selectedSampleIndex}
                      onSelect={() => props.onSelectRelease(index)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
          <EventReplayReleaseCalendar
            focusTime={props.calendarFocusTime}
            cells={props.calendarCells}
            selectedDateKey={props.selectedDateKey}
            hoveredDateKey={props.hoveredDateKey}
          />
        </div>
      </section>
    </div>
  );
}
