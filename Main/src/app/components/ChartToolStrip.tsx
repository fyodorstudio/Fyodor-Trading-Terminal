import { CalendarDays, Focus, HardDrive, MousePointer2, Settings2 } from "lucide-react";
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
  onCursorModeChange: (mode: ChartCursorReadoutMode) => void;
  onRefocusChart: () => void;
  onOpenDrawer: (mode: ChartDrawerMode) => void;
}

export function ChartToolStrip({
  cursorReadoutMode,
  eventOverlayVisible,
  eventCandidateCount,
  onCursorModeChange,
  onRefocusChart,
  onOpenDrawer,
}: ChartToolStripProps) {
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
      <button type="button" className="chart-icon-button" title="Refocus chart" aria-label="Refocus chart" onClick={onRefocusChart}>
        <Focus className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={eventOverlayVisible ? "chart-icon-button is-active" : "chart-icon-button"}
        title={`Chart events (${eventCandidateCount} loaded matches)`}
        aria-label="Open chart events"
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
        title="Data cache"
        aria-label="Open chart data cache"
        onClick={() => onOpenDrawer("cache")}
      >
        <HardDrive className="h-4 w-4" />
      </button>
    </div>
  );
}
