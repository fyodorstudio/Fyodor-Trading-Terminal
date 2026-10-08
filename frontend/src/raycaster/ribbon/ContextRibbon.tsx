import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { IChartApi } from 'lightweight-charts'
import type { OhlcBar } from '../../market-data/contracts/OhlcBar'
import type { ChartTimeframe } from '../../market-data/contracts/ChartTimeframe'
import { timeframeSeconds } from '../../inspector/inspector-data'
import { visibleRibbonIntervals, type RibbonPoint } from './ribbon-timeline'
import { ribbonCoordinate, ribbonClockAtCoordinate } from './ribbon-geometry'
import { RibbonExplanation } from './RibbonExplanation'
import { useDisplayClock } from '../../appearance/time-display/useDisplayClock'
import './context-ribbon.css'
import { ExternalEventsStrip } from '../../external-events/chart/ExternalEventsStrip'
import { usdPresentationVersion } from '../core/usd-context-presentation'

type Segment = { left: number; width: number; from: number; to: number; point: RibbonPoint | null }
function ContextRibbonComponent({ chartApi, bars, timeframe, points, now, relative, version, loading, notice, partial = false, symbol = '', brokerId = null, relationshipTitle, startAt }: {
  chartApi: IChartApi; bars: readonly Pick<OhlcBar, 'time'>[]; timeframe: ChartTimeframe; points: readonly RibbonPoint[];
  now: number; relative: boolean; version: string; loading: boolean; notice: string | null; partial?: boolean; symbol?: string; brokerId?: string | null
  relationshipTitle?: string; startAt?: number
}) {
  const [segments, setSegments] = useState<Segment[]>([])
  const clock = useDisplayClock(), displayClock = clock.chart
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
      const from = Math.max(Number(range.from) * 1000, Number(bars[0].time) * 1000, startAt ?? -Infinity)
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
  }, [chartApi, bars, timeframe, points, now, loading, notice, startAt])
  return <div className={`context-ribbon${relationshipTitle ? ' roof-ribbon' : ''}`} aria-label={relationshipTitle ? `Roof Candy · ${relationshipTitle} · USD inputs` : `Raycaster Candy · ${mode}`}>
    {!relationshipTitle && <ExternalEventsStrip key={`${brokerId}:${symbol}`} chartApi={chartApi} bars={bars} timeframe={timeframe} now={now} symbol={symbol} brokerId={brokerId} />}
    <div className="context-ribbon-legend" title={`${relative ? 'Green: Long. Red: Short. Amber: mixed.' : 'Green/red: support on one side. Amber: support on both sides or no lead. The green/red bottom edge shows which side has more support.'} Gray: not enough usable data. Darker color means stronger evidence.${relationshipTitle ? ' This follows the selected relationship through earlier and later releases, using evidence known at each time; the roof label keeps its original reading.' : ' This combines all enabled news.'}`}>
      <strong>{relationshipTitle ? `Relationship history · ${relationshipTitle}` : `All news · ${relative ? mode : 'USD inputs'}`}</strong>
      {startAt !== undefined && <> · starts {displayClock(startAt)}</>} · {clock.zone}{partial && ' · some history missing'}
      {loading ? ' · Loading' : notice ? ` · ${notice}` : ''}
    </div>
    <div className="context-ribbon-track" onPointerLeave={clearHover}>
      {segments.map(segment => <button type="button" key={segment.from}
        className={`ribbon-segment ${segment.point?.direction ?? 'uncomputed'} ${segment.point?.evidence ?? ''}${!relative && (segment.point?.presentation?.state === 'conflicted' || segment.point?.relationship?.support.state === 'conflicted' || segment.point?.relationship?.actionConflict) ? ` lead-${segment.point?.presentation?.direction ?? segment.point?.relationship?.support.direction}` : ''}`}
        style={{ left: segment.left, width: segment.width }}
        aria-label={`${segment.point?.label ?? 'Unavailable'} · ${segment.point?.evidence ?? 'No'} evidence · ${displayClock(segment.from)}`}
        title={`${segment.point?.label ?? 'Unavailable'} · ${segment.point?.evidence ?? 'No'} evidence\n${displayClock(segment.from)} to ${displayClock(segment.to)}\n${segment.point?.explanation ?? notice ?? 'No usable context yet'}\n${segment.point?.update ?? ''}`}
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
      {!segments.length && <span className="ribbon-empty" role="status">{loading ? 'Preparing this timeline…' : notice ?? (!bars.length ? 'No chart candles loaded yet.' : startAt !== undefined ? `This combo starts ${displayClock(startAt)}. Move the chart to that date or later.` : 'No candles available in this view.')}</span>}
    </div>
    {hover && <div className="ribbon-hover" role="status"><strong>{hover.segment.point?.label ?? 'Unavailable'} · {hover.segment.point?.evidence ?? 'No'} evidence</strong>
      <span>{displayClock(hover.at)}</span><span>{hover.segment.point?.kind === 'publication' ? 'New publication' : hover.segment.point?.kind === 'expiry' ? 'Expiry update' : 'Aging update'}: {hover.segment.point?.update ?? notice ?? 'No usable context'}</span></div>}
    {selected && <RibbonExplanation point={selected} mode={mode} version={relative ? version : `${version} / ${usdPresentationVersion}`} partial={partial} onClose={close} symbol={symbol} brokerId={brokerId} />}
  </div>
}
export const ContextRibbon = memo(ContextRibbonComponent)
