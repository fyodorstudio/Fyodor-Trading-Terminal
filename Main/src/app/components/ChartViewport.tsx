import { memo, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type Ref } from "react";
import { AlertTriangle, CalendarDays, ChevronDown, Settings2, Table2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ChartEventLens, type ChartEventLensData } from "@/app/components/ChartEventLens";
import { ChartEventOverlay } from "@/app/components/ChartEventOverlay";
import { ChartPairMatrixTimeLens, type ChartPairMatrixTimeLensData } from "@/app/components/ChartPairMatrixTimeLens";
import type { ChartEventOverlayCluster } from "@/app/lib/chartEventOverlay";
import type { PairMatrixCandleRange, PairMatrixRangePixelBounds } from "@/app/lib/pairMatrixSnapshot";
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

export type ChartPairMatrixRangeOverlayData = {
  armed: boolean;
  cancelRevision: number;
  lockedBounds: PairMatrixRangePixelBounds | null;
  startPreview: (x: number, edge: "new" | "start" | "end") => PairMatrixRangePreview | null;
  updatePreview: (x: number, originTime: number) => PairMatrixRangePreview | null;
  onCommit: (range: PairMatrixCandleRange) => void;
  onCancel: () => void;
  onInteractionChange: (active: boolean) => void;
};

export type PairMatrixRangePreview = {
  key: string;
  originTime: number;
  range: PairMatrixCandleRange;
  bounds: PairMatrixRangePixelBounds;
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
  pairMatrixRangeOverlay: ChartPairMatrixRangeOverlayData;
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
  pairMatrixRangeOverlay,
  crosshairReadout,
  status,
  overlayCopy,
  reachedBoundary,
}: ChartViewportProps) {
  return (
    <>
      <div className="chart-viewport-shell relative group min-h-0 flex-1 overflow-hidden">
        <div className="chart-viewport-surface h-full overflow-hidden">
          <div className={`chart-canvas-frame ${pairMatrixTimeLens.open ? "has-pair-matrix-bottom" : ""}`}>
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
              <ChartPairMatrixRangeOverlay data={pairMatrixRangeOverlay} />
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
            </div>
            {pairMatrixTimeLens.open ? (
              <section
                className="chart-pair-matrix-bottom-shell"
                aria-label="Pair Matrix bottom panel"
              >
                <ChartPairMatrixTimeLens data={pairMatrixTimeLens} />
              </section>
            ) : null}
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

const ChartPairMatrixRangeOverlay = memo(function ChartPairMatrixRangeOverlay({ data }: { data: ChartPairMatrixRangeOverlayData }) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<PairMatrixRangePreview | null>(null);
  const draggingRef = useRef(false);
  const previewRef = useRef<PairMatrixRangePreview | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const pendingXRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (animationFrameRef.current != null) window.cancelAnimationFrame(animationFrameRef.current);
  }, []);

  useEffect(() => {
    if (animationFrameRef.current != null) window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    pendingXRef.current = null;
    previewRef.current = null;
    draggingRef.current = false;
    setPreview(null);
    setDragging(false);
  }, [data.cancelRevision]);

  const localX = (event: ReactPointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.closest(".chart-plot-region")?.getBoundingClientRect();
    return bounds ? event.clientX - bounds.left : 0;
  };
  const applyPreview = (next: PairMatrixRangePreview | null) => {
    if (!next || previewRef.current?.key === next.key) return;
    previewRef.current = next;
    setPreview(next);
  };
  const begin = (event: ReactPointerEvent<HTMLElement>, edge: "new" | "start" | "end") => {
    const next = data.startPreview(localX(event), edge);
    if (!next) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    setDragging(true);
    previewRef.current = next;
    setPreview(next);
    data.onInteractionChange(true);
    event.preventDefault();
    event.stopPropagation();
  };
  const move = (event: ReactPointerEvent<HTMLElement>) => {
    if (!draggingRef.current || !previewRef.current) return;
    pendingXRef.current = localX(event);
    if (animationFrameRef.current == null) {
      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = null;
        const x = pendingXRef.current;
        const current = previewRef.current;
        if (x == null || !current) return;
        applyPreview(data.updatePreview(x, current.originTime));
      });
    }
    event.preventDefault();
  };
  const end = (event: ReactPointerEvent<HTMLElement>) => {
    if (!draggingRef.current || !previewRef.current) return;
    if (animationFrameRef.current != null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    const finalPreview = data.updatePreview(localX(event), previewRef.current.originTime) ?? previewRef.current;
    draggingRef.current = false;
    setDragging(false);
    setPreview(null);
    previewRef.current = null;
    pendingXRef.current = null;
    data.onInteractionChange(false);
    data.onCommit(finalPreview.range);
    event.preventDefault();
    event.stopPropagation();
  };
  const cancel = (event: ReactPointerEvent<HTMLElement>) => {
    if (!draggingRef.current) return;
    if (animationFrameRef.current != null) window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    draggingRef.current = false;
    previewRef.current = null;
    pendingXRef.current = null;
    setDragging(false);
    setPreview(null);
    data.onInteractionChange(false);
    data.onCancel();
    event.preventDefault();
    event.stopPropagation();
  };
  const bounds = preview?.bounds ?? data.lockedBounds;
  if (!bounds && !data.armed && !dragging) return null;
  const left = bounds?.left ?? 0;
  const width = bounds ? Math.max(2, bounds.right - bounds.left) : 0;
  const bandStyle = { left: `${left}px`, width: `${width}px` } as CSSProperties;

  return (
    <div
      className={`absolute inset-0 z-[35] ${data.armed ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"}`}
      aria-label={data.armed ? "Drag to select a Pair Matrix candle range" : "Locked Pair Matrix candle range"}
      onPointerDown={data.armed ? (event) => begin(event, "new") : undefined}
      onPointerMove={data.armed ? move : undefined}
      onPointerUp={data.armed ? end : undefined}
      onPointerCancel={data.armed ? cancel : undefined}
    >
      {bounds ? (
        <div className="pointer-events-none absolute inset-y-0 border-x-[3px] border-blue-600 bg-blue-400/25 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28)]" style={bandStyle} data-pair-matrix-range-band="">
          <button
            type="button"
            className="pointer-events-auto absolute inset-y-0 -left-2 w-4 cursor-ew-resize bg-transparent"
            aria-label="Adjust Pair Matrix range start"
            onPointerDown={(event) => begin(event, "start")}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={cancel}
          ><span className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600" /></button>
          <button
            type="button"
            className="pointer-events-auto absolute inset-y-0 -right-2 w-4 cursor-ew-resize bg-transparent"
            aria-label="Adjust Pair Matrix range end"
            onPointerDown={(event) => begin(event, "end")}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={cancel}
          ><span className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600" /></button>
        </div>
      ) : null}
      {data.armed && !dragging ? <span className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded bg-slate-900/85 px-2 py-1 text-[10px] font-black text-white">Drag across complete candles</span> : null}
    </div>
  );
});

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
