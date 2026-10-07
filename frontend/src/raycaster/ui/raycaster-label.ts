import type { ContextResult } from '../../usd-context/core/contracts'
import { contextResultLabel } from '../../usd-context/core/usd-pair'
export function raycasterLabel({ loading, message, cutoff, relative, result, symbol }: {
  loading: boolean; message: string | null; cutoff: number | null;
  relative: { label: string } | null | undefined; result: Pick<ContextResult, 'direction' | 'decision'> | null | undefined; symbol: string
}) {
  return loading ? (relative ? 'Calculating EUR / USD context…' : 'Calculating USD context…') : message ? 'USD context unavailable' :
    cutoff === null ? 'Hover a candle to inspect' : relative ? relative.label : result ? contextResultLabel(symbol, result) : 'Uncomputed'
}
