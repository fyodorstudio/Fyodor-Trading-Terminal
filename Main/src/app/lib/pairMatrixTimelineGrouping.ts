import {
  PAIR_MATRIX_FACTORS,
  PAIR_MATRIX_OTHER_FACTOR,
  type PairMatrixFactorDefinition,
  type PairMatrixSeriesSnapshot,
} from "@/app/lib/pairMatrixSnapshot";

export type PairMatrixTimelineGroupingMode = "factor" | "release_time";
export type PairMatrixTimelineSection = "during" | "before";

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

export type PairMatrixTimelineGroup = PairMatrixFactorTimelineGroup | PairMatrixReleaseTimeTimelineGroup;

const FACTOR_ORDER = [...PAIR_MATRIX_FACTORS, PAIR_MATRIX_OTHER_FACTOR] as const;

export function buildPairMatrixTimelineGroups(entries: readonly PairMatrixSeriesSnapshot[], mode: PairMatrixTimelineGroupingMode): PairMatrixTimelineGroup[] {
  if (mode === "factor") {
    const byFactor = new Map<string, PairMatrixSeriesSnapshot[]>();
    entries.forEach((entry) => {
      const current = byFactor.get(entry.factor.id) ?? [];
      current.push(entry);
      byFactor.set(entry.factor.id, current);
    });
    return FACTOR_ORDER.flatMap((factor) => {
      const factorEntries = byFactor.get(factor.id);
      return factorEntries?.length ? [{ kind: "factor" as const, id: factor.id, factor, entries: factorEntries }] : [];
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
  return group.kind === "factor" || group.entries.length > 1;
}

export function togglePairMatrixTimelineExpansion(current: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(current);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}
