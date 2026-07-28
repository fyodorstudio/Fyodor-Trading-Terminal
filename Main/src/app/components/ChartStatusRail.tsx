import { type Ref } from "react";
import { Activity, Check, ChevronDown, Clock, Database } from "lucide-react";
import type { ChartDisplayTimeMode } from "@/app/lib/chartView";
import type { BridgeStatus } from "@/app/types";

interface ChartStatusRailProps {
  status: BridgeStatus;
  streamStatusLabel: string;
  sessionLabel: string;
  sessionBasis: string;
  lastCandleTime: number | null;
  feedLabel: string;
  currentDisplayTime: string;
  displayModeLabel: string;
  displayModeShortLabel: string;
  displayTimeMode: ChartDisplayTimeMode;
  timezoneOptions: Array<{
    id: ChartDisplayTimeMode;
    label: string;
    isHighlighted?: boolean;
  }>;
  timezoneMenuOpen: boolean;
  timezoneMenuRef: Ref<HTMLDivElement>;
  onToggleTimezoneMenu: () => void;
  onDisplayTimeModeChange: (mode: ChartDisplayTimeMode) => void;
}

export function ChartStatusRail({
  status,
  streamStatusLabel,
  sessionLabel,
  sessionBasis,
  lastCandleTime,
  feedLabel,
  currentDisplayTime,
  displayModeLabel,
  displayModeShortLabel,
  displayTimeMode,
  timezoneOptions,
  timezoneMenuOpen,
  timezoneMenuRef,
  onToggleTimezoneMenu,
  onDisplayTimeModeChange,
}: ChartStatusRailProps) {
  return (
    <div className="chart-status-rail">
      <div className={`chart-status-chip chart-status-${status}`}>
        <Activity className={status === "live" ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
        <span>{streamStatusLabel}</span>
      </div>
      <div className="chart-status-chip" title={sessionBasis}>
        <Clock className="h-4 w-4" />
        <span>{sessionLabel}</span>
      </div>
      <div className="chart-status-chip chart-feed-chip">
        <div className="tv-toolbar-anchor" ref={timezoneMenuRef}>
          <button
            type="button"
            onClick={onToggleTimezoneMenu}
            title={`Chart timezone. Current mode: ${displayModeLabel}.`}
            className="chart-feed-button"
          >
            <Database className={lastCandleTime ? "h-4 w-4 text-blue-400" : "h-4 w-4 text-slate-500"} />
            <span className="chart-feed-main">{feedLabel}</span>
            <span className="chart-feed-sub">Viewer clock: {currentDisplayTime} | {displayModeShortLabel}</span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${timezoneMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {timezoneMenuOpen && (
            <div className="tv-popover tv-filter-popover chart-timezone-popover">
              <div className="tv-popover-head">
                <strong>Chart timezone</strong>
                <span>Axis labels and crosshair labels are candle timestamps. Viewer clock is only the current time in the selected display timezone.</span>
              </div>
              <div className="tv-timezone-list">
                {timezoneOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={displayTimeMode === option.id ? "tv-option-row is-selected" : "tv-option-row"}
                    onClick={() => onDisplayTimeModeChange(option.id)}
                  >
                    <span className="tv-option-main">
                      <Clock size={15} />
                      <span className="tv-option-label">
                        {option.label}
                        {option.isHighlighted ? <span className="tv-option-badge">Local</span> : null}
                      </span>
                    </span>
                    {displayTimeMode === option.id && <Check size={15} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
