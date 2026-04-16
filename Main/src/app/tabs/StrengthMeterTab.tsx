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
    <section className="tab-panel strength-v4-panel">
      {/* Header - High Contrast, Decisive */}
      <header className="strength-v4-header-pro">
        <h2>Strength Meter</h2>
        <p>Shortlist of the best opportunities across the board right now. Open the top charts first, ignore the rest.</p>
      </header>

      {/* Status Bar - Minimal, Pro */}
      <div className="strength-v4-status-minimal">
        <div className={`strength-v4-status-item ${!historyLoading && !historyFailed ? "is-live" : ""}`}>
          {historyLoading ? "Loading Price Map" : historyFailed ? "Price Board Stale" : "Price Map Live"}
        </div>
        <div className={`strength-v4-status-item ${status === "live" ? "is-live" : ""}`}>
          Calendar {status === "live" ? "Sync" : status === "stale" ? "Delayed" : "Limited"}
        </div>
      </div>

      {partialNote ? (
        <div className="strength-v2-alert">
          <AlertTriangle size={16} />
          <span>Partial coverage: {partialNote}. Use with care.</span>
        </div>
      ) : null}

      {/* Shortlist - Clear Kicker, No Box */}
      <section className="strength-v4-section">
        <div className="strength-v4-section-header">
          <span className="strength-v4-kicker">Command Center</span>
          <h3 className="strength-v4-section-title">Open First</h3>
        </div>
        <div className="strength-v4-grid">
          {result.shortlist.map((item) => (
            <article key={item.pair.name} className="strength-v4-card">
              <div className="strength-v4-card-head">
                <strong className="strength-v4-card-name">{item.pair.name}</strong>
                <span className="strength-v4-card-score">{item.score.toFixed(0)}</span>
              </div>
              <p className="strength-v4-card-summary">{item.summary}</p>
              <div className="strength-v4-card-tags">
                {item.reasonTags.map((tag) => (
                  <span
                    key={tag}
                    className={`strength-v4-tag ${tag.includes("agrees") || tag.includes("support") ? "is-highlight" : ""}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="strength-v4-btn-group">
                <button
                  type="button"
                  className="strength-v4-btn strength-v4-btn-primary"
                  onClick={() => setDetailState({ kind: "pair", item })}
                >
                  Inspect
                </button>
                {item.eventRefs[0] ? (
                  <button
                    type="button"
                    className="strength-v4-btn strength-v4-btn-secondary"
                    onClick={() => onOpenCalendarEvent(item.eventRefs[0])}
                  >
                    Event
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Board Read - High Density, No Box */}
      <section className="strength-v4-section">
        <div className="strength-v4-section-header">
          <span className="strength-v4-kicker">Major Map</span>
          <h3 className="strength-v4-section-title">Board Read</h3>
        </div>
        <div className="strength-v4-board">
          {result.currencies.map((currency) => (
            <button
              key={currency.currency}
              type="button"
              className={`strength-v4-chip is-${currency.state}`}
              onClick={() => setDetailState({ kind: "currency", item: currency })}
            >
              <FlagIcon countryCode={currency.countryCode} className="h-6 w-10 rounded-sm shadow-sm" />
              <div className="strength-v4-chip-info">
                <strong>{currency.currency}</strong>
                <span>{currency.stateLabel}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Methodology - Clean Footer Notes */}
      <footer className="strength-v4-footer-notes">
        <div className="strength-v4-footer-item">
          <strong>Trust And Limits</strong>
          <span>This map identifies where the weight of evidence points. It does not replace your D1/H4 chart read.</span>
        </div>
        <div className="strength-v4-footer-item">
          <strong>Useful When</strong>
          <span>Impulse, macro alignment, and price action agree on the winner.</span>
        </div>
        <div className="strength-v4-footer-item">
          <strong>Methodology</strong>
          <span>Combines 55% Price Impulse, 25% Event Push, and 20% Macro Structural backdrop.</span>
        </div>
      </footer>

      {/* Side Drawer - Slide-in Detail */}
      {detailState ? (
        <div className="strength-v4-drawer-overlay" onClick={() => setDetailState(null)}>
          <div className="strength-v4-drawer" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="strength-v4-drawer-head">
              <div className="strength-v4-drawer-title">
                <h2>{detailState.kind === "pair" ? detailState.item.pair.name : detailState.item.currency}</h2>
                <p>{detailState.kind === "pair" ? "Pair Breakdown" : "Currency Breakdown"}</p>
              </div>
              <button type="button" className="strength-v4-drawer-close" onClick={() => setDetailState(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="strength-v4-drawer-body">
              <section className="strength-v4-drawer-section">
                <h3>The Verdict</h3>
                <div className="strength-v4-verdict">
                  {detailState.item.summary}
                </div>
              </section>

              {detailState.kind === "currency" && (
                <section className="strength-v4-drawer-section">
                  <h3>Ingredient Breakdown</h3>
                  <div className="flex flex-col gap-5">
                    {[
                      { label: "Price Impulse", breakdown: detailState.item.price },
                      { label: "Event Push", breakdown: detailState.item.event },
                      { label: "Macro Structural", breakdown: detailState.item.structural },
                    ].map((ing) => (
                      <div key={ing.label} className="strength-v4-ingredient">
                        <div className="strength-v4-ingredient-head">
                          <span>{ing.label}</span>
                          <span>{(ing.breakdown.contribution * 100).toFixed(1)}% weight contribution</span>
                        </div>
                        <div className="strength-v4-bar-track">
                          <div
                            className="strength-v4-bar-fill"
                            style={{ width: `${Math.abs(ing.breakdown.value * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="strength-v4-drawer-section">
                <h3>Supporting Evidence</h3>
                <div className="strength-v4-evidence-list">
                  {detailState.item.evidence.map((line, idx) => (
                    <div key={idx} className="strength-v4-evidence-item">
                      {line}
                    </div>
                  ))}
                </div>
              </section>

              {detailState.item.eventRefs.length > 0 && (
                <section className="strength-v4-drawer-section">
                  <h3>Relevant Events</h3>
                  <div className="flex flex-col gap-3">
                    {detailState.item.eventRefs.map((event) => (
                      <button
                        key={`${event.id}-${event.time}`}
                        type="button"
                        className="strength-v4-event-link"
                        onClick={() => onOpenCalendarEvent(event)}
                      >
                        <div className="strength-v4-event-info">
                          <strong>{event.title}</strong>
                          <span>{event.currency} • {event.impact} impact</span>
                        </div>
                        <ArrowRight size={16} className="text-slate-400" />
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
