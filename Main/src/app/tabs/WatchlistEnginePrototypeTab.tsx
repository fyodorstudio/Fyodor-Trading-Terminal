import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { deriveWatchlistEngine } from "@/app/lib/watchlistEngine";
import { FlagIcon } from "@/app/components/FlagIcon";
import type { CentralBankSnapshot, WatchlistCurrencyState, WatchlistPairRow } from "@/app/types";

interface WatchlistEnginePrototypeTabProps {
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

function describeCurrencyMetric(label: string, value: number | null, note: string): string {
  if (value == null) return `${label}: missing input. ${note}`;
  return `${label}: ${value.toFixed(2)}. ${note}`;
}

function renderMetricWinner(baseValue: number | null, quoteValue: number | null, preferHigher: boolean): "base" | "quote" | "tie" {
  if (baseValue == null || quoteValue == null || baseValue === quoteValue) return "tie";
  if (preferHigher) return baseValue > quoteValue ? "base" : "quote";
  return baseValue < quoteValue ? "base" : "quote";
}

function buildReasonDetail(row: WatchlistPairRow, base: WatchlistCurrencyState | undefined, quote: WatchlistCurrencyState | undefined): string[] {
  if (!base || !quote) {
    return ["Coverage is incomplete, so the pair is only carrying a partial macro read for now."];
  }

  if (row.bias === "mixed") {
    return [
      `The macro gap is only ${formatScore(row.pairScore)}, which is still below the threshold needed for a cleaner directional read.`,
      `${base.currency} composite score is ${formatScore(base.compositeScore ?? 0)} while ${quote.currency} is ${formatScore(quote.compositeScore ?? 0)}.`,
      "That is why the engine keeps this pair in a mixed state instead of forcing a bullish-base or bullish-quote label.",
    ];
  }

  const stronger = row.strongerSide === base.currency ? base : quote;
  const weaker = stronger.currency === base.currency ? quote : base;

  const reasons: string[] = [
    `${stronger.currency} leads the pair with a composite score of ${formatScore(stronger.compositeScore ?? 0)} versus ${formatScore(weaker.compositeScore ?? 0)} for ${weaker.currency}.`,
    `That creates the current pair divergence score of ${formatScore(row.pairScore)} and produces the ${renderBiasLabel(row.bias).toLowerCase()} label.`,
  ];

  if (stronger.realRateProxy != null && weaker.realRateProxy != null && stronger.realRateProxy > weaker.realRateProxy) {
    reasons.push(
      `${stronger.currency} real-rate proxy is stronger at ${formatMetric(stronger.realRateProxy)} versus ${formatMetric(weaker.realRateProxy)} for ${weaker.currency}, which supports the stronger tag.`,
    );
  }
  if (stronger.rateLevel != null && weaker.rateLevel != null && stronger.rateLevel > weaker.rateLevel) {
    reasons.push(
      `Rate differential still favors ${stronger.currency}: ${formatMetric(stronger.rateLevel)} policy rate versus ${formatMetric(weaker.rateLevel)} for ${weaker.currency}.`,
    );
  }
  if (stronger.inflationDelta != null && weaker.inflationDelta != null && stronger.inflationDelta < weaker.inflationDelta) {
    reasons.push(
      `${stronger.currency} inflation direction is softer: ${formatDelta(stronger.inflationDelta)} versus ${formatDelta(weaker.inflationDelta)} for ${weaker.currency}.`,
    );
  }
  if (stronger.rateDelta != null && stronger.rateDelta > 0) {
    reasons.push(
      `${stronger.currency} policy direction is firmer because its rate changed by ${formatDelta(stronger.rateDelta)} versus ${formatDelta(weaker.rateDelta)} on the other side.`,
    );
  }
  if (reasons.length === 2) {
    reasons.push("No single ingredient dominated enough to create a named tag on its own, so the edge comes from the combined composite score.");
  }

  return reasons;
}

export function WatchlistEnginePrototypeTab({ snapshots, onBack }: WatchlistEnginePrototypeTabProps) {
  const result = deriveWatchlistEngine(snapshots);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedPairName, setSelectedPairName] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(result.rows.length / PAGE_SIZE));
  const clampedPageIndex = Math.min(pageIndex, totalPages - 1);
  const startIndex = clampedPageIndex * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, result.rows.length);
  const visibleRows = result.rows.slice(startIndex, endIndex);
  const selectedRow = selectedPairName ? result.rows.find((row) => row.pair.name === selectedPairName) ?? null : null;
  const baseState = selectedRow ? result.currencies.find((item) => item.currency === selectedRow.pair.base) : undefined;
  const quoteState = selectedRow ? result.currencies.find((item) => item.currency === selectedRow.pair.quote) : undefined;
  const detailReasons = selectedRow ? buildReasonDetail(selectedRow, baseState, quoteState) : [];
  const strongerCurrency = selectedRow?.strongerSide ?? null;

  return (
    <div className="mx-auto flex max-w-[1460px] flex-col gap-6 pb-12">
      <section className="overflow-hidden rounded-3xl border border-gray-200/60 bg-white/75 shadow-sm backdrop-blur-xl">
        <div className="bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,64,175,0.92))] px-8 py-8 text-white">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-100/80">Fresh Specialist Prototype</div>
          <h2 className="mt-3 text-3xl font-black tracking-tight">Watchlist Engine</h2>
          <p className="mt-3 max-w-3xl text-sm text-blue-100/90">
            The first step of the rebuilt workflow. This screen ranks FX pairs by deterministic macro divergence so you know which charts deserve your attention first.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200/60 bg-white/75 p-8 shadow-sm backdrop-blur-xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Open First</h3>
            <p className="mt-1 text-sm text-slate-600">FX ranking by current macro divergence, shown 5 pairs at a time from strongest separation to weakest.</p>
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

        <div className="flex flex-col gap-3">
          {visibleRows.map((row) => (
            <article
              key={row.pair.name}
              className="rounded-[20px] border border-slate-200 bg-[#050816] px-5 py-3 text-white shadow-sm"
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <div className="text-[11px] font-black uppercase tracking-widest text-blue-200/70">Rank #{row.rank}</div>
                    <div className="text-[22px] leading-none font-black tracking-tight">{row.pair.name}</div>
                    <div className="flex items-center gap-2">
                      <FlagIcon countryCode={row.pair.base.slice(0, 2)} className="h-4 w-7 rounded-sm" />
                      <FlagIcon countryCode={row.pair.quote.slice(0, 2)} className="h-4 w-7 rounded-sm" />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-4">
                    <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bias</span>
                        <span className="text-sm font-black text-white">{renderBiasLabel(row.bias)}</span>
                      </div>
                      <span className="h-4 w-px bg-white/10" />
                      <div className="flex items-baseline gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Score</span>
                        <span className="text-lg leading-none font-black text-white">{formatScore(row.pairScore)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPairName(row.pair.name)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 self-center bg-transparent px-0 py-0 text-base font-black text-white transition-colors hover:text-blue-200"
                    >
                      <span className="leading-none">More Details</span>
                      <span className="inline-flex items-center justify-center text-slate-100 transition-colors hover:text-white">
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1 text-[15px] font-bold leading-5 text-slate-100">
                    {row.explanation}
                  </div>
                  {row.partialNote ? (
                    <div className="text-xs font-bold text-amber-300">{row.partialNote}</div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {row.reasonTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200/60 bg-white/75 p-8 shadow-sm backdrop-blur-xl">
        <h3 className="text-lg font-black tracking-tight text-slate-900">Methodology / Limits</h3>
        <div className="mt-4 space-y-3">
          {result.methodology.map((line) => (
            <div key={line} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-6 text-slate-700">
              {line}
            </div>
          ))}
        </div>
      </section>

      {selectedRow ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedRow.pair.name} more details`}
          onClick={() => setSelectedPairName(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_32%),linear-gradient(180deg,#050816,#07101f)] p-6 text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-200/70">More Details</div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="text-3xl font-black tracking-tight">{selectedRow.pair.name}</div>
                  <div className="flex items-center gap-2">
                    <FlagIcon countryCode={selectedRow.pair.base.slice(0, 2)} className="h-5 w-8 rounded-sm" />
                    <FlagIcon countryCode={selectedRow.pair.quote.slice(0, 2)} className="h-5 w-8 rounded-sm" />
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-black uppercase tracking-widest text-slate-200">
                    Rank #{selectedRow.rank}
                  </div>
                </div>
                <p className="mt-3 max-w-3xl text-sm text-slate-300">{selectedRow.explanation}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPairName(null)}
                aria-label="Close more details"
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-200 transition-colors hover:bg-white/[0.1] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-4">
              <section className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5 lg:col-span-2">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Current Read</div>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div className="text-2xl font-black tracking-tight text-white">{renderBiasLabel(selectedRow.bias)}</div>
                  {strongerCurrency ? (
                    <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-200">
                      Leaning toward {strongerCurrency}
                    </div>
                  ) : (
                    <div className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">
                      No clear side yet
                    </div>
                  )}
                </div>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                  Deterministic read built from policy rate level, real-rate proxy, and directional change versus previous releases.
                </p>
              </section>

              <section className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Pair Score</div>
                <div className="mt-3 text-4xl font-black tracking-tight text-white">{formatScore(selectedRow.pairScore)}</div>
                <div className="mt-2 text-sm text-slate-300">Gap between the base and quote composite scores.</div>
              </section>

              <section className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Coverage</div>
                <div className="mt-3 text-4xl font-black tracking-tight text-white">{(selectedRow.coverage * 100).toFixed(0)}%</div>
                <div className="mt-2 text-sm text-slate-300">How much of the intended macro input set is currently available.</div>
              </section>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr,1.35fr]">
              <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Why This Pair</div>
                    <h4 className="mt-2 text-xl font-black tracking-tight text-white">Narrative</h4>
                  </div>
                  <div className="rounded-full border border-blue-400/20 bg-blue-500/[0.08] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-blue-200">
                    {selectedRow.reasonTags.length} active drivers
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {detailReasons.map((reason, index) => (
                    <div key={reason} className="flex gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/8 text-xs font-black text-slate-200">
                        {index + 1}
                      </div>
                      <div className="text-sm leading-6 text-slate-200">{reason}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Engine Tags</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedRow.reasonTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-blue-400/20 bg-blue-500/[0.10] px-3 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-blue-100"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Base Vs Quote</div>
                    <h4 className="mt-2 text-xl font-black tracking-tight text-white">Macro comparison board</h4>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
                    Base {selectedRow.pair.base} vs Quote {selectedRow.pair.quote}
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/45">
                  <div className="grid grid-cols-[1fr,0.95fr,0.95fr] border-b border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                    <div>Metric</div>
                    <div className="text-right">{selectedRow.pair.base}</div>
                    <div className="text-right">{selectedRow.pair.quote}</div>
                  </div>

                  {[
                    {
                      label: "Composite score",
                      baseValue: baseState?.compositeScore ?? null,
                      quoteValue: quoteState?.compositeScore ?? null,
                      format: formatScore,
                      preferHigher: true,
                      note: "Higher score means the currency side carries the cleaner macro backdrop.",
                    },
                    {
                      label: "Real-rate proxy",
                      baseValue: baseState?.realRateProxy ?? null,
                      quoteValue: quoteState?.realRateProxy ?? null,
                      format: (value: number | null) => formatMetric(value),
                      preferHigher: true,
                      note: "Rate minus inflation. Higher generally supports the stronger side.",
                    },
                    {
                      label: "Policy rate",
                      baseValue: baseState?.rateLevel ?? null,
                      quoteValue: quoteState?.rateLevel ?? null,
                      format: (value: number | null) => formatMetric(value),
                      preferHigher: true,
                      note: "Higher rate level can keep the differential in that currency's favor.",
                    },
                    {
                      label: "Policy direction",
                      baseValue: baseState?.rateDelta ?? null,
                      quoteValue: quoteState?.rateDelta ?? null,
                      format: formatDelta,
                      preferHigher: true,
                      note: "Positive change versus previous implies firmer policy direction.",
                    },
                    {
                      label: "Inflation direction",
                      baseValue: baseState?.inflationDelta ?? null,
                      quoteValue: quoteState?.inflationDelta ?? null,
                      format: formatDelta,
                      preferHigher: false,
                      note: "Lower inflation direction is treated as softer and can support real-rate quality.",
                    },
                  ].map((metric) => {
                    const winner = renderMetricWinner(metric.baseValue, metric.quoteValue, metric.preferHigher);
                    return (
                      <div key={metric.label} className="border-b border-white/10 px-4 py-4 last:border-b-0">
                        <div className="grid grid-cols-[1fr,0.95fr,0.95fr] items-start gap-3">
                          <div>
                            <div className="text-sm font-black text-white">{metric.label}</div>
                            <div className="mt-1 text-xs leading-5 text-slate-400">{metric.note}</div>
                          </div>
                          <div className="text-right">
                            <div
                              className={`inline-flex rounded-2xl px-3 py-2 text-sm font-black ${
                                winner === "base" ? "bg-emerald-400/12 text-emerald-200 ring-1 ring-emerald-400/25" : "bg-white/[0.04] text-slate-200"
                              }`}
                            >
                              {metric.format(metric.baseValue)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={`inline-flex rounded-2xl px-3 py-2 text-sm font-black ${
                                winner === "quote" ? "bg-emerald-400/12 text-emerald-200 ring-1 ring-emerald-400/25" : "bg-white/[0.04] text-slate-200"
                              }`}
                            >
                              {metric.format(metric.quoteValue)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {[baseState, quoteState].filter(Boolean).map((state) => (
                    <div key={state!.currency} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Currency Notes</div>
                          <div className="mt-2 text-lg font-black text-white">{state!.currency}</div>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
                          {(state!.coverage * 100).toFixed(0)}% coverage
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        {state!.notes.map((note) => (
                          <div key={note} className="text-xs leading-5 text-slate-300">
                            {note}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
