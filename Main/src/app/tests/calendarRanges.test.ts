import { describe, expect, it } from "vitest";
import { getPresetRange } from "@/app/lib/calendarRanges";

describe("getPresetRange", () => {
  const anchor = new Date(2026, 2, 13, 10, 30, 0);

  it("builds an inclusive custom range ending at the end of day", () => {
    const result = getPresetRange("custom", anchor, {
      from: new Date(2026, 2, 10),
      to: new Date(2026, 2, 12),
    });

    expect(result.from?.getDate()).toBe(10);
    expect(result.to?.getDate()).toBe(12);
    expect(result.to?.getHours()).toBe(23);
  });

  it("returns this week boundaries starting on Monday", () => {
    const result = getPresetRange("this_week", anchor, { from: null, to: null });

    expect(result.from?.getDay()).toBe(1);
    expect(result.to?.getDay()).toBe(0);
  });
});
