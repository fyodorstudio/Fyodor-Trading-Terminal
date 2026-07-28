import { ArrowRight, Database, Info } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { CURRENCY_TO_COUNTRY_CODE } from "@/app/config/fxPairs";
import { formatCountdown, formatDateOnly } from "@/app/lib/format";
import type { MacroFactorRow } from "@/app/lib/macroDrivers";
import type { CalendarEvent, CentralBankSnapshot } from "@/app/types";

function resolveCountryCode(currency: string, snapshot: CentralBankSnapshot | null): string {
  if (snapshot?.countryCode) return snapshot.countryCode;
  return CURRENCY_TO_COUNTRY_CODE[currency as keyof typeof CURRENCY_TO_COUNTRY_CODE] ?? currency.slice(0, 2);
}

function renderMetric(value: string | null): string {
  return value && value.trim() !== "" ? value : "N/A";
}

function getOverviewFactorChipLabel(row: MacroFactorRow): string {
  if (row.coverageLabel === "Missing") return "No loaded rows";
  if (row.latestEvent && row.nextEvent) return "Latest + next";
  if (row.latestEvent) return "Latest row";
  if (row.nextEvent) return "Next row";
  return row.coverageLabel;
}

export function OverviewCurrencyChip(props: {
  label: "Base" | "Quote";
  currency: string;
  snapshot: CentralBankSnapshot | null;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <FlagIcon countryCode={resolveCountryCode(props.currency, props.snapshot)} className="h-6 w-9 border border-slate-200 shadow-sm" />
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{props.label}</div>
        <div className="text-sm font-black text-slate-950">{props.currency}</div>
      </div>
    </div>
  );
}

export function OverviewMacroCard(props: {
  side: "Base" | "Quote";
  currency: string;
  snapshot: CentralBankSnapshot | null;
  nextEvent: CalendarEvent | null;
  factorRows: MacroFactorRow[];
  currentTime: Date;
  onOpenEvent: (event: CalendarEvent) => void;
  onOpenDetails: () => void;
}) {
  const countryCode = resolveCountryCode(props.currency, props.snapshot);
  const status = props.snapshot?.status ?? "missing";
  const statusTone =
    status === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "partial"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-500";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <FlagIcon countryCode={countryCode} className="h-8 w-12 border border-slate-200 shadow-sm" />
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{props.side}</div>
            <h3 className="truncate text-lg font-black text-slate-950">{props.currency}</h3>
          </div>
        </div>
        <span className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusTone}`}>
          {status}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Policy Rate</div>
          <div className="mt-1 text-xl font-black tracking-tight text-slate-950">
            {renderMetric(props.snapshot?.currentPolicyRate ?? null)}
          </div>
          <div className="mt-1 text-xs font-semibold text-slate-500">
            Prev {renderMetric(props.snapshot?.previousPolicyRate ?? null)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Inflation</div>
          <div className="mt-1 text-xl font-black tracking-tight text-slate-950">
            {renderMetric(props.snapshot?.currentInflationRate ?? null)}
          </div>
          <div className="mt-1 text-xs font-semibold text-slate-500">
            Prev {renderMetric(props.snapshot?.previousInflationRate ?? null)}
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600">
        <div className="flex items-center justify-between gap-3">
          <span>Rate event</span>
          <strong className="text-right text-slate-900">{formatDateOnly(props.snapshot?.nextRateEventAt ?? null)}</strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>CPI event</span>
          <strong className="text-right text-slate-900">{formatDateOnly(props.snapshot?.nextCpiEventAt ?? null)}</strong>
        </div>
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Factor coverage</span>
          <button
            type="button"
            onClick={props.onOpenDetails}
            className="inline-flex items-center gap-1 text-[11px] font-black text-blue-600"
          >
            Pair details <Info className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {props.factorRows.slice(0, 2).map((row) => (
            <button
              key={`${row.currency}-${row.factor.id}`}
              type="button"
              onClick={props.onOpenDetails}
              className={`overview-factor-chip ${row.coverageLabel === "Missing" ? "is-missing" : row.nextEvent ? "is-scheduled" : "is-current"}`}
              title={`${row.factor.label}: ${row.summary}`}
            >
              <span>{row.factor.label}</span>
              <strong>{getOverviewFactorChipLabel(row)}</strong>
            </button>
          ))}
          {props.factorRows.length > 2 ? (
            <button
              type="button"
              onClick={props.onOpenDetails}
              className="overview-factor-chip overview-factor-chip-more"
              title="Open all pair factor details"
            >
              <span>More factors</span>
              <strong>+{props.factorRows.length - 2}</strong>
            </button>
          ) : null}
        </div>
      </div>

      {props.nextEvent ? (
        <button
          type="button"
          onClick={() => props.onOpenEvent(props.nextEvent as CalendarEvent)}
          className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-left transition hover:border-blue-200 hover:bg-blue-100/70"
        >
          <span className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-blue-500">
              Next {props.currency} event
            </span>
            <span className="block break-words text-xs font-black leading-5 text-slate-950">{props.nextEvent.title}</span>
          </span>
          <span className="shrink-0 text-right text-xs font-black text-blue-700">
            {formatCountdown(props.nextEvent.time, props.currentTime.getTime())}
          </span>
        </button>
      ) : null}
    </section>
  );
}

export function OverviewPairDriverSnapshot(props: {
  pairName: string;
  nextEvent: CalendarEvent | null;
  upcomingEvents: CalendarEvent[];
  factorRows: MacroFactorRow[];
  currentTime: Date;
  onOpenEvent: (event: CalendarEvent) => void;
  onOpenReleases: () => void;
  onOpenDetails: () => void;
}) {
  const coveredRows = props.factorRows.filter((row) => row.coverageLabel !== "Missing");
  const scheduledRows = props.factorRows.filter((row) => row.nextEvent);
  const highImpactUpcoming = props.upcomingEvents.filter((event) => event.impact === "high");

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-500">Pair Driver Snapshot</div>
          <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{props.pairName}</h3>
        </div>
        <span className="rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-blue-700">
          Current feed only
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Covered factors</span>
          <strong className="mt-1 block text-lg font-black text-slate-950">{coveredRows.length}/{props.factorRows.length}</strong>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Scheduled</span>
          <strong className="mt-1 block text-lg font-black text-slate-950">{scheduledRows.length}</strong>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">High impact</span>
          <strong className="mt-1 block text-lg font-black text-slate-950">{highImpactUpcoming.length}</strong>
        </div>
      </div>

      <button
        type="button"
        onClick={() => (props.nextEvent ? props.onOpenEvent(props.nextEvent) : undefined)}
        disabled={!props.nextEvent}
        className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-950 px-4 py-3 text-left text-white transition enabled:hover:bg-blue-700 disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-500"
      >
        <span className="min-w-0">
          <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-blue-200">Next loaded pair event</span>
          <span className="mt-1 block break-words text-sm font-black leading-5">
            {props.nextEvent ? `${props.nextEvent.currency} | ${props.nextEvent.title}` : "No upcoming pair event loaded"}
          </span>
        </span>
        <span className="shrink-0 text-right text-xs font-black">
          {props.nextEvent ? formatCountdown(props.nextEvent.time, props.currentTime.getTime()) : "N/A"}
        </span>
      </button>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={props.onOpenReleases}
          className="inline-flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 transition hover:border-blue-200 hover:bg-blue-100"
        >
          See recent releases <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={props.onOpenDetails}
          className="inline-flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-white"
        >
          Pair details <Database className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
