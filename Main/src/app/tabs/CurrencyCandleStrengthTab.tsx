import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { FX_PAIRS } from "@/app/config/fxPairs";
import { fetchHistory } from "@/app/lib/bridge";
import { deriveCurrencyCandleStrength, type CandleStrengthPairInput } from "@/app/lib/currencyCandleStrength";

interface CurrencyCandleStrengthTabProps {
  onBack: () => void;
}

function formatReturn(value: number | null): string {
  if (value == null) return "N/A";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}

function stateLabel(state: string): string {
  if (state === "strong") return "Broad strength";
  if (state === "weak") return "Broad weakness";
  return "Mixed";
}

export function CurrencyCandleStrengthTab({ onBack }: CurrencyCandleStrengthTabProps) {
  const [candleMap, setCandleMap] = useState<Partial<Record<string, CandleStrengthPairInput>>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    const entries = await Promise.all(
      FX_PAIRS.map(async (pair) => {
        try {
          const [d1, h4] = await Promise.all([
            fetchHistory(pair.name, "D1", 35),
            fetchHistory(pair.name, "H4", 35),
          ]);
          return [pair.name, { d1, h4 }] as const;
        } catch {
          return [pair.name, { d1: [], h4: [] }] as const;
        }
      }),
    );

    const nextMap = Object.fromEntries(entries);
    setCandleMap(nextMap);
    setFailed(entries.every(([, value]) => value.d1.length === 0 && value.h4.length === 0));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const result = useMemo(() => deriveCurrencyCandleStrength(candleMap), [candleMap]);

  return (
    <div className="mx-auto flex max-w-[1460px] flex-col gap-6 pb-12">
      <section className="overflow-hidden rounded-3xl border border-gray-200/60 bg-white/75 shadow-sm backdrop-blur-xl">
        <div className="bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,64,175,0.92))] px-8 py-8 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-100/80">Prototype</div>
              <h2 className="mt-3 text-3xl font-black tracking-tight">Currency Strength From Candles</h2>
              <p className="mt-3 max-w-3xl text-sm font-semibold text-blue-100/90">
                A plain candle-only board: when a pair rises, base strength goes up and quote strength goes down.
              </p>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white/15"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200/60 bg-white/75 p-8 shadow-sm backdrop-blur-xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Major Currency Board</h3>
            <p className="mt-1 text-sm text-slate-600">
              {loading
                ? "Loading D1 and H4 candles..."
                : failed
                  ? "No candle history resolved from the bridge."
                  : `${result.resolvedPairs} of ${result.totalPairs} FX pairs resolved.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
          <table className="min-w-full border-collapse">
            <thead className="bg-slate-100">
              <tr className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">
                <th className="px-4 py-3 text-left">Rank</th>
                <th className="px-4 py-3 text-left">Currency</th>
                <th className="px-4 py-3 text-right">State</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3 text-right">D1 Avg</th>
                <th className="px-4 py-3 text-right">H4 Avg</th>
                <th className="px-4 py-3 text-right">Coverage</th>
                <th className="px-4 py-3 text-left">Largest Contributions</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, index) => (
                <tr key={row.currency} className="border-t border-slate-200">
                  <td className="px-4 py-4 text-sm font-semibold tabular-nums text-slate-700">#{index + 1}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <FlagIcon countryCode={row.countryCode} className="h-4 w-7 rounded-sm" />
                      <span className="font-black text-slate-900">{row.currency}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right text-sm font-semibold text-slate-700">{stateLabel(row.state)}</td>
                  <td className="px-4 py-4 text-right text-sm font-black tabular-nums text-slate-900">{row.score.toFixed(4)}</td>
                  <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-slate-700">{formatReturn(row.averageD1)}</td>
                  <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-slate-700">{formatReturn(row.averageH4)}</td>
                  <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-slate-700">
                    {(row.coverage * 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-4 text-sm leading-6 text-slate-700">
                    {row.evidence.length > 0 ? row.evidence.join(" | ") : "No usable pair candles yet."}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {result.methodology.map((line) => (
            <div key={line} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-700">
              {line}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
