import type { ContextResult } from '../../scoring-system/context/usd/contracts'
import { usdContextPresentation } from '../core/usd-context-presentation'
export function raycasterLabel({ loading, message, cutoff, relative, result, symbol }: {
  loading: boolean; message: string | null; cutoff: number | null;
  relative: { label: string } | null | undefined; result: ContextResult | null | undefined; symbol: string
}) {
  return loading ? (relative ? 'Calculating EUR / USD context…' : 'Calculating USD context…') : message ? 'USD context unavailable' :
    cutoff === null ? 'Hover a candle to inspect' : relative ? relative.label : usdContextPresentation(symbol, result, cutoff).label
}
