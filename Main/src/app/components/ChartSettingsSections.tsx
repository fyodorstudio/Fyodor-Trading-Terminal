import { Activity, CalendarDays, Gauge, HardDrive, MousePointer2, Palette, RotateCcw, SlidersHorizontal, Trash2 } from "lucide-react";
import type {
  ChartAppearancePreferences,
  ChartCursorReadoutMode,
  ChartEventOverlayImpactFilter,
  ChartEventOverlayPreferences,
} from "@/app/lib/chartView";

export const CHART_CURSOR_MODE_OPTIONS: Array<{ id: ChartCursorReadoutMode; label: string; description: string }> = [
  { id: "both", label: "Crosshair", description: "Free crosshair movement with both pointer and candle readouts." },
  { id: "nearest_candle", label: "Sticky", description: "Stick the readout and crosshair to the nearest candle close." },
];

export const CHART_EVENT_SCOPE_OPTIONS: Array<{
  id: ChartEventOverlayPreferences["scope"];
  label: string;
  description: string;
}> = [
  { id: "relevant", label: "Selected pair", description: "Only events for the selected symbol currencies, such as EUR and USD on EURUSD." },
  { id: "all", label: "All currencies", description: "All loaded currencies, still limited by the impact filter below." },
];

export const CHART_EVENT_IMPACT_OPTIONS: Array<{
  id: ChartEventOverlayImpactFilter;
  label: string;
  description: string;
}> = [
  { id: "high", label: "High only", description: "Cleanest default for H4/D1 and dense calendar history." },
  { id: "high_medium", label: "High + medium", description: "Adds medium events when you want more calendar context." },
  { id: "all", label: "All impacts", description: "Shows low-impact rows too. Use with a low marker cap." },
];

const EVENT_MARKER_LIMIT_OPTIONS = [40, 80, 120, 200, 300];
const FUTURE_MARKER_LIMIT_OPTIONS = [0, 4, 8, 12, 20, 40];

export interface ChartCacheDrawerData {
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

export interface ChartReplayDrawerData {
  defaultSpeed: number;
  stepCandles: number;
  futureCandleOpacity: number;
  speedOptions: number[];
  stepOptions: number[];
  onDefaultSpeedChange: (speed: number) => void;
  onStepCandlesChange: (count: number) => void;
  onFutureCandleOpacityChange: (opacity: number) => void;
}

export interface ChartDebugDrawerData {
  debugLines: string[];
}

export function findChartOptionLabel<T extends string>(options: Array<{ id: T; label: string }>, id: T): string {
  return options.find((option) => option.id === id)?.label ?? id;
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

export function ChartAppearanceSettings({
  appearance,
  onAppearanceChange,
  onResetAppearance,
}: {
  appearance: ChartAppearancePreferences;
  onAppearanceChange: <K extends keyof ChartAppearancePreferences>(key: K, value: ChartAppearancePreferences[K]) => void;
  onResetAppearance: () => void;
}) {
  return (
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
  );
}

export function ChartCursorSettings({
  cursorReadoutMode,
  onCursorModeChange,
}: {
  cursorReadoutMode: ChartCursorReadoutMode;
  onCursorModeChange: (mode: ChartCursorReadoutMode) => void;
}) {
  return (
    <section className="charts-history-section chart-drawer-card">
      <h3>
        <MousePointer2 size={14} />
        Cursor Readout
      </h3>
      <p>Choose how the price readout behaves when you inspect candles.</p>
      <div className="chart-drawer-segmented">
        {CHART_CURSOR_MODE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={cursorReadoutMode === option.id ? "is-active" : ""}
            onClick={() => onCursorModeChange(option.id)}
          >
            <span>{option.label}</span>
            <small>{option.description}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

export function ChartEventSettings({
  eventOverlay,
  loadedUpcomingCount,
  onEventOverlayChange,
}: {
  eventOverlay: ChartEventOverlayPreferences;
  loadedUpcomingCount?: number;
  onEventOverlayChange: <K extends keyof ChartEventOverlayPreferences>(
    key: K,
    value: ChartEventOverlayPreferences[K],
  ) => void;
}) {
  return (
    <section className="charts-history-section chart-drawer-card">
      <h3>
        <CalendarDays size={14} />
        Events
      </h3>
      <label className="chart-settings-check chart-settings-check-card chart-settings-check-strong">
        <input
          type="checkbox"
          checked={eventOverlay.visible}
          onChange={(event) => onEventOverlayChange("visible", event.target.checked)}
        />
        <span>Show event rail</span>
      </label>
      <div className="chart-event-settings-grid">
        <label className="chart-settings-row">
          <span>Impact</span>
          <select
            value={eventOverlay.impactFilter}
            onChange={(event) => onEventOverlayChange("impactFilter", event.target.value as ChartEventOverlayImpactFilter)}
          >
            {CHART_EVENT_IMPACT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="chart-settings-row">
          <span>Currency scope</span>
          <select
            value={eventOverlay.scope}
            onChange={(event) => onEventOverlayChange("scope", event.target.value as ChartEventOverlayPreferences["scope"])}
          >
            {CHART_EVENT_SCOPE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="chart-settings-row">
          <span>Max markers</span>
          <select
            value={eventOverlay.maxMarkers}
            onChange={(event) => onEventOverlayChange("maxMarkers", Number(event.target.value))}
          >
            {EVENT_MARKER_LIMIT_OPTIONS.map((limit) => (
              <option key={limit} value={limit}>
                {limit}
              </option>
            ))}
          </select>
        </label>
        <div className="chart-settings-row">
          <span>Loaded upcoming events</span>
          <strong>{loadedUpcomingCount ?? 0}</strong>
        </div>
        <label className="chart-settings-row">
          <span>Show next scheduled</span>
          <select
            value={eventOverlay.futureMarkerLimit}
            onChange={(event) => onEventOverlayChange("futureMarkerLimit", Number(event.target.value))}
          >
            {FUTURE_MARKER_LIMIT_OPTIONS.map((limit) => (
              <option key={limit} value={limit}>
                {limit}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="chart-event-settings-note">
        Loaded broker/MT5 calendar rows only. Missing old markers mean the rows are not loaded.
      </p>
    </section>
  );
}

export function ChartReplaySettings({ replayData }: { replayData: ChartReplayDrawerData }) {
  return (
    <section className="charts-history-section chart-drawer-card">
      <h3>
        <Gauge size={14} />
        Replay
      </h3>
      <div className="chart-event-settings-grid">
        <label className="chart-settings-row">
          <span>Default speed</span>
          <select value={replayData.defaultSpeed} onChange={(event) => replayData.onDefaultSpeedChange(Number(event.target.value))}>
            {replayData.speedOptions.map((speed) => (
              <option key={speed} value={speed}>{speed}x</option>
            ))}
          </select>
        </label>
        <label className="chart-settings-row">
          <span>Step size</span>
          <select value={replayData.stepCandles} onChange={(event) => replayData.onStepCandlesChange(Number(event.target.value))}>
            {replayData.stepOptions.map((count) => (
              <option key={count} value={count}>{count} candle{count === 1 ? "" : "s"}</option>
            ))}
          </select>
        </label>
        <label className="chart-settings-row chart-settings-row-stacked">
          <span>Future candle opacity</span>
          <input
            type="range"
            min={15}
            max={100}
            step={5}
            value={Math.round(replayData.futureCandleOpacity * 100)}
            onChange={(event) => replayData.onFutureCandleOpacityChange(Number(event.target.value) / 100)}
          />
          <small>{Math.round(replayData.futureCandleOpacity * 100)}% while replay is active</small>
        </label>
      </div>
      <p className="chart-event-settings-note">
        Replay uses candles already loaded in the current chart cache.
      </p>
    </section>
  );
}

export function ChartDiagnosticsSettings({
  cacheData,
  debugData,
}: {
  cacheData?: ChartCacheDrawerData;
  debugData?: ChartDebugDrawerData;
}) {
  return (
    <div className="chart-settings-grid">
      {cacheData ? (
        <section className="charts-history-section chart-drawer-card">
          <h3>
            <HardDrive size={14} />
            Local Candle Cache
          </h3>
          <div className="chart-cache-grid chart-cache-grid-wide">
            <ChartDrawerMetric label="Symbol" value={cacheData.selectedSymbol} />
            <ChartDrawerMetric label="Timeframe" value={cacheData.timeframe} />
            <ChartDrawerMetric label="Candles" value={cacheData.candleCount} />
            <ChartDrawerMetric label="Oldest cached candle" value={cacheData.oldestLabel} />
            <ChartDrawerMetric label="Latest cached candle" value={cacheData.latestLabel} />
            <ChartDrawerMetric label="Boundary" value={cacheData.boundaryLabel} />
            <ChartDrawerMetric label="History state" value={cacheData.historyState} />
            <ChartDrawerMetric label="Stream" value={cacheData.streamLabel} />
          </div>
          <button type="button" className="chart-danger-button" onClick={cacheData.onClearCache}>
            <Trash2 size={14} />
            Clear cached candles for this symbol/timeframe
          </button>
        </section>
      ) : null}

      {debugData ? (
        <section className="charts-history-section chart-drawer-card">
          <h3>
            <Activity size={14} />
            Terminal Console
          </h3>
          <div className="chart-console-diagnostics">
            {debugData.debugLines.length === 0 ? (
              <div className="chart-console-empty">Awaiting first market event...</div>
            ) : (
              debugData.debugLines.map((line, index) => <div key={index}>{line}</div>)
            )}
          </div>
          <button
            type="button"
            className="charts-history-reset"
            onClick={() => void navigator.clipboard.writeText(debugData.debugLines.join("\n") || "(empty)")}
          >
            Copy logs
          </button>
        </section>
      ) : null}
    </div>
  );
}
