import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { MAJOR_CURRENCY_ORDER } from "@/app/config/fxPairs";
import { FlagIcon } from "@/app/components/FlagIcon";
import { adaptDashboardCurrencies, deriveDashboardInflationCards, deriveDashboardRateCards } from "@/app/lib/macroViews";
import type { CentralBankSnapshot, DashboardSortMode } from "@/app/types";

interface DashboardTabProps {
  snapshots: CentralBankSnapshot[];
}

function formatPercent(value: number | null): string {
  if (value == null) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function findCountryCode(currency: string, snapshots: CentralBankSnapshot[]): string {
  return snapshots.find((item) => item.currency === currency)?.countryCode ?? currency.slice(0, 2);
}

export function DashboardTab({ snapshots }: DashboardTabProps) {
  const [rateSort, setRateSort] = useState<DashboardSortMode>("absDesc");
  const [inflationSort, setInflationSort] = useState<DashboardSortMode>("absDesc");
  const [excludedCurrencies, setExcludedCurrencies] = useState<Set<string>>(new Set());

  const currencies = useMemo(() => adaptDashboardCurrencies(snapshots), [snapshots]);
  const rateCards = useMemo(
    () => deriveDashboardRateCards(currencies, excludedCurrencies, rateSort),
    [currencies, excludedCurrencies, rateSort],
  );
  const inflationCards = useMemo(
    () => deriveDashboardInflationCards(currencies, excludedCurrencies, inflationSort),
    [currencies, excludedCurrencies, inflationSort],
  );

  const toggleExcluded = (currency: string) => {
    setExcludedCurrencies((prev) => {
      const next = new Set(prev);
      if (next.has(currency)) next.delete(currency);
      else next.add(currency);
      return next;
    });
  };

  return (
    <section className="tab-panel macro-panel">
      <div className="section-head">
        <div>
          <h2>Dashboard</h2>
          <p>Direct arithmetic on MT5-fed policy and inflation values across the 28 major FX pairs.</p>
        </div>
      </div>

      <section className="macro-toolbar">
        <div className="macro-filter-group">
          <span className="macro-toolbar-label">Currencies</span>
          <div className="macro-flag-row">
            {MAJOR_CURRENCY_ORDER.map((currency) => {
              const code = findCountryCode(currency, snapshots);
              const excluded = excludedCurrencies.has(currency);
              return (
                <button
                  key={currency}
                  type="button"
                  className={`macro-flag-button ${excluded ? "is-muted" : ""}`}
                  aria-pressed={excluded}
                  onClick={() => toggleExcluded(currency)}
                  title={excluded ? `Include ${currency}` : `Exclude ${currency}`}
                >
                  <FlagIcon countryCode={code} className="h-5 w-8" />
                </button>
              );
            })}
          </div>
        </div>
        <div className="macro-sort-row">
          <label className="macro-select-label">
            <span>Rate sort</span>
            <select value={rateSort} onChange={(event) => setRateSort(event.target.value as DashboardSortMode)}>
              <option value="absDesc">Largest gap first</option>
              <option value="absAsc">Smallest gap first</option>
              <option value="default">Original order</option>
            </select>
          </label>
          <label className="macro-select-label">
            <span>Inflation sort</span>
            <select value={inflationSort} onChange={(event) => setInflationSort(event.target.value as DashboardSortMode)}>
              <option value="absDesc">Largest gap first</option>
              <option value="absAsc">Smallest gap first</option>
              <option value="default">Original order</option>
            </select>
          </label>
        </div>
      </section>

      <section className="macro-block">
        <div className="macro-block-head">
          <h3>Interest Rate Differential + Trend</h3>
          <p>Current gap, previous gap, and whether the gap is widening or narrowing.</p>
        </div>
        <div className="macro-card-grid">
          {rateCards.map((card) => (
            <article key={card.pair.name} className={`macro-card ${card.status !== "ok" ? "is-muted" : ""}`}>
              <div className="macro-card-head">
                <div className="macro-pair-head">
                  <strong>{card.pair.name}</strong>
                  <div className="macro-flag-stack">
                    <FlagIcon countryCode={findCountryCode(card.pair.base, snapshots)} className="h-5 w-8" />
                    <FlagIcon countryCode={findCountryCode(card.pair.quote, snapshots)} className="h-5 w-8" />
                  </div>
                </div>
                <div className={`macro-trend-pill ${card.isWidening == null ? "is-neutral" : card.isWidening ? "is-positive" : "is-negative"}`}>
                  {card.isWidening == null ? "Unresolved" : card.isWidening ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                  <span>
                    {card.isWidening == null ? "N/A" : card.isWidening ? "Widening" : "Narrowing"}
                  </span>
                </div>
              </div>
              <div className="macro-main-figure">
                <span>{card.pair.base}</span>
                <strong>{formatPercent(card.currentGap)}</strong>
              </div>
              <div className="macro-card-meta">
                <div>
                  <span>Previous gap</span>
                  <strong>{formatPercent(card.previousGap)}</strong>
                </div>
                <div>
                  <span>Gap change</span>
                  <strong>{formatPercent(card.trend)}</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="macro-block">
        <div className="macro-block-head">
          <h3>Inflation Differential</h3>
          <p>Simple base-minus-quote inflation bias from the current MT5-fed central-bank readings.</p>
        </div>
        <div className="macro-card-grid">
          {inflationCards.map((card) => (
            <article key={`inflation-${card.pair.name}`} className={`macro-card ${card.status !== "ok" ? "is-muted" : ""}`}>
              <div className="macro-card-head">
                <div className="macro-pair-head">
                  <strong>{card.pair.name}</strong>
                  <div className="macro-flag-stack">
                    <FlagIcon countryCode={findCountryCode(card.pair.base, snapshots)} className="h-5 w-8" />
                    <FlagIcon countryCode={findCountryCode(card.pair.quote, snapshots)} className="h-5 w-8" />
                  </div>
                </div>
              </div>
              <div className="macro-main-figure inflation">
                <span>{card.pair.base}</span>
                <strong>{formatPercent(card.bias)}</strong>
              </div>
              <div className="macro-card-foot">
                {card.bias == null
                  ? "At least one side is unresolved in the MT5 feed."
                  : card.bias > 0
                    ? `${card.pair.base} is currently printing higher inflation than ${card.pair.quote}.`
                    : card.bias < 0
                      ? `${card.pair.quote} is currently printing higher inflation than ${card.pair.base}.`
                      : "Current inflation readings are roughly aligned."}
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
