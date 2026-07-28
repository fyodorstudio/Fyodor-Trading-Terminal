import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ChevronsDown, ChevronsUp, Radio, Settings, TriangleAlert } from "lucide-react";
import { MinimalHeaderDetailsPanel } from "@/app/components/MinimalHeaderDetailsPanel";
import { TabNavigation } from "@/app/components/TabNavigation";
import { TERMINOLOGY } from "@/app/config/terminology";
import { formatLocalClock, formatRelativeAge, formatUtcClock, formatUtcDateTime } from "@/app/lib/format";
import { resolveTrustState } from "@/app/lib/status";
import type { AppTabConfig } from "@/app/config/navigation";
import type { BridgeHealth, BridgeStatus, MarketStatusResponse, TabId } from "@/app/types";

interface MinimalHeaderProps {
  activeTab: TabId;
  currentTime: Date;
  health: BridgeHealth;
  feedStatus: BridgeStatus;
  marketStatus: MarketStatusResponse | null;
  setActiveTab: (id: TabId) => void;
  selectedSymbol: string;
  tabOrder: AppTabConfig[];
  resolvedBanks: number;
  nextHighImpact?: { title: string; currency: string; countryCode: string; time: number } | null;
  onOpenSettings?: () => void;
}

export function MinimalHeader({
  activeTab,
  currentTime,
  health,
  feedStatus,
  marketStatus,
  setActiveTab,
  selectedSymbol,
  tabOrder,
  resolvedBanks,
  nextHighImpact,
  onOpenSettings,
}: MinimalHeaderProps) {
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [pinnedExpanded, setPinnedExpanded] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressHoverOpenRef = useRef(false);
  const trustState = useMemo(() => resolveTrustState(health, feedStatus, marketStatus), [health, feedStatus, marketStatus]);
  const showDetails = hoverExpanded || pinnedExpanded;

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openDetails = () => {
    if (suppressHoverOpenRef.current) return;
    clearCloseTimer();
    setHoverExpanded(true);
  };

  const scheduleCloseDetails = () => {
    suppressHoverOpenRef.current = false;
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setHoverExpanded(false), 120);
  };

  const handleTabSelect = useCallback(
    (id: TabId) => {
      if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      suppressHoverOpenRef.current = true;
      setActiveTab(id);
      setHoverExpanded(false);
      setPinnedExpanded(false);
      clearCloseTimer();
    },
    [setActiveTab],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHoverExpanded(false);
        setPinnedExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearCloseTimer();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const headerLocalTime = useMemo(
    () =>
      currentTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [currentTime],
  );

  const headerLocalDate = useMemo(
    () =>
      currentTime.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [currentTime],
  );

  const localClock = useMemo(() => formatLocalClock(currentTime), [currentTime]);

  const calendarState = useMemo(() => {
    if (feedStatus === "live") return { label: TERMINOLOGY.calendarTiming.states.live.medium, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    if (feedStatus === "stale") return { label: TERMINOLOGY.calendarTiming.states.stale.medium, tone: "text-amber-700 bg-amber-50 border-amber-200" };
    if (feedStatus === "loading") return { label: TERMINOLOGY.calendarTiming.states.loading.medium, tone: "text-slate-700 bg-slate-100 border-slate-200" };
    if (feedStatus === "no_data") return { label: TERMINOLOGY.calendarTiming.states.no_data.medium, tone: "text-slate-700 bg-slate-100 border-slate-200" };
    return { label: TERMINOLOGY.calendarTiming.states.error.medium, tone: "text-rose-700 bg-rose-50 border-rose-200" };
  }, [feedStatus]);

  const mt5State = useMemo(() => {
    if (health.terminal_connected) return { label: "Connected", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    return { label: "Waiting", tone: "text-amber-700 bg-amber-50 border-amber-200" };
  }, [health.terminal_connected]);

  const bridgeState = useMemo(() => {
    if (health.bridge_connected ?? health.ok) return { label: "Connected", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    return { label: "Unavailable", tone: "text-rose-700 bg-rose-50 border-rose-200" };
  }, [health.bridge_connected, health.ok]);

  const symbolState = useMemo(() => {
    if (!marketStatus || !marketStatus.terminal_connected) {
      return { label: TERMINOLOGY.symbolContext.states.missing.medium, detail: TERMINOLOGY.symbolContext.states.missing.detail, tone: "text-rose-700 bg-rose-50 border-rose-200" };
    }

    if (marketStatus.session_state === "open") {
      return { label: TERMINOLOGY.symbolContext.states.open.medium, detail: `${selectedSymbol} ${TERMINOLOGY.symbolContext.states.open.detail.toLowerCase()}`, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    }

    if (marketStatus.session_state === "closed") {
      return { label: TERMINOLOGY.symbolContext.states.closed.medium, detail: `${selectedSymbol} ${TERMINOLOGY.symbolContext.states.closed.detail.toLowerCase()}`, tone: "text-amber-700 bg-amber-50 border-amber-200" };
    }

    return { label: TERMINOLOGY.symbolContext.states.unavailable.medium, detail: `${selectedSymbol} ${TERMINOLOGY.symbolContext.states.unavailable.detail.toLowerCase()}`, tone: "text-slate-700 bg-slate-100 border-slate-200" };
  }, [marketStatus, selectedSymbol]);

  const primaryState = useMemo(() => {
    if (trustState.verdict === "yes") {
      return {
        label: `${TERMINOLOGY.trustState.sectionLabel}: ${TERMINOLOGY.trustState.states.yes.short}`,
        detail: trustState.detail,
        tone: "text-emerald-700",
        icon: Radio,
      };
    }

    if (trustState.verdict === "limited") {
      return {
        label: `${TERMINOLOGY.trustState.sectionLabel}: ${TERMINOLOGY.trustState.states.limited.short}`,
        detail: trustState.detail,
        tone: "text-amber-700",
        icon: TriangleAlert,
      };
    }

    return {
      label: `${TERMINOLOGY.trustState.sectionLabel}: ${TERMINOLOGY.trustState.states.no.short}`,
      detail: trustState.detail,
      tone: "text-rose-700",
      icon: AlertCircle,
    };
  }, [trustState]);

  const PrimaryIcon = primaryState.icon;
  const healthDotTone =
    trustState.verdict === "yes"
      ? "bg-emerald-400"
      : trustState.verdict === "limited"
        ? "bg-amber-400"
        : "bg-rose-400";
  const lastIngest = formatRelativeAge(health.last_calendar_ingest_at ?? null);
  const mt5Error =
    health.last_error && (health.last_error.message || health.last_error.code != null)
      ? `${health.last_error.code ?? "MT5"}${health.last_error.message ? `: ${health.last_error.message}` : ""}`
      : null;
  const mt5Clock = marketStatus?.server_time ? formatUtcClock(marketStatus.server_time) : "MT5 time unavailable";
  const nextHighImpactTime = nextHighImpact ? `${formatUtcDateTime(nextHighImpact.time)} UTC` : null;

  return (
    <div>
      <div
        className="fixed left-0 right-0 top-0 z-[910] border-b border-slate-200 bg-white/95 shadow-sm shadow-slate-950/5 backdrop-blur-xl"
        onMouseEnter={openDetails}
        onMouseLeave={scheduleCloseDetails}
        onFocus={openDetails}
        onBlur={scheduleCloseDetails}
      >
        <div className="w-full max-w-none px-4">
          <div className="flex min-h-[58px] items-center justify-between gap-4">
            <div className="flex shrink-0 items-center gap-5">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-950">Fyodor Trading Terminal</div>
                <div className="text-xs text-slate-500">{headerLocalTime} {headerLocalDate}</div>
              </div>
              <div className="hidden min-w-0 items-center gap-3 md:flex">
                <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium ${primaryState.tone}`}>
                  <PrimaryIcon size={14} />
                  <span>{primaryState.label}</span>
                </div>
              </div>
            </div>

            {showDetails && (
              <div className="hidden min-w-0 flex-1 justify-end md:flex">
                <TabNavigation
                  activeTab={activeTab}
                  setActiveTab={handleTabSelect}
                  tabOrder={tabOrder}
                  placement="header"
                />
              </div>
            )}

            <div className="flex shrink-0 items-center gap-3">
              {onOpenSettings ? (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950"
                  aria-label="Open Aesthetic Forge"
                  title="Open Aesthetic Forge"
                >
                  <Settings className="h-4 w-4" />
                </button>
              ) : null}
              <button
                onClick={() => {
                  if (showDetails) {
                    setHoverExpanded(false);
                    setPinnedExpanded(false);
                    return;
                  }
                  setPinnedExpanded(true);
                }}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                aria-expanded={showDetails}
              >
                <span>{showDetails ? "Collapse" : "Expand"}</span>
                {showDetails ? <ChevronsUp className="h-4 w-4" /> : <ChevronsDown className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="h-[70px]" />

      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            className="fixed left-0 right-0 top-[58px] z-[900] max-h-[calc(100vh-58px)] overflow-y-auto border-b border-slate-200 bg-white/98 shadow-xl shadow-slate-950/10 backdrop-blur-xl"
          >
            <MinimalHeaderDetailsPanel
              healthDotTone={healthDotTone}
              trustVerdictLabel={trustState.verdictLabel}
              trustDetail={trustState.detail}
              primaryTone={primaryState.tone}
              mt5State={mt5State}
              bridgeState={bridgeState}
              calendarState={calendarState}
              symbolState={symbolState}
              localClock={localClock}
              mt5Clock={mt5Clock}
              nextHighImpact={nextHighImpact}
              nextHighImpactTime={nextHighImpactTime}
              lastIngest={lastIngest}
              mt5Error={mt5Error}
              resolvedBanks={resolvedBanks}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
