import { useEffect, useRef, type CSSProperties } from "react";
import type { ChartEventOverlayCluster } from "@/app/lib/chartEventOverlay";
import type { CalendarEvent } from "@/app/types";

export function ChartEventOverlay(props: {
  clusters: ChartEventOverlayCluster[];
  isCapped: boolean;
  renderedEventCount: number;
  visibleEventCount: number;
  hoveredClusterKey: string | null;
  activeClusterKey: string | null;
  isInteracting: boolean;
  onHoverCluster: (key: string | null) => void;
  onSelectCluster: (key: string) => void;
  onSelectEvent: (clusterKey: string, event: CalendarEvent) => void;
}) {
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const keepTooltipOpen = (key: string) => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (!props.isInteracting) props.onHoverCluster(key);
  };

  const scheduleTooltipClose = () => {
    if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      props.onHoverCluster(null);
    }, 180);
  };

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
        const shouldShowBadge = !props.isInteracting && (cluster.showBadge || isHovered || isActive);
        const hasFuture = cluster.events.some(({ isFuture }) => isFuture);
        const markerStyle = {
          left: cluster.x,
        } satisfies CSSProperties;

        return (
          <div
            key={cluster.key}
            className={`chart-event-marker chart-event-${cluster.impact} tooltip-${cluster.tooltipPlacement} ${hasFuture ? "is-future" : ""} ${isActive ? "is-active" : ""} ${props.isInteracting ? "is-interacting" : ""}`}
            style={markerStyle}
            onMouseEnter={() => keepTooltipOpen(cluster.key)}
            onMouseLeave={scheduleTooltipClose}
          >
            <span className="chart-event-line" />
            <button
              type="button"
              className="chart-event-hit-target"
              onClick={() => props.onSelectCluster(cluster.key)}
              onFocus={() => keepTooltipOpen(cluster.key)}
              onBlur={scheduleTooltipClose}
              aria-label={`Open Lens for ${cluster.events.length} ${hasFuture ? "scheduled" : "loaded"} chart event${cluster.events.length === 1 ? "" : "s"}`}
            >
              <span className="chart-event-dot" />
              {shouldShowBadge && (
                <span className="chart-event-badge">
                  <strong>{cluster.badgeLabel}</strong>
                  <small>{cluster.impact}</small>
                </span>
              )}
            </button>
            {isHovered && !props.isInteracting && (
              <span
                className="chart-event-tooltip"
                onMouseEnter={() => keepTooltipOpen(cluster.key)}
                onMouseLeave={scheduleTooltipClose}
              >
                <span className="chart-event-tooltip-kicker">
                  {hasFuture ? "Scheduled" : "Loaded"} / {cluster.events.length} event{cluster.events.length === 1 ? "" : "s"}
                </span>
                <strong>{cluster.detailLabel}</strong>
                <span>Choose an event here, or click the dot to open the main one.</span>
                <span className="chart-event-list">
                  {cluster.events.map(({ event, timeLabel }) => (
                    <button
                      key={`${event.id}:${event.time}:${event.currency}:${event.title}`}
                      type="button"
                      className="chart-event-list-row"
                      onClick={() => props.onSelectEvent(cluster.key, event)}
                    >
                      <span>
                        <b>{event.currency}</b>
                        <small>{event.impact}</small>
                      </span>
                      <strong>{event.title}</strong>
                      <em>{timeLabel}</em>
                    </button>
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
