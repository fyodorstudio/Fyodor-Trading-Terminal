import { memo, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { formatChartEventDisplayTime } from "@/app/lib/chartEvents";
import { usePairMatrixHoverAnchor } from "@/app/hooks/usePairMatrixHoverAnchor";
import type { ChartDisplayTimeMode } from "@/app/lib/chartView";
import type { PairMatrixContextMarkerGroup } from "@/app/lib/pairMatrixContextMarkers";
import type { PairMatrixHoverRuntime } from "@/app/lib/pairMatrixHoverRuntime";
import type { CalendarEvent } from "@/app/types";

export interface PairMatrixContextMarkerView extends PairMatrixContextMarkerGroup {
  x: number;
  placement: "left" | "center" | "right";
}

export const ChartPairMatrixContextMarkers = memo(function ChartPairMatrixContextMarkers({
  markers: sourceMarkers,
  passive,
  displayTimeMode,
  sourceTimeOffsetSeconds,
  loadState,
  onSelectEvent,
  cursorRuntime,
}: {
  markers: PairMatrixContextMarkerView[];
  passive: boolean;
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
  loadState: "idle" | "loading" | "ready" | "error";
  onSelectEvent: (event: CalendarEvent) => void;
  cursorRuntime?: {
    hover: PairMatrixHoverRuntime;
    resolve: (anchor: number | null) => PairMatrixContextMarkerView[];
  };
}) {
  const hoverAnchor = usePairMatrixHoverAnchor(cursorRuntime?.hover ?? null);
  const markers = useMemo(
    () => cursorRuntime ? cursorRuntime.resolve(hoverAnchor) : sourceMarkers,
    [cursorRuntime, hoverAnchor, sourceMarkers],
  );
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(() => new Set());

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
          <div key={marker.key} className={`pair-matrix-context-marker impact-${marker.impact} position-${marker.position} placement-${marker.placement}`} style={{ left: marker.x }}>
            <button
              type="button"
              className="pair-matrix-context-marker-button"
              onClick={() => {
                if (passive) return;
                setActiveKey((current) => current === marker.key ? null : marker.key);
                setExpandedFamilies(new Set());
              }}
              aria-expanded={active}
              aria-label={`${marker.events.length} Pair Matrix release${marker.events.length === 1 ? "" : "s"} in this candle`}
            >
              <span className="pair-matrix-context-marker-dot" />
              {marker.events.length > 1 ? <small>{marker.events.length}</small> : null}
            </button>
            {active && !passive ? (
              <section className="pair-matrix-context-marker-popover" aria-label={`${marker.events.length} releases grouped by factor`}>
                <header>
                  <span><strong>{marker.events.length} release{marker.events.length === 1 ? "" : "s"}</strong><small>{marker.position} selected range</small></span>
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
                            {family.events.map((event) => (
                              <button key={`${event.id}:${event.time}:${event.title}`} type="button" onClick={() => onSelectEvent(event)}>
                                <span><b>{event.currency}</b><small>{event.impact}</small></span>
                                <strong>{event.title}</strong>
                                <time>{formatChartEventDisplayTime(event.time, displayTimeMode, sourceTimeOffsetSeconds)}</time>
                              </button>
                            ))}
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
