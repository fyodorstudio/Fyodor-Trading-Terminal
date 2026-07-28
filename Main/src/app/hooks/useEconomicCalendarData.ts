import { useEffect, useMemo, useRef, useState } from "react";
import { fetchCalendar } from "@/app/lib/bridge";
import { buildCalendarQueryKey } from "@/app/lib/calendarDisplay";
import { resolveCalendarStatus } from "@/app/lib/status";
import type { BridgeHealth, BridgeStatus, CalendarEvent, ImpactLevel } from "@/app/types";

interface CalendarRangeSeconds {
  from: number | null;
  to: number | null;
}

interface UseEconomicCalendarDataArgs {
  activeRange: CalendarRangeSeconds;
  impacts: ImpactLevel[];
  allImpacts: ImpactLevel[];
  countries: string[];
  health: BridgeHealth;
  persistedLastSyncedAt: number | null;
  onSyncSuccess?: (timestampSeconds: number) => void;
}

export function useEconomicCalendarData({
  activeRange,
  impacts,
  allImpacts,
  countries,
  health,
  persistedLastSyncedAt,
  onSyncSuccess,
}: UseEconomicCalendarDataArgs) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [countrySourceEvents, setCountrySourceEvents] = useState<CalendarEvent[]>([]);
  const [status, setStatus] = useState<BridgeStatus>("loading");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(persistedLastSyncedAt);
  const [lastCalendarIngestAt, setLastCalendarIngestAt] = useState<number | null>(
    health.last_calendar_ingest_at ?? null,
  );
  const eventsRef = useRef<CalendarEvent[]>([]);
  const lastSuccessfulQueryKeyRef = useRef<string | null>(null);

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
    let cancelled = false;

    const loadCountrySource = async () => {
      try {
        const countryEvents = await fetchCalendar({
          from: activeRange.from,
          to: activeRange.to,
          impacts: allImpacts,
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
  }, [activeRange.from, activeRange.to, allImpacts]);

  useEffect(() => {
    setLastSyncedAt(persistedLastSyncedAt);
  }, [persistedLastSyncedAt]);

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

  return {
    events,
    countrySourceEvents,
    status,
    lastSyncedAt,
    lastCalendarIngestAt,
  };
}
