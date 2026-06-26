import { describe, expect, it } from "vitest";
import {
  DEFAULT_REPLAY_BEFORE_CANDLES,
  EVENT_REPLAY_STORAGE_KEYS,
  MAX_REPLAY_CANDLES,
  MIN_REPLAY_CANDLES,
  clampReplayCount,
  getInitialReplayCount,
  getStorageItem,
} from "@/app/lib/eventReplayStorage";

describe("eventReplayStorage", () => {
  it("clamps replay candle counts into the supported range", () => {
    expect(clampReplayCount(0, DEFAULT_REPLAY_BEFORE_CANDLES)).toBe(MIN_REPLAY_CANDLES);
    expect(clampReplayCount(12.6, DEFAULT_REPLAY_BEFORE_CANDLES)).toBe(13);
    expect(clampReplayCount(200, DEFAULT_REPLAY_BEFORE_CANDLES)).toBe(MAX_REPLAY_CANDLES);
    expect(clampReplayCount(Number.NaN, DEFAULT_REPLAY_BEFORE_CANDLES)).toBe(DEFAULT_REPLAY_BEFORE_CANDLES);
  });

  it("falls back safely when browser storage is unavailable", () => {
    expect(getStorageItem(EVENT_REPLAY_STORAGE_KEYS.pair)).toBeNull();
    expect(getInitialReplayCount(EVENT_REPLAY_STORAGE_KEYS.beforeCandles, DEFAULT_REPLAY_BEFORE_CANDLES)).toBe(
      DEFAULT_REPLAY_BEFORE_CANDLES,
    );
  });
});
