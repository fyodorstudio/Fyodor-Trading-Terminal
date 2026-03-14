import { useEffect, useState } from "react";
import { formatLocalClock } from "@/app/lib/format";

export function LocalClock() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return <div className="time-pill">{formatLocalClock(now)}</div>;
}
