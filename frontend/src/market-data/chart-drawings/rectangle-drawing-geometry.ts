import type { ChartDrawingPoint } from './chart-drawing-record'
import type { ChartDrawingScreenPoint } from './chart-drawing-screen-point'

export function rectangleCorners(points: ChartDrawingScreenPoint[]) {
  const [first, second] = points
  if (!first || !second) return []
  return [first, second, { ...first, y: second.y, price: second.price }, { ...second, y: first.y, price: first.price }]
}

// Keep two opposite stored anchors; derived corner edits change one component
// of each anchor, keeping the diagonally opposite corner fixed.
export function editRectangleCorner(points: ChartDrawingPoint[], corner: number, shifted: ChartDrawingPoint[]) {
  const [first, second] = points
  const [movedFirst, movedSecond] = shifted
  if (!first || !second || !movedFirst || !movedSecond) return points
  if (corner === 0) return [movedFirst, second]
  if (corner === 1) return [first, movedSecond]
  if (corner === 2) return [{ ...first, time: movedFirst.time }, { ...second, price: movedSecond.price }]
  return [{ ...first, price: movedFirst.price }, { ...second, time: movedSecond.time }]
}
