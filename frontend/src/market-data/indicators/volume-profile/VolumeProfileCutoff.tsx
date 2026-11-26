import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import { drawingTimeToLogical } from '../../chart-drawings/drawing-coordinates'
import { useDrawingViewport } from '../../chart-drawings/useDrawingViewport'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { profileTimeCoordinate } from './volume-profile-overlay'

export function VolumeProfileCutoff({ chart, series, bars, step, cutoff, placing, interactive, onSelect, onCancel }: {
  chart: IChartApi; series: ISeriesApi<'Candlestick', Time>; bars: readonly OhlcBar[]; step: number
  cutoff: number | null; placing: boolean; interactive: boolean
  onSelect: (time: number) => void; onCancel: () => void
}) {
  const svg = useRef<SVGSVGElement>(null)
  const pointer = useRef<number | null>(null)
  const [draft, setDraft] = useState<number | null>(null)
  const { width, height } = useDrawingViewport(chart, series, svg)
  const time = draft ?? cutoff
  const x = time === null ? null : profileTimeCoordinate(chart, bars, step, time)
  const lineOnScreen = x !== null && x >= 0 && x <= width
  useEffect(() => { if (placing) svg.current?.focus() }, [placing])

  function timeAt(event: PointerEvent<SVGSVGElement>) {
    const x = Math.max(0, Math.min(width, event.clientX - event.currentTarget.getBoundingClientRect().left))
    const index = chart.timeScale().coordinateToLogical(x)
    return index === null ? undefined : bars[Math.max(0, Math.min(bars.length - 1, Math.round(index)))]?.time
  }
  function cancel() { pointer.current = null; setDraft(null) }

  return <svg ref={svg} className={`volume-profile-cutoff${placing ? ' volume-profile-picker' : ''}`}
    aria-label={placing ? 'Place volume profile line' : 'Volume profile vertical line'} tabIndex={placing ? 0 : undefined}
    style={{ width, height }}
    onKeyDown={event => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        cancel()
        if (placing) onCancel()
      } else if (interactive && time !== null && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        const index = drawingTimeToLogical(time, bars, step)
        const nearest = index === null ? undefined : bars[Math.round(index) + (event.key === 'ArrowLeft' ? -1 : 1)]
        if (nearest) {
          event.preventDefault()
          event.stopPropagation()
          onSelect(nearest.time)
        }
      }
    }}
    onPointerDown={event => {
      if (!interactive || event.button !== 0 || pointer.current !== null) return
      const next = timeAt(event)
      if (next === undefined) return
      pointer.current = event.pointerId
      event.currentTarget.setPointerCapture(event.pointerId)
      setDraft(next)
    }}
    onPointerMove={event => { if (pointer.current === event.pointerId) setDraft(timeAt(event) ?? null) }}
    onPointerUp={event => {
      if (pointer.current !== event.pointerId) return
      const next = timeAt(event)
      cancel()
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      if (next !== undefined) onSelect(next)
    }}
    onLostPointerCapture={cancel} onPointerCancel={cancel}>
    {lineOnScreen && <line className="volume-profile-cutoff-stroke" x1={x} x2={x} y1={0} y2={height} />}
    {lineOnScreen && interactive && !placing && <rect className="volume-profile-cutoff-handle"
      aria-label="Move volume profile line" tabIndex={0} x={x - 7} y={0} width={14} height={height} />}
  </svg>
}
