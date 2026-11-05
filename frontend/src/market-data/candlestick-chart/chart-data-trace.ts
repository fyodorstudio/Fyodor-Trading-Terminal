import type { IChartApi, ISeriesApi, Logical, Time } from 'lightweight-charts'
import type { OhlcBar } from '../contracts/OhlcBar'

/** A few public-API samples after a scope change, never a full-history scan. */
export function chartDataTrace(chart: IChartApi, series: ISeriesApi<'Candlestick', Time>, bars: OhlcBar[], scope: string) {
  const scale = chart.timeScale()
  const indices = [...new Set([0, Math.floor(bars.length / 2), Math.max(0, bars.length - 2), bars.length - 1])]
  return JSON.stringify({ scope, count: bars.length, pixelRatio: window.devicePixelRatio, spacing: scale.options?.().barSpacing,
    viewport: scale.getVisibleLogicalRange(), priceRange: chart.priceScale('right').getVisibleRange(),
    samples: indices.map(index => {
      const bar = bars[index], logical = scale.timeToIndex?.(bar.time) ?? null
      const native = logical === null ? null : series.dataByIndex?.(Number(logical) as Logical)
      return { index, logical, time: bar.time, ohlc: [bar.open, bar.high, bar.low, bar.close],
        native: native && 'open' in native && 'high' in native && 'low' in native && 'close' in native ? [native.open, native.high, native.low, native.close] : null,
        y: [bar.open, bar.high, bar.low, bar.close].map(price => series.priceToCoordinate(price)) }
    }),
    panes: chart.panes?.().map(pane => pane.getSeries?.().map(item => ({ type: item.seriesType?.(), scale: item.options?.().priceScaleId }))),
  })
}
