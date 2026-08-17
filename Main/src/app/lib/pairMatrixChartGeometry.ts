import type { PairMatrixCandleRange, PairMatrixRangePixelBounds } from "@/app/lib/pairMatrixSnapshot";

export interface PairMatrixMarkerPixelPosition {
  x: number;
  placement: "left" | "center" | "right";
  visible: boolean;
}

export interface PairMatrixChartGeometryRuntime {
  subscribe: (listener: () => void) => () => void;
  resolveRange: (range: PairMatrixCandleRange) => PairMatrixRangePixelBounds | null;
  resolveMarker: (candleOpens: readonly number[]) => PairMatrixMarkerPixelPosition | null;
}
