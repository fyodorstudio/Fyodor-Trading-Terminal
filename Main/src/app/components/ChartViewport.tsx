import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type Ref } from "react";
import { AlertTriangle, CalendarDays, ChevronDown, Settings2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ChartEventLens, type ChartEventLensData } from "@/app/components/ChartEventLens";
import { ChartEventOverlay } from "@/app/components/ChartEventOverlay";
import { ChartPairMatrixContextMarkers, type PairMatrixContextMarkerView } from "@/app/components/ChartPairMatrixContextMarkers";
import { ChartMacroBiasAudit, type ChartMacroBiasAuditData } from "@/app/components/ChartMacroBiasAudit";
import { ChartMacroBiasRealtimeCard, type ChartMacroBiasRealtimeCardData } from "@/app/components/ChartMacroBiasRealtimeCard";
import { ChartFmsActionCard } from "@/app/components/ChartFmsActionCard";
import { ChartFmsKnowledgeCard } from "@/app/components/ChartFmsKnowledgeCard";
import { ChartPairMatrixTimeLens, type ChartPairMatrixTimeLensData } from "@/app/components/ChartPairMatrixTimeLens";
import { usePairMatrixHoverAnchor } from "@/app/hooks/usePairMatrixHoverAnchor";
import type { ChartEventOverlayCluster } from "@/app/lib/chartEventOverlay";
import type { ChartDisplayTimeMode } from "@/app/lib/chartView";
import type { PairMatrixHoverRuntime } from "@/app/lib/pairMatrixHoverRuntime";
import type { PairMatrixChartGeometryRuntime } from "@/app/lib/pairMatrixChartGeometry";
import type { PairMatrixCandleRange, PairMatrixRangePixelBounds } from "@/app/lib/pairMatrixSnapshot";
import type { BridgeStatus, CalendarEvent } from "@/app/types";

const PAIR_MATRIX_PANEL_MIN_HEIGHT = 240;
const PAIR_MATRIX_CHART_MIN_HEIGHT = 220;
const FMS_DOCK_MIN_WIDTH = 340;
const FMS_DOCK_DEFAULT_WIDTH = 460;
const FMS_DOCK_WIDTH_KEY = "fyodor.charts.fms-dock-width";

export function clampFmsDockWidth(requestedWidth: number, workspaceWidth: number): number {
  const maximum = Math.max(FMS_DOCK_MIN_WIDTH, Math.min(720, workspaceWidth * .62));
  return Math.round(Math.min(maximum, Math.max(FMS_DOCK_MIN_WIDTH, requestedWidth)));
}

export function clampPairMatrixPanelHeight(requestedHeight: number, workspaceHeight: number): number {
  return Math.round(Math.min(
    Math.max(PAIR_MATRIX_PANEL_MIN_HEIGHT, workspaceHeight - PAIR_MATRIX_CHART_MIN_HEIGHT),
    Math.max(PAIR_MATRIX_PANEL_MIN_HEIGHT, requestedHeight),
  ));
}

export type ChartCrosshairReadout = {
  top: number;
  lines: Array<{ label: string; value: string }>;
};

export type ChartCrosshairReadoutHandle = {
  update: (readout: ChartCrosshairReadout | null) => void;
};

export const ChartCrosshairReadoutOverlay = memo(forwardRef<ChartCrosshairReadoutHandle>(function ChartCrosshairReadoutOverlay(_, ref) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const rowsRef = useRef<Array<{ row: HTMLDivElement; label: HTMLSpanElement; value: HTMLElement }>>([]);
  useImperativeHandle(ref, () => ({
    update: (readout) => {
      const root = rootRef.current;
      if (!root) return;
      if (!readout) {
        root.hidden = true;
        return;
      }
      root.hidden = false;
      root.style.top = `${readout.top}px`;
      while (rowsRef.current.length < readout.lines.length) {
        const row = document.createElement("div");
        row.className = "chart-crosshair-readout-line";
        const label = document.createElement("span");
        const value = document.createElement("strong");
        row.append(label, value);
        root.append(row);
        rowsRef.current.push({ row, label, value });
      }
      while (rowsRef.current.length > readout.lines.length) rowsRef.current.pop()?.row.remove();
      readout.lines.forEach((line, index) => {
        const rendered = rowsRef.current[index];
        if (rendered.label.textContent !== line.label) rendered.label.textContent = line.label;
        if (rendered.value.textContent !== line.value) rendered.value.textContent = line.value;
      });
    },
  }), []);
  return (
    <div ref={rootRef} className="chart-crosshair-readout" hidden aria-hidden="true" data-chart-crosshair-isolated="" />
  );
}));

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
  pairMatrixContextMarkers: ChartPairMatrixContextMarkerData;
  macroBiasAudit: ChartMacroBiasAuditData | null;
  macroBiasRealtime: ChartMacroBiasRealtimeCardData | null;
  crosshairReadoutRef: Ref<ChartCrosshairReadoutHandle>;
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
    pairMatrixContextMarkers,
    macroBiasAudit,
    macroBiasRealtime,
    crosshairReadoutRef,
  status,
  overlayCopy,
  reachedBoundary,
}: ChartViewportProps) {
  const [fmsDockTab, setFmsDockTab] = useState<"trade" | "setups" | "research" | "knowledge" | "result">(macroBiasAudit ? "result" : "trade");
  const [fmsDockWidth, setFmsDockWidth] = useState(() => {
    try {
      const saved = Number(window.localStorage.getItem(FMS_DOCK_WIDTH_KEY));
      return Number.isFinite(saved) ? Math.max(FMS_DOCK_MIN_WIDTH, saved) : FMS_DOCK_DEFAULT_WIDTH;
    } catch {
      return FMS_DOCK_DEFAULT_WIDTH;
    }
  });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fmsDockRef = useRef<HTMLElement | null>(null);
  const fmsDockVisible = macroBiasRealtime != null || macroBiasAudit != null;
  const lensOpen = Boolean(eventLens?.expanded || eventLensDock.expanded);
  const bottomDockVisible = pairMatrixTimeLens.open || lensOpen;
  const [bottomDockTab, setBottomDockTab] = useState<"matrix" | "lens">(lensOpen ? "lens" : "matrix");
  const previousMatrixOpenRef = useRef(pairMatrixTimeLens.open);
  const previousLensOpenRef = useRef(lensOpen);

  useEffect(() => {
    if (macroBiasAudit) setFmsDockTab("result");
    else if (macroBiasRealtime) setFmsDockTab("trade");
  }, [macroBiasAudit?.signal.id, Boolean(macroBiasRealtime)]);

  useEffect(() => {
    if (pairMatrixTimeLens.open && !previousMatrixOpenRef.current) setBottomDockTab("matrix");
    previousMatrixOpenRef.current = pairMatrixTimeLens.open;
  }, [pairMatrixTimeLens.open]);

  useEffect(() => {
    if (lensOpen && !previousLensOpenRef.current) setBottomDockTab("lens");
    previousLensOpenRef.current = lensOpen;
  }, [lensOpen]);

  useEffect(() => {
    if (bottomDockTab === "matrix" && !pairMatrixTimeLens.open && lensOpen) setBottomDockTab("lens");
    if (bottomDockTab === "lens" && !lensOpen && pairMatrixTimeLens.open) setBottomDockTab("matrix");
  }, [bottomDockTab, lensOpen, pairMatrixTimeLens.open]);

  const startFmsDockResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const pointerId = event.pointerId;
    const handle = event.currentTarget;
    handle.setPointerCapture(pointerId);
    const bounds = viewportRef.current?.getBoundingClientRect();
    if (!bounds) return;
    let previewWidth = fmsDockWidth;
    const update = (clientX: number) => {
      previewWidth = clampFmsDockWidth(clientX - bounds.left, bounds.width);
      if (fmsDockRef.current) fmsDockRef.current.style.width = `${previewWidth}px`;
    };
    const onMove = (moveEvent: PointerEvent) => update(moveEvent.clientX);
    const finish = (finishEvent: PointerEvent) => {
      update(finishEvent.clientX);
      setFmsDockWidth(previewWidth);
      try {
        if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      } catch {
        // The browser may already have released capture during cancellation.
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      try { window.localStorage.setItem(FMS_DOCK_WIDTH_KEY, String(previewWidth)); } catch { /* optional preference */ }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  const resizeFmsDockFromKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home") return;
    event.preventDefault();
    const workspaceWidth = viewportRef.current?.getBoundingClientRect().width ?? window.innerWidth;
    const requested = event.key === "Home"
      ? FMS_DOCK_DEFAULT_WIDTH
      : fmsDockWidth + (event.key === "ArrowLeft" ? -24 : 24);
    const nextWidth = clampFmsDockWidth(requested, workspaceWidth);
    setFmsDockWidth(nextWidth);
    try { window.localStorage.setItem(FMS_DOCK_WIDTH_KEY, String(nextWidth)); } catch { /* optional preference */ }
  };

  return (
    <>
      <div ref={viewportRef} className="chart-viewport-shell relative group min-h-0 flex-1 overflow-hidden">
        <div className={`chart-viewport-surface h-full overflow-hidden ${fmsDockVisible ? "has-fms-dock" : ""}`}>
          {fmsDockVisible ? (
            <aside ref={fmsDockRef} className="chart-fms-dock" style={{ width: fmsDockWidth }} aria-label="FMS chart workspace">
              <nav className="chart-fms-dock-tabs" aria-label="FMS windows">
                <button type="button" className={fmsDockTab === "trade" ? "is-active" : ""} disabled={!macroBiasRealtime} onClick={() => setFmsDockTab("trade")} title="Current action">Trade</button>
                <button type="button" className={fmsDockTab === "setups" ? "is-active" : ""} disabled={!macroBiasRealtime} onClick={() => setFmsDockTab("setups")}>Setups</button>
                <button type="button" className={fmsDockTab === "research" ? "is-active" : ""} disabled={!macroBiasRealtime} onClick={() => setFmsDockTab("research")}>Research</button>
                <button type="button" className={fmsDockTab === "knowledge" ? "is-active" : ""} disabled={!macroBiasRealtime} onClick={() => setFmsDockTab("knowledge")} title="Durable findings">Knowledge</button>
                <button type="button" className={fmsDockTab === "result" ? "is-active" : ""} disabled={!macroBiasAudit} onClick={() => setFmsDockTab("result")}>Past Result</button>
              </nav>
              <div className="chart-fms-dock-content">
                {fmsDockTab === "result" && macroBiasAudit
                  ? <ChartMacroBiasAudit data={macroBiasAudit} />
                  : fmsDockTab === "trade" && macroBiasRealtime
                    ? <ChartFmsActionCard data={macroBiasRealtime} />
                  : fmsDockTab === "knowledge" && macroBiasRealtime
                    ? <ChartFmsKnowledgeCard data={macroBiasRealtime} />
                  : macroBiasRealtime
                    ? <ChartMacroBiasRealtimeCard data={macroBiasRealtime} view={fmsDockTab === "research" ? "research" : "setups"} />
                    : null}
              </div>
              <div
                className="chart-fms-dock-resize"
                role="separator"
                tabIndex={0}
                aria-label="Resize FMS panel"
                aria-orientation="vertical"
                aria-valuemin={FMS_DOCK_MIN_WIDTH}
                aria-valuemax={720}
                aria-valuenow={fmsDockWidth}
                onPointerDown={startFmsDockResize}
                onKeyDown={resizeFmsDockFromKeyboard}
              ><span /></div>
            </aside>
          ) : null}
          <div className={`chart-canvas-frame ${bottomDockVisible ? "has-pair-matrix-bottom" : ""}`}>
            <div className="chart-plot-region">
              <div ref={containerRef} className="h-full w-full" />
              {!pairMatrixTimeLens.open ? <ChartEventOverlay
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
                /> : null}
                <ChartPairMatrixRangeOverlay data={pairMatrixRangeOverlay} />
                {pairMatrixTimeLens.open ? <ChartPairMatrixContextMarkers {...pairMatrixContextMarkers} /> : null}
            </div>
            {bottomDockVisible ? (
              <ResizableChartBottomPanel
                pairMatrixData={pairMatrixTimeLens}
                eventLens={eventLens}
                eventLensDock={eventLensDock}
                activeTab={bottomDockTab}
                onActiveTabChange={setBottomDockTab}
              />
            ) : null}
          </div>
        </div>
        <ChartCrosshairReadoutOverlay ref={crosshairReadoutRef} />
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

function ResizableChartBottomPanel({
  pairMatrixData,
  eventLens,
  eventLensDock,
  activeTab,
  onActiveTabChange,
}: {
  pairMatrixData: ChartPairMatrixTimeLensData;
  eventLens: ChartEventLensData | null;
  eventLensDock: ChartEventLensDockData;
  activeTab: "matrix" | "lens";
  onActiveTabChange: (tab: "matrix" | "lens") => void;
}) {
  const shellRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingHeightRef = useRef<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const hoverAnchor = usePairMatrixHoverAnchor(pairMatrixData.hasLockedRange ? null : pairMatrixData.cursorRuntime?.hover ?? null);
  const resolvedData = useMemo(
    () => pairMatrixData.hasLockedRange || !pairMatrixData.cursorRuntime ? pairMatrixData : pairMatrixData.cursorRuntime.resolve(hoverAnchor),
    [pairMatrixData, hoverAnchor],
  );

  useEffect(() => () => {
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
  }, []);

  const resolveHeight = (requestedHeight: number) => {
    const workspaceHeight = shellRef.current?.parentElement?.clientHeight ?? 0;
    return clampPairMatrixPanelHeight(requestedHeight, workspaceHeight);
  };
  const scheduleHeight = (nextHeight: number) => {
    pendingHeightRef.current = nextHeight;
    if (frameRef.current != null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      if (pendingHeightRef.current != null && shellRef.current) shellRef.current.style.height = `${pendingHeightRef.current}px`;
    });
  };
  const finishResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const committedHeight = pendingHeightRef.current ?? shellRef.current?.offsetHeight ?? null;
    pendingHeightRef.current = null;
    if (committedHeight != null) setHeight(committedHeight);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <section
      ref={shellRef}
      className="chart-pair-matrix-bottom-shell"
      style={height == null ? undefined : { height: `${height}px` }}
      aria-label="Chart bottom panel"
    >
      <div
        className="chart-pair-matrix-resize-handle"
        role="separator"
        aria-label="Resize chart bottom panel vertically"
        aria-orientation="horizontal"
        aria-valuemin={PAIR_MATRIX_PANEL_MIN_HEIGHT}
        aria-valuenow={height ?? undefined}
        tabIndex={0}
        title="Drag to resize the bottom panel. Double-click to restore the default height."
        onDoubleClick={() => {
          pendingHeightRef.current = null;
          if (shellRef.current) shellRef.current.style.removeProperty("height");
          setHeight(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Home") {
            event.preventDefault();
            setHeight(null);
            return;
          }
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          const currentHeight = height ?? shellRef.current?.offsetHeight ?? PAIR_MATRIX_PANEL_MIN_HEIGHT;
          setHeight(resolveHeight(currentHeight + (event.key === "ArrowUp" ? 24 : -24)));
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          dragRef.current = { pointerId: event.pointerId, startY: event.clientY, startHeight: shellRef.current?.offsetHeight ?? PAIR_MATRIX_PANEL_MIN_HEIGHT };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          event.preventDefault();
          scheduleHeight(resolveHeight(drag.startHeight + drag.startY - event.clientY));
        }}
        onPointerUp={finishResize}
        onPointerCancel={finishResize}
      >
        <span aria-hidden="true" />
      </div>
      <nav className="chart-bottom-dock-tabs" aria-label="Bottom panel windows">
        <button
          type="button"
          className={activeTab === "matrix" ? "is-active" : ""}
          aria-selected={activeTab === "matrix"}
          onClick={() => {
            onActiveTabChange("matrix");
            if (!pairMatrixData.open) pairMatrixData.onToggleOpen();
          }}
        >Matrix</button>
        <button
          type="button"
          className={activeTab === "lens" ? "is-active" : ""}
          aria-selected={activeTab === "lens"}
          onClick={() => {
            onActiveTabChange("lens");
            if (!eventLens?.expanded && !eventLensDock.expanded) {
              (eventLens?.onToggleExpanded ?? eventLensDock.onToggleExpanded)();
            }
          }}
        >Lens</button>
      </nav>
      <div className="chart-bottom-dock-content">
        {activeTab === "matrix" && pairMatrixData.open ? <ChartPairMatrixTimeLens data={resolvedData} /> : null}
        {activeTab === "lens" && eventLens?.expanded ? <ChartEventLens data={eventLens} /> : null}
        {activeTab === "lens" && !eventLens && eventLensDock.expanded ? <ChartEventLensDock data={eventLensDock} /> : null}
      </div>
    </section>
  );
}

export const ChartPairMatrixRangeOverlay = memo(function ChartPairMatrixRangeOverlay({ data }: { data: ChartPairMatrixRangeOverlayData }) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<PairMatrixRangePreview | null>(null);
  const draggingRef = useRef(false);
  const previewRef = useRef<PairMatrixRangePreview | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const pendingXRef = useRef<number | null>(null);
  const bandRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const runtime = data.geometryRuntime;
    if (!runtime || !data.lockedRange) return;
    const update = () => {
      if (draggingRef.current || previewRef.current) return;
      const band = bandRef.current;
      if (!band) return;
      const next = runtime.resolveRange(data.lockedRange!);
      if (!next) {
        band.style.visibility = "hidden";
        return;
      }
      band.style.visibility = "visible";
      band.style.left = "0px";
      band.style.transform = `translate3d(${next.left}px, 0, 0)`;
      const width = `${Math.max(2, next.right - next.left)}px`;
      if (band.style.width !== width) band.style.width = width;
    };
    update();
    return runtime.subscribe(update);
  }, [data.geometryRuntime, data.lockedRange]);

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
  const bounds = preview?.bounds
    ?? data.lockedBounds
    ?? (data.lockedRange && data.geometryRuntime ? data.geometryRuntime.resolveRange(data.lockedRange) : null);
  if (!bounds && !data.lockedRange && !data.armed && !dragging) return null;
  const left = bounds?.left ?? 0;
  const width = bounds ? Math.max(2, bounds.right - bounds.left) : 0;
  const bandStyle = {
    left: "0px",
    width: `${width}px`,
    visibility: bounds ? "visible" : "hidden",
    transform: `translate3d(${left}px, 0, 0)`,
  } as CSSProperties;

  return (
    <div
      className={`absolute inset-0 z-[35] ${data.armed ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"}`}
      aria-label={data.armed ? "Drag to select a Pair Matrix candle range" : "Locked Pair Matrix candle range"}
      onPointerDown={data.armed ? (event) => begin(event, "new") : undefined}
      onPointerMove={data.armed ? move : undefined}
      onPointerUp={data.armed ? end : undefined}
      onPointerCancel={data.armed ? cancel : undefined}
    >
      {bounds || data.lockedRange ? (
        <div ref={bandRef} className="pointer-events-none absolute inset-y-0 will-change-transform border-x-[3px] border-blue-600 bg-blue-400/25 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28)]" style={bandStyle} data-pair-matrix-range-band="">
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

function ChartEventLensDock({ data }: { data: ChartEventLensDockData }) {
  if (!data.visible) return null;

  if (!data.expanded) {
    return null;
  }

  return (
    <section className="chart-event-lens-dock is-expanded" aria-label="Lens">
      <div className="chart-event-lens-dock-title">
        <span>Lens</span>
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
