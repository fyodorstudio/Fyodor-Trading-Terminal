import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Crosshair, X } from "lucide-react";
import { formatChartEventDisplayTime } from "@/app/lib/chartEvents";
import { usePairMatrixHoverAnchor } from "@/app/hooks/usePairMatrixHoverAnchor";
import type { ChartDisplayTimeMode } from "@/app/lib/chartView";
import { PAIR_MATRIX_FACTORS, PAIR_MATRIX_OTHER_FACTOR } from "@/app/lib/pairMatrixSnapshot";
import type { PairMatrixContextMarkerGroup } from "@/app/lib/pairMatrixContextMarkers";
import type { PairMatrixHoverRuntime } from "@/app/lib/pairMatrixHoverRuntime";
import type { PairMatrixChartGeometryRuntime } from "@/app/lib/pairMatrixChartGeometry";
import type { CalendarEvent } from "@/app/types";

export interface PairMatrixContextMarkerView extends PairMatrixContextMarkerGroup {
  x: number;
  placement: "left" | "center" | "right";
}

interface PairMatrixContextMarkerDisplay extends PairMatrixContextMarkerView {
  candleCount: number;
  candleOpens: number[];
  eventCandleOpenByKey: ReadonlyMap<string, number>;
}

const MARKER_CLUSTER_SPAN = 64;
const MARKER_FACTOR_ORDER = [...PAIR_MATRIX_FACTORS, PAIR_MATRIX_OTHER_FACTOR];
const MARKER_IMPACT_RANK: Record<CalendarEvent["impact"], number> = { high: 0, medium: 1, low: 2 };

function getMarkerEventIdentity(event: CalendarEvent): string {
  return `${event.currency}:${event.id}:${event.time}:${event.title}`;
}

/**
 * Collapses markers that cannot be drawn legibly at the current zoom level.
 * The raw candle groups remain untouched and automatically separate as their
 * screen coordinates spread into different buckets.
 */
export function clusterPairMatrixMarkerViews(
  source: readonly PairMatrixContextMarkerView[],
  maximumSpan = MARKER_CLUSTER_SPAN,
): PairMatrixContextMarkerDisplay[] {
  if (source.length === 0) return [];
  const span = Math.max(1, maximumSpan);
  const buckets: PairMatrixContextMarkerView[][] = [];
  [...source].sort((left, right) => left.x - right.x || left.candleOpen - right.candleOpen).forEach((marker) => {
    const current = buckets[buckets.length - 1];
    if (!current || marker.x - current[0].x > span) buckets.push([marker]);
    else current.push(marker);
  });

  return buckets.map((members) => {
    if (members.length === 1) return {
      ...members[0],
      candleCount: 1,
      candleOpens: [members[0].candleOpen],
      eventCandleOpenByKey: new Map(members[0].events.map((event) => [getMarkerEventIdentity(event), members[0].candleOpen])),
    };
    const events = members.flatMap((member) => member.events)
      .sort((left, right) => left.time - right.time || left.title.localeCompare(right.title));
    const eventsByFactor = new Map<string, CalendarEvent[]>();
    members.forEach((member) => member.families.forEach((family) => {
      const matches = eventsByFactor.get(family.factor.id) ?? [];
      matches.push(...family.events);
      eventsByFactor.set(family.factor.id, matches);
    }));
    const families = MARKER_FACTOR_ORDER.flatMap((factor) => {
      const matches = eventsByFactor.get(factor.id);
      return matches ? [{ factor, events: matches.sort((left, right) => left.time - right.time || left.title.localeCompare(right.title)) }] : [];
    });
    const positions = new Set(members.map((member) => member.position));
    const placements = new Set(members.map((member) => member.placement));
    const eventCandleOpenByKey = new Map<string, number>();
    members.forEach((member) => member.events.forEach((event) => eventCandleOpenByKey.set(getMarkerEventIdentity(event), member.candleOpen)));
    return {
      key: `cluster:${members.map((member) => member.key).join("|")}`,
      candleOpen: members[0].candleOpen,
      x: (members[0].x + members[members.length - 1].x) / 2,
      placement: placements.size === 1 ? members[0].placement : "center",
      position: positions.size === 1 ? members[0].position : "during",
      impact: events.reduce((dominant, event) => MARKER_IMPACT_RANK[event.impact] < MARKER_IMPACT_RANK[dominant] ? event.impact : dominant, "low" as CalendarEvent["impact"]),
      events,
      families,
      candleCount: members.length,
      candleOpens: members.map((member) => member.candleOpen),
      eventCandleOpenByKey,
    };
  });
}

export const ChartPairMatrixContextMarkers = memo(function ChartPairMatrixContextMarkers({
  markers: sourceMarkers,
  passive,
  displayTimeMode,
  sourceTimeOffsetSeconds,
  loadState,
  onSelectEvent,
  onAnalyzeCandle,
  geometryRuntime,
  cursorRuntime,
}: {
  markers: PairMatrixContextMarkerView[];
  passive: boolean;
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
  loadState: "idle" | "loading" | "ready" | "error";
  onSelectEvent: (event: CalendarEvent) => void;
  onAnalyzeCandle: (candleOpen: number) => void;
  geometryRuntime?: PairMatrixChartGeometryRuntime;
  cursorRuntime?: {
    hover: PairMatrixHoverRuntime;
    resolve: (anchor: number | null) => PairMatrixContextMarkerView[];
  };
}) {
  const hoverAnchor = usePairMatrixHoverAnchor(cursorRuntime?.hover ?? null);
  const rawMarkers = useMemo(
    () => cursorRuntime ? cursorRuntime.resolve(hoverAnchor) : sourceMarkers,
    [cursorRuntime, hoverAnchor, sourceMarkers],
  );
  const markers = useMemo(() => clusterPairMatrixMarkerViews(rawMarkers), [rawMarkers]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(() => new Set());
  const markerRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!geometryRuntime) return;
    const update = () => {
      markers.forEach((marker) => {
        const element = markerRefs.current.get(marker.key);
        if (!element) return;
        const position = geometryRuntime.resolveMarker(marker.candleOpens);
        if (!position || !position.visible) {
          element.style.visibility = "hidden";
          return;
        }
        element.style.visibility = "visible";
        element.style.left = "0px";
        element.style.transform = `translate3d(${position.x}px, 0, 0) translateX(-50%)`;
        element.classList.toggle("placement-left", position.placement === "left");
        element.classList.toggle("placement-center", position.placement === "center");
        element.classList.toggle("placement-right", position.placement === "right");
      });
    };
    update();
    return geometryRuntime.subscribe(update);
  }, [geometryRuntime, markers]);

  useEffect(() => {
    if (passive) setActiveKey(null);
  }, [passive]);

  useEffect(() => {
    if (activeKey && !markers.some((marker) => marker.key === activeKey)) setActiveKey(null);
  }, [activeKey, markers]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && activeKey) {
        event.stopPropagation();
        setActiveKey(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape, true);
    return () => window.removeEventListener("keydown", closeOnEscape, true);
  }, [activeKey]);

  if (markers.length === 0 && loadState !== "loading" && loadState !== "error") return null;

  return (
    <div className={`pair-matrix-context-markers ${passive ? "is-passive" : ""}`} aria-label="Pair Matrix event markers" data-pair-matrix-context-markers="">
      {loadState === "loading" ? <span className="pair-matrix-context-marker-status">Loading Pair Matrix markers…</span> : null}
      {loadState === "error" ? <span className="pair-matrix-context-marker-status is-error">Pair Matrix marker coverage could not be loaded</span> : null}
      {markers.map((marker) => {
        const active = marker.key === activeKey;
        return (
          <div
            key={marker.key}
            ref={(element) => {
              if (element) markerRefs.current.set(marker.key, element);
              else markerRefs.current.delete(marker.key);
            }}
            className={`pair-matrix-context-marker impact-${marker.impact} position-${marker.position} placement-${marker.placement} ${marker.candleCount > 1 ? "is-cluster" : ""}`}
            style={{ left: 0, transform: `translate3d(${marker.x}px, 0, 0) translateX(-50%)` }}
          >
            <button
              type="button"
              className="pair-matrix-context-marker-button"
              onClick={() => {
                if (passive) return;
                setActiveKey((current) => current === marker.key ? null : marker.key);
                setExpandedFamilies(new Set());
              }}
              aria-expanded={active}
              aria-label={marker.candleCount > 1
                ? `${marker.events.length} Pair Matrix releases across ${marker.candleCount} nearby candles; ${marker.impact} broker impact`
                : `${marker.events.length} Pair Matrix release${marker.events.length === 1 ? "" : "s"} in this candle; ${marker.impact} broker impact`}
            >
              <span className="pair-matrix-context-marker-dot" />
              {marker.events.length > 1 ? <small aria-hidden="true">{marker.events.length}</small> : null}
            </button>
            {active && !passive ? (
              <section className="pair-matrix-context-marker-popover" aria-label={`${marker.events.length} releases grouped by factor`}>
                <header>
                  <span>
                    <strong>{marker.events.length} release{marker.events.length === 1 ? "" : "s"}</strong>
                    <small>{marker.candleCount > 1 ? `${marker.candleCount} nearby candles · ${marker.impact} broker impact` : `${marker.position} selected range · ${marker.impact} broker impact`}</small>
                  </span>
                  <button type="button" onClick={() => setActiveKey(null)} aria-label="Close event marker"><X size={14} /></button>
                </header>
                <div className="pair-matrix-context-marker-families">
                  {marker.families.map((family) => {
                    const familyKey = `${marker.key}:${family.factor.id}`;
                    const expanded = expandedFamilies.has(familyKey);
                    return (
                      <div key={familyKey} className="pair-matrix-context-marker-family">
                        <button
                          type="button"
                          className="pair-matrix-context-marker-family-parent"
                          onClick={() => setExpandedFamilies((current) => {
                            const next = new Set(current);
                            if (next.has(familyKey)) next.delete(familyKey); else next.add(familyKey);
                            return next;
                          })}
                          aria-expanded={expanded}
                        >
                          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          <strong>{family.factor.label}</strong>
                          <small>{family.events.length}</small>
                        </button>
                        {expanded ? (
                          <div className="pair-matrix-context-marker-family-children">
                            {family.events.map((event) => {
                              const eventKey = getMarkerEventIdentity(event);
                              const candleOpen = marker.eventCandleOpenByKey.get(eventKey);
                              return (
                                <div key={eventKey} className="pair-matrix-context-marker-release">
                                  <button type="button" className="pair-matrix-context-marker-event-action" onClick={() => onSelectEvent(event)} title="Open release in Event Lens">
                                    <span><b>{event.currency}</b><small>{event.impact}</small></span>
                                    <strong>{event.title}</strong>
                                    <time>{formatChartEventDisplayTime(event.time, displayTimeMode, sourceTimeOffsetSeconds)}</time>
                                  </button>
                                  <button
                                    type="button"
                                    className="pair-matrix-context-marker-analyze-action"
                                    disabled={candleOpen == null}
                                    onClick={() => {
                                      if (candleOpen == null) return;
                                      onAnalyzeCandle(candleOpen);
                                      setActiveKey(null);
                                    }}
                                    aria-label={`Analyze the candle containing ${event.title}`}
                                    title="Lock Pair Matrix to this complete candle"
                                  >
                                    <Crosshair size={13} /> Analyze candle
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        );
      })}
    </div>
  );
});
