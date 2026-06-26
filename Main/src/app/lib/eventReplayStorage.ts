export const EVENT_REPLAY_STORAGE_KEYS = {
  pair: "event-tools-pair",
  eventKey: "event-tools-event-key",
  replayTimeframe: "event-tools-replay-tf",
  sampleIndex: "event-tools-sample-index",
  beforeCandles: "event-tools-before-candles",
  afterCandles: "event-tools-after-candles",
};

export const DEFAULT_REPLAY_BEFORE_CANDLES = 14;
export const DEFAULT_REPLAY_AFTER_CANDLES = 14;
export const MIN_REPLAY_CANDLES = 2;
export const MAX_REPLAY_CANDLES = 80;

export function getStorageItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setStorageItem(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
}

export function clampReplayCount(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(MAX_REPLAY_CANDLES, Math.max(MIN_REPLAY_CANDLES, Math.round(value)));
}

export function getInitialReplayCount(key: string, fallback: number): number {
  return clampReplayCount(Number(getStorageItem(key) ?? fallback), fallback);
}
