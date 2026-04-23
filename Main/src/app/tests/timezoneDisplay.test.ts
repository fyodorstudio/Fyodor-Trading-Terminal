import { describe, expect, it } from "vitest";
import {
  formatCurrentTimeForDisplayTimezone,
  formatDateTimeForDisplayTimezone,
  getDisplayTimezoneOptions,
  getDisplayTimezoneShortLabel,
} from "@/app/lib/timezoneDisplay";

describe("timezoneDisplay helpers", () => {
  it("exposes local, server, and full UTC offset options", () => {
    const options = getDisplayTimezoneOptions(new Date(Date.UTC(2026, 1, 19, 21, 0, 0)));
    expect(options[0]?.id).toBe("local");
    expect(options[1]?.id).toBe("server");
    expect(options.some((option) => option.id === "utc-offset:0")).toBe(true);
    expect(options.some((option) => option.id === "utc-offset:345")).toBe(true);
    expect(options.some((option) => option.id === "utc-offset:840")).toBe(true);
  });

  it("formats fixed UTC offsets without mutating source ordering", () => {
    const timestamp = Date.UTC(2026, 1, 19, 21, 0, 0) / 1000;
    expect(formatDateTimeForDisplayTimezone(timestamp, "server")).toBe("19 Feb 2026 21:00");
    expect(formatDateTimeForDisplayTimezone(timestamp, "utc-offset:345")).toBe("20 Feb 2026 02:45");
    expect(getDisplayTimezoneShortLabel("utc-offset:345")).toBe("UTC+05:45");
  });

  it("formats current time for MT5/server selection using fetched server time", () => {
    const label = formatCurrentTimeForDisplayTimezone({
      nowMs: Date.UTC(2026, 1, 19, 21, 5, 0),
      selection: "server",
      serverTimeSeconds: Date.UTC(2026, 1, 19, 21, 0, 0) / 1000,
      serverFetchedAtMs: Date.UTC(2026, 1, 19, 21, 0, 0),
    });
    expect(label).toBe("21:05 (MT5)");
  });
});
