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

  return (
    <section className="tab-panel strength-v5-panel">
      {/* High Density Hero */}
      <header className="strength-v5-hero">
        <h1 className="strength-v5-title">Strength Meter</h1>
        <p className="strength-v5-desc">
          Shortlisted conviction opportunities engineered for clinical manual TA.
        </p>

        {/* Integrated Notch & Notice */}
        <div className="flex flex-col items-center">
          <div className="strength-v5-notch">
            <div className={`strength-v5-status-item ${!historyLoading && !historyFailed ? "is-active" : ""}`}>
              <span className="strength-v5-status-dot"></span>
              {historyLoading ? "Calculating" : historyFailed ? "Price Engine Offline" : "Price Engine Live"}
            </div>
            <div className={`strength-v5-status-item ${status === "live" ? "is-active" : ""}`}>
              <span className="strength-v5-status-dot"></span>
              Calendar {status === "live" ? "Sync" : "Stale"}
            </div>
          </div>
          
          {partialNote && (
            <div className="strength-v5-notice-inline">
              <AlertTriangle size={14} />
              <span>Partial data for {partialNote}. Trade with caution.</span>
            </div>
          )}
        </div>
      </header>

      {/* Opportunities Section: Compact Grid */}
      <section className="strength-v5-section">
        <div className="strength-v5-section-header">
          <span className="strength-v5-kicker">Priority Board</span>
          <h2 className="strength-v5-section-title">Open First</h2>
        </div>

        <div className="strength-v5-compact-grid">
          {result.shortlist.map((item) => (
            <article key={item.pair.name} className="strength-v5-card">
              <div className="strength-v5-card-header">
                <strong className="strength-v5-card-name">{item.pair.name}</strong>
                <span className="strength-v5-card-score">{item.score.toFixed(0)}</span>
              </div>
              <p className="strength-v5-card-summary">{item.summary}</p>
              
              <div className="flex flex-wrap gap-2 mb-6">
                {item.reasonTags.map((tag) => (
                  <span key={tag} className={`strength-v4-tag text-[10px] py-1 px-2 ${tag.includes("agrees") || tag.includes("support") ? "is-highlight" : ""}`}>
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-auto flex gap-3">
                <button
                  type="button"
                  className="strength-v5-btn strength-v5-btn-primary"
                  onClick={() => setDetailState({ kind: "pair", item })}
                >
                  <Zap size={14} fill="currentColor" />
                  Inspect
                </button>
                {item.eventRefs[0] && (
                  <button
                    type="button"
                    className="strength-v5-btn strength-v5-btn-secondary"
                    onClick={() => onOpenCalendarEvent(item.eventRefs[0])}
                  >
                    <Activity size={16} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Board Read: High Density Map */}
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
              <FlagIcon countryCode={currency.countryCode} className="h-6 w-9 rounded-sm shadow-sm" />
              <div className="flex flex-col items-start">
                <strong>{currency.currency}</strong>
                <span>{currency.stateLabel}</span>
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
          <p>Filter first, confirm second. Always run manual D1 to H1 chart confirmation in TradingView.</p>
        </div>
        <div className="strength-v5-footer-item">
          <strong>Trust Limits</strong>
          <p>Confidence scores decay rapidly during news blackouts or when feeds are marked as stale.</p>
        </div>
      </footer>

      {/* Interaction Layer: Side Drawer (Preserved Logic) */}
      {detailState ? (
        <div className="strength-v4-drawer-overlay" onClick={() => setDetailState(null)}>
          <div className="strength-v4-drawer" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="strength-v4-drawer-head">
              <div className="strength-v4-drawer-title">
                <h2 className="text-3xl font-black">{detailState.kind === "pair" ? detailState.item.pair.name : detailState.item.currency}</h2>
                <p className="font-bold tracking-widest uppercase text-[10px] mt-1 text-indigo-500">
                  {detailState.kind === "pair" ? "Surgical Breakdown" : "Currency Analysis"}
                </p>
              </div>
              <button type="button" className="strength-v4-drawer-close" onClick={() => setDetailState(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="strength-v4-drawer-body">
              <section className="strength-v4-drawer-section">
                <h3 className="text-[10px] font-black tracking-widest">The Verdict</h3>
                <div className="bg-slate-50 text-slate-800 text-lg font-bold italic leading-relaxed p-6 rounded-2xl">
                  "{detailState.item.summary}"
                </div>
              </section>

              {detailState.kind === "currency" && (
                <section className="strength-v4-drawer-section">
                  <h3 className="text-[10px] font-black tracking-widest">Impact Weights</h3>
                  <div className="flex flex-col gap-6">
                    {[
                      { label: "Price Impulse", breakdown: detailState.item.price },
                      { label: "Event Push", breakdown: detailState.item.event },
                      { label: "Macro Structural", breakdown: detailState.item.structural },
                    ].map((ing) => (
                      <div key={ing.label} className="strength-v4-ingredient">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-slate-500 font-bold text-xs">{ing.label}</span>
                          <span className="text-slate-950 font-black text-xs">{(ing.breakdown.contribution * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600"
                            style={{ width: `${Math.abs(ing.breakdown.value * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="strength-v4-drawer-section">
                <h3 className="text-[10px] font-black tracking-widest">Raw Evidence</h3>
                <div className="flex flex-col gap-2">
                  {detailState.item.evidence.map((line, idx) => (
                    <div key={idx} className="text-slate-600 font-semibold text-sm leading-tight flex gap-2">
                      <span className="text-indigo-500">â†’</span>
                      {line}
                    </div>
                  ))}
                </div>
              </section>

              {detailState.item.eventRefs.length > 0 && (
                <section className="strength-v4-drawer-section">
                  <h3 className="text-[10px] font-black tracking-widest">Surgical Radar</h3>
                  <div className="flex flex-col gap-2">
                    {detailState.item.eventRefs.map((event) => (
                      <button
                        key={`${event.id}-${event.time}`}
                        type="button"
                        className="p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center hover:border-indigo-200 transition-all group text-left"
                        onClick={() => onOpenCalendarEvent(event)}
                      >
                        <div className="flex flex-col gap-1">
                          <strong className="text-slate-950 text-sm group-hover:text-indigo-600 transition-colors">{event.title}</strong>
                          <span className="text-[10px] text-slate-400 uppercase font-black">{event.currency} â€¢ {event.impact}</span>
                        </div>
                        <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition-all" />
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
