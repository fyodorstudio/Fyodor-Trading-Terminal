import { Activity, HardDrive, MousePointer2, Palette, RotateCcw, SlidersHorizontal, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import type { ChartAppearancePreferences, ChartCursorReadoutMode, ChartPreferences } from "@/app/lib/chartView";

export type ChartDrawerMode = "appearance" | "cursor" | "cache";

const CURSOR_MODE_OPTIONS: Array<{ id: ChartCursorReadoutMode; label: string; description: string }> = [
  { id: "both", label: "Both", description: "Show the exact pointer price and the candle-sticky close." },
  { id: "true_cursor", label: "Exact", description: "Show the exact price under the pointer." },
  { id: "nearest_candle", label: "Sticky", description: "Stick the readout and crosshair to the nearest candle close." },
];

interface ChartCacheDrawerData {
  selectedSymbol: string;
  timeframe: string;
  candleCount: number;
  oldestLabel: string;
  latestLabel: string;
  historyState: string;
  streamLabel: string;
  boundaryLabel: string;
  onClearCache: () => void;
}

interface ChartSettingsDrawerProps {
  open: boolean;
  mode: ChartDrawerMode;
  onModeChange: (mode: ChartDrawerMode) => void;
  onClose: () => void;
  preferences: ChartPreferences;
  onCursorModeChange: (mode: ChartCursorReadoutMode) => void;
  onAppearanceChange: <K extends keyof ChartAppearancePreferences>(key: K, value: ChartAppearancePreferences[K]) => void;
  onResetAppearance: () => void;
  cacheData?: ChartCacheDrawerData;
  title?: string;
  description?: string;
}

function ChartColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="chart-color-field">
      <span>{label}</span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ChartDrawerMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ChartSettingsDrawer({
  open,
  mode,
  onModeChange,
  onClose,
  preferences,
  onCursorModeChange,
  onAppearanceChange,
  onResetAppearance,
  cacheData,
  title = "Chart Settings",
  description = "Cursor behavior, visual appearance, and local chart cache for the active chart.",
}: ChartSettingsDrawerProps) {
  const tabs: Array<{ mode: ChartDrawerMode; label: string; icon: ReactNode }> = [
    { mode: "appearance", label: "Appearance", icon: <Palette size={14} /> },
    { mode: "cursor", label: "Cursor", icon: <MousePointer2 size={14} /> },
    ...(cacheData ? [{ mode: "cache" as const, label: "Data cache", icon: <HardDrive size={14} /> }] : []),
  ];
  const activeMode = tabs.some((tab) => tab.mode === mode) ? mode : "appearance";
  const appearance = preferences.appearance;

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
                <div className="chart-settings-grid">
                  <section className="charts-history-section chart-drawer-card">
                    <h3>
                      <Palette size={14} />
                      Surface
                    </h3>
                    <div className="chart-appearance-grid">
                      <ChartColorField
                        label="Chart background"
                        value={appearance.backgroundColor}
                        onChange={(value) => onAppearanceChange("backgroundColor", value)}
                      />
                      <ChartColorField
                        label="Text / axis"
                        value={appearance.textColor}
                        onChange={(value) => onAppearanceChange("textColor", value)}
                      />
                      <ChartColorField
                        label="Grid color"
                        value={appearance.gridColor}
                        onChange={(value) => onAppearanceChange("gridColor", value)}
                      />
                      <label className="chart-settings-check chart-settings-check-card">
                        <input
                          type="checkbox"
                          checked={appearance.gridVisible}
                          onChange={(event) => onAppearanceChange("gridVisible", event.target.checked)}
                        />
                        <span>Show chart grid</span>
                      </label>
                    </div>
                  </section>

                  <section className="charts-history-section chart-drawer-card">
                    <h3>
                      <Palette size={14} />
                      Candles
                    </h3>
                    <div className="chart-appearance-grid">
                      <ChartColorField
                        label="Bullish candle"
                        value={appearance.bullishColor}
                        onChange={(value) => onAppearanceChange("bullishColor", value)}
                      />
                      <ChartColorField
                        label="Bearish candle"
                        value={appearance.bearishColor}
                        onChange={(value) => onAppearanceChange("bearishColor", value)}
                      />
                      <ChartColorField
                        label="Neutral wick"
                        value={appearance.neutralWickColor}
                        onChange={(value) => onAppearanceChange("neutralWickColor", value)}
                      />
                      <div className="chart-settings-row">
                        <span>Wick color</span>
                        <div className="chart-mini-toggle">
                          <button
                            type="button"
                            className={appearance.wickMode === "match" ? "is-active" : ""}
                            onClick={() => onAppearanceChange("wickMode", "match")}
                          >
                            Match candle
                          </button>
                          <button
                            type="button"
                            className={appearance.wickMode === "neutral" ? "is-active" : ""}
                            onClick={() => onAppearanceChange("wickMode", "neutral")}
                          >
                            Neutral
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="charts-history-section chart-drawer-card">
                    <h3>
                      <SlidersHorizontal size={14} />
                      Guides
                    </h3>
                    <div className="chart-appearance-grid">
                      <ChartColorField
                        label="Crosshair label"
                        value={appearance.crosshairColor}
                        onChange={(value) => onAppearanceChange("crosshairColor", value)}
                      />
                      <ChartColorField
                        label="Current price line"
                        value={appearance.currentPriceLineColor}
                        onChange={(value) => onAppearanceChange("currentPriceLineColor", value)}
                      />
                    </div>
                    <div className="chart-drawer-actions">
                      <button type="button" className="charts-history-reset" onClick={onResetAppearance}>
                        <RotateCcw size={14} />
                        Reset appearance
                      </button>
                    </div>
                  </section>
                </div>
              ) : null}

              {activeMode === "cursor" ? (
                <section className="charts-history-section chart-drawer-card">
                  <h3>
                    <MousePointer2 size={14} />
                    Cursor Readout
                  </h3>
                  <p>Choose how the price readout behaves when you inspect candles.</p>
                  <div className="chart-drawer-segmented">
                    {CURSOR_MODE_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={preferences.cursorReadoutMode === option.id ? "is-active" : ""}
                        onClick={() => onCursorModeChange(option.id)}
                      >
                        <span>{option.label}</span>
                        <small>{option.description}</small>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {activeMode === "cache" && cacheData ? (
                <div className="chart-settings-grid">
                  <section className="charts-history-section chart-drawer-card">
                    <h3>
                      <HardDrive size={14} />
                      Local Candle Cache
                    </h3>
                    <p>
                      Cached candles are scoped to <strong>{cacheData.selectedSymbol} {cacheData.timeframe}</strong>. They keep the chart readable while MT5 refreshes fresh broker history.
                    </p>
                    <div className="chart-cache-grid chart-cache-grid-wide">
                      <ChartDrawerMetric label="Symbol" value={cacheData.selectedSymbol} />
                      <ChartDrawerMetric label="Timeframe" value={cacheData.timeframe} />
                      <ChartDrawerMetric label="Candles" value={cacheData.candleCount} />
                      <ChartDrawerMetric label="Oldest cached candle" value={cacheData.oldestLabel} />
                      <ChartDrawerMetric label="Latest cached candle" value={cacheData.latestLabel} />
                      <ChartDrawerMetric label="Boundary" value={cacheData.boundaryLabel} />
                    </div>
                    <button type="button" className="chart-danger-button" onClick={cacheData.onClearCache}>
                      <Trash2 size={14} />
                      Clear cached candles for this symbol/timeframe
                    </button>
                  </section>

                  <section className="charts-history-section chart-drawer-card">
                    <h3>
                      <Activity size={14} />
                      Diagnostics
                    </h3>
                    <div className="chart-diagnostics-list">
                      <ChartDrawerMetric label="History state" value={cacheData.historyState} />
                      <ChartDrawerMetric label="Stream" value={cacheData.streamLabel} />
                    </div>
                  </section>
                </div>
              ) : null}
            </div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
