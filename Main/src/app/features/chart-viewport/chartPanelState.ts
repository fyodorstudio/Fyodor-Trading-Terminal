import { DEFAULT_FMS_TRADE_VIEW_STATE, type FmsTradeViewState } from "@/app/components/ChartFmsActionCard";
import { getChartDockDefinition } from "@/app/features/chart-viewport/chartDockRegistry";

const FMS_DOCK_DEFINITION = getChartDockDefinition("fms");
export const FMS_DOCK_MIN_WIDTH = FMS_DOCK_DEFINITION.minimumSize;
export const FMS_DOCK_DEFAULT_WIDTH = FMS_DOCK_DEFINITION.defaultSize;
export const FMS_DOCK_WIDTH_KEY = "fyodor.charts.fms-dock-width";
export const FMS_TRADE_STATE_KEY = "fyodor.charts.fms-trade-state";

export type FmsDockPrimaryTab = "trade" | "journal" | "setups";
export type FmsDockTab = FmsDockPrimaryTab | "result";
export type ChartBottomDockTab = "matrix" | "lens" | "calendar";

export function loadFmsDockWidth(): number {
  try {
    const saved = Number(window.localStorage.getItem(FMS_DOCK_WIDTH_KEY));
    return Number.isFinite(saved) ? Math.max(FMS_DOCK_MIN_WIDTH, saved) : FMS_DOCK_DEFAULT_WIDTH;
  } catch {
    return FMS_DOCK_DEFAULT_WIDTH;
  }
}

export function saveFmsDockWidth(width: number): void {
  try {
    window.localStorage.setItem(FMS_DOCK_WIDTH_KEY, String(width));
  } catch {
    // Panel preferences are optional; runtime layout remains usable without storage.
  }
}

export function loadFmsTradeViewState(): FmsTradeViewState {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(FMS_TRADE_STATE_KEY) ?? "null") as Partial<FmsTradeViewState> | null;
    const activeView = parsed?.activeView;
    if (!parsed || (activeView !== "next" && activeView !== "current" && activeView !== "recent")) {
      return DEFAULT_FMS_TRADE_VIEW_STATE;
    }
    return {
      ...DEFAULT_FMS_TRADE_VIEW_STATE,
      ...parsed,
      activeView,
      scroll: { ...DEFAULT_FMS_TRADE_VIEW_STATE.scroll, ...parsed.scroll },
    };
  } catch {
    return DEFAULT_FMS_TRADE_VIEW_STATE;
  }
}

export function saveFmsTradeViewState(state: FmsTradeViewState): void {
  try {
    window.sessionStorage.setItem(FMS_TRADE_STATE_KEY, JSON.stringify(state));
  } catch {
    // Session continuity is optional and must never block the Trade dock.
  }
}

export function clampFmsDockWidth(requestedWidth: number, workspaceWidth: number): number {
  const maximum = Math.max(FMS_DOCK_MIN_WIDTH, Math.min(720, workspaceWidth * .62));
  return Math.round(Math.min(maximum, Math.max(FMS_DOCK_MIN_WIDTH, requestedWidth)));
}
