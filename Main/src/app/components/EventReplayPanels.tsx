import { FlagIcon } from "@/app/components/FlagIcon";
import { getCurrencyCountryCode } from "@/app/lib/eventQuality";
import { getSampleQualityLabel } from "@/app/lib/eventReaction";
import { formatUtcDateTime } from "@/app/lib/format";
import { formatReplayCount } from "@/app/lib/eventReplayView";
import type { CalendarEventExplainer, EventTemplate, ReactionReplaySample, SampleQuality } from "@/app/types";

function qualityTone(quality: SampleQuality): string {
  if (quality === "usable") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (quality === "limited") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function EventExplainerMiniBrief(props: { explainer: CalendarEventExplainer | null }) {
  if (!props.explainer) {
    return null;
  }

  return (
    <div className="grid gap-3">
      <div className="border border-slate-200 bg-white px-3 py-2.5">
        <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">What This Event Is</span>
        <p className="mt-1 text-sm leading-6 text-slate-700">{props.explainer.whatItIs}</p>
      </div>
      <div className="border border-slate-200 bg-white px-3 py-2.5">
        <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Why Traders Care</span>
        <p className="mt-1 text-sm leading-6 text-slate-700">{props.explainer.whyTradersCare}</p>
      </div>
      <div className="border border-slate-200 bg-white px-3 py-2.5">
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
  return (
    <button
      type="button"
      onClick={props.onSelect}
      className={`min-w-0 w-full overflow-hidden border px-3 py-3 text-left transition-colors ${
        props.active
          ? "border-slate-900 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-900 hover:border-slate-400"
      }`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <strong className="block min-w-0 break-words text-sm">{formatUtcDateTime(props.sample.eventTime)}</strong>
        <span className={`text-xs font-semibold ${props.active ? "text-slate-300" : "text-slate-500"}`}>
          {props.sample.comparisonBasis === "forecast" ? "Forecast" : "Previous"}
        </span>
      </div>
      <div className={`mt-2 text-xs ${props.active ? "text-slate-300" : "text-slate-500"}`}>
        Actual {props.sample.actual || "N/A"} vs {props.sample.comparisonBasis === "forecast" ? props.sample.forecast : props.sample.previous || "N/A"}
      </div>
    </button>
  );
}
