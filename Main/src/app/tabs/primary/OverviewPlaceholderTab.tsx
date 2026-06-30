import { ArrowRight, BarChart3, Building2, CalendarDays, Clock3, PlayCircle, Radio } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { CURRENCY_TO_COUNTRY_CODE, FX_PAIRS, getFxPairByName } from "@/app/config/fxPairs";
import { formatEventValue } from "@/app/lib/calendarDisplay";
import { formatCountdown, formatDateOnly, formatUtcDateTime } from "@/app/lib/format";
import type { CalendarEvent, CentralBankSnapshot, MarketStatusResponse, TabId } from "@/app/types";

interface OverviewPlaceholderTabProps {
  selectedSymbol: string;
  onSelectedSymbolChange: (symbol: string) => void;
  events: CalendarEvent[];
  snapshots: CentralBankSnapshot[];
  marketStatus: MarketStatusResponse | null;
  currentTime: Date;
  onNavigate: (tab: TabId) => void;
  onOpenCalendarEvent: (event: CalendarEvent) => void;
  onOpenEventReplay: (symbol: string) => void;
  onOpenChart: (symbol: string) => void;
}

const IMPACT_STYLE: Record<CalendarEvent["impact"], string> = {
  high: "border-rose-200 bg-rose-50 text-rose-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function resolvePair(symbol: string) {
  return getFxPairByName(symbol) ?? FX_PAIRS[0];
}

function findSnapshot(currency: string, snapshots: CentralBankSnapshot[]): CentralBankSnapshot | null {
  return snapshots.find((snapshot) => snapshot.currency === currency) ?? null;
}

function resolveCountryCode(currency: string, snapshot: CentralBankSnapshot | null): string {
  if (snapshot?.countryCode) return snapshot.countryCode;
  return CURRENCY_TO_COUNTRY_CODE[currency as keyof typeof CURRENCY_TO_COUNTRY_CODE] ?? currency.slice(0, 2);
}

function renderMetric(value: string | null): string {
  return value && value.trim() !== "" ? value : "N/A";
}

function getPairEvents(events: CalendarEvent[], currencies: string[]) {
  return events.filter((event) => currencies.includes(event.currency));
}

function MacroCard(props: {
  side: "Base" | "Quote";
  currency: string;
  snapshot: CentralBankSnapshot | null;
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Policy Rate</div>
          <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {renderMetric(props.snapshot?.currentPolicyRate ?? null)}
          </div>
          <div className="mt-1 text-xs font-semibold text-slate-500">
            Prev {renderMetric(props.snapshot?.previousPolicyRate ?? null)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Inflation</div>
          <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {renderMetric(props.snapshot?.currentInflationRate ?? null)}
          </div>
          <div className="mt-1 text-xs font-semibold text-slate-500">
            Prev {renderMetric(props.snapshot?.previousInflationRate ?? null)}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-600">
        <div className="flex items-center justify-between gap-3">
          <span>Next rate event</span>
          <strong className="text-right text-slate-900">{formatDateOnly(props.snapshot?.nextRateEventAt ?? null)}</strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Next CPI event</span>
          <strong className="text-right text-slate-900">{formatDateOnly(props.snapshot?.nextCpiEventAt ?? null)}</strong>
        </div>
      </div>
    </section>
  );
}

function EventRow(props: {
  event: CalendarEvent;
  currentTime: Date;
  mode: "upcoming" | "recent";
  onOpen: (event: CalendarEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => props.onOpen(props.event)}
      className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/40"
    >
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${IMPACT_STYLE[props.event.impact]}`}>
            {props.event.impact}
          </span>
          <span className="truncate text-sm font-black text-slate-950">{props.event.currency} | {props.event.title}</span>
        </span>
        <span className="mt-1 block text-xs font-semibold text-slate-500">
          Actual {formatEventValue(props.event.actual)} / Forecast {formatEventValue(props.event.forecast)} / Previous {formatEventValue(props.event.previous)}
        </span>
      </span>
      <span className="text-right text-xs font-black text-slate-700">
        {props.mode === "upcoming" ? formatCountdown(props.event.time, props.currentTime.getTime()) : formatUtcDateTime(props.event.time)}
      </span>
    </button>
  );
}

export function OverviewPlaceholderTab({
  selectedSymbol,
  onSelectedSymbolChange,
  events,
  snapshots,
  marketStatus,
  currentTime,
  onNavigate,
  onOpenCalendarEvent,
  onOpenEventReplay,
  onOpenChart,
}: OverviewPlaceholderTabProps) {
  const pair = resolvePair(selectedSymbol);
  const pairCurrencies = [pair.base, pair.quote];
  const pairEvents = getPairEvents(events, pairCurrencies);
  const nowSeconds = currentTime.getTime() / 1000;
  const upcomingEvents = pairEvents
    .filter((event) => event.time >= nowSeconds)
    .sort((left, right) => left.time - right.time);
  const recentEvents = pairEvents
    .filter((event) => event.time < nowSeconds)
    .sort((left, right) => right.time - left.time)
    .slice(0, 5);
  const nextEvent = upcomingEvents[0] ?? null;
  const baseSnapshot = findSnapshot(pair.base, snapshots);
  const quoteSnapshot = findSnapshot(pair.quote, snapshots);
  const sessionLabel =
    marketStatus?.session_state === "open"
      ? "Market open"
      : marketStatus?.session_state === "closed"
        ? "Market closed"
        : "Session unknown";

  return (
    <div className="workspace-page flex flex-col gap-4">
      <section className="grid gap-4 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.5fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-500">Pair Brief</div>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{pair.name}</h2>
            </div>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700">
              {sessionLabel}
            </span>
          </div>

          <label className="mt-5 block">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Selected Pair</span>
            <select
              value={pair.name}
              onChange={(event) => onSelectedSymbolChange(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-black text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white"
            >
              {FX_PAIRS.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <FlagIcon countryCode={resolveCountryCode(pair.base, baseSnapshot)} className="h-6 w-9 border border-slate-200 shadow-sm" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Base</div>
                <div className="text-sm font-black text-slate-950">{pair.base}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <FlagIcon countryCode={resolveCountryCode(pair.quote, quoteSnapshot)} className="h-6 w-9 border border-slate-200 shadow-sm" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Quote</div>
                <div className="text-sm font-black text-slate-950">{pair.quote}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-200">Next Pair Event</div>
              <h3 className="mt-2 text-2xl font-black tracking-tight">
                {nextEvent ? `${nextEvent.currency} | ${nextEvent.title}` : "No upcoming pair event loaded"}
              </h3>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-right">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-100">Countdown</div>
              <div className="mt-1 text-lg font-black">{nextEvent ? formatCountdown(nextEvent.time, currentTime.getTime()) : "N/A"}</div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-200">
            <span className="inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-blue-200" />
              {nextEvent ? `${formatUtcDateTime(nextEvent.time)} UTC` : "Calendar feed has no future row for this pair."}
            </span>
            {nextEvent ? (
              <span className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${IMPACT_STYLE[nextEvent.impact]}`}>
                {nextEvent.impact} impact
              </span>
            ) : null}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => onOpenChart(pair.name)}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white px-3 py-3 text-sm font-black text-slate-950 transition hover:bg-blue-50"
            >
              Charts <BarChart3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onOpenEventReplay(pair.name)}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm font-black text-white transition hover:bg-white/15"
            >
              Event Replay <PlayCircle className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => (nextEvent ? onOpenCalendarEvent(nextEvent) : onNavigate("calendar"))}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm font-black text-white transition hover:bg-white/15"
            >
              Calendar <CalendarDays className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate("central-banks")}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm font-black text-white transition hover:bg-white/15"
            >
              Central Banks <Building2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-4 lg:grid-cols-2">
          <MacroCard side="Base" currency={pair.base} snapshot={baseSnapshot} />
          <MacroCard side="Quote" currency={pair.quote} snapshot={quoteSnapshot} />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pair Event Feed</div>
              <h3 className="mt-1 text-lg font-black text-slate-950">Recent releases</h3>
            </div>
            <Radio className="h-5 w-5 text-blue-500" />
          </div>
          <div className="mt-4 grid gap-2">
            {recentEvents.length > 0 ? (
              recentEvents.map((event) => (
                <EventRow
                  key={`${event.id}-${event.time}-${event.currency}-${event.title}`}
                  event={event}
                  currentTime={currentTime}
                  mode="recent"
                  onOpen={onOpenCalendarEvent}
                />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm font-semibold text-slate-500">
                No recent pair-relevant release is loaded in the current MT5 calendar feed.
              </div>
            )}
          </div>
        </section>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Workflow</div>
            <h3 className="mt-1 text-lg font-black text-slate-950">Open the deeper surface that matches the question.</h3>
          </div>
          <button
            type="button"
            onClick={() => onOpenChart(pair.name)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700"
          >
            Start with chart context <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
