export interface ChartZoomSnapshot {
  span: number;
  rightOffset: number;
}

const residentChartZoomSnapshots = new Map<string, ChartZoomSnapshot>();

export function getResidentChartZoomSnapshot(identity: string): ChartZoomSnapshot | null {
  return residentChartZoomSnapshots.get(identity) ?? null;
}

export function setResidentChartZoomSnapshot(identity: string, snapshot: ChartZoomSnapshot) {
  residentChartZoomSnapshots.set(identity, snapshot);
}

export function captureChartZoomSnapshot(
  range: { from: number; to: number } | null,
  lastCandleIndex: number,
): ChartZoomSnapshot | null {
  if (!range) return null;
  const span = range.to - range.from;
  if (!Number.isFinite(span) || span <= 1) return null;
  return {
    span,
    rightOffset: Math.min(span * 0.8, Math.max(0, range.to - lastCandleIndex)),
  };
}

export function restoreChartZoomRange(
  snapshot: ChartZoomSnapshot,
  lastCandleIndex: number,
): { from: number; to: number } {
  const to = lastCandleIndex + snapshot.rightOffset;
  return { from: to - snapshot.span, to };
}
