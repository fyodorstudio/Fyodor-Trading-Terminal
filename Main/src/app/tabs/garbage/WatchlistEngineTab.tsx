import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { deriveWatchlistEngine } from "@/app/lib/garbage/watchlistEngine";
import { FlagIcon } from "@/app/components/FlagIcon";
import type { CentralBankSnapshot, WatchlistCurrencyState, WatchlistPairRow } from "@/app/types";

interface WatchlistEngineTabProps {
  snapshots: CentralBankSnapshot[];
  onBack: () => void;
}

const PAGE_SIZE = 5;

function formatScore(value: number): string {
  return value.toFixed(4);
}

function renderBiasLabel(value: string): string {
  if (value === "bullish_base") return "Bullish base";
  if (value === "bullish_quote") return "Bullish quote";
  return "Mixed";
}

function formatMetric(value: number | null, digits = 2): string {
  if (value == null) return "N/A";
  return `${value.toFixed(digits)}%`;
}

function formatDelta(value: number | null): string {
  if (value == null) return "N/A";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}pp`;
}

function renderMetricWinner(baseValue: number | null, quoteValue: number | null, preferHigher: boolean): "base" | "quote" | "tie" {
  if (baseValue == null || quoteValue == null || baseValue === quoteValue) return "tie";
  if (preferHigher) return baseValue > quoteValue ? "base" : "quote";
  return baseValue < quoteValue ? "base" : "quote";
}

function buildReasonDetail(row: WatchlistPairRow, base: WatchlistCurrencyState | undefined, quote: WatchlistCurrencyState | undefined): string[] {
  if (!base || !quote) {
    return ["One or both currencies still have partial macro inputs."];
  }

  if (row.bias === "mixed") {
    return [
      `Macro gap ${formatScore(row.pairScore)} is still too small for a clean directional read.`,
      `${base.currency} score ${formatScore(base.compositeScore ?? 0)} vs ${quote.currency} score ${formatScore(quote.compositeScore ?? 0)}.`,
    ];
  }

  const stronger = row.strongerSide === base.currency ? base : quote;
  const weaker = stronger.currency === base.currency ? quote : base;

  const reasons: string[] = [
    `${stronger.currency} score ${formatScore(stronger.compositeScore ?? 0)} vs ${weaker.currency} score ${formatScore(weaker.compositeScore ?? 0)}.`,
    `Macro gap ${formatScore(row.pairScore)} puts the pair in ${renderBiasLabel(row.bias).toLowerCase()}.`,
  ];

  if (stronger.realRateProxy != null && weaker.realRateProxy != null && stronger.realRateProxy > weaker.realRateProxy) {
    reasons.push(`${stronger.currency} real-rate proxy ${formatMetric(stronger.realRateProxy)} vs ${formatMetric(weaker.realRateProxy)}.`);
  }
  if (stronger.rateLevel != null && weaker.rateLevel != null && stronger.rateLevel > weaker.rateLevel) {
    reasons.push(`${stronger.currency} policy rate ${formatMetric(stronger.rateLevel)} vs ${formatMetric(weaker.rateLevel)}.`);
  }
  if (stronger.rateDelta != null && weaker.rateDelta != null && stronger.rateDelta > weaker.rateDelta) {
    reasons.push(`${stronger.currency} policy change ${formatDelta(stronger.rateDelta)} vs ${formatDelta(weaker.rateDelta)}.`);
  }

  return reasons.slice(0, 3);
}

function buildTopDriver(row: WatchlistPairRow): string {
  return row.reasonTags[0] ?? "macro score stronger";
}

export function WatchlistEngineTab({ snapshots, onBack }: WatchlistEngineTabProps) {
  const result = useMemo(() => deriveWatchlistEngine(snapshots), [snapshots]);
  const [pageIndex, setPageIndex] = useState(0);
  const totalPages = Math.max(1, Math.ceil(result.rows.length / PAGE_SIZE));
  const clampedPageIndex = Math.min(pageIndex, totalPages - 1);
  const startIndex = clampedPageIndex * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, result.rows.length);
  const visibleRows = result.rows.slice(startIndex, endIndex);
  const [selectedPairName, setSelectedPairName] = useState<string | null>(visibleRows[0]?.pair.name ?? null);

  const currencyByCode = useMemo(
    () => new Map(result.currencies.map((item) => [item.currency, item])),
    [result.currencies],
  );

  useEffect(() => {
    if (!visibleRows.some((row) => row.pair.name === selectedPairName)) {
      setSelectedPairName(visibleRows[0]?.pair.name ?? null);
    }
  }, [selectedPairName, visibleRows]);

  const selectedRow = visibleRows.find((row) => row.pair.name === selectedPairName) ?? visibleRows[0] ?? null;
  const baseState = selectedRow ? currencyByCode.get(selectedRow.pair.base) : undefined;
  const quoteState = selectedRow ? currencyByCode.get(selectedRow.pair.quote) : undefined;
  const detailReasons = selectedRow ? buildReasonDetail(selectedRow, baseState, quoteState) : [];

  return (
    <div className="mx-auto flex max-w-[1460px] flex-col gap-6 pb-12">
      <section className="overflow-hidden rounded-3xl border border-gray-200/60 bg-white/75 shadow-sm backdrop-blur-xl">
        <div className="bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,64,175,0.92))] px-8 py-8 text-white">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-100/80">Fresh Specialist Prototype</div>
          <h2 className="mt-3 text-3xl font-black tracking-tight">Watchlist Engine</h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold text-blue-100/90">Macro-ranked FX watchlist.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200/60 bg-white/75 p-8 shadow-sm backdrop-blur-xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Ranked Pairs</h3>
            <p className="mt-1 text-sm font-semibold text-slate-600">Pairs ranked by macro gap.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-2 py-2">
              <button
                type="button"
                onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
                disabled={clampedPageIndex === 0}
                aria-label="Show previous watchlist pairs"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-[150px] text-center">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Showing</div>
                <div className="text-sm font-black text-slate-900">
                  #{result.rows.length === 0 ? 0 : startIndex + 1} - #{endIndex}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPageIndex((current) => Math.min(totalPages - 1, current + 1))}
                disabled={clampedPageIndex >= totalPages - 1}
                aria-label="Show next watchlist pairs"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50"
            >
              Back To WORK IN PROGRESS
            </button>
          </div>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
          <div className="self-start overflow-hidden rounded-[24px] border border-slate-200 bg-white">
            <table className="min-w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-[72px]" />
                <col />
                <col className="w-[140px]" />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
                <col className="w-[200px]" />
              </colgroup>
            <thead>
              <tr className="bg-slate-100 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">
                <th className="px-4 py-3 text-left">Rank</th>
                <th className="px-4 py-3 text-left">Pair</th>
                <th className="px-4 py-3 text-right">Bias</th>
                <th className="px-4 py-3 text-right">Macro Gap</th>
                <th className="px-4 py-3 text-right">Stronger</th>
                <th className="px-4 py-3 text-right">Top Driver</th>
              </tr>
            </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const isSelected = selectedRow?.pair.name === row.pair.name;
                  return (
                    <tr
                      key={row.pair.name}
                      onClick={() => setSelectedPairName(row.pair.name)}
                      className={`cursor-pointer border-t border-slate-200 ${isSelected ? "bg-blue-50/70" : "bg-white hover:bg-slate-50"}`}
                    >
                      <td className="px-4 py-4 align-middle font-semibold tabular-nums text-slate-700">#{row.rank}</td>
                      <td className="px-4 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="font-black text-slate-900">{row.pair.name}</div>
                          <div className="flex items-center gap-2">
                            <FlagIcon countryCode={row.pair.base.slice(0, 2)} className="h-4 w-7 rounded-sm" />
                            <FlagIcon countryCode={row.pair.quote.slice(0, 2)} className="h-4 w-7 rounded-sm" />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle text-right font-semibold whitespace-nowrap text-slate-700">{renderBiasLabel(row.bias)}</td>
                      <td className="px-4 py-4 align-middle text-right font-semibold tabular-nums text-slate-900">{formatScore(row.pairScore)}</td>
                      <td className="px-4 py-4 align-middle text-right font-semibold text-slate-700">{row.strongerSide ?? "Mixed"}</td>
                      <td className="px-4 py-4 align-middle text-right">
                        <div className="truncate font-semibold text-slate-700">{buildTopDriver(row)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <aside className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
            {selectedRow && baseState && quoteState ? (
              <>
                <div className="border-b border-slate-200 px-5 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Selected Pair</div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="text-2xl font-black tracking-tight text-slate-900">{selectedRow.pair.name}</div>
                        <div className="flex items-center gap-2">
                          <FlagIcon countryCode={selectedRow.pair.base.slice(0, 2)} className="h-5 w-8 rounded-sm" />
                          <FlagIcon countryCode={selectedRow.pair.quote.slice(0, 2)} className="h-5 w-8 rounded-sm" />
                        </div>
                      </div>
                    </div>
                    <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                      Rank #{selectedRow.rank}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 px-5 py-5">
                  <section className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="grid grid-cols-[140px,1fr] border-b border-slate-200 px-4 py-3 text-sm">
                      <div className="font-black uppercase tracking-[0.18em] text-slate-500">Bias</div>
                      <div className="font-semibold text-slate-900">{renderBiasLabel(selectedRow.bias)}</div>
                    </div>
                    <div className="grid grid-cols-[140px,1fr] border-b border-slate-200 px-4 py-3 text-sm">
                      <div className="font-black uppercase tracking-[0.18em] text-slate-500">Macro Gap</div>
                      <div className="font-semibold tabular-nums text-slate-900">{formatScore(selectedRow.pairScore)}</div>
                    </div>
                    <div className="grid grid-cols-[140px,1fr] border-b border-slate-200 px-4 py-3 text-sm">
                      <div className="font-black uppercase tracking-[0.18em] text-slate-500">Stronger Side</div>
                      <div className="font-semibold text-slate-900">{selectedRow.strongerSide ?? "Mixed"}</div>
                    </div>
                    <div className="grid grid-cols-[140px,1fr] px-4 py-3 text-sm">
                      <div className="font-black uppercase tracking-[0.18em] text-slate-500">Top Driver</div>
                      <div className="font-semibold text-slate-900">{buildTopDriver(selectedRow)}</div>
                    </div>
                  </section>

                  <section className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="grid grid-cols-[1.1fr,0.9fr,0.9fr] border-b border-slate-200 bg-slate-100 px-4 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">
                      <div>Metric</div>
                      <div className="text-right">{selectedRow.pair.base}</div>
                      <div className="text-right">{selectedRow.pair.quote}</div>
                    </div>
                    {[
                      { label: "Composite", baseValue: baseState.compositeScore, quoteValue: quoteState.compositeScore, format: formatScore, preferHigher: true },
                      { label: "Real-rate", baseValue: baseState.realRateProxy, quoteValue: quoteState.realRateProxy, format: formatMetric, preferHigher: true },
                      { label: "Policy", baseValue: baseState.rateLevel, quoteValue: quoteState.rateLevel, format: formatMetric, preferHigher: true },
                      { label: "Prev Policy", baseValue: baseState.rateLevel != null && baseState.rateDelta != null ? baseState.rateLevel - baseState.rateDelta : null, quoteValue: quoteState.rateLevel != null && quoteState.rateDelta != null ? quoteState.rateLevel - quoteState.rateDelta : null, format: formatMetric, preferHigher: true },
                      { label: "Policy Change", baseValue: baseState.rateDelta, quoteValue: quoteState.rateDelta, format: formatDelta, preferHigher: true },
                      { label: "Inflation", baseValue: baseState.inflationLevel, quoteValue: quoteState.inflationLevel, format: formatMetric, preferHigher: false },
                      { label: "Prev Inflation", baseValue: baseState.inflationLevel != null && baseState.inflationDelta != null ? baseState.inflationLevel - baseState.inflationDelta : null, quoteValue: quoteState.inflationLevel != null && quoteState.inflationDelta != null ? quoteState.inflationLevel - quoteState.inflationDelta : null, format: formatMetric, preferHigher: false },
                      { label: "Inflation Change", baseValue: baseState.inflationDelta, quoteValue: quoteState.inflationDelta, format: formatDelta, preferHigher: false },
                    ].map((metric) => {
                      const winner = renderMetricWinner(metric.baseValue, metric.quoteValue, metric.preferHigher);
                      return (
                        <div key={metric.label} className="grid grid-cols-[1.1fr,0.9fr,0.9fr] items-center border-b border-slate-200 px-4 py-3 last:border-b-0">
                          <div className="font-semibold text-slate-800">{metric.label}</div>
                          <div className={`text-right font-semibold tabular-nums ${winner === "base" ? "text-slate-900" : "text-slate-700"}`}>{metric.format(metric.baseValue)}</div>
                          <div className={`text-right font-semibold tabular-nums ${winner === "quote" ? "text-slate-900" : "text-slate-700"}`}>{metric.format(metric.quoteValue)}</div>
                        </div>
                      );
                    })}
                  </section>

                  <section className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="border-b border-slate-200 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Drivers</div>
                    <div className="space-y-2 px-4 py-4">
                      {detailReasons.map((reason) => (
                        <div key={reason} className="text-sm font-semibold leading-6 text-slate-800">{reason}</div>
                      ))}
                    </div>
                  </section>

                  <section className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-100 px-4 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">
                      <div>{selectedRow.pair.base}</div>
                      <div>{selectedRow.pair.quote}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-px bg-slate-200">
                      {[baseState, quoteState].map((state) => (
                        <div key={state.currency} className="bg-white px-4 py-4">
                          <div className="text-sm font-black text-slate-900">{state.currency}</div>
                          <div className="mt-3 space-y-2">
                            {state.notes.map((note) => (
                              <div key={note} className="text-xs leading-5 text-slate-700">{note}</div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </>
            ) : null}
          </aside>
        </div>
      </section>
    </div>
  );
}
