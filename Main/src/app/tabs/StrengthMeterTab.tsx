import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, Info, RefreshCcw, X } from "lucide-react";
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
    <section className="tab-panel">
      {/* Hero Section - Centered High Fidelity */}
      <header className="strength-v5-hero">
        <h1 className="strength-v5-title">Strength<br />Meter</h1>
        <p className="strength-v5-desc">
          Professional shortlist of the highest-conviction opportunities across the major board. 
          Engineered for rapid decision-making beside TradingView.
        </p>

        <div className="strength-v5-status-bar">
          <div className={`strength-v5-status-item ${!historyLoading && !historyFailed ? "is-active" : ""}`}>
            <span className="strength-v5-status-dot"></span>
            {historyLoading ? "Calculating Board" : historyFailed ? "Board Limited" : "Price Engine Live"}
          </div>
          <div className={`strength-v5-status-item ${status === "live" ? "is-active" : ""}`}>
            <span className="strength-v5-status-dot"></span>
            Calendar {status === "live" ? "Synchronized" : "Stale"}
          </div>
        </div>
      </header>

      {/* Sleek Operational Notice - Replaces legacy pills */}
      {partialNote ? (
        <div className="strength-v5-notice">
          <AlertTriangle size={20} className="text-amber-500" />
          <span>Operational Notice: Partial coverage for {partialNote}. Trade with heightened caution.</span>
        </div>
      ) : null}

      {/* Main Opportunities */}
      <section className="strength-v5-section">
        <span className="strength-v5-kicker">Command Center</span>
        <h2 className="strength-v5-section-title">Open First</h2>
        
        <div className="strength-v4-grid">
          {result.shortlist.map((item) => (
            <article key={item.pair.name} className="strength-v5-card">
              <div className="strength-v4-card-head mb-6">
                <strong className="strength-v4-card-name text-3xl">{item.pair.name}</strong>
                <span className="strength-v4-card-score bg-indigo-50 text-indigo-600 border border-indigo-100 font-black">{item.score.toFixed(0)}</span>
              </div>
              <p className="strength-v4-card-summary text-lg mb-8 font-semibold text-slate-600 leading-relaxed">{item.summary}</p>
              <div className="strength-v4-card-tags mb-10">
                {item.reasonTags.map((tag) => (
                  <span
                    key={tag}
                    className={`strength-v4-tag py-1 px-3 text-xs ${tag.includes("agrees") || tag.includes("support") ? "is-highlight" : ""}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  className="flex-1 py-4 px-8 rounded-2xl bg-slate-900 text-white font-black text-sm hover:bg-black transition-all shadow-lg hover:shadow-indigo-500/10"
                  onClick={() => setDetailState({ kind: "pair", item })}
                >
                  Inspect
                </button>
                {item.eventRefs[0] ? (
                  <button
                    type="button"
                    className="py-4 px-5 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
                    onClick={() => onOpenCalendarEvent(item.eventRefs[0])}
                  >
                    <Activity size={20} />
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Board Map */}
      <section className="strength-v5-section">
        <span className="strength-v5-kicker">Market Atlas</span>
        <h2 className="strength-v5-section-title">Board Read</h2>
        
        <div className="strength-v4-board">
          {result.currencies.map((currency) => (
            <button
              key={currency.currency}
              type="button"
              className={`strength-v5-chip strength-v4-chip is-${currency.state}`}
              onClick={() => setDetailState({ kind: "currency", item: currency })}
            >
              <FlagIcon countryCode={currency.countryCode} className="h-10 w-14 rounded-lg shadow-sm" />
              <div className="strength-v4-chip-info">
                <strong className="text-2xl">{currency.currency}</strong>
                <span className="text-xs font-black tracking-widest">{currency.stateLabel}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Methodology Footer */}
      <footer className="strength-v5-footer">
        <div className="strength-v5-footer-item">
          <strong>Logic & Weights</strong>
          <p>
            Composite score derived from Price Impulse (55%), Event Backing (25%), and Structural Macro (20%). 
            Calculated in real-time by the Fyodor Price Engine.
          </p>
        </div>
        <div className="strength-v5-footer-item">
          <strong>Optimal Use</strong>
          <p>
            This shortlist surface identifies where to look. Execution requires clinical manual D1 to H1 chart confirmation in TradingView.
          </p>
        </div>
        <div className="strength-v5-footer-item">
          <strong>Trust Limits</strong>
          <p>
            Operational safety drops during high-impact news releases or when external data is marked as "Stale".
          </p>
        </div>
      </footer>

      {/* Side Drawer */}
      {detailState ? (
        <div className="strength-v4-drawer-overlay" onClick={() => setDetailState(null)}>
          <div className="strength-v4-drawer" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="strength-v4-drawer-head">
              <div className="strength-v4-drawer-title">
                <h2 className="text-4xl">{detailState.kind === "pair" ? detailState.item.pair.name : detailState.item.currency}</h2>
                <p className="font-bold tracking-widest uppercase text-xs mt-2 text-indigo-500">
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
                <h3 className="text-xs font-black tracking-widest">Raw Evidence</h3>
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
                  <h3 className="text-xs font-black tracking-widest">Surgical Radar</h3>
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
