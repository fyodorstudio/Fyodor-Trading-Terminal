import { useEffect, useState } from "react";

export function useCurrentTime(intervalMs = 1000): Date {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return currentTime;
}
