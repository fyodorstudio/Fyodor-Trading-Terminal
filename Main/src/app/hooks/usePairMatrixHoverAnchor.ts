import { startTransition, useEffect, useState } from "react";
import type { PairMatrixHoverRuntime } from "@/app/lib/pairMatrixHoverRuntime";

export function usePairMatrixHoverAnchor(runtime: PairMatrixHoverRuntime | null): number | null {
  const [anchor, setAnchor] = useState<number | null>(() => runtime?.getAnchor() ?? null);
  useEffect(() => {
    if (!runtime) {
      setAnchor(null);
      return;
    }
    setAnchor(runtime.getAnchor());
    return runtime.subscribe((nextAnchor) => {
      startTransition(() => setAnchor(nextAnchor));
    });
  }, [runtime]);
  return anchor;
}
