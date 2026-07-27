import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, HelpCircle, Info, RefreshCw, TrendingUp, X } from "lucide-react";
import { fetchHistory } from "@/app/lib/bridge";
import { FX_PAIRS } from "@/app/config/fxPairs";
import {
  MACRO_DRIVER_TIMEFRAMES,
  buildMacroFactorRows,
  buildMacroTrendState,
  findSnapshot,
  formatSnapshotValue,
  getInstrumentCurrencies,
  type MacroDriverTimeframe,
  type MacroTrendTone,
} from "@/app/lib/macroDrivers";
import type { BridgeCandle, CalendarEvent, CentralBankSnapshot, FxPairDefinition } from "@/app/types";

interface MacroDriversTabProps {
  events: CalendarEvent[];
  snapshots: CentralBankSnapshot[];
  currentTime: Date;
  initialSymbol?: string;
}

const GOLD_INSTRUMENT: FxPairDefinition = { name: "XAUUSD", base: "XAU", quote: "USD" };
const MACRO_INSTRUMENTS: FxPairDefinition[] = [GOLD_INSTRUMENT, ...FX_PAIRS];
const HISTORY_BARS: Record<MacroDriverTimeframe, number> = {
  W1: 140,
  D1: 260,
  H4: 220,
};

function getInstrument(name: string): FxPairDefinition {
  return MACRO_INSTRUMENTS.find((instrument) => instrument.name === name) ?? FX_PAIRS[0];
}

function toneClass(tone: MacroTrendTone): string {
  if (tone === "bullish") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "bearish") return "border-rose-200 bg-rose-50 text-rose-800";
  if (tone === "missing") return "border-slate-200 bg-slate-50 text-slate-500";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function MacroSnapshotCard({ currency, snapshots }: { currency: string; snapshots: CentralBankSnapshot[] }) {
  if (currency === "XAU") {
    return (
      <article className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <strong className="text-slate-950">XAU</strong>
          <span className="rounded-md border border-amber-300 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">
            Price-only
          </span>
        </div>
        <p className="mt-2 font-semibold leading-5 text-amber-900">
          Gold has no central-bank snapshot in the current data stack. This side uses price trend plus USD macro/calendar context.
        </p>
      </article>
    );
  }

  const snapshot = findSnapshot(currency, snapshots);
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <strong className="text-slate-950">{currency}</strong>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
          {snapshot?.status ?? "missing"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Policy</span>
          <strong className="text-base text-slate-950">{formatSnapshotValue(snapshot?.currentPolicyRate ?? null)}</strong>
        </div>
        <div>
          <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Inflation</span>
          <strong className="text-base text-slate-950">{formatSnapshotValue(snapshot?.currentInflationRate ?? null)}</strong>
        </div>
      </div>
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
        {snapshot?.bankName ?? "No central-bank snapshot resolved from the current MT5 calendar feed."}
      </p>
    </article>
  );
}

export function MacroDriversTab({
  events,
  snapshots,
  currentTime,
  initialSymbol = "EURUSD",
}: MacroDriversTabProps) {
  const initialInstrument = getInstrument(initialSymbol).name;
  const [selectedInstrument, setSelectedInstrument] = useState(initialInstrument);
  const [candlesByTimeframe, setCandlesByTimeframe] = useState<Partial<Record<MacroDriverTimeframe, BridgeCandle[]>>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDataLimitsOpen, setIsDataLimitsOpen] = useState(false);

  const instrument = getInstrument(selectedInstrument);
  const currencies = getInstrumentCurrencies(instrument);
  const nowSeconds = Math.floor(currentTime.getTime() / 1000);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    Promise.all(
      MACRO_DRIVER_TIMEFRAMES.map(async (timeframe) => {
        const candles = await fetchHistory(selectedInstrument, timeframe, HISTORY_BARS[timeframe]);
        return [timeframe, candles] as const;
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        setCandlesByTimeframe(Object.fromEntries(entries));
      })
      .catch((error) => {
        if (cancelled) return;
        setCandlesByTimeframe({});
        setLoadError(error instanceof Error ? error.message : "Unable to load MT5 candle history.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedInstrument]);

  const trendStates = useMemo(
    () =>
      MACRO_DRIVER_TIMEFRAMES.map((timeframe) =>
        buildMacroTrendState(timeframe, candlesByTimeframe[timeframe] ?? []),
      ),
    [candlesByTimeframe],
  );

  const factorRows = useMemo(
    () => buildMacroFactorRows({ events, currencies, nowSeconds }),
    [events, currencies, nowSeconds],
  );
  const coveredFactorCount = factorRows.filter((row) => row.coverageLabel !== "Missing").length;
  const scheduledFactorCount = factorRows.filter((row) => row.nextEvent).length;

  useEffect(() => {
    if (!isDataLimitsOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDataLimitsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDataLimitsOpen]);

  return (
    <section className="workspace-page workspace-page-compact macro-drivers-page flex h-[calc(100vh-98px)] min-h-[560px] flex-col gap-3 overflow-hidden">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-500">Active specialist tool</div>
            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Macro Drivers</h2>
            <p className="mt-1 max-w-3xl text-xs font-semibold leading-4 text-slate-500">
              Current-data-only driver map for forex and gold. It explains trend state, macro coverage, and missing evidence without issuing trade calls.
            </p>
          </div>
          <label className="min-w-[220px] flex-none">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Instrument</span>
            <select
              value={selectedInstrument}
              onChange={(event) => setSelectedInstrument(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white"
            >
              {MACRO_INSTRUMENTS.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <section className="grid min-h-0 flex-1 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-950">Trend State</h3>
              <p className="text-xs font-semibold leading-4 text-slate-500">W1 regime, D1 main trend, H4 confirmation from MT5 candles.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                {loading ? "Loading candles" : "MT5 OHLCV"}
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-200"
                onClick={() => setIsDataLimitsOpen(true)}
              >
                <Info className="h-4 w-4" />
                Data limits
              </button>
            </div>
          </div>

          {loadError ? (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {loadError}
            </div>
          ) : null}

          <div className="grid min-h-0 gap-3 lg:grid-cols-3">
            {trendStates.map((state) => (
              <article key={state.timeframe} className={`rounded-xl border p-3 ${toneClass(state.tone)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">{state.timeframe}</span>
                    <h4 className="mt-1 text-base font-black">{state.label}</h4>
                  </div>
                  <HelpCircle className="h-4 w-4" title={state.explanation} />
                </div>
                <div className="mt-3 grid gap-1.5 text-xs font-bold">
                  <div className="flex justify-between gap-3"><span>Close</span><strong>{state.closeLabel}</strong></div>
                  <div className="flex justify-between gap-3"><span>Change</span><strong>{state.changeLabel}</strong></div>
                  <div className="flex justify-between gap-3"><span>Range</span><strong>{state.rangeLabel}</strong></div>
                  <div className="flex justify-between gap-3"><span>Coverage</span><strong>{state.coverageLabel}</strong></div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 gap-3 overflow-hidden xl:grid-rows-[minmax(0,1fr)_auto]">
          <div className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-black text-slate-950">Current Macro Snapshot</h3>
            <p className="mt-1 text-xs font-semibold leading-4 text-slate-500">Central-bank rows currently resolved from the MT5 calendar feed.</p>
            <div className="mt-3 grid gap-3 overflow-auto pr-1">
              {[instrument.base, instrument.quote].map((currency) => (
                <MacroSnapshotCard key={currency} currency={currency} snapshots={snapshots} />
              ))}
            </div>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-950">Calendar Coverage</h3>
                <p className="mt-1 text-xs font-semibold leading-4 text-slate-500">Detailed factor rows belong in Overview pair details.</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">
                Overview owns details
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Covered</span>
                <strong className="mt-1 block text-lg font-black text-slate-950">{coveredFactorCount}/{factorRows.length}</strong>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Scheduled</span>
                <strong className="mt-1 block text-lg font-black text-slate-950">{scheduledFactorCount}</strong>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Scope</span>
                <strong className="mt-1 block text-lg font-black text-slate-950">Current feed</strong>
              </div>
            </div>
          </section>
        </div>
      </section>

      {isDataLimitsOpen ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/30 p-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Macro Drivers data limits"
          onClick={() => setIsDataLimitsOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Current-data-only</div>
                <h3 className="mt-1 text-xl font-black text-slate-950">What this tool cannot see yet</h3>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
                aria-label="Close data limits"
                onClick={() => setIsDataLimitsOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-amber-700" />
                <p className="m-0 text-sm font-semibold leading-6 text-amber-950">
                  Macro Drivers only uses MT5 candles, broker calendar rows, and central-bank snapshots. It does not
                  ingest yields, COT positioning, ETF or gold-flow data, real-rate curves, Fed-pricing data, DXY, or
                  risk proxies. Those sources would strengthen driver explanations, especially for gold, but they stay
                  outside the app until the data boundary is explicitly changed.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
