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
  deltaPrice: number,
): ChartDrawingPoint[] {
  const [first, second, anchor] = points
  if (!first || !second || !anchor) return points
  if (cornerIndex >= 2) {
    return [first, second, { time: first.time, price: anchor.price + deltaPrice }]
  }
  // Either baseline corner moves that entire edge vertically. The opposite
  // edge remains fixed, and time span and slope remain unchanged.
  return [{ ...first, price: first.price + deltaPrice }, { ...second, price: second.price + deltaPrice }, anchor]
}
