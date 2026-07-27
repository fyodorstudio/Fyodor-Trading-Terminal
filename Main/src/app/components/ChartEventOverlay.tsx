import type { CSSProperties } from "react";
import { getChartEventKey } from "@/app/lib/chartEvents";
import type { ChartEventOverlayCluster } from "@/app/lib/chartEventOverlay";
import type { CalendarEvent } from "@/app/types";

export function ChartEventOverlay(props: {
  clusters: ChartEventOverlayCluster[];
  isCapped: boolean;
  renderedEventCount: number;
  visibleEventCount: number;
  hoveredClusterKey: string | null;
  activeClusterKey: string | null;
  onHoverCluster: (key: string | null) => void;
  onToggleCluster: (key: string) => void;
  onOpenCalendarEvent: (event: CalendarEvent) => void;
}) {
  if (props.clusters.length === 0) return null;

  return (
    <div className="chart-event-overlay" aria-label="Loaded economic events on chart">
      {props.isCapped ? (
        <div className="chart-event-density-note" aria-live="polite">
          Showing {props.renderedEventCount} of {props.visibleEventCount} events in view
        </div>
      ) : null}
      {props.clusters.map((cluster) => {
        const isHovered = props.hoveredClusterKey === cluster.key;
        const isActive = props.activeClusterKey === cluster.key;
        const shouldShowBadge = cluster.showBadge || isHovered || isActive;
        const markerStyle = {
          left: cluster.x,
        } satisfies CSSProperties;

        return (
          <div
            key={cluster.key}
            role="button"
            tabIndex={0}
            className={`chart-event-marker chart-event-${cluster.impact} tooltip-${cluster.tooltipPlacement} ${isActive ? "is-active" : ""}`}
            style={markerStyle}
            onClick={() => props.onToggleCluster(cluster.key)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              props.onToggleCluster(cluster.key);
            }}
            onMouseEnter={() => props.onHoverCluster(cluster.key)}
            onMouseLeave={() => props.onHoverCluster(null)}
            onFocus={() => props.onHoverCluster(cluster.key)}
            aria-label={`Open ${cluster.events.length} loaded chart event${cluster.events.length === 1 ? "" : "s"}`}
          >
            <span className="chart-event-line" />
            <span className="chart-event-dot" />
            {shouldShowBadge && (
              <span className="chart-event-badge">
                <strong>{cluster.badgeLabel}</strong>
                <small>{cluster.impact}</small>
              </span>
            )}
            {(isHovered || isActive) && (
              <span className="chart-event-tooltip">
                <span className="chart-event-tooltip-kicker">
                  {cluster.events.length} loaded event{cluster.events.length === 1 ? "" : "s"}
                </span>
                <strong>{cluster.detailLabel}</strong>
                <span>Click a row to open the Economic Calendar inspector.</span>
                <span className="chart-event-list">
                  {cluster.events.map(({ event, timeLabel }) => (
                    <span
                      key={getChartEventKey(event)}
                      role="button"
                      tabIndex={0}
                      className="chart-event-list-row"
                      onClick={(rowEvent) => {
                        rowEvent.stopPropagation();
                        props.onOpenCalendarEvent(event);
                      }}
                      onKeyDown={(rowEvent) => {
                        if (rowEvent.key !== "Enter" && rowEvent.key !== " ") return;
                        rowEvent.preventDefault();
                        rowEvent.stopPropagation();
                        props.onOpenCalendarEvent(event);
                      }}
                    >
                      <span>
                        <b>{event.currency}</b>
                        <small>{event.impact}</small>
                      </span>
                      <strong>{event.title}</strong>
                      <em>{timeLabel}</em>
                    </span>
                  ))}
                </span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
