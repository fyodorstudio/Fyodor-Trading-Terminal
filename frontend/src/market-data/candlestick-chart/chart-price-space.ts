import type { AutoscaleInfo, IChartApi, ISeriesApi, ISeriesPrimitive, Time } from 'lightweight-charts'
import type { OhlcBar } from '../contracts/OhlcBar'

/** The unpainted horizon also keeps a price-scale reference in future space.
 * Its inert value never participates in autoscaling or candle/quote data. */
export function createChartPriceSpace(chart: IChartApi, price: ISeriesApi<'Candlestick', Time>, horizon: ISeriesApi<'Line', Time>) {
  let fallback: AutoscaleInfo | null = null, count = 0, lastPrecision = -1
  horizon.applyOptions({ autoscaleInfoProvider: () => {
    const range = chart.timeScale().getVisibleLogicalRange()
    return count && range && (range.from > count - 1 || range.to < 0) ? fallback : null
  } })
  const views = [{ renderer: () => ({ draw() {
    if (!count) return
    const range = chart.priceScale('right').getVisibleRange()
    if (range && Number.isFinite(range.from) && Number.isFinite(range.to) && range.to > range.from)
      fallback = { priceRange: { minValue: range.from, maxValue: range.to } }
  } }) }]
  const primitive: ISeriesPrimitive<Time> = { paneViews: () => views }
  horizon.attachPrimitive(primitive)

  // Native candle coordinates return null when no later candle exists. Keep
  // the original candle data/marker lifecycle, using the same-scale horizon
  // only for price projection and custom price lines in that empty space.
  const methods = new Map<PropertyKey, unknown>([
    ['priceToCoordinate', (value: number) => price.priceToCoordinate(value) ?? horizon.priceToCoordinate(value)],
    ['coordinateToPrice', (value: number) => price.coordinateToPrice(value) ?? horizon.coordinateToPrice(value)],
    ['createPriceLine', horizon.createPriceLine.bind(horizon)],
    ['removePriceLine', horizon.removePriceLine.bind(horizon)],
  ])
  const overlaySeries = new Proxy(price, { get(target, key) {
    if (methods.has(key)) return methods.get(key)
    const value = Reflect.get(target, key)
    if (typeof value !== 'function') return value
    const bound = value.bind(target); methods.set(key, bound); return bound
  } })
  return {
    overlaySeries,
    sync(bars: OhlcBar[], reset: boolean, precision: number) {
      if (lastPrecision !== precision) {
        lastPrecision = precision
        horizon.applyOptions({ priceFormat: { type: 'price', precision, minMove: 10 ** -precision } })
      }
      count = bars.length
      if (!count) { fallback = null; return }
      if (!reset && fallback) return
      // A symbol opened directly in future space has no prior rendered range.
      // Seed from a bounded recent window in that symbol's own price units.
      let minValue = Infinity, maxValue = -Infinity
      for (let i = Math.max(0, count - 100); i < count; i++) {
        minValue = Math.min(minValue, bars[i].low); maxValue = Math.max(maxValue, bars[i].high)
      }
      fallback = { priceRange: { minValue, maxValue } }
    },
    destroy() { horizon.detachPrimitive(primitive) },
  }
}
