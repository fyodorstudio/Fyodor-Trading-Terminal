import { useEffect, useMemo, useState } from "react";
import { deriveMacroState } from "@/app/lib/macroState";
import { deriveWatchlistEngine } from "@/app/lib/watchlistEngine";
import { FlagIcon } from "@/app/components/FlagIcon";
import type { CentralBankSnapshot } from "@/app/types";

interface MacroStatePrototypeTabProps {
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

function renderWinner(baseValue: number | null, quoteValue: number | null, preferHigher: boolean): "base" | "quote" | "tie" {
  if (baseValue == null || quoteValue == null || baseValue === quoteValue) return "tie";
  if (preferHigher) return baseValue > quoteValue ? "base" : "quote";
  return baseValue < quoteValue ? "base" : "quote";
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

export function MacroStatePrototypeTab({ snapshots, onBack }: MacroStatePrototypeTabProps) {
  const watchlist = useMemo(() => deriveWatchlistEngine(snapshots), [snapshots]);
  const pairOptions = watchlist.rows;
  const [selectedPairName, setSelectedPairName] = useState(pairOptions[0]?.pair.name ?? "EURUSD");

  useEffect(() => {
    if (!pairOptions.some((row) => row.pair.name === selectedPairName)) {
      setSelectedPairName(pairOptions[0]?.pair.name ?? "EURUSD");
    }
  }, [pairOptions, selectedPairName]);

  const macroState = useMemo(() => deriveMacroState(snapshots, selectedPairName), [selectedPairName, snapshots]);

  return (
    <div className="mx-auto flex max-w-[1460px] flex-col gap-6 pb-12">
      <section className="overflow-hidden rounded-3xl border border-gray-200/60 bg-white/75 shadow-sm backdrop-blur-xl">
        <div className="bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,64,175,0.92))] px-8 py-8 text-white">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-100/80">Fresh Specialist Prototype</div>
          <h2 className="mt-3 text-3xl font-black tracking-tight">Macro State</h2>
          <p className="mt-3 max-w-3xl text-sm text-blue-100/90">
            Step 3 in the workflow. Use this screen after your manual TradingView chart read to verify whether the current macro backdrop supports, conflicts with, or fails to clarify the pair you are studying.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200/60 bg-white/75 p-8 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Pair Context</div>
            <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900">Select Pair</h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Choose the pair you already inspected in TradingView, then use this page as a macro backdrop check instead of a timing or execution tool.
            </p>
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

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.38fr,0.62fr]">
          <aside className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.14),transparent_34%),linear-gradient(180deg,#050816,#07101f)] p-6 text-white shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-300">Selected Pair</div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="text-3xl font-black tracking-tight">{macroState.pair.name}</div>
              <div className="flex items-center gap-2">
                <FlagIcon countryCode={macroState.pair.base.slice(0, 2)} className="h-5 w-8 rounded-sm" />
                <FlagIcon countryCode={macroState.pair.quote.slice(0, 2)} className="h-5 w-8 rounded-sm" />
              </div>
            </div>
            <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-200">
              Rank #{macroState.row.rank}
            </div>
            <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.05] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">Macro Bias</div>
              <div className="mt-2 text-2xl font-black text-white">
                {renderBiasSummary(macroState.row.bias, macroState.pair.base, macroState.pair.quote)}
              </div>
              <div className="mt-3 text-sm leading-6 text-slate-200">{macroState.row.explanation}</div>
            </div>
          </aside>

          <section className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-6 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Composite Score Methodology</div>
            <h4 className="mt-2 text-xl font-black tracking-tight text-slate-900">How the numbers are produced</h4>

            <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Formula</div>
              <div className="mt-3 text-base font-black leading-7 text-slate-900">
                Composite score = 35% real-rate proxy + 30% policy rate level + 20% policy direction + 15% inflation direction
              </div>
              <div className="mt-4 text-sm leading-6 text-slate-700">
                Each currency gets its own composite score first. The pair&apos;s macro gap is then the absolute difference between the base composite score and the quote composite score.
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Inputs</div>
                <div className="mt-3 space-y-3 text-sm leading-6 text-slate-800">
                  <div><span className="font-black text-slate-900">Real-rate proxy 35%</span> = current policy rate - current inflation</div>
                  <div><span className="font-black text-slate-900">Policy rate level 30%</span> = current policy rate</div>
                  <div><span className="font-black text-slate-900">Policy direction 20%</span> = current policy rate - previous policy rate</div>
                  <div><span className="font-black text-slate-900">Inflation direction 15%</span> = current inflation - previous inflation</div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Normalization</div>
                <div className="mt-3 space-y-3 text-sm leading-6 text-slate-800">
                  <div><span className="font-black text-slate-900">Real-rate proxy</span> and <span className="font-black text-slate-900">policy rate level</span> are percentile-ranked against the current major-currency board.</div>
                  <div><span className="font-black text-slate-900">Policy direction</span> and <span className="font-black text-slate-900">inflation direction</span> are normalized against the largest absolute move on the board, then mapped into 0 to 1.</div>
                  <div>If an ingredient is missing, the score uses only the available ingredients rather than forcing a zero.</div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Current Pair Output</div>
                <div className="mt-3 space-y-3 text-sm leading-6 text-slate-800">
                  <div><span className="font-black text-slate-900">{macroState.pair.base} composite score</span> = {formatMetric("Composite score", macroState.base.compositeScore)}</div>
                  <div><span className="font-black text-slate-900">{macroState.pair.quote} composite score</span> = {formatMetric("Composite score", macroState.quote.compositeScore)}</div>
                  <div><span className="font-black text-slate-900">Macro gap</span> = |{formatMetric("Composite score", macroState.base.compositeScore)} - {formatMetric("Composite score", macroState.quote.compositeScore)}| = {macroState.row.pairScore.toFixed(4)}</div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Verdict Rule</div>
                <div className="mt-3 space-y-3 text-sm leading-6 text-slate-800">
                  <div>If one side has the higher composite score and the macro gap is at least <span className="font-black text-slate-900">0.035</span>, the verdict points to that stronger currency.</div>
                  <div>If the macro gap is below <span className="font-black text-slate-900">0.035</span>, the pair is treated as mixed.</div>
                  <div>Current verdict: <span className="font-black text-slate-900">{renderBiasSummary(macroState.row.bias, macroState.pair.base, macroState.pair.quote)}</span></div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
        <div className="rounded-3xl border border-gray-200/60 bg-white/75 p-8 shadow-sm backdrop-blur-xl">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Verdict</div>
          <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900">Why {macroState.pair.base} vs {macroState.pair.quote}</h3>
          <div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
            <div className="flex flex-wrap items-start gap-3">
              <div className="text-2xl font-black tracking-tight text-slate-900">
                {renderBiasSummary(macroState.row.bias, macroState.pair.base, macroState.pair.quote)}
              </div>
              {macroState.strongerCurrency ? (
                <div className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">
                  Stronger side: {macroState.strongerCurrency}
                </div>
              ) : (
                <div className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-700">
                  No dominant side
                </div>
              )}
            </div>
            <div className="mt-5 space-y-3">
              {macroState.narrative.map((line, index) => (
                <div key={line} className="flex gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">
                    {index + 1}
                  </div>
                  <div className="text-sm leading-6 text-slate-800">{line}</div>
                </div>
              ))}
            </div>
            {macroState.row.partialNote ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                {macroState.row.partialNote}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200/60 bg-white/75 p-8 shadow-sm backdrop-blur-xl">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Regime</div>
          <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900">Current Active Regime</h3>
          <div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="text-2xl font-black tracking-tight text-slate-900">{formatRegimeLabel(macroState.regimeLabel)}</div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-700">{macroState.regimeExplanation}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200/60 bg-white/75 p-8 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-5">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Comparison Board</div>
            <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900">Base vs Quote</h3>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">
            {macroState.pair.base} vs {macroState.pair.quote}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-slate-700">
          Composite score comes from policy rate, inflation, policy direction, inflation direction, and real-rate proxy. The highlighted side is stronger on that specific metric.
        </div>

        <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-200">
          <div className="grid grid-cols-[1.2fr,0.8fr,0.8fr] border-b border-slate-200 bg-slate-100 px-5 py-4 text-[10px] font-black uppercase tracking-[0.24em] text-slate-700">
            <div>Metric</div>
            <div className="text-right">{macroState.pair.base}</div>
            <div className="text-right">{macroState.pair.quote}</div>
          </div>
          {macroState.metrics.map((metric) => {
            const winner = renderWinner(metric.baseValue, metric.quoteValue, metric.preferHigher);
            return (
              <div key={metric.label} className="border-b border-slate-200 bg-white px-5 py-4 last:border-b-0">
                <div className="grid grid-cols-[1.2fr,0.8fr,0.8fr] items-start gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-900">{metric.label}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-700">{metric.note}</div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`inline-flex rounded-2xl px-3 py-2 text-sm font-black ${
                        winner === "base" ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300" : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      {formatMetric(metric.label, metric.baseValue)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`inline-flex rounded-2xl px-3 py-2 text-sm font-black ${
                        winner === "quote" ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300" : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      {formatMetric(metric.label, metric.quoteValue)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
