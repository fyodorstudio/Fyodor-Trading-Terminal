import { FlagIcon } from "@/app/components/FlagIcon";
import { getCurrencyCountryCode } from "@/app/lib/eventQuality";
import { getSampleQualityLabel } from "@/app/lib/eventReaction";
import { formatReplayCount } from "@/app/lib/eventReplayView";
import type { EventTemplate, SampleQuality } from "@/app/types";

function qualityTone(quality: SampleQuality): string {
  if (quality === "usable") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (quality === "limited") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
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
