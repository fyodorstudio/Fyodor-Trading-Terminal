import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
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
import type { ChartMacroBiasAuditData } from "@/app/components/ChartMacroBiasAudit";
import { ChartMacroBiasRealtimeCard, type ChartMacroBiasRealtimeCardData } from "@/app/components/ChartMacroBiasRealtimeCard";
import { FMS_DOCK_MIN_WIDTH, type FmsDockPrimaryTab, type FmsDockTab } from "@/app/features/chart-viewport/chartPanelState";
import { ChartMacroBiasAuditReview } from "@/app/features/fms-dock/ChartMacroBiasAuditReview";
import { recordAppActivity } from "@/app/features/chart-shell/appActivityLog";
import { FMS_BASELINE_DISPLAY_VERSION, FMS_BASELINE_GENERATION_SUMMARY, FMS_SUCCESSOR_DISPLAY_VERSION, FMS_SUCCESSOR_GENERATION_SUMMARY } from "@/app/lib/fmsDisplayVersion";
import type { FmsDisplayVersion } from "@/app/lib/fmsDisplayVersion";
import type { MacroSignalChartSignal } from "@/app/types";

class FmsDockErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : "Unknown FMS panel error" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("FMS dock render failed", error, info);
    recordAppActivity({
      level: "error",
      source: "FMS dock",
      message: error.message || "Panel render failed",
      detail: info.componentStack?.trim().slice(0, 400) || null,
    });
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
const FmsRecipeCatalogue = lazy(() => import("./FmsRecipeCatalogue"));

type FmsSetupSection = "benchmarks" | "research" | "knowledge";

function loadFmsSetupSections(): { open: FmsSetupSection[]; visited: FmsSetupSection[] } {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(FMS_SETUPS_STATE_KEY) ?? "null");
    const valid = (value: unknown): value is FmsSetupSection => (
      value === "benchmarks" || value === "research" || value === "knowledge"
    );
    return {
      open: Array.isArray(parsed?.open) ? parsed.open.filter(valid) : [],
      visited: Array.isArray(parsed?.visited) ? parsed.visited.filter(valid) : [],
    };
  } catch {
    return { open: [], visited: [] };
  }
}

export function FmsSetupsWorkspace({ data }: { data: ChartMacroBiasRealtimeCardData }) {
  const [sections, setSections] = useState(loadFmsSetupSections);
  // Persisted "visited" is not permission to load offline evidence on startup.
  // Once opened this mount, retain its filter/expanded state across disclosures.
  const [catalogueRequested, setCatalogueRequested] = useState(sections.open.includes("research"));
  useEffect(() => {
    try {
      window.sessionStorage.setItem(FMS_SETUPS_STATE_KEY, JSON.stringify(sections));
    } catch {
      // Optional session continuity must not block the dock.
    }
  }, [sections]);
  const toggleSection = (section: FmsSetupSection, open: boolean) => {
    if (section === "research" && open) setCatalogueRequested(true);
    setSections((current) => ({
      ...current,
      open: open ? [...new Set([...current.open, section])] : current.open.filter((value) => value !== section),
      visited: open ? [...new Set([...current.visited, section])] : current.visited,
    }));
  };
  const registeredCount = (data.globalResponse?.markets ?? [data.response])
    .reduce((sum, market) => sum + market.patterns.filter((pattern) => pattern.currentEligible).length, 0);
  const successorCount = (data.globalResponse?.markets ?? [data.response])
    .reduce((sum, market) => sum + market.patterns.filter((pattern) => pattern.currentEligible && pattern.registeredVersion === FMS_SUCCESSOR_DISPLAY_VERSION).length, 0);

  return (
    <section className="fms-setups-workspace" aria-label="Registered setups, research, and knowledge">
      <header><div><span>Registered FMS versions</span></div><small>{registeredCount} eligible frozen recipes</small></header>
        <div className="fms-setups-workspace-sections">
          <details open={sections.open.includes("benchmarks")} onToggle={(event) => toggleSection("benchmarks", event.currentTarget.open)}>
            <summary><span>Registered setup versions</span><small>{successorCount} {FMS_SUCCESSOR_DISPLAY_VERSION} · {registeredCount - successorCount} {FMS_BASELINE_DISPLAY_VERSION}</small><ChevronDown size={13} /></summary>
            {successorCount > 0 ? <p className="fms-version-generation-summary"><b>{FMS_SUCCESSOR_DISPLAY_VERSION}:</b> {FMS_SUCCESSOR_GENERATION_SUMMARY}</p> : null}
            <p className="fms-version-generation-summary"><b>{FMS_BASELINE_DISPLAY_VERSION}:</b> {FMS_BASELINE_GENERATION_SUMMARY}</p>
            {sections.visited.includes("benchmarks") ? <ChartMacroBiasRealtimeCard data={data} view="setups" embedded /> : null}
          </details>
          <details open={sections.open.includes("research")} onToggle={(event) => toggleSection("research", event.currentTarget.open)}>
            <summary><span>Research / reviews</span><small>Diagnostics, queues, and candidates</small><ChevronDown size={13} /></summary>
            {sections.visited.includes("research") ? <>
              {catalogueRequested ? <Suspense fallback={<p className="fms-version-generation-summary">Loading saved research catalogue…</p>}><FmsRecipeCatalogue /></Suspense> : null}
              <ChartMacroBiasRealtimeCard data={data} view="research" embedded />
            </> : null}
          </details>
          <details open={sections.open.includes("knowledge")} onToggle={(event) => toggleSection("knowledge", event.currentTarget.open)}>
            <summary><span>Knowledge</span><small>Durable findings and research ledger</small><ChevronDown size={13} /></summary>
            {sections.visited.includes("knowledge") ? <ChartFmsKnowledgeCard data={data} embedded /> : null}
          </details>
        </div>
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
  arrowVersion: FmsDisplayVersion;
  historicalPatternFilters: Array<{ id: string; label: string; count: number; checked: boolean }>;
  tradeViewState: FmsTradeViewState;
  onTradeViewStateChange: (state: FmsTradeViewState) => void;
  onSelectTab: (tab: FmsDockPrimaryTab) => void;
  onSelectAuditTab: () => void;
  onToggleHistoricalMatches: () => void;
  onSelectArrowVersion: (version: FmsDisplayVersion) => void;
  onToggleHistoricalPattern: (patternId: string) => void;
  onSetAllHistoricalPatterns: (visible: boolean) => void;
  onGoToArrow: (market: string, signal: MacroSignalChartSignal) => void;
  onGoToEvent: (market: string, eventTime: number) => void;
  onReviewSetup: (market: string, patternId: string) => void;
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
  arrowVersion,
  historicalPatternFilters,
  tradeViewState,
  onTradeViewStateChange,
  onSelectTab,
  onSelectAuditTab,
  onToggleHistoricalMatches,
  onSelectArrowVersion,
  onToggleHistoricalPattern,
  onSetAllHistoricalPatterns,
  onGoToArrow,
  onGoToEvent,
  onReviewSetup,
  onResizePointerDown,
  onResizeKeyDown,
}: ChartFmsDockProps) {
  const journalVisitedRef = useRef(tab === "journal");
  if (tab === "journal") journalVisitedRef.current = true;
  return (
    <aside ref={dockRef} className="chart-fms-dock" style={{ width }} aria-label="FMS chart workspace">
      <nav className="chart-fms-dock-tabs" aria-label="FMS windows">
        <button type="button" className={tab === "trade" ? "is-active" : ""} disabled={!realtime} onClick={() => onSelectTab("trade")} title="Current action">Trade</button>
        <button type="button" className={tab === "journal" ? "is-active" : ""} disabled={!realtime} onClick={() => onSelectTab("journal")} title="Daily model and demo results">Journal</button>
        <button type="button" className={tab === "setups" ? "is-active" : ""} disabled={!realtime} onClick={() => onSelectTab("setups")}>Setups</button>
        <button type="button" className={tab === "result" ? "is-active" : ""} disabled={!audit} onClick={onSelectAuditTab}>Past Result</button>
      </nav>
      <div className="chart-fms-dock-content">
        {journalVisitedRef.current && realtime ? (
          <div className="chart-fms-dock-pane" hidden={tab !== "journal"}>
            <FmsDockErrorBoundary>
              <ChartFmsJournalCard data={realtime} onGoToArrow={onGoToArrow} onGoToEvent={onGoToEvent} />
            </FmsDockErrorBoundary>
          </div>
        ) : null}
        {tab !== "journal" || !realtime ? <FmsDockErrorBoundary key={tab}>
          {tab === "result" && audit
            ? <ChartMacroBiasAuditReview data={audit} />
            : tab === "trade" && realtime
              ? <ChartFmsActionCard
                  data={realtime}
                  historicalMatchesVisible={historicalMatchesVisible}
                  historicalMatchesCount={historicalMatchesCount}
                  arrowVersion={arrowVersion}
                  historicalPatternFilters={historicalPatternFilters}
                  onToggleHistoricalMatches={onToggleHistoricalMatches}
                  onSelectArrowVersion={onSelectArrowVersion}
                  onToggleHistoricalPattern={onToggleHistoricalPattern}
                  onSetAllHistoricalPatterns={onSetAllHistoricalPatterns}
                  onGoToArrow={onGoToArrow}
                  onGoToEvent={onGoToEvent}
                  onReviewSetup={onReviewSetup}
                  viewState={tradeViewState}
                  onViewStateChange={onTradeViewStateChange}
                />
              : tab === "setups" && realtime
                  ? <FmsSetupsWorkspace data={realtime} />
                  : <section className="chart-fms-dock-loading" aria-live="polite">
                      <strong>{loading ? "Loading FMS Trade…" : "FMS Trade unavailable"}</strong>
                      <span>{loading ? "Cached decisions and the selected market are being restored." : "No registered FMS response is available for this market."}</span>
                    </section>}
        </FmsDockErrorBoundary> : null}
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
