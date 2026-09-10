import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearChartHistoryCache,
  loadChartFavorites,
  readChartHistoryCache,
  saveChartFavorites,
  saveChartHistoryCache,
  summarizeStoredChartHistory,
} from "@/app/lib/chartStorage";
import {
  buildResidentChartWarmPlan,
  loadResidentChartHistory,
  setResidentHistoryBackgroundPaused,
} from "@/app/features/chart-market-data/residentHistory";
import { areBridgeSymbolSnapshotsEqual } from "@/app/features/chart-market-data/symbolCatalog";
import {
  CHART_DOCK_LAYOUT_KEY,
  DEFAULT_CHART_DOCK_LAYOUT,
  loadChartDockLayout,
  normalizeChartDockLayout,
  saveChartDockLayout,
} from "@/app/features/chart-viewport/chartDockRegistry";
import type { BridgeCandle, BridgeSymbol, Timeframe } from "@/app/types";

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
  setResidentHistoryBackgroundPaused(false);
  vi.unstubAllGlobals();
});

describe("chartStorage helpers", () => {
  it("normalizes controlled dock placement and ignores unknown or invalid saved regions", () => {
    const { store } = installLocalStorage();
    store.set(CHART_DOCK_LAYOUT_KEY, JSON.stringify({
      version: 1,
      regions: { inspector: "left", fms: "right", context: "floating", removedPanel: "right" },
    }));

    expect(loadChartDockLayout()).toEqual({
      version: 1,
      regions: { fms: "left", inspector: "left", context: "bottom" },
    });
    expect(normalizeChartDockLayout({ version: 99, regions: { inspector: "left" } })).toEqual(DEFAULT_CHART_DOCK_LAYOUT);

    saveChartDockLayout({ version: 1, regions: { ...DEFAULT_CHART_DOCK_LAYOUT.regions, inspector: "left" } });
    expect(JSON.parse(store.get(CHART_DOCK_LAYOUT_KEY) ?? "null").regions.inspector).toBe("left");
  });

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

  it("keeps identical symbols isolated across broker catalog identities", () => {
    const { storage, store } = installLocalStorage();
    saveChartHistoryCache("SCOPEPAIR", "H1", [SAMPLE_CANDLE], "broker-a");
    saveChartHistoryCache("SCOPEPAIR", "H1", [{ ...SAMPLE_CANDLE, close: 1.25 }], "broker-b");

    expect(readChartHistoryCache("SCOPEPAIR", "H1", "broker-a")[0]?.close).toBe(SAMPLE_CANDLE.close);
    expect(readChartHistoryCache("SCOPEPAIR", "H1", "broker-b")[0]?.close).toBe(1.25);
    expect(readChartHistoryCache("SCOPEPAIR", "H1")).toEqual([]);
    const scopedPayloads = storedKeys(storage)
      .filter((key) => key.includes("chart-history-cache-v2"))
      .map((key) => JSON.parse(store.get(key) ?? "null"));
    expect(scopedPayloads).toHaveLength(2);
    expect(scopedPayloads.every((payload) => payload?.version === 1)).toBe(true);
  });

  it("rejects malformed cache rows and summarizes valid stored candles", () => {
    const { store } = installLocalStorage();
    store.set("fyodor-main-chart-history-cache-v1:1:NZDUSD:H1", JSON.stringify({
      version: 1,
      candles: [{ ...SAMPLE_CANDLE, time: "bad" }],
    }));
    expect(readChartHistoryCache("NZDUSD", "H1")).toEqual([]);

    const later = { ...SAMPLE_CANDLE, time: SAMPLE_CANDLE.time + 60, close: 1.167 };
    saveChartHistoryCache("NZDUSD", "H1", [SAMPLE_CANDLE, later]);

    expect(summarizeStoredChartHistory("NZDUSD", "H1")).toEqual({
      count: 2,
      oldestTime: SAMPLE_CANDLE.time,
      latestTime: later.time,
    });
  });

  it("keeps an opened chart load resident and shares an identical in-flight request", async () => {
    installLocalStorage();
    let releaseResponse: () => void = () => { throw new Error("History response was not initialized"); };
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      releaseResponse = () => resolve(new Response(JSON.stringify([SAMPLE_CANDLE]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    }));
    vi.stubGlobal("fetch", fetchMock);

    const first = loadResidentChartHistory("RESIDENTTEST", "H4", 350, "warm");
    const second = loadResidentChartHistory("residenttest", "H4", 350, "selected");
    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    releaseResponse();
    await expect(first).resolves.toEqual([SAMPLE_CANDLE]);
    expect(readChartHistoryCache("RESIDENTTEST", "H4")).toEqual([SAMPLE_CANDLE]);
  });

  it("warms every broker symbol while prioritizing selected timeframes, favorites, and visible rows", () => {
    const plan = buildResidentChartWarmPlan([
      { name: "EURUSD", path: "Forex\\Majors", bid: null, ask: null, priceChange: null, digits: 5, quoteTime: null, visible: true, selected: true },
      { name: "XAUUSD", path: "Metals", bid: null, ask: null, priceChange: null, digits: 2, quoteTime: null, visible: false, selected: false },
      { name: "JP225", path: "Indices", bid: null, ask: null, priceChange: null, digits: 1, quoteTime: null, visible: true, selected: true },
    ], "EURUSD", "H4", ["XAUUSD"]);

    expect(plan).toContainEqual({ symbol: "XAUUSD", timeframe: "H4" });
    expect(plan).toContainEqual({ symbol: "EURUSD", timeframe: "M1" });
    expect(plan).toContainEqual({ symbol: "EURUSD", timeframe: "MN1" });
    expect(plan.filter((request) => request.symbol === "EURUSD" && request.timeframe === "H4")).toHaveLength(1);
    expect(plan.findIndex((request) => request.symbol === "XAUUSD" && request.timeframe === "H4"))
      .toBeLessThan(plan.findIndex((request) => request.symbol === "JP225" && request.timeframe === "H4"));
    expect(plan).toHaveLength(11);
  });

  it("distinguishes a changed quote snapshot from an identical cached Market Watch response", () => {
    const snapshot: BridgeSymbol[] = [
      { name: "EURUSD", path: "Forex\\Majors", bid: 1.16, ask: 1.1602, priceChange: .2, digits: 5, quoteTime: 1_788_900_000, visible: true, selected: true },
    ];

    expect(areBridgeSymbolSnapshotsEqual(snapshot, snapshot.map((item) => ({ ...item })))).toBe(true);
    expect(areBridgeSymbolSnapshotsEqual(snapshot, [{ ...snapshot[0], bid: 1.1601 }])).toBe(false);
  });

  it("keeps opportunistic history queued while Market Watch owns background priority", async () => {
    installLocalStorage();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([SAMPLE_CANDLE]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    setResidentHistoryBackgroundPaused(true);

    const pending = loadResidentChartHistory("MARKETWATCHPAUSE", "H4", 350, "warm");
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();

    setResidentHistoryBackgroundPaused(false);
    await expect(pending).resolves.toEqual([SAMPLE_CANDLE]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
