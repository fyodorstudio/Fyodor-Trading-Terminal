import { CalendarClock, Clock3 } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { TERMINOLOGY } from "@/app/config/terminology";
import { formatCountdown } from "@/app/lib/format";

interface HeaderStateBadge {
  label: string;
  tone: string;
}

interface HeaderSymbolState extends HeaderStateBadge {
  detail: string;
}

interface MinimalHeaderDetailsPanelProps {
  healthDotTone: string;
  trustVerdictLabel: string;
  trustDetail: string;
  primaryTone: string;
  mt5State: HeaderStateBadge;
  bridgeState: HeaderStateBadge;
  calendarState: HeaderStateBadge;
  symbolState: HeaderSymbolState;
  localClock: string;
  mt5Clock: string;
  nextHighImpact?: { title: string; currency: string; countryCode: string; time: number } | null;
  nextHighImpactTime: string | null;
  lastIngest: string;
  mt5Error: string | null;
  resolvedBanks: number;
}

export function MinimalHeaderDetailsPanel({
  healthDotTone,
  trustVerdictLabel,
  trustDetail,
  primaryTone,
  mt5State,
  bridgeState,
  calendarState,
  symbolState,
  localClock,
  mt5Clock,
  nextHighImpact,
  nextHighImpactTime,
  lastIngest,
  mt5Error,
  resolvedBanks,
}: MinimalHeaderDetailsPanelProps) {
  return (
    <div className="w-full max-w-none px-4 py-4">
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
                <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${primaryTone}`}>
                  {trustVerdictLabel}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="text-sm text-slate-600">MT5</span>
                <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${mt5State.tone}`}>
                  {mt5State.label}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="text-sm text-slate-600">Bridge</span>
                <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${bridgeState.tone}`}>
                  {bridgeState.label}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="text-sm text-slate-600">{TERMINOLOGY.calendarTiming.sectionLabel}</span>
                <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${calendarState.tone}`}>
                  {calendarState.label}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="text-sm text-slate-600">{TERMINOLOGY.symbolContext.sectionLabel}</span>
                <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${symbolState.tone}`}>
                  {symbolState.label}
                </span>
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
              <span className="rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">
                Calendar feed
              </span>
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
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                MT5 + broker rows
              </span>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_1fr]">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  {TERMINOLOGY.trustState.sectionLabel} note
                </div>
                <div className="mt-1 text-sm font-semibold leading-5 text-slate-950">{trustDetail}</div>
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
  );
}
