import type { BridgeSymbol } from "@/app/types";

export function areBridgeSymbolSnapshotsEqual(
  current: readonly BridgeSymbol[],
  next: readonly BridgeSymbol[],
): boolean {
  return current.length === next.length && current.every((item, index) => {
    const candidate = next[index];
    return candidate != null
      && item.name === candidate.name
      && item.path === candidate.path
      && item.bid === candidate.bid
      && item.ask === candidate.ask
      && item.priceChange === candidate.priceChange
      && item.digits === candidate.digits
      && item.quoteTime === candidate.quoteTime
      && item.visible === candidate.visible
      && item.selected === candidate.selected
      && item.synchronized === candidate.synchronized;
  });
}

export function filterMarketWatchSymbols(
  symbols: readonly BridgeSymbol[],
  search: string,
): BridgeSymbol[] {
  const query = search.trim().toLowerCase();
  return query ? symbols.filter((item) => item.name.toLowerCase().includes(query)) : [...symbols];
}

export interface VirtualMarketWatchWindow {
  start: number;
  end: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
}

export function getVirtualMarketWatchWindow(
  itemCount: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight = 23,
  overscan = 8,
): VirtualMarketWatchWindow {
  const safeCount = Math.max(0, Math.trunc(itemCount));
  const safeRowHeight = Math.max(1, rowHeight);
  const firstVisible = Math.max(0, Math.floor(Math.max(0, scrollTop) / safeRowHeight));
  const visibleCount = Math.max(1, Math.ceil(Math.max(0, viewportHeight) / safeRowHeight));
  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(safeCount, firstVisible + visibleCount + overscan);
  return {
    start,
    end,
    topSpacerHeight: start * safeRowHeight,
    bottomSpacerHeight: Math.max(0, safeCount - end) * safeRowHeight,
  };
}

export function formatMarketWatchPrice(value: number | null, digits: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const precision = digits == null || !Number.isFinite(digits)
    ? 5
    : Math.max(0, Math.min(10, Math.trunc(digits)));
  return value.toFixed(precision);
}

export function formatMarketWatchChange(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}
