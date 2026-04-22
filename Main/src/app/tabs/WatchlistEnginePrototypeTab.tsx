import { ChevronRight } from "lucide-react";
import { deriveWatchlistEngine } from "@/app/lib/watchlistEngine";
import { FlagIcon } from "@/app/components/FlagIcon";
import type { CentralBankSnapshot } from "@/app/types";

interface WatchlistEnginePrototypeTabProps {
  snapshots: CentralBankSnapshot[];
  onBack: () => void;
}

function formatScore(value: number): string {
  return value.toFixed(4);
}

function renderBiasLabel(value: string): string {
  if (value === "bullish_base") return "Bullish base";
  if (value === "bullish_quote") return "Bullish quote";
  return "Mixed";
}

export function WatchlistEnginePrototypeTab({ snapshots, onBack }: WatchlistEnginePrototypeTabProps) {
  const result = deriveWatchlistEngine(snapshots);

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
            <p className="mt-1 text-sm text-slate-600">Full FX ranking by current macro divergence, ordered from strongest separation to weakest.</p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50"
          >
            Back To WORK IN PROGRESS
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {result.rows.map((row) => (
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
                      className="inline-flex min-h-[36px] items-center gap-2 self-center bg-transparent px-0 py-0 text-base font-black text-white transition-colors hover:text-blue-200"
                    >
                      <span className="leading-none">Macro state later</span>
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-slate-100 transition-all hover:border-white/20 hover:bg-white/[0.14]">
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
    </div>
  );
}
