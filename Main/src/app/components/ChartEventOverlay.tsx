import type { CSSProperties } from "react";
import type { ChartEventOverlayCluster } from "@/app/lib/chartEventOverlay";

export function ChartEventOverlay(props: {
  clusters: ChartEventOverlayCluster[];
  isCapped: boolean;
  renderedEventCount: number;
  visibleEventCount: number;
  hoveredClusterKey: string | null;
  activeClusterKey: string | null;
  onHoverCluster: (key: string | null) => void;
  onSelectCluster: (key: string) => void;
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
            className={`chart-event-marker chart-event-${cluster.impact} tooltip-${cluster.tooltipPlacement} ${isActive ? "is-active" : ""}`}
            style={markerStyle}
            onMouseEnter={() => props.onHoverCluster(cluster.key)}
            onMouseLeave={() => props.onHoverCluster(null)}
          >
            <span className="chart-event-line" />
            <button
              type="button"
              className="chart-event-hit-target"
              onClick={() => props.onSelectCluster(cluster.key)}
              onFocus={() => props.onHoverCluster(cluster.key)}
              aria-label={`Open Event Lens for ${cluster.events.length} loaded chart event${cluster.events.length === 1 ? "" : "s"}`}
            >
              <span className="chart-event-dot" />
              {shouldShowBadge && (
                <span className="chart-event-badge">
                  <strong>{cluster.badgeLabel}</strong>
                  <small>{cluster.impact}</small>
                </span>
              )}
            </button>
            {isHovered && !isActive && (
              <span className="chart-event-tooltip">
                <span className="chart-event-tooltip-kicker">
                  {cluster.events.length} loaded event{cluster.events.length === 1 ? "" : "s"}
                </span>
                <strong>{cluster.detailLabel}</strong>
                <span>Click the marker to open the Event Lens.</span>
                <span className="chart-event-list" aria-hidden="true">
                  {cluster.events.map(({ event, timeLabel }) => (
                    <span
                      key={`${event.id}:${event.time}:${event.currency}:${event.title}`}
                      className="chart-event-list-row"
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
