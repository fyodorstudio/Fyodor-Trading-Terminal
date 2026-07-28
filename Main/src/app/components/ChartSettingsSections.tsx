import { Activity, CalendarDays, HardDrive, MousePointer2, Palette, RotateCcw, SlidersHorizontal, Trash2 } from "lucide-react";
import type {
  ChartAppearancePreferences,
  ChartCursorReadoutMode,
  ChartEventOverlayImpactFilter,
  ChartEventOverlayPreferences,
  ChartPreferences,
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
  onEventOverlayChange,
}: {
  eventOverlay: ChartEventOverlayPreferences;
  onEventOverlayChange: <K extends keyof ChartEventOverlayPreferences>(
    key: K,
    value: ChartEventOverlayPreferences[K],
  ) => void;
}) {
  return (
    <section className="charts-history-section chart-drawer-card">
      <h3>
        <CalendarDays size={14} />
        Event Timeline
      </h3>
      <p>
        Draw loaded broker/MT5 calendar events directly over the candle chart. These markers show event timing context, not trade calls.
      </p>
      <label className="chart-settings-check chart-settings-check-card">
        <input
          type="checkbox"
          checked={eventOverlay.visible}
          onChange={(event) => onEventOverlayChange("visible", event.target.checked)}
        />
        <span>Show event lines on chart</span>
      </label>
      <div className="chart-event-settings-grid">
        <div>
          <span className="chart-event-settings-label">Impact</span>
          <div className="chart-drawer-segmented chart-drawer-segmented-compact">
            {CHART_EVENT_IMPACT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={eventOverlay.impactFilter === option.id ? "is-active" : ""}
                onClick={() => onEventOverlayChange("impactFilter", option.id)}
              >
                <span>{option.label}</span>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        </div>
        <label className="chart-settings-row chart-settings-row-stacked">
          <span>Maximum markers</span>
          <select
            value={eventOverlay.maxMarkers}
            onChange={(event) => onEventOverlayChange("maxMarkers", Number(event.target.value))}
          >
            {EVENT_MARKER_LIMIT_OPTIONS.map((limit) => (
              <option key={limit} value={limit}>
                {limit} markers
              </option>
            ))}
          </select>
          <small>Hard cap for visible-range markers before clustering.</small>
        </label>
      </div>
      <span className="chart-event-settings-label">Currency scope</span>
      <div className="chart-drawer-segmented">
        {CHART_EVENT_SCOPE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={eventOverlay.scope === option.id ? "is-active" : ""}
            onClick={() => onEventOverlayChange("scope", option.id)}
          >
            <span>{option.label}</span>
            <small>{option.description}</small>
          </button>
        ))}
      </div>
      <p className="chart-event-settings-note">
        Event lines only use calendar rows already loaded by the local bridge. Missing old rows do not mean no event happened there.
      </p>
    </section>
  );
}

export function ChartCacheSettings({ cacheData }: { cacheData: ChartCacheDrawerData }) {
  return (
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
  );
}
