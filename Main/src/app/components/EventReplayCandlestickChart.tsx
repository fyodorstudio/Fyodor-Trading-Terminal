import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { getCrosshairMode } from "@/app/lib/chartDisplay";
import {
  getChartGridColor,
  getChartLayoutOptions,
  getChartSeriesAppearanceOptions,
  type ChartAppearancePreferences,
  type ChartCursorReadoutMode,
} from "@/app/lib/chartView";
import { formatReplayAxisTime } from "@/app/lib/eventReplayView";
import type { BridgeCandle, FxPairDefinition, ReplayChartTimeframe } from "@/app/types";

interface EventReplayCandlestickChartProps {
  candles: BridgeCandle[];
  eventIndex: number;
  visibleCount: number;
  pair: FxPairDefinition;
  timeframe: ReplayChartTimeframe;
  appearance: ChartAppearancePreferences;
  cursorReadoutMode: ChartCursorReadoutMode;
}

function toChartTime(time: number): UTCTimestamp {
  return time as UTCTimestamp;
}

function toChartCandles(candles: BridgeCandle[]): CandlestickData<Time>[] {
  return candles.map((candle) => ({
    time: toChartTime(candle.time),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
}

export function EventReplayCandlestickChart(props: EventReplayCandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || chartRef.current) return;
    const gridColor = getChartGridColor(props.appearance);

    const chart = createChart(container, {
      layout: getChartLayoutOptions(props.appearance, "Geist, Inter, system-ui, sans-serif"),
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderVisible: false,
        rightOffset: 4,
        barSpacing: 14,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: Time) => formatReplayAxisTime(Number(time), props.timeframe),
      },
      crosshair: {
        mode: getCrosshairMode(props.cursorReadoutMode),
        vertLine: { labelBackgroundColor: props.appearance.crosshairColor },
        horzLine: { labelBackgroundColor: props.appearance.crosshairColor },
      },
      localization: {
        timeFormatter: (time: Time) => formatReplayAxisTime(Number(time), props.timeframe),
      },
    });

    const series = chart.addSeries(CandlestickSeries, getChartSeriesAppearanceOptions(props.appearance));

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
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;
    const gridColor = getChartGridColor(props.appearance);

    chart.applyOptions({
      layout: getChartLayoutOptions(props.appearance, "Geist, Inter, system-ui, sans-serif"),
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        mode: getCrosshairMode(props.cursorReadoutMode),
        vertLine: { labelBackgroundColor: props.appearance.crosshairColor },
        horzLine: { labelBackgroundColor: props.appearance.crosshairColor },
      },
    });

    series.applyOptions(getChartSeriesAppearanceOptions(props.appearance));
  }, [props.appearance, props.cursorReadoutMode]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const isJpy = props.pair.quote === "JPY";
    series.applyOptions({
      priceFormat: isJpy
        ? { type: "price", precision: 3, minMove: 0.001 }
        : { type: "price", precision: 5, minMove: 0.00001 },
    });
  }, [props.pair]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.applyOptions({
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: Time) => formatReplayAxisTime(Number(time), props.timeframe),
      },
      localization: {
        timeFormatter: (time: Time) => formatReplayAxisTime(Number(time), props.timeframe),
      },
    });
  }, [props.timeframe]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    const visible = props.candles.slice(0, props.visibleCount);
    series.setData(toChartCandles(visible));

    if (visible.length > 0 && props.visibleCount > props.eventIndex) {
      const markerTime = props.candles[props.eventIndex]?.time;
      if (markerTime != null) {
        createSeriesMarkers(series, [
          {
            time: toChartTime(markerTime),
            position: "aboveBar",
            color: "#2563eb",
            shape: "arrowDown",
            text: "Release",
          },
        ]);
      }
    } else {
      createSeriesMarkers(series, []);
    }

    chart.timeScale().fitContent();
  }, [props.candles, props.eventIndex, props.visibleCount]);

  return (
    <div className="border border-slate-200 p-2" style={{ backgroundColor: props.appearance.backgroundColor }}>
      <div ref={containerRef} className="h-[clamp(520px,62vh,760px)] w-full" />
    </div>
  );
}
