export interface PairMatrixHoverRuntime {
  getAnchor: () => number | null;
  publishAnchor: (anchor: number | null) => void;
  subscribe: (listener: (anchor: number | null) => void) => () => void;
}

export function createPairMatrixHoverRuntime(initialAnchor: number | null = null): PairMatrixHoverRuntime {
  let anchor = initialAnchor;
  const listeners = new Set<(anchor: number | null) => void>();
  return {
    getAnchor: () => anchor,
    publishAnchor: (nextAnchor) => {
      if (anchor === nextAnchor) return;
      anchor = nextAnchor;
      listeners.forEach((listener) => listener(anchor));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
