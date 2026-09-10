import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Radio, TriangleAlert } from "lucide-react";
import { MinimalHeaderDetailsPanel } from "@/app/components/MinimalHeaderDetailsPanel";
import { TERMINOLOGY } from "@/app/config/terminology";
import { formatLocalClock, formatRelativeAge, formatUtcClock, formatUtcDateTime } from "@/app/lib/format";
import { resolveTrustState } from "@/app/lib/status";
import type { BridgeHealth, BridgeStatus, MarketStatusResponse } from "@/app/types";

interface ChartTrustStateControlProps {
  currentTime: Date;
  health: BridgeHealth;
  feedStatus: BridgeStatus;
  marketStatus: MarketStatusResponse | null;
  selectedSymbol: string;
  resolvedBanks: number;
  nextHighImpact?: { title: string; currency: string; countryCode: string; time: number } | null;
}

export function ChartTrustStateControl({
  currentTime,
  health,
  feedStatus,
  marketStatus,
  selectedSymbol,
  resolvedBanks,
  nextHighImpact,
}: ChartTrustStateControlProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trustState = useMemo(
    () => resolveTrustState(health, feedStatus, marketStatus),
    [health, feedStatus, marketStatus],
  );

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const calendarState = feedStatus === "live"
    ? { label: TERMINOLOGY.calendarTiming.states.live.medium, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" }
    : feedStatus === "stale"
      ? { label: TERMINOLOGY.calendarTiming.states.stale.medium, tone: "text-amber-700 bg-amber-50 border-amber-200" }
      : feedStatus === "error"
        ? { label: TERMINOLOGY.calendarTiming.states.error.medium, tone: "text-rose-700 bg-rose-50 border-rose-200" }
        : { label: feedStatus === "loading" ? TERMINOLOGY.calendarTiming.states.loading.medium : TERMINOLOGY.calendarTiming.states.no_data.medium, tone: "text-slate-700 bg-slate-100 border-slate-200" };
  const mt5State = health.terminal_connected
    ? { label: "Connected", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" }
    : { label: "Waiting", tone: "text-amber-700 bg-amber-50 border-amber-200" };
  const bridgeState = health.bridge_connected ?? health.ok
    ? { label: "Connected", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" }
    : { label: "Unavailable", tone: "text-rose-700 bg-rose-50 border-rose-200" };
  const symbolState = !marketStatus || !marketStatus.terminal_connected
    ? { label: TERMINOLOGY.symbolContext.states.missing.medium, detail: TERMINOLOGY.symbolContext.states.missing.detail, tone: "text-rose-700 bg-rose-50 border-rose-200" }
    : marketStatus.session_state === "open"
      ? { label: TERMINOLOGY.symbolContext.states.open.medium, detail: `${selectedSymbol} ${TERMINOLOGY.symbolContext.states.open.detail.toLowerCase()}`, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" }
      : marketStatus.session_state === "closed"
        ? { label: TERMINOLOGY.symbolContext.states.closed.medium, detail: `${selectedSymbol} ${TERMINOLOGY.symbolContext.states.closed.detail.toLowerCase()}`, tone: "text-amber-700 bg-amber-50 border-amber-200" }
        : { label: TERMINOLOGY.symbolContext.states.unavailable.medium, detail: `${selectedSymbol} ${TERMINOLOGY.symbolContext.states.unavailable.detail.toLowerCase()}`, tone: "text-slate-700 bg-slate-100 border-slate-200" };
  const primaryState = trustState.verdict === "yes"
    ? { label: `Trust State: ${TERMINOLOGY.trustState.states.yes.short}`, tone: "is-yes", textTone: "text-emerald-700", icon: Radio }
    : trustState.verdict === "limited"
      ? { label: `Trust State: ${TERMINOLOGY.trustState.states.limited.short}`, tone: "is-limited", textTone: "text-amber-700", icon: TriangleAlert }
      : { label: `Trust State: ${TERMINOLOGY.trustState.states.no.short}`, tone: "is-no", textTone: "text-rose-700", icon: AlertCircle };
  const healthDotTone = trustState.verdict === "yes" ? "bg-emerald-400" : trustState.verdict === "limited" ? "bg-amber-400" : "bg-rose-400";
  const mt5Error = health.last_error && (health.last_error.message || health.last_error.code != null)
    ? `${health.last_error.code ?? "MT5"}${health.last_error.message ? `: ${health.last_error.message}` : ""}`
    : null;
  const PrimaryIcon = primaryState.icon;

  return (
    <div ref={rootRef} className="chart-trust-state-anchor">
      <button
        type="button"
        className={`chart-trust-state-button ${primaryState.tone}`}
        aria-expanded={open}
        title={trustState.detail}
        onClick={() => setOpen((current) => !current)}
      >
        <PrimaryIcon size={14} />
        <span>{primaryState.label}</span>
      </button>
      {open ? (
        <div className="chart-trust-state-popover" role="dialog" aria-label="Trust State details">
          <MinimalHeaderDetailsPanel
            healthDotTone={healthDotTone}
            trustVerdictLabel={trustState.verdictLabel}
            trustDetail={trustState.detail}
            primaryTone={primaryState.textTone}
            mt5State={mt5State}
            bridgeState={bridgeState}
            calendarState={calendarState}
            symbolState={symbolState}
            localClock={formatLocalClock(currentTime)}
            mt5Clock={marketStatus?.server_time ? formatUtcClock(marketStatus.server_time) : "MT5 time unavailable"}
            nextHighImpact={nextHighImpact}
            nextHighImpactTime={nextHighImpact ? `${formatUtcDateTime(nextHighImpact.time)} UTC` : null}
            lastIngest={formatRelativeAge(health.last_calendar_ingest_at ?? null)}
            mt5Error={mt5Error}
            resolvedBanks={resolvedBanks}
          />
        </div>
      ) : null}
    </div>
  );
}
