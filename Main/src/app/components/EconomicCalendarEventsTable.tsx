import { Fragment } from "react";
import { FlagIcon } from "@/app/components/FlagIcon";
import {
  CalendarValueText,
  ImpactPill,
} from "@/app/components/EconomicCalendarInspector";
import { buildCalendarEventKey } from "@/app/lib/calendarNavigation";
import { formatUtcDateTime } from "@/app/lib/format";
import { formatDateTimeForDisplayTimezone, type DisplayTimezoneSelection } from "@/app/lib/timezoneDisplay";
import { getCountryDisplayName } from "@/app/config/currencyConfig";
import type { CalendarEvent } from "@/app/types";

interface EconomicCalendarEventsTableProps {
  groups: Array<[string, CalendarEvent[]]>;
  timezoneMode: DisplayTimezoneSelection;
  highlightedEventKey: string | null;
  selectedEventKey: string | null;
  onSelectEvent: (event: CalendarEvent) => void;
}

export function EconomicCalendarEventsTable({
  groups,
  timezoneMode,
  highlightedEventKey,
  selectedEventKey,
  onSelectEvent,
}: EconomicCalendarEventsTableProps) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <table className="data-table calendar-table">
      <colgroup>
        <col className="calendar-col-mt5" />
        <col className="calendar-col-viewer" />
        <col className="calendar-col-country" />
        <col className="calendar-col-event" />
        <col className="calendar-col-impact" />
        <col className="calendar-col-number" />
        <col className="calendar-col-number" />
        <col className="calendar-col-number" />
      </colgroup>
      <thead>
        <tr>
          <th>MT5 Time</th>
          <th>Viewer Time</th>
          <th>Country</th>
          <th>Event</th>
          <th>Impact</th>
          <th>Actual</th>
          <th>Forecast</th>
          <th>Previous</th>
        </tr>
      </thead>
      <tbody>
        {groups.map(([day, items]) => (
          <Fragment key={day}>
            <tr className="group-row">
              <td colSpan={8}>
                {new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </td>
            </tr>
            {items.map((event) => {
              const eventKey = buildCalendarEventKey(event);
              const isHighlighted = highlightedEventKey === eventKey;
              const isSelected = selectedEventKey === eventKey;
              return (
                <tr
                  key={`${event.id}-${event.time}`}
                  data-event-key={eventKey}
                  className={[
                    "calendar-event-row",
                    isHighlighted ? "is-highlighted" : "",
                    isSelected ? "is-selected" : "",
                  ].filter(Boolean).join(" ")}
                  tabIndex={0}
                  onClick={() => onSelectEvent(event)}
                  onKeyDown={(keyboardEvent) => {
                    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                      keyboardEvent.preventDefault();
                      onSelectEvent(event);
                    }
                  }}
                >
                  <td>{formatUtcDateTime(event.time)}</td>
                  <td>{formatDateTimeForDisplayTimezone(event.time, timezoneMode)}</td>
                  <td>
                    <div className="bank-cell">
                      <FlagIcon countryCode={event.countryCode} className="h-5 w-8 border border-gray-200 rounded-sm" />
                      <div>
                        <strong>{getCountryDisplayName(event.countryCode)}</strong>
                        <span>{event.currency}</span>
                      </div>
                    </div>
                  </td>
                  <td className="calendar-event-title-cell">{event.title}</td>
                  <td><ImpactPill level={event.impact} /></td>
                  <td className="calendar-number-cell"><CalendarValueText value={event.actual} eventTitle={event.title} /></td>
                  <td className="calendar-number-cell"><CalendarValueText value={event.forecast} eventTitle={event.title} /></td>
                  <td className="calendar-number-cell"><CalendarValueText value={event.previous} eventTitle={event.title} /></td>
                </tr>
              );
            })}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
