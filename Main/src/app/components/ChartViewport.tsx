import { type Ref } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ChartEventOverlay } from "@/app/components/ChartEventOverlay";
import type { ChartEventOverlayCluster } from "@/app/lib/chartEventOverlay";
import type { BridgeStatus, CalendarEvent } from "@/app/types";

export type ChartCrosshairReadout = {
  top: number;
  lines: Array<{ label: string; value: string }>;
};

interface ChartViewportProps {
  containerRef: Ref<HTMLDivElement>;
  clusters: ChartEventOverlayCluster[];
  eventOverlay: {
    isCapped: boolean;
    renderedEventCount: number;
    visibleEventCount: number;
  };
  hoveredClusterKey: string | null;
  activeClusterKey: string | null;
  onHoverCluster: (key: string | null) => void;
  onToggleCluster: (key: string) => void;
  onOpenCalendarEvent: (event: CalendarEvent) => void;
  crosshairReadout: ChartCrosshairReadout | null;
  status: BridgeStatus;
  overlayCopy: {
    title: string;
    description: string;
  };
  reachedBoundary: boolean;
  consoleOpen: boolean;
  debugLines: string[];
  onToggleConsole: () => void;
}

export function ChartViewport({
  containerRef,
  clusters,
  eventOverlay,
  hoveredClusterKey,
  activeClusterKey,
  onHoverCluster,
  onToggleCluster,
  onOpenCalendarEvent,
  crosshairReadout,
  status,
  overlayCopy,
  reachedBoundary,
  consoleOpen,
  debugLines,
  onToggleConsole,
}: ChartViewportProps) {
  return (
    <>
      <div className="relative group min-h-0 flex-1 overflow-hidden">
        <div className="h-full p-1 backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-3xl shadow-sm overflow-hidden">
          <div className="chart-canvas-frame">
            <div ref={containerRef} className="h-full w-full" />
            <ChartEventOverlay
              clusters={clusters}
              isCapped={eventOverlay.isCapped}
              renderedEventCount={eventOverlay.renderedEventCount}
              visibleEventCount={eventOverlay.visibleEventCount}
              hoveredClusterKey={hoveredClusterKey}
              activeClusterKey={activeClusterKey}
              onHoverCluster={onHoverCluster}
              onToggleCluster={onToggleCluster}
              onOpenCalendarEvent={onOpenCalendarEvent}
            />
          </div>
        </div>
        {crosshairReadout && (
          <div
            className="chart-crosshair-readout"
            style={{ top: crosshairReadout.top }}
            aria-hidden="true"
          >
            {crosshairReadout.lines.map((line) => (
              <div key={line.label} className="chart-crosshair-readout-line">
                <span>{line.label}</span>
                <strong>{line.value}</strong>
              </div>
            ))}
          </div>
        )}
        <div className="charts-history-boundary" aria-live="polite">
          <span className={`charts-history-boundary-pill ${reachedBoundary ? "is-visible" : ""}`}>
            Oldest available MT5 candle, approximate
          </span>
        </div>

        <AnimatePresence>
          {(status === "error" || status === "no_data") && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/40 backdrop-blur-xl rounded-3xl z-50 text-center p-8"
            >
              <div className="p-4 bg-red-50 rounded-full text-red-500">
                <AlertTriangle className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{overlayCopy.title}</h3>
                <p className="text-gray-600 max-w-sm">{overlayCopy.description}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-2xl overflow-hidden shadow-sm">
        <div className={`flex items-center justify-between px-5 py-3 ${consoleOpen ? "border-b border-gray-100" : ""}`}>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            Terminal Console
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-500">
              {debugLines.length} logs
            </span>
          </h3>
          <div className="flex items-center gap-3">
            {consoleOpen && (
              <button
                onClick={() => void navigator.clipboard.writeText(debugLines.join("\n") || "(empty)")}
                className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors"
              >
                Copy Logs
              </button>
            )}
            <button
              onClick={onToggleConsole}
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors"
            >
              {consoleOpen ? "Hide" : "Show"}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${consoleOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
        {consoleOpen && (
          <div className="h-20 overflow-auto p-3 bg-gray-50/50 font-mono text-[10px] leading-relaxed text-gray-500">
            {debugLines.length === 0 ? (
              <div className="italic">Awaiting first market event...</div>
            ) : (
              debugLines.map((line, index) => <div key={index} className="mb-1">{line}</div>)
            )}
          </div>
        )}
      </div>
    </>
  );
}
