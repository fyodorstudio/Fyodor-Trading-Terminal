import { type Ref } from "react";
import { AlertTriangle, CalendarDays, ChevronDown, Settings2, Table2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ChartEventLens, type ChartEventLensData } from "@/app/components/ChartEventLens";
import { ChartEventOverlay } from "@/app/components/ChartEventOverlay";
import { ChartPairMatrixTimeLens, type ChartPairMatrixTimeLensData } from "@/app/components/ChartPairMatrixTimeLens";
import type { ChartEventOverlayCluster } from "@/app/lib/chartEventOverlay";
import type { BridgeStatus, CalendarEvent } from "@/app/types";

export type ChartCrosshairReadout = {
  top: number;
  lines: Array<{ label: string; value: string }>;
};

export type ChartEventLensDockData = {
  visible: boolean;
  title: string;
  description: string;
  countLabel: string;
  expanded: boolean;
  canEnableEvents: boolean;
  canBroadenImpact: boolean;
  onToggleExpanded: () => void;
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
    isInteracting: boolean;
  };
  hoveredClusterKey: string | null;
  activeClusterKey: string | null;
  onHoverCluster: (key: string | null) => void;
  onSelectCluster: (key: string) => void;
  onSelectEvent: (clusterKey: string, event: CalendarEvent) => void;
  eventLens: ChartEventLensData | null;
  eventLensDock: ChartEventLensDockData;
  pairMatrixTimeLens: ChartPairMatrixTimeLensData;
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
  onSelectEvent,
  eventLens,
  eventLensDock,
  pairMatrixTimeLens,
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
            <div className="chart-plot-region">
              <div ref={containerRef} className="h-full w-full" />
              <ChartEventOverlay
                clusters={clusters}
                isCapped={eventOverlay.isCapped}
                renderedEventCount={eventOverlay.renderedEventCount}
                visibleEventCount={eventOverlay.visibleEventCount}
                hoveredClusterKey={hoveredClusterKey}
                activeClusterKey={activeClusterKey}
                isInteracting={eventOverlay.isInteracting}
                onHoverCluster={onHoverCluster}
                onSelectCluster={onSelectCluster}
                onSelectEvent={onSelectEvent}
              />
            </div>
            <div className={`chart-event-lens-slot ${eventOverlay.isInteracting ? "is-interacting" : ""}`}>
              {!eventLens?.expanded && !eventLensDock.expanded && !pairMatrixTimeLens.open ? (
                <ChartBookmarkDock
                  eventLens={eventLens}
                  eventLensDock={eventLensDock}
                  pairMatrixTimeLens={pairMatrixTimeLens}
                />
              ) : null}
              {eventLens?.expanded ? <ChartEventLens data={eventLens} /> : null}
              {!eventLens && eventLensDock.expanded ? <ChartEventLensDock data={eventLensDock} /> : null}
              {pairMatrixTimeLens.open ? (
                <ChartPairMatrixTimeLens data={{ ...pairMatrixTimeLens, renderClosedButton: false }} />
              ) : null}
            </div>
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

function ChartBookmarkDock({
  eventLens,
  eventLensDock,
  pairMatrixTimeLens,
}: {
  eventLens: ChartEventLensData | null;
  eventLensDock: ChartEventLensDockData;
  pairMatrixTimeLens: ChartPairMatrixTimeLensData;
}) {
  if (!eventLensDock.visible) return null;
  const openEventLens = eventLens?.onToggleExpanded ?? eventLensDock.onToggleExpanded;
  const eventLabel = eventLens ? "Open Event Lens" : "Open Event Lens details";

  return (
    <section className="chart-bookmark-dock" aria-label="Chart tools">
      <button
        type="button"
        className="chart-bookmark-dock-button"
        title={eventLabel}
        aria-label={eventLabel}
        onClick={openEventLens}
        aria-expanded={false}
      >
        <CalendarDays size={15} />
      </button>
      <button
        type="button"
        className="chart-bookmark-dock-button"
        title="Open Pair Matrix Time Lens"
        aria-label="Open Pair Matrix Time Lens"
        onClick={pairMatrixTimeLens.onToggleOpen}
        aria-expanded={false}
      >
        <Table2 size={15} />
      </button>
    </section>
  );
}

function ChartEventLensDock({ data }: { data: ChartEventLensDockData }) {
  if (!data.visible) return null;

  if (!data.expanded) {
    return null;
  }

  return (
    <section className="chart-event-lens-dock is-expanded" aria-label="Event Lens">
      <div className="chart-event-lens-dock-title">
        <span>Event Lens</span>
        <strong>{data.title}</strong>
      </div>
      <p>{data.description}</p>
      <div className="chart-event-lens-dock-actions">
        <button type="button" onClick={data.onToggleExpanded} aria-expanded={data.expanded}>
          <ChevronDown size={13} />
          Collapse
        </button>
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
      <div className="chart-event-lens-dock-body">
        <div>
          <span>How to use</span>
          <strong>Click an event dot or badge on the bottom rail to load replay details.</strong>
        </div>
        <div>
          <span>Coverage</span>
          <strong>{data.countLabel}</strong>
        </div>
      </div>
    </section>
  );
}
