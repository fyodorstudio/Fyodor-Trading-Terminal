import { FlagIcon } from "@/app/components/FlagIcon";
import { getCurrencyCountryCode } from "@/app/lib/eventQuality";
import { getSampleQualityLabel } from "@/app/lib/eventReaction";
import { formatUtcDateTime } from "@/app/lib/format";
import { formatReplayCount, getReplayCalendarTitle } from "@/app/lib/eventReplayView";
import type { CalendarEventExplainer, EventTemplate, ReactionReplaySample, SampleQuality } from "@/app/types";

function qualityTone(quality: SampleQuality): string {
  if (quality === "usable") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (quality === "limited") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function formatReplaySurprise(value: number): string {
  if (!Number.isFinite(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(4)}`;
}

export function EventExplainerMiniBrief(props: { explainer: CalendarEventExplainer | null }) {
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

export function EventTemplateButton(props: {
  template: EventTemplate;
  active: boolean;
  metaLabel?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onSelect}
      className={`grid min-w-0 w-full gap-2 overflow-hidden border px-3 py-3 text-left transition-colors ${
        props.active
          ? "border-slate-900 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-900 hover:border-slate-400"
      }`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <FlagIcon countryCode={getCurrencyCountryCode(props.template.currency)} className="mt-0.5 h-5 w-8 shrink-0" />
          <div className="min-w-0">
            <strong className="block break-words text-sm leading-5">{props.template.currency} | {props.template.title}</strong>
            <span className={`mt-1 block text-xs ${props.active ? "text-slate-300" : "text-slate-500"}`}>
              {props.template.familyLabel}
            </span>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
            props.active ? "border-slate-700 bg-slate-800 text-slate-100" : qualityTone(props.template.quality)
          }`}
        >
          {getSampleQualityLabel(props.template.quality)}
        </span>
      </div>
      <span className={`text-xs font-semibold ${props.active ? "text-slate-300" : "text-slate-500"}`}>
        {props.metaLabel ?? formatReplayCount(props.template.sampleCount)}
      </span>
    </button>
  );
}

export function EventSampleButton(props: {
  sample: ReactionReplaySample;
  active: boolean;
  onSelect: () => void;
}) {
  const valueCardClass = props.active ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50";
  const labelClass = props.active ? "text-slate-400" : "text-slate-400";
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

export function EventReplayReleaseCalendar(props: {
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
