import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  FMS_DOCK_DEFAULT_WIDTH,
  clampFmsDockWidth,
  loadFmsDockWidth,
  loadFmsTradeViewState,
  saveFmsDockWidth,
  saveFmsTradeViewState,
  type ChartBottomDockTab,
  type FmsDockPrimaryTab,
  type FmsDockTab,
} from "@/app/features/chart-viewport/chartPanelState";

interface ChartPanelStateOptions {
  auditSignalId: string | null;
  realtimeAvailable: boolean;
  pairMatrixOpen: boolean;
  lensOpen: boolean;
  calendarOpen: boolean;
}

export function useChartPanelState({
  auditSignalId,
  realtimeAvailable,
  pairMatrixOpen,
  lensOpen,
  calendarOpen,
}: ChartPanelStateOptions) {
  const [fmsDockTab, setFmsDockTab] = useState<FmsDockTab>(auditSignalId ? "result" : "trade");
  const fmsDockReturnTabRef = useRef<FmsDockPrimaryTab>("trade");
  const [fmsTradeViewState, setFmsTradeViewState] = useState(loadFmsTradeViewState);
  const [fmsDockWidth, setFmsDockWidth] = useState(loadFmsDockWidth);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fmsDockRef = useRef<HTMLElement | null>(null);
  const [bottomDockTab, setBottomDockTab] = useState<ChartBottomDockTab>(lensOpen ? "lens" : "matrix");
  const previousMatrixOpenRef = useRef(pairMatrixOpen);
  const previousLensOpenRef = useRef(lensOpen);
  const previousCalendarOpenRef = useRef(calendarOpen);

  useEffect(() => {
    if (auditSignalId) {
      setFmsDockTab((current) => {
        if (current !== "result") fmsDockReturnTabRef.current = current;
        return "result";
      });
      return;
    }
    setFmsDockTab((current) => current === "result" ? fmsDockReturnTabRef.current : current);
  }, [auditSignalId, realtimeAvailable]);

  useEffect(() => saveFmsTradeViewState(fmsTradeViewState), [fmsTradeViewState]);

  useEffect(() => {
    if (pairMatrixOpen && !previousMatrixOpenRef.current) setBottomDockTab("matrix");
    previousMatrixOpenRef.current = pairMatrixOpen;
  }, [pairMatrixOpen]);

  useEffect(() => {
    if (lensOpen && !previousLensOpenRef.current) setBottomDockTab("lens");
    previousLensOpenRef.current = lensOpen;
  }, [lensOpen]);

  useEffect(() => {
    if (calendarOpen && !previousCalendarOpenRef.current) setBottomDockTab("calendar");
    previousCalendarOpenRef.current = calendarOpen;
  }, [calendarOpen]);

  useEffect(() => {
    if (bottomDockTab === "matrix" && !pairMatrixOpen) {
      if (lensOpen) setBottomDockTab("lens");
      else if (calendarOpen) setBottomDockTab("calendar");
    }
    if (bottomDockTab === "lens" && !lensOpen) {
      if (pairMatrixOpen) setBottomDockTab("matrix");
      else if (calendarOpen) setBottomDockTab("calendar");
    }
    if (bottomDockTab === "calendar" && !calendarOpen) {
      if (pairMatrixOpen) setBottomDockTab("matrix");
      else if (lensOpen) setBottomDockTab("lens");
    }
  }, [bottomDockTab, calendarOpen, lensOpen, pairMatrixOpen]);

  const selectFmsDockTab = useCallback((tab: FmsDockPrimaryTab) => {
    fmsDockReturnTabRef.current = tab;
    setFmsDockTab(tab);
  }, []);

  const selectFmsAuditTab = useCallback(() => setFmsDockTab("result"), []);

  const startFmsDockResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
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
      saveFmsDockWidth(previewWidth);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }, [fmsDockWidth]);

  const resizeFmsDockFromKeyboard = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home") return;
    event.preventDefault();
    const workspaceWidth = viewportRef.current?.getBoundingClientRect().width ?? window.innerWidth;
    const requested = event.key === "Home"
      ? FMS_DOCK_DEFAULT_WIDTH
      : fmsDockWidth + (event.key === "ArrowLeft" ? -24 : 24);
    const nextWidth = clampFmsDockWidth(requested, workspaceWidth);
    setFmsDockWidth(nextWidth);
    saveFmsDockWidth(nextWidth);
  }, [fmsDockWidth]);

  return {
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
  };
}
