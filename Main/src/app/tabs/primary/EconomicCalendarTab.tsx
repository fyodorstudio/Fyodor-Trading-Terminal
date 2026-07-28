import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, Check, ChevronDown, Clock, Globe, Search } from "lucide-react";
import {
  CalendarClockCard,
  FreshnessChip,
  HelpHint,
  ImpactSummary,
} from "@/app/components/EconomicCalendarControls";
import {
  CalendarEventInspectorDrawer,
  CalendarValueText,
  ImpactPill,
} from "@/app/components/EconomicCalendarInspector";
import { fetchCalendar, fetchServerTime } from "@/app/lib/bridge";
import {
  buildCalendarQueryKey,
  formatCurrentMt5Time,
  formatRangeLabelFromSeconds,
  getCalendarFreshness,
  getTodayUtcRangeSeconds,
  groupByUtcDay,
  stripToLocalDate,
  summarizeCountries,
  toUtcRangeSeconds,
} from "@/app/lib/calendarDisplay";
import { getCalendarEventExplainer } from "@/app/lib/calendarEventExplain";
import { buildCalendarEventKey, getCalendarIntentDayRange } from "@/app/lib/calendarNavigation";
import { getPresetRange } from "@/app/lib/calendarRanges";
import {
  formatCountdown,
  formatUtcDateTime,
  parseDateInput,
  toDateInputValue,
} from "@/app/lib/format";
import { resolveCalendarStatus } from "@/app/lib/status";
import {
  formatCurrentTimeForDisplayTimezone,
  formatDateTimeForDisplayTimezone,
  getDisplayTimezoneOptions,
  loadDisplayTimezoneSelection,
  saveDisplayTimezoneSelection,
  type DisplayTimezoneSelection,
} from "@/app/lib/timezoneDisplay";
import { getCountryDisplayName, MAJOR_COUNTRY_CODES } from "@/app/config/currencyConfig";
import { FlagIcon } from "@/app/components/FlagIcon";
import type { BridgeHealth, BridgeStatus, CalendarEvent, CalendarNavigationIntent, ImpactLevel } from "@/app/types";

export {
  CalendarEventInspectorDrawer,
  CalendarValueText,
  ImpactPill,
} from "@/app/components/EconomicCalendarInspector";

const ALL_IMPACTS: ImpactLevel[] = ["low", "medium", "high"];
const DEFAULT_IMPACTS: ImpactLevel[] = ["high"];

type CalendarRangeMode = "today" | "this_week" | "next_week" | "custom";
const CALENDAR_TIMEZONE_KEY = "fyodor-calendar-display-timezone";


interface EconomicCalendarTabProps {
  health: BridgeHealth;
  persistedLastSyncedAt?: number | null;
  onSyncSuccess?: (timestampSeconds: number) => void;
  navigationIntent?: CalendarNavigationIntent | null;
  onConsumeNavigationIntent?: () => void;
}

export function EconomicCalendarTab({
  health,
  persistedLastSyncedAt = null,
  onSyncSuccess,
  navigationIntent = null,
  onConsumeNavigationIntent,
}: EconomicCalendarTabProps) {
  const [preset, setPreset] = useState<CalendarRangeMode>("today");
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [draftFrom, setDraftFrom] = useState<Date | null>(null);
  const [draftTo, setDraftTo] = useState<Date | null>(null);
  const [impacts, setImpacts] = useState<ImpactLevel[]>(DEFAULT_IMPACTS);
  const [countries, setCountries] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [countrySourceEvents, setCountrySourceEvents] = useState<CalendarEvent[]>([]);
  const [status, setStatus] = useState<BridgeStatus>("loading");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(persistedLastSyncedAt);
  const [lastCalendarIngestAt, setLastCalendarIngestAt] = useState<number | null>(health.last_calendar_ingest_at ?? null);
  const [uiNow, setUiNow] = useState(Date.now());
  const [mt5ServerTime, setMt5ServerTime] = useState<number | null>(null);
  const [mt5FetchedAtMs, setMt5FetchedAtMs] = useState<number | null>(null);
  const [timezoneMode, setTimezoneMode] = useState<DisplayTimezoneSelection>(() =>
    loadDisplayTimezoneSelection(CALENDAR_TIMEZONE_KEY, "local"),
  );
  const [isImpactMenuOpen, setIsImpactMenuOpen] = useState(false);
  const [isCountryMenuOpen, setIsCountryMenuOpen] = useState(false);
  const [isRangePopoverOpen, setIsRangePopoverOpen] = useState(false);
  const [isTimezoneMenuOpen, setIsTimezoneMenuOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [highlightedEventKey, setHighlightedEventKey] = useState<string | null>(null);
  const [pendingJumpKey, setPendingJumpKey] = useState<string | null>(null);
  const eventsRef = useRef<CalendarEvent[]>([]);
  const lastSuccessfulQueryKeyRef = useRef<string | null>(null);
  const impactMenuRef = useRef<HTMLDivElement | null>(null);
  const countryMenuRef = useRef<HTMLDivElement | null>(null);
  const rangePopoverRef = useRef<HTMLDivElement | null>(null);
  const timezoneMenuRef = useRef<HTMLDivElement | null>(null);
  const customStartInputRef = useRef<HTMLInputElement | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);

  const activeRange = useMemo(() => {
    if (preset === "today") {
      const todayRange = getTodayUtcRangeSeconds(new Date());
      return {
        from: todayRange.from,
        to: todayRange.to,
      };
    }

    if (preset === "this_week" || preset === "next_week") {
      const weekRange = getPresetRange(preset, new Date(), { from: null, to: null });
      return toUtcRangeSeconds(weekRange.from, weekRange.to);
    }

    return toUtcRangeSeconds(customFrom, customTo);
  }, [customFrom, customTo, preset]);

  const activeQueryKey = useMemo(
    () =>
      buildCalendarQueryKey({
        from: activeRange.from != null ? new Date(activeRange.from * 1000) : null,
        to: activeRange.to != null ? new Date(activeRange.to * 1000) : null,
        impacts,
        countries,
      }),
    [activeRange.from, activeRange.to, countries, impacts],
  );

  useEffect(() => {
    const id = window.setInterval(() => setUiNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const next = await fetchServerTime();
      if (cancelled) return;
      setMt5ServerTime(next);
      setMt5FetchedAtMs(Date.now());
    };

    void load();
    const id = window.setInterval(() => void load(), 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadCountrySource = async () => {
      try {
        const countryEvents = await fetchCalendar({
          from: activeRange.from,
          to: activeRange.to,
          impacts: ALL_IMPACTS,
        });

        if (cancelled) return;
        setCountrySourceEvents(countryEvents);
      } catch {
        if (cancelled) return;
      }
    };

    void loadCountrySource();
    return () => {
      cancelled = true;
    };
  }, [activeRange.from, activeRange.to]);

  useEffect(() => {
    setLastSyncedAt(persistedLastSyncedAt);
  }, [persistedLastSyncedAt]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!impactMenuRef.current?.contains(target)) setIsImpactMenuOpen(false);
      if (!countryMenuRef.current?.contains(target)) setIsCountryMenuOpen(false);
      if (!rangePopoverRef.current?.contains(target)) setIsRangePopoverOpen(false);
      if (!timezoneMenuRef.current?.contains(target)) setIsTimezoneMenuOpen(false);
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current != null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setStatus("loading");
      try {
        const calendarEvents = await fetchCalendar({
          from: activeRange.from,
          to: activeRange.to,
          impacts,
          countries,
        });

        if (cancelled) return;

        eventsRef.current = calendarEvents;
        setEvents(calendarEvents);
        const syncedAt = Math.floor(Date.now() / 1000);
        setLastSyncedAt(syncedAt);
        onSyncSuccess?.(syncedAt);
        lastSuccessfulQueryKeyRef.current = activeQueryKey;
        setLastCalendarIngestAt(health.last_calendar_ingest_at ?? null);
        setStatus(resolveCalendarStatus({ eventsCount: calendarEvents.length, health }));
      } catch {
        if (cancelled) return;
        const queryChangedSinceLastSuccess = lastSuccessfulQueryKeyRef.current !== activeQueryKey;
        if (queryChangedSinceLastSuccess) {
          eventsRef.current = [];
          setEvents([]);
        }
        setLastCalendarIngestAt(health.last_calendar_ingest_at ?? null);
        setStatus(
          resolveCalendarStatus({
            eventsCount: queryChangedSinceLastSuccess ? 0 : eventsRef.current.length,
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
  }, [activeQueryKey, activeRange.from, activeRange.to, impacts, countries, health, onSyncSuccess]);

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

  const availableCountries = useMemo(() => {
    const seen = new Set<string>();

    countrySourceEvents.forEach((event) => {
      if (event.countryCode.trim()) {
        seen.add(event.countryCode.toUpperCase());
      }
    });

    countries.forEach((country) => {
      if (country.trim()) {
        seen.add(country.toUpperCase());
      }
    });

    const priority = MAJOR_COUNTRY_CODES.filter((code) => seen.has(code));
    const rest = [...seen]
      .filter((code) => !priority.includes(code as "US" | "EU" | "GB" | "JP" | "AU" | "CA" | "NZ" | "CH"))
      .sort((left, right) => getCountryDisplayName(left).localeCompare(getCountryDisplayName(right)));

    const ordered = [...priority, ...rest];
    return ordered.length > 0 ? ordered : [...MAJOR_COUNTRY_CODES];
  }, [countries, countrySourceEvents]);

  const groups = useMemo(() => groupByUtcDay(filteredEvents), [filteredEvents]);
  const nextVisibleEvent = useMemo(() => {
    const nowSeconds = Math.floor(uiNow / 1000);
    return filteredEvents
      .filter((event) => event.time >= nowSeconds)
      .sort((left, right) => left.time - right.time)[0] ?? null;
  }, [filteredEvents, uiNow]);
  const selectedEventExplainer = useMemo(
    () => (selectedEvent ? getCalendarEventExplainer(selectedEvent) : null),
    [selectedEvent],
  );

  const rangeLabel = useMemo(
    () => formatRangeLabelFromSeconds(activeRange.from, activeRange.to),
    [activeRange.from, activeRange.to],
  );

  const mt5TimeLabel = useMemo(
    () => formatCurrentMt5Time(mt5ServerTime, mt5FetchedAtMs, uiNow),
    [mt5FetchedAtMs, mt5ServerTime, uiNow],
  );
  const timezoneOptions = useMemo(() => getDisplayTimezoneOptions(new Date(uiNow)), [uiNow]);
  const currentViewerTime = useMemo(
    () =>
      formatCurrentTimeForDisplayTimezone({
        nowMs: uiNow,
        selection: timezoneMode,
        serverTimeSeconds: mt5ServerTime,
        serverFetchedAtMs: mt5FetchedAtMs,
      }),
    [mt5FetchedAtMs, mt5ServerTime, timezoneMode, uiNow],
  );
  const statusLabel =
    status === "live"
      ? "Live"
      : status === "stale"
        ? "Stale"
        : status === "loading"
          ? "Syncing"
          : status === "no_data"
            ? "No data"
            : "Offline";

  const statusHelpText =
    status === "stale"
      ? "Stale means this tab is showing retained calendar rows, but the latest bridge or MT5 calendar ingest is old or failed. Check Broker feed to see whether MT5/broker data itself is delayed."
      : status === "live"
        ? "Live means the local bridge responded and the latest MT5/broker calendar ingest is fresh enough for normal use."
        : status === "loading"
          ? "Syncing means this tab is currently asking the local bridge for calendar rows."
          : status === "no_data"
            ? "No data means the bridge responded, but there are no rows for the current range or filters. With High impact selected, this often just means no high-impact releases are loaded for that date."
            : "Offline means the bridge request failed and this tab has no retained rows available for this query.";
  const viewFreshness = getCalendarFreshness(lastSyncedAt, uiNow);
  const brokerFreshness = getCalendarFreshness(lastCalendarIngestAt, uiNow);
  const visibleEventCountLabel =
    filteredEvents.length === events.length ? `${filteredEvents.length} events` : `${filteredEvents.length} of ${events.length} events`;
  const selectedEventKey = selectedEvent ? buildCalendarEventKey(selectedEvent) : null;
  const showCalendarEmptyState = groups.length === 0 && status !== "loading" && status !== "error";

  const handleSelectToday = () => {
    setPreset("today");
    setIsRangePopoverOpen(false);
  };

  const handleSelectThisWeek = () => {
    setPreset("this_week");
    setIsRangePopoverOpen(false);
    setIsImpactMenuOpen(false);
    setIsCountryMenuOpen(false);
    setIsTimezoneMenuOpen(false);
  };

  const handleSelectNextWeek = () => {
    setPreset("next_week");
    setIsRangePopoverOpen(false);
    setIsImpactMenuOpen(false);
    setIsCountryMenuOpen(false);
    setIsTimezoneMenuOpen(false);
  };

  const handleIncludeAllImpacts = () => {
    setImpacts(ALL_IMPACTS);
    setIsImpactMenuOpen(false);
  };

  const handleOpenRangePopover = () => {
    const fallback = stripToLocalDate(new Date());
    setDraftFrom(stripToLocalDate(customFrom) ?? fallback);
    setDraftTo(stripToLocalDate(customTo) ?? stripToLocalDate(customFrom) ?? fallback);
    setIsRangePopoverOpen(true);
    setIsImpactMenuOpen(false);
    setIsCountryMenuOpen(false);
    setIsTimezoneMenuOpen(false);
  };

  useLayoutEffect(() => {
    if (!isRangePopoverOpen) return;

    const input = customStartInputRef.current;
    if (!input) return;

    const inputWithPicker = input as HTMLInputElement & { showPicker?: () => void };
    input.focus();
    try {
      inputWithPicker.showPicker?.();
    } catch {
      input.focus();
    }
  }, [isRangePopoverOpen]);

  const applyCustomRange = () => {
    const fallback = stripToLocalDate(new Date());
    const nextFrom = draftFrom ?? fallback;
    const nextTo = draftTo ?? nextFrom ?? fallback;

    if (!nextFrom || !nextTo) return;

    setCustomFrom(nextFrom <= nextTo ? nextFrom : nextTo);
    setCustomTo(nextFrom <= nextTo ? nextTo : nextFrom);
    setPreset("custom");
    setIsRangePopoverOpen(false);
  };

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

  useEffect(() => {
    if (!navigationIntent) return;

    const range = getCalendarIntentDayRange(navigationIntent.eventTime);
    setCustomFrom(range.from);
    setCustomTo(range.to);
    setPreset("custom");
    setImpacts(DEFAULT_IMPACTS);
    setCountries([]);
    setSearch("");
    setSelectedEvent(null);
    setPendingJumpKey(navigationIntent.eventKey);
    onConsumeNavigationIntent?.();
  }, [navigationIntent, onConsumeNavigationIntent]);

  useLayoutEffect(() => {
    if (!pendingJumpKey) return;
    const target = document.querySelector<HTMLElement>(`[data-event-key="${pendingJumpKey}"]`);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedEventKey(pendingJumpKey);
    setPendingJumpKey(null);

    if (highlightTimeoutRef.current != null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedEventKey(null);
    }, 2200);
  }, [groups, pendingJumpKey]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedEvent(null);
      }
    };

    if (selectedEvent) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [selectedEvent]);

  return (
    <section className="tab-panel workspace-page workspace-page-compact calendar-page flex flex-col gap-4">
      <div className="calendar-operational-rail">
        <div className="calendar-rail-title">
          <div className="calendar-rail-heading">
            <h2>Economic Calendar</h2>
            <div className={`calendar-feed-status calendar-feed-status-${status}`}>
              <span className="calendar-feed-dot" aria-hidden="true" />
              <HelpHint label={statusLabel} detail={statusHelpText} />
            </div>
          </div>
          <p>{visibleEventCountLabel} in current view</p>
        </div>

        <div className="calendar-rail-freshness">
          <FreshnessChip
            label="View refreshed"
            detail="When this tab last asked the local bridge for calendar rows and received a response. If this is fresh but Broker feed is stale, the app is working but MT5/broker data may be old."
            freshness={viewFreshness}
          />
          <FreshnessChip
            label="Broker feed"
            detail="When the bridge last ingested economic-calendar rows from MT5/broker. This is the main freshness check for whether the calendar data itself is stale."
            freshness={brokerFreshness}
          />
        </div>
      </div>

      <div className="calendar-tv-shell">
        <div className="calendar-tv-toolbar">
          <div className="calendar-tv-left">
            <button
              type="button"
              className={preset === "today" ? "tv-toolbar-button is-active" : "tv-toolbar-button"}
              onClick={handleSelectToday}
            >
              Today
            </button>

            <button
              type="button"
              className={preset === "this_week" ? "tv-toolbar-button is-active" : "tv-toolbar-button"}
              onClick={handleSelectThisWeek}
            >
              This Week
            </button>

            <button
              type="button"
              className={preset === "next_week" ? "tv-toolbar-button is-active" : "tv-toolbar-button"}
              onClick={handleSelectNextWeek}
            >
              Next Week
            </button>

            <div className="tv-toolbar-anchor" ref={rangePopoverRef}>
              <button
                type="button"
                className={preset === "custom" ? "tv-toolbar-button is-active" : "tv-toolbar-button"}
                onClick={handleOpenRangePopover}
              >
                <Calendar size={16} />
                <span>{rangeLabel}</span>
                <ChevronDown size={15} />
              </button>

              {isRangePopoverOpen && (
                <div className="tv-popover tv-range-popover">
                  <div className="tv-popover-head">
                    <strong>Custom range</strong>
                    <span>MT5/UTC ordering stays unchanged.</span>
                  </div>
                  <div className="tv-date-grid">
                    <label className="tv-field">
                      <span>Start</span>
                      <input
                        ref={customStartInputRef}
                        type="date"
                        value={toDateInputValue(draftFrom)}
                        onChange={(event) => setDraftFrom(parseDateInput(event.target.value))}
                      />
                    </label>
                    <label className="tv-field">
                      <span>End</span>
                      <input
                        type="date"
                        value={toDateInputValue(draftTo)}
                        onChange={(event) => setDraftTo(parseDateInput(event.target.value))}
                      />
                    </label>
                  </div>
                  <div className="tv-popover-actions">
                    <button type="button" className="tv-text-button" onClick={handleSelectToday}>
                      Back to today
                    </button>
                    <button type="button" className="tv-solid-button" onClick={applyCustomRange}>
                      Apply range
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="calendar-tv-right">
            <div className="tv-toolbar-anchor" ref={impactMenuRef}>
              <button
                type="button"
                className="tv-toolbar-button"
                onClick={() => {
                  setIsImpactMenuOpen((current) => !current);
                  setIsCountryMenuOpen(false);
                  setIsRangePopoverOpen(false);
                  setIsTimezoneMenuOpen(false);
                }}
              >
                <ImpactSummary impacts={impacts} />
                <ChevronDown size={15} />
              </button>

              {isImpactMenuOpen && (
                <div className="tv-popover tv-filter-popover">
                  <div className="tv-popover-head">
                    <strong>Impact</strong>
                    <span>Broker importance label. This only filters visible rows.</span>
                  </div>
                  {ALL_IMPACTS.map((impact) => {
                    const selected = impacts.includes(impact);
                    return (
                      <button
                        key={impact}
                        type="button"
                        className={selected ? "tv-option-row is-selected" : "tv-option-row"}
                        onClick={() => toggleImpact(impact)}
                      >
                        <span className="tv-option-main">
                          <ImpactPill level={impact} />
                        </span>
                        {selected && <Check size={15} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="tv-toolbar-anchor" ref={countryMenuRef}>
              <button
                type="button"
                className="tv-toolbar-button"
                onClick={() => {
                  setIsCountryMenuOpen((current) => !current);
                  setIsImpactMenuOpen(false);
                  setIsRangePopoverOpen(false);
                  setIsTimezoneMenuOpen(false);
                }}
              >
                <Globe size={16} />
                <span className="calendar-control-text">
                  <span>Countries</span>
                  <strong>{summarizeCountries(countries)}</strong>
                </span>
                <ChevronDown size={15} />
              </button>

              {isCountryMenuOpen && (
                <div className="tv-popover tv-filter-popover">
                  <div className="tv-popover-head">
                    <strong>Countries</strong>
                    <span>Countries found in the loaded MT5 calendar range. This only filters the current table.</span>
                  </div>
                  <button type="button" className="tv-option-row" onClick={() => setCountries([])}>
                    <span className="tv-option-main">
                      <Globe size={15} />
                      <span className="tv-option-label">All countries</span>
                    </span>
                    {countries.length === 0 && <Check size={15} />}
                  </button>
                  {availableCountries.map((country) => {
                    const selected = countries.includes(country);
                    return (
                      <button
                        key={country}
                        type="button"
                        className={selected ? "tv-option-row is-selected" : "tv-option-row"}
                        onClick={() => toggleCountry(country)}
                      >
                        <span className="tv-option-main">
                          <FlagIcon countryCode={country} className="h-4 w-6 border border-gray-200 rounded-sm" />
                          <span className="tv-option-label">{getCountryDisplayName(country)}</span>
                        </span>
                        {selected && <Check size={15} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>

        <div className="calendar-tv-subbar">
          <label className="calendar-search calendar-search-compact">
            <Search size={15} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, currency, or country"
            />
          </label>

          <div className="calendar-tv-meta">
            <CalendarClockCard
              label="MT5"
              value={mt5TimeLabel.replace(" (MT5)", "")}
              detail="The current MT5/server clock estimate from the local bridge. Use it to check whether broker time is moving and whether timing delay comes from MT5/bridge instead of this screen."
              offline={mt5ServerTime == null}
            />
            <div className="tv-toolbar-anchor" ref={timezoneMenuRef}>
              <div className="calendar-clock-card calendar-clock-select-card">
                <span className="calendar-clock-icon">
                  <Clock size={16} />
                </span>
                <span className="calendar-control-text">
                  <span>
                    <HelpHint
                      label="Viewer"
                      detail="The same event times converted into your selected viewing timezone. Change this when you want rows to match your local clock or another trading session clock."
                    />
                  </span>
                  <strong>{currentViewerTime}</strong>
                </span>
                <button
                  type="button"
                  className="calendar-card-menu-button"
                  aria-label="Change viewer timezone"
                  onClick={() => {
                    setIsTimezoneMenuOpen((current) => !current);
                    setIsCountryMenuOpen(false);
                    setIsImpactMenuOpen(false);
                    setIsRangePopoverOpen(false);
                  }}
                >
                  <ChevronDown size={15} />
                </button>
              </div>

              {isTimezoneMenuOpen && (
                <div className="tv-popover tv-filter-popover">
                  <div className="tv-popover-head">
                    <strong>Viewer timezone</strong>
                    <span>Only changes how this tab displays event times. MT5 remains the broker audit clock.</span>
                  </div>
                  <div className="tv-timezone-list">
                    {timezoneOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={timezoneMode === option.id ? "tv-option-row is-selected" : "tv-option-row"}
                        onClick={() => {
                          setTimezoneMode(option.id);
                          saveDisplayTimezoneSelection(CALENDAR_TIMEZONE_KEY, option.id);
                          setIsTimezoneMenuOpen(false);
                        }}
                      >
                        <span className="tv-option-main">
                          <Clock size={15} />
                          <span className="tv-option-label">
                            {option.label}
                            {option.isHighlighted ? <span className="tv-option-badge">Local</span> : null}
                          </span>
                        </span>
                        {timezoneMode === option.id && <Check size={15} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <CalendarClockCard
              label="Next event"
              value={nextVisibleEvent ? formatCountdown(nextVisibleEvent.time, uiNow) : "N/A"}
              detail="Countdown to the next future event currently visible after your range, impact, country, and search filters."
              icon={<Calendar size={16} />}
              subValue={nextVisibleEvent ? `${nextVisibleEvent.currency} ${nextVisibleEvent.title}` : "No future row"}
            />
          </div>
        </div>
      </div>

      {(status === "error" || status === "stale") && (
        <div className={`alert-panel alert-${status}`}>
          {status === "error" && "Bridge unavailable. Keep MetaTrader 5 and the local bridge running, then refresh this tab."}
          {status === "stale" && "Calendar feed is stale. Rows below are retained MT5 events from the last successful ingest; they are not freshly verified yet."}
        </div>
      )}

      <div className="data-table-shell calendar-table-shell">
        {showCalendarEmptyState ? (
          <div className="calendar-empty-state">
            <div className="calendar-empty-copy">
              <span>No high-signal rows in this view</span>
              <strong>No high-impact calendar rows are loaded for the selected range and filters.</strong>
              <p>
                The bridge responded. This usually means the current High-only view is too narrow, not that the calendar
                feed is broken.
              </p>
            </div>
            <div className="calendar-empty-actions" aria-label="Broaden calendar view">
              <button type="button" onClick={handleIncludeAllImpacts}>
                Include all impacts
              </button>
              <button type="button" onClick={handleSelectThisWeek}>
                This Week
              </button>
              <button type="button" onClick={handleSelectNextWeek}>
                Next Week
              </button>
            </div>
          </div>
        ) : null}
        {groups.length > 0 ? (
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
                      onClick={() => setSelectedEvent(event)}
                      onKeyDown={(keyboardEvent) => {
                        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                          keyboardEvent.preventDefault();
                          setSelectedEvent(event);
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
                  )})}
                </Fragment>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      {selectedEvent && selectedEventExplainer
        ? createPortal(
            <div className="calendar-event-overlay" onClick={() => setSelectedEvent(null)}>
              <CalendarEventInspectorDrawer
                event={selectedEvent}
                explainer={selectedEventExplainer}
                timezoneMode={timezoneMode}
                onClose={() => setSelectedEvent(null)}
              />
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
