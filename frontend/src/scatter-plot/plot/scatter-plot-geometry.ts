import type { MagnitudeDistribution } from '../../inspector/magnitude/magnitude-distribution'
import type { ScatterPoint } from '../contracts/scatter-plot-types'

export type ScatterAxisRange = { from: number; to: number }
export type ScatterViewport = { x?: ScatterAxisRange; y?: ScatterAxisRange }

export function scatterPlotGeometry(points: readonly ScatterPoint[], distribution: MagnitudeDistribution | null,
  zoom: boolean, width: number, height: number, inspectedAt?: number, viewport: ScatterViewport = {}, dateWindow?: ScatterAxisRange) {
  const left = 82, right = Math.max(left + 100, width - 18), top = 18, bottom = Math.max(top + 80, height - 48)
  const dates = points.map((point) => point.at)
  if (inspectedAt !== undefined) dates.push(inspectedAt)
  let first = dates.length ? Math.min(...dates) : 0, last = dates.length ? Math.max(...dates) : 86400000
  if (first === last) { first -= 15 * 86400000; last += 15 * 86400000 }
  const padding = (last - first) * .02
  first -= padding; last += padding
  if (dateWindow) { first = dateWindow.from; last = dateWindow.to }
  const maximum = Math.max(distribution?.threshold ?? 0, ...points.map((point) => Math.abs(point.delta)), 0)
  // Padding is exclusively visual; it never enters magnitude calculations.
  const extent = (zoom && distribution && distribution.threshold > 0 ? distribution.threshold : maximum || 1) * 1.12
  const defaultX = { from: first, to: last }, defaultY = { from: -extent, to: extent }
  if (viewport.x) { first = viewport.x.from; last = viewport.x.to }
  const minDelta = viewport.y?.from ?? -extent, maxDelta = viewport.y?.to ?? extent
  const x = (at: number) => left + (at - first) / (last - first) * (right - left)
  const y = (delta: number) => bottom - (delta - minDelta) / (maxDelta - minDelta) * (bottom - top)
  const pointY = (delta: number) => Math.max(top, Math.min(bottom, y(delta)))
  return { first, last, extent, minDelta, maxDelta, defaultX, defaultY, left, right, top, bottom, x, y, pointY,
    dateAt: (pixel: number) => first + (pixel - left) / (right - left) * (last - first),
    deltaAt: (pixel: number) => minDelta + (bottom - pixel) / (bottom - top) * (maxDelta - minDelta),
    dateTicks: Array.from({ length: width < 560 ? 3 : 5 }, (_, index) => {
      const count = width < 560 ? 3 : 5
      return first + (last - first) * index / (count - 1)
    }), deltaTicks: Array.from({ length: 5 }, (_, index) => minDelta + (maxDelta - minDelta) * index / 4) }
}
