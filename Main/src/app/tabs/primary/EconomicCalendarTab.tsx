import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EconomicCalendarEventsTable } from "@/app/components/EconomicCalendarEventsTable";
import { EconomicCalendarToolbar, type CalendarRangeMode } from "@/app/components/EconomicCalendarToolbar";
import {
  CalendarEventInspectorDrawer,
  ImpactPill,
} from "@/app/components/EconomicCalendarInspector";
import { useEconomicCalendarData } from "@/app/hooks/useEconomicCalendarData";
import { fetchServerTime } from "@/app/lib/bridge";
import {
  formatCurrentMt5Time,
  formatRangeLabelFromSeconds,
  getCalendarFreshness,
  getTodayUtcRangeSeconds,
  groupByUtcDay,
  stripToLocalDate,
  toUtcRangeSeconds,
} from "@/app/lib/calendarDisplay";
import { getCalendarEventExplainer } from "@/app/lib/calendarEventExplain";
import { buildCalendarEventKey, getCalendarIntentDayRange } from "@/app/lib/calendarNavigation";
import { getPresetRange } from "@/app/lib/calendarRanges";
import {
  formatCurrentTimeForDisplayTimezone,
  getDisplayTimezoneOptions,
  loadDisplayTimezoneSelection,
  saveDisplayTimezoneSelection,
  type DisplayTimezoneSelection,
} from "@/app/lib/timezoneDisplay";
import { getCountryDisplayName, MAJOR_COUNTRY_CODES } from "@/app/config/currencyConfig";
import type { BridgeHealth, CalendarEvent, CalendarNavigationIntent, ImpactLevel } from "@/app/types";

export {
  CalendarEventInspectorDrawer,
  CalendarValueText,
  ImpactPill,
} from "@/app/components/EconomicCalendarInspector";

const ALL_IMPACTS: ImpactLevel[] = ["low", "medium", "high"];
const DEFAULT_IMPACTS: ImpactLevel[] = ["high"];

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

  const {
    events,
    countrySourceEvents,
    status,
    lastSyncedAt,
    lastCalendarIngestAt,
  } = useEconomicCalendarData({
    activeRange,
    impacts,
    allImpacts: ALL_IMPACTS,
    countries,
    health,
    persistedLastSyncedAt,
    onSyncSuccess,
  });

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
      <EconomicCalendarToolbar
        preset={preset}
        rangeLabel={rangeLabel}
        visibleEventCountLabel={visibleEventCountLabel}
        status={status}
        statusLabel={statusLabel}
        statusHelpText={statusHelpText}
        viewFreshness={viewFreshness}
        brokerFreshness={brokerFreshness}
        draftFrom={draftFrom}
        draftTo={draftTo}
        impacts={impacts}
        allImpacts={ALL_IMPACTS}
        countries={countries}
        availableCountries={availableCountries}
        search={search}
        mt5TimeLabel={mt5TimeLabel}
        mt5ServerTime={mt5ServerTime}
        currentViewerTime={currentViewerTime}
        timezoneMode={timezoneMode}
        timezoneOptions={timezoneOptions}
        nextVisibleEvent={nextVisibleEvent}
        uiNow={uiNow}
        isRangePopoverOpen={isRangePopoverOpen}
        isImpactMenuOpen={isImpactMenuOpen}
        isCountryMenuOpen={isCountryMenuOpen}
        isTimezoneMenuOpen={isTimezoneMenuOpen}
        rangePopoverRef={rangePopoverRef}
        impactMenuRef={impactMenuRef}
        countryMenuRef={countryMenuRef}
        timezoneMenuRef={timezoneMenuRef}
        customStartInputRef={customStartInputRef}
        onSelectToday={handleSelectToday}
        onSelectThisWeek={handleSelectThisWeek}
        onSelectNextWeek={handleSelectNextWeek}
        onOpenRangePopover={handleOpenRangePopover}
        onDraftFromChange={setDraftFrom}
        onDraftToChange={setDraftTo}
        onApplyCustomRange={applyCustomRange}
        onToggleImpactMenu={() => {
          setIsImpactMenuOpen((current) => !current);
          setIsCountryMenuOpen(false);
          setIsRangePopoverOpen(false);
          setIsTimezoneMenuOpen(false);
        }}
        onToggleImpact={toggleImpact}
        onToggleCountryMenu={() => {
          setIsCountryMenuOpen((current) => !current);
          setIsImpactMenuOpen(false);
          setIsRangePopoverOpen(false);
          setIsTimezoneMenuOpen(false);
        }}
        onClearCountries={() => setCountries([])}
        onToggleCountry={toggleCountry}
        onSearchChange={setSearch}
        onToggleTimezoneMenu={() => {
          setIsTimezoneMenuOpen((current) => !current);
          setIsCountryMenuOpen(false);
          setIsImpactMenuOpen(false);
          setIsRangePopoverOpen(false);
        }}
        onTimezoneChange={(optionId) => {
          setTimezoneMode(optionId);
          saveDisplayTimezoneSelection(CALENDAR_TIMEZONE_KEY, optionId);
          setIsTimezoneMenuOpen(false);
        }}
      />

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
        <EconomicCalendarEventsTable
          groups={groups}
          timezoneMode={timezoneMode}
          highlightedEventKey={highlightedEventKey}
          selectedEventKey={selectedEventKey}
          onSelectEvent={setSelectedEvent}
        />
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
