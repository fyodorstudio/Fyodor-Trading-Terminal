import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearChartHistoryCache,
  loadChartFavorites,
  readChartHistoryCache,
  saveChartFavorites,
  saveChartHistoryCache,
  summarizeStoredChartHistory,
} from "@/app/lib/chartStorage";
import type { BridgeCandle, Timeframe } from "@/app/types";

const SAMPLE_CANDLE: BridgeCandle = {
  time: Date.UTC(2026, 4, 21, 8, 0, 0) / 1000,
  open: 1.16,
  high: 1.17,
  low: 1.15,
  close: 1.165,
  volume: 100,
};

function installLocalStorage() {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear: vi.fn(() => store.clear()),
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, String(value));
    }),
  };

  vi.stubGlobal("window", { localStorage: storage });
  return { storage, store };
}

function storedKeys(storage: Storage): string[] {
  return Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
    (key): key is string => key != null,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chartStorage helpers", () => {
  it("falls back safely when browser storage is unavailable", () => {
    expect(readChartHistoryCache("EURUSD", "H1")).toEqual([]);
    expect(loadChartFavorites()).toEqual([]);

    saveChartHistoryCache("EURUSD", "H1", [SAMPLE_CANDLE]);
    saveChartFavorites(["EURUSD"]);
    clearChartHistoryCache("EURUSD", "H1");

    expect(readChartHistoryCache("EURUSD", "H1")).toEqual([]);
  });

  it("stores chart history per symbol and timeframe", () => {
    installLocalStorage();
    const later = { ...SAMPLE_CANDLE, time: SAMPLE_CANDLE.time + 60, close: 1.166 };

    saveChartHistoryCache("eurusd", "H1", [later, SAMPLE_CANDLE]);
    saveChartHistoryCache("EURUSD", "M5", [{ ...SAMPLE_CANDLE, close: 1.2 }]);

    expect(readChartHistoryCache("EURUSD", "H1")).toEqual([SAMPLE_CANDLE, later]);
    expect(readChartHistoryCache("EURUSD", "M5")[0]?.close).toBe(1.2);
  });

  it("rejects malformed cache rows and summarizes valid stored candles", () => {
    const { storage, store } = installLocalStorage();
    saveChartHistoryCache("EURUSD", "H1", [SAMPLE_CANDLE]);
    const [cacheKey] = storedKeys(storage);
    expect(cacheKey).toBeTruthy();

    if (cacheKey) {
      store.set(cacheKey, JSON.stringify({ version: 1, candles: [{ ...SAMPLE_CANDLE, time: "bad" }] }));
    }
    expect(readChartHistoryCache("EURUSD", "H1")).toEqual([]);

    const later = { ...SAMPLE_CANDLE, time: SAMPLE_CANDLE.time + 60, close: 1.167 };
    saveChartHistoryCache("EURUSD", "H1", [SAMPLE_CANDLE, later]);

    expect(summarizeStoredChartHistory("EURUSD", "H1")).toEqual({
      count: 2,
      oldestTime: SAMPLE_CANDLE.time,
      latestTime: later.time,
    });
  });

  it("clears only the current symbol and timeframe cache", () => {
    installLocalStorage();
    saveChartHistoryCache("EURUSD", "H1", [SAMPLE_CANDLE]);
    saveChartHistoryCache("EURUSD", "M5", [{ ...SAMPLE_CANDLE, close: 1.2 }]);
    saveChartHistoryCache("GBPUSD", "H1", [{ ...SAMPLE_CANDLE, close: 1.3 }]);

    clearChartHistoryCache("eurusd", "H1");

    expect(readChartHistoryCache("EURUSD", "H1")).toEqual([]);
    expect(readChartHistoryCache("EURUSD", "M5")).toHaveLength(1);
    expect(readChartHistoryCache("GBPUSD", "H1")).toHaveLength(1);
  });

  it("loads and saves favorite symbols with the existing loose filtering behavior", () => {
    const { storage, store } = installLocalStorage();

    saveChartFavorites(["EURUSD", "USDJPY"]);
    expect(loadChartFavorites()).toEqual(["EURUSD", "USDJPY"]);

    const favoritesKey = storedKeys(storage).find((key) => key.includes("favorites"));
    expect(favoritesKey).toBeTruthy();

    if (favoritesKey) {
      store.set(favoritesKey, JSON.stringify(["EURUSD", 123, null, "XAUUSD"]));
    }
    expect(loadChartFavorites()).toEqual(["EURUSD", "XAUUSD"]);
  });

  it("trims chart history cache predictably", () => {
    installLocalStorage();
    const candles = Array.from({ length: 5002 }, (_, index): BridgeCandle => ({
      ...SAMPLE_CANDLE,
      time: SAMPLE_CANDLE.time + index * 60,
      close: SAMPLE_CANDLE.close + index / 100000,
    }));

    saveChartHistoryCache("EURUSD", "H1" as Timeframe, candles);
    const cached = readChartHistoryCache("EURUSD", "H1");

    expect(cached).toHaveLength(5000);
    expect(cached[0]?.time).toBe(SAMPLE_CANDLE.time + 2 * 60);
    expect(cached[cached.length - 1]?.time).toBe(SAMPLE_CANDLE.time + 5001 * 60);
  });
});
