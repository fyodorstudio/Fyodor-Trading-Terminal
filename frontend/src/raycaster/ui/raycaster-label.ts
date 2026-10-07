import type { UsdDirection } from '../../usd-context/core/contracts'
import { contextPairLabel } from '../../usd-context/core/usd-pair'
export function raycasterLabel({ loading, message, cutoff, relative, result, symbol }: {
  loading: boolean; message: string | null; cutoff: number | null;
  relative: { label: string } | null | undefined; result: { direction: UsdDirection } | null | undefined; symbol: string
}) {
  return loading ? (relative ? 'Calculating EUR / USD context…' : 'Calculating USD context…') : message ? 'USD context unavailable' :
    cutoff === null ? 'Hover a candle to inspect' : relative ? relative.label : result ? contextPairLabel(symbol, result.direction) : 'Uncomputed'
}
