import { memo, useEffect } from 'react'
import type { IChartApi, MouseEventParams, Time } from 'lightweight-charts'
import type { OhlcBar } from '../market-data/contracts/OhlcBar'
import { chartClockToUtc } from '../appearance/time-display/chart-clock'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { ledgerDay } from './ledger-model'
import { useLedger } from './useLedger'

export const LedgerCandlePicker = memo(function LedgerCandlePicker({ chartApi, bars }: { chartApi: IChartApi; bars: OhlcBar[] }) {
  const { picking, cancelPicking, pickDay } = useLedger(), { scope } = useDisplayClock()
  useEffect(() => {
    if (!picking) return
    const element = chartApi.chartElement()
    element.dataset.ledgerPicking = 'true'
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelPicking() }
    }
    const pick = (event: MouseEventParams<Time>) => {
      const point = event.point, time = event.time
      if (!point || typeof time !== 'number' || event.paneIndex != null && event.paneIndex !== 0
        || point.x < 0 || point.x >= chartApi.timeScale().width() || point.y < 0 || point.y >= chartApi.paneSize(0).height) return
      let lo = 0, hi = bars.length - 1
      while (lo <= hi) {
        const mid = (lo + hi) >>> 1, value = Number(bars[mid].time)
        if (value < time) lo = mid + 1
        else if (value > time) hi = mid - 1
        else {
          const utc = chartClockToUtc(time * 1000, scope)
          if (utc !== null) pickDay(ledgerDay(utc))
          return
        }
      }
    }
    // Listen to native clicks without covering the canvas: native hover,
    // crosshair lines and axis labels continue to receive pointer movement.
    chartApi.subscribeClick(pick)
    window.addEventListener('keydown', cancel, true)
    return () => {
      delete element.dataset.ledgerPicking
      chartApi.unsubscribeClick(pick)
      window.removeEventListener('keydown', cancel, true)
    }
  }, [picking, cancelPicking, chartApi, bars, scope, pickDay])
  return null
})
