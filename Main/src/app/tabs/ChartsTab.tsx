import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { ChevronDown, ChevronRight, Search, Star } from "lucide-react";
import { fetchHistory, fetchSymbols, openChartStream } from "@/app/lib/bridge";
import { formatUtcDateTime, formatCountdown } from "@/app/lib/format";
import { resolveChartStatus } from "@/app/lib/status";
import type { BridgeStatus, BridgeSymbol, MarketStatusResponse, Timeframe } from "@/app/types";

const FAVORITES_KEY = "fyodor-main-chart-favorites";
const DEBUG_MAX = 60;
const DEFAULT_SYMBOL = "EURUSD";
const TIMEFRAMES: Timeframe[] = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"];
const PREFERRED_SYMBOLS = ["EURUSD", "USDJPY", "GBPUSD", "XAUUSD"];

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveFavorites(items: string[]) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(items));
  } catch {
    // ignore local storage failures
  }
}

function pickInitialSymbol(symbols: BridgeSymbol[]): string {
  for (const preferred of PREFERRED_SYMBOLS) {
    const found = symbols.find((symbol) => symbol.name.toUpperCase() === preferred);
    if (found) return found.name;
  }
  return symbols[0]?.name ?? DEFAULT_SYMBOL;
}

interface GroupedSymbols {
  label: string;
  items: BridgeSymbol[];
}

interface ChartsTabProps {
  marketStatus: MarketStatusResponse | null;
  selectedSymbol: string;
  onSelectedSymbolChange: (symbol: string) => void;
}

export function ChartsTab({ marketStatus, selectedSymbol, onSelectedSymbolChange }: ChartsTabProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("H1");
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "no_data" | "error">("loading");
  const [symbols, setSymbols] = useState<BridgeSymbol[]>([]);
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites());
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [lastCandleTime, setLastCandleTime] = useState<number | null>(null);
  const [loadingText, setLoadingText] = useState("Loading chart data...");
  const [streamConnected, setStreamConnected] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const addLog = useCallback((line: string) => {
    setDebugLines((current) => {
      const next = [...current, `[${new Date().toISOString()}] ${line}`];
      return next.slice(-DEBUG_MAX);
    });
  }, []);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchSymbols().then((items) => {
      if (cancelled) return;
      setSymbols(items);
      if (items.length > 0) {
        onSelectedSymbolChange(
          selectedSymbol === DEFAULT_SYMBOL ? pickInitialSymbol(items) : selectedSymbol,
        );
        const groups = Array.from(
          new Set(
            items.map((item) => {
              const root = item.path?.split(/[\\/]/)[0]?.trim();
              return root || "Other";
            }),
          ),
        ).sort();
        setExpandedGroups(groups.length > 0 ? [groups[0]] : []);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [onSelectedSymbolChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || chartRef.current) return;

    const chart = createChart(container, {
      layout: {
        background: { type: "solid", color: "transparent" },
        textColor: "#23262d",
        fontFamily: "Aptos, 'Helvetica Neue', sans-serif",
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        rightOffset: 2,
        barSpacing: 7,
      },
      grid: {
        vertLines: { color: "rgba(35, 38, 45, 0.08)" },
        horzLines: { color: "rgba(35, 38, 45, 0.08)" },
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#1f9d55",
      downColor: "#c92a2a",
      wickUpColor: "#1f9d55",
      wickDownColor: "#c92a2a",
      borderUpColor: "#1f9d55",
      borderDownColor: "#c92a2a",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const applySize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        chart.applyOptions({ width: rect.width, height: rect.height });
      }
    };

    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    const isJpy = selectedSymbol.toUpperCase().includes("JPY");
    series.applyOptions({
      priceFormat: isJpy
        ? { type: "price", precision: 3, minMove: 0.001 }
        : { type: "price", precision: 5, minMove: 0.00001 },
    });

    let cancelled = false;
    setHistoryState("loading");
    setLoadingText(`Loading ${selectedSymbol} ${timeframe}...`);

    const load = async () => {
      try {
        const candles = await fetchHistory(selectedSymbol, timeframe, 300);
        if (cancelled) return;
        if (candles.length === 0) {
          series.setData([]);
          setHistoryState("no_data");
          setLastCandleTime(null);
          addLog(`history returned no candles for ${selectedSymbol} ${timeframe}`);
          return;
        }

        series.setData(candles as CandlestickData[]);
        chart.timeScale().fitContent();
        setHistoryState("ready");
        setLastCandleTime(candles[candles.length - 1]?.time ?? null);
        addLog(`history loaded ${candles.length} candles for ${selectedSymbol} ${timeframe}`);
      } catch (error) {
        if (cancelled) return;
        series.setData([]);
        setHistoryState("error");
        setLastCandleTime(null);
        addLog(
          `history failed for ${selectedSymbol} ${timeframe}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedSymbol, timeframe, addLog]);

  useEffect(() => {
    setStreamConnected(false);
    if (historyState !== "ready") return;
    if (marketStatus?.session_state === "closed") {
      addLog(`market closed for ${selectedSymbol}; keeping last known candles on screen`);
      return;
    }

    const socket = openChartStream(selectedSymbol, timeframe, {
      onOpen: () => {
        setStreamConnected(true);
        addLog("WebSocket connected");
      },
      onClose: () => {
        setStreamConnected(false);
        addLog("WebSocket closed");
      },
      onError: () => {
        setStreamConnected(false);
        addLog("WebSocket error");
      },
      onMessage: (payload) => {
        if (!payload || typeof payload !== "object") return;
        const message = payload as {
          type?: string;
          message?: string;
          candle?: CandlestickData;
        };
        if ((message.type === "candle_update" || message.type === "candle_new") && message.candle) {
          seriesRef.current?.update(message.candle);
          setLastCandleTime(message.candle.time as number);
          setStreamConnected(true);
        }
        if (message.type === "status" && message.message === "mt5_not_connected") {
          setStreamConnected(false);
          addLog("bridge reported MT5 not connected; keeping last known candles visible");
        }
        if (message.type === "status" && message.message === "no_data") {
          setStreamConnected(false);
          addLog("bridge stream reported no live update; chart remains on last known candles");
        }
      },
    });

    return () => socket.close();
  }, [selectedSymbol, timeframe, historyState, marketStatus?.session_state, addLog]);

  const status: BridgeStatus = useMemo(
    () =>
      resolveChartStatus({
        historyState,
        marketStatus,
        streamConnected,
      }),
    [historyState, marketStatus, streamConnected],
  );

  const groupedSymbols = useMemo<GroupedSymbols[]>(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? symbols.filter((item) => item.name.toLowerCase().includes(query))
      : symbols;
    const groups = new Map<string, BridgeSymbol[]>();
    filtered.forEach((item) => {
      const group = item.path?.split(/[\\/]/)[0]?.trim() || "Other";
      const list = groups.get(group) ?? [];
      list.push(item);
      groups.set(group, list);
    });
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, items]) => ({ label, items }));
  }, [search, symbols]);

  const favoriteItems = useMemo(
    () =>
      favorites
        .map((name) => symbols.find((item) => item.name === name))
        .filter((item): item is BridgeSymbol => item != null),
    [favorites, symbols],
  );

  const toggleFavorite = useCallback((name: string) => {
    setFavorites((current) => {
      const next = current.includes(name) ? current.filter((item) => item !== name) : [...current, name];
      saveFavorites(next);
      return next;
    });
  }, []);

  const statusHeadline =
    status === "live"
      ? "Connected to MT5 - live data."
      : status === "loading"
        ? loadingText
        : status === "stale"
          ? "Market closed or stream idle - showing last known candles."
          : "NO DATA. Open MetaTrader 5 and run the MT5 bridge for live data.";

  const statusFoot =
    status === "live"
      ? lastCandleTime
        ? `Live data - Last market time: ${formatUtcDateTime(lastCandleTime)}`
        : "Live data - Waiting for updates"
      : status === "stale"
        ? lastCandleTime
          ? `Market closed - showing candles through ${formatUtcDateTime(lastCandleTime)}`
          : "Market closed - waiting for retained MT5 candles."
        : "NO DATA - The chart will stay empty until MT5 history is available.";

  const sessionDetail = useMemo(() => {
    if (!marketStatus || marketStatus.session_state === "unavailable") {
      return "Session unavailable";
    }
    if (marketStatus.session_state === "open") {
      return `Market open - closes in ${formatCountdown(marketStatus.next_close_time)}`;
    }
    return `Market closed - opens in ${formatCountdown(marketStatus.next_open_time)}`;
  }, [marketStatus]);

  return (
    <section className="tab-panel charts-panel">
      <div className="section-head charts-head">
        <div>
          <h2>Charts</h2>
          <p
            className={
              status === "live"
                ? "status-text-live"
                : status === "loading"
                  ? "status-text-loading"
                  : status === "stale"
                    ? "status-text-stale"
                    : "status-text-error"
            }
          >
            {statusHeadline}
          </p>
          <p className="status-text-subtle">{sessionDetail}</p>
        </div>

        <div className="chart-controls">
          <div className="control-group" ref={pickerRef}>
            <span className="control-label">Symbol</span>
            <button type="button" className="picker-trigger" onClick={() => setPickerOpen((open) => !open)}>
              <span>{selectedSymbol}</span>
              <ChevronDown size={16} />
            </button>
            {pickerOpen && (
              <div className="picker-panel">
                <label className="picker-search">
                  <Search size={14} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search symbols"
                  />
                </label>

                {favoriteItems.length > 0 && (
                  <div className="picker-block">
                    <div className="picker-block-title">Favorites</div>
                    {favoriteItems.map((item) => (
                      <button
                        key={`favorite-${item.name}`}
                        type="button"
                        className="picker-item"
                        onClick={() => {
                          onSelectedSymbolChange(item.name);
                          setPickerOpen(false);
                        }}
                      >
                        <span>{item.name}</span>
                        <Star
                          size={14}
                          className="star-active"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleFavorite(item.name);
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}

                <div className="picker-scroll">
                  {groupedSymbols.length === 0 ? (
                    <div className="picker-empty">No symbols available from bridge.</div>
                  ) : (
                    groupedSymbols.map((group) => {
                      const open = expandedGroups.includes(group.label);
                      return (
                        <div className="picker-block" key={group.label}>
                          <button
                            type="button"
                            className="picker-group"
                            onClick={() =>
                              setExpandedGroups((current) =>
                                current.includes(group.label)
                                  ? current.filter((item) => item !== group.label)
                                  : [...current, group.label],
                              )
                            }
                          >
                            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span>{group.label}</span>
                          </button>
                          {open &&
                            group.items.map((item) => {
                              const isFavorite = favorites.includes(item.name);
                              return (
                                <button
                                  key={item.name}
                                  type="button"
                                  className="picker-item picker-item-nested"
                                  onClick={() => {
                                    onSelectedSymbolChange(item.name);
                                    setPickerOpen(false);
                                  }}
                                >
                                  <span>{item.name}</span>
                                  <Star
                                    size={14}
                                    className={isFavorite ? "star-active" : "star-idle"}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      toggleFavorite(item.name);
                                    }}
                                  />
                                </button>
                              );
                            })}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="control-group">
            <span className="control-label">Timeframe</span>
            <div className="timeframe-strip">
              {TIMEFRAMES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={item === timeframe ? "timeframe-button is-active" : "timeframe-button"}
                  onClick={() => setTimeframe(item)}
                >
                  {item === "MN1" ? "MN" : item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="chart-shell">
        <div ref={containerRef} className="chart-canvas" />
        {(status === "error" || status === "no_data") && (
          <div className="chart-overlay">
            <strong>NO DATA</strong>
            <span>Open MetaTrader 5 and keep the MT5 bridge running to render this chart.</span>
          </div>
        )}
      </div>

      <div
        className={
          status === "live"
            ? "chart-status-line is-live"
            : status === "stale"
              ? "chart-status-line is-stale"
              : "chart-status-line is-error"
        }
      >
        {statusFoot}
      </div>

      <div className="log-panel">
        <div className="log-head">
          <h3>Debug Log</h3>
          <button
            type="button"
            className="text-button"
            onClick={() => void navigator.clipboard.writeText(debugLines.join("\n") || "(empty)")}
          >
            Copy
          </button>
        </div>
        <div className="log-body" role="log">
          {debugLines.length === 0 ? (
            <div className="log-empty">No chart events yet.</div>
          ) : (
            debugLines.map((line, index) => <div key={`${index}-${line}`}>{line}</div>)
          )}
        </div>
      </div>
    </section>
  );
}
