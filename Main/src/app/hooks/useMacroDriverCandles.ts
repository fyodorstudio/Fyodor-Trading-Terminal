import { useEffect, useState } from "react";
import { fetchHistory } from "@/app/lib/bridge";
import { MACRO_DRIVER_TIMEFRAMES, type MacroDriverTimeframe } from "@/app/lib/macroDrivers";
import type { BridgeCandle } from "@/app/types";

const HISTORY_BARS: Record<MacroDriverTimeframe, number> = {
  W1: 140,
  D1: 260,
  H4: 220,
};

export function useMacroDriverCandles(selectedInstrument: string) {
  const [candlesByTimeframe, setCandlesByTimeframe] = useState<Partial<Record<MacroDriverTimeframe, BridgeCandle[]>>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  return {
    candlesByTimeframe,
    loading,
    loadError,
  };
}
