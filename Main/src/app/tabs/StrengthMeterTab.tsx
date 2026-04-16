import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, Info, RefreshCcw, X, Zap } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { FX_PAIRS } from "@/app/config/fxPairs";
import { fetchHistory } from "@/app/lib/bridge";
import { deriveStrengthMeterResult } from "@/app/lib/strengthMeter";
import type {
  BridgeStatus,
  CalendarEvent,
  CentralBankSnapshot,
  StrengthBoardCurrency,
  StrengthPairCandleSet,
  StrengthShortlistItem,
} from "@/app/types";

interface StrengthMeterTabProps {
  snapshots: CentralBankSnapshot[];
  events: CalendarEvent[];
  status: BridgeStatus;
  onOpenCalendarEvent: (event: CalendarEvent) => void;
}

type StrengthDetailState =
  | { kind: "pair"; item: StrengthShortlistItem }
  | { kind: "currency"; item: StrengthBoardCurrency }
  | null;

export function StrengthMeterTab({ snapshots, events, status, onOpenCalendarEvent }: StrengthMeterTabProps) {
  const [candleMap, setCandleMap] = useState<Partial<Record<string, StrengthPairCandleSet>>>({});
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [detailState, setDetailState] = useState<StrengthDetailState>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setHistoryLoading(true);
      setHistoryFailed(false);
      const entries = await Promise.all(
        FX_PAIRS.map(async (pair) => {
          try {
            const [d1, h4] = await Promise.all([
              fetchHistory(pair.name, "D1", 40),
              fetchHistory(pair.name, "H4", 40),
            ]);
            return [pair.name, { d1, h4 }] as const;
          } catch {
            return [pair.name, { d1: [], h4: [] }] as const;
          }
        }),
      );

      if (cancelled) return;
      const nextMap = Object.fromEntries(entries);
      const resolvedPairs = entries.filter(([, candles]) => candles.d1.length >= 20 && candles.h4.length >= 10).length;
      setCandleMap(nextMap);
      setHistoryLoading(false);
      setHistoryFailed(resolvedPairs === 0);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const result = useMemo(
    () => deriveStrengthMeterResult({ snapshots, events, candleMap }),
    [snapshots, events, candleMap],
  );

  const partialNote = result.partialCurrencies.length > 0 ? result.partialCurrencies.join(", ") : null;
  const topPick = result.shortlist[0];
  const otherOpportunities = result.shortlist.slice(1);

  return (
    <section className="tab-panel strength-v5-panel">
      {/* Cinematic Hero */}
      <header className="strength-v5-hero">
        <h1 className="strength-v5-title">Strength Meter</h1>
        <p className="strength-v5-desc">
          A high-conviction shortlist engineered for rapid manual TA. 
          Identify the winner, open the chart, and execute your read.
        </p>

        {/* The System Notch */}
        <div className="strength-v5-notch">
          <div className={`strength-v5-status-item ${!historyLoading && !historyFailed ? "is-active" : ""}`}>
            <span className="strength-v5-status-dot"></span>
            {historyLoading ? "Calculating" : historyFailed ? "Engine Offline" : "Engine Live"}
          </div>
          <div className={`strength-v5-status-item ${status === "live" ? "is-active" : ""}`}>
            <span className="strength-v5-status-dot"></span>
            Calendar {status === "live" ? "Sync" : "Stale"}
          </div>
        </div>
      </header>

      {/* Operational Notice Pill */}
      {partialNote ? (
        <div className="strength-v5-notice">
          <AlertTriangle size={18} />
          <span>Notice: Partial data for {partialNote}. Trade with clinical caution.</span>
        </div>
      ) : null}

      {/* Opportunities Section: Spotlight Layout */}
      <section className="strength-v5-section">
        <div className="strength-v5-section-header">
          <span className="strength-v5-kicker">Priority Shortlist</span>
          <h2 className="strength-v5-section-title">Open First</h2>
        </div>

        <div className="strength-v5-spotlight">
          {topPick && (
            <article className="strength-v5-featured-card">
              <strong className="strength-v5-featured-name">{topPick.pair.name}</strong>
              <p className="strength-v5-featured-summary">{topPick.summary}</p>
              
              <div className="flex flex-wrap justify-center gap-3 mb-10">
                {topPick.reasonTags.map((tag) => (
                  <span key={tag} className="strength-v4-tag py-2 px-4 text-sm font-black tracking-widest is-highlight border-2">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex justify-center gap-6">
                <button
                  type="button"
                  className="py-5 px-12 rounded-2xl bg-indigo-600 text-white font-black text-lg hover:bg-indigo-700 transition-all shadow-xl hover:shadow-indigo-500/20 flex items-center gap-3"
                  onClick={() => setDetailState({ kind: "pair", item: topPick })}
                >
                  <Zap size={20} fill="currentColor" />
                  Inspect Logic
                </button>
                {topPick.eventRefs[0] && (
                  <button
                    type="button"
                    className="py-5 px-8 rounded-2xl border-2 border-slate-200 text-slate-900 font-black text-lg hover:bg-slate-50 transition-all"
                    onClick={() => onOpenCalendarEvent(topPick.eventRefs[0])}
                  >
                    View Event
                  </button>
                )}
              </div>
            </article>
          )}

          <div className="strength-v5-subgrid">
            {otherOpportunities.map((item) => (
              <article key={item.pair.name} className="strength-v5-card">
                <div className="flex justify-between items-start mb-6">
                  <strong className="text-3xl font-black tracking-tighter">{item.pair.name}</strong>
                  <span className="strength-v4-card-score bg-slate-100 text-slate-900 font-black">{item.score.toFixed(0)}</span>
                </div>
                <p className="text-lg mb-8 font-semibold text-slate-600 leading-relaxed">{item.summary}</p>
                <div className="flex gap-4">
                  <button
                    type="button"
                    className="flex-1 py-4 px-6 rounded-2xl bg-slate-900 text-white font-black text-sm hover:bg-black transition-all shadow-lg"
                    onClick={() => setDetailState({ kind: "pair", item })}
                  >
                    Inspect
                  </button>
                  {item.eventRefs[0] && (
                    <button
                      type="button"
                      className="py-4 px-5 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
                      onClick={() => onOpenCalendarEvent(item.eventRefs[0])}
                    >
                      <Activity size={20} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Board Read: Creative Cluster */}
      <section className="strength-v5-section">
        <div className="strength-v5-section-header">
          <span className="strength-v5-kicker">Market Atlas</span>
          <h2 className="strength-v5-section-title">Major Map</h2>
        </div>

        <div className="strength-v5-map-cluster">
          {result.currencies.map((currency) => (
            <button
              key={currency.currency}
              type="button"
              className={`strength-v5-chip is-${currency.state}`}
              onClick={() => setDetailState({ kind: "currency", item: currency })}
            >
              <FlagIcon countryCode={currency.countryCode} className="h-8 w-12 rounded-md" />
              <div className="flex flex-col items-start">
                <strong className="text-xl font-black leading-none">{currency.currency}</strong>
                <span className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase mt-1">{currency.stateLabel}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Pro Terminal Footer */}
      <footer className="strength-v5-footer">
        <div className="strength-v5-footer-item">
          <strong>Methodology</strong>
          <p>Composite weighting: 55% Price Impulse, 25% Event Push, 20% Macro Backdrop. Recalculated live.</p>
        </div>
        <div className="strength-v5-footer-item">
          <strong>Tactical Use</strong>
          <p>This surface is a filter, not a signal engine. Always run your D1 to H1 chart confirmation first.</p>
        </div>
        <div className="strength-v5-footer-item">
          <strong>Trust Limits</strong>
          <p>Confidence scores decay rapidly during news blackouts or when price feeds are marked as stale.</p>
        </div>
      </footer>

      {/* Interaction Layer: Side Drawer (Preserved Logic) */}
      {detailState ? (
        <div className="strength-v4-drawer-overlay" onClick={() => setDetailState(null)}>
          <div className="strength-v4-drawer" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="strength-v4-drawer-head">
              <div className="strength-v4-drawer-title">
                <h2 className="text-4xl font-black">{detailState.kind === "pair" ? detailState.item.pair.name : detailState.item.currency}</h2>
                <p className="font-black tracking-widest uppercase text-xs mt-2 text-indigo-500">
                  {detailState.kind === "pair" ? "Surgical Breakdown" : "Currency Analysis"}
                </p>
              </div>
              <button type="button" className="strength-v4-drawer-close" onClick={() => setDetailState(null)}>
                <X size={24} />
              </button>
            </div>

            <div className="strength-v4-drawer-body">
              <section className="strength-v4-drawer-section">
                <h3 className="text-xs font-black tracking-widest">The Verdict</h3>
                <div className="strength-v4-verdict bg-slate-50 border-none text-slate-800 text-xl font-bold italic leading-relaxed p-8 rounded-3xl">
                  "{detailState.item.summary}"
                </div>
              </section>

              {detailState.kind === "currency" && (
                <section className="strength-v4-drawer-section">
                  <h3 className="text-xs font-black tracking-widest">Weight Distribution</h3>
                  <div className="flex flex-col gap-8">
                    {[
                      { label: "Price Impulse", breakdown: detailState.item.price },
                      { label: "Event Push", breakdown: detailState.item.event },
                      { label: "Macro Structural", breakdown: detailState.item.structural },
                    ].map((ing) => (
                      <div key={ing.label} className="strength-v4-ingredient">
                        <div className="strength-v4-ingredient-head mb-2">
                          <span className="text-slate-500 font-bold">{ing.label}</span>
                          <span className="text-slate-950 font-black">{(ing.breakdown.contribution * 100).toFixed(0)}% Impact</span>
                        </div>
                        <div className="strength-v4-bar-track h-3 bg-slate-100 rounded-full">
                          <div
                            className="strength-v4-bar-fill rounded-full bg-indigo-600 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                            style={{ width: `${Math.abs(ing.breakdown.value * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="strength-v4-drawer-section">
                <h3 className="text-xs font-black tracking-widest">Supporting Data</h3>
                <div className="strength-v4-evidence-list">
                  {detailState.item.evidence.map((line, idx) => (
                    <div key={idx} className="strength-v4-evidence-item text-slate-600 font-semibold text-base py-1">
                      {line}
                    </div>
                  ))}
                </div>
              </section>

              {detailState.item.eventRefs.length > 0 && (
                <section className="strength-v4-drawer-section">
                  <h3 className="text-xs font-black tracking-widest">Relevant Events</h3>
                  <div className="flex flex-col gap-4">
                    {detailState.item.eventRefs.map((event) => (
                      <button
                        key={`${event.id}-${event.time}`}
                        type="button"
                        className="p-6 bg-white border border-slate-100 rounded-3xl flex justify-between items-center hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group text-left"
                        onClick={() => onOpenCalendarEvent(event)}
                      >
                        <div className="flex flex-col gap-2">
                          <strong className="text-slate-950 text-lg group-hover:text-indigo-600 transition-colors">{event.title}</strong>
                          <span className="text-xs text-slate-500 uppercase font-black tracking-widest">{event.currency} • {event.impact} IMPACT</span>
                        </div>
                        <ArrowRight size={24} className="text-slate-300 group-hover:text-indigo-500 transition-all group-hover:translate-x-1" />
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
