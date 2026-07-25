import { useState } from "react";
import { ArrowRight, Database, Info, X } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { CURRENCY_TO_COUNTRY_CODE, FX_PAIRS, getFxPairByName } from "@/app/config/fxPairs";
import { getEventValueDisplay } from "@/app/lib/calendarDisplay";
import { formatCountdown, formatDateOnly, formatUtcDateTime } from "@/app/lib/format";
import { buildMacroFactorRows, type MacroFactorRow } from "@/app/lib/macroDrivers";
import type { CalendarEvent, CentralBankSnapshot, MarketStatusResponse } from "@/app/types";

interface OverviewPlaceholderTabProps {
  selectedSymbol: string;
  onSelectedSymbolChange: (symbol: string) => void;
  events: CalendarEvent[];
  snapshots: CentralBankSnapshot[];
  marketStatus: MarketStatusResponse | null;
  currentTime: Date;
  onOpenCalendarEvent: (event: CalendarEvent) => void;
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

function formatEventTitleWithCurrency(event: CalendarEvent): string {
  const suffix = `(${event.currency})`;
  return event.title.includes(suffix) ? event.title : `${event.title} ${suffix}`;
}

function getPairEvents(events: CalendarEvent[], currencies: string[]) {
  return events.filter((event) => currencies.includes(event.currency));
}

function MacroCard(props: {
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
          {props.factorRows.slice(0, 3).map((row) => (
            <button
              key={`${row.currency}-${row.factor.id}`}
              type="button"
              onClick={props.onOpenDetails}
              className={`overview-factor-chip ${row.coverageLabel === "Missing" ? "is-missing" : row.nextEvent ? "is-scheduled" : "is-current"}`}
              title={`${row.factor.label}: ${row.summary}`}
            >
              <span>{row.factor.label}</span>
              <strong>{row.coverageLabel}</strong>
            </button>
          ))}
          {props.factorRows.length > 3 ? (
            <button
              type="button"
              onClick={props.onOpenDetails}
              className="overview-factor-chip overview-factor-chip-more"
              title="Open all pair factor details"
            >
              <span>More factors</span>
              <strong>+{props.factorRows.length - 3}</strong>
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
            <span className="block truncate text-xs font-black text-slate-950">{props.nextEvent.title}</span>
          </span>
          <span className="shrink-0 text-right text-xs font-black text-blue-700">
            {formatCountdown(props.nextEvent.time, props.currentTime.getTime())}
          </span>
        </button>
      ) : null}
    </section>
  );
}

function PairDriverSnapshot(props: {
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
          <span className="mt-1 block truncate text-sm font-black">
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

function EventRow(props: {
  event: CalendarEvent;
  currentTime: Date;
  mode: "upcoming" | "recent";
  onOpen: (event: CalendarEvent) => void;
}) {
  const actual = getEventValueDisplay(props.event.actual, props.event.title);
  const forecast = getEventValueDisplay(props.event.forecast, props.event.title);
  const previous = getEventValueDisplay(props.event.previous, props.event.title);

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
        <span
          className="mt-1 block text-xs font-semibold text-slate-500"
          title={`Actual: ${actual.title} Forecast: ${forecast.title} Previous: ${previous.title}`}
        >
          Actual {actual.display} / Forecast {forecast.display} / Previous {previous.display}
        </span>
      </span>
      <span className="text-right text-xs font-black text-slate-700">
        {props.mode === "upcoming" ? formatCountdown(props.event.time, props.currentTime.getTime()) : formatUtcDateTime(props.event.time)}
      </span>
    </button>
  );
}

function ReleaseCurrencyGroup(props: {
  label: string;
  events: CalendarEvent[];
  currentTime: Date;
  mode: "upcoming" | "recent";
  emptyLabel: string;
  onOpen: (event: CalendarEvent) => void;
}) {
  return (
    <section className="overview-release-currency-group">
      <div className="overview-release-currency-head">
        <span>{props.label}</span>
        <strong>{props.events.length}</strong>
      </div>
      <div className="mt-3 grid gap-2">
        {props.events.length > 0 ? (
          props.events.map((event) => (
            <EventRow
              key={`${event.id}-${event.time}-${event.currency}-${event.title}-${props.mode}`}
              event={event}
              currentTime={props.currentTime}
              mode={props.mode}
              onOpen={props.onOpen}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
            {props.emptyLabel}
          </div>
        )}
      </div>
    </section>
  );
}

function FactorDetailRow({ row, onOpen }: { row: MacroFactorRow; onOpen: (event: CalendarEvent) => void }) {
  return (
    <div className="overview-factor-detail-row">
      <div className="overview-factor-detail-factor">
        <strong>{row.factor.label}</strong>
        <span className={`overview-factor-coverage-pill ${row.coverageLabel === "Missing" ? "is-missing" : "is-covered"}`}>
          {row.coverageLabel}
        </span>
      </div>
      <p className="overview-factor-latest">{row.summary}</p>
      <div className="overview-factor-next">
        {row.nextEvent ? (
          <button
            type="button"
            onClick={() => onOpen(row.nextEvent as CalendarEvent)}
          >
            {formatEventTitleWithCurrency(row.nextEvent)}
          </button>
        ) : (
          <span>No upcoming matching row is loaded.</span>
        )}
      </div>
    </div>
  );
}

function FactorDetailsGroup(props: {
  currency: string;
  rows: MacroFactorRow[];
  onOpen: (event: CalendarEvent) => void;
}) {
  return (
    <section className="overview-factor-detail-group">
      <div className="overview-factor-detail-group-head">
        <div>
          <span>Currency</span>
          <strong>{props.currency}</strong>
        </div>
        <b>{props.rows.filter((row) => row.coverageLabel !== "Missing").length} / {props.rows.length} covered</b>
      </div>
      <div className="overview-factor-detail-column-head">
        <span>Factor</span>
        <span>Latest loaded release</span>
        <span>Next loaded event</span>
      </div>
      <div className="overview-factor-detail-row-list">
        {props.rows.map((row) => (
          <FactorDetailRow key={`${row.currency}-${row.factor.id}`} row={row} onOpen={props.onOpen} />
        ))}
      </div>
    </section>
  );
}

export function OverviewPlaceholderTab({
  selectedSymbol,
  onSelectedSymbolChange,
  events,
  snapshots,
  marketStatus,
  currentTime,
  onOpenCalendarEvent,
}: OverviewPlaceholderTabProps) {
  const [releasePopoverOpen, setReleasePopoverOpen] = useState(false);
  const [pairDetailsOpen, setPairDetailsOpen] = useState(false);
  const pair = resolvePair(selectedSymbol);
  const pairCurrencies = [pair.base, pair.quote];
  const pairEvents = getPairEvents(events, pairCurrencies);
  const nowSeconds = currentTime.getTime() / 1000;
  const upcomingEvents = pairEvents
    .filter((event) => event.time >= nowSeconds)
    .sort((left, right) => left.time - right.time);
  const recentEvents = pairEvents
    .filter((event) => event.time < nowSeconds)
    .sort((left, right) => right.time - left.time);
  const nextEvent = upcomingEvents[0] ?? null;
  const baseNextEvent = upcomingEvents.find((event) => event.currency === pair.base) ?? null;
  const quoteNextEvent = upcomingEvents.find((event) => event.currency === pair.quote) ?? null;
  const upcomingReleaseGroups = [
    { label: `${pair.base}/XXX`, events: upcomingEvents.filter((event) => event.currency === pair.base).slice(0, 4) },
    { label: `${pair.quote}/XXX`, events: upcomingEvents.filter((event) => event.currency === pair.quote).slice(0, 4) },
  ];
  const recentReleaseGroups = [
    { label: `${pair.base}/XXX`, events: recentEvents.filter((event) => event.currency === pair.base).slice(0, 4) },
    { label: `${pair.quote}/XXX`, events: recentEvents.filter((event) => event.currency === pair.quote).slice(0, 4) },
  ];
  const baseSnapshot = findSnapshot(pair.base, snapshots);
  const quoteSnapshot = findSnapshot(pair.quote, snapshots);
  const factorRows = buildMacroFactorRows({ events, currencies: pairCurrencies, nowSeconds });
  const baseFactorRows = factorRows.filter((row) => row.currency === pair.base);
  const quoteFactorRows = factorRows.filter((row) => row.currency === pair.quote);
  const sessionLabel =
    marketStatus?.session_state === "open"
      ? "Market open"
      : marketStatus?.session_state === "closed"
        ? "Market closed"
        : "Session unknown";

  return (
    <div className="workspace-page workspace-page-compact flex flex-col gap-4">
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

        <PairDriverSnapshot
          pairName={pair.name}
          nextEvent={nextEvent}
          upcomingEvents={upcomingEvents}
          factorRows={factorRows}
          currentTime={currentTime}
          onOpenEvent={onOpenCalendarEvent}
          onOpenReleases={() => setReleasePopoverOpen(true)}
          onOpenDetails={() => setPairDetailsOpen(true)}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <MacroCard
          side="Base"
          currency={pair.base}
          snapshot={baseSnapshot}
          nextEvent={baseNextEvent}
          factorRows={baseFactorRows}
          currentTime={currentTime}
          onOpenEvent={onOpenCalendarEvent}
          onOpenDetails={() => setPairDetailsOpen(true)}
        />
        <MacroCard
          side="Quote"
          currency={pair.quote}
          snapshot={quoteSnapshot}
          nextEvent={quoteNextEvent}
          factorRows={quoteFactorRows}
          currentTime={currentTime}
          onOpenEvent={onOpenCalendarEvent}
          onOpenDetails={() => setPairDetailsOpen(true)}
        />
      </section>

      {releasePopoverOpen ? (
        <div className="overview-release-overlay" onClick={() => setReleasePopoverOpen(false)}>
          <section
            className="overview-release-popover"
            role="dialog"
            aria-modal="true"
            aria-label={`${pair.name} calendar releases`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="overview-release-popover-head">
              <div>
                <span>Pair releases</span>
                <h3>{pair.name}</h3>
              </div>
              <button type="button" aria-label="Close pair releases" onClick={() => setReleasePopoverOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="overview-release-popover-body">
              <section>
                <div className="overview-release-section-title">
                  <span>Upcoming</span>
                  <strong>{upcomingEvents.length}</strong>
                </div>
                <div className="overview-release-currency-grid">
                  {upcomingReleaseGroups.map((group) => (
                    <ReleaseCurrencyGroup
                      key={`${group.label}-upcoming`}
                      label={group.label}
                      events={group.events}
                      currentTime={currentTime}
                      mode="upcoming"
                      emptyLabel={`No upcoming ${group.label} events are loaded.`}
                      onOpen={onOpenCalendarEvent}
                    />
                  ))}
                </div>
              </section>

              <div className="overview-release-divider" />

              <section>
                <div className="overview-release-section-title">
                  <span>Past releases</span>
                  <strong>{recentEvents.length}</strong>
                </div>
                <div className="overview-release-currency-grid">
                  {recentReleaseGroups.map((group) => (
                    <ReleaseCurrencyGroup
                      key={`${group.label}-recent`}
                      label={group.label}
                      events={group.events}
                      currentTime={currentTime}
                      mode="recent"
                      emptyLabel={`No recent ${group.label} releases are loaded.`}
                      onOpen={onOpenCalendarEvent}
                    />
                  ))}
                </div>
              </section>
            </div>
          </section>
        </div>
      ) : null}

      {pairDetailsOpen ? (
        <div className="overview-release-overlay" onClick={() => setPairDetailsOpen(false)}>
          <section
            className="overview-factor-detail-popover"
            role="dialog"
            aria-modal="true"
            aria-label={`${pair.name} pair details`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="overview-factor-detail-popover-head">
              <div>
                <span>Pair details</span>
                <h3>{pair.name}</h3>
              </div>
              <button type="button" aria-label="Close pair details" onClick={() => setPairDetailsOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="overview-factor-detail-popover-body">
              <div className="overview-factor-detail-note">
                Loaded broker/MT5 rows only. Missing coverage means this feed has no matching evidence, not that the factor does not matter.
              </div>
              <div className="overview-factor-detail-grid">
                <FactorDetailsGroup currency={pair.base} rows={baseFactorRows} onOpen={onOpenCalendarEvent} />
                <FactorDetailsGroup currency={pair.quote} rows={quoteFactorRows} onOpen={onOpenCalendarEvent} />
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
