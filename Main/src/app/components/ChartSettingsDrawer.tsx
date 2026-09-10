import { Activity, Database, Layers, MousePointer2, Palette, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import {
  ChartAppearanceSettings,
  type ChartCacheDrawerData,
  ChartCursorSettings,
  ChartDataSettings,
  ChartDiagnosticsSettings,
  type ChartDebugDrawerData,
  ChartEventSettings,
  ChartReplaySettings,
  type ChartReplayDrawerData,
  CHART_EVENT_IMPACT_OPTIONS,
  CHART_EVENT_SCOPE_OPTIONS,
  findChartOptionLabel,
} from "@/app/components/ChartSettingsSections";
import type {
  ChartAppearancePreferences,
  ChartCursorReadoutMode,
  ChartEventOverlayPreferences,
  ChartPreferences,
  ChartDisplayTimeMode,
} from "@/app/lib/chartView";
import { getDisplayTimezoneOptions } from "@/app/lib/timezoneDisplay";
import { getChartDockDefinition } from "@/app/features/chart-viewport/chartDockRegistry";

export type ChartDrawerMode = "chart" | "layers" | "selected" | "data" | "diagnostics";

export interface ChartSelectedDrawerData {
  kind: string;
  title: string;
  rows: Array<{ field: string; value: string; details?: string }>;
}

export interface ChartLayerDrawerData {
  rows: Array<{ id: string; label: string; visible: boolean; details: string; onToggle?: () => void }>;
}

interface ChartSettingsDrawerProps {
  open: boolean;
  mode: ChartDrawerMode;
  onModeChange: (mode: ChartDrawerMode) => void;
  onClose: () => void;
  preferences: ChartPreferences;
  onCursorModeChange: (mode: ChartCursorReadoutMode) => void;
  onPreserveZoomChange: (preserve: boolean) => void;
  onDefaultFocusBarsChange: (bars: number) => void;
  onAppearanceChange: <K extends keyof ChartAppearancePreferences>(key: K, value: ChartAppearancePreferences[K]) => void;
  onEventOverlayChange?: <K extends keyof ChartEventOverlayPreferences>(
    key: K,
    value: ChartEventOverlayPreferences[K],
  ) => void;
  onResetAppearance: () => void;
  displayTimeMode?: ChartDisplayTimeMode;
  onDisplayTimeModeChange?: (mode: ChartDisplayTimeMode) => void;
  placement?: "left" | "right";
  onPlacementChange?: (placement: "left" | "right") => void;
  onResetPanelLayout?: () => void;
  replayData?: ChartReplayDrawerData;
  selectedData?: ChartSelectedDrawerData;
  layerData?: ChartLayerDrawerData;
  cacheData?: ChartCacheDrawerData;
  debugData?: ChartDebugDrawerData;
  loadedUpcomingEventCount?: number;
  title?: string;
  description?: string;
}

export function ChartSettingsDrawer({
  open,
  mode,
  onModeChange,
  onClose,
  preferences,
  onCursorModeChange,
  onPreserveZoomChange,
  onDefaultFocusBarsChange,
  onAppearanceChange,
  onEventOverlayChange,
  onResetAppearance,
  displayTimeMode,
  onDisplayTimeModeChange,
  placement = "right",
  onPlacementChange,
  onResetPanelLayout,
  replayData,
  selectedData,
  layerData,
  cacheData,
  debugData,
  loadedUpcomingEventCount = 0,
  title = "Chart Inspector",
  description = "Chart, layers, selected-item controls, source data, and diagnostics for the active chart.",
}: ChartSettingsDrawerProps) {
  const inspectorDefinition = getChartDockDefinition("inspector");
  const tabs: Array<{ mode: ChartDrawerMode; label: string; icon: ReactNode }> = [
    { mode: "chart", label: "Chart", icon: <Palette size={14} /> },
    ...(onEventOverlayChange ? [{ mode: "layers" as const, label: "Layers", icon: <Layers size={14} /> }] : []),
    ...(replayData || selectedData ? [{ mode: "selected" as const, label: "Selected", icon: <MousePointer2 size={14} /> }] : []),
    ...(cacheData ? [{ mode: "data" as const, label: "Data", icon: <Database size={14} /> }] : []),
    ...(debugData ? [{ mode: "diagnostics" as const, label: "Diagnostics", icon: <Activity size={14} /> }] : []),
  ];
  const activeMode = tabs.some((tab) => tab.mode === mode) ? mode : "chart";
  const appearance = preferences.appearance;
  const eventScopeLabel = findChartOptionLabel(CHART_EVENT_SCOPE_OPTIONS, preferences.eventOverlay.scope);
  const eventImpactLabel = findChartOptionLabel(CHART_EVENT_IMPACT_OPTIONS, preferences.eventOverlay.impactFilter);
  const gridLabel = appearance.gridVisible ? "Grid visible" : "Grid hidden";

  return (
    <AnimatePresence>
      {open ? (
        <div className={`charts-history-overlay ${placement === "left" ? "is-left" : "is-right"}`} onClick={onClose}>
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: placement === "left" ? -24 : 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: placement === "left" ? -24 : 24, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={`charts-history-drawer chart-settings-wide-drawer ${placement === "left" ? "is-left" : "is-right"}`}
            style={{ width: `min(${inspectorDefinition.defaultSize}px, 100%)`, minWidth: `min(${inspectorDefinition.minimumSize}px, 100%)` }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="charts-history-head">
              <div>
                <h2>{title}</h2>
                <p>{description}</p>
              </div>
              <button type="button" className="charts-history-close" onClick={onClose} aria-label="Close chart settings">
                <X size={18} />
              </button>
            </div>

            <div className="charts-history-body">
              <div className="chart-settings-summary" aria-label="Current chart settings summary">
                <div>
                  <span>Surface</span>
                  <strong>{appearance.backgroundColor} / {gridLabel}</strong>
                </div>
                {onEventOverlayChange ? (
                  <div>
                    <span>Events</span>
                    <strong>
                      {preferences.eventOverlay.visible
                        ? `${eventScopeLabel}, ${eventImpactLabel}, cap ${preferences.eventOverlay.maxMarkers}, next ${preferences.eventOverlay.futureMarkerLimit}`
                        : "Hidden"}
                    </strong>
                  </div>
                ) : null}
                {replayData ? (
                  <div>
                    <span>Replay</span>
                    <strong>{replayData.defaultSpeed}x default / {replayData.stepCandles} candle step</strong>
                  </div>
                ) : null}
                {cacheData || debugData ? (
                  <div>
                    <span>Diagnostics</span>
                    <strong>{cacheData ? `${cacheData.candleCount} candles` : "No cache"} / {debugData?.debugLines.length ?? 0} logs</strong>
                  </div>
                ) : null}
              </div>

              <div className="chart-drawer-tabs" aria-label="Chart drawer view">
                {tabs.map((tab) => (
                  <button
                    key={tab.mode}
                    type="button"
                    className={activeMode === tab.mode ? "is-active" : ""}
                    onClick={() => onModeChange(tab.mode)}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeMode === "chart" ? (
                <div className="chart-settings-grid">
                  <section className="charts-history-section chart-drawer-card chart-selected-record"><h3><Palette size={14} />Chart behavior</h3><table><tbody>
                    <tr><th>Time display</th><td>{displayTimeMode && onDisplayTimeModeChange ? <select value={displayTimeMode} onChange={(event) => onDisplayTimeModeChange(event.target.value as ChartDisplayTimeMode)}>{getDisplayTimezoneOptions(new Date()).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select> : "Controlled by the chart workbar"}</td><td>Changes labels only; candle timestamps remain unchanged.</td></tr>
                    <tr><th>Price scale</th><td>Automatic</td><td>Auto-fits the newly loaded market while horizontal zoom may be preserved.</td></tr>
                    <tr><th>Candle behavior</th><td>{preferences.preserveZoomOnMarketChange ? "Preserve horizontal zoom" : "Use default refocus"}</td><td>{preferences.defaultFocusBars} candles on refocus.</td></tr>
                    <tr><th>Inspector placement</th><td>{onPlacementChange ? <select value={placement} onChange={(event) => onPlacementChange(event.target.value as "left" | "right")}><option value="right">Right</option><option value="left">Left</option></select> : placement === "left" ? "Left" : "Right"}</td><td>{onResetPanelLayout ? <button type="button" className="charts-history-reset" onClick={onResetPanelLayout}>Reset panel layout</button> : "Controlled placement"}</td></tr>
                  </tbody></table></section>
                  <ChartAppearanceSettings
                    appearance={appearance}
                    preserveZoomOnMarketChange={preferences.preserveZoomOnMarketChange}
                    defaultFocusBars={preferences.defaultFocusBars}
                    onAppearanceChange={onAppearanceChange}
                    onPreserveZoomChange={onPreserveZoomChange}
                    onDefaultFocusBarsChange={onDefaultFocusBarsChange}
                    onResetAppearance={onResetAppearance}
                  />
                  <ChartCursorSettings cursorReadoutMode={preferences.cursorReadoutMode} onCursorModeChange={onCursorModeChange} />
                </div>
              ) : null}

              {activeMode === "layers" && onEventOverlayChange ? (
                <div className="chart-settings-grid">
                  {layerData ? <section className="charts-history-section chart-drawer-card chart-selected-record"><h3><Layers size={14} />Chart layers</h3><table><thead><tr><th>Layer</th><th>Visible</th><th>Details</th></tr></thead><tbody>{layerData.rows.map((row) => <tr key={row.id}><th>{row.label}</th><td>{row.onToggle ? <label className="chart-settings-check"><input type="checkbox" checked={row.visible} onChange={row.onToggle} /><span>{row.visible ? "Shown" : "Hidden"}</span></label> : row.visible ? "Shown" : "Hidden"}</td><td>{row.details}</td></tr>)}</tbody></table></section> : null}
                  <ChartEventSettings
                    eventOverlay={preferences.eventOverlay}
                    loadedUpcomingCount={loadedUpcomingEventCount}
                    onEventOverlayChange={onEventOverlayChange}
                  />
                </div>
              ) : null}

              {activeMode === "selected" ? <div className="chart-settings-grid">
                {selectedData ? <section className="charts-history-section chart-drawer-card chart-selected-record"><h3><MousePointer2 size={14} />{selectedData.kind}: {selectedData.title}</h3><table><thead><tr><th>Field</th><th>Value</th><th>Details</th></tr></thead><tbody>{selectedData.rows.map((row) => <tr key={row.field}><th>{row.field}</th><td>{row.value}</td><td>{row.details ?? ""}</td></tr>)}</tbody></table></section> : <section className="charts-history-section chart-drawer-card"><h3><MousePointer2 size={14} />Selected</h3><p>No candle, arrow, event, or price level is selected.</p></section>}
                {replayData ? <ChartReplaySettings replayData={replayData} /> : null}
              </div> : null}

              {activeMode === "data" ? <ChartDataSettings cacheData={cacheData} /> : null}

              {activeMode === "diagnostics" ? (
                <ChartDiagnosticsSettings debugData={debugData} />
              ) : null}
            </div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
