import { type Ref } from "react";
import { AlertTriangle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ChartEventLens, type ChartEventLensData } from "@/app/components/ChartEventLens";
import { ChartEventOverlay } from "@/app/components/ChartEventOverlay";
import type { ChartEventOverlayCluster } from "@/app/lib/chartEventOverlay";
import type { BridgeStatus } from "@/app/types";

export type ChartCrosshairReadout = {
  top: number;
  lines: Array<{ label: string; value: string }>;
};

interface ChartViewportProps {
  containerRef: Ref<HTMLDivElement>;
  clusters: ChartEventOverlayCluster[];
  eventOverlay: {
    isCapped: boolean;
    renderedEventCount: number;
    visibleEventCount: number;
  };
  hoveredClusterKey: string | null;
  activeClusterKey: string | null;
  onHoverCluster: (key: string | null) => void;
  onSelectCluster: (key: string) => void;
  eventLens: ChartEventLensData | null;
  crosshairReadout: ChartCrosshairReadout | null;
  status: BridgeStatus;
  overlayCopy: {
    title: string;
    description: string;
  };
  reachedBoundary: boolean;
}

export function ChartViewport({
  containerRef,
  clusters,
  eventOverlay,
  hoveredClusterKey,
  activeClusterKey,
  onHoverCluster,
  onSelectCluster,
  eventLens,
  crosshairReadout,
  status,
  overlayCopy,
  reachedBoundary,
}: ChartViewportProps) {
  return (
    <>
      <div className="relative group min-h-0 flex-1 overflow-hidden">
        <div className="h-full p-1 backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-3xl shadow-sm overflow-hidden">
          <div className="chart-canvas-frame">
            <div ref={containerRef} className="h-full w-full" />
            <ChartEventOverlay
              clusters={clusters}
              isCapped={eventOverlay.isCapped}
              renderedEventCount={eventOverlay.renderedEventCount}
              visibleEventCount={eventOverlay.visibleEventCount}
              hoveredClusterKey={hoveredClusterKey}
              activeClusterKey={activeClusterKey}
              onHoverCluster={onHoverCluster}
              onSelectCluster={onSelectCluster}
            />
            {eventLens ? <ChartEventLens data={eventLens} /> : null}
          </div>
        </div>
        {crosshairReadout && (
          <div
            className="chart-crosshair-readout"
            style={{ top: crosshairReadout.top }}
            aria-hidden="true"
          >
            {crosshairReadout.lines.map((line) => (
              <div key={line.label} className="chart-crosshair-readout-line">
                <span>{line.label}</span>
                <strong>{line.value}</strong>
              </div>
            ))}
          </div>
        )}
        <div className="charts-history-boundary" aria-live="polite">
          <span className={`charts-history-boundary-pill ${reachedBoundary ? "is-visible" : ""}`}>
            Oldest available MT5 candle, approximate
          </span>
        </div>

        <AnimatePresence>
          {(status === "error" || status === "no_data") && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/40 backdrop-blur-xl rounded-3xl z-50 text-center p-8"
            >
              <div className="p-4 bg-red-50 rounded-full text-red-500">
                <AlertTriangle className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{overlayCopy.title}</h3>
                <p className="text-gray-600 max-w-sm">{overlayCopy.description}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
