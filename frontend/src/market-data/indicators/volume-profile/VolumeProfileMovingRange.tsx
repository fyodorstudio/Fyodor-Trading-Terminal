import { useRef, useState, type PointerEvent } from 'react'
import type { IChartApi, ISeriesApi, Logical, LogicalRange, Time } from 'lightweight-charts'
import { drawingLogicalToTime } from '../../chart-drawings/drawing-coordinates'
import { useDrawingViewport } from '../../chart-drawings/useDrawingViewport'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { movingProfileWindow } from './volume-profile'
import { profileTimeCoordinate } from './volume-profile-overlay'
import type { VolumeProfilePreferences } from './volume-profile-preferences'

type WindowSettings = Pick<VolumeProfilePreferences, 'lookbackMinutes' | 'anchorRatio'>
type Edge = 'lookbackMinutes' | 'anchorRatio'

export function VolumeProfileMovingRange({ chart, series, bars, step, visible, settings, interactive, onChange }: {
  chart: IChartApi; series: ISeriesApi<'Candlestick', Time>; bars: readonly OhlcBar[]; step: number
  visible: LogicalRange; settings: WindowSettings; interactive: boolean
  onChange: (changes: Partial<WindowSettings>) => void
}) {
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{ id: number; edge: Edge } | null>(null)
  const [draft, setDraft] = useState<Partial<WindowSettings> | null>(null)
  const { width, height } = useDrawingViewport(chart, series, svg)
  const { lookbackMinutes, anchorRatio } = { ...settings, ...draft }
  const range = movingProfileWindow(bars, visible.from, visible.to, step, lookbackMinutes, anchorRatio)
  const left = range && profileTimeCoordinate(chart, bars, step, range.from, -0.5)
  const right = range && profileTimeCoordinate(chart, bars, step, range.to, -0.5)
  const span = visible.to - visible.from

  function change(event: PointerEvent<SVGSVGElement>, edge: Edge): Partial<WindowSettings> | null {
    const scale = chart.timeScale()
    const x = event.clientX - event.currentTarget.getBoundingClientRect().left
    const zero = scale.logicalToCoordinate(0 as Logical)
    const one = scale.logicalToCoordinate(1 as Logical)
    if (zero === null || one === null || zero === one || !range || span <= 0) return null
    const logical = (x - zero) / (one - zero)
    if (edge === 'anchorRatio') return { anchorRatio: Math.min(1, Math.max(0, (logical - visible.from + 0.5) / span)) }
    const time = drawingLogicalToTime(logical + 0.5, bars, step)
    return time === null ? null : { lookbackMinutes: Math.max(1, Math.round((range.to - time) / 60)) }
  }
  function clear() { drag.current = null; setDraft(null) }

  return <svg ref={svg} className="volume-profile-cutoff volume-profile-moving" aria-label="Moving Volume Profile window"
    style={{ width, height }}
    onPointerDown={event => {
      const edge = (event.target as SVGElement).getAttribute('data-edge')
      if (!interactive || (edge !== 'lookbackMinutes' && edge !== 'anchorRatio') || event.button !== 0 || drag.current) return
      event.stopPropagation()
      drag.current = { id: event.pointerId, edge }
      event.currentTarget.setPointerCapture(event.pointerId)
    }}
    onPointerMove={event => {
      if (drag.current?.id === event.pointerId) setDraft(change(event, drag.current.edge))
    }}
    onPointerUp={event => {
      const pointer = drag.current
      if (!pointer || pointer.id !== event.pointerId) return
      const next = draft ? change(event, pointer.edge) : null
      clear()
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      if (next) onChange(next)
    }}
    onPointerCancel={clear} onLostPointerCapture={clear}>
    {left !== null && right !== null && right > left && <rect className="volume-profile-moving-box"
      x={left} y={0} width={right - left} height={height} />}
    {interactive && ([['lookbackMinutes', left, 'Resize Volume Profile window'],
      ['anchorRatio', right, 'Set Volume Profile window position']] as const).map(([edge, x, name]) =>
      x !== null && x >= 0 && x <= width && <rect key={edge} className="volume-profile-cutoff-handle"
        data-edge={edge} aria-label={name} role="slider" aria-valuemin={edge === 'lookbackMinutes' ? 1 : 0}
        aria-valuemax={edge === 'anchorRatio' ? 100 : undefined}
        aria-valuenow={edge === 'anchorRatio' ? Math.round(anchorRatio * 100) : lookbackMinutes}
        tabIndex={0} x={x - 5} y={0} width={10} height={height}
        onKeyDown={event => {
          const direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
          if (!direction) return
          event.preventDefault()
          event.stopPropagation()
          if (edge === 'anchorRatio') onChange({ anchorRatio: Math.max(0, Math.min(1, anchorRatio + direction / Math.max(1, span))) })
          else onChange({ lookbackMinutes: Math.max(1, lookbackMinutes - direction * step / 60) })
        }} />)}
  </svg>
}
