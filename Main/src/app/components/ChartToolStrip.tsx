import { Activity, BookOpen, CalendarDays, Focus, HardDrive, MousePointer2, Settings2, Table2 } from "lucide-react";
import type { ChartDrawerMode } from "@/app/components/ChartSettingsDrawer";
import type { ChartCursorReadoutMode } from "@/app/lib/chartView";

const CURSOR_MODE_OPTIONS: Array<{ id: ChartCursorReadoutMode; label: string; description: string }> = [
  { id: "both", label: "Crosshair", description: "Free crosshair movement with both pointer and candle readouts." },
  { id: "nearest_candle", label: "Sticky", description: "Stick the readout to the nearest candle close." },
];

interface ChartToolStripProps {
  cursorReadoutMode: ChartCursorReadoutMode;
  eventOverlayVisible: boolean;
  eventCandidateCount: number;
  eventVisibleCount: number;
  macroBiasVisible: boolean;
  macroBiasCount: number;
  macroBiasSupported: boolean;
  macroBiasStatusLabel: string;
  macroBiasHistoricalMatchesVisible: boolean;
  macroBiasHistoricalMatchesCount: number;
  macroBiasActiveLabel: string;
  eventLensExpanded: boolean;
  pairMatrixOpen: boolean;
  onCursorModeChange: (mode: ChartCursorReadoutMode) => void;
  onRefocusChart: () => void;
  onOpenDrawer: (mode: ChartDrawerMode) => void;
  onToggleMacroBias: () => void;
  onToggleMacroBiasHistoricalMatches: () => void;
  onToggleEventLens: () => void;
  onTogglePairMatrix: () => void;
}

export function ChartToolStrip({
  cursorReadoutMode,
  eventOverlayVisible,
  eventCandidateCount,
  eventVisibleCount,
  macroBiasVisible,
  macroBiasCount,
  macroBiasSupported,
  macroBiasStatusLabel,
  macroBiasHistoricalMatchesVisible,
  macroBiasHistoricalMatchesCount,
  macroBiasActiveLabel,
  eventLensExpanded,
  pairMatrixOpen,
  onCursorModeChange,
  onRefocusChart,
  onOpenDrawer,
  onToggleMacroBias,
  onToggleMacroBiasHistoricalMatches,
  onToggleEventLens,
  onTogglePairMatrix,
}: ChartToolStripProps) {
  const eventButtonLabel = !eventOverlayVisible
    ? "Chart events hidden"
    : eventVisibleCount > 0
      ? `Chart events: ${eventVisibleCount} visible, ${eventCandidateCount} loaded matches`
      : `Chart events: no visible matches, ${eventCandidateCount} loaded matches`;

  return (
    <div className="chart-tool-strip" aria-label="Chart tools">
      <div className="chart-readout-toggle" aria-label="Cursor readout mode">
        <MousePointer2 className="h-4 w-4 text-slate-400" />
        {CURSOR_MODE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            title={option.description}
            className={cursorReadoutMode === option.id ? "is-active" : ""}
            onClick={() => onCursorModeChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="chart-lens-tool-group" aria-label="Economic chart tools">
        <button
          type="button"
          className={eventLensExpanded ? "is-active" : ""}
          title="Open Event Lens"
          aria-label="Open Event Lens"
          aria-pressed={eventLensExpanded}
          onClick={onToggleEventLens}
        >
          <BookOpen className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={pairMatrixOpen ? "is-active" : ""}
          title="Open Pair Matrix Time Lens"
          aria-label="Open Pair Matrix Time Lens"
          aria-pressed={pairMatrixOpen}
          onClick={onTogglePairMatrix}
        >
          <Table2 className="h-4 w-4" />
        </button>
      </div>
      <button type="button" className="chart-icon-button" title="Refocus chart" aria-label="Refocus chart" onClick={onRefocusChart}>
        <Focus className="h-4 w-4" />
      </button>
      {macroBiasVisible && macroBiasSupported ? (
        <label className="chart-macro-bias-history-toggle" title="Show or hide old arrows from the same registered setups. Old results are hindsight, not live signals.">
          <input type="checkbox" checked={macroBiasHistoricalMatchesVisible} onChange={onToggleMacroBiasHistoricalMatches} />
          <span>Past arrows</span>
          {macroBiasHistoricalMatchesCount > 0 ? <small>{macroBiasHistoricalMatchesCount}</small> : null}
        </label>
      ) : null}
      {macroBiasVisible && macroBiasSupported ? (
        <span className="sr-only" aria-live="polite">{macroBiasActiveLabel}</span>
      ) : null}
      <button
        type="button"
        className={macroBiasVisible ? "chart-macro-bias-toggle is-active" : "chart-macro-bias-toggle"}
        title={macroBiasSupported ? macroBiasStatusLabel : "No registered FMS setup is available for this market yet; registered contracts are H4-based"}
        aria-pressed={macroBiasVisible}
        onClick={onToggleMacroBias}
      >
        <Activity className="h-4 w-4" />
        FMS
        {macroBiasVisible && macroBiasCount > 0 ? <small>{macroBiasCount}</small> : null}
      </button>
      <button
        type="button"
        className={eventOverlayVisible ? "chart-icon-button is-active" : "chart-icon-button"}
        title={eventButtonLabel}
        aria-label={`${eventButtonLabel}. Open chart events settings`}
        onClick={() => onOpenDrawer("events")}
      >
        <CalendarDays className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="chart-icon-button"
        title="Chart appearance"
        aria-label="Open chart appearance"
        onClick={() => onOpenDrawer("appearance")}
      >
        <Settings2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="chart-icon-button"
        title="Diagnostics"
        aria-label="Open chart diagnostics"
        onClick={() => onOpenDrawer("diagnostics")}
      >
        <HardDrive className="h-4 w-4" />
      </button>
    </div>
  );
}
