import { X } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { getCurrencyCountryCode } from "@/app/lib/eventQuality";
import { REPLAY_TIMEFRAME_OPTIONS } from "@/app/lib/eventReaction";
import {
  MAX_REPLAY_CANDLES,
  MIN_REPLAY_CANDLES,
} from "@/app/lib/eventReplayStorage";
import { getReplayCalendarTitle } from "@/app/lib/eventReplayView";
import { formatUtcDateTime } from "@/app/lib/format";
import type {
  CalendarEventExplainer,
  EventTemplate,
  ReactionReplaySample,
  ReplayChartTimeframe,
} from "@/app/types";

function formatReplaySurprise(value: number): string {
  if (!Number.isFinite(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(4)}`;
}

function EventExplainerMiniBrief(props: { explainer: CalendarEventExplainer | null }) {
  if (!props.explainer) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">What This Event Is</span>
        <p className="mt-1 text-sm leading-6 text-slate-700">{props.explainer.whatItIs}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Why Traders Care</span>
        <p className="mt-1 text-sm leading-6 text-slate-700">{props.explainer.whyTradersCare}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 sm:col-span-2">
        <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">What To Compare</span>
        <ul className="mt-2 grid gap-1.5 text-sm leading-6 text-slate-700">
          {(props.explainer.whatToCompare ?? []).slice(0, 3).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
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

export function EventReplayBriefModal(props: {
  selectedTemplate: EventTemplate | null;
  selectedSample: ReactionReplaySample | null;
  selectedSampleExplainer: CalendarEventExplainer | null;
  replayTimeframe: ReplayChartTimeframe;
  beforeCount: number;
  afterCount: number;
  releaseAgeLabel: string;
  surpriseLabel: string;
  observedMoveLabel: string;
  observedMoveDescription: string;
  comparisonBasisLabel: string;
  onClose: () => void;
  onReplayTimeframeChange: (timeframe: ReplayChartTimeframe) => void;
  onBeforeCountChange: (value: string) => void;
  onAfterCountChange: (value: string) => void;
}) {
  return (
    <div
      className="event-replay-modal-overlay fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/25 backdrop-blur-sm"
      onClick={props.onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Replay Brief"
    >
      <aside
        className="event-replay-modal-panel flex w-full max-w-[1180px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
              <FlagIcon countryCode={getCurrencyCountryCode(props.selectedTemplate?.currency ?? "")} className="h-5 w-8" />
            </div>
            <div>
              <h3 className="m-0 text-lg font-black text-slate-950">Replay Brief</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">Context for the selected historical release.</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600"
            onClick={props.onClose}
            aria-label="Close replay brief"
          >
            <X size={16} />
          </button>
        </div>

        <div className="event-replay-brief-body min-h-0 flex-1 overflow-y-auto bg-slate-50 px-5 py-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-500">Replay Setup</span>
                <h4 className="mt-1 text-base font-black text-slate-950">Study window</h4>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-600">
                {props.replayTimeframe} / {props.beforeCount}+{props.afterCount}
              </span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.72fr]">
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Timeframe</span>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {REPLAY_TIMEFRAME_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => props.onReplayTimeframeChange(option.id)}
                      className={`h-10 rounded-xl border px-2 text-sm font-black ${
                        props.replayTimeframe === option.id
                          ? "border-slate-900 bg-slate-950 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Before</span>
                  <input
                    type="number"
                    min={MIN_REPLAY_CANDLES}
                    max={MAX_REPLAY_CANDLES}
                    value={props.beforeCount}
                    onChange={(event) => props.onBeforeCountChange(event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-black text-slate-950 outline-none focus:border-slate-400"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">After</span>
                  <input
                    type="number"
                    min={MIN_REPLAY_CANDLES}
                    max={MAX_REPLAY_CANDLES}
                    value={props.afterCount}
                    onChange={(event) => props.onAfterCountChange(event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-black text-slate-950 outline-none focus:border-slate-400"
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-500">Selected study</span>
                <h4 className="mt-1 break-words text-lg font-black text-slate-950">
                  {props.selectedTemplate ? `${props.selectedTemplate.currency} | ${props.selectedTemplate.title}` : "No event selected"}
                </h4>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {props.selectedSample ? formatUtcDateTime(props.selectedSample.eventTime) : "Choose a historical release to load the brief."}
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-600">
                {props.releaseAgeLabel}
              </span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              {[
                ["Actual", props.selectedSample?.actual || "N/A"],
                ["Forecast", props.selectedSample?.forecast || "N/A"],
                ["Previous", props.selectedSample?.previous || "N/A"],
                ["Surprise", props.surpriseLabel],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</span>
                  <strong className="mt-1 block break-words text-sm leading-5 text-slate-950">{value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-3 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Observed move</span>
              <strong className="mt-2 block text-2xl font-black tracking-tight text-slate-950">{props.observedMoveLabel}</strong>
              <p className="mt-2 text-sm leading-6 text-slate-600">{props.observedMoveDescription}</p>
            </div>

            <div className="grid gap-2">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <strong className="block text-sm text-slate-950">1. Read the release first</strong>
                <span className="mt-1 block text-sm leading-6 text-slate-600">
                  Compare actual against {props.comparisonBasisLabel.toLowerCase()} before judging the candle reaction.
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <strong className="block text-sm text-slate-950">2. Separate spike from acceptance</strong>
                <span className="mt-1 block text-sm leading-6 text-slate-600">
                  The pre-marker candles show positioning; post-marker candles show whether the market accepted or rejected the first read.
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <strong className="block text-sm text-slate-950">3. Reuse the pattern carefully</strong>
                <span className="mt-1 block text-sm leading-6 text-slate-600">
                  Replay is for studying reaction shape, volatility, and follow-through. It is not a buy/sell instruction.
                </span>
              </div>
            </div>
          </section>

          <div className="mt-3">
            <EventExplainerMiniBrief explainer={props.selectedSampleExplainer} />
          </div>
        </div>
      </aside>
    </div>
  );
}
