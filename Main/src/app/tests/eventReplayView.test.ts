import { describe, expect, it } from "vitest";
import { getFxPairByName } from "@/app/config/fxPairs";
import {
  buildReplaySampleCalendarEvent,
  formatReplayCount,
  formatReplayPercent,
  formatReplayPips,
  getReplayMove,
} from "@/app/lib/eventReplayView";
import type { BridgeCandle, ReactionReplaySample } from "@/app/types";

const eurusd = getFxPairByName("EURUSD")!;

describe("eventReplayView", () => {
  it("formats replay summary values", () => {
    expect(formatReplayCount(1)).toBe("1 release");
    expect(formatReplayCount(3)).toBe("3 releases");
    expect(formatReplayPips(12.345)).toBe("+12.3 pips");
    expect(formatReplayPips(null)).toBe("N/A");
    expect(formatReplayPercent(-0.12345)).toBe("-0.123%");
  });

  it("derives replay move from the event candle to the final candle", () => {
    const candles: BridgeCandle[] = [
      { time: 1, open: 1.1, high: 1.1, low: 1.1, close: 1.1, volume: 1 },
      { time: 2, open: 1.1, high: 1.105, low: 1.095, close: 1.101, volume: 1 },
      { time: 3, open: 1.101, high: 1.107, low: 1.1, close: 1.106, volume: 1 },
    ];

    expect(getReplayMove({ candles, eventIndex: 1 }, eurusd)).toEqual({
      pips: 50,
      percent: 0.4541,
      label: "higher",
    });
  });

  it("adapts a replay sample into a calendar event for shared explanations", () => {
    const sample: ReactionReplaySample = {
      eventId: "sample-1",
      eventTime: 1_763_200_000,
      currency: "USD",
      title: "CPI y/y",
      actual: "3.4",
      forecast: "3.2",
      previous: "3.1",
      comparisonBasis: "forecast",
      comparisonLabel: "Actual vs forecast",
      comparisonValue: 3.2,
      surprise: 0.2,
    };

    expect(buildReplaySampleCalendarEvent(sample)).toMatchObject({
      id: sample.eventTime,
      time: sample.eventTime,
      countryCode: "US",
      currency: "USD",
      title: "CPI y/y",
      impact: "high",
      actual: "3.4",
      forecast: "3.2",
      previous: "3.1",
    });
  });
});
