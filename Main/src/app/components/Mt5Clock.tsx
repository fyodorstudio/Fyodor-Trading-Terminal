import { useEffect, useMemo, useState } from "react";
import { fetchServerTime, fetchSymbols } from "@/app/lib/bridge";
import { formatUtcClock } from "@/app/lib/format";

const PREFERRED_SYMBOLS = ["EURUSD", "USDJPY", "GBPUSD", "XAUUSD"];

function pickSymbol(symbols: string[]): string | undefined {
  for (const preferred of PREFERRED_SYMBOLS) {
    const found = symbols.find((symbol) => symbol.toUpperCase() === preferred);
    if (found) return found;
  }
  return symbols[0];
}

export function Mt5Clock() {
  const [serverTime, setServerTime] = useState<number | null>(null);
  const [connected, setConnected] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const symbols = await fetchSymbols();
      const symbol = pickSymbol(symbols.map((item) => item.name));
      const fetched = (await fetchServerTime(symbol)) ?? (await fetchServerTime());
      if (cancelled) return;
      setServerTime(fetched);
      setConnected(fetched != null);
    };

    void load();
    const id = window.setInterval(() => void load(), 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const label = useMemo(() => {
    if (!connected || serverTime == null) return "MT5 feed unavailable";
    return formatUtcClock(serverTime);
  }, [connected, serverTime]);

  return (
    <div className={`time-pill ${connected ? "" : "time-pill-offline"}`}>
      {label}
    </div>
  );
}
