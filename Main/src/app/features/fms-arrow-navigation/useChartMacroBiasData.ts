import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchMacroSignalChartSignals,
  fetchMacroSignalGlobalRegistry,
  getPreloadedMacroSignalCurrentModel,
  getPreloadedMacroSignalGlobalRegistry,
  preloadMacroSignalGlobalRegistry,
} from "@/app/lib/bridge";
import {
  getMacroBiasInitialLoadPlan,
  getMacroBiasRequestScope,
  isMacroBiasMarketSupported,
} from "@/app/features/fms-arrow-navigation/chartSignalPresentation";
import type { CalendarEvent, MacroSignalChartSignal, MacroSignalChartSignalResponse, MacroSignalGlobalResponse } from "@/app/types";

interface ChartMacroBiasDataOptions {
  selectedSymbol: string;
  events: CalendarEvent[];
  visible: boolean;
  historicalMatchesVisible: boolean;
  hiddenHistoricalPatterns: Record<string, string[]>;
  historyState: "loading" | "ready" | "no_data" | "error";
  historyFrom?: number;
  historyTo?: number;
  visibleCandleCount: number;
}

export function useChartMacroBiasData({
  selectedSymbol,
  events,
  visible,
  historicalMatchesVisible,
  hiddenHistoricalPatterns,
  historyState,
  historyFrom,
  historyTo,
  visibleCandleCount,
}: ChartMacroBiasDataOptions) {
  const [currentResponse, setCurrentResponse] = useState<MacroSignalChartSignalResponse | null>(getPreloadedMacroSignalCurrentModel);
  const [historicalResponse, setHistoricalResponse] = useState<MacroSignalChartSignalResponse | null>(null);
  const [historicalError, setHistoricalError] = useState<string | null>(null);
  const [globalResponse, setGlobalResponse] = useState<MacroSignalGlobalResponse | null>(getPreloadedMacroSignalGlobalRegistry);
  const [globalLoading, setGlobalLoading] = useState(false);
  const globalRegistryRef = useRef(globalResponse);
  globalRegistryRef.current = globalResponse;
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [monitoringError, setMonitoringError] = useState<string | null>(null);
  const [currentLoading, setCurrentLoading] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);
  const marketCacheRef = useRef(new Map<string, MacroSignalChartSignalResponse>());
  const historyCacheRef = useRef(new Map<string, MacroSignalChartSignalResponse>());
  const calendarRevisionRef = useRef(new Map<string, string>());

  const supported = isMacroBiasMarketSupported(selectedSymbol);
  const currencies = useMemo(() => {
    const symbol = selectedSymbol.toUpperCase();
    return symbol.length === 6 ? new Set([symbol.slice(0, 3), symbol.slice(3)]) : new Set<string>();
  }, [selectedSymbol]);
  const currentCalendarRevision = useMemo(() => {
    if (!supported) return "";
    return events
      .filter((event) => currencies.has(event.currency))
      .sort((left, right) => right.time - left.time || right.id - left.id)
      .slice(0, 64)
      .map((event) => `${event.id}:${event.time}:${event.actual}:${event.forecast}:${event.previous}`)
      .join("|");
  }, [currencies, events, supported]);
  const currentRequestKey = getMacroBiasRequestScope({
    mode: "current",
    symbol: selectedSymbol,
    timeframe: "H4",
    calendarRevision: currentCalendarRevision,
  });

  useEffect(() => {
    if (!supported) {
      setCurrentResponse(null);
      setCurrentLoading(false);
      setCurrentError(null);
      return;
    }
    const globalMarket = getPreloadedMacroSignalGlobalRegistry()?.markets.find(
      (market) => market.symbol === selectedSymbol.toUpperCase(),
    ) ?? null;
    const cachedMarket = marketCacheRef.current.get(selectedSymbol.toUpperCase()) ?? null;
    const reusableResponse = (currentResponse?.supported && currentResponse.symbol === selectedSymbol)
      ? currentResponse
      : cachedMarket ?? globalMarket;
    if (reusableResponse && reusableResponse !== currentResponse) setCurrentResponse(reusableResponse);
    if (!reusableResponse) setCurrentResponse(null);
    setCurrentLoading(false);
    setCurrentError(null);
    setRefreshedAt(reusableResponse?.generatedAt ?? null);
  }, [currentRequestKey, selectedSymbol, supported]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const cached = getPreloadedMacroSignalGlobalRegistry();
    if (cached) setGlobalResponse((current) => current ?? cached);
    setGlobalLoading(!cached);
    setGlobalError(null);
    preloadMacroSignalGlobalRegistry()
      .then((response) => {
        if (cancelled) return;
        response.markets.forEach((market) => {
          const key = market.symbol.toUpperCase();
          const cachedMarket = marketCacheRef.current.get(key);
          if (!cachedMarket || (market.generatedAt ?? 0) >= (cachedMarket.generatedAt ?? 0)) marketCacheRef.current.set(key, market);
        });
        setGlobalResponse((current) => current ? {
          ...response,
          generatedAt: Math.max(response.generatedAt, current.generatedAt),
          markets: response.markets.map((market) => {
            const currentMarket = current.markets.find((candidate) => candidate.symbol === market.symbol);
            const cachedMarket = marketCacheRef.current.get(market.symbol.toUpperCase());
            const newest = cachedMarket && (cachedMarket.generatedAt ?? 0) > (currentMarket?.generatedAt ?? 0) ? cachedMarket : currentMarket;
            return newest && (newest.generatedAt ?? 0) > (market.generatedAt ?? 0) ? newest : market;
          }),
        } : { ...response, markets: response.markets.map((market) => marketCacheRef.current.get(market.symbol.toUpperCase()) ?? market) });
      })
      .catch((error: unknown) => {
        if (!cancelled) setGlobalError(error instanceof Error ? error.message : "Global FMS registry could not be loaded");
      })
      .finally(() => { if (!cancelled) setGlobalLoading(false); });
    return () => { cancelled = true; };
  }, [visible]);

  // Release monitoring remains independent of the selected chart.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let timer: number | undefined;
    let lastSnapshotRead = 0;
    const attempts = new Map<string, number>();
    const monitor = async () => {
      try {
        const now = Math.floor(Date.now() / 1000);
        if (now - lastSnapshotRead >= 60) {
          lastSnapshotRead = now;
          const snapshot = await fetchMacroSignalGlobalRegistry();
          if (cancelled) return;
          setGlobalResponse((current) => ({ ...snapshot, markets: snapshot.markets.map((market) => {
            const previous = current?.markets.find((row) => row.symbol === market.symbol);
            return previous && (previous.generatedAt ?? 0) > (market.generatedAt ?? 0) ? previous : market;
          }) }));
        }
        const due = globalRegistryRef.current?.markets.filter((market) => {
          if (!market.supported || now - (attempts.get(market.symbol) ?? 0) < 60 || now - (market.generatedAt ?? 0) < 30) return false;
          return (market.realtime?.upcomingPatternWatches ?? []).some((watch) => watch.time <= now)
            || [...market.signals, ...(market.recoveredSignals ?? [])].some((signal) => signal.outcomeStatus === "pending")
            || (market.realtime?.latestPatternAssessments ?? []).some((row) => row.status === "awaiting_observation");
        }).sort((a, b) => (attempts.get(a.symbol) ?? 0) - (attempts.get(b.symbol) ?? 0));
        const market = due?.[0];
        if (market) {
          attempts.set(market.symbol, now);
          const fresh = await fetchMacroSignalChartSignals({ symbol: market.symbol, timeframe: "H4", mode: "current", refresh: true });
          if (cancelled) return;
          const cachedMarket = marketCacheRef.current.get(fresh.symbol.toUpperCase());
          if ((fresh.generatedAt ?? 0) >= (cachedMarket?.generatedAt ?? 0)) marketCacheRef.current.set(fresh.symbol.toUpperCase(), fresh);
          setGlobalResponse((current) => current ? {
            ...current,
            markets: current.markets.map((row) => row.symbol === fresh.symbol && (fresh.generatedAt ?? 0) >= (row.generatedAt ?? 0) ? fresh : row),
          } : current);
        }
        if (!cancelled) setMonitoringError(null);
      } catch (error) {
        if (!cancelled) setMonitoringError(`Release monitoring delayed: ${error instanceof Error ? error.message : "Bridge unavailable"}`);
      } finally {
        if (!cancelled) timer = window.setTimeout(monitor, 5_000);
      }
    };
    timer = window.setTimeout(monitor, 5_000);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [visible]);

  useEffect(() => {
    if (!supported) return undefined;
    const market = selectedSymbol.toUpperCase();
    let cancelled = false;
    let retryTimer: number | undefined;
    const refresh = (evaluate = visible) => {
      setCurrentLoading(true);
      return fetchMacroSignalChartSignals({ symbol: selectedSymbol, timeframe: "H4", mode: "current", refresh: evaluate })
        .then((response) => {
          if (response.symbol.toUpperCase() !== market) return;
          const cachedResponse = marketCacheRef.current.get(market);
          if ((cachedResponse?.generatedAt ?? 0) > (response.generatedAt ?? 0)) return;
          marketCacheRef.current.set(response.symbol.toUpperCase(), response);
          if (evaluate) calendarRevisionRef.current.set(market, currentCalendarRevision);
          if (cancelled) return;
          setCurrentResponse(response);
          setGlobalResponse((current) => current ? {
            ...current,
            generatedAt: Math.max(current.generatedAt, response.generatedAt ?? 0),
            markets: current.markets.map((row) => row.symbol === response.symbol && (response.generatedAt ?? 0) >= (row.generatedAt ?? 0) ? response : row),
          } : current);
          setCurrentError(null);
          setRefreshedAt(response.generatedAt ?? Math.floor(Date.now() / 1000));
        })
        .catch((error: unknown) => {
          if (!cancelled) setCurrentError(error instanceof Error ? error.message : "Bridge unavailable");
        })
        .finally(() => {
          if (!cancelled) {
            setCurrentLoading(false);
            if (visible) retryTimer = window.setTimeout(() => void refresh(), evaluate ? 60_000 : 300);
          }
        });
    };
    const cachedMarket = marketCacheRef.current.get(market)
      ?? globalRegistryRef.current?.markets.find((row) => row.symbol.toUpperCase() === market)
      ?? getPreloadedMacroSignalGlobalRegistry()?.markets.find((row) => row.symbol.toUpperCase() === market);
    const sameRevision = calendarRevisionRef.current.get(market) === currentCalendarRevision;
    const plan = getMacroBiasInitialLoadPlan(cachedMarket, visible, sameRevision, Date.now() / 1000);
    if (plan.readLastKnown) void refresh(false);
    else if (plan.refreshDelay != null) retryTimer = window.setTimeout(() => void refresh(), plan.refreshDelay);
    return () => { cancelled = true; window.clearTimeout(retryTimer); };
  }, [currentCalendarRevision, selectedSymbol, supported, visible]);

  useEffect(() => {
    const selectedMarket = globalResponse?.markets.find((market) => market.symbol === selectedSymbol.toUpperCase());
    if (!selectedMarket) return;
    const cachedMarket = marketCacheRef.current.get(selectedSymbol.toUpperCase());
    const newest = cachedMarket && (cachedMarket.generatedAt ?? 0) > (selectedMarket.generatedAt ?? 0) ? cachedMarket : selectedMarket;
    marketCacheRef.current.set(selectedSymbol.toUpperCase(), newest);
    setCurrentResponse(newest);
    setRefreshedAt(newest.generatedAt ?? null);
  }, [globalResponse, selectedSymbol]);

  useEffect(() => {
    if (!supported || !visible || !historicalMatchesVisible || historyState !== "ready" || visibleCandleCount === 0) {
      setHistoricalResponse(null);
      setHistoricalError(null);
      return;
    }
    let cancelled = false;
    const from = Math.max(0, (historyFrom ?? 0) - 7 * 24 * 60 * 60);
    const to = (historyTo ?? Math.floor(Date.now() / 1_000)) + 7 * 24 * 60 * 60;
    const historyCacheKey = `${selectedSymbol.toUpperCase()}:${from}:${to}`;
    const cachedHistory = historyCacheRef.current.get(historyCacheKey);
    if (cachedHistory) {
      setHistoricalError(null);
      setHistoricalResponse(cachedHistory);
      return undefined;
    }
    setHistoricalError(null);
    setHistoricalResponse(null);
    fetchMacroSignalChartSignals({
      symbol: selectedSymbol,
      timeframe: "H4",
      mode: "research_replay",
      from,
      to,
      markersOnly: true,
    }).then((response) => {
      if (cancelled) return;
      historyCacheRef.current.set(historyCacheKey, response);
      setHistoricalResponse(response);
    }).catch((error: unknown) => {
      if (!cancelled) setHistoricalError(error instanceof Error ? error.message : "Historical arrow response unavailable");
    });
    return () => { cancelled = true; };
  }, [historicalMatchesVisible, historyFrom, historyState, historyTo, selectedSymbol, supported, visible, visibleCandleCount]);

  const response = currentResponse?.symbol.toUpperCase() === selectedSymbol.toUpperCase() ? currentResponse : null;
  const historicalSignals = useMemo(() => {
    if (!historicalResponse?.supported || historicalResponse.symbol.toUpperCase() !== selectedSymbol.toUpperCase()) return null;
    const eligiblePatternIds = new Set(historicalResponse.patterns.filter((pattern) => pattern.currentEligible).map((pattern) => pattern.id));
    const hidden = new Set(hiddenHistoricalPatterns[selectedSymbol.toUpperCase()] ?? []);
    return historicalResponse.signals.filter((signal) => eligiblePatternIds.has(signal.patternId) && !hidden.has(signal.patternId));
  }, [hiddenHistoricalPatterns, historicalResponse, selectedSymbol]);
  const historicalPatternFilters = useMemo(() => {
    if (!historicalResponse?.supported || historicalResponse.symbol.toUpperCase() !== selectedSymbol.toUpperCase()) return [];
    const hidden = new Set(hiddenHistoricalPatterns[selectedSymbol.toUpperCase()] ?? []);
    const counts = new Map<string, number>();
    historicalResponse.signals.forEach((signal) => counts.set(signal.patternId, (counts.get(signal.patternId) ?? 0) + 1));
    return historicalResponse.patterns
      .filter((pattern) => pattern.currentEligible)
      .map((pattern) => ({ id: pattern.id, label: pattern.label ?? pattern.id, count: counts.get(pattern.id) ?? 0, checked: !hidden.has(pattern.id) }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [hiddenHistoricalPatterns, historicalResponse, selectedSymbol]);
  const journalSignals = useMemo(() => {
    if (!response?.supported) return [];
    const hidden = new Set(hiddenHistoricalPatterns[selectedSymbol.toUpperCase()] ?? []);
    const combined = new Map<string, MacroSignalChartSignal>();
    response.signals.filter((signal) => !hidden.has(signal.patternId)).forEach((signal) => combined.set(signal.id, signal));
    response.recoveredSignals?.filter((signal) => !hidden.has(signal.patternId)).forEach((signal) => combined.set(signal.id, signal));
    return [...combined.values()].sort((left, right) => left.eventTime - right.eventTime || left.id.localeCompare(right.id));
  }, [hiddenHistoricalPatterns, response, selectedSymbol]);
  const displaySignals = useMemo(() => {
    if (!response?.supported || !historicalMatchesVisible || !historicalSignals) return journalSignals;
    const combined = new Map<string, MacroSignalChartSignal>();
    historicalSignals.forEach((signal) => combined.set(signal.id, signal));
    journalSignals.forEach((signal) => combined.set(signal.id, signal));
    return [...combined.values()].sort((left, right) => left.eventTime - right.eventTime || left.id.localeCompare(right.id));
  }, [historicalMatchesVisible, historicalSignals, journalSignals, response]);

  return {
    currentError,
    currentLoading,
    displaySignals,
    globalError,
    globalLoading,
    globalResponse,
    historicalError,
    historicalPatternFilters,
    historicalResponse,
    historicalSignals,
    journalSignals,
    monitoringError,
    refreshedAt,
    response,
    supported,
  };
}

