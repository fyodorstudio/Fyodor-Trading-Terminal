import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { ChartSettingsDrawer, type ChartDrawerMode } from "@/app/components/ChartSettingsDrawer";
import { ChartStatusRail } from "@/app/components/ChartStatusRail";
import { ChartSymbolPicker } from "@/app/components/ChartSymbolPicker";
import { ChartToolStrip } from "@/app/components/ChartToolStrip";
import { ChartViewport, type ChartCrosshairReadout } from "@/app/components/ChartViewport";
import { useChartEventOverlay } from "@/app/hooks/useChartEventOverlay";
import { useChartMarketData } from "@/app/hooks/useChartMarketData";
import {
  getChartConnectionLabel,
  getChartPriceFormat,
  getCrosshairMode,
} from "@/app/lib/chartDisplay";
import {
  DEFAULT_CHART_PREFERENCES,
  formatChartFeedTime,
  formatCursorReadout,
  getChartDisplayCandles,
  getChartDisplayModeLabel,
  getChartGridColor,
  getChartLayoutOptions,
  getChartSeriesAppearanceOptions,
  getChartSourceTimeOffsetSeconds,
  getChartTimeFormatters,
  getChartSessionDetail,
  loadChartPreferences,
  loadChartDisplayTimeMode,
  saveChartPreferences,
  saveChartDisplayTimeMode,
  type ChartAppearancePreferences,
  type ChartCursorReadoutMode,
  type ChartDisplayTimeMode,
  type ChartEventOverlayPreferences,
  type ChartPreferences,
} from "@/app/lib/chartView";
import {
  formatCurrentTimeForDisplayTimezone,
  getDisplayTimezoneOptions,
  getDisplayTimezoneShortLabel,
} from "@/app/lib/timezoneDisplay";
import type { CalendarEvent, MarketStatusResponse, Timeframe } from "@/app/types";

const DEBUG_MAX = 60;

interface ChartsTabProps {
  marketStatus: MarketStatusResponse | null;
  selectedSymbol: string;
  onSelectedSymbolChange: (symbol: string) => void;
  events: CalendarEvent[];
  onOpenCalendarEvent: (event: CalendarEvent) => void;
}

export function ChartsTab({
  marketStatus,
  selectedSymbol,
  onSelectedSymbolChange,
  events,
  onOpenCalendarEvent,
}: ChartsTabProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("H1");
  const [displayTimeMode, setDisplayTimeMode] = useState<ChartDisplayTimeMode>(() => loadChartDisplayTimeMode());
  const [chartPreferences, setChartPreferences] = useState<ChartPreferences>(() => loadChartPreferences());
  const [timezoneMenuOpen, setTimezoneMenuOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [chartDrawerMode, setChartDrawerMode] = useState<ChartDrawerMode>("appearance");
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [sessionNowMs, setSessionNowMs] = useState(() => Date.now());
  const [crosshairReadout, setCrosshairReadout] = useState<ChartCrosshairReadout | null>(null);
  const [chartRangeRevision, setChartRangeRevision] = useState(0);
  const [chartLayoutRevision, setChartLayoutRevision] = useState(0);
  const [hoveredChartEventClusterKey, setHoveredChartEventClusterKey] = useState<string | null>(null);
  const [activeChartEventClusterKey, setActiveChartEventClusterKey] = useState<string | null>(null);
  const timezoneMenuRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const shouldRefocusRef = useRef(true);

  const addLog = useCallback((line: string) => {
    setDebugLines((current) => {
      const next = [...current, `[${new Date().toISOString()}] ${line}`];
      return next.slice(-DEBUG_MAX);
    });
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setSessionNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!timezoneMenuRef.current?.contains(target)) setTimezoneMenuOpen(false);
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const activeMarketStatus =
    marketStatus && marketStatus.symbol.toUpperCase() === selectedSymbol.toUpperCase() ? marketStatus : null;
  const chartSourceTimeOffsetSeconds = getChartSourceTimeOffsetSeconds(activeMarketStatus);

  const {
    symbols,
    historyState,
    visibleCandles,
    lastCandleTime,
    streamConnected,
    boundaryTime,
    chartLoadError,
    cacheSummary,
    status,
    reachedBoundary,
    clearCurrentCache,
  } = useChartMarketData({
    selectedSymbol,
    onSelectedSymbolChange,
    timeframe,
    activeMarketStatus,
    chartRef,
    addLog,
  });

  const priceFormat = useMemo(
    () => getChartPriceFormat(selectedSymbol, activeMarketStatus?.asset_class ?? null),
    [selectedSymbol, activeMarketStatus?.asset_class],
  );

  const displayCandles = useMemo(
    () => getChartDisplayCandles(visibleCandles),
    [visibleCandles],
  );

  const refocusChart = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || visibleCandles.length === 0) return;

    const lastIndex = visibleCandles.length - 1;
    const windowBars = Math.min(Math.max(visibleCandles.length, 60), 120);
    const halfWindow = windowBars / 2;

    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(-0.5, lastIndex - halfWindow),
      to: lastIndex + halfWindow,
    });

    series.priceScale().setAutoScale(true);
    window.requestAnimationFrame(() => {
      const latestClose = visibleCandles[lastIndex]?.close;
      const autoRange = series.priceScale().getVisibleRange();
      if (latestClose == null || !autoRange) return;
      const span = Math.max(autoRange.to - autoRange.from, Math.abs(latestClose) * 0.01, 1e-6);
      series.priceScale().setAutoScale(false);
      series.priceScale().setVisibleRange({
        from: latestClose - span / 2,
        to: latestClose + span / 2,
      });
    });
  }, [visibleCandles]);

  const handleDisplayTimeModeChange = useCallback((next: ChartDisplayTimeMode) => {
    setDisplayTimeMode(next);
    saveChartDisplayTimeMode(next);
    setTimezoneMenuOpen(false);
  }, []);

  const updateChartPreferences = useCallback((updater: (current: ChartPreferences) => ChartPreferences) => {
    setChartPreferences((current) => {
      const next = updater(current);
      saveChartPreferences(next);
      return next;
    });
  }, []);

  const updateAppearance = useCallback(
    <K extends keyof ChartAppearancePreferences,>(key: K, value: ChartAppearancePreferences[K]) => {
      updateChartPreferences((current) => ({
        ...current,
        appearance: {
          ...current.appearance,
          [key]: value,
        },
      }));
    },
    [updateChartPreferences],
  );

  const handleCursorModeChange = useCallback(
    (mode: ChartCursorReadoutMode) => {
      updateChartPreferences((current) => ({ ...current, cursorReadoutMode: mode }));
    },
    [updateChartPreferences],
  );

  const updateEventOverlay = useCallback(
    <K extends keyof ChartEventOverlayPreferences,>(key: K, value: ChartEventOverlayPreferences[K]) => {
      updateChartPreferences((current) => ({
        ...current,
        eventOverlay: {
          ...current.eventOverlay,
          [key]: value,
        },
      }));
    },
    [updateChartPreferences],
  );

  const openChartDrawer = useCallback((mode: ChartDrawerMode) => {
    setChartDrawerMode(mode);
    setHistoryPanelOpen(true);
  }, []);

  const resetChartPreferences = useCallback(() => {
    setChartPreferences(DEFAULT_CHART_PREFERENCES);
    saveChartPreferences(DEFAULT_CHART_PREFERENCES);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || chartRef.current) return;
    const timeFormatters = getChartTimeFormatters(timeframe, displayTimeMode, chartSourceTimeOffsetSeconds);
    const appearance = chartPreferences.appearance;
    const gridColor = getChartGridColor(appearance);

    const chart = createChart(container, {
      layout: getChartLayoutOptions(appearance),
      rightPriceScale: { 
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.2 }
      },
      timeScale: {
        borderVisible: false,
        rightOffset: 5,
        barSpacing: 10,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: timeFormatters.tickMarkFormatter,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        mode: getCrosshairMode(chartPreferences.cursorReadoutMode),
        vertLine: { labelBackgroundColor: appearance.crosshairColor },
        horzLine: { labelBackgroundColor: appearance.crosshairColor, labelVisible: false },
      },
      localization: {
        timeFormatter: timeFormatters.timeFormatter,
      },
    });

    const series = chart.addSeries(CandlestickSeries, getChartSeriesAppearanceOptions(appearance));

    chartRef.current = chart;
    seriesRef.current = series;

    const applySize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        chart.applyOptions({ width: rect.width, height: rect.height });
        setChartLayoutRevision((current) => current + 1);
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
    const chart = chartRef.current;
    if (!chart) return;
    const timeFormatters = getChartTimeFormatters(timeframe, displayTimeMode, chartSourceTimeOffsetSeconds);
    chart.applyOptions({
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: timeFormatters.tickMarkFormatter,
      },
      localization: {
        timeFormatter: timeFormatters.timeFormatter,
      },
    });
  }, [timeframe, displayTimeMode, chartSourceTimeOffsetSeconds]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const appearance = chartPreferences.appearance;
    const gridColor = getChartGridColor(appearance);

    chart.applyOptions({
      layout: getChartLayoutOptions(appearance),
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        mode: getCrosshairMode(chartPreferences.cursorReadoutMode),
        vertLine: { labelBackgroundColor: appearance.crosshairColor },
        horzLine: { labelBackgroundColor: appearance.crosshairColor, labelVisible: false },
      },
    });

    series.applyOptions(getChartSeriesAppearanceOptions(appearance));
  }, [chartPreferences]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    series.setData(displayCandles);
  }, [displayCandles]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const container = containerRef.current;
    if (!chart || !series || !container) return;

    const handleCrosshairMove = (param: MouseEventParams<Time>) => {
      const point = param.point;
      if (!point || point.x < 0 || point.y < 0 || point.x > container.clientWidth || point.y > container.clientHeight) {
        setCrosshairReadout(null);
        return;
      }

      const truePrice = series.coordinateToPrice(point.y);
      const candle = param.seriesData?.get(series) as CandlestickData<Time> | undefined;
      const candlePrice = candle && typeof candle.close === "number" ? candle.close : null;
      const lines = formatCursorReadout({
        mode: chartPreferences.cursorReadoutMode,
        truePrice,
        candlePrice,
        precision: priceFormat.precision,
      });

      if (lines.length === 0) {
        setCrosshairReadout(null);
        return;
      }

      const readoutTop =
        chartPreferences.cursorReadoutMode === "nearest_candle" && candlePrice != null
          ? series.priceToCoordinate(candlePrice) ?? point.y
          : point.y;
      const clampedReadoutTop = Math.min(Math.max(readoutTop, 32), container.clientHeight - 32);

      setCrosshairReadout({
        lines,
        top: clampedReadoutTop,
      });
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);
    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      setCrosshairReadout(null);
    };
  }, [chartPreferences.cursorReadoutMode, priceFormat.precision]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    series.applyOptions({
      priceFormat,
    });
    shouldRefocusRef.current = true;
  }, [priceFormat, selectedSymbol, timeframe]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const onRangeChange = () => {
      setChartRangeRevision((current) => current + 1);
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);
    return () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
  }, []);

  useEffect(() => {
    if (historyState !== "ready" || displayCandles.length === 0 || !shouldRefocusRef.current) return;
    const id = window.setTimeout(() => {
      refocusChart();
      shouldRefocusRef.current = false;
    }, 0);
    return () => window.clearTimeout(id);
  }, [historyState, displayCandles, refocusChart]);

  const sessionDetail = useMemo(
    () => getChartSessionDetail(activeMarketStatus, sessionNowMs),
    [activeMarketStatus, sessionNowMs],
  );

  const timezoneOptions = useMemo(() => getDisplayTimezoneOptions(new Date(sessionNowMs)), [sessionNowMs]);
  const displayModeLabel = getChartDisplayModeLabel(displayTimeMode);
  const displayModeShortLabel = getDisplayTimezoneShortLabel(displayTimeMode, new Date(sessionNowMs));
  const currentDisplayTime = formatCurrentTimeForDisplayTimezone({
    nowMs: sessionNowMs,
    selection: displayTimeMode,
    serverTimeSeconds: activeMarketStatus?.server_time ?? lastCandleTime,
    serverFetchedAtMs: activeMarketStatus?.checked_at != null ? activeMarketStatus.checked_at * 1000 : null,
  });

  const feedLabel = lastCandleTime
    ? `Latest candle: ${formatChartFeedTime(lastCandleTime, displayTimeMode, chartSourceTimeOffsetSeconds)}`
    : "Waiting for data";
  const cacheOldestLabel = cacheSummary.oldestTime
    ? formatChartFeedTime(cacheSummary.oldestTime, displayTimeMode, chartSourceTimeOffsetSeconds)
    : "Empty";
  const cacheLatestLabel = cacheSummary.latestTime
    ? formatChartFeedTime(cacheSummary.latestTime, displayTimeMode, chartSourceTimeOffsetSeconds)
    : "Empty";
  const streamStatusLabel =
    getChartConnectionLabel({ historyState, marketStatus: activeMarketStatus, streamConnected });

  const chartEventOverlay = useChartEventOverlay({
    chartRef,
    containerRef,
    events,
    selectedSymbol,
    visibleCandles,
    timeframe,
    displayTimeMode,
    sourceTimeOffsetSeconds: chartSourceTimeOffsetSeconds,
    preferences: chartPreferences.eventOverlay,
    chartRangeRevision,
    chartLayoutRevision,
  });

  useEffect(() => {
    setActiveChartEventClusterKey(null);
    setHoveredChartEventClusterKey(null);
  }, [selectedSymbol, timeframe, chartPreferences.eventOverlay.scope, chartPreferences.eventOverlay.visible]);

  const overlayCopy =
    status === "no_data"
      ? {
          title: "No Chart Data",
          description:
            chartLoadError ??
            `No candle history is available right now for ${selectedSymbol} ${timeframe}. Verify the symbol, timeframe, and MT5 history availability.`,
        }
      : {
          title: "Bridge Or MT5 Unavailable",
          description:
            chartLoadError ??
            `The app could not refresh chart data for ${selectedSymbol}. Keep the local bridge and MetaTrader 5 running, then retry.`,
        };

  return (
    <div className="workspace-page workspace-page-compact charts-tab-page flex h-[calc(100vh-98px)] min-h-[560px] flex-col overflow-hidden">
      <div className="chart-workbar">
        <ChartSymbolPicker
          selectedSymbol={selectedSymbol}
          symbols={symbols}
          timeframe={timeframe}
          onSelectedSymbolChange={onSelectedSymbolChange}
          onTimeframeChange={setTimeframe}
        />

        <ChartToolStrip
          cursorReadoutMode={chartPreferences.cursorReadoutMode}
          eventOverlayVisible={chartPreferences.eventOverlay.visible}
          eventCandidateCount={chartEventOverlay.candidatesCount}
          onCursorModeChange={handleCursorModeChange}
          onRefocusChart={refocusChart}
          onOpenDrawer={openChartDrawer}
        />
      </div>

      <ChartStatusRail
        status={status}
        streamStatusLabel={streamStatusLabel}
        sessionLabel={sessionDetail.label}
        sessionBasis={sessionDetail.basis}
        lastCandleTime={lastCandleTime}
        feedLabel={feedLabel}
        currentDisplayTime={currentDisplayTime}
        displayModeLabel={displayModeLabel}
        displayModeShortLabel={displayModeShortLabel}
        displayTimeMode={displayTimeMode}
        timezoneOptions={timezoneOptions}
        timezoneMenuOpen={timezoneMenuOpen}
        timezoneMenuRef={timezoneMenuRef}
        onToggleTimezoneMenu={() => setTimezoneMenuOpen((current) => !current)}
        onDisplayTimeModeChange={handleDisplayTimeModeChange}
      />

      <ChartSettingsDrawer
        open={historyPanelOpen}
        mode={chartDrawerMode}
        onModeChange={setChartDrawerMode}
        onClose={() => setHistoryPanelOpen(false)}
        preferences={chartPreferences}
        onCursorModeChange={handleCursorModeChange}
        onAppearanceChange={updateAppearance}
        onEventOverlayChange={updateEventOverlay}
        onResetAppearance={resetChartPreferences}
        cacheData={{
          selectedSymbol,
          timeframe,
          candleCount: cacheSummary.count,
          oldestLabel: cacheOldestLabel,
          latestLabel: cacheLatestLabel,
          historyState,
          streamLabel: streamConnected ? "connected" : "not streaming",
          boundaryLabel: boundaryTime
            ? formatChartFeedTime(boundaryTime, displayTimeMode, chartSourceTimeOffsetSeconds)
            : "unconfirmed",
          onClearCache: clearCurrentCache,
        }}
      />

      <ChartViewport
        containerRef={containerRef}
        clusters={chartEventOverlay.clusters}
        eventOverlay={chartEventOverlay.overlayData}
        hoveredClusterKey={hoveredChartEventClusterKey}
        activeClusterKey={activeChartEventClusterKey}
        onHoverCluster={setHoveredChartEventClusterKey}
        onToggleCluster={(key) => setActiveChartEventClusterKey((current) => (current === key ? null : key))}
        onOpenCalendarEvent={onOpenCalendarEvent}
        crosshairReadout={crosshairReadout}
        status={status}
        overlayCopy={overlayCopy}
        reachedBoundary={reachedBoundary}
        consoleOpen={consoleOpen}
        debugLines={debugLines}
        onToggleConsole={() => setConsoleOpen((current) => !current)}
      />
    </div>
  );
}
