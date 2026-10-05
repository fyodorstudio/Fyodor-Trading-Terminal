import type { ScatterPoint } from '../contracts/scatter-plot-types'
import type { ScatterAxisRange } from './scatter-plot-geometry'

// Twelve predecessors plus the inspected publication expose the prior-year
// comparison in a monthly series. This only controls the default X viewport.
export function scatterRecentWindow(points: readonly ScatterPoint[], at: number): ScatterAxisRange {
  const prior = points.filter((point) => point.at < at).slice(-12)
  let from = prior[0]?.at ?? at, to = at
  if (from === to) { from -= 15 * 86400000; to += 15 * 86400000 }
  const padding = (to - from) * .02
  return { from: from - padding, to: to + padding }
}
