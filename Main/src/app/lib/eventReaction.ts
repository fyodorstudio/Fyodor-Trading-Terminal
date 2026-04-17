import { FX_PAIRS } from "@/app/config/fxPairs";
import { classifyEventQualityFamily } from "@/app/lib/eventQuality";
import { parseNumericValue } from "@/app/lib/format";
import type {
  BridgeCandle,
  CalendarEvent,
  EventQualityFamily,
  EventTemplate,
  FxPairDefinition,
  ReactionReplaySample,
  ReactionBucket,
  ReactionBucketStats,
  ReactionSample,
  ReactionStats,
  ReactionStudyRow,
  ReactionStudySummary,
  ReactionWindow,
  ReplayChartTimeframe,
  SampleQuality,
} from "@/app/types";

interface ReactionEvent {
  key: string;
  currency: string;
  title: string;
  family: EventQualityFamily;
  familyLabel: string;
  time: number;
  actual: number;
  forecast: number;
  surprise: number;
}

export function buildEventTemplateKey(currency: string, title: string): string {
  return `${currency.toUpperCase()}|${title}`;
}

export interface UpcomingReactionEvent {
  id: string;
  currency: string;
  title: string;
  family: EventQualityFamily;
  familyLabel: string;
  time: number;
  templateKey: string | null;
  sampleCount: number;
  quality: SampleQuality | null;
}

export const REACTION_WINDOWS: Array<{
  id: ReactionWindow;
  label: string;
  seconds: number;
  timeframe: "M1" | "M15" | "H1";
}> = [
  { id: "15m", label: "15m", seconds: 15 * 60, timeframe: "M1" },
  { id: "1h", label: "1h", seconds: 60 * 60, timeframe: "M1" },
  { id: "4h", label: "4h", seconds: 4 * 60 * 60, timeframe: "M15" },
  { id: "1d", label: "1d", seconds: 24 * 60 * 60, timeframe: "H1" },
];

const BASE_BUCKETS: ReactionBucket[] = ["beat", "inline", "miss"];
const MAGNITUDE_BUCKETS: ReactionBucket[] = ["small_beat", "large_beat", "small_miss", "large_miss"];

const BUCKET_LABELS: Record<ReactionBucket, string> = {
  beat: "Beat",
  inline: "Inline",
  miss: "Miss",
  small_beat: "Small Beat",
  large_beat: "Large Beat",
  small_miss: "Small Miss",
  large_miss: "Large Miss",
};

function getSampleQuality(count: number): SampleQuality {
  if (count >= 15) return "usable";
  if (count >= 8) return "limited";
  return "weak";
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function standardDeviation(values: number[]): number | null {
  if (values.length === 0) return null;
  const avg = average(values);
  if (avg == null) return null;
  const variance = average(values.map((value) => (value - avg) ** 2));
  return variance == null ? null : Math.sqrt(variance);
}

export function getPipSize(pair: FxPairDefinition): number {
  return pair.quote === "JPY" ? 0.01 : 0.0001;
}

export function priceDeltaToPips(delta: number, pair: FxPairDefinition): number {
  return delta / getPipSize(pair);
}

function toStats(percentValues: number[], pipValues: number[]): ReactionStats {
  const absolutePercent = percentValues.map((value) => Math.abs(value));
  const absolutePips = pipValues.map((value) => Math.abs(value));
  return {
    sampleSize: percentValues.length,
    averageReturn: percentValues.length > 0 ? Number(average(percentValues)!.toFixed(4)) : null,
    medianReturn: percentValues.length > 0 ? Number(median(percentValues)!.toFixed(4)) : null,
    medianAbsoluteReturn: absolutePercent.length > 0 ? Number(median(absolutePercent)!.toFixed(4)) : null,
    standardDeviation: percentValues.length > 0 ? Number(standardDeviation(percentValues)!.toFixed(4)) : null,
    averagePips: pipValues.length > 0 ? Number(average(pipValues)!.toFixed(1)) : null,
    medianPips: pipValues.length > 0 ? Number(median(pipValues)!.toFixed(1)) : null,
    medianAbsolutePips: absolutePips.length > 0 ? Number(median(absolutePips)!.toFixed(1)) : null,
    standardDeviationPips: pipValues.length > 0 ? Number(standardDeviation(pipValues)!.toFixed(1)) : null,
  };
}

function emptyWindowStats(): Record<ReactionWindow, ReactionStats> {
  return {
    "15m": toStats([], []),
    "1h": toStats([], []),
    "4h": toStats([], []),
    "1d": toStats([], []),
  };
}

function buildBucketStats(samples: ReactionSample[]): ReactionBucketStats[] {
  const presentBuckets = new Set<ReactionBucket>();
  samples.forEach((sample) => presentBuckets.add(sample.bucket));
  const allBuckets = [...BASE_BUCKETS, ...MAGNITUDE_BUCKETS.filter((bucket) => presentBuckets.has(bucket))];

  return allBuckets
    .filter((bucket) => presentBuckets.has(bucket))
    .map((bucket) => {
      const bucketSamples = samples.filter((sample) => sample.bucket === bucket);
      const windows = emptyWindowStats();

      REACTION_WINDOWS.forEach((window) => {
        const percentValues = bucketSamples
          .map((sample) => sample.windows[window.id]?.percent ?? null)
          .filter((value): value is number => value != null);
        const pipValues = bucketSamples
          .map((sample) => sample.windows[window.id]?.pips ?? null)
          .filter((value): value is number => value != null);
        windows[window.id] = toStats(percentValues, pipValues);
      });

      return {
        bucket,
        label: BUCKET_LABELS[bucket],
        windows,
      };
    });
}

function monthKey(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getMonthlyChunkKeys(eventTimes: number[]): string[] {
  return [...new Set(eventTimes.map(monthKey))].sort();
}

export function getMonthlyChunkRange(
  key: string,
  timeframe: "M1" | "M15" | "H1" | "H4" | "D1",
): { from: number; to: number } {
  const [yearText, monthText] = key.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const bufferMap: Record<typeof timeframe, number> = {
    M1: 24 * 60 * 60,
    M15: 24 * 60 * 60,
    H1: 2 * 24 * 60 * 60,
    H4: 7 * 24 * 60 * 60,
    D1: 21 * 24 * 60 * 60,
  };
  const bufferBefore = bufferMap[timeframe];
  const bufferAfter = bufferMap[timeframe];

  const start = Math.floor(Date.UTC(year, monthIndex, 1, 0, 0, 0) / 1000) - bufferBefore;
  const nextMonthStart = Math.floor(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0) / 1000);
  const end = nextMonthStart + bufferAfter;

  return { from: start, to: end };
}

function normalizeReactionEvents(events: CalendarEvent[], nowSeconds: number): ReactionEvent[] {
  return events
    .filter((event) => event.time < nowSeconds)
    .map((event) => {
      const family = classifyEventQualityFamily(event.title);
      if (!family) return null;
      const actual = parseNumericValue(event.actual);
      const forecast = parseNumericValue(event.forecast);
      if (actual == null || forecast == null) return null;
      return {
        key: buildEventTemplateKey(event.currency, event.title),
        currency: event.currency,
        title: event.title,
        family: family.family,
        familyLabel: family.label,
        time: event.time,
        actual,
        forecast,
        surprise: Number((actual - forecast).toFixed(4)),
      } satisfies ReactionEvent;
    })
    .filter((item): item is ReactionEvent => item !== null);
}

export function discoverEventTemplates(params: {
  events: CalendarEvent[];
  nowSeconds?: number;
  family?: EventQualityFamily | "all";
  minSamples?: number;
  includeWeak?: boolean;
}): EventTemplate[] {
  const nowSeconds = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const normalized = normalizeReactionEvents(params.events, nowSeconds);
  const groups = new Map<string, ReactionEvent[]>();

  normalized.forEach((event) => {
    if (params.family && params.family !== "all" && event.family !== params.family) return;
    const list = groups.get(event.key) ?? [];
    list.push(event);
    groups.set(event.key, list);
  });

  return [...groups.entries()]
    .map<EventTemplate>(([key, items]) => ({
      key,
      currency: items[0].currency,
      title: items[0].title,
      family: items[0].family,
      familyLabel: items[0].familyLabel,
      sampleCount: items.length,
      usableSampleCount: items.length,
      quality: getSampleQuality(items.length),
    }))
    .filter((template) => {
      if (params.includeWeak) return true;
      return template.sampleCount >= (params.minSamples ?? 5);
    })
    .sort((left, right) => {
      if (right.sampleCount !== left.sampleCount) return right.sampleCount - left.sampleCount;
      if (left.currency !== right.currency) return left.currency.localeCompare(right.currency);
      return left.title.localeCompare(right.title);
    });
}

export function getTemplateEvents(params: {
  events: CalendarEvent[];
  templateKey: string;
  nowSeconds?: number;
}): ReactionEvent[] {
  const nowSeconds = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  return normalizeReactionEvents(params.events, nowSeconds).filter((event) => event.key === params.templateKey);
}

export function getPairTemplateMap(params: {
  events: CalendarEvent[];
  pair: FxPairDefinition;
  family?: EventQualityFamily | "all";
  includeWeak?: boolean;
  nowSeconds?: number;
}): Map<string, { template: EventTemplate; events: ReactionEvent[] }> {
  const nowSeconds = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const normalized = normalizeReactionEvents(params.events, nowSeconds).filter(
    (event) => event.currency === params.pair.base || event.currency === params.pair.quote,
  );

  const groups = new Map<string, ReactionEvent[]>();
  normalized.forEach((event) => {
    if (params.family && params.family !== "all" && event.family !== params.family) return;
    const list = groups.get(event.key) ?? [];
    list.push(event);
    groups.set(event.key, list);
  });

  const result = new Map<string, { template: EventTemplate; events: ReactionEvent[] }>();
  groups.forEach((items, key) => {
    const template: EventTemplate = {
      key,
      currency: items[0].currency,
      title: items[0].title,
      family: items[0].family,
      familyLabel: items[0].familyLabel,
      sampleCount: items.length,
      usableSampleCount: items.length,
      quality: getSampleQuality(items.length),
    };
    if (!params.includeWeak && template.sampleCount < 5) return;
    result.set(key, { template, events: items });
  });

  return result;
}

export function getUpcomingReactionEvents(params: {
  events: CalendarEvent[];
  templates: EventTemplate[];
  nowSeconds?: number;
  horizonDays?: number;
}): UpcomingReactionEvent[] {
  const nowSeconds = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const endsAt = nowSeconds + (params.horizonDays ?? 7) * 24 * 60 * 60;
  const templateMap = new Map(params.templates.map((template) => [template.key, template]));

  return params.events
    .filter((event) => event.time >= nowSeconds && event.time <= endsAt)
    .map((event) => {
      const family = classifyEventQualityFamily(event.title);
      if (!family) return null;
      const template = templateMap.get(buildEventTemplateKey(event.currency, event.title)) ?? null;

      return {
        id: `${event.id}-${event.time}`,
        currency: event.currency,
        title: event.title,
        family: family.family,
        familyLabel: family.label,
        time: event.time,
        templateKey: template?.key ?? null,
        sampleCount: template?.sampleCount ?? 0,
        quality: template?.quality ?? null,
      } satisfies UpcomingReactionEvent;
    })
    .filter((item): item is UpcomingReactionEvent => item !== null)
    .sort((left, right) => left.time - right.time);
}

function pickBaselineClose(candles: BridgeCandle[], eventTime: number): number | null {
  let candidate: BridgeCandle | null = null;
  for (const candle of candles) {
    if (candle.time > eventTime) break;
    candidate = candle;
  }
  return candidate?.close ?? null;
}

function pickTargetClose(candles: BridgeCandle[], targetTime: number): number | null {
  let candidate: BridgeCandle | null = null;
  for (const candle of candles) {
    if (candle.time > targetTime) break;
    candidate = candle;
  }
  return candidate?.close ?? null;
}

function assignMagnitudeBuckets(events: ReactionEvent[]): Map<string, ReactionBucket> {
  const nonInline = events.filter((event) => event.surprise !== 0);
  if (nonInline.length < 12) return new Map();

  const medianAbs = median(nonInline.map((event) => Math.abs(event.surprise)));
  if (medianAbs == null) return new Map();

  const result = new Map<string, ReactionBucket>();
  nonInline.forEach((event) => {
    const abs = Math.abs(event.surprise);
    if (event.surprise > 0) {
      result.set(`${event.key}-${event.time}`, abs <= medianAbs ? "small_beat" : "large_beat");
    } else {
      result.set(`${event.key}-${event.time}`, abs <= medianAbs ? "small_miss" : "large_miss");
    }
  });
  return result;
}

function deriveSamplesForEntity(params: {
  pair: FxPairDefinition;
  events: ReactionEvent[];
  candlesByWindow: Record<ReactionWindow, BridgeCandle[]>;
}): ReactionSample[] {
  const magnitudeBuckets = assignMagnitudeBuckets(params.events);

  return params.events.map((event) => {
    const eventKey = `${event.key}-${event.time}`;
    const bucket: ReactionBucket = event.surprise > 0 ? "beat" : event.surprise < 0 ? "miss" : "inline";
    const finalBucket = magnitudeBuckets.get(eventKey) ?? bucket;
    const windows: Partial<ReactionSample["windows"]> = {};

    REACTION_WINDOWS.forEach((window) => {
      const candles = params.candlesByWindow[window.id];
      const baseline = pickBaselineClose(candles, event.time);
      const target = pickTargetClose(candles, event.time + window.seconds);
      if (baseline == null || target == null || baseline === 0) return;

      const percent = Number((((target - baseline) / baseline) * 100).toFixed(4));
      const pips = Number(priceDeltaToPips(target - baseline, params.pair).toFixed(1));

      windows[window.id] = { percent, pips };
    });

    return {
      eventId: eventKey,
      eventTime: event.time,
      actual: event.actual,
      forecast: event.forecast,
      surprise: event.surprise,
      bucket: finalBucket,
      windows,
    };
  });
}

function buildSummaryWindows(samples: ReactionSample[]): Record<ReactionWindow, ReactionStats> {
  const summary = emptyWindowStats();
  REACTION_WINDOWS.forEach((window) => {
    const percentValues = samples
      .map((sample) => sample.windows[window.id]?.percent ?? null)
      .filter((value): value is number => value != null);
    const pipValues = samples
      .map((sample) => sample.windows[window.id]?.pips ?? null)
      .filter((value): value is number => value != null);
    summary[window.id] = toStats(percentValues, pipValues);
  });
  return summary;
}

function buildReactionRow(params: {
  key: string;
  label: string;
  currency: string;
  pair: FxPairDefinition;
  family?: EventQualityFamily;
  familyLabel?: string;
  events: ReactionEvent[];
  candlesByWindow: Record<ReactionWindow, BridgeCandle[]>;
}): ReactionStudyRow {
  const samples = deriveSamplesForEntity({
    pair: params.pair,
    events: params.events,
    candlesByWindow: params.candlesByWindow,
  });
  const summaryWindows = buildSummaryWindows(samples);
  const sampleCount = samples.length;

  return {
    key: params.key,
    label: params.label,
    currency: params.currency,
    family: params.family,
    familyLabel: params.familyLabel,
    quality: getSampleQuality(sampleCount),
    sampleCount,
    rankMetric: summaryWindows["1h"].medianAbsolutePips,
    summaryWindows,
    bucketStats: buildBucketStats(samples),
    note: sampleCount === 0 ? "No usable reaction samples were resolved for this row." : null,
  };
}

export function getRelevantPairsForCurrency(currency: string): FxPairDefinition[] {
  return FX_PAIRS.filter((pair) => pair.base === currency || pair.quote === currency);
}

export function getHistoricalReplaySamples(params: {
  events: CalendarEvent[];
  templateKey: string;
  nowSeconds?: number;
}): ReactionReplaySample[] {
  const nowSeconds = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const [currency, title] = params.templateKey.split("|");

  return params.events
    .filter((event) => event.time < nowSeconds && event.currency === currency && event.title === title)
    .filter((event) => parseNumericValue(event.actual) != null && parseNumericValue(event.forecast) != null)
    .sort((left, right) => right.time - left.time)
    .map((event) => ({
      eventId: `${event.currency}|${event.title}|${event.time}|${event.id}`,
      eventTime: event.time,
      currency: event.currency,
      title: event.title,
      actual: event.actual,
      forecast: event.forecast,
      previous: event.previous,
    }));
}

export function getReplayWindowCandles(params: {
  candles: BridgeCandle[];
  eventTime: number;
  beforeCount?: number;
  afterCount?: number;
}): { candles: BridgeCandle[]; eventIndex: number } | null {
  const beforeCount = params.beforeCount ?? 14;
  const afterCount = params.afterCount ?? 14;
  if (params.candles.length === 0) return null;

  let eventIndex = -1;
  for (let index = 0; index < params.candles.length; index += 1) {
    if (params.candles[index].time <= params.eventTime) {
      eventIndex = index;
      continue;
    }
    break;
  }

  if (eventIndex < 0) return null;

  const start = Math.max(0, eventIndex - beforeCount);
  const end = Math.min(params.candles.length, eventIndex + afterCount + 1);
  const slice = params.candles.slice(start, end);
  const localEventIndex = eventIndex - start;

  if (slice.length < 3 || localEventIndex < 0 || localEventIndex >= slice.length) return null;

  return {
    candles: slice,
    eventIndex: localEventIndex,
  };
}

export const REPLAY_TIMEFRAME_OPTIONS: Array<{
  id: ReplayChartTimeframe;
  label: string;
}> = [
  { id: "M15", label: "M15" },
  { id: "H1", label: "H1" },
  { id: "H4", label: "H4" },
  { id: "D1", label: "D1" },
];

export function deriveEventFirstStudy(params: {
  template: EventTemplate;
  templateEvents: ReactionEvent[];
  pairCandles: Map<string, Record<ReactionWindow, BridgeCandle[]>>;
}): ReactionStudySummary {
  const pairs = getRelevantPairsForCurrency(params.template.currency);
  const rows = pairs
    .map((pair) => {
      const candlesByWindow = params.pairCandles.get(pair.name);
      if (!candlesByWindow) return null;
      return buildReactionRow({
        key: pair.name,
        label: pair.name,
        currency: params.template.currency,
        pair,
        events: params.templateEvents,
        candlesByWindow,
      });
    })
    .filter((row): row is ReactionStudyRow => row !== null)
    .sort((left, right) => (right.rankMetric ?? -1) - (left.rankMetric ?? -1));

  return {
    mode: "event-first",
    selectedTemplate: params.template,
    rows,
    beatCount: params.templateEvents.filter((event) => event.surprise > 0).length,
    inlineCount: params.templateEvents.filter((event) => event.surprise === 0).length,
    missCount: params.templateEvents.filter((event) => event.surprise < 0).length,
    usableSampleCount: params.templateEvents.length,
    note: rows.length === 0 ? "No relevant FX pairs returned usable reaction samples." : null,
  };
}

export function deriveAssetFirstStudy(params: {
  pair: FxPairDefinition;
  templateMap: Map<string, { template: EventTemplate; events: ReactionEvent[] }>;
  candlesByWindow: Record<ReactionWindow, BridgeCandle[]>;
}): ReactionStudySummary {
  const rows = [...params.templateMap.values()]
    .map(({ template, events }) =>
      buildReactionRow({
        key: template.key,
        label: template.title,
        currency: template.currency,
        pair: params.pair,
        family: template.family,
        familyLabel: template.familyLabel,
        events,
        candlesByWindow: params.candlesByWindow,
      }),
    )
    .sort((left, right) => (right.rankMetric ?? -1) - (left.rankMetric ?? -1));

  const allEvents = [...params.templateMap.values()].flatMap((entry) => entry.events);

  return {
    mode: "asset-first",
    selectedPair: params.pair,
    rows,
    beatCount: allEvents.filter((event) => event.surprise > 0).length,
    inlineCount: allEvents.filter((event) => event.surprise === 0).length,
    missCount: allEvents.filter((event) => event.surprise < 0).length,
    usableSampleCount: allEvents.length,
    note: rows.length === 0 ? "No relevant event templates returned usable reaction samples." : null,
  };
}

export function getReactionBucketLabel(bucket: ReactionBucket): string {
  return BUCKET_LABELS[bucket];
}

export function getAllReactionFamilies(): Array<{ id: EventQualityFamily | "all"; label: string }> {
  return [
    { id: "all", label: "All families" },
    { id: "policy", label: "Policy" },
    { id: "inflation", label: "Inflation" },
    { id: "labor", label: "Labor" },
    { id: "gdp", label: "GDP" },
    { id: "activity", label: "PMI / ISM / Retail" },
    { id: "trade_confidence", label: "Trade / Confidence" },
  ];
}

export function getSampleQualityLabel(quality: SampleQuality): string {
  if (quality === "usable") return "Usable";
  if (quality === "limited") return "Limited";
  return "Weak";
}

export function getRankMetricLabel(): string {
  return "Ranked by 1h median move in pips";
}
