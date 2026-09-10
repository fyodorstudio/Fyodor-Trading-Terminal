import type { PairMatrixContextMarkerView } from "@/app/components/ChartPairMatrixContextMarkers";
import type { ChartDisplayTimeMode } from "@/app/lib/chartView";
import type { PairMatrixChartGeometryRuntime } from "@/app/lib/pairMatrixChartGeometry";
import type { PairMatrixHoverRuntime } from "@/app/lib/pairMatrixHoverRuntime";
import type { PairMatrixCandleRange, PairMatrixRangePixelBounds } from "@/app/lib/pairMatrixSnapshot";
import type { CalendarEvent } from "@/app/types";

export type PairMatrixRangePreview = {
  key: string;
  originTime: number;
  range: PairMatrixCandleRange;
  bounds: PairMatrixRangePixelBounds;
};

export type ChartPairMatrixRangeOverlayData = {
  armed: boolean;
  cancelRevision: number;
  lockedBounds: PairMatrixRangePixelBounds | null;
  lockedRange?: PairMatrixCandleRange | null;
  geometryRuntime?: PairMatrixChartGeometryRuntime;
  startPreview: (x: number, edge: "new" | "start" | "end") => PairMatrixRangePreview | null;
  updatePreview: (x: number, originTime: number) => PairMatrixRangePreview | null;
  onCommit: (range: PairMatrixCandleRange) => void;
  onCancel: () => void;
  onInteractionChange: (active: boolean) => void;
};

export type ChartPairMatrixContextMarkerData = {
  markers: PairMatrixContextMarkerView[];
  passive: boolean;
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
  loadState: "idle" | "loading" | "ready" | "error";
  onSelectEvent: (event: CalendarEvent) => void;
  onAnalyzeCandle: (candleOpen: number) => void;
  geometryRuntime?: PairMatrixChartGeometryRuntime;
  cursorRuntime?: {
    hover: PairMatrixHoverRuntime;
    resolve: (anchor: number | null) => PairMatrixContextMarkerView[];
  };
};
