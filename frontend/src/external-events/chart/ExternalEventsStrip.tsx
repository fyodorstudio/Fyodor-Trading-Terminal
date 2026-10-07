import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { IChartApi } from 'lightweight-charts'
import type { OhlcBar } from '../../market-data/contracts/OhlcBar'
import type { ChartTimeframe } from '../../market-data/contracts/ChartTimeframe'
import { timeframeSeconds } from '../../inspector/inspector-data'
import { externalIntervals, visibleExternalIntervals, type ExternalInterval } from '../core/external-event'
import { useExternalEvents } from '../storage/external-event-store'
import { ExternalEventManager } from '../ui/ExternalEventManager'
import { ribbonCoordinate } from '../../raycaster/ribbon/ribbon-geometry'
import { brokerClock } from '../../raycaster/ribbon/broker-clock'
import '../ui/external-events.css'

function ExternalEventsStripComponent({ chartApi, bars, timeframe, now, symbol, brokerId }: {
  chartApi: IChartApi; bars: readonly Pick<OhlcBar, 'time'>[]; timeframe: ChartTimeframe; now: number; symbol: string; brokerId: string | null
}) {
  const all = useExternalEvents()
  const events = useMemo(() => all.filter(e => e.symbol === symbol && e.brokerId === brokerId), [all, symbol, brokerId])
  const intervals = useMemo(() => externalIntervals(events), [events])
  const [positions, setPositions] = useState<(ExternalInterval & { left: number; width: number })[]>([])
  const [manager, setManager] = useState<{ id: string | null; from: number; to: number } | null>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => { setManager(null); addButton.current?.focus({ preventScroll: true }) }, [])
  useEffect(() => {
    if (!intervals.length) return
    const scale = chartApi.timeScale(), duration = timeframeSeconds[timeframe]
    let frame = 0
    const update = () => {
      frame = 0
      const range = scale.getVisibleRange()
      if (!range || !bars.length) { setPositions([]); return }
      const from = Math.max(Number(range.from) * 1000, Number(bars[0].time) * 1000)
      const to = Math.min(now, (Number(range.to) + duration) * 1000, (Number(bars.at(-1)!.time) + duration) * 1000)
      setPositions(visibleExternalIntervals(intervals, from, to).flatMap(e => {
        const a = ribbonCoordinate(scale, bars, e.from, duration), b = ribbonCoordinate(scale, bars, e.to, duration)
        if (a === null || b === null) return []
        const left = Math.max(0, a), width = Math.min(scale.width(), b) - left
        return width > 0 ? [{ ...e, left, width }] : []
      }))
    }
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    update(); scale.subscribeVisibleLogicalRangeChange(schedule); scale.subscribeSizeChange(schedule)
    return () => { if (frame) window.cancelAnimationFrame(frame); scale.unsubscribeVisibleLogicalRangeChange(schedule); scale.unsubscribeSizeChange(schedule) }
  }, [chartApi, bars, timeframe, now, intervals])
  const open = (id: string | null) => {
    const range = chartApi.timeScale().getVisibleRange(), duration = timeframeSeconds[timeframe] * 1000
    const from = range ? Math.min(now - 60000, Number(range.from) * 1000) : now - duration
    const to = Math.max(from + 60000, Math.min(now, range ? (Number(range.to) * 1000 + duration) : now))
    setManager({ id, from, to })
  }
  return <div className="external-events" aria-label="Manually highlighted outside events">
    <button ref={addButton} className="external-events-add" type="button" disabled={!brokerId || !symbol} onClick={() => open(null)}
      title="Record an outside event in broker chart time; no scoring contribution">Outside events +</button>
    <div className="external-events-track">{(intervals.length ? positions : []).map(p => <button type="button" key={p.from} className="external-event-highlight"
      style={{ left: p.left, width: p.width }} onClick={() => open(p.events[0].id)}
      aria-label={`Manual outside event: ${p.events.map(e => e.title).join(' + ')}`}
      title={`${p.events.map(e => e.title + (e.note ? ': ' + e.note : '')).join('\n')}\n${brokerClock(p.from)} → ${brokerClock(p.to)}\nManual annotation · outside dataset · no directional vote`} />)}</div>
    {manager && brokerId && <ExternalEventManager key={manager.id ?? 'new'} events={events} initialId={manager.id} defaults={manager}
      symbol={symbol} brokerId={brokerId} onClose={close} />}
  </div>
}
export const ExternalEventsStrip = memo(ExternalEventsStripComponent)
