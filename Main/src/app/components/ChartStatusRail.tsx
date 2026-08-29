import { useEffect, useMemo, useState, type Ref } from "react";
import { Activity, Check, ChevronDown, Clock, Database } from "lucide-react";
import { getChartSessionDetail } from "@/app/lib/chartView";
import { getChartDisplayModeLabel, type ChartDisplayTimeMode } from "@/app/lib/chartView";
import { formatCurrentTimeForDisplayTimezone, getDisplayTimezoneOptions, getDisplayTimezoneShortLabel } from "@/app/lib/timezoneDisplay";
import type { BridgeStatus, MarketStatusResponse } from "@/app/types";

interface ChartStatusRailProps {
  status: BridgeStatus;
  streamStatusLabel: string;
  marketStatus: MarketStatusResponse | null;
  lastCandleTime: number | null;
  feedLabel: string;
  displayTimeMode: ChartDisplayTimeMode;
  timezoneMenuOpen: boolean;
  timezoneMenuRef: Ref<HTMLDivElement>;
  onToggleTimezoneMenu: () => void;
  onDisplayTimeModeChange: (mode: ChartDisplayTimeMode) => void;
}

export function ChartStatusRail({
  status,
  streamStatusLabel,
  marketStatus,
  lastCandleTime,
  feedLabel,
  displayTimeMode,
  timezoneMenuOpen,
  timezoneMenuRef,
  onToggleTimezoneMenu,
  onDisplayTimeModeChange,
}: ChartStatusRailProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);
  const sessionDetail = useMemo(() => getChartSessionDetail(marketStatus, nowMs), [marketStatus, nowMs]);
  const timezoneOptions = useMemo(() => getDisplayTimezoneOptions(new Date(nowMs)), [nowMs]);
  const displayModeLabel = getChartDisplayModeLabel(displayTimeMode);
  const displayModeShortLabel = getDisplayTimezoneShortLabel(displayTimeMode, new Date(nowMs));
  const currentDisplayTime = formatCurrentTimeForDisplayTimezone({
    nowMs,
    selection: displayTimeMode,
    serverTimeSeconds: marketStatus?.server_time ?? lastCandleTime,
    serverFetchedAtMs: marketStatus?.checked_at != null ? marketStatus.checked_at * 1_000 : null,
  });
  const sessionLabel = sessionDetail.label;
  const sessionBasis = sessionDetail.basis;
  const compactSessionLabel = sessionLabel
    .replace(/^Scheduled session /, "")
    .replace(/^closes in /, "Closes ")
    .replace(/^opens in /, "Opens ");
  const compactFeedLabel = feedLabel.replace(/^Latest candle:\s*/i, "");
  const marketReferenceSeconds = marketStatus?.server_time ?? Math.floor(nowMs / 1_000);
  const marketReferenceDay = new Date(marketReferenceSeconds * 1_000).getUTCDay();
  const isWeekend = marketReferenceDay === 0 || marketReferenceDay === 6;
  const marketStateLabel = status === "live"
    ? marketStatus?.session_state === "closed"
      ? isWeekend ? "Weekend" : "Closed"
      : "Open"
    : streamStatusLabel;
  const marketStateTitle = `${streamStatusLabel}. ${sessionLabel}. ${sessionBasis}`;

  return (
    <div className="chart-status-rail">
      <div className={`chart-status-chip chart-status-${status}`} title={marketStateTitle}>
        <Activity className={status === "live" ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
        <span>{marketStateLabel}</span>
      </div>
      <div className="chart-status-chip chart-feed-chip">
        <div className="tv-toolbar-anchor" ref={timezoneMenuRef}>
          <button
            type="button"
            onClick={onToggleTimezoneMenu}
            title={`${compactFeedLabel}. Time display: ${displayModeLabel}. Viewer clock: ${currentDisplayTime}. ${compactSessionLabel}.`}
            className="chart-feed-button"
          >
            <Database className={lastCandleTime ? "h-4 w-4 text-blue-400" : "h-4 w-4 text-slate-500"} />
            <span className="chart-feed-main">
              <b>{compactFeedLabel}</b>
            </span>
            <span className="chart-feed-zone">{displayModeShortLabel}</span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${timezoneMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {timezoneMenuOpen && (
            <div className="tv-popover tv-filter-popover chart-timezone-popover">
              <div className="tv-popover-head">
                <strong>Time display</strong>
                <span>Choose the timezone used by chart dates, the axis, and crosshair labels.</span>
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
