import {
  PAIR_MATRIX_FACTORS,
  PAIR_MATRIX_OTHER_FACTOR,
  type PairMatrixFactorDefinition,
  type PairMatrixSeriesSnapshot,
} from "@/app/lib/pairMatrixSnapshot";

export type PairMatrixTimelineGroupingMode = "factor" | "release_time";
export type PairMatrixTimelineSection = "during" | "before";
export type PairMatrixContextLayerId = "policy" | "inflation" | "economy" | "other";

export interface PairMatrixContextLayerDefinition {
  id: PairMatrixContextLayerId;
  label: string;
  helpText: string;
}

export const PAIR_MATRIX_CONTEXT_LAYERS: readonly PairMatrixContextLayerDefinition[] = [
  { id: "policy", label: "Policy", helpText: "Rate decisions and recognized central-bank communication. Communications remain unscored unless they are canonical numeric decisions." },
  { id: "inflation", label: "Inflation", helpText: "Strictly classified CPI, HICP, PCE, PPI, and related inflation releases." },
  { id: "economy", label: "Economy", helpText: "Labor, retail sales, activity, sentiment, and trade evidence, organized into their existing factors." },
  { id: "other", label: "Other", helpText: "Pair-relevant releases that remain visible but do not fit the current curated context layers." },
] as const;

export interface PairMatrixContextTimelineGroup {
  kind: "context";
  id: string;
  layer: PairMatrixContextLayerDefinition;
  entries: PairMatrixSeriesSnapshot[];
}

export interface PairMatrixFactorTimelineGroup {
  kind: "factor";
  id: string;
  factor: PairMatrixFactorDefinition;
  entries: PairMatrixSeriesSnapshot[];
}

export interface PairMatrixReleaseTimeTimelineGroup {
  kind: "release_time";
  id: string;
  time: number;
  factors: PairMatrixFactorDefinition[];
  entries: PairMatrixSeriesSnapshot[];
}

export type PairMatrixTimelineGroup = PairMatrixContextTimelineGroup | PairMatrixFactorTimelineGroup | PairMatrixReleaseTimeTimelineGroup;

const FACTOR_ORDER = [...PAIR_MATRIX_FACTORS, PAIR_MATRIX_OTHER_FACTOR] as const;
const ECONOMY_FACTOR_IDS = new Set(["labor", "retail", "pmi", "sentiment", "trade"]);
const POLICY_CONTEXT_TITLE_TERMS = [
  "rate statement",
  "fomc statement",
  "monetary policy statement",
  "press conference",
  "economic projections",
  "policy projections",
  "fomc projections",
  "dot plot",
  "speech",
  "speaks",
  "testimony",
  "minutes",
];

export function getPairMatrixContextLayer(entry: PairMatrixSeriesSnapshot): PairMatrixContextLayerDefinition {
  if (entry.factor.id === "policy") return PAIR_MATRIX_CONTEXT_LAYERS[0];
  if (entry.factor.id === "inflation") return PAIR_MATRIX_CONTEXT_LAYERS[1];
  if (ECONOMY_FACTOR_IDS.has(entry.factor.id)) return PAIR_MATRIX_CONTEXT_LAYERS[2];
  const normalizedTitle = entry.event.title.trim().toLowerCase();
  if (POLICY_CONTEXT_TITLE_TERMS.some((term) => normalizedTitle.includes(term))) return PAIR_MATRIX_CONTEXT_LAYERS[0];
  return PAIR_MATRIX_CONTEXT_LAYERS[3];
}

export function buildPairMatrixEconomyFactorGroups(entries: readonly PairMatrixSeriesSnapshot[]): PairMatrixFactorTimelineGroup[] {
  const byFactor = new Map<string, PairMatrixSeriesSnapshot[]>();
  entries.forEach((entry) => {
    const current = byFactor.get(entry.factor.id) ?? [];
    current.push(entry);
    byFactor.set(entry.factor.id, current);
  });
  return FACTOR_ORDER.flatMap((factor) => {
    if (!ECONOMY_FACTOR_IDS.has(factor.id)) return [];
    const factorEntries = byFactor.get(factor.id);
    return factorEntries?.length ? [{ kind: "factor" as const, id: factor.id, factor, entries: factorEntries }] : [];
  });
}

export function buildPairMatrixTimelineGroups(entries: readonly PairMatrixSeriesSnapshot[], mode: PairMatrixTimelineGroupingMode): PairMatrixTimelineGroup[] {
  if (mode === "factor") {
    const byLayer = new Map<PairMatrixContextLayerId, PairMatrixSeriesSnapshot[]>();
    entries.forEach((entry) => {
      const layer = getPairMatrixContextLayer(entry);
      const current = byLayer.get(layer.id) ?? [];
      current.push(entry);
      byLayer.set(layer.id, current);
    });
    return PAIR_MATRIX_CONTEXT_LAYERS.flatMap((layer) => {
      const layerEntries = byLayer.get(layer.id);
      return layerEntries?.length ? [{ kind: "context" as const, id: `context:${layer.id}`, layer, entries: layerEntries }] : [];
    });
  }

  const byTime = new Map<string, PairMatrixSeriesSnapshot[]>();
  entries.forEach((entry) => {
    const key = `${entry.event.currency}:${entry.event.time}`;
    const current = byTime.get(key) ?? [];
    current.push(entry);
    byTime.set(key, current);
  });
  return [...byTime.entries()].map(([id, timeEntries]) => {
    const sortedEntries = [...timeEntries].sort((left, right) => left.event.title.localeCompare(right.event.title) || left.event.id - right.event.id);
    return {
      kind: "release_time" as const,
      id,
      time: sortedEntries[0].event.time,
      entries: sortedEntries,
      factors: [...new Map(sortedEntries.map((entry) => [entry.factor.id, entry.factor])).values()],
    };
  });
}

export function getPairMatrixTimelineExpansionKey(params: {
  section: PairMatrixTimelineSection;
  currency: string;
  mode: PairMatrixTimelineGroupingMode;
  groupId: string;
}): string {
  return `${params.section}:${params.currency}:${params.mode}:${params.groupId}`;
}

export function isPairMatrixTimelineGroupExpandable(group: PairMatrixTimelineGroup): boolean {
  return group.kind === "context" || group.kind === "factor" || group.entries.length > 1;
}

export function togglePairMatrixTimelineExpansion(current: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(current);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}
