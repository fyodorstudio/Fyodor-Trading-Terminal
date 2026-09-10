import {
  Component,
  useEffect,
  useState,
  type ErrorInfo,
  type KeyboardEventHandler,
  type PointerEventHandler,
  type ReactNode,
  type Ref,
} from "react";
import { ChevronDown } from "lucide-react";
import { ChartFmsActionCard, type FmsTradeViewState } from "@/app/components/ChartFmsActionCard";
import { ChartFmsJournalCard } from "@/app/components/ChartFmsJournalCard";
import { ChartFmsKnowledgeCard } from "@/app/components/ChartFmsKnowledgeCard";
import { ChartMacroBiasAudit, type ChartMacroBiasAuditData } from "@/app/components/ChartMacroBiasAudit";
import { ChartMacroBiasRealtimeCard, type ChartMacroBiasRealtimeCardData } from "@/app/components/ChartMacroBiasRealtimeCard";
import { FMS_DOCK_MIN_WIDTH, type FmsDockPrimaryTab, type FmsDockTab } from "@/app/features/chart-viewport/chartPanelState";
import type { MacroSignalChartSignal } from "@/app/types";

class FmsDockErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : "Unknown FMS panel error" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("FMS dock render failed", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <section className="chart-fms-dock-loading is-error">
          <strong>FMS panel could not render</strong>
          <span>{this.state.error}</span>
          <button type="button" onClick={() => this.setState({ error: null })}>Retry panel</button>
        </section>
      );
    }
    return this.props.children;
  }
}

const FMS_SETUPS_STATE_KEY = "fyodor.charts.fms-setups-state";

type FmsSetupSection = "benchmarks" | "research" | "knowledge";

function loadFmsSetupSections(): { workspaceOpen: boolean; open: FmsSetupSection[]; visited: FmsSetupSection[] } {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(FMS_SETUPS_STATE_KEY) ?? "null");
    const valid = (value: unknown): value is FmsSetupSection => (
      value === "benchmarks" || value === "research" || value === "knowledge"
    );
    return {
      workspaceOpen: Boolean(parsed?.workspaceOpen),
      open: Array.isArray(parsed?.open) ? parsed.open.filter(valid) : [],
      visited: Array.isArray(parsed?.visited) ? parsed.visited.filter(valid) : [],
    };
  } catch {
    return { workspaceOpen: false, open: [], visited: [] };
  }
}

function FmsSetupsWorkspace({ data }: { data: ChartMacroBiasRealtimeCardData }) {
  const [sections, setSections] = useState(loadFmsSetupSections);
  useEffect(() => {
    try {
      window.sessionStorage.setItem(FMS_SETUPS_STATE_KEY, JSON.stringify(sections));
    } catch {
      // Optional session continuity must not block the dock.
    }
  }, [sections]);
  const toggleSection = (section: FmsSetupSection, open: boolean) => setSections((current) => ({
    ...current,
    open: open ? [...new Set([...current.open, section])] : current.open.filter((value) => value !== section),
    visited: open ? [...new Set([...current.visited, section])] : current.visited,
  }));
  const registeredCount = (data.globalResponse?.markets ?? [data.response])
    .reduce((sum, market) => sum + market.patterns.filter((pattern) => pattern.currentEligible).length, 0);

  return (
    <section className="fms-setups-workspace" aria-label="Registered setups, research, and knowledge">
      <header><div><span>Registered Setups</span></div><small>{registeredCount} frozen contracts</small></header>
      <details className="fms-setups-workspace-root" open={sections.workspaceOpen} onToggle={(event) => {
        const open = event.currentTarget.open;
        setSections((current) => ({ ...current, workspaceOpen: open }));
      }}>
        <summary><span>Registered setup benchmarks</span><strong>{registeredCount}</strong><ChevronDown size={14} /></summary>
        <div className="fms-setups-workspace-sections">
          <details open={sections.open.includes("benchmarks")} onToggle={(event) => toggleSection("benchmarks", event.currentTarget.open)}>
            <summary><span>Benchmarks</span><small>Frozen contracts and historical evidence</small><ChevronDown size={13} /></summary>
            {sections.visited.includes("benchmarks") ? <ChartMacroBiasRealtimeCard data={data} view="setups" embedded /> : null}
          </details>
          <details open={sections.open.includes("research")} onToggle={(event) => toggleSection("research", event.currentTarget.open)}>
            <summary><span>Research / reviews</span><small>Diagnostics, queues, and candidates</small><ChevronDown size={13} /></summary>
            {sections.visited.includes("research") ? <ChartMacroBiasRealtimeCard data={data} view="research" embedded /> : null}
          </details>
          <details open={sections.open.includes("knowledge")} onToggle={(event) => toggleSection("knowledge", event.currentTarget.open)}>
            <summary><span>Knowledge</span><small>Durable findings and research ledger</small><ChevronDown size={13} /></summary>
            {sections.visited.includes("knowledge") ? <ChartFmsKnowledgeCard data={data} embedded /> : null}
          </details>
        </div>
      </details>
    </section>
  );
}

interface ChartFmsDockProps {
  dockRef: Ref<HTMLElement>;
  width: number;
  tab: FmsDockTab;
  audit: ChartMacroBiasAuditData | null;
  realtime: ChartMacroBiasRealtimeCardData | null;
  loading: boolean;
  historicalMatchesVisible: boolean;
  historicalMatchesCount: number;
  historicalPatternFilters: Array<{ id: string; label: string; count: number; checked: boolean }>;
  tradeViewState: FmsTradeViewState;
  onTradeViewStateChange: (state: FmsTradeViewState) => void;
  onSelectTab: (tab: FmsDockPrimaryTab) => void;
  onSelectAuditTab: () => void;
  onToggleHistoricalMatches: () => void;
  onToggleHistoricalPattern: (patternId: string) => void;
  onSetAllHistoricalPatterns: (visible: boolean) => void;
  onGoToArrow: (market: string, signal: MacroSignalChartSignal) => void;
  onResizePointerDown: PointerEventHandler<HTMLDivElement>;
  onResizeKeyDown: KeyboardEventHandler<HTMLDivElement>;
}

export function ChartFmsDock({
  dockRef,
  width,
  tab,
  audit,
  realtime,
  loading,
  historicalMatchesVisible,
  historicalMatchesCount,
  historicalPatternFilters,
  tradeViewState,
  onTradeViewStateChange,
  onSelectTab,
  onSelectAuditTab,
  onToggleHistoricalMatches,
  onToggleHistoricalPattern,
  onSetAllHistoricalPatterns,
  onGoToArrow,
  onResizePointerDown,
  onResizeKeyDown,
}: ChartFmsDockProps) {
  return (
    <aside ref={dockRef} className="chart-fms-dock" style={{ width }} aria-label="FMS chart workspace">
      <nav className="chart-fms-dock-tabs" aria-label="FMS windows">
        <button type="button" className={tab === "trade" ? "is-active" : ""} disabled={!realtime} onClick={() => onSelectTab("trade")} title="Current action">Trade</button>
        <button type="button" className={tab === "journal" ? "is-active" : ""} disabled={!realtime} onClick={() => onSelectTab("journal")} title="Daily model and demo results">Journal</button>
        <button type="button" className={tab === "setups" ? "is-active" : ""} disabled={!realtime} onClick={() => onSelectTab("setups")}>Setups</button>
        <button type="button" className={tab === "result" ? "is-active" : ""} disabled={!audit} onClick={onSelectAuditTab}>Past Result</button>
      </nav>
      <div className="chart-fms-dock-content">
        <FmsDockErrorBoundary key={tab}>
          {tab === "result" && audit
            ? <ChartMacroBiasAudit data={audit} />
            : tab === "trade" && realtime
              ? <ChartFmsActionCard
                  data={realtime}
                  historicalMatchesVisible={historicalMatchesVisible}
                  historicalMatchesCount={historicalMatchesCount}
                  historicalPatternFilters={historicalPatternFilters}
                  onToggleHistoricalMatches={onToggleHistoricalMatches}
                  onToggleHistoricalPattern={onToggleHistoricalPattern}
                  onSetAllHistoricalPatterns={onSetAllHistoricalPatterns}
                  onGoToArrow={onGoToArrow}
                  viewState={tradeViewState}
                  onViewStateChange={onTradeViewStateChange}
                />
              : tab === "journal" && realtime
                ? <ChartFmsJournalCard data={realtime} />
                : tab === "setups" && realtime
                  ? <FmsSetupsWorkspace data={realtime} />
                  : <section className="chart-fms-dock-loading" aria-live="polite">
                      <strong>{loading ? "Loading FMS Trade…" : "FMS Trade unavailable"}</strong>
                      <span>{loading ? "Cached decisions and the selected market are being restored." : "No registered FMS response is available for this market."}</span>
                    </section>}
        </FmsDockErrorBoundary>
      </div>
      <div
        className="chart-fms-dock-resize"
        role="separator"
        tabIndex={0}
        aria-label="Resize FMS panel"
        aria-orientation="vertical"
        aria-valuemin={FMS_DOCK_MIN_WIDTH}
        aria-valuemax={720}
        aria-valuenow={width}
        onPointerDown={onResizePointerDown}
        onKeyDown={onResizeKeyDown}
      />
    </aside>
  );
}
