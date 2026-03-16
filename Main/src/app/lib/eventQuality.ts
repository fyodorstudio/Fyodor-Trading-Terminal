import { CURRENCY_TO_COUNTRY_CODE } from "@/app/config/fxPairs";
import { formatCountdown } from "@/app/lib/format";
import type {
  CalendarEvent,
  EventQualityBreakdown,
  EventQualityFamily,
  EventQualityHorizon,
  EventQualityRow,
  EventQualitySummary,
  FxPairDefinition,
  ImpactLevel,
} from "@/app/types";

const IMPACT_MULTIPLIERS: Record<ImpactLevel, number> = {
  high: 1,
  medium: 0.65,
  low: 0.35,
};

const FAMILY_CONFIG: Array<{
  family: EventQualityFamily;
  label: string;
  weight: number;
  include: string[];
  exclude?: string[];
}> = [
  {
    family: "policy",
    label: "Policy",
    weight: 8,
    include: [
      "interest rate decision",
      "rate statement",
      "monetary policy statement",
      "monetary policy report",
      "monetary policy assessment",
      "deposit facility rate decision",
      "fomc statement",
      "interest rate",
    ],
    exclude: ["minutes", "speech", "testimony", "auction", "loan", "liquidity", "reserve"],
  },
  {
    family: "inflation",
    label: "Inflation",
    weight: 7,
    include: ["cpi", "cpih", "hicp", "pce", "inflation"],
    exclude: ["producer", "ppi", "core pce price index"],
  },
  {
    family: "labor",
    label: "Labor",
    weight: 6,
    include: [
      "nonfarm payroll",
      "employment",
      "unemployment",
      "jobless claims",
      "claimant count",
      "wages",
      "earnings",
      "labor cash earnings",
    ],
  },
  {
    family: "gdp",
    label: "GDP",
    weight: 5,
    include: ["gdp", "gross domestic product"],
  },
  {
    family: "activity",
    label: "PMI / ISM / Retail",
    weight: 4,
    include: ["pmi", "ism", "retail sales"],
  },
  {
    family: "trade_confidence",
    label: "Trade / Confidence",
    weight: 3,
    include: ["trade balance", "current account", "consumer confidence", "sentiment"],
  },
];

const NOISY_KEYWORDS = [
  "speech",
  "speaks",
  "testimony",
  "minutes",
  "auction",
  "liquidity",
  "reserve operation",
  "mortgage",
  "loan officer",
  "inventory",
  "housing starts",
  "building permits",
  "existing home sales",
  "new home sales",
];

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

export function classifyEventQualityFamily(title: string): {
  family: EventQualityFamily;
  label: string;
  weight: number;
} | null {
  const normalized = normalizeTitle(title);
  if (!normalized || includesAny(normalized, NOISY_KEYWORDS)) {
    return null;
  }

  for (const config of FAMILY_CONFIG) {
    if (config.exclude && includesAny(normalized, config.exclude)) {
      continue;
    }
    if (includesAny(normalized, config.include)) {
      return {
        family: config.family,
        label: config.label,
        weight: config.weight,
      };
    }
  }

  return null;
}

function getHorizonEnd(nowSeconds: number, horizon: EventQualityHorizon): number {
  if (horizon === "24h") return nowSeconds + 24 * 60 * 60;
  if (horizon === "72h") return nowSeconds + 72 * 60 * 60;

  const now = new Date(nowSeconds * 1000);
  const utcDay = now.getUTCDay();
  const daysUntilSunday = (7 - utcDay) % 7;
  const end = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysUntilSunday,
    23,
    59,
    59,
  );
  return Math.floor(end / 1000);
}

function getThresholds(horizon: EventQualityHorizon): { mixed: number; dirty: number } {
  if (horizon === "24h") return { mixed: 4, dirty: 8 };
  if (horizon === "72h") return { mixed: 6, dirty: 12 };
  return { mixed: 8, dirty: 16 };
}

function getPairSide(eventCurrency: string, pair: FxPairDefinition): "base" | "quote" | null {
  if (eventCurrency === pair.base) return "base";
  if (eventCurrency === pair.quote) return "quote";
  return null;
}

function scoreRow(event: CalendarEvent, pair: FxPairDefinition, nowMs: number): EventQualityRow | null {
  const pairSide = getPairSide(event.currency, pair);
  if (!pairSide) return null;

  const family = classifyEventQualityFamily(event.title);
  if (!family) return null;

  const impactMultiplier = IMPACT_MULTIPLIERS[event.impact];
  const score = Number((family.weight * impactMultiplier).toFixed(2));

  return {
    id: `${event.id}-${event.time}-${family.family}`,
    event,
    pairSide,
    family: family.family,
    familyLabel: family.label,
    familyWeight: family.weight,
    impactMultiplier,
    score,
    countdownLabel: formatCountdown(event.time, nowMs),
  };
}

export function deriveEventQualitySummary(params: {
  events: CalendarEvent[];
  pair: FxPairDefinition;
  horizon: EventQualityHorizon;
  nowSeconds?: number;
}): EventQualitySummary {
  const nowSeconds = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const nowMs = nowSeconds * 1000;
  const endsAt = getHorizonEnd(nowSeconds, params.horizon);

  const rows = params.events
    .filter((event) => event.time >= nowSeconds && event.time <= endsAt)
    .map((event) => scoreRow(event, params.pair, nowMs))
    .filter((row): row is EventQualityRow => row !== null)
    .sort((left, right) => left.event.time - right.event.time);

  const totalScore = Number(rows.reduce((sum, row) => sum + row.score, 0).toFixed(2));
  const baseScore = Number(
    rows.filter((row) => row.pairSide === "base").reduce((sum, row) => sum + row.score, 0).toFixed(2),
  );
  const quoteScore = Number(
    rows.filter((row) => row.pairSide === "quote").reduce((sum, row) => sum + row.score, 0).toFixed(2),
  );

  const breakdownMap = new Map<EventQualityFamily, EventQualityBreakdown>();
  for (const config of FAMILY_CONFIG) {
    breakdownMap.set(config.family, {
      family: config.family,
      label: config.label,
      count: 0,
      score: 0,
    });
  }

  rows.forEach((row) => {
    const current = breakdownMap.get(row.family);
    if (!current) return;
    current.count += 1;
    current.score = Number((current.score + row.score).toFixed(2));
  });

  const breakdown = Array.from(breakdownMap.values()).filter((item) => item.count > 0);
  const immediateTrigger = rows.some(
    (row) =>
      row.event.impact === "high" &&
      (row.family === "policy" || row.family === "inflation" || row.family === "labor") &&
      row.event.time <= nowSeconds + 24 * 60 * 60,
  );

  let label: EventQualitySummary["label"] = "clean";
  if (immediateTrigger) {
    label = "dirty";
  } else {
    const thresholds = getThresholds(params.horizon);
    if (totalScore >= thresholds.dirty) label = "dirty";
    else if (totalScore >= thresholds.mixed) label = "mixed";
  }

  const note =
    rows.length === 0 ? "No matched base/quote macro events in the selected horizon" : null;

  return {
    pair: params.pair,
    horizon: params.horizon,
    startsAt: nowSeconds,
    endsAt,
    totalScore,
    baseScore,
    quoteScore,
    label,
    rows,
    breakdown,
    immediateTrigger,
    note,
  };
}

export function getEventQualityThresholds(horizon: EventQualityHorizon): { mixed: number; dirty: number } {
  return getThresholds(horizon);
}

export function getEventQualityFamilyWeights(): Array<{
  family: EventQualityFamily;
  label: string;
  weight: number;
}> {
  return FAMILY_CONFIG.map(({ family, label, weight }) => ({ family, label, weight }));
}

export function getEventQualityImpactMultipliers(): Record<ImpactLevel, number> {
  return { ...IMPACT_MULTIPLIERS };
}

export function getCurrencyCountryCode(currency: string): string {
  const code = currency.toUpperCase() as keyof typeof CURRENCY_TO_COUNTRY_CODE;
  return CURRENCY_TO_COUNTRY_CODE[code] ?? currency.slice(0, 2).toUpperCase();
}
