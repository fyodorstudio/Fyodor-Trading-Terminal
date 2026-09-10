import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { CalendarDays, ChevronDown, Settings2 } from "lucide-react";
import { ChartEventLens, type ChartEventLensData } from "@/app/components/ChartEventLens";
import { ChartPairMatrixTimeLens, type ChartPairMatrixTimeLensData } from "@/app/components/ChartPairMatrixTimeLens";
import type { ChartEventLensDockData } from "@/app/features/chart-events/chartEventLensContracts";
import type { ChartBottomDockTab } from "@/app/features/chart-viewport/chartPanelState";
import { getChartDockDefinition } from "@/app/features/chart-viewport/chartDockRegistry";
import { usePairMatrixHoverAnchor } from "@/app/hooks/usePairMatrixHoverAnchor";

const PAIR_MATRIX_PANEL_MIN_HEIGHT = getChartDockDefinition("context").minimumSize;
const PAIR_MATRIX_CHART_MIN_HEIGHT = 220;

export function clampPairMatrixPanelHeight(requestedHeight: number, workspaceHeight: number): number {
  return Math.round(Math.min(
    Math.max(PAIR_MATRIX_PANEL_MIN_HEIGHT, workspaceHeight - PAIR_MATRIX_CHART_MIN_HEIGHT),
    Math.max(PAIR_MATRIX_PANEL_MIN_HEIGHT, requestedHeight),
  ));
}

interface ChartBottomDockProps {
  pairMatrixData: ChartPairMatrixTimeLensData;
  eventLens: ChartEventLensData | null;
  eventLensDock: ChartEventLensDockData;
  calendarOpen: boolean;
  calendarPanel: ReactNode;
  activeTab: ChartBottomDockTab;
  onActiveTabChange: (tab: ChartBottomDockTab) => void;
  onOpenCalendar: () => void;
}

export function ChartBottomDock({
  pairMatrixData,
  eventLens,
  eventLensDock,
  calendarOpen,
  calendarPanel,
  activeTab,
  onActiveTabChange,
  onOpenCalendar,
}: ChartBottomDockProps) {
  const shellRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingHeightRef = useRef<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const hoverAnchor = usePairMatrixHoverAnchor(pairMatrixData.hasLockedRange ? null : pairMatrixData.cursorRuntime?.hover ?? null);
  const resolvedData = useMemo(
    () => pairMatrixData.hasLockedRange || !pairMatrixData.cursorRuntime
      ? pairMatrixData
      : pairMatrixData.cursorRuntime.resolve(hoverAnchor),
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
      if (pendingHeightRef.current != null && shellRef.current) {
        shellRef.current.style.height = `${pendingHeightRef.current}px`;
      }
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
          dragRef.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startHeight: shellRef.current?.offsetHeight ?? PAIR_MATRIX_PANEL_MIN_HEIGHT,
          };
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
        <button
          type="button"
          className={activeTab === "calendar" ? "is-active" : ""}
          aria-selected={activeTab === "calendar"}
          onClick={() => {
            onActiveTabChange("calendar");
            if (!calendarOpen) onOpenCalendar();
          }}
        >Calendar</button>
      </nav>
      <div className="chart-bottom-dock-content">
        {activeTab === "matrix" && pairMatrixData.open ? <ChartPairMatrixTimeLens data={resolvedData} /> : null}
        {activeTab === "lens" && eventLens?.expanded ? <ChartEventLens data={eventLens} /> : null}
        {activeTab === "lens" && !eventLens && eventLensDock.expanded ? <ChartEventLensDock data={eventLensDock} /> : null}
        {activeTab === "calendar" && calendarOpen ? calendarPanel : null}
      </div>
    </section>
  );
}

function ChartEventLensDock({ data }: { data: ChartEventLensDockData }) {
  if (!data.visible || !data.expanded) return null;

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
