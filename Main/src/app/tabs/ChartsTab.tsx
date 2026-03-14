import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { ChevronDown, ChevronRight, Search, Star, Activity, Clock, AlertTriangle, Database } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
        textColor: "#64748b",
        fontFamily: "Inter, system-ui, sans-serif",
      },
      rightPriceScale: { 
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.2 }
      },
      timeScale: {
        borderVisible: false,
        rightOffset: 5,
        barSpacing: 10,
      },
      grid: {
        vertLines: { color: "rgba(100, 116, 139, 0.05)" },
        horzLines: { color: "rgba(100, 116, 139, 0.05)" },
      },
      crosshair: {
        vertLine: { labelBackgroundColor: "#1e293b" },
        horzLine: { labelBackgroundColor: "#1e293b" },
      }
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
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

  const sessionDetail = useMemo(() => {
    if (!marketStatus || marketStatus.session_state === "unavailable") {
      return "Session unavailable";
    }
    if (marketStatus.session_state === "open") {
      return `Closes in ${formatCountdown(marketStatus.next_close_time)}`;
    }
    return `Opens in ${formatCountdown(marketStatus.next_open_time)}`;
  }, [marketStatus]);

  return (
    <div className="flex flex-col gap-6 max-w-[1460px] mx-auto pb-12">
      {/* Chart Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-2xl shadow-sm relative z-50">
        <div className="flex items-center gap-6">
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-sm font-bold text-gray-900 shadow-sm"
            >
              <Search className="h-4 w-4 text-gray-400" />
              <span>{selectedSymbol}</span>
              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {pickerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-2xl shadow-2xl z-[100] overflow-hidden"
                >
                  <div className="p-3 border-b border-gray-100">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search symbols..."
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-gray-200"
                      />
                    </div>
                  </div>

                  <div className="max-h-[400px] overflow-auto p-2 space-y-1">
                    {favoriteItems.length > 0 && !search && (
                      <div className="mb-4">
                        <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Favorites</div>
                        {favoriteItems.map((item) => (
                          <button
                            key={item.name}
                            onClick={() => { onSelectedSymbolChange(item.name); setPickerOpen(false); }}
                            className="flex items-center justify-between w-full px-3 py-2 hover:bg-gray-50 rounded-lg text-sm group"
                          >
                            <span className="font-bold text-gray-700">{item.name}</span>
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          </button>
                        ))}
                      </div>
                    )}

                    {groupedSymbols.map((group) => {
                      const isOpen = search ? true : expandedGroups.includes(group.label);
                      return (
                        <div key={group.label} className="border-b border-gray-50 last:border-0">
                          <button
                            onClick={() => setExpandedGroups(prev => prev.includes(group.label) ? prev.filter(g => g !== group.label) : [...prev, group.label])}
                            className="flex items-center justify-between w-full px-3 py-2 hover:bg-gray-50 rounded-lg text-sm text-gray-500 font-bold"
                          >
                            <span className="flex items-center gap-2">
                              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              {group.label}
                            </span>
                            <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-full">{group.items.length}</span>
                          </button>
                          
                          {isOpen && (
                            <div className="overflow-hidden pb-1">
                              {group.items.map((item) => (
                                <button
                                  key={item.name}
                                  onClick={() => { onSelectedSymbolChange(item.name); setPickerOpen(false); }}
                                  className="flex items-center justify-between w-full pl-8 pr-3 py-2 hover:bg-gray-50 rounded-lg text-sm"
                                >
                                  <span className="font-medium text-gray-700">{item.name}</span>
                                  <Star 
                                    className={`h-3.5 w-3.5 transition-colors ${favorites.includes(item.name) ? 'fill-amber-400 text-amber-400' : 'text-gray-300 hover:text-gray-400'}`}
                                    onClick={(e) => { e.stopPropagation(); toggleFavorite(item.name); }}
                                  />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {groupedSymbols.length === 0 && (
                      <div className="p-8 text-center text-gray-400 text-sm">
                        No symbols match your search.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
            {TIMEFRAMES.map((item) => (
              <button
                key={item}
                onClick={() => setTimeframe(item)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${timeframe === item ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}
              >
                {item === "MN1" ? "MN" : item}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-100 rounded-full">
            <Activity className={`h-4 w-4 ${status === 'live' ? 'text-green-500 animate-pulse' : 'text-gray-400'}`} />
            <span className="text-sm font-bold text-gray-700 whitespace-nowrap">{status === 'live' ? 'Live Stream' : 'Disconnected'}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-100 rounded-full">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-bold text-gray-700 whitespace-nowrap">{sessionDetail}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-full">
            <Database className={`h-4 w-4 ${lastCandleTime ? 'text-blue-400' : 'text-gray-500'}`} />
            <span className="text-xs font-bold text-gray-300 whitespace-nowrap">
              {lastCandleTime ? `Feed: ${formatUtcDateTime(lastCandleTime)}` : 'Waiting for data'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Chart Section */}
      <div className="relative group">
        <div className="p-1 backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-3xl shadow-sm overflow-hidden">
          <div ref={containerRef} className="h-[600px] w-full" />
        </div>

        {/* Overlay for errors/no data */}
        <AnimatePresence>
          {(status === "error" || status === "no_data") && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/40 backdrop-blur-xl rounded-3xl z-50 text-center p-8"
            >
              <div className="p-4 bg-red-50 rounded-full text-red-500">
                <AlertTriangle className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Market Connection</h3>
                <p className="text-gray-600 max-w-sm">Please ensure MetaTrader 5 is running and the MT5 bridge is connected to receive live data for {selectedSymbol}.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Debug Panel (Collapsible) */}
      <div className="backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            Terminal Console
          </h3>
          <button
            onClick={() => void navigator.clipboard.writeText(debugLines.join("\n") || "(empty)")}
            className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors"
          >
            Copy Logs
          </button>
        </div>
        <div className="h-32 overflow-auto p-4 bg-gray-50/50 font-mono text-[10px] leading-relaxed text-gray-500">
          {debugLines.length === 0 ? (
            <div className="italic">Awaiting first market event...</div>
          ) : (
            debugLines.map((line, index) => <div key={index} className="mb-1">{line}</div>)
          )}
        </div>
      </div>
    </div>
  );
}
