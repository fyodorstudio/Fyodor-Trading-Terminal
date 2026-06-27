import { useEffect, useState } from "react";
import { fetchMarketStatus } from "@/app/lib/bridge";
import type { MarketStatusResponse } from "@/app/types";

const POLL_INTERVAL_MS = 60_000;

export function useMarketStatus(symbol: string) {
  const [marketStatus, setMarketStatus] = useState<MarketStatusResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const next = await fetchMarketStatus(symbol);
      if (cancelled) return;
      setMarketStatus(next);
    };

    void load();
    const id = window.setInterval(() => void load(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [symbol]);

  return marketStatus;
}
