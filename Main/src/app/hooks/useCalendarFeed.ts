import { useEffect, useRef, useState } from "react";
import { fetchCalendar, fetchHealth } from "@/app/lib/bridge";
import { resolveCalendarStatus } from "@/app/lib/status";
import type { BridgeHealth, BridgeStatus, CalendarEvent } from "@/app/types";

const POLL_INTERVAL_MS = 60_000;

function getFeedWindow() {
  const now = new Date();
  const from = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  return {
    from: Math.floor(from.getTime() / 1000),
    to: Math.floor(to.getTime() / 1000),
  };
}

export function useCalendarFeed() {
  const [health, setHealth] = useState<BridgeHealth>({ ok: false, bridge_connected: false, terminal_connected: false });
  const [feedEvents, setFeedEvents] = useState<CalendarEvent[]>([]);
  const [feedStatus, setFeedStatus] = useState<BridgeStatus>("loading");
  const feedEventsRef = useRef<CalendarEvent[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const windowRange = getFeedWindow();
      const [healthResult, calendarResult] = await Promise.allSettled([
        fetchHealth(),
        fetchCalendar({
          from: windowRange.from,
          to: windowRange.to,
          impacts: ["low", "medium", "high"],
        }),
      ]);

      if (cancelled) return;

      const nextHealth =
        healthResult.status === "fulfilled"
          ? healthResult.value
          : ({ ok: false, bridge_connected: false, terminal_connected: false } satisfies BridgeHealth);

      setHealth(nextHealth);

      if (calendarResult.status === "fulfilled") {
        feedEventsRef.current = calendarResult.value;
        setFeedEvents(calendarResult.value);
        setFeedStatus(resolveCalendarStatus({ eventsCount: calendarResult.value.length, health: nextHealth }));
        return;
      }

      setFeedStatus(
        resolveCalendarStatus({
          eventsCount: feedEventsRef.current.length,
          health: nextHealth,
          calendarRequestFailed: true,
        }),
      );
    };

    void load();
    const id = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return { health, feedEvents, feedStatus };
}
