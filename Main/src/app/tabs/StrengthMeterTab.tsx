import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, Clock3, Info, RefreshCcw, X } from "lucide-react";
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
    <section className="tab-panel macro-panel">
      <div className="section-head">
        <div>
          <h2>Strength Meter</h2>
          <p>Choose what to open in TradingView first. Use the drawer only when you need to understand why.</p>
        </div>
      </div>

      <section className="macro-block strength-v3-toolbar">
        <div className="strength-v3-status">
          <span className="strength-v3-status-pill">
            <Activity size={14} />
            {historyLoading ? "Loading price board" : historyFailed ? "Price board limited" : "Price board ready"}
          </span>
          <span className="strength-v3-status-pill">
            <RefreshCcw size={14} />
            Calendar {status === "live" ? "live" : status === "stale" ? "delayed" : "limited"}
          </span>
        </div>
        <div className="strength-v3-guide">
          <strong>Use it like this</strong>
          <span>Open the top pairs first, run your D1 to H4 to H1 chart read, and ignore the detail panel unless you need to check the claim.</span>
        </div>
      </section>

      {partialNote ? (
        <section className="macro-block">
          <div className="strength-v2-alert">
            <AlertTriangle size={16} />
            <span>Some currencies still have partial data: {partialNote}.</span>
          </div>
        </section>
      ) : null}

      <section className="macro-block">
        <div className="macro-block-head">
          <h3>Open First</h3>
          <p>The shortest path to your first TradingView charts.</p>
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
                  <span key={tag} className={`strength-v4-tag ${tag.includes("agrees") || tag.includes("support") ? "is-highlight" : ""}`}>
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

      <section className="macro-block">
        <div className="macro-block-head">
          <h3>Board Read</h3>
          <p>Quick check on currency health across the major board.</p>
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

      <section className="macro-block">
        <div className="macro-block-head">
          <h3>Methodology & Trust</h3>
        </div>
        <div className="strength-v3-trust">
          <div>
            <strong>Useful when</strong>
            <span>Board, pair impulse, and macro alignment all point in the same direction.</span>
          </div>
          <div>
            <strong>Do not lean on it when</strong>
            <span>An event is close, data is stale, or your chart setup is missing.</span>
          </div>
          <div>
            <strong>Disclaimer</strong>
            <span>This tool helps identify "where to look", it does not replace discretionary chart reading.</span>
          </div>
        </div>
      </section>

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
                  {detailState.kind === "pair" ? detailState.item.summary : detailState.item.summary}
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
