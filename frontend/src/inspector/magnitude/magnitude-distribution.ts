// Seven signed A−P bands: three negative, exact zero, three positive.
export const magnitudeDistributionVersion = 'zero-centered-ap-p95-v4'
export function magnitudeDistribution(values: readonly number[], current: number | null) {
  const samples = values.filter(Number.isFinite)
  if (!samples.length) return null
  const magnitudes = samples.map(Math.abs).sort((a, b) => a - b)
  // Type-7 P95 of |A−P|, including zeros and all historical extremes.
  const positionNumerator = (magnitudes.length - 1) * 19, lower = Math.floor(positionNumerator / 20)
  const threshold = magnitudes[lower] +
    (magnitudes[Math.min(lower + 1, magnitudes.length - 1)] - magnitudes[lower]) * (positionNumerator % 20) / 20
  const limits = [threshold / 3, threshold * 2 / 3, threshold]
  const bins = Array<number>(7).fill(0)
  let extremeBelow = 0, extremeAbove = 0
  let min = Infinity, max = -Infinity
  for (const value of samples) {
    min = Math.min(min, value); max = Math.max(max, value)
    const index = binIndex(limits, value)
    if (index !== null) bins[index]++
    else if (value < 0) extremeBelow++
    else extremeAbove++
  }
  const reading = current !== null && Number.isFinite(current) ? current : null
  const selectedIndex = reading === null ? null : binIndex(limits, reading)
  const currentExtreme = reading === null || selectedIndex !== null ? null : reading < 0 ? 'negative' as const : 'positive' as const
  const currentSize = reading === null ? 'Unavailable' : selectedIndex === null ? 'Extreme' : magnitudeBandLabel(selectedIndex)
  return { bins, limits, threshold, count: samples.length, min, max, extremeBelow, extremeAbove,
    current: reading, currentExtreme, currentSize }
}
export type MagnitudeDistribution = NonNullable<ReturnType<typeof magnitudeDistribution>>

export function magnitudeBandLabel(index: number) {
  return (['Unchanged', 'Small', 'Medium', 'Large'] as const)[Math.abs(index - 3)]
}

function binIndex(limits: readonly number[], value: number) {
  if (value === 0) return 3
  const magnitude = Math.abs(value)
  if (!atOrBelow(magnitude, limits[2])) return null
  const level = atOrBelow(magnitude, limits[0]) ? 0 : atOrBelow(magnitude, limits[1]) ? 1 : 2
  return value < 0 ? 2 - level : 4 + level
}
function atOrBelow(value: number, boundary: number) {
  // Admit decimal equality despite a few floating-point rounding steps in
  // P95/thirds. Relative tolerance preserves real source changes and T=0.
  return value <= boundary || value - boundary <= 4 * Number.EPSILON * Math.max(value, boundary)
}
export function magnitudeBin(d: MagnitudeDistribution, index: number) {
  const edges = [-d.threshold, -d.limits[1], -d.limits[0], 0, 0, ...d.limits]
  return { index, count: d.bins[index], from: edges[index], to: edges[index + 1] }
}
export function selectedMagnitudeBin(d: MagnitudeDistribution) {
  if (d.current === null) return null
  const index = binIndex(d.limits, d.current)
  return index === null ? null : magnitudeBin(d, index)
}
