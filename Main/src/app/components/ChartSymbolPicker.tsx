import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, Search, Star } from "lucide-react";
import { CHART_TIMEFRAMES } from "@/app/lib/chartDisplay";
import { loadChartFavorites, saveChartFavorites } from "@/app/lib/chartStorage";
import type { BridgeSymbol, Timeframe } from "@/app/types";

interface GroupedSymbols {
  label: string;
  items: BridgeSymbol[];
}

interface ChartSymbolPickerProps {
  selectedSymbol: string;
  symbols: BridgeSymbol[];
  timeframe: Timeframe;
  onSelectedSymbolChange: (symbol: string) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onRefreshSymbols?: (background?: boolean) => Promise<void>;
  onMarketWatchActiveChange?: (active: boolean) => void;
}

type SymbolPickerMode = "browse" | "market_watch";

export function filterMarketWatchSymbols(symbols: readonly BridgeSymbol[], search: string): BridgeSymbol[] {
  const query = search.trim().toLowerCase();
  return query ? symbols.filter((item) => item.name.toLowerCase().includes(query)) : [...symbols];
}

export function formatMarketWatchPrice(value: number | null, digits: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const precision = digits == null || !Number.isFinite(digits) ? 5 : Math.max(0, Math.min(10, Math.trunc(digits)));
  return value.toFixed(precision);
}

export function formatMarketWatchChange(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function ChartSymbolPicker({
  selectedSymbol,
  symbols,
  timeframe,
  onSelectedSymbolChange,
  onTimeframeChange,
  onRefreshSymbols,
  onMarketWatchActiveChange,
}: ChartSymbolPickerProps) {
  const [favorites, setFavorites] = useState<string[]>(() => loadChartFavorites());
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<SymbolPickerMode>("browse");
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const symbolGroupKey = useMemo(
    () => symbols.map((item) => `${item.name}:${item.path ?? ""}`).join("|"),
    [symbols],
  );

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!pickerRef.current?.contains(target)) setPickerOpen(false);
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    if (!pickerOpen || pickerMode !== "market_watch" || !onRefreshSymbols) return;
    void onRefreshSymbols(true);
    const timer = window.setInterval(() => void onRefreshSymbols(true), 1_000);
    return () => window.clearInterval(timer);
  }, [onRefreshSymbols, pickerMode, pickerOpen]);

  useEffect(() => {
    const active = pickerOpen && pickerMode === "market_watch";
    onMarketWatchActiveChange?.(active);
    return () => {
      if (active) onMarketWatchActiveChange?.(false);
    };
  }, [onMarketWatchActiveChange, pickerMode, pickerOpen]);

  useEffect(() => {
    const groups = Array.from(
      new Set(
        symbols.map((item) => {
          const root = item.path?.split(/[\\/]/)[0]?.trim();
          return root || "Other";
        }),
      ),
    ).sort();
    setExpandedGroups(groups.length > 0 ? [groups[0]] : []);
  }, [symbolGroupKey]);

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

  const marketWatchItems = useMemo(
    () => filterMarketWatchSymbols(symbols, search),
    [search, symbols],
  );

  const selectSymbol = (symbol: string) => {
    onSelectedSymbolChange(symbol);
  };

  const toggleFavorite = (name: string) => {
    setFavorites((current) => {
      const next = current.includes(name) ? current.filter((item) => item !== name) : [...current, name];
      saveChartFavorites(next);
      return next;
    });
  };

  const toggleGroup = (label: string) => {
    setExpandedGroups((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
    );
  };

  return (
    <div className="chart-workbar-left">
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => setPickerOpen(!pickerOpen)}
          className="chart-symbol-button"
        >
          <Search className="h-4 w-4 text-gray-400" />
          <span>{selectedSymbol}</span>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${pickerOpen ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence>
          {pickerOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={pickerMode === "market_watch"
                ? "chart-symbol-picker-panel is-market-watch absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-[100] overflow-hidden"
                : "chart-symbol-picker-panel absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-2xl shadow-2xl z-[100] overflow-hidden"}
            >
              <div className="chart-symbol-picker-modes" role="tablist" aria-label="Symbol selector mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={pickerMode === "browse"}
                  className={pickerMode === "browse" ? "is-active" : ""}
                  onClick={() => setPickerMode("browse")}
                >
                  Browse
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={pickerMode === "market_watch"}
                  className={pickerMode === "market_watch" ? "is-active" : ""}
                  onClick={() => setPickerMode("market_watch")}
                >
                  Market Watch
                </button>
              </div>
              <div className="p-3 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={pickerMode === "market_watch" ? "Search all broker symbols..." : "Search symbols..."}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-gray-200"
                  />
                </div>
              </div>

              {pickerMode === "browse" ? (
              <div className="max-h-[400px] overflow-auto p-2 space-y-1">
                {favoriteItems.length > 0 && !search && (
                  <div className="mb-4">
                    <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Favorites</div>
                    {favoriteItems.map((item) => (
                      <button
                        key={item.name}
                        onClick={() => selectSymbol(item.name)}
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
                        onClick={() => toggleGroup(group.label)}
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
                              onClick={() => selectSymbol(item.name)}
                              className="flex items-center justify-between w-full pl-8 pr-3 py-2 hover:bg-gray-50 rounded-lg text-sm"
                            >
                              <span className="font-medium text-gray-700">{item.name}</span>
                              <Star
                                className={`h-3.5 w-3.5 transition-colors ${favorites.includes(item.name) ? "fill-amber-400 text-amber-400" : "text-gray-300 hover:text-gray-400"}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleFavorite(item.name);
                                }}
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
              ) : (
                <div className="chart-market-watch" role="tabpanel">
                  <div className="chart-market-watch-count">
                    {search ? `${marketWatchItems.length} matching` : `${symbols.length} broker symbols`}
                  </div>
                  <div className="chart-market-watch-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Symbol</th>
                          <th>Bid</th>
                          <th>Ask</th>
                          <th>Daily Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketWatchItems.map((item) => {
                          const changeClass = item.priceChange == null
                            ? "is-unavailable"
                            : item.priceChange > 0
                              ? "is-positive"
                              : item.priceChange < 0
                                ? "is-negative"
                                : "is-flat";
                          return (
                            <tr
                              key={item.name}
                              className={item.name === selectedSymbol ? "is-selected" : ""}
                              onClick={() => selectSymbol(item.name)}
                            >
                              <td>
                                <button type="button">
                                  <span aria-hidden="true" className={changeClass}>{item.priceChange != null && item.priceChange < 0 ? "↓" : "↑"}</span>
                                  {item.name}
                                </button>
                              </td>
                              <td className="chart-market-watch-bid">{formatMarketWatchPrice(item.bid, item.digits)}</td>
                              <td className="chart-market-watch-ask">{formatMarketWatchPrice(item.ask, item.digits)}</td>
                              <td className={changeClass}>{formatMarketWatchChange(item.priceChange)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {marketWatchItems.length === 0 && (
                      <div className="chart-market-watch-empty">No symbols match your search.</div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="chart-timeframe-strip">
        {CHART_TIMEFRAMES.map((item) => (
          <button
            key={item}
            onClick={() => onTimeframeChange(item)}
            className={timeframe === item ? "chart-timeframe-button is-active" : "chart-timeframe-button"}
          >
            {item === "MN1" ? "MN" : item}
          </button>
        ))}
      </div>
    </div>
  );
}
