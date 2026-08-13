import { memo, useEffect, useState } from "react";
import { Info, MoveHorizontal, Table2, X } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { CURRENCY_TO_COUNTRY_CODE } from "@/app/config/fxPairs";
import { formatChartEventDisplayTime } from "@/app/lib/chartEvents";
import type { ChartDisplayTimeMode } from "@/app/lib/chartView";
import {
  PAIR_MATRIX_BEFORE_MAX_DAYS,
  normalizePairMatrixBeforeDays,
  type PairMatrixCurrencyTimeline,
  type PairMatrixSeriesSnapshot,
  type PairMatrixTimelineSnapshot,
} from "@/app/lib/pairMatrixSnapshot";

export type PairMatrixLoadState = "idle" | "loading" | "ready" | "error";

export interface ChartPairMatrixTimeLensData {
  open: boolean;
  supported: boolean;
  pairLabel: string;
  currencies: readonly string[];
  timeline: PairMatrixTimelineSnapshot;
  rangeLabel: string;
  rangeBasisLabel: "Hovered candle" | "Latest candle" | "Locked range";
  rangeOpenTimeSeconds: number | null;
  loadState: PairMatrixLoadState;
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
  beforeDays: number;
  rangeSelectionArmed: boolean;
  hasLockedRange: boolean;
  onBeforeDaysChange: (days: number) => void;
  onStartRangeSelection: () => void;
  onToggleOpen: () => void;
  onClose: () => void;
}

interface ChartPairMatrixTimeLensProps {
  data: ChartPairMatrixTimeLensData;
}

function SnapshotEventValues({ series }: { series: PairMatrixSeriesSnapshot }) {
  return (
    <>
      <b title={`Actual. Broker raw value: ${series.event.actual || "missing"}.`}>A {series.actualLabel}</b>
      <b title={`Forecast. Broker raw value: ${series.event.forecast || "missing"}.`}>F {series.forecastLabel}</b>
      <b title={`Previous. Broker raw value: ${series.event.previous || "missing"}. This value may already contain a broker revision.`}>P {series.previousLabel}</b>
      <b title={series.surprise.title}>S {series.surprise.label}</b>
      <b title={series.momentum.title}>M {series.momentum.label}</b>
    </>
  );
}

function formatAge(anchorTimeSeconds: number | null, releaseTimeSeconds: number): string {
  if (anchorTimeSeconds == null) return "";
  const seconds = Math.max(0, anchorTimeSeconds - releaseTimeSeconds);
  if (seconds < 60 * 60) return `${Math.floor(seconds / 60)}m old`;
  if (seconds < 48 * 60 * 60) return `${Math.floor(seconds / (60 * 60))}h old`;
  return `${Math.floor(seconds / (24 * 60 * 60))}d old`;
}

function formatElapsed(rangeOpen: number | null, releaseTime: number): string {
  if (rangeOpen == null) return "";
  const seconds = Math.max(0, releaseTime - rangeOpen);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `+${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `+${hours}h${remainder ? ` ${remainder}m` : ""}`;
}

function TimelineEntry({
  series,
  side,
  mode,
  data,
}: {
  series: PairMatrixSeriesSnapshot;
  side: "base" | "quote";
  mode: "during" | "before";
  data: ChartPairMatrixTimeLensData;
}) {
  const secondaryTime = mode === "during"
    ? formatElapsed(data.rangeOpenTimeSeconds, series.event.time)
    : formatAge(data.rangeOpenTimeSeconds, series.event.time);
  const time = (
    <time
      className={`whitespace-nowrap font-mono text-[10px] font-bold text-slate-500 ${side === "base" ? "text-right" : "text-left"}`}
      title={`${series.event.title}. ${mode === "during" ? "Released during the selected candle range" : "Latest loaded release of this exact series known before the range"}${secondaryTime ? `; ${secondaryTime}` : ""}.`}
    >
      {formatChartEventDisplayTime(series.event.time, data.displayTimeMode, data.sourceTimeOffsetSeconds)}
      {secondaryTime ? ` · ${secondaryTime}` : ""}
    </time>
  );
  const factor = (
    <span className="inline-flex min-w-0 items-center gap-1 text-[9px] font-black uppercase tracking-[0.04em] text-slate-500">
      <span className="overflow-hidden text-ellipsis whitespace-nowrap" title={series.factor.label}>{series.factor.label}</span>
      <span title={series.factor.helpText} aria-label={`${series.factor.label} interpretation help: ${series.factor.helpText}`}>
        <Info size={10} aria-hidden="true" />
      </span>
    </span>
  );
  const title = <strong className={`min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-black text-slate-900 ${side === "quote" ? "text-right" : ""}`} title={series.event.title}>{series.event.title}</strong>;
  const values = <span className="contents whitespace-nowrap text-[11px] font-extrabold text-slate-600"><SnapshotEventValues series={series} /></span>;

  return side === "base" ? (
    <div className="grid min-h-[34px] grid-cols-[100px_minmax(165px,1fr)_48px_48px_48px_54px_54px_166px] items-center gap-2 border-b border-slate-100 px-3 last:border-b-0" data-pair-matrix-timeline-entry="base">
      {factor}{title}{values}{time}
    </div>
  ) : (
    <div className="grid min-h-[34px] grid-cols-[166px_48px_48px_48px_54px_54px_minmax(165px,1fr)_100px] items-center gap-2 border-b border-slate-100 px-3 last:border-b-0" data-pair-matrix-timeline-entry="quote">
      {time}{values}{title}<span className="justify-self-end">{factor}</span>
    </div>
  );
}

function CurrencyTimeline({ timeline, side, mode, data }: { timeline: PairMatrixCurrencyTimeline | null; side: "base" | "quote"; mode: "during" | "before"; data: ChartPairMatrixTimeLensData }) {
  if (!timeline || timeline.entries.length === 0) {
    return <p className={`m-0 px-3 py-3 text-[11px] font-bold text-slate-400 ${side === "quote" ? "text-right" : ""}`}>{mode === "during" ? "No loaded releases during this range" : `No loaded releases in the prior ${data.beforeDays} days`}</p>;
  }
  return <>{timeline.entries.map((entry) => <TimelineEntry key={`${mode}:${entry.event.id}:${entry.event.time}:${entry.event.title}`} series={entry} side={side} mode={mode} data={data} />)}</>;
}

function TimelineSection({ mode, data }: { mode: "during" | "before"; data: ChartPairMatrixTimeLensData }) {
  const source = data.timeline[mode];
  const base = source.find((item) => item.currency === data.currencies[0]) ?? null;
  const quote = source.find((item) => item.currency === data.currencies[1]) ?? null;
  return (
    <div className="grid grid-cols-2 divide-x divide-slate-300">
      <div className="min-w-0"><CurrencyTimeline timeline={base} side="base" mode={mode} data={data} /></div>
      <div className="min-w-0"><CurrencyTimeline timeline={quote} side="quote" mode={mode} data={data} /></div>
    </div>
  );
}

export const ChartPairMatrixTimeLens = memo(function ChartPairMatrixTimeLens({ data }: ChartPairMatrixTimeLensProps) {
  const [lookbackInput, setLookbackInput] = useState(String(data.beforeDays));
  useEffect(() => setLookbackInput(String(data.beforeDays)), [data.beforeDays]);
  if (!data.open) return null;

  const baseCurrency = data.currencies[0] ?? "Base";
  const quoteCurrency = data.currencies[1] ?? "Quote";
  const baseCountryCode = CURRENCY_TO_COUNTRY_CODE[baseCurrency as keyof typeof CURRENCY_TO_COUNTRY_CODE] ?? "";
  const quoteCountryCode = CURRENCY_TO_COUNTRY_CODE[quoteCurrency as keyof typeof CURRENCY_TO_COUNTRY_CODE] ?? "";
  const commitLookback = () => {
    const normalized = normalizePairMatrixBeforeDays(lookbackInput);
    setLookbackInput(String(normalized));
    data.onBeforeDaysChange(normalized);
  };

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white" aria-label="Pair Matrix Time Lens">
      <header className="flex min-h-[50px] items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600"><Table2 size={15} /></span>
          <div className="min-w-0">
            <p className="m-0 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Pair Matrix - Economic timeline</p>
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-black text-slate-950">{data.pairLabel}</h2>
              <button
                type="button"
                onClick={data.onStartRangeSelection}
                disabled={!data.supported || data.rangeOpenTimeSeconds == null}
                className={`inline-flex h-6 flex-none items-center gap-1 rounded-md border px-2 text-[10px] font-black disabled:cursor-not-allowed disabled:opacity-50 ${data.rangeSelectionArmed ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}
                aria-pressed={data.rangeSelectionArmed}
                title={data.hasLockedRange ? "Drag across the chart to replace the locked range" : "Drag across the chart to select complete candles"}
              >
                <MoveHorizontal size={12} /> {data.rangeSelectionArmed ? "Drag on chart" : data.hasLockedRange ? "Replace range" : "Select range"}
              </button>
            </div>
          </div>
        </div>
        <div className="ml-auto min-w-0 text-right">
          <strong className="block overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-black text-slate-800">{data.rangeLabel}</strong>
          <span className="block text-[10px] font-bold text-slate-500">{data.rangeBasisLabel}</span>
        </div>
        <button className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100" type="button" onClick={data.onClose} aria-label="Close Pair Matrix Time Lens"><X size={15} /></button>
      </header>

      {!data.supported ? (
        <div className="grid min-h-0 flex-1 place-items-center p-6 text-center text-sm font-bold text-slate-600">Pair Matrix currently supports forex pairs only.</div>
      ) : data.loadState === "idle" ? (
        <div className="grid min-h-0 flex-1 place-items-center p-6 text-center text-sm font-bold text-slate-600" aria-live="polite">Waiting for a loaded chart candle.</div>
      ) : data.loadState === "loading" ? (
        <div className="grid min-h-0 flex-1 place-items-center p-6 text-center text-sm font-bold text-slate-600" aria-live="polite">Loading economic data for this candle range...</div>
      ) : data.loadState === "error" ? (
        <div className="grid min-h-0 flex-1 place-items-center p-6 text-center text-sm font-bold text-red-700" role="status">Historical calendar data could not be loaded.</div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="sticky top-0 z-[2] grid min-w-[1480px] grid-cols-2 divide-x divide-slate-300 border-b border-slate-300 bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-slate-500">
            <span className="inline-flex items-center gap-2"><FlagIcon countryCode={baseCountryCode} className="h-4 w-6 shrink-0 border border-slate-200" />{baseCurrency}</span>
            <span className="inline-flex items-center justify-end gap-2"><FlagIcon countryCode={quoteCountryCode} className="h-4 w-6 shrink-0 border border-slate-200" />{quoteCurrency}</span>
          </div>
          <div className="min-w-[1480px]">
            <div className="border-b border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-blue-800">During this {data.hasLockedRange ? "selected range" : "candle"}</div>
            <TimelineSection mode="during" data={data} />
            <div className="sticky top-[29px] z-[1] flex items-center justify-between gap-4 border-y-2 border-slate-400 bg-slate-100 px-3 py-1.5">
              <strong className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-700">Known before {data.hasLockedRange ? "range" : "candle"}</strong>
              <label className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                Lookback
                <input
                  className="h-6 w-16 rounded border border-slate-300 bg-white px-2 text-right font-mono text-[11px] font-black text-slate-800"
                  aria-label="Known before range lookback days"
                  inputMode="numeric"
                  min={1}
                  max={PAIR_MATRIX_BEFORE_MAX_DAYS}
                  step={1}
                  value={lookbackInput}
                  onChange={(event) => setLookbackInput(event.target.value)}
                  onBlur={commitLookback}
                  onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                />
                days
              </label>
            </div>
            <TimelineSection mode="before" data={data} />
          </div>
        </div>
      )}
    </section>
  );
});
