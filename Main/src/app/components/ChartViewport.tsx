import { forwardRef, memo, useImperativeHandle, useRef, type ReactNode, type Ref } from "react";
import { AlertTriangle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { ChartEventLensData } from "@/app/components/ChartEventLens";
import { ChartEventOverlay } from "@/app/components/ChartEventOverlay";
import { ChartPairMatrixContextMarkers } from "@/app/components/ChartPairMatrixContextMarkers";
import type { ChartMacroBiasAuditData } from "@/app/components/ChartMacroBiasAudit";
import type { ChartMacroBiasRealtimeCardData } from "@/app/components/ChartMacroBiasRealtimeCard";
import type { ChartPairMatrixTimeLensData } from "@/app/components/ChartPairMatrixTimeLens";
import { ChartBottomDock } from "@/app/features/chart-bottom-dock/ChartBottomDock";
import type { ChartEventLensDockData } from "@/app/features/chart-events/chartEventLensContracts";
import { ChartFmsDock } from "@/app/features/fms-dock/ChartFmsDock";
import { ChartPairMatrixRangeOverlay } from "@/app/features/pair-matrix/ChartPairMatrixRangeOverlay";
import type { ChartPairMatrixContextMarkerData, ChartPairMatrixRangeOverlayData } from "@/app/features/pair-matrix/chartPairMatrixContracts";
import { useChartPanelState } from "@/app/features/chart-viewport/useChartPanelState";
import type { ChartEventOverlayCluster } from "@/app/lib/chartEventOverlay";
import type { BridgeStatus, CalendarEvent, MacroSignalChartSignal } from "@/app/types";

export { clampFmsDockWidth } from "@/app/features/chart-viewport/chartPanelState";
export { clampPairMatrixPanelHeight } from "@/app/features/chart-bottom-dock/ChartBottomDock";
export { ChartPairMatrixRangeOverlay } from "@/app/features/pair-matrix/ChartPairMatrixRangeOverlay";
export type { ChartEventLensDockData } from "@/app/features/chart-events/chartEventLensContracts";
export type {
  ChartPairMatrixContextMarkerData,
  ChartPairMatrixRangeOverlayData,
  PairMatrixRangePreview,
} from "@/app/features/pair-matrix/chartPairMatrixContracts";

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
  calendarOpen: boolean;
  calendarPanel: ReactNode;
  onOpenCalendar: () => void;
  pairMatrixTimeLens: ChartPairMatrixTimeLensData;
  pairMatrixRangeOverlay: ChartPairMatrixRangeOverlayData;
  pairMatrixContextMarkers: ChartPairMatrixContextMarkerData;
  macroBiasAudit: ChartMacroBiasAuditData | null;
  macroBiasRealtime: ChartMacroBiasRealtimeCardData | null;
  macroBiasEnabled: boolean;
  macroBiasLoading: boolean;
  macroBiasHistoricalMatchesVisible: boolean;
  macroBiasHistoricalMatchesCount: number;
  macroBiasHistoricalPatternFilters: Array<{ id: string; label: string; count: number; checked: boolean }>;
  onToggleMacroBiasHistoricalMatches: () => void;
  onToggleMacroBiasHistoricalPattern: (patternId: string) => void;
  onSetAllMacroBiasHistoricalPatterns: (visible: boolean) => void;
  onGoToMacroBiasArrow: (market: string, signal: MacroSignalChartSignal) => void;
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
  calendarOpen,
  calendarPanel,
  onOpenCalendar,
  pairMatrixTimeLens,
  pairMatrixRangeOverlay,
    pairMatrixContextMarkers,
    macroBiasAudit,
    macroBiasRealtime,
    macroBiasEnabled,
    macroBiasLoading,
    macroBiasHistoricalMatchesVisible,
    macroBiasHistoricalMatchesCount,
    macroBiasHistoricalPatternFilters,
    onToggleMacroBiasHistoricalMatches,
    onToggleMacroBiasHistoricalPattern,
    onSetAllMacroBiasHistoricalPatterns,
    onGoToMacroBiasArrow,
    crosshairReadoutRef,
  status,
  overlayCopy,
  reachedBoundary,
}: ChartViewportProps) {
  const fmsDockVisible = macroBiasEnabled || macroBiasRealtime != null || macroBiasAudit != null;
  const lensOpen = Boolean(eventLens?.expanded || eventLensDock.expanded);
  const bottomDockVisible = pairMatrixTimeLens.open || lensOpen || calendarOpen;
  const {
    bottomDockTab,
    fmsDockRef,
    fmsDockTab,
    fmsDockWidth,
    fmsTradeViewState,
    resizeFmsDockFromKeyboard,
    selectFmsAuditTab,
    selectFmsDockTab,
    setBottomDockTab,
    setFmsTradeViewState,
    startFmsDockResize,
    viewportRef,
  } = useChartPanelState({
    auditSignalId: macroBiasAudit?.signal.id ?? null,
    realtimeAvailable: macroBiasRealtime != null,
    pairMatrixOpen: pairMatrixTimeLens.open,
    lensOpen,
    calendarOpen,
  });

  return (
    <>
      <div ref={viewportRef} className="chart-viewport-shell relative group min-h-0 flex-1 overflow-hidden">
        <div className={`chart-viewport-surface h-full overflow-hidden ${fmsDockVisible ? "has-fms-dock" : ""}`}>
          {fmsDockVisible ? (
            <ChartFmsDock
              dockRef={fmsDockRef}
              width={fmsDockWidth}
              tab={fmsDockTab}
              audit={macroBiasAudit}
              realtime={macroBiasRealtime}
              loading={macroBiasLoading}
              historicalMatchesVisible={macroBiasHistoricalMatchesVisible}
              historicalMatchesCount={macroBiasHistoricalMatchesCount}
              historicalPatternFilters={macroBiasHistoricalPatternFilters}
              tradeViewState={fmsTradeViewState}
              onTradeViewStateChange={setFmsTradeViewState}
              onSelectTab={selectFmsDockTab}
              onSelectAuditTab={selectFmsAuditTab}
              onToggleHistoricalMatches={onToggleMacroBiasHistoricalMatches}
              onToggleHistoricalPattern={onToggleMacroBiasHistoricalPattern}
              onSetAllHistoricalPatterns={onSetAllMacroBiasHistoricalPatterns}
              onGoToArrow={onGoToMacroBiasArrow}
              onResizePointerDown={startFmsDockResize}
              onResizeKeyDown={resizeFmsDockFromKeyboard}
            />
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
              <ChartBottomDock
                pairMatrixData={pairMatrixTimeLens}
                eventLens={eventLens}
                eventLensDock={eventLensDock}
                calendarOpen={calendarOpen}
                calendarPanel={calendarPanel}
                activeTab={bottomDockTab}
                onActiveTabChange={setBottomDockTab}
                onOpenCalendar={onOpenCalendar}
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
