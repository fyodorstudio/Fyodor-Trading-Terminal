import { Fragment, useEffect, useMemo, useState } from "react";
import { deriveMacroState } from "@/app/lib/garbage/macroState";
import {
  deriveWatchlistEngine,
  INFLATION_DELTA_WEIGHT,
  normalizeSigned,
  percentileRank,
  RATE_DELTA_WEIGHT,
  RATE_LEVEL_WEIGHT,
  REAL_RATE_WEIGHT,
} from "@/app/lib/garbage/watchlistEngine";
import { FlagIcon } from "@/app/components/FlagIcon";
import type { CentralBankSnapshot, WatchlistCurrencyState } from "@/app/types";

interface MacroStateTabProps {
  snapshots: CentralBankSnapshot[];
  onBack: () => void;
}

function formatPercent(value: number | null, digits = 2): string {
  if (value == null) return "N/A";
  return `${value.toFixed(digits)}%`;
}

function formatDelta(value: number | null): string {
  if (value == null) return "N/A";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}pp`;
}

function formatMetric(label: string, value: number | null): string {
  if (label === "Coverage") {
    return value == null ? "N/A" : `${value.toFixed(0)}%`;
  }
  if (label === "Policy direction" || label === "Inflation direction") {
    return formatDelta(value);
  }
  if (label === "Composite score") {
    return value == null ? "N/A" : value.toFixed(4);
  }
  return formatPercent(value);
}

function formatRegimeLabel(value: string): string {
  if (value === "policy-led") return "Policy-led";
  if (value === "inflation-led") return "Inflation-led";
  return "Mixed";
}

function renderBiasSummary(bias: string, base: string, quote: string): string {
  if (bias === "bullish_base") return `${base} stronger than ${quote}`;
  if (bias === "bullish_quote") return `${quote} stronger than ${base}`;
  return `${base} and ${quote} are mixed`;
}

function formatScore(value: number): string {
  return value.toFixed(4);
}

function formatNormalized(value: number | null): string {
  if (value == null) return "N/A";
  return value.toFixed(4);
}

function formatRatioPercent(value: number | null, digits = 1): string {
  if (value == null) return "N/A";
  return `${(value * 100).toFixed(digits)}%`;
}

function buildCompositeBreakdown(
  currency: WatchlistCurrencyState,
  board: WatchlistCurrencyState[],
) {
  const realRateValues = board.flatMap((state) => (state.realRateProxy != null ? [state.realRateProxy] : []));
  const rateLevelValues = board.flatMap((state) => (state.rateLevel != null ? [state.rateLevel] : []));
  const rateDeltaValues = board.flatMap((state) => (state.rateDelta != null ? [state.rateDelta] : []));
  const inflationDeltaValues = board.flatMap((state) => (state.inflationDelta != null ? [state.inflationDelta] : []));

  const realRateScore = currency.realRateProxy == null ? null : percentileRank(realRateValues, currency.realRateProxy);
  const rateLevelScore = currency.rateLevel == null ? null : percentileRank(rateLevelValues, currency.rateLevel);
  const rateDeltaScore =
    currency.rateDelta == null ? null : (normalizeSigned(rateDeltaValues, currency.rateDelta) + 1) / 2;
  const inflationDeltaScore =
    currency.inflationDelta == null ? null : (normalizeSigned(inflationDeltaValues, currency.inflationDelta) + 1) / 2;

  const contribution = (score: number | null, weight: number) => (score == null ? null : score * weight);

  return {
    currency: currency.currency,
    rows: [
      {
        label: "Real-rate proxy",
        raw: currency.realRateProxy == null ? "N/A" : `${currency.realRateProxy.toFixed(2)}%`,
        normalizedValue: realRateScore,
        normalized: formatNormalized(realRateScore),
        weight: REAL_RATE_WEIGHT,
        contribution: contribution(realRateScore, REAL_RATE_WEIGHT),
      },
      {
        label: "Policy rate",
        raw: currency.rateLevel == null ? "N/A" : `${currency.rateLevel.toFixed(2)}%`,
        normalizedValue: rateLevelScore,
        normalized: formatNormalized(rateLevelScore),
        weight: RATE_LEVEL_WEIGHT,
        contribution: contribution(rateLevelScore, RATE_LEVEL_WEIGHT),
      },
      {
        label: "Policy change",
        raw: currency.rateDelta == null ? "N/A" : `${currency.rateDelta >= 0 ? "+" : ""}${currency.rateDelta.toFixed(2)}pp`,
        normalizedValue: rateDeltaScore,
        normalized: formatNormalized(rateDeltaScore),
        weight: RATE_DELTA_WEIGHT,
        contribution: contribution(rateDeltaScore, RATE_DELTA_WEIGHT),
      },
      {
        label: "Inflation change",
        raw:
          currency.inflationDelta == null ? "N/A" : `${currency.inflationDelta >= 0 ? "+" : ""}${currency.inflationDelta.toFixed(2)}pp`,
        normalizedValue: inflationDeltaScore,
        normalized: formatNormalized(inflationDeltaScore),
        weight: INFLATION_DELTA_WEIGHT,
        contribution: contribution(inflationDeltaScore, INFLATION_DELTA_WEIGHT),
      },
    ],
    total: currency.compositeScore,
  };
}

function buildRegimeMatrix(base: WatchlistCurrencyState, quote: WatchlistCurrencyState) {
  const compareHigher = (left: number | null, right: number | null) => {
    if (left == null || right == null || left === right) return "Tie";
    return left > right ? "base" : "quote";
  };
  const compareLower = (left: number | null, right: number | null) => {
    if (left == null || right == null || left === right) return "Tie";
    return left < right ? "base" : "quote";
  };

  return [
    {
      label: "Policy rate",
      winner: compareHigher(base.rateLevel, quote.rateLevel),
    },
    {
      label: "Policy change",
      winner: compareHigher(base.rateDelta, quote.rateDelta),
    },
    {
      label: "Inflation",
      winner: compareLower(base.inflationLevel, quote.inflationLevel),
    },
    {
      label: "Inflation change",
      winner: compareLower(base.inflationDelta, quote.inflationDelta),
    },
  ];
}

export function MacroStateTab({ snapshots, onBack }: MacroStateTabProps) {
  const watchlist = useMemo(() => deriveWatchlistEngine(snapshots), [snapshots]);
  const pairOptions = watchlist.rows;
  const [selectedPairName, setSelectedPairName] = useState(pairOptions[0]?.pair.name ?? "EURUSD");

  useEffect(() => {
    if (!pairOptions.some((row) => row.pair.name === selectedPairName)) {
      setSelectedPairName(pairOptions[0]?.pair.name ?? "EURUSD");
    }
  }, [pairOptions, selectedPairName]);

  const macroState = useMemo(() => deriveMacroState(snapshots, selectedPairName), [selectedPairName, snapshots]);
  const compositeBreakdowns = useMemo(
    () => [
      buildCompositeBreakdown(macroState.base, watchlist.currencies),
      buildCompositeBreakdown(macroState.quote, watchlist.currencies),
    ],
    [macroState.base, macroState.quote, watchlist.currencies],
  );
  const regimeMatrix = useMemo(() => buildRegimeMatrix(macroState.base, macroState.quote), [macroState.base, macroState.quote]);
  const pairTableRows = [
    { currency: macroState.base, regime: macroState.baseRegime },
    { currency: macroState.quote, regime: macroState.quoteRegime },
  ];

  return (
    <div className="mx-auto flex max-w-[1460px] flex-col gap-6 pb-12">
      <section className="overflow-hidden rounded-3xl border border-gray-200/60 bg-white/75 shadow-sm backdrop-blur-xl">
        <div className="bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,64,175,0.92))] px-8 py-8 text-white">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-100/80">Fresh Specialist Prototype</div>
          <h2 className="mt-3 text-3xl font-black tracking-tight">Macro State</h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold text-blue-100/90">Macro state of the selected pair.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200/60 bg-white/75 p-8 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Pair Context</div>
            <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900">Select Pair</h3>
            <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-600">View the macro state for the selected pair.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <label className="flex min-w-[260px] flex-col gap-2 text-sm font-bold text-slate-700">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Pair Selector</span>
              <select
                value={macroState.pair.name}
                onChange={(event) => setSelectedPairName(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition-colors focus:border-blue-400"
              >
                {pairOptions.map((row) => (
                  <option key={row.pair.name} value={row.pair.name}>
                    #{row.rank} {row.pair.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50"
            >
              Back To WORK IN PROGRESS
            </button>
          </div>
        </div>

        <div className="mt-6">
          <section className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-6 shadow-sm">
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Composite Score Methodology</div>
                  <h4 className="mt-2 text-xl font-black tracking-tight text-slate-900">Formula + pair breakdown</h4>
                </div>
                <div className="flex items-center gap-2">
                  <FlagIcon countryCode={macroState.pair.base.slice(0, 2)} className="h-5 w-8 rounded-sm" />
                  <FlagIcon countryCode={macroState.pair.quote.slice(0, 2)} className="h-5 w-8 rounded-sm" />
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Pair</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{macroState.pair.name}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Bias</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{renderBiasSummary(macroState.row.bias, macroState.pair.base, macroState.pair.quote)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Macro Gap</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{macroState.row.pairScore.toFixed(4)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Stronger Side</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{macroState.strongerCurrency ?? "None"}</div>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead className="bg-slate-100">
                      <tr className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">
                        <th className="px-4 py-3 text-left">Currency</th>
                        <th className="px-4 py-3 text-right">Composite</th>
                        <th className="px-4 py-3 text-right">Real-rate</th>
                        <th className="px-4 py-3 text-right">Policy</th>
                        <th className="px-4 py-3 text-right">Prev Policy</th>
                        <th className="px-4 py-3 text-right">Policy Change</th>
                        <th className="px-4 py-3 text-right">Inflation</th>
                        <th className="px-4 py-3 text-right">Prev Inflation</th>
                        <th className="px-4 py-3 text-right">Inflation Change</th>
                        <th className="px-4 py-3 text-right">Regime</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pairTableRows.map(({ currency, regime }) => (
                        <tr key={currency.currency} className="border-t border-slate-200 bg-white">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <FlagIcon countryCode={currency.countryCode.slice(0, 2)} className="h-4 w-6 rounded-sm" />
                              <span className="text-sm font-black text-slate-900">{currency.currency}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-slate-900">{formatMetric("Composite score", currency.compositeScore)}</td>
                          <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-slate-700">{formatPercent(currency.realRateProxy)}</td>
                          <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-slate-700">{formatPercent(currency.rateLevel)}</td>
                          <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-slate-700">{currency.rateLevel != null && currency.rateDelta != null ? formatPercent(currency.rateLevel - currency.rateDelta) : "N/A"}</td>
                          <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-slate-700">{formatDelta(currency.rateDelta)}</td>
                          <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-slate-700">{formatPercent(currency.inflationLevel)}</td>
                          <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-slate-700">{currency.inflationLevel != null && currency.inflationDelta != null ? formatPercent(currency.inflationLevel - currency.inflationDelta) : "N/A"}</td>
                          <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-slate-700">{formatDelta(currency.inflationDelta)}</td>
                          <td className="px-4 py-4 text-right">
                            <div className="inline-flex flex-col items-end gap-1">
                              <span className="text-sm font-semibold text-slate-900">{formatRegimeLabel(regime.label)}</span>
                              <span className="text-[11px] font-semibold text-slate-500">
                                {regime.policyWins} policy wins, {regime.inflationWins} inflation wins
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {macroState.row.partialNote ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                  {macroState.row.partialNote}
                </div>
              ) : null}
            </div>

            <details className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Formula Sheet</div>
                  <div className="mt-1 text-sm font-black text-slate-900">Show calculation</div>
                </div>
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-black text-slate-700">
                  +
                </div>
              </summary>

              <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-5">
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-4 py-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Composite Score Formula</div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 tabular-nums">35% real-rate</span>
                        <span className="text-slate-400">+</span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 tabular-nums">30% policy rate</span>
                        <span className="text-slate-400">+</span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 tabular-nums">20% policy change</span>
                        <span className="text-slate-400">+</span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 tabular-nums">15% inflation change</span>
                      </div>
                    </div>
                    {compositeBreakdowns.map((breakdown, index) => (
                      <div key={breakdown.currency} className={index === 0 ? "" : "border-t border-slate-200"}>
                        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-900">
                          {breakdown.currency}
                        </div>
                        <table className="min-w-full border-collapse text-sm">
                          <thead>
                            <tr className="bg-white text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                              <th className="border-b border-slate-200 px-4 py-2 text-left">Term</th>
                              <th className="border-b border-slate-200 px-4 py-2 text-right">Input</th>
                              <th className="border-b border-slate-200 px-4 py-2 text-right">Score</th>
                              <th className="border-b border-slate-200 px-4 py-2 text-right">Weight</th>
                              <th className="border-b border-slate-200 px-4 py-2 text-right">Contribution</th>
                            </tr>
                          </thead>
                          <tbody>
                            {breakdown.rows.map((row) => (
                              <tr key={`${breakdown.currency}-${row.label}`} className="border-b border-slate-200 last:border-b-0">
                                <td className="px-4 py-3 font-semibold text-slate-800">{row.label}</td>
                                <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-700">{row.raw}</td>
                                <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-700">{formatRatioPercent(row.normalizedValue)}</td>
                                <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-700">{formatRatioPercent(row.weight, 0)}</td>
                                <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{formatRatioPercent(row.contribution)}</td>
                              </tr>
                            ))}
                            <tr className="bg-slate-50">
                              <td className="px-4 py-3 font-black text-slate-900">Composite score</td>
                              <td className="px-4 py-3" />
                              <td className="px-4 py-3" />
                              <td className="px-4 py-3" />
                              <td className="px-4 py-3 text-right font-black tabular-nums text-slate-900">{formatRatioPercent(breakdown.total)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-white text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          <th className="border-b border-slate-200 px-4 py-2 text-left">Regime Metric</th>
                          <th className="border-b border-slate-200 px-4 py-2 text-center">{macroState.pair.base}</th>
                          <th className="border-b border-slate-200 px-4 py-2 text-center">{macroState.pair.quote}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {regimeMatrix.map((row) => (
                          <tr key={row.label} className="border-b border-slate-200 last:border-b-0">
                            <td className="px-4 py-3 font-semibold text-slate-800">{row.label}</td>
                            <td className="px-4 py-3 text-center font-semibold text-slate-700">
                              {row.winner === "base" ? "Win" : row.winner === "Tie" ? "Tie" : "-"}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-slate-700">
                              {row.winner === "quote" ? "Win" : row.winner === "Tie" ? "Tie" : "-"}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50">
                          <td className="px-4 py-3 font-black text-slate-900">Policy Wins</td>
                          <td className="px-4 py-3 text-center font-semibold tabular-nums text-slate-900">{macroState.baseRegime.policyWins}</td>
                          <td className="px-4 py-3 text-center font-semibold tabular-nums text-slate-900">{macroState.quoteRegime.policyWins}</td>
                        </tr>
                        <tr className="bg-slate-50">
                          <td className="px-4 py-3 font-black text-slate-900">Inflation Wins</td>
                          <td className="px-4 py-3 text-center font-semibold tabular-nums text-slate-900">{macroState.baseRegime.inflationWins}</td>
                          <td className="px-4 py-3 text-center font-semibold tabular-nums text-slate-900">{macroState.quoteRegime.inflationWins}</td>
                        </tr>
                        <tr className="bg-slate-100">
                          <td className="px-4 py-3 font-black text-slate-900">Regime Output</td>
                          <td className="px-4 py-3 text-center font-black text-slate-900">{formatRegimeLabel(macroState.baseRegime.label)}</td>
                          <td className="px-4 py-3 text-center font-black text-slate-900">{formatRegimeLabel(macroState.quoteRegime.label)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </details>
          </section>
        </div>
      </section>
    </div>
  );
}
