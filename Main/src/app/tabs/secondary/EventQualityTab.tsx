import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Flag, ShieldAlert, Timer } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { FX_PAIRS, getFxPairByName } from "@/app/config/fxPairs";
import {
  deriveEventQualitySummary,
  getCurrencyCountryCode,
  getEventQualityFamilyWeights,
  getEventQualityImpactMultipliers,
  getEventQualityThresholds,
} from "@/app/lib/eventQuality";
import { formatRelativeAge, formatUtcDateTime } from "@/app/lib/format";
import type { BridgeStatus, CalendarEvent, EventQualityHorizon, FxPairDefinition } from "@/app/types";

interface EventQualityTabProps {
  events: CalendarEvent[];
  status: BridgeStatus;
  lastCalendarIngestAt: number | null;
}

const STORAGE_KEY = "event-quality-pair";
const HORIZON_OPTIONS: { id: EventQualityHorizon; label: string }[] = [
  { id: "24h", label: "24h" },
  { id: "72h", label: "72h" },
  { id: "this_week", label: "This Week" },
];

function getInitialPair(): FxPairDefinition {
  if (typeof window === "undefined") return FX_PAIRS[0];
  const saved = window.localStorage.getItem(STORAGE_KEY) ?? "EURUSD";
  return getFxPairByName(saved) ?? FX_PAIRS[0];
}

function renderStatusLabel(status: EventQualityTabProps["status"]): string {
  if (status === "live") return "Calendar feed live";
  if (status === "stale") return "Calendar feed stale";
  if (status === "loading") return "Loading MT5 events";
  if (status === "no_data") return "No MT5 calendar rows";
  return "Bridge unavailable";
}

function renderQualityTone(label: "clean" | "mixed" | "dirty"): string {
  if (label === "clean") return "Event environment looks clear";
  if (label === "mixed") return "Some event friction is building";
  return "Macro timing risk is elevated";
}

function impactText(multiplier: number): string {
  if (multiplier === 1) return "High";
  if (multiplier === 0.65) return "Medium";
  return "Low";
}

export function EventQualityTab({ events, status, lastCalendarIngestAt }: EventQualityTabProps) {
  const [selectedPair, setSelectedPair] = useState<FxPairDefinition>(() => getInitialPair());
  const [horizon, setHorizon] = useState<EventQualityHorizon>("24h");
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, selectedPair.name);
  }, [selectedPair]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!selectorRef.current?.contains(target)) setIsSelectorOpen(false);
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const summary = useMemo(
    () => deriveEventQualitySummary({ events, pair: selectedPair, horizon }),
    [events, horizon, selectedPair],
  );

  const weights = useMemo(() => getEventQualityFamilyWeights(), []);
  const impactMultipliers = useMemo(() => getEventQualityImpactMultipliers(), []);
  const thresholds = useMemo(() => getEventQualityThresholds(horizon), [horizon]);

  return (
    <section className="tab-panel event-quality-panel">
      <div className="event-quality-toolbar">
        <div className="event-quality-toolbar-title">
          <div className="event-quality-toolbar-icon">
            <ShieldAlert size={18} />
          </div>
          <div>
            <h2>Event Quality</h2>
            <p>Weighted macro-event filter for the selected FX pair using MT5 calendar data only.</p>
          </div>
        </div>

        <div className="event-quality-toolbar-actions">
          <div ref={selectorRef} className="event-quality-selector">
            <button
              type="button"
              className="event-quality-pair-button"
              onClick={() => setIsSelectorOpen((value) => !value)}
            >
              <div className="event-quality-pair-flags">
                <FlagIcon countryCode={getCurrencyCountryCode(selectedPair.base)} className="h-5 w-8" />
                <FlagIcon countryCode={getCurrencyCountryCode(selectedPair.quote)} className="h-5 w-8" />
              </div>
              <div className="event-quality-pair-copy">
                <span>Selected pair</span>
                <strong>{selectedPair.name}</strong>
              </div>
              <ChevronDown size={16} />
            </button>

            {isSelectorOpen && (
              <div className="event-quality-selector-menu">
                {FX_PAIRS.map((pair) => (
                  <button
                    key={pair.name}
                    type="button"
                    className={`event-quality-selector-option ${pair.name === selectedPair.name ? "is-active" : ""}`}
                    onClick={() => {
                      setSelectedPair(pair);
                      setIsSelectorOpen(false);
                    }}
                  >
                    <div className="event-quality-pair-flags">
                      <FlagIcon countryCode={getCurrencyCountryCode(pair.base)} className="h-5 w-8" />
                      <FlagIcon countryCode={getCurrencyCountryCode(pair.quote)} className="h-5 w-8" />
                    </div>
                    <strong>{pair.name}</strong>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="event-quality-horizon-row">
            {HORIZON_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`event-quality-horizon-button ${horizon === option.id ? "is-active" : ""}`}
                onClick={() => setHorizon(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="event-quality-grid">
        <section className="event-quality-summary-card">
          <div className="event-quality-summary-head">
            <div>
              <div className="event-quality-kicker">Pair Environment</div>
              <h3>{selectedPair.name}</h3>
              <p>{renderQualityTone(summary.label)}</p>
            </div>
            <div className={`event-quality-badge is-${summary.label}`}>
              {summary.label === "clean" ? <CheckCircle2 size={15} /> : summary.label === "mixed" ? <Timer size={15} /> : <AlertTriangle size={15} />}
              <span>{summary.label}</span>
            </div>
          </div>

          <div className="event-quality-score-row">
            <div>
              <span>Weighted score</span>
              <strong>{summary.totalScore.toFixed(2)}</strong>
            </div>
            <div>
              <span>{selectedPair.base} load</span>
              <strong>{summary.baseScore.toFixed(2)}</strong>
            </div>
            <div>
              <span>{selectedPair.quote} load</span>
              <strong>{summary.quoteScore.toFixed(2)}</strong>
            </div>
          </div>

          <div className="event-quality-meta-row">
            <div>
              <span>Horizon window</span>
              <strong>
                {formatUtcDateTime(summary.startsAt)} - {formatUtcDateTime(summary.endsAt)}
              </strong>
            </div>
            <div>
              <span>Feed status</span>
              <strong>{renderStatusLabel(status)}</strong>
            </div>
            <div>
              <span>Last ingest</span>
              <strong>{formatRelativeAge(lastCalendarIngestAt)}</strong>
            </div>
          </div>

          {summary.note ? (
            <div className="event-quality-note">{summary.note}</div>
          ) : summary.immediateTrigger ? (
            <div className="event-quality-note is-warning">
              Dirty override is active because a high-impact policy, inflation, or labor event is due within 24 hours.
            </div>
          ) : null}
        </section>

        <section className="event-quality-breakdown-card">
          <div className="event-quality-card-head">
            <div>
              <div className="event-quality-kicker">Weighted Breakdown</div>
              <h3>What is driving the score</h3>
            </div>
          </div>

          <div className="event-quality-breakdown-list">
            {summary.breakdown.length === 0 ? (
              <div className="event-quality-empty">No matched weighted events in the selected horizon.</div>
            ) : (
              summary.breakdown.map((item) => (
                <div key={item.family} className="event-quality-breakdown-row">
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.count} event{item.count === 1 ? "" : "s"}</span>
                  </div>
                  <strong>{item.score.toFixed(2)}</strong>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="event-quality-table-card">
        <div className="event-quality-card-head">
          <div>
            <div className="event-quality-kicker">Relevant Events</div>
            <h3>Upcoming macro events counted for {selectedPair.name}</h3>
          </div>
          <div className="event-quality-table-legend">
            <span>
              <Flag size={14} />
              Base or quote only
            </span>
          </div>
        </div>

        {summary.rows.length === 0 ? (
          <div className="event-quality-empty table">No counted events for this pair and horizon.</div>
        ) : (
          <div className="event-quality-table">
            <div className="event-quality-table-head">
              <span>Time</span>
              <span>Side</span>
              <span>Event</span>
              <span>Family</span>
              <span>Impact</span>
              <span>Score</span>
            </div>
            {summary.rows.map((row) => (
              <div key={row.id} className="event-quality-table-row">
                <div className="event-quality-time-cell">
                  <strong>{formatUtcDateTime(row.event.time)}</strong>
                  <span>{row.countdownLabel}</span>
                </div>
                <div className="event-quality-side-cell">
                  <FlagIcon countryCode={getCurrencyCountryCode(row.event.currency)} className="h-5 w-8" />
                  <span>{row.event.currency}</span>
                </div>
                <div className="event-quality-title-cell">
                  <strong>{row.event.title}</strong>
                  <span>{row.pairSide === "base" ? `${selectedPair.base} side` : `${selectedPair.quote} side`}</span>
                </div>
                <div className="event-quality-family-cell">{row.familyLabel}</div>
                <div className="event-quality-impact-cell">{impactText(row.impactMultiplier)}</div>
                <div className="event-quality-score-cell">{row.score.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="event-quality-method-card">
        <div className="event-quality-card-head">
          <div>
            <div className="event-quality-kicker">Methodology</div>
            <h3>How the score is weighted</h3>
          </div>
        </div>

        <div className="event-quality-method-grid">
          <div className="event-quality-method-block">
            <h4>Family weights</h4>
            {weights.map((weight) => (
              <div key={weight.family} className="event-quality-method-row">
                <span>{weight.label}</span>
                <strong>{weight.weight}</strong>
              </div>
            ))}
          </div>

          <div className="event-quality-method-block">
            <h4>Impact multipliers</h4>
            <div className="event-quality-method-row">
              <span>High</span>
              <strong>{impactMultipliers.high.toFixed(2)}</strong>
            </div>
            <div className="event-quality-method-row">
              <span>Medium</span>
              <strong>{impactMultipliers.medium.toFixed(2)}</strong>
            </div>
            <div className="event-quality-method-row">
              <span>Low</span>
              <strong>{impactMultipliers.low.toFixed(2)}</strong>
            </div>
          </div>

          <div className="event-quality-method-block">
            <h4>Current thresholds</h4>
            <div className="event-quality-method-row">
              <span>Clean</span>
              <strong>{`< ${thresholds.mixed}`}</strong>
            </div>
            <div className="event-quality-method-row">
              <span>Mixed</span>
              <strong>{`${thresholds.mixed} to < ${thresholds.dirty}`}</strong>
            </div>
            <div className="event-quality-method-row">
              <span>Dirty</span>
              <strong>{`>= ${thresholds.dirty}`}</strong>
            </div>
          </div>
        </div>

        <div className="event-quality-footnote">
          This tab is a macro timing filter built from MT5 calendar rows. It is meant to help screen the trade environment, not to generate buy or sell signals.
        </div>
      </section>
    </section>
  );
}
