import { ArrowRight } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { CURRENCY_TO_COUNTRY_CODE } from "@/app/config/fxPairs";
import { getEventValueDisplay } from "@/app/lib/calendarDisplay";
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
  currentTime: Date;
  onOpenEvent: (event: CalendarEvent) => void;
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

      <div className="mt-3">
        <button
          type="button"
          onClick={props.onOpenReleases}
          className="inline-flex w-full items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 transition hover:border-blue-200 hover:bg-blue-100"
        >
          See recent releases <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function formatEventName(event: CalendarEvent | null): string {
  if (!event) return "No loaded event";
  const suffix = `(${event.currency})`;
  return event.title.includes(suffix) ? event.title : `${event.title} ${suffix}`;
}

function formatLatestEvidence(row: MacroFactorRow | null): string {
  if (!row || !row.latestEvent || row.coverageLabel === "Missing") return "No loaded row";
  return row.summary;
}

function formatNextEvidence(row: MacroFactorRow | null): string {
  if (!row || !row.nextEvent) return "No loaded event";
  return formatEventName(row.nextEvent);
}

function getFactorStatus(row: MacroFactorRow | null): string {
  if (!row || row.coverageLabel === "Missing") return "Missing";
  if (row.latestEvent && row.nextEvent) return "Latest + next";
  if (row.latestEvent) return "Latest only";
  if (row.nextEvent) return "Next only";
  return row.coverageLabel;
}

function getImpactClass(impact: CalendarEvent["impact"]): string {
  if (impact === "high") return "is-high";
  if (impact === "medium") return "is-medium";
  return "is-low";
}

function TimelineItem(props: {
  event: CalendarEvent;
  currentTime: Date;
  mode: "upcoming" | "recent";
  onOpenEvent: (event: CalendarEvent) => void;
}) {
  const actual = getEventValueDisplay(props.event.actual, props.event.title);
  const forecast = getEventValueDisplay(props.event.forecast, props.event.title);
  const previous = getEventValueDisplay(props.event.previous, props.event.title);
  const valueTitle = `Actual: ${actual.title} Forecast: ${forecast.title} Previous: ${previous.title}`;

  return (
    <button
      type="button"
      className={`overview-event-timeline-item ${getImpactClass(props.event.impact)}`}
      onClick={() => props.onOpenEvent(props.event)}
      title={`${props.event.currency} ${props.event.title}. ${valueTitle}`}
    >
      <span className="overview-event-timeline-currency">{props.event.currency}</span>
      <strong>{props.event.title}</strong>
      <em>
        {props.mode === "upcoming"
          ? formatCountdown(props.event.time, props.currentTime.getTime())
          : formatDateOnly(props.event.time)}
      </em>
    </button>
  );
}

export function OverviewPairWorkbench(props: {
  pairName: string;
  baseCurrency: string;
  quoteCurrency: string;
  baseRows: MacroFactorRow[];
  quoteRows: MacroFactorRow[];
  upcomingEvents: CalendarEvent[];
  recentEvents: CalendarEvent[];
  currentTime: Date;
  onOpenEvent: (event: CalendarEvent) => void;
  onOpenReleases: () => void;
}) {
  const factorMap = new Map<string, MacroFactorRow["factor"]>();
  [...props.baseRows, ...props.quoteRows].forEach((row) => factorMap.set(row.factor.id, row.factor));
  const factors = Array.from(factorMap.values());
  const visibleUpcoming = props.upcomingEvents.slice(0, 5);
  const visibleRecent = props.recentEvents.slice(0, Math.max(0, 7 - visibleUpcoming.length));
  const hiddenEventCount = Math.max(0, props.upcomingEvents.length + props.recentEvents.length - visibleUpcoming.length - visibleRecent.length);

  return (
    <section className="overview-pair-workbench">
      <header className="overview-pair-workbench-head">
        <div>
          <span>Pair detail workbench</span>
          <h3>{props.pairName}</h3>
        </div>
        <p>Loaded broker/MT5 rows only. Missing rows mean no matching evidence is loaded in the current feed.</p>
      </header>

      <section className="overview-event-timeline">
        <div className="overview-event-timeline-head">
          <div>
            <span>Pair Event Timeline</span>
            <strong>Upcoming first, recent releases after</strong>
          </div>
          <button type="button" onClick={props.onOpenReleases}>
            View expanded feed
            {hiddenEventCount > 0 ? <em>+{hiddenEventCount}</em> : null}
          </button>
        </div>
        <div className="overview-event-timeline-row">
          {visibleUpcoming.map((event) => (
            <TimelineItem
              key={`upcoming-${event.id}-${event.time}-${event.title}`}
              event={event}
              currentTime={props.currentTime}
              mode="upcoming"
              onOpenEvent={props.onOpenEvent}
            />
          ))}
          {visibleRecent.length > 0 ? <div className="overview-event-timeline-split">Recent</div> : null}
          {visibleRecent.map((event) => (
            <TimelineItem
              key={`recent-${event.id}-${event.time}-${event.title}`}
              event={event}
              currentTime={props.currentTime}
              mode="recent"
              onOpenEvent={props.onOpenEvent}
            />
          ))}
          {visibleUpcoming.length === 0 && visibleRecent.length === 0 ? (
            <div className="overview-event-timeline-empty">No pair-relevant calendar rows are loaded.</div>
          ) : null}
        </div>
      </section>

      <div className="overview-workbench-grid">
        <aside className="overview-factor-list-panel">
          <div className="overview-factor-list-head">
            <span>Factor coverage</span>
            <strong>{props.baseCurrency} / {props.quoteCurrency}</strong>
          </div>
          <div className="overview-factor-list">
            {factors.map((factor) => {
              const baseRow = props.baseRows.find((row) => row.factor.id === factor.id) ?? null;
              const quoteRow = props.quoteRows.find((row) => row.factor.id === factor.id) ?? null;
              return (
                <div key={factor.id} className="overview-factor-list-row">
                  <strong>{factor.label}</strong>
                  <div>
                    <span>{props.baseCurrency}: {getFactorStatus(baseRow)}</span>
                    <span>{props.quoteCurrency}: {getFactorStatus(quoteRow)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <section className="overview-pair-matrix-panel">
          <div className="overview-pair-matrix-head">
            <div>
              <span>Pair Matrix</span>
              <strong>Latest evidence vs next loaded event</strong>
            </div>
            <em>Informational, not a trade signal</em>
          </div>
          <div className="overview-pair-matrix-scroll">
            <table className="overview-pair-matrix">
              <thead>
                <tr>
                  <th>Factor</th>
                  <th>{props.baseCurrency} latest</th>
                  <th>{props.baseCurrency} next</th>
                  <th>{props.quoteCurrency} latest</th>
                  <th>{props.quoteCurrency} next</th>
                </tr>
              </thead>
              <tbody>
                {factors.map((factor) => {
                  const baseRow = props.baseRows.find((row) => row.factor.id === factor.id) ?? null;
                  const quoteRow = props.quoteRows.find((row) => row.factor.id === factor.id) ?? null;
                  return (
                    <tr key={factor.id}>
                      <th scope="row">{factor.label}</th>
                      <td>{formatLatestEvidence(baseRow)}</td>
                      <td>{formatNextEvidence(baseRow)}</td>
                      <td>{formatLatestEvidence(quoteRow)}</td>
                      <td>{formatNextEvidence(quoteRow)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
