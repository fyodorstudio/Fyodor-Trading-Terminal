// Descriptive display statistics. Input and output retain the series' native units.
export const magnitudeDistributionVersion = 'absolute-ap-histogram-v1'
export function magnitudeDistribution(values: readonly number[], current: number | null, binCount = 16) {
  const sorted = values.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b)
  if (!sorted.length) return null
  function quantile(p: number) {
    const position = (sorted.length - 1) * p
    const lower = Math.floor(position), fraction = position - lower
    return sorted[lower] + (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * fraction
  }
  const p50 = quantile(.5), p75 = quantile(.75), p90 = quantile(.9), p95 = quantile(.95)
  // P95 can be zero in a heavily zero-inflated history. Use the historical
  // maximum then; an entirely zero baseline gets a 1-native-unit display axis.
  const scaleMax = p95 || sorted[sorted.length - 1] || 1
  const count = Math.max(1, Math.min(64, Math.floor(binCount) || 16))
  const bins = Array<number>(count).fill(0)
  let overflow = 0
  for (const value of sorted) {
    if (value > scaleMax) overflow++
    else bins[Math.min(count - 1, Math.floor(value / scaleMax * count))]++
  }
  const magnitude = current !== null && Number.isFinite(current) ? Math.abs(current) : null
  return { bins, overflow, scaleMax, p50, p75, p90, p95, count: sorted.length,
    allZero: sorted[sorted.length - 1] === 0, magnitude,
    percentile: magnitude === null ? null : 100 * sorted.filter((value) => value <= magnitude).length / sorted.length,
    currentOverflow: magnitude !== null && magnitude > scaleMax }
}
export type MagnitudeDistribution = NonNullable<ReturnType<typeof magnitudeDistribution>>

// Match the histogram's bin edges exactly, including the rightmost endpoint.
export function selectedMagnitudeBin(d: MagnitudeDistribution) {
  if (d.magnitude === null) return null
  if (d.currentOverflow) return { index: 'tail' as const, count: d.overflow, from: d.scaleMax, to: null }
  const index = Math.min(d.bins.length - 1, Math.floor(d.magnitude / d.scaleMax * d.bins.length))
  return { index, count: d.bins[index], from: index / d.bins.length * d.scaleMax,
    to: (index + 1) / d.bins.length * d.scaleMax }
}
