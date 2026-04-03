import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ChevronDown, Database, Radio, TriangleAlert } from "lucide-react";
import { TERMINOLOGY } from "@/app/config/terminology";
import { formatCountdown, formatRelativeAge, formatUtcClock } from "@/app/lib/format";
import { resolveTrustState } from "@/app/lib/status";
import type { BridgeHealth, BridgeStatus, MarketStatusResponse } from "@/app/types";

interface MinimalHeaderProps {
  currentTime: Date;
  health: BridgeHealth;
  feedStatus: BridgeStatus;
  marketStatus: MarketStatusResponse | null;
  selectedSymbol: string;
  resolvedBanks: number;
  nextHighImpact?: { title: string; currency: string; time: number } | null;
}

export function MinimalHeader({
  currentTime,
  health,
  feedStatus,
  marketStatus,
  selectedSymbol,
  resolvedBanks,
  nextHighImpact
}: MinimalHeaderProps) {
  const [showDetails, setShowDetails] = useState(false);
  const trustState = useMemo(() => resolveTrustState(health, feedStatus, marketStatus), [health, feedStatus, marketStatus]);

  const localTime = useMemo(
    () =>
      currentTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [currentTime],
  );

  const localDate = useMemo(
    () =>
      currentTime.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      }),
    [currentTime],
  );

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
    if (health.ok) return { label: "Connected", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    return { label: "Unavailable", tone: "text-rose-700 bg-rose-50 border-rose-200" };
  }, [health.ok]);

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
  const lastIngest = formatRelativeAge(health.last_calendar_ingest_at ?? null);
  const mt5Clock = marketStatus?.server_time ? formatUtcClock(marketStatus.server_time) : "MT5 time unavailable";
  const eventSummary = nextHighImpact
    ? `${nextHighImpact.currency} ${nextHighImpact.title}`
    : feedStatus === "loading"
      ? "Checking the event horizon"
      : "No upcoming high-impact event";

  return (
    <div className="mb-6">
      <div className="fixed top-0 left-0 right-0 z-[910] border-b border-slate-200 bg-white">
        <div className="max-w-[1460px] mx-auto px-6">
          <div className="flex min-h-[56px] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-5">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-950">Fyodor Trading Terminal</div>
                <div className="text-xs text-slate-500">{localTime} {localDate}</div>
              </div>
              <div className="hidden min-w-0 items-center gap-3 md:flex">
                <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium ${primaryState.tone}`}>
                  <PrimaryIcon size={14} />
                  <span>{primaryState.label}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-700">{TERMINOLOGY.trustState.questionLabel}</div>
                  <div className="text-xs text-slate-500">{primaryState.detail}</div>
                </div>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-3">
              <div className="hidden min-w-0 md:block">
                <div className="truncate text-xs text-slate-950">{eventSummary}</div>
                <div className="text-xs text-slate-500">
                  {nextHighImpact ? `${nextHighImpact.currency} event is next in line` : "No immediate event warning"}
                </div>
              </div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span>{showDetails ? "Hide details" : "Show details"}</span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-150 ${showDetails ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="h-14" />

      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            className="fixed left-0 right-0 top-14 z-[900] border-b border-slate-200 bg-white"
          >
            <div className="max-w-[1460px] mx-auto px-6 py-5">
              <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr_1fr_1.15fr]">
                <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-sm font-semibold text-slate-950">System health</h2>
                  <div className="mt-3 grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-600">{TERMINOLOGY.trustState.sectionLabel}</span>
                      <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${primaryState.tone}`}>
                        {trustState.verdictLabel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-600">MT5</span>
                      <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${mt5State.tone}`}>{mt5State.label}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-600">Bridge</span>
                      <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${bridgeState.tone}`}>{bridgeState.label}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-600">{TERMINOLOGY.calendarTiming.sectionLabel}</span>
                      <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${calendarState.tone}`}>{calendarState.label}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-600">{TERMINOLOGY.symbolContext.sectionLabel}</span>
                      <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${symbolState.tone}`}>{symbolState.label}</span>
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-4">
                  <h2 className="text-sm font-semibold text-slate-950">Time context</h2>
                  <div className="mt-3 grid gap-3">
                    <div>
                      <div className="text-sm text-slate-600">Local time</div>
                      <div className="mt-1 text-sm font-medium text-slate-950">{localTime} {localDate}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-600">MT5 feed time</div>
                      <div className="mt-1 text-sm font-medium text-slate-950">{mt5Clock}</div>
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-4">
                  <h2 className="text-sm font-semibold text-slate-950">Feed diagnostics</h2>
                  <div className="mt-3 grid gap-3">
                    <div>
                      <div className="text-sm text-slate-600">{TERMINOLOGY.trustState.sectionLabel} Note</div>
                      <div className="mt-1 text-sm font-medium text-slate-950">{trustState.detail}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-600">{TERMINOLOGY.labels.lastIngest}</div>
                      <div className="mt-1 text-sm font-medium text-slate-950">{lastIngest}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-600">{TERMINOLOGY.labels.resolvedBanks}</div>
                      <div className="mt-1 text-sm font-medium text-slate-950">{resolvedBanks} of 8</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-600">{TERMINOLOGY.symbolContext.sectionLabel}</div>
                      <div className="mt-1 text-sm font-medium text-slate-950">{symbolState.detail}</div>
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-4">
                  <h2 className="text-sm font-semibold text-slate-950">Event horizon</h2>
                  {nextHighImpact ? (
                    <div className="mt-3 grid gap-3">
                      <div>
                        <div className="text-sm text-slate-600">Next high-impact event</div>
                        <div className="mt-1 text-sm font-medium text-slate-950">{nextHighImpact.title}</div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-600">Currency</div>
                        <div className="mt-1 text-sm font-medium text-slate-950">{nextHighImpact.currency}</div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-600">Countdown</div>
                        <div className="mt-1 text-sm font-medium text-slate-950">{formatCountdown(nextHighImpact.time)}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                      <Database size={16} className="mt-0.5 shrink-0 text-slate-400" />
                      <span>No high-impact event is currently scheduled in the loaded feed window.</span>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
