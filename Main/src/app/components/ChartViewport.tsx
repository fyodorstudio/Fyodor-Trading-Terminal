import { type Ref } from "react";
import { AlertTriangle, CalendarDays, Settings2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ChartEventLens, type ChartEventLensData } from "@/app/components/ChartEventLens";
import { ChartEventOverlay } from "@/app/components/ChartEventOverlay";
import type { ChartEventOverlayCluster } from "@/app/lib/chartEventOverlay";
import type { BridgeStatus } from "@/app/types";

export type ChartCrosshairReadout = {
  top: number;
  lines: Array<{ label: string; value: string }>;
};

export type ChartEventLensDockData = {
  visible: boolean;
  title: string;
  description: string;
  countLabel: string;
  canEnableEvents: boolean;
  canBroadenImpact: boolean;
  onShowEvents: () => void;
  onOpenSettings: () => void;
  onShowHighMedium: () => void;
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
  eventLensDock: ChartEventLensDockData;
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
  eventLensDock,
  crosshairReadout,
  status,
  overlayCopy,
  reachedBoundary,
}: ChartViewportProps) {
  return (
    <>
      <div className="chart-viewport-shell relative group min-h-0 flex-1 overflow-hidden">
        <div className="chart-viewport-surface h-full overflow-hidden">
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
            {eventLens ? <ChartEventLens data={eventLens} /> : <ChartEventLensDock data={eventLensDock} />}
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

function ChartEventLensDock({ data }: { data: ChartEventLensDockData }) {
  if (!data.visible) return null;

  return (
    <section className="chart-event-lens-dock" aria-label="Event Lens">
      <div className="chart-event-lens-dock-title">
        <span>Event Lens</span>
        <strong>{data.title}</strong>
      </div>
      <p>{data.description}</p>
      <span className="chart-event-lens-dock-count">{data.countLabel}</span>
      <div className="chart-event-lens-dock-actions">
        {data.canEnableEvents ? (
          <button type="button" onClick={data.onShowEvents}>
            <CalendarDays size={13} />
            Show event rail
          </button>
        ) : null}
        <button type="button" onClick={data.onOpenSettings}>
          <Settings2 size={13} />
          Events settings
        </button>
        {data.canBroadenImpact ? (
          <button type="button" onClick={data.onShowHighMedium}>
            <CalendarDays size={13} />
            Show high + medium
          </button>
        ) : null}
      </div>
    </section>
  );
}
