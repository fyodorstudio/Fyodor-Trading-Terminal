import type { ScatterPoint } from '../contracts/scatter-plot-types'

export function scatterLinePath(points: readonly ScatterPoint[], x: (at: number) => number, y: (delta: number) => number) {
  // Use real Y coordinates and the plot clip, never the clamped edge markers.
  // No smoothing or synthetic observations are introduced between publications.
  return points.map((point, index) => `${index === 0 || point.breakBefore ? 'M' : 'L'} ${x(point.at)} ${y(point.delta)}`).join(' ')
}
