export type ScrollbarStyle = 'adaptive' | 'charcoal' | 'blue' | 'red'

export type ChartAppearance = {
  upCandleColor: string
  downCandleColor: string
  priceLineColor: string
  showGrid: boolean
  barSpacing: number
  scrollbarStyle: ScrollbarStyle
}

export const defaultChartAppearance: ChartAppearance = {
  upCandleColor: '#18a77d',
  downCandleColor: '#e45462',
  priceLineColor: '#6478ef',
  showGrid: true,
  barSpacing: 7,
  scrollbarStyle: 'adaptive',
}

const storageKey = 'fyodor.chart-appearance.v1'
const colorPattern = /^#[0-9a-f]{6}$/i

export function readChartAppearance(): ChartAppearance {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as Partial<ChartAppearance>
    const validScrollbarStyle: ScrollbarStyle =
      parsed.scrollbarStyle === 'charcoal' || parsed.scrollbarStyle === 'blue' || parsed.scrollbarStyle === 'red'
        ? parsed.scrollbarStyle
        : 'adaptive'
    return {
      upCandleColor: colorPattern.test(parsed.upCandleColor ?? '') ? parsed.upCandleColor! : defaultChartAppearance.upCandleColor,
      downCandleColor: colorPattern.test(parsed.downCandleColor ?? '') ? parsed.downCandleColor! : defaultChartAppearance.downCandleColor,
      priceLineColor: colorPattern.test(parsed.priceLineColor ?? '') ? parsed.priceLineColor! : defaultChartAppearance.priceLineColor,
      showGrid: typeof parsed.showGrid === 'boolean' ? parsed.showGrid : defaultChartAppearance.showGrid,
      barSpacing: typeof parsed.barSpacing === 'number' && parsed.barSpacing >= 3 && parsed.barSpacing <= 16
        ? parsed.barSpacing
        : defaultChartAppearance.barSpacing,
      scrollbarStyle: validScrollbarStyle,
    }
  } catch {
    return defaultChartAppearance
  }
}

export function saveChartAppearance(appearance: ChartAppearance) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(appearance))
  } catch {
    // The live setting still applies when storage is unavailable.
  }
}
