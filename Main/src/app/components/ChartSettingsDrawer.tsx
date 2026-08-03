import { Activity, CalendarDays, Gauge, Palette, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import {
  ChartAppearanceSettings,
  type ChartCacheDrawerData,
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
} from "@/app/lib/chartView";

export type ChartDrawerMode = "appearance" | "events" | "replay" | "diagnostics";

interface ChartSettingsDrawerProps {
  open: boolean;
  mode: ChartDrawerMode;
  onModeChange: (mode: ChartDrawerMode) => void;
  onClose: () => void;
  preferences: ChartPreferences;
  onCursorModeChange: (mode: ChartCursorReadoutMode) => void;
  onAppearanceChange: <K extends keyof ChartAppearancePreferences>(key: K, value: ChartAppearancePreferences[K]) => void;
  onEventOverlayChange?: <K extends keyof ChartEventOverlayPreferences>(
    key: K,
    value: ChartEventOverlayPreferences[K],
  ) => void;
  onResetAppearance: () => void;
  replayData?: ChartReplayDrawerData;
  cacheData?: ChartCacheDrawerData;
  debugData?: ChartDebugDrawerData;
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
  onAppearanceChange,
  onEventOverlayChange,
  onResetAppearance,
  replayData,
  cacheData,
  debugData,
  title = "Chart Settings",
  description = "Visuals, event markers, replay defaults, and diagnostics for the active chart.",
}: ChartSettingsDrawerProps) {
  const tabs: Array<{ mode: ChartDrawerMode; label: string; icon: ReactNode }> = [
    { mode: "appearance", label: "Appearance", icon: <Palette size={14} /> },
    ...(onEventOverlayChange ? [{ mode: "events" as const, label: "Events", icon: <CalendarDays size={14} /> }] : []),
    ...(replayData ? [{ mode: "replay" as const, label: "Replay", icon: <Gauge size={14} /> }] : []),
    ...(cacheData || debugData ? [{ mode: "diagnostics" as const, label: "Diagnostics", icon: <Activity size={14} /> }] : []),
  ];
  const activeMode = tabs.some((tab) => tab.mode === mode) ? mode : "appearance";
  const appearance = preferences.appearance;
  const eventScopeLabel = findChartOptionLabel(CHART_EVENT_SCOPE_OPTIONS, preferences.eventOverlay.scope);
  const eventImpactLabel = findChartOptionLabel(CHART_EVENT_IMPACT_OPTIONS, preferences.eventOverlay.impactFilter);
  const gridLabel = appearance.gridVisible ? "Grid visible" : "Grid hidden";

  return (
    <AnimatePresence>
      {open ? (
        <div className="charts-history-overlay" onClick={onClose}>
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="charts-history-drawer chart-settings-wide-drawer"
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
                        ? `${eventScopeLabel}, ${eventImpactLabel}, cap ${preferences.eventOverlay.maxMarkers}`
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

              {activeMode === "appearance" ? (
                <ChartAppearanceSettings
                  appearance={appearance}
                  onAppearanceChange={onAppearanceChange}
                  onResetAppearance={onResetAppearance}
                />
              ) : null}

              {activeMode === "events" && onEventOverlayChange ? (
                <ChartEventSettings
                  eventOverlay={preferences.eventOverlay}
                  onEventOverlayChange={onEventOverlayChange}
                />
              ) : null}

              {activeMode === "replay" && replayData ? (
                <ChartReplaySettings replayData={replayData} />
              ) : null}

              {activeMode === "diagnostics" ? (
                <ChartDiagnosticsSettings cacheData={cacheData} debugData={debugData} />
              ) : null}
            </div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
