import { X } from "lucide-react";
import { getEventValueDisplay } from "@/app/lib/calendarDisplay";
import { formatCountdown, formatUtcDateTime } from "@/app/lib/format";
import type { CalendarEvent } from "@/app/types";

const IMPACT_STYLE: Record<CalendarEvent["impact"], string> = {
  high: "border-rose-200 bg-rose-50 text-rose-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

interface OverviewReleaseGroup {
  label: string;
  events: CalendarEvent[];
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
          <span className="min-w-0 break-words text-sm font-black leading-5 text-slate-950">
            {props.event.currency} | {props.event.title}
          </span>
        </span>
        <span
          className="mt-1 block text-xs font-semibold text-slate-500"
          title={`Actual: ${actual.title} Forecast: ${forecast.title} Previous: ${previous.title}`}
        >
          Actual {actual.display} / Forecast {forecast.display} / Previous {previous.display}
        </span>
      </span>
      <span className="text-right text-xs font-black text-slate-700">
        {props.mode === "upcoming"
          ? formatCountdown(props.event.time, props.currentTime.getTime())
          : formatUtcDateTime(props.event.time)}
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

export function OverviewReleasePopover(props: {
  pairName: string;
  upcomingEvents: CalendarEvent[];
  recentEvents: CalendarEvent[];
  upcomingReleaseGroups: OverviewReleaseGroup[];
  recentReleaseGroups: OverviewReleaseGroup[];
  currentTime: Date;
  onOpenEvent: (event: CalendarEvent) => void;
  onClose: () => void;
}) {
  return (
    <div className="overview-release-overlay" onClick={props.onClose}>
      <section
        className="overview-release-popover"
        role="dialog"
        aria-modal="true"
        aria-label={`${props.pairName} calendar releases`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="overview-release-popover-head">
          <div>
            <span>Pair releases</span>
            <h3>{props.pairName}</h3>
          </div>
          <button type="button" aria-label="Close pair releases" onClick={props.onClose}>
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="overview-release-popover-body">
          <section>
            <div className="overview-release-section-title">
              <span>Upcoming</span>
              <strong>{props.upcomingEvents.length}</strong>
            </div>
            <div className="overview-release-currency-grid">
              {props.upcomingReleaseGroups.map((group) => (
                <ReleaseCurrencyGroup
                  key={`${group.label}-upcoming`}
                  label={group.label}
                  events={group.events}
                  currentTime={props.currentTime}
                  mode="upcoming"
                  emptyLabel={`No upcoming ${group.label} events are loaded.`}
                  onOpen={props.onOpenEvent}
                />
              ))}
            </div>
          </section>

          <div className="overview-release-divider" />

          <section>
            <div className="overview-release-section-title">
              <span>Past releases</span>
              <strong>{props.recentEvents.length}</strong>
            </div>
            <div className="overview-release-currency-grid">
              {props.recentReleaseGroups.map((group) => (
                <ReleaseCurrencyGroup
                  key={`${group.label}-recent`}
                  label={group.label}
                  events={group.events}
                  currentTime={props.currentTime}
                  mode="recent"
                  emptyLabel={`No recent ${group.label} releases are loaded.`}
                  onOpen={props.onOpenEvent}
                />
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
