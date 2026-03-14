import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Search, Star } from "lucide-react";
import { fetchCalendar } from "@/app/lib/bridge";
import { getPresetRange } from "@/app/lib/calendarRanges";
import {
  formatLocalDateTime,
  formatRelativeAge,
  formatUtcDateTime,
  getLocalTimezoneLabel,
  parseDateInput,
  toDateInputValue,
} from "@/app/lib/format";
import { resolveCalendarStatus } from "@/app/lib/status";
import { CENTRAL_BANK_COUNTRY_NAME } from "@/app/config/currencyConfig";
import type { BridgeHealth, BridgeStatus, CalendarEvent, DatePreset, ImpactLevel } from "@/app/types";

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "this_week", label: "This Week" },
  { id: "next_week", label: "Next Week" },
  { id: "last_week", label: "Last Week" },
  { id: "this_month", label: "This Month" },
  { id: "before_today", label: "Before Today" },
  { id: "custom", label: "Custom" },
];

const DEFAULT_IMPACTS: ImpactLevel[] = ["low", "medium", "high"];
const DEFAULT_COUNTRIES = ["US", "EU", "GB", "JP", "AU", "CA", "NZ", "CH"];

function impactStars(level: ImpactLevel) {
  const max = level === "low" ? 1 : level === "medium" ? 2 : 3;
  return (
    <span className="star-row" aria-label={`${level} impact`}>
      {[1, 2, 3].map((value) => (
        <Star key={`${level}-${value}`} size={13} className={value <= max ? "star-active" : "star-idle"} />
      ))}
    </span>
  );
}

function groupByUtcDay(events: CalendarEvent[]) {
  const groups = new Map<string, CalendarEvent[]>();
  events.forEach((event) => {
    const key = new Date(event.time * 1000).toISOString().slice(0, 10);
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  });
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

interface EconomicCalendarTabProps {
  health: BridgeHealth;
}

export function EconomicCalendarTab({ health }: EconomicCalendarTabProps) {
  const [preset, setPreset] = useState<DatePreset>("this_week");
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [impacts, setImpacts] = useState<ImpactLevel[]>(DEFAULT_IMPACTS);
  const [countries, setCountries] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [status, setStatus] = useState<BridgeStatus>("loading");
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [lastCalendarIngestAt, setLastCalendarIngestAt] = useState<number | null>(null);
  const eventsRef = useRef<CalendarEvent[]>([]);

  const activeRange = useMemo(
    () => getPresetRange(preset, new Date(), { from: customFrom, to: customTo }),
    [preset, customFrom, customTo],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setStatus("loading");
      try {
        const calendarEvents = await fetchCalendar({
          from: activeRange.from ? Math.floor(activeRange.from.getTime() / 1000) : null,
          to: activeRange.to ? Math.floor(activeRange.to.getTime() / 1000) : null,
          impacts,
          countries,
        });

        if (cancelled) return;

        eventsRef.current = calendarEvents;
        setEvents(calendarEvents);
        setLastFetchedAt(Math.floor(Date.now() / 1000));
        setLastCalendarIngestAt(health.last_calendar_ingest_at ?? null);
        setStatus(resolveCalendarStatus({ eventsCount: calendarEvents.length, health }));
      } catch {
        if (cancelled) return;
        setLastFetchedAt(Math.floor(Date.now() / 1000));
        setLastCalendarIngestAt(health.last_calendar_ingest_at ?? null);
        setStatus(
          resolveCalendarStatus({
            eventsCount: eventsRef.current.length,
            health,
            calendarRequestFailed: true,
          }),
        );
      }
    };

    void load();
    const id = window.setInterval(() => void load(), 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeRange.from, activeRange.to, impacts, countries, health]);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return events.filter((event) => {
      if (!query) return true;
      return (
        event.title.toLowerCase().includes(query) ||
        event.currency.toLowerCase().includes(query) ||
        event.countryCode.toLowerCase().includes(query)
      );
    });
  }, [events, search]);

  const groups = useMemo(() => groupByUtcDay(filteredEvents), [filteredEvents]);

  const toggleImpact = (impact: ImpactLevel) => {
    setImpacts((current) => {
      const next = current.includes(impact) ? current.filter((item) => item !== impact) : [...current, impact];
      return next.length === 0 ? DEFAULT_IMPACTS : (next.sort() as ImpactLevel[]);
    });
  };

  const toggleCountry = (country: string) => {
    setCountries((current) =>
      current.includes(country) ? current.filter((item) => item !== country) : [...current, country],
    );
  };

  const statusText =
    status === "live"
      ? "Live MT5 calendar feed."
      : status === "stale"
        ? "Calendar rows loaded. Feed freshness needs review."
        : status === "loading"
          ? "Loading MT5 calendar..."
          : status === "no_data"
            ? "NO DATA for the selected range."
            : "Bridge unavailable.";

  return (
    <section className="tab-panel">
      <div className="section-head">
        <div>
          <h2>Economic Calendar</h2>
          <p>MT5 server-time audit table with local-time reference and strict live-data states.</p>
        </div>
        <div className="section-metrics">
          <span className={`status-pill status-${status}`}>{statusText}</span>
          <span className="metric-chip">Last fetch: {formatRelativeAge(lastFetchedAt)}</span>
          <span className="metric-chip">Calendar ingest: {formatRelativeAge(lastCalendarIngestAt)}</span>
        </div>
      </div>

      <div className="calendar-toolbar">
        <div className="filter-cluster">
          <span className="toolbar-label">Impact</span>
          <div className="chip-row">
            {(["low", "medium", "high"] as ImpactLevel[]).map((impact) => (
              <button
                key={impact}
                type="button"
                className={impacts.includes(impact) ? "filter-chip is-active" : "filter-chip"}
                onClick={() => toggleImpact(impact)}
              >
                {impactStars(impact)}
                <span>{impact}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="filter-cluster">
          <span className="toolbar-label">Range</span>
          <div className="chip-row">
            {DATE_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={preset === item.id ? "filter-chip is-active" : "filter-chip"}
                onClick={() => setPreset(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {preset === "custom" && (
          <div className="filter-cluster filter-cluster-inline">
            <label className="field-label">
              From
              <input
                type="date"
                value={toDateInputValue(customFrom)}
                onChange={(event) => setCustomFrom(parseDateInput(event.target.value))}
              />
            </label>
            <label className="field-label">
              To
              <input
                type="date"
                value={toDateInputValue(customTo)}
                onChange={(event) => setCustomTo(parseDateInput(event.target.value))}
              />
            </label>
          </div>
        )}

        <div className="filter-cluster">
          <span className="toolbar-label">Countries</span>
          <div className="chip-row">
            {DEFAULT_COUNTRIES.map((country) => (
              <button
                key={country}
                type="button"
                className={countries.includes(country) ? "filter-chip is-active" : "filter-chip"}
                onClick={() => toggleCountry(country)}
              >
                {country}
              </button>
            ))}
            <button type="button" className="filter-chip" onClick={() => setCountries([])}>
              All
            </button>
          </div>
        </div>

        <label className="calendar-search">
          <Search size={15} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search event title, currency, or country"
          />
        </label>
      </div>

      <div className="status-strip">
        <span className="status-note">Primary time basis: MT5 feed (UTC)</span>
        <span className="status-note">Secondary time basis: {getLocalTimezoneLabel()}</span>
      </div>

      {(status === "error" || status === "stale" || status === "no_data") && (
        <div className={`alert-panel alert-${status}`}>
          {status === "error" && "Bridge unavailable. Keep MetaTrader 5 and the local bridge running, then refresh this tab."}
          {status === "stale" && "Calendar rows are still available, but the latest ingest looks stale. You can keep auditing this week and last week while the market is closed."}
          {status === "no_data" && "NO DATA for the selected range or filters. Broaden the range or verify the MT5 feed."}
        </div>
      )}

      <div className="data-table-shell">
        <table className="data-table calendar-table">
          <thead>
            <tr>
              <th>MT5 Time</th>
              <th>Local Time</th>
              <th>Country</th>
              <th>Event</th>
              <th>Impact</th>
              <th>Actual</th>
              <th>Forecast</th>
              <th>Previous</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={8} className="table-empty">
                  No calendar rows to display.
                </td>
              </tr>
            ) : (
              groups.map(([day, items]) => (
                <Fragment key={day}>
                  <tr className="group-row" key={`${day}-label`}>
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
                  {items.map((event) => (
                    <tr key={`${event.id}-${event.time}`}>
                      <td>{formatUtcDateTime(event.time)}</td>
                      <td>{formatLocalDateTime(event.time)}</td>
                      <td>
                        <div className="bank-cell">
                          <span className="code-flag">{event.countryCode}</span>
                          <div>
                            <strong>{CENTRAL_BANK_COUNTRY_NAME[event.countryCode] ?? event.countryCode}</strong>
                            <span>{event.currency}</span>
                          </div>
                        </div>
                      </td>
                      <td>{event.title}</td>
                      <td>{impactStars(event.impact)}</td>
                      <td>{event.actual || "-"}</td>
                      <td>{event.forecast || "-"}</td>
                      <td>{event.previous || "-"}</td>
                    </tr>
                  ))}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
