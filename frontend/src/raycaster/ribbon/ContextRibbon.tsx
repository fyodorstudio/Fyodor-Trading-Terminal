import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { IChartApi } from 'lightweight-charts'
import type { OhlcBar } from '../../market-data/contracts/OhlcBar'
import type { ChartTimeframe } from '../../market-data/contracts/ChartTimeframe'
import { timeframeSeconds } from '../../inspector/inspector-data'
import { visibleRibbonIntervals, type RibbonPoint } from './ribbon-timeline'
import { ribbonCoordinate, ribbonClockAtCoordinate } from './ribbon-geometry'
import { RibbonExplanation } from './RibbonExplanation'
import { brokerClock } from './broker-clock'
import './context-ribbon.css'
import { ExternalEventsStrip } from '../../external-events/chart/ExternalEventsStrip'
import { usdPresentationVersion } from '../core/usd-context-presentation'

type Segment = { left: number; width: number; from: number; to: number; point: RibbonPoint | null }
function ContextRibbonComponent({ chartApi, bars, timeframe, points, now, relative, version, loading, notice, partial = false, symbol = '', brokerId = null }: {
  chartApi: IChartApi; bars: readonly Pick<OhlcBar, 'time'>[]; timeframe: ChartTimeframe; points: readonly RibbonPoint[];
  now: number; relative: boolean; version: string; loading: boolean; notice: string | null; partial?: boolean; symbol?: string; brokerId?: string | null
}) {
  const [segments, setSegments] = useState<Segment[]>([])
  const [hoverState, setHover] = useState<{ segment: Segment; at: number } | null>(null)
  const [selection, setSelected] = useState<{ point: RibbonPoint; timeline: readonly RibbonPoint[] } | null>(null)
  const hover = hoverState && segments.includes(hoverState.segment) ? hoverState : null
  const selected = selection?.timeline === points ? selection.point : null
  const close = useCallback(() => setSelected(null), [])
  const hoverFrame = useRef(0)
  const pendingHover = useRef<{ segment: Segment; x: number } | null>(null)
  const clearHover = () => {
    if (hoverFrame.current) window.cancelAnimationFrame(hoverFrame.current)
    hoverFrame.current = 0; pendingHover.current = null; setHover(null)
  }
  useEffect(() => () => { if (hoverFrame.current) window.cancelAnimationFrame(hoverFrame.current) }, [])
  const mode = relative ? 'EUR vs USD' : 'USD side'
  useEffect(() => {
    const scale = chartApi.timeScale(), duration = timeframeSeconds[timeframe]
    let frame = 0
    const update = () => {
      frame = 0
      const range = scale.getVisibleRange(), width = scale.width()
      if (!range || !bars.length) { setSegments([]); return }
      const from = Math.max(Number(range.from) * 1000, Number(bars[0].time) * 1000)
      const to = Math.min((Number(range.to) + duration) * 1000, now, (Number(bars.at(-1)!.time) + duration) * 1000)
      const visible = visibleRibbonIntervals(loading || notice ? [] : points, from, to)
      setSegments(visible.flatMap(interval => {
        const a = ribbonCoordinate(scale, bars, interval.from, duration), b = ribbonCoordinate(scale, bars, interval.to, duration)
        if (a === null || b === null) return []
        const left = Math.max(0, a), right = Math.min(width, b)
        return right > left ? [{ ...interval, left, width: right - left }] : []
      }))
    }
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    update(); scale.subscribeVisibleLogicalRangeChange(schedule); scale.subscribeSizeChange(schedule)
    return () => { if (frame) window.cancelAnimationFrame(frame); scale.unsubscribeVisibleLogicalRangeChange(schedule); scale.unsubscribeSizeChange(schedule) }
  }, [chartApi, bars, timeframe, points, now, loading, notice])
  return <div className="context-ribbon" aria-label={`Raycaster Candy · ${mode}`}>
    <ExternalEventsStrip key={`${brokerId}:${symbol}`} chartApi={chartApi} bars={bars} timeframe={timeframe} now={now} symbol={symbol} brokerId={brokerId} />
    <div className="context-ribbon-legend">Context · {mode} · {relative ? 'Green Long / Red Short / Amber Mixed / Gray Insufficient' : 'Green Long / Red Short / Amber Conflict or No lead · edge = lead / Gray Insufficient'} · {loading ? 'Loading' : notice ?? `shade = evidence${partial ? ' · Partial history' : ''}`}</div>
    <div className="context-ribbon-track" onPointerLeave={clearHover}>
      {segments.map(segment => <button type="button" key={segment.from}
        className={`ribbon-segment ${segment.point?.direction ?? 'uncomputed'} ${segment.point?.evidence ?? ''}${!relative && segment.point?.presentation?.state === 'conflicted' ? ` lead-${segment.point.presentation.direction}` : ''}`}
        style={{ left: segment.left, width: segment.width }}
        aria-label={`${segment.point?.label ?? 'Unavailable'} · ${segment.point?.evidence ?? 'No'} evidence · ${brokerClock(segment.from)}`}
        title={`${segment.point?.label ?? 'Unavailable'} · ${segment.point?.evidence ?? 'No'} evidence\n${brokerClock(segment.from)} to ${brokerClock(segment.to)}\n${segment.point?.update ?? notice ?? 'No usable context yet'}`}
        onPointerMove={e => {
          pendingHover.current = { segment, x: segment.left + e.clientX - e.currentTarget.getBoundingClientRect().left }
          if (!hoverFrame.current) hoverFrame.current = window.requestAnimationFrame(() => {
            hoverFrame.current = 0
            const pending = pendingHover.current
            if (!pending) return
            const at = ribbonClockAtCoordinate(chartApi.timeScale(), bars, pending.x, timeframeSeconds[timeframe])
            setHover({ segment: pending.segment, at: Math.max(pending.segment.from, Math.min(pending.segment.to - 1, at ?? pending.segment.from)) })
          })
        }}
        onFocus={() => { clearHover(); setHover({ segment, at: segment.from }) }} onBlur={clearHover}
        onClick={() => { if (segment.point) setSelected({ point: segment.point, timeline: points }) }} />)}
    </div>
    {hover && <div className="ribbon-hover" role="status"><strong>{hover.segment.point?.label ?? 'Unavailable'} · {hover.segment.point?.evidence ?? 'No'} evidence</strong>
      <span>{brokerClock(hover.at)}</span><span>{hover.segment.point?.kind === 'publication' ? 'Publication' : hover.segment.point?.kind === 'expiry' ? 'Expiry' : 'Memory aging'}: {hover.segment.point?.update ?? notice ?? 'No usable context'}</span></div>}
    {selected && <RibbonExplanation point={selected} mode={mode} version={relative ? version : `${version} / ${usdPresentationVersion}`} partial={partial} onClose={close} />}
  </div>
}
export const ContextRibbon = memo(ContextRibbonComponent)
