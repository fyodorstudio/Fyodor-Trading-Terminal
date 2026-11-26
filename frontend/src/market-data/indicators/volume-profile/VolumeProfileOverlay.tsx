import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import type { IChartApi, ISeriesApi, LogicalRange, Time } from 'lightweight-charts'
import { useDrawingViewport } from '../../chart-drawings/useDrawingViewport'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { createVolumeProfileOverlay, type FixedProfileWindow } from './volume-profile-overlay'
import { profileCandleWindow, type ProfileMode, type ProfileSide } from './volume-profile'
import { useVolumeProfile } from './useVolumeProfile'
import './volume-profile.css'

const storageKey = 'fyodor.indicators.volume-profile.v1'
function readSettings(): { mode: ProfileMode; side: ProfileSide } {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}')
    return { mode: saved?.mode === 'fixed' ? 'fixed' : 'visible', side: saved?.side === 'left' ? 'left' : 'right' }
  } catch { return { mode: 'visible', side: 'right' } }
}

type Chart = { chart: IChartApi; series: ISeriesApi<'Candlestick', Time>; bars: readonly OhlcBar[]; step: number }
export type VolumeProfileOptions = {
  symbol: string; scope: string; generation: number; precision: number; connected: boolean; synthetic: boolean; brokerOffset: number
  drawingActive: boolean; onStartDrawing: () => void
}

export function VolumeProfileOverlay({ chart, series, bars, step, symbol, scope, generation, precision, connected, synthetic, brokerOffset,
  drawingActive, onStartDrawing }: Chart & VolumeProfileOptions) {
  const [{ mode, side }, setSettings] = useState(readSettings)
  const [selected, setSelected] = useState<{ scope: string; window: FixedProfileWindow } | null>(null)
  const [drawing, setDrawing] = useState<string | null>(null)
  const [visible, setVisible] = useState<LogicalRange | null>(null)
  const overlay = useRef<ReturnType<typeof createVolumeProfileOverlay> | null>(null)
  const fixed = mode === 'fixed' && selected?.scope === scope ? selected.window : null
  const picking = drawing === scope && !drawingActive && connected && !synthetic && mode === 'fixed'
  const range = mode === 'fixed' ? fixed : visible && profileCandleWindow(bars, visible.from, visible.to, step)
  const { current, retry } = useVolumeProfile(symbol, scope, generation, brokerOffset, connected && !synthetic ? range : null)
  if (drawingActive && drawing !== null) setDrawing(null)

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify({ mode, side })) } catch { /* Settings work without storage. */ }
  }, [mode, side])
  useLayoutEffect(() => {
    if (mode !== 'visible' || synthetic) return
    const scale = chart.timeScale()
    const update = (range: LogicalRange | null) => setVisible(range)
    update(scale.getVisibleLogicalRange())
    scale.subscribeVisibleLogicalRangeChange(update)
    return () => scale.unsubscribeVisibleLogicalRangeChange(update)
  }, [chart, mode, synthetic])
  useLayoutEffect(() => {
    const pane = createVolumeProfileOverlay(chart, series)
    overlay.current = pane
    return () => { overlay.current = null; pane.destroy() }
  }, [chart, series])
  useLayoutEffect(() => {
    overlay.current?.sync(current?.profile ?? null, side, fixed, bars, step)
  }, [current?.profile, side, fixed, bars, step])

  const status = synthetic ? 'Tick history is available for broker symbols.'
    : !connected ? 'Waiting for MT5.'
    : picking ? 'Drag across the candles. Esc cancels.'
    : mode === 'fixed' && !fixed ? 'Draw a range to start.'
    : !range ? 'No visible candles.'
    : current?.incomplete && !current.loading ? 'Tick history may be incomplete.'
    : !current || current.loading ? (current?.total ? `Tick history · ${current.checked}/${current.total} days checked` : 'Reading tick history…')
    : !current.profile ? 'No ticks in this range.' : null
  const poc = current?.profile?.poc
  return <>
    <div className="volume-profile-controls" role="group" aria-label="Tick Volume Profile">
      <select aria-label="Volume profile range" value={mode} onChange={event => {
        const mode = event.target.value as ProfileMode
        setSettings(settings => ({ ...settings, mode })); setDrawing(null)
      }}>
        <option value="visible">Visible Range</option><option value="fixed">Fixed Range</option>
      </select>
      <select aria-label="Volume profile side" value={side}
        onChange={event => { const side = event.target.value as ProfileSide; setSettings(settings => ({ ...settings, side })) }}>
        <option value="left">Left</option><option value="right">Right</option>
      </select>
      {mode === 'fixed' && <button type="button" aria-pressed={picking} disabled={synthetic || !connected || !bars.length}
        onClick={() => { if (!picking) onStartDrawing(); setDrawing(picking ? null : scope) }}>{picking ? 'Cancel' : 'Draw range'}</button>}
      {poc && <span className="volume-profile-poc">POC {((poc.low + poc.high) / 2).toFixed(precision)}</span>}
      {status && <span role="status">{status}</span>}
      {current?.incomplete && !current.loading && <button type="button" onClick={retry}>Retry</button>}
    </div>
    {picking && <FixedProfilePicker chart={chart} series={series} bars={bars} step={step} onCancel={() => setDrawing(null)}
      onSelect={window => { setSelected({ scope, window }); setDrawing(null) }} />}
  </>
}

type Point = { x: number; y: number }
function FixedProfilePicker({ chart, series, bars, step, onSelect, onCancel }: Chart & {
  onSelect: (window: FixedProfileWindow) => void; onCancel: () => void
}) {
  const ref = useRef<SVGSVGElement>(null)
  const { width, height } = useDrawingViewport(chart, series, ref)
  const start = useRef<{ point: Point; pointer: number }>(null)
  const [preview, setPreview] = useState<{ from: Point; to: Point } | null>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  function point(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: Math.max(0, Math.min(width, event.clientX - rect.left)), y: Math.max(0, Math.min(height, event.clientY - rect.top)) }
  }
  function finish(event: PointerEvent<SVGSVGElement>) {
    const origin = start.current
    if (origin?.pointer !== event.pointerId) return
    start.current = null
    setPreview(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const end = point(event)
    const scale = chart.timeScale()
    const first = scale.coordinateToLogical(origin.point.x), last = scale.coordinateToLogical(end.x)
    if (first === null || last === null) return
    const range = profileCandleWindow(bars, Math.round(first), Math.round(last), step)
    const price1 = series.coordinateToPrice(origin.point.y), price2 = series.coordinateToPrice(end.y)
    if (range && price1 !== null && price2 !== null) onSelect({ ...range, price1, price2 })
  }
  return <svg className="volume-profile-picker" aria-label="Draw volume profile range" tabIndex={0} ref={ref}
    style={{ width, height }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onCancel() } }}
    onPointerDown={event => {
      if (event.button !== 0 || start.current) return
      const from = point(event)
      start.current = { point: from, pointer: event.pointerId }
      setPreview({ from, to: from })
      event.currentTarget.setPointerCapture(event.pointerId)
    }}
    onPointerMove={event => {
      const origin = start.current
      if (origin?.pointer === event.pointerId) setPreview({ from: origin.point, to: point(event) })
    }}
    onPointerUp={finish}
    onLostPointerCapture={() => { start.current = null; setPreview(null) }}
    onPointerCancel={() => { start.current = null; setPreview(null) }}>
    {preview && <rect x={Math.min(preview.from.x, preview.to.x)} y={Math.min(preview.from.y, preview.to.y)}
      width={Math.abs(preview.from.x - preview.to.x)} height={Math.abs(preview.from.y - preview.to.y)} />}
  </svg>
}
