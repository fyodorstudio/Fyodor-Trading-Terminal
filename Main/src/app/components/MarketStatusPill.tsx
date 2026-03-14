import { useEffect, useMemo, useState } from "react";
import { formatCountdown } from "@/app/lib/format";
import type { MarketStatusResponse } from "@/app/types";

interface MarketStatusPillProps {
  status: MarketStatusResponse | null;
}

export function MarketStatusPill({ status }: MarketStatusPillProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const content = useMemo(() => {
    if (!status || status.session_state === "unavailable") {
      return {
        tone: "unavailable",
        label: "Session unavailable",
      };
    }

    if (status.session_state === "open") {
      return {
        tone: "open",
        label: `Market Open - closes in ${formatCountdown(status.next_close_time, nowMs)}`,
      };
    }

    return {
      tone: "closed",
      label: `Market Closed - opens in ${formatCountdown(status.next_open_time, nowMs)}`,
    };
  }, [nowMs, status]);

  return <div className={`market-pill market-pill-${content.tone}`}>{content.label}</div>;
}
