import { useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { MAJOR_CURRENCY_ORDER } from "@/app/config/fxPairs";
import { FlagIcon } from "@/app/components/FlagIcon";
import { adaptDashboardCurrencies, deriveStrengthCurrencyRanks, deriveStrengthSuggestions } from "@/app/lib/macroViews";
import type { CentralBankSnapshot, StrengthSuggestionSortMode } from "@/app/types";

interface StrengthMeterTabProps {
  snapshots: CentralBankSnapshot[];
}

export function StrengthMeterTab({ snapshots }: StrengthMeterTabProps) {
  const [suggestionSort, setSuggestionSort] = useState<StrengthSuggestionSortMode>("spreadDesc");
  const [excludedCurrencies, setExcludedCurrencies] = useState<Set<string>>(new Set());

  const currencies = useMemo(() => adaptDashboardCurrencies(snapshots), [snapshots]);
  const { ranks, excluded } = useMemo(() => deriveStrengthCurrencyRanks(currencies), [currencies]);
  const suggestions = useMemo(
    () => deriveStrengthSuggestions(ranks, excludedCurrencies, suggestionSort),
    [ranks, excludedCurrencies, suggestionSort],
  );

  const toggleExcluded = (currency: string) => {
    setExcludedCurrencies((prev) => {
      const next = new Set(prev);
      if (next.has(currency)) next.delete(currency);
      else next.add(currency);
      return next;
    });
  };

  const excludedNote = excluded.map((item) => item.currency).join(", ");

  return (
    <section className="tab-panel macro-panel">
      <div className="section-head">
        <div>
          <h2>Strength Meter</h2>
          <p>Relative ranking across the major 8 using the legacy 60/40 rate and inflation weighting.</p>
        </div>
      </div>

      <section className="macro-toolbar">
        <div className="macro-filter-group">
          <span className="macro-toolbar-label">Suggested pairs</span>
          <div className="macro-flag-row">
            {MAJOR_CURRENCY_ORDER.map((currency) => {
              const snapshot = snapshots.find((item) => item.currency === currency);
              const code = snapshot?.countryCode ?? currency.slice(0, 2);
              const excludedByUser = excludedCurrencies.has(currency);
              return (
                <button
                  key={currency}
                  type="button"
                  className={`macro-flag-button ${excludedByUser ? "is-muted" : ""}`}
                  aria-pressed={excludedByUser}
                  onClick={() => toggleExcluded(currency)}
                  title={excludedByUser ? `Include ${currency}` : `Exclude ${currency}`}
                >
                  <FlagIcon countryCode={code} className="h-5 w-8" />
                </button>
              );
            })}
          </div>
        </div>
        <div className="macro-sort-row">
          <label className="macro-select-label">
            <span>Suggestions</span>
            <select value={suggestionSort} onChange={(event) => setSuggestionSort(event.target.value as StrengthSuggestionSortMode)}>
              <option value="spreadDesc">Highest differential first</option>
              <option value="spreadAsc">Lowest differential first</option>
            </select>
          </label>
        </div>
      </section>

      {excluded.length > 0 && (
        <div className="alert-panel alert-stale">
          Excluded from scoring because MT5 does not currently resolve both current rate and current inflation: {excludedNote}.
        </div>
      )}

      <section className="macro-block">
        <div className="macro-block-head">
          <h3>Live Currency Rankings</h3>
          <p>Score = 60% current policy rate position + 40% current inflation position inside the resolved major-8 set.</p>
        </div>
        <div className="strength-list">
          {ranks.map((rank, index) => (
            <article key={rank.currency} className="strength-row">
              <div className="strength-rank">{index + 1}</div>
              <div className="strength-currency">
                <FlagIcon countryCode={rank.countryCode} className="h-6 w-10" />
                <div>
                  <strong>{rank.currency}</strong>
                  <span>{index === 0 ? "Strongest" : index === ranks.length - 1 ? "Weakest" : `Rank ${index + 1}`}</span>
                </div>
              </div>
              <div className="strength-meter-bar">
                <div className="strength-meter-head">
                  <span>Strength score</span>
                  <strong>{rank.score.toFixed(1)}</strong>
                </div>
                <div className="strength-track">
                  <div className="strength-fill" style={{ width: `${rank.score * 10}%` }} />
                </div>
              </div>
              <div className="strength-breakdown">
                <span>Rate {rank.rateScore.toFixed(1)}</span>
                <span>Inflation {rank.inflationScore.toFixed(1)}</span>
              </div>
              <div className="strength-icon">
                {index < ranks.length / 2 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="macro-block">
        <div className="macro-block-head">
          <h3>Suggested Trading Pairs</h3>
          <p>Strongest-vs-weakest spreads generated from the current heuristic ranking. Treat this as a focus aid, not a signal.</p>
        </div>
        <div className="macro-card-grid suggestions">
          {suggestions.map((item) => (
            <article key={`${item.strong.currency}-${item.weak.currency}`} className="macro-card suggestion-card">
              <div className="suggestion-sides">
                <div className="suggestion-side">
                  <FlagIcon countryCode={item.strong.countryCode} className="h-6 w-10" />
                  <div>
                    <strong>{item.strong.currency}</strong>
                    <span>Long side</span>
                  </div>
                </div>
                <span className="suggestion-divider">/</span>
                <div className="suggestion-side">
                  <div>
                    <strong>{item.weak.currency}</strong>
                    <span>Short side</span>
                  </div>
                  <FlagIcon countryCode={item.weak.countryCode} className="h-6 w-10" />
                </div>
              </div>
              <div className="macro-card-meta">
                <div>
                  <span>Strong score</span>
                  <strong>{item.strong.score.toFixed(1)}</strong>
                </div>
                <div>
                  <span>Weak score</span>
                  <strong>{item.weak.score.toFixed(1)}</strong>
                </div>
              </div>
              <div className="macro-card-foot">Strength differential: {item.spread.toFixed(1)} points.</div>
            </article>
          ))}
        </div>
      </section>

      <section className="macro-block">
        <div className="macro-block-head">
          <h3>Methodology</h3>
        </div>
        <div className="macro-note-list">
          <span>Each resolved currency is normalized to a 0-10 range for current policy rate and current inflation.</span>
          <span>Final score = (0.60 x rate score) + (0.40 x inflation score).</span>
          <span>The score is a relative ranking heuristic inside the current major-8 set, not a directional trade score.</span>
        </div>
      </section>
    </section>
  );
}
