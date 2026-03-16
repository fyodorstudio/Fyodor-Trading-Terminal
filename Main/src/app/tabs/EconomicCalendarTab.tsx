import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, Calendar, Check, ChevronDown, CircleHelp, Clock, Database, Globe, Search, Star } from "lucide-react";
import { fetchCalendar, fetchServerTime } from "@/app/lib/bridge";
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
import { getCountryDisplayName, MAJOR_COUNTRY_CODES } from "@/app/config/currencyConfig";
import { FlagIcon } from "@/app/components/FlagIcon";
import type { BridgeHealth, BridgeStatus, CalendarEvent, ImpactLevel } from "@/app/types";

const DEFAULT_IMPACTS: ImpactLevel[] = ["low", "medium", "high"];

type CalendarTimezoneMode = "local" | "utc";
type CalendarRangeMode = "today" | "this_week" | "custom";

function HelpHint({ label, detail }: { label: string; detail: string }) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      top: rect.top - 10,
      left: rect.left + rect.width / 2,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 10,
        left: rect.left + rect.width / 2,
      });
    };

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  return (
    <span className="calendar-help-hint">
      {label}
      <button
        ref={triggerRef}
        type="button"
        className="calendar-help-button"
        aria-label={detail}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <CircleHelp size={12} />
      </button>
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              className="calendar-help-popover"
              role="tooltip"
              style={{ top: position.top, left: position.left }}
            >
              {detail}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}

function buildCalendarQueryKey(params: {
  from: Date | null;
  to: Date | null;
  impacts: ImpactLevel[];
  countries: string[];
}): string {
  return JSON.stringify({
    from: params.from ? Math.floor(params.from.getTime() / 1000) : null,
    to: params.to ? Math.floor(params.to.getTime() / 1000) : null,
    impacts: [...params.impacts].sort(),
    countries: [...params.countries].sort(),
  });
}

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

function stripToLocalDate(date: Date | null): Date | null {
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toUtcRangeSeconds(from: Date | null, to: Date | null): { from: number | null; to: number | null } {
  if (!from && !to) return { from: null, to: null };

  const start = stripToLocalDate(from ?? to);
  const end = stripToLocalDate(to ?? from);

  if (!start || !end) return { from: null, to: null };

  const normalizedFrom = start <= end ? start : end;
  const normalizedTo = start <= end ? end : start;

  return {
    from: Math.floor(
      Date.UTC(
        normalizedFrom.getFullYear(),
        normalizedFrom.getMonth(),
        normalizedFrom.getDate(),
        0,
        0,
        0,
      ) / 1000,
    ),
    to: Math.floor(
      Date.UTC(
        normalizedTo.getFullYear(),
        normalizedTo.getMonth(),
        normalizedTo.getDate(),
        23,
        59,
        59,
      ) / 1000,
    ),
  };
}

function getTodayUtcRangeSeconds(now: Date): { from: number; to: number } {
  return {
    from: Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0) / 1000),
    to: Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59) / 1000),
  };
}

function formatUiAge(timestampSeconds: number | null, nowMs: number): string {
  if (timestampSeconds == null) return "never";
  const diff = Math.max(0, Math.floor(nowMs / 1000 - timestampSeconds));
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  const secs = diff % 60;
  if (mins < 60) return `${mins}m ${secs}s ago`;
  return formatRelativeAge(timestampSeconds);
}

function formatRangeLabel(from: Date | null, to: Date | null): string {
  if (!from || !to) return "Select range";

  const sameDay = from.toDateString() === to.toDateString();
  if (sameDay) {
    return from.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const sameYear = from.getFullYear() === to.getFullYear();
  if (sameYear) {
    return `${from.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} - ${to.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }

  return `${from.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} - ${to.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function formatRangeLabelFromSeconds(fromSeconds: number | null, toSeconds: number | null): string {
  if (fromSeconds == null || toSeconds == null) return "Select range";

  const from = new Date(fromSeconds * 1000);
  const to = new Date(toSeconds * 1000);

  const formatDay = (date: Date, withYear: boolean) =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
      timeZone: "UTC",
    });

  const sameDay = from.toISOString().slice(0, 10) === to.toISOString().slice(0, 10);
  if (sameDay) {
    return formatDay(from, true);
  }

  const sameYear = from.getUTCFullYear() === to.getUTCFullYear();
  return sameYear ? `${formatDay(from, false)} - ${formatDay(to, true)}` : `${formatDay(from, true)} - ${formatDay(to, true)}`;
}

function formatViewerDateTime(timestampSeconds: number, mode: CalendarTimezoneMode): string {
  return mode === "utc" ? formatUtcDateTime(timestampSeconds) : formatLocalDateTime(timestampSeconds);
}

function getLocalTimezoneSummary(now: Date): string {
  const offsetMinutes = -now.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const offset = minutes === 0 ? `${hours}` : `${hours}:${String(minutes).padStart(2, "0")}`;
  return `UTC${sign}${offset} ${getLocalTimezoneLabel()}`;
}

function getLocalUtcOffsetShort(now: Date): string {
  const offsetMinutes = -now.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return minutes === 0 ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${String(minutes).padStart(2, "0")}`;
}

function formatCurrentViewerTime(now: Date, mode: CalendarTimezoneMode): string {
  if (mode === "utc") {
    return `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")} (UTC)`;
  }

  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} (${getLocalUtcOffsetShort(now)})`;
}

function formatCurrentMt5Time(serverTimeSeconds: number | null, fetchedAtMs: number | null, nowMs: number): string {
  if (serverTimeSeconds == null || fetchedAtMs == null) return "MT5 unavailable";

  const elapsedSeconds = Math.max(0, Math.floor((nowMs - fetchedAtMs) / 1000));
  const liveTime = new Date((serverTimeSeconds + elapsedSeconds) * 1000);
  const hours = String(liveTime.getUTCHours()).padStart(2, "0");
  const minutes = String(liveTime.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes} (MT5)`;
}

function summarizeImpacts(impacts: ImpactLevel[]): string {
  if (impacts.length >= 3) return "All impacts";
  if (impacts.length === 1) return `${impacts[0][0].toUpperCase()}${impacts[0].slice(1)} only`;
  return `${impacts.length} impacts`;
}

function summarizeCountries(countries: string[]): string {
  if (countries.length === 0) return "All countries";
  if (countries.length === 1) {
    return getCountryDisplayName(countries[0]);
  }

  const first = getCountryDisplayName(countries[0]);
  return `${first} + ${countries.length - 1}`;
}

interface EconomicCalendarTabProps {
  health: BridgeHealth;
  persistedLastSyncedAt?: number | null;
  onSyncSuccess?: (timestampSeconds: number) => void;
}

export function EconomicCalendarTab({
  health,
  persistedLastSyncedAt = null,
  onSyncSuccess,
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
  const [status, setStatus] = useState<BridgeStatus>("loading");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(persistedLastSyncedAt);
  const [lastCalendarIngestAt, setLastCalendarIngestAt] = useState<number | null>(null);
  const [uiNow, setUiNow] = useState(Date.now());
  const [mt5ServerTime, setMt5ServerTime] = useState<number | null>(null);
  const [mt5FetchedAtMs, setMt5FetchedAtMs] = useState<number | null>(null);
  const [timezoneMode, setTimezoneMode] = useState<CalendarTimezoneMode>("local");
  const [isImpactMenuOpen, setIsImpactMenuOpen] = useState(false);
  const [isCountryMenuOpen, setIsCountryMenuOpen] = useState(false);
  const [isRangePopoverOpen, setIsRangePopoverOpen] = useState(false);
  const [isTimezoneMenuOpen, setIsTimezoneMenuOpen] = useState(false);
  const eventsRef = useRef<CalendarEvent[]>([]);
  const lastSuccessfulQueryKeyRef = useRef<string | null>(null);
  const impactMenuRef = useRef<HTMLDivElement | null>(null);
  const countryMenuRef = useRef<HTMLDivElement | null>(null);
  const rangePopoverRef = useRef<HTMLDivElement | null>(null);
  const timezoneMenuRef = useRef<HTMLDivElement | null>(null);

  const activeRange = useMemo(() => {
    if (preset === "today") {
      const todayRange = getTodayUtcRangeSeconds(new Date());
      return {
        from: todayRange.from,
        to: todayRange.to,
      };
    }

    if (preset === "this_week") {
      const weekRange = getPresetRange("this_week", new Date(), { from: null, to: null });
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

    events.forEach((event) => {
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
  }, [countries, events]);

  const groups = useMemo(() => groupByUtcDay(filteredEvents), [filteredEvents]);

  const rangeLabel = useMemo(
    () => formatRangeLabelFromSeconds(activeRange.from, activeRange.to),
    [activeRange.from, activeRange.to],
  );

  const mt5TimeLabel = useMemo(
    () => formatCurrentMt5Time(mt5ServerTime, mt5FetchedAtMs, uiNow),
    [mt5FetchedAtMs, mt5ServerTime, uiNow],
  );
  const currentViewerTime = useMemo(() => formatCurrentViewerTime(new Date(uiNow), timezoneMode), [timezoneMode, uiNow]);
  const localTimezoneSummary = useMemo(() => getLocalTimezoneSummary(new Date(uiNow)), [uiNow]);
  const timezoneLabel = timezoneMode === "utc" ? "UTC" : localTimezoneSummary;

  const statusLabel =
    status === "live"
      ? "LIVE"
      : status === "stale"
        ? "STALE"
        : status === "loading"
          ? "SYNCING"
          : status === "no_data"
            ? "NO DATA"
            : "OFFLINE";

  const statusBadgeClass =
    status === "live"
      ? "bg-green-50 text-green-700 border-green-200"
      : status === "stale"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : status === "loading"
          ? "bg-blue-50 text-blue-700 border-blue-200"
          : status === "no_data"
            ? "bg-slate-50 text-slate-700 border-slate-200"
            : "bg-red-50 text-red-700 border-red-200";

  const statusDotClass =
    status === "live"
      ? "bg-green-500 animate-pulse"
      : status === "loading"
        ? "bg-blue-500 animate-pulse"
        : "bg-current";

  const statusHelpText =
    status === "stale"
      ? "Stale means retained calendar rows are still visible, but the latest MT5 ingest is no longer fresh enough or the latest refresh failed."
      : status === "live"
        ? "Live means the bridge is reachable and the latest MT5 calendar ingest is still fresh."
        : status === "loading"
          ? "Syncing means this tab is currently waiting for a fresh response from the bridge."
          : status === "no_data"
            ? "No data means the bridge responded, but there are no calendar rows for the current range or filters."
            : "Offline means the bridge request failed and there are no retained rows available for this query.";

  const handleSelectToday = () => {
    setPreset("today");
    setIsRangePopoverOpen(false);
  };

  const handleOpenRangePopover = () => {
    const fallback = stripToLocalDate(new Date());
    setDraftFrom(stripToLocalDate(customFrom) ?? fallback);
    setDraftTo(stripToLocalDate(customTo) ?? stripToLocalDate(customFrom) ?? fallback);
    setIsRangePopoverOpen((current) => !current);
    setIsImpactMenuOpen(false);
    setIsCountryMenuOpen(false);
    setIsTimezoneMenuOpen(false);
  };

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

  return (
    <section className="tab-panel flex flex-col gap-6 max-w-[1460px] mx-auto pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-2xl shadow-sm relative z-50">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-gray-900 rounded-xl shadow-lg">
            <Calendar className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-900 leading-tight">Economic Calendar</h2>
              <div
                className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest flex items-center gap-1.5 border ${statusBadgeClass}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass}`} />
                <HelpHint label={statusLabel} detail={statusHelpText} />
              </div>
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
              MT5 Server-Time Audit Feed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 px-4 py-2 bg-white border border-gray-100 rounded-xl shadow-sm">
            <div className="flex items-center gap-2 pr-3 border-r border-gray-100 min-w-[100px]">
              <Activity className="h-3.5 w-3.5 text-blue-500" />
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter leading-none mb-0.5">
                  <HelpHint
                    label="Sync Age"
                    detail="Sync Age measures how long ago this calendar tab last successfully fetched rows from the local bridge."
                  />
                </span>
                <span className="text-[11px] font-bold text-gray-900 tabular-nums">
                  {formatUiAge(lastSyncedAt, uiNow)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 min-w-[100px]">
              <Database className="h-3.5 w-3.5 text-blue-500" />
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter leading-none mb-0.5">
                  <HelpHint
                    label="Ingest Age"
                    detail="Ingest Age measures how long ago the bridge last successfully received calendar data pushed from MT5."
                  />
                </span>
                <span className="text-[11px] font-bold text-gray-900 tabular-nums">
                  {formatUiAge(lastCalendarIngestAt, uiNow)}
                </span>
              </div>
            </div>
          </div>
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
              onClick={() => {
                setPreset("this_week");
                setIsRangePopoverOpen(false);
              }}
            >
              This Week
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
                {impactStars(impacts.length === 1 ? impacts[0] : impacts.length === 2 ? "medium" : "high")}
                <span>{summarizeImpacts(impacts)}</span>
                <ChevronDown size={15} />
              </button>

              {isImpactMenuOpen && (
                <div className="tv-popover tv-filter-popover">
                  <div className="tv-popover-head">
                    <strong>Impact</strong>
                    <span>Filter visible events only.</span>
                  </div>
                  {DEFAULT_IMPACTS.map((impact) => {
                    const selected = impacts.includes(impact);
                    return (
                      <button
                        key={impact}
                        type="button"
                        className={selected ? "tv-option-row is-selected" : "tv-option-row"}
                        onClick={() => toggleImpact(impact)}
                      >
                        <span className="tv-option-main">
                          {impactStars(impact)}
                          <span className="tv-option-label">{impact}</span>
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
                <span>{summarizeCountries(countries)}</span>
                <ChevronDown size={15} />
              </button>

              {isCountryMenuOpen && (
                <div className="tv-popover tv-filter-popover">
                  <div className="tv-popover-head">
                    <strong>Countries</strong>
                    <span>Available MT5 countries in the current feed window.</span>
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
            <span className={mt5ServerTime == null ? "tv-time-chip is-offline" : "tv-time-chip"}>{mt5TimeLabel}</span>
            <div className="tv-toolbar-anchor" ref={timezoneMenuRef}>
              <button
                type="button"
                className="tv-time-button"
                onClick={() => {
                  setIsTimezoneMenuOpen((current) => !current);
                  setIsCountryMenuOpen(false);
                  setIsImpactMenuOpen(false);
                  setIsRangePopoverOpen(false);
                }}
              >
                <Clock size={16} />
                <span>{currentViewerTime}</span>
                <ChevronDown size={15} />
              </button>

              {isTimezoneMenuOpen && (
                <div className="tv-popover tv-filter-popover">
                  <div className="tv-popover-head">
                    <strong>Viewer timezone</strong>
                    <span>MT5/UTC remains the audit anchor.</span>
                  </div>
                  <button
                    type="button"
                    className={timezoneMode === "local" ? "tv-option-row is-selected" : "tv-option-row"}
                    onClick={() => {
                      setTimezoneMode("local");
                      setIsTimezoneMenuOpen(false);
                    }}
                  >
                    <span className="tv-option-main">
                      <Clock size={15} />
                      <span className="tv-option-label">{localTimezoneSummary}</span>
                    </span>
                    {timezoneMode === "local" && <Check size={15} />}
                  </button>
                  <button
                    type="button"
                    className={timezoneMode === "utc" ? "tv-option-row is-selected" : "tv-option-row"}
                    onClick={() => {
                      setTimezoneMode("utc");
                      setIsTimezoneMenuOpen(false);
                    }}
                  >
                    <span className="tv-option-main">
                      <Clock size={15} />
                      <span className="tv-option-label">UTC</span>
                    </span>
                    {timezoneMode === "utc" && <Check size={15} />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {(status === "error" || status === "stale" || status === "no_data") && (
        <div className={`alert-panel alert-${status}`}>
          {status === "error" && "Bridge unavailable. Keep MetaTrader 5 and the local bridge running, then refresh this tab."}
          {status === "stale" && "Calendar feed is stale. Retained MT5 events are still shown while the latest ingest or refresh is no longer fresh."}
          {status === "no_data" && "NO DATA for the selected range or filters. Broaden the range or verify the MT5 feed."}
        </div>
      )}

      <div className="data-table-shell">
        <table className="data-table calendar-table">
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
            {groups.length === 0 ? (
              <tr>
                <td colSpan={8} className="table-empty">
                  No calendar rows to display.
                </td>
              </tr>
            ) : (
              groups.map(([day, items]) => (
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
                  {items.map((event) => (
                    <tr key={`${event.id}-${event.time}`}>
                      <td>{formatUtcDateTime(event.time)}</td>
                      <td>{formatViewerDateTime(event.time, timezoneMode)}</td>
                      <td>
                        <div className="bank-cell">
                          <FlagIcon countryCode={event.countryCode} className="h-5 w-8 border border-gray-200 rounded-sm" />
                          <div>
                            <strong>{getCountryDisplayName(event.countryCode)}</strong>
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
