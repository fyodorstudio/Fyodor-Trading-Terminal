// Seven signed A−P bands: three negative, exact zero, three positive.
export const magnitudeDistributionVersion = 'zero-centered-ap-all-dataset-v6'
export type MagnitudeLimits = readonly [number, number, number]
export function validMagnitudeLimits(value: unknown): value is MagnitudeLimits {
  return Array.isArray(value) && value.length === 3 && value.every((limit) => typeof limit === 'number' && Number.isFinite(limit)) &&
    value[0] > 0 && value[0] < value[1] && value[1] < value[2]
}
export function magnitudeDistribution(values: readonly number[], current: number | null, customLimits?: MagnitudeLimits) {
  if (customLimits && !validMagnitudeLimits(customLimits)) throw new RangeError('Magnitude boundaries must satisfy 0 < Small < Medium < Large')
  const samples = values.filter(Number.isFinite)
  if (!samples.length && !customLimits) return null
  let historicalThreshold = 0
  if (!customLimits) {
    const magnitudes = samples.map(Math.abs).sort((a, b) => a - b)
    // Type-7 P95 only for series without configured boundaries.
    const positionNumerator = (magnitudes.length - 1) * 19, lower = Math.floor(positionNumerator / 20)
    historicalThreshold = magnitudes[lower] +
      (magnitudes[Math.min(lower + 1, magnitudes.length - 1)] - magnitudes[lower]) * (positionNumerator % 20) / 20
  }
  const limits = customLimits ? [...customLimits] : [historicalThreshold / 3, historicalThreshold * 2 / 3, historicalThreshold]
  const threshold = limits[2]
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
  const currentSize = magnitudeSizeForValue(limits, reading)
  return { bins, limits, threshold, source: customLimits ? 'custom' as const : 'p95' as const,
    count: samples.length, min: samples.length ? min : null, max: samples.length ? max : null, extremeBelow, extremeAbove,
    current: reading, currentExtreme, currentSize }
}
export type MagnitudeDistribution = NonNullable<ReturnType<typeof magnitudeDistribution>>

export function magnitudeBandLabel(index: number) {
  return (['Unchanged', 'Small', 'Medium', 'Large'] as const)[Math.abs(index - 3)]
}
export function magnitudeSizeForValue(limits: readonly number[], value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'Unavailable'
  const index = binIndex(limits, value)
  return index === null ? 'Extreme' : magnitudeBandLabel(index)
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
