import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CalendarClock, ChevronsDown, ChevronsUp, Clock3, Radio, TriangleAlert } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { TabNavigation } from "@/app/components/TabNavigation";
import { TERMINOLOGY } from "@/app/config/terminology";
import { formatCountdown, formatLocalClock, formatRelativeAge, formatUtcClock, formatUtcDateTime } from "@/app/lib/format";
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
  nextHighImpact
}: MinimalHeaderProps) {
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [pinnedExpanded, setPinnedExpanded] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trustState = useMemo(() => resolveTrustState(health, feedStatus, marketStatus), [health, feedStatus, marketStatus]);
  const showDetails = hoverExpanded || pinnedExpanded;

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openDetails = () => {
    clearCloseTimer();
    setHoverExpanded(true);
  };

  const scheduleCloseDetails = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setHoverExpanded(false), 120);
  };

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
        <div className="max-w-[1460px] mx-auto px-6">
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
                  setActiveTab={setActiveTab}
                  tabOrder={tabOrder}
                  placement="header"
                />
              </div>
            )}

            <div className="flex shrink-0 items-center gap-3">
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
            <div className="max-w-[1460px] mx-auto px-6 py-5">
              <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="grid gap-4">
                  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-slate-950">System health</h2>
                      <span className={`h-2.5 w-2.5 rounded-full ${healthDotTone}`} />
                    </div>
                    <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50/50">
                      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <span className="text-sm text-slate-600">{TERMINOLOGY.trustState.sectionLabel}</span>
                        <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${primaryState.tone}`}>
                          {trustState.verdictLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <span className="text-sm text-slate-600">MT5</span>
                        <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${mt5State.tone}`}>{mt5State.label}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <span className="text-sm text-slate-600">Bridge</span>
                        <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${bridgeState.tone}`}>{bridgeState.label}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <span className="text-sm text-slate-600">{TERMINOLOGY.calendarTiming.sectionLabel}</span>
                        <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${calendarState.tone}`}>{calendarState.label}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <span className="text-sm text-slate-600">{TERMINOLOGY.symbolContext.sectionLabel}</span>
                        <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${symbolState.tone}`}>{symbolState.label}</span>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-cyan-500" />
                      <h2 className="text-sm font-semibold text-slate-950">Time context</h2>
                    </div>
                    <div className="mt-4 grid gap-3">
                      <div className="rounded-lg border border-cyan-200 bg-cyan-50/50 px-3 py-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Local workstation</div>
                        <div className="mt-1 text-sm font-semibold leading-5 text-slate-950">{localClock}</div>
                      </div>
                      <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 px-3 py-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600">MT5 server feed</div>
                        <div className="mt-1 text-sm font-semibold leading-5 text-slate-950">{mt5Clock}</div>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="grid gap-4">
                  <section className="rounded-lg border border-slate-200 bg-gradient-to-br from-white via-sky-50/70 to-emerald-50/70 p-4 shadow-sm shadow-slate-950/[0.04]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-sky-600" />
                        <h2 className="text-sm font-semibold text-slate-950">Event horizon</h2>
                      </div>
                      <span className="rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">Calendar feed</span>
                    </div>
                    {nextHighImpact ? (
                      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                        <div className="rounded-lg border border-white bg-white/80 p-4 shadow-sm shadow-slate-950/[0.03]">
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-sky-600">
                            <FlagIcon countryCode={nextHighImpact.countryCode} className="h-4 w-6" />
                            {nextHighImpact.currency} high impact
                          </div>
                          <div className="mt-3 text-xl font-black leading-6 text-slate-950">{nextHighImpact.title}</div>
                          <div className="mt-2 text-sm font-medium text-slate-600">
                            This is the nearest loaded high-impact release in the broker calendar.
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <div className="rounded-lg border border-sky-200 bg-white px-3 py-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Countdown</div>
                            <div className="mt-1 text-lg font-black text-slate-950">{formatCountdown(nextHighImpact.time)}</div>
                          </div>
                          <div className="rounded-lg border border-emerald-200 bg-white px-3 py-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Release time</div>
                            <div className="mt-1 text-sm font-black text-slate-950">{nextHighImpactTime}</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 flex items-start gap-3 rounded-lg border border-dashed border-slate-300 bg-white/80 p-4 text-sm text-slate-600">
                        <CalendarClock size={17} className="mt-0.5 shrink-0 text-slate-400" />
                        <span>No high-impact event is currently scheduled in the loaded feed window.</span>
                      </div>
                    )}
                  </section>

                  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold text-slate-950">Feed diagnostics</h2>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">MT5 + broker rows</span>
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_1fr]">
                      <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{TERMINOLOGY.trustState.sectionLabel} note</div>
                        <div className="mt-1 text-sm font-semibold leading-5 text-slate-950">{trustState.detail}</div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{TERMINOLOGY.labels.lastIngest}</div>
                          <div className="mt-1 text-sm font-semibold text-slate-950">{lastIngest}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{TERMINOLOGY.labels.resolvedBanks}</div>
                          <div className="mt-1 text-sm font-semibold text-slate-950">{resolvedBanks} of 8</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">MT5 / bridge message</div>
                        <div className="mt-1 text-sm font-semibold leading-5 text-slate-950">{mt5Error ?? "No current bridge message."}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{TERMINOLOGY.symbolContext.sectionLabel}</div>
                        <div className="mt-1 text-sm font-semibold leading-5 text-slate-950">{symbolState.detail}</div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
