import { ColorType, CrosshairMode, type ChartOptions, type DeepPartial, type TickMarkType, type Time } from 'lightweight-charts'
import { defaultChartClock, type ChartClockScope } from '../../appearance/time-display/chart-clock'
import {
  formatChartCrosshairTime,
  formatChartTick,
  type TimeDisplayPreference,
} from '../../appearance/time-display/time-display-preference'
import type { ChartAppearance } from '../chart-settings/chart-appearance-preference'

function cssColor(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function lightweightChartOptions(
  appearance: ChartAppearance,
  timeDisplay: TimeDisplayPreference,
  isInitial = false,
  clock: ChartClockScope = defaultChartClock,
): DeepPartial<ChartOptions> {
  const gridColor = appearance.showGrid ? cssColor('--chart-grid') : 'rgba(0, 0, 0, 0)'
  return {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: cssColor('--chart-background') },
      textColor: cssColor('--text-muted'),
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      fontSize: 12,
      attributionLogo: true,
    },
    grid: {
      vertLines: { color: gridColor },
      horzLines: { color: gridColor },
    },
    localization: {
      timeFormatter: (time: Time) => formatChartCrosshairTime(time, timeDisplay, clock),
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: cssColor('--chart-crosshair'),
        labelBackgroundColor: cssColor('--chart-label'),
      },
      horzLine: {
        color: cssColor('--chart-crosshair'),
        labelBackgroundColor: cssColor('--chart-label'),
      },
    },
    rightPriceScale: {
      borderColor: cssColor('--chart-axis'),
      scaleMargins: { top: 0.12, bottom: 0.1 },
    },
    timeScale: {
      borderColor: cssColor('--chart-axis'),
      timeVisible: true,
      secondsVisible: false,
      ...(isInitial ? { rightOffset: 8, barSpacing: appearance.barSpacing } : {}),
      tickMarkFormatter: (time: Time, tickType: TickMarkType) => formatChartTick(time, tickType, timeDisplay, clock),
    },
    handleScale: {
      axisPressedMouseMove: {
        time: true,
        price: true,
      },
      axisDoubleClickReset: {
        time: true,
        price: true,
      },
      mouseWheel: true,
      pinch: true,
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: true,
    },
  }
}
