import { BarChart3, ChevronLeft, ChevronRight, List, Pause, Play } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { FX_PAIRS } from "@/app/config/fxPairs";
import { getCurrencyCountryCode } from "@/app/lib/eventQuality";
import { formatUtcDateTime } from "@/app/lib/format";
import type { EventTemplate, FxPairDefinition, ReactionReplaySample } from "@/app/types";

interface EventReplayControlRailProps {
  selectedPair: FxPairDefinition;
  selectedTemplate: EventTemplate | null;
  selectedSample: ReactionReplaySample | null;
  samplePosition: string;
  releaseAgeLabel: string;
  canSelectOlderRelease: boolean;
  canSelectNewerRelease: boolean;
  replayReady: boolean;
  isPlaying: boolean;
  onPairChange: (pairName: string) => void;
  onOpenEventList: () => void;
  onSelectOlderRelease: () => void;
  onSelectNewerRelease: () => void;
  onOpenReleaseList: () => void;
  onTogglePlayback: () => void;
  onOpenBrief: () => void;
}

export function EventReplayControlRail({
  selectedPair,
  selectedTemplate,
  selectedSample,
  samplePosition,
  releaseAgeLabel,
  canSelectOlderRelease,
  canSelectNewerRelease,
  replayReady,
  isPlaying,
  onPairChange,
  onOpenEventList,
  onSelectOlderRelease,
  onSelectNewerRelease,
  onOpenReleaseList,
  onTogglePlayback,
  onOpenBrief,
}: EventReplayControlRailProps) {
  return (
    <aside className="flex min-h-0 min-w-0 flex-col overflow-y-auto border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-4">
        <label className="grid gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pair</span>
          <select
            value={selectedPair.name}
            onChange={(event) => onPairChange(event.target.value)}
            className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-xl font-black tracking-tight text-slate-950 outline-none focus:border-slate-400"
            aria-label="Replay pair"
          >
            {FX_PAIRS.map((pair) => (
              <option key={pair.name} value={pair.name}>
                {pair.name}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-black text-slate-800">
          <span className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2">
            <FlagIcon countryCode={getCurrencyCountryCode(selectedPair.base)} className="h-6 w-9 shrink-0 shadow-sm" />
            Base {selectedPair.base}
          </span>
          <span className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2">
            <FlagIcon countryCode={getCurrencyCountryCode(selectedPair.quote)} className="h-6 w-9 shrink-0 shadow-sm" />
            Quote {selectedPair.quote}
          </span>
        </div>
      </div>

      <div className="border-b border-slate-200 px-4 py-4">
        <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Event</span>
        <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <strong className="block break-words text-sm text-slate-950">
            {selectedTemplate ? `${selectedTemplate.currency} | ${selectedTemplate.title}` : "No event selected"}
          </strong>
          <span className="mt-1.5 block text-xs text-slate-500">
            {selectedTemplate
              ? `${selectedTemplate.familyLabel} / ${selectedTemplate.sampleCount} releases`
              : "Choose an event type to study."}
          </span>
        </div>
        <button
          type="button"
          className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-900 bg-white px-4 text-sm font-black text-slate-950 shadow-sm hover:bg-slate-50"
          onClick={onOpenEventList}
        >
          <List size={16} />
          Select Event
        </button>
      </div>

      <div className="border-b border-slate-200 px-4 py-4">
        <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Release</span>
        <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-950 px-4 py-4 text-white shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Selected Release</span>
            <span className="shrink-0 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-200">
              {releaseAgeLabel.replace(" release", "")}
            </span>
          </div>
          <strong className="mt-2 block break-words text-lg font-black tracking-tight">
            {selectedSample ? formatUtcDateTime(selectedSample.eventTime) : "No release selected"}
          </strong>
          <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <span className="font-black uppercase tracking-[0.14em] text-slate-400">Sample</span>
            <span className="font-bold text-slate-100">{samplePosition}</span>
            <span className="font-black uppercase tracking-[0.14em] text-slate-400">Compare</span>
            <span className="break-words font-bold leading-5 text-slate-100">
              {selectedSample?.comparisonLabel ?? "N/A"}
            </span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-xs font-black text-slate-800 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-35"
            disabled={!canSelectOlderRelease}
            onClick={onSelectOlderRelease}
          >
            <ChevronLeft size={15} />
            Older release
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-xs font-black text-slate-800 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-35"
            disabled={!canSelectNewerRelease}
            onClick={onSelectNewerRelease}
          >
            Newer release
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="mt-2">
          <button
            type="button"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 hover:border-slate-300"
            onClick={onOpenReleaseList}
          >
            <List size={15} />
            Past Releases
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-4 py-4">
        <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Playback</span>
        <button
          type="button"
          className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-950 px-4 text-base font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!replayReady}
          onClick={onTogglePlayback}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 hover:border-slate-300"
          onClick={onOpenBrief}
        >
          <BarChart3 size={15} />
          Replay Brief
        </button>
      </div>
    </aside>
  );
}
