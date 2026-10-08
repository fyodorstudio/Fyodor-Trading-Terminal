import type { ChartDrawingPoint } from './chart-drawing-record'
import type { ChartDrawingScreenPoint } from './chart-drawing-screen-point'

export const defaultChannelOffset = 22

// Two baseline endpoints and an opposite-edge anchor at the first endpoint's time.
export function parallelChannelCorners(points: ChartDrawingScreenPoint[]) {
  const [first, second, anchor] = points
  if (!first || !second) return []
  const offset = anchor ? anchor.y - first.y : defaultChannelOffset
  return [first, second, { ...first, y: first.y + offset }, { ...second, y: second.y + offset }]
}

export function editParallelChannel(
  points: ChartDrawingPoint[],
  cornerIndex: number,
  point: ChartDrawingPoint,
  deltaPrice: number,
): ChartDrawingPoint[] {
  const [first, second, anchor] = points
  if (!first || !second || !anchor) return points
  const offset = anchor.price - first.price
  if (cornerIndex >= 2) {
    return [first, second, { time: first.time, price: anchor.price + deltaPrice }]
  }
  const nextFirst = cornerIndex === 0 ? point : first
  const nextSecond = cornerIndex === 1 ? point : second
  return [nextFirst, nextSecond, { time: nextFirst.time, price: nextFirst.price + offset }]
}
