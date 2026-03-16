import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { deriveEventQualitySummary, classifyEventQualityFamily } from "@/app/lib/eventQuality";
import { EventQualityTab } from "@/app/tabs/EventQualityTab";
import type { CalendarEvent } from "@/app/types";

function buildEvent(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: overrides.id ?? 1,
    time: overrides.time ?? 1_763_200_000,
    countryCode: overrides.countryCode ?? "US",
    currency: overrides.currency ?? "USD",
    title: overrides.title ?? "CPI y/y",
    impact: overrides.impact ?? "high",
    actual: overrides.actual ?? "",
    forecast: overrides.forecast ?? "",
    previous: overrides.previous ?? "",
  };
}

describe("classifyEventQualityFamily", () => {
  it("classifies representative MT5 titles into weighted families", () => {
    expect(classifyEventQualityFamily("Fed Interest Rate Decision")?.family).toBe("policy");
    expect(classifyEventQualityFamily("CPI y/y")?.family).toBe("inflation");
    expect(classifyEventQualityFamily("Nonfarm Payrolls")?.family).toBe("labor");
    expect(classifyEventQualityFamily("GDP q/q")?.family).toBe("gdp");
    expect(classifyEventQualityFamily("ISM Manufacturing PMI")?.family).toBe("activity");
    expect(classifyEventQualityFamily("Trade Balance")?.family).toBe("trade_confidence");
  });

  it("ignores noisy titles that should not affect event quality", () => {
    expect(classifyEventQualityFamily("Fed Chair Speech")).toBeNull();
    expect(classifyEventQualityFamily("BoE Minutes")).toBeNull();
  });
});

describe("deriveEventQualitySummary", () => {
  const now = 1_763_200_000;

  it("scores only base and quote currency events inside the selected horizon", () => {
    const summary = deriveEventQualitySummary({
      pair: { name: "EURUSD", base: "EUR", quote: "USD" },
      horizon: "24h",
      nowSeconds: now,
      events: [
        buildEvent({ id: 1, currency: "USD", title: "CPI y/y", impact: "high", time: now + 60 }),
        buildEvent({ id: 2, currency: "EUR", title: "ECB Interest Rate Decision", impact: "medium", time: now + 120 }),
        buildEvent({ id: 3, currency: "JPY", title: "CPI y/y", impact: "high", time: now + 180 }),
      ],
    });

    expect(summary.rows).toHaveLength(2);
    expect(summary.totalScore).toBeCloseTo(12.2, 5);
    expect(summary.label).toBe("dirty");
  });

  it("returns a clean zero-score state when no relevant events are matched", () => {
    const summary = deriveEventQualitySummary({
      pair: { name: "AUDNZD", base: "AUD", quote: "NZD" },
      horizon: "72h",
      nowSeconds: now,
      events: [buildEvent({ currency: "USD", title: "Retail Sales", impact: "medium", time: now + 10_000 })],
    });

    expect(summary.totalScore).toBe(0);
    expect(summary.rows).toHaveLength(0);
    expect(summary.label).toBe("clean");
    expect(summary.note).toContain("No matched");
  });

  it("forces dirty when a high-impact policy, inflation, or labor event lands inside 24h", () => {
    const summary = deriveEventQualitySummary({
      pair: { name: "GBPUSD", base: "GBP", quote: "USD" },
      horizon: "this_week",
      nowSeconds: now,
      events: [buildEvent({ currency: "GBP", title: "BoE Interest Rate Decision", impact: "high", time: now + 3600 })],
    });

    expect(summary.immediateTrigger).toBe(true);
    expect(summary.label).toBe("dirty");
  });
});

describe("EventQualityTab", () => {
  const now = 1_763_200_000;

  it("renders the tab, default pair, and methodology block", () => {
    const html = renderToStaticMarkup(
      <EventQualityTab
        events={[
          buildEvent({ currency: "USD", title: "CPI y/y", impact: "high", time: now + 60 }),
          buildEvent({ currency: "EUR", title: "ECB Interest Rate Decision", impact: "medium", time: now + 120 }),
        ]}
        status="live"
        lastCalendarIngestAt={now}
      />,
    );

    expect(html).toContain("Event Quality");
    expect(html).toContain("EURUSD");
    expect(html).toContain("How the score is weighted");
    expect(html).toContain("Weighted score");
  });
});
