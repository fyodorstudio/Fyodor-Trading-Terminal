import type { IChartApi, Time } from "lightweight-charts";
import { getChartEventAnchorTime, isChartEventTimeframeIntraday } from "@/app/lib/chartEvents";
import type { BridgeCandle, CalendarEvent, Timeframe } from "@/app/types";

export interface ChartEventOverlayPoint {
  key: string;
  event: CalendarEvent;
  x: number;
  timeLabel: string;
  isFuture: boolean;
  tooltipPlacement: "left" | "center" | "right";
}

export interface ChartEventOverlayCluster {
  key: string;
  events: Array<{
    event: CalendarEvent;
    timeLabel: string;
    isFuture: boolean;
  }>;
  x: number;
  impact: CalendarEvent["impact"];
  badgeLabel: string;
  detailLabel: string;
  tooltipPlacement: "left" | "center" | "right";
  showBadge: boolean;
}

const CHART_EVENT_TOOLTIP_WIDTH = 300;
const CHART_EVENT_CLUSTER_DISTANCE_PX = 24;

export function getChartEventImpactRank(impact: CalendarEvent["impact"]): number {
  if (impact === "high") return 0;
  if (impact === "medium") return 1;
  return 2;
}

function interpolateChartEventX(
  chart: IChartApi,
  candles: BridgeCandle[],
  targetTime: number,
): number | null {
  const timeScale = chart.timeScale();
  const exactX = timeScale.timeToCoordinate(targetTime as Time);
  if (exactX != null) return exactX;

  const nextIndex = candles.findIndex((candle) => candle.time >= targetTime);
  const previous = nextIndex > 0 ? candles[nextIndex - 1] : null;
  const next = nextIndex >= 0 ? candles[nextIndex] : null;

  if (previous && next && next.time !== previous.time) {
    const previousX = timeScale.timeToCoordinate(previous.time as Time);
    const nextX = timeScale.timeToCoordinate(next.time as Time);
    if (previousX != null && nextX != null) {
      const progress = (targetTime - previous.time) / (next.time - previous.time);
      return previousX + (nextX - previousX) * progress;
    }
  }

  return null;
}

export function resolveChartEventX(
  chart: IChartApi,
  candles: BridgeCandle[],
  timeframe: Timeframe,
  chartTime: number,
): number | null {
  if (!isChartEventTimeframeIntraday(timeframe)) {
    const lastCandle = candles[candles.length - 1];
    if (lastCandle && chartTime > lastCandle.time) {
      return chart.timeScale().timeToCoordinate(chartTime as Time);
    }
    const anchorTime = getChartEventAnchorTime(chartTime, candles, timeframe);
    return anchorTime == null ? null : chart.timeScale().timeToCoordinate(anchorTime as Time);
  }

  return interpolateChartEventX(chart, candles, chartTime);
}

export function getChartEventTooltipPlacement(x: number, containerWidth: number): ChartEventOverlayPoint["tooltipPlacement"] {
  if (x < CHART_EVENT_TOOLTIP_WIDTH / 2) return "right";
  if (x > containerWidth - CHART_EVENT_TOOLTIP_WIDTH / 2) return "left";
  return "center";
}

function getDominantImpact(events: CalendarEvent[]): CalendarEvent["impact"] {
  if (events.some((event) => event.impact === "high")) return "high";
  if (events.some((event) => event.impact === "medium")) return "medium";
  return "low";
}

function getChartEventClusterBadge(events: CalendarEvent[]): string {
  if (events.length === 1) {
    const event = events[0];
    return event.impact === "high" ? `${event.currency} high` : event.currency;
  }

  const currencies = Array.from(new Set(events.map((event) => event.currency)));
  if (currencies.length === 1) return `${currencies[0]} x${events.length}`;
  return `${events.length} events`;
}

function getChartEventClusterDetail(events: CalendarEvent[]): string {
  if (events.length === 1) return events[0]?.title ?? "Loaded event";
  const highCount = events.filter((event) => event.impact === "high").length;
  const currencies = Array.from(new Set(events.map((event) => event.currency))).join(" / ");
  return highCount > 0 ? `${currencies} / ${highCount} high impact` : `${currencies} / ${events.length} loaded events`;
}

export function clusterChartEventPoints(
  points: ChartEventOverlayPoint[],
  containerWidth: number,
): ChartEventOverlayCluster[] {
  const clusters: Array<{ points: ChartEventOverlayPoint[]; x: number }> = [];

  points.forEach((point) => {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(point.x - last.x) <= CHART_EVENT_CLUSTER_DISTANCE_PX) {
      last.points.push(point);
      last.x = last.points.reduce((sum, item) => sum + item.x, 0) / last.points.length;
      return;
    }

    clusters.push({ points: [point], x: point.x });
  });

  return clusters.map((cluster) => {
    const events = cluster.points.map((point) => point.event);
    const impact = getDominantImpact(events);
    const key = cluster.points.map((point) => point.key).join("|");
    const hasFuture = cluster.points.some((point) => point.isFuture);
    return {
      key,
      events: cluster.points.map((point) => ({
        event: point.event,
        timeLabel: point.timeLabel,
        isFuture: point.isFuture,
      })),
      x: cluster.x,
      impact,
      badgeLabel: getChartEventClusterBadge(events),
      detailLabel: hasFuture ? `Scheduled: ${getChartEventClusterDetail(events)}` : getChartEventClusterDetail(events),
      tooltipPlacement: getChartEventTooltipPlacement(cluster.x, containerWidth),
      showBadge: false,
    };
  });
}
