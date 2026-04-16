import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, Clock3, RefreshCcw, X } from "lucide-react";
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
          <p>Choose what to open in TradingView first. Use the details only when you need to understand why.</p>
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

      {historyFailed ? (
        <section className="macro-block">
          <div className="strength-v2-alert">
            <Clock3 size={16} />
            <span>Price data is incomplete, so treat this tab as a rough shortlist only.</span>
          </div>
        </section>
      ) : null}

      <section className="macro-block">
        <div className="macro-block-head">
          <h3>Open First</h3>
          <p>The shortest path to your first TradingView charts.</p>
        </div>
        <div className="strength-v3-shortlist">
          {result.shortlist.map((item) => (
            <article key={item.pair.name} className="strength-v3-pair-card">
              <div className="strength-v3-pair-head">
                <div>
                  <strong>{item.pair.name}</strong>
                  <span>{item.label}</span>
                </div>
              </div>
              <p className="strength-v3-summary">{item.summary}</p>
              {item.caution ? <p className="strength-v3-caution">{item.caution}</p> : null}
              <div className="strength-v3-actions">
                <button type="button" className="strength-v3-button is-primary" onClick={() => setDetailState({ kind: "pair", item })}>
                  See why
                </button>
                {item.eventRefs[0] ? (
                  <button
                    type="button"
                    className="strength-v3-button"
                    onClick={() => onOpenCalendarEvent(item.eventRefs[0])}
                  >
                    Open event
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
          <p>Only a quick check on which currencies are winning broadly, unclear, or losing broadly.</p>
        </div>
        <div className="strength-v3-board">
          {result.currencies.map((currency) => (
            <button
              key={currency.currency}
              type="button"
              className={`strength-v3-board-row is-${currency.state}`}
              onClick={() => setDetailState({ kind: "currency", item: currency })}
            >
              <div className="strength-v3-board-main">
                <FlagIcon countryCode={currency.countryCode} className="h-5 w-8" />
                <strong>{currency.currency}</strong>
                <span>{currency.stateLabel}</span>
              </div>
              <span className="strength-v3-board-link">See why</span>
            </button>
          ))}
        </div>
      </section>

      <section className="macro-block">
        <div className="macro-block-head">
          <h3>Trust And Limits</h3>
          <p>Trust it as a shortlist assistant only.</p>
        </div>
        <div className="strength-v3-trust">
          <div>
            <strong>Useful when</strong>
            <span>The board read, direct pair, and event timing are all pointing in the same direction.</span>
          </div>
          <div>
            <strong>Do not lean on it when</strong>
            <span>data is partial, an event is close, or your chart disagrees with the shortlist.</span>
          </div>
          <div>
            <strong>It does not do</strong>
            <span>entries, stops, targets, execution, or chart-structure judgment.</span>
          </div>
        </div>
      </section>

      {detailState ? (
        <div className="strength-v3-overlay" onClick={() => setDetailState(null)}>
          <div className="strength-v3-detail" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="strength-v3-detail-head">
              <div>
                <strong>{detailState.kind === "pair" ? detailState.item.pair.name : detailState.item.currency}</strong>
                <span>{detailState.kind === "pair" ? detailState.item.summary : detailState.item.summary}</span>
              </div>
              <button type="button" className="strength-v3-close" onClick={() => setDetailState(null)}>
                <X size={16} />
              </button>
            </div>

            {detailState.kind === "pair" ? (
              <div className="strength-v3-detail-body">
                <section className="strength-v3-detail-section">
                  <strong>Why it is here</strong>
                  {detailState.item.evidence.map((line) => (
                    <span key={`${detailState.item.pair.name}-${line}`}>{line}</span>
                  ))}
                </section>

                {detailState.item.eventRefs.length > 0 ? (
                  <section className="strength-v3-detail-section">
                    <strong>Event support</strong>
                    {detailState.item.eventRefs.map((event) => (
                      <button
                        key={`${event.id}-${event.time}`}
                        type="button"
                        className="strength-v3-event-link"
                        onClick={() => onOpenCalendarEvent(event)}
                      >
                        <span>{event.currency} {event.title}</span>
                        <span>actual {event.actual || "n/a"} vs forecast {event.forecast || event.previous || "n/a"}</span>
                      </button>
                    ))}
                  </section>
                ) : null}
              </div>
            ) : (
              <div className="strength-v3-detail-body">
                <section className="strength-v3-detail-section">
                  <strong>What is backing this read</strong>
                  {detailState.item.evidence.map((line) => (
                    <span key={`${detailState.item.currency}-${line}`}>{line}</span>
                  ))}
                </section>

                {detailState.item.eventRefs.length > 0 ? (
                  <section className="strength-v3-detail-section">
                    <strong>Recent events</strong>
                    {detailState.item.eventRefs.map((event) => (
                      <button
                        key={`${event.id}-${event.time}`}
                        type="button"
                        className="strength-v3-event-link"
                        onClick={() => onOpenCalendarEvent(event)}
                      >
                        <span>{event.currency} {event.title}</span>
                        <span>actual {event.actual || "n/a"} vs forecast {event.forecast || event.previous || "n/a"}</span>
                      </button>
                    ))}
                  </section>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
