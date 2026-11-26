import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import type { IChartApi, ISeriesApi, LogicalRange, Time } from 'lightweight-charts'
import { useDrawingViewport } from '../../chart-drawings/useDrawingViewport'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { createVolumeProfileOverlay, type FixedProfileWindow } from './volume-profile-overlay'
import { profileCandleWindow, profileFromCutoff, type ProfileMode, type ProfileSide } from './volume-profile'
import { useVolumeProfile } from './useVolumeProfile'
import { VolumeProfileCutoff } from './VolumeProfileCutoff'
import { profileModeOptions, type VolumeProfilePreferences } from './volume-profile-preferences'
import './volume-profile.css'

type Chart = { chart: IChartApi; series: ISeriesApi<'Candlestick', Time>; bars: readonly OhlcBar[]; step: number }
export type VolumeProfileOptions = {
  symbol: string; scope: string; generation: number; precision: number; connected: boolean; brokerOffset: number
  drawingActive: boolean; onStartDrawing: () => void
  preferences: VolumeProfilePreferences; onChangePreferences: (patch: Partial<VolumeProfilePreferences>) => void
}

export function VolumeProfileOverlay({ chart, series, bars, step, symbol, scope, generation, precision, connected, brokerOffset,
  drawingActive, onStartDrawing, preferences, onChangePreferences }: Chart & VolumeProfileOptions) {
  const { mode, side, method } = preferences
  const [selected, setSelected] = useState<{ scope: string; window: FixedProfileWindow } | null>(null)
  const [line, setLine] = useState<{ scope: string; time: number } | null>(null)
  const [drawing, setDrawing] = useState<string | null>(null)
  const [visible, setVisible] = useState<LogicalRange | null>(null)
  const overlay = useRef<ReturnType<typeof createVolumeProfileOverlay> | null>(null)
  const fixed = mode === 'fixed' && selected?.scope === scope ? selected.window : null
  const cutoff = mode === 'cutoff' && line?.scope === scope ? line.time : null
  const drawingKey = `${scope}:${mode}`
  const picking = drawing === drawingKey && !drawingActive && connected && mode !== 'visible'
  const range = mode === 'fixed' ? fixed
    : mode === 'cutoff' ? cutoff === null ? null : profileFromCutoff(bars, cutoff, step)
    : visible && profileCandleWindow(bars, visible.from, visible.to, step)
  const { current, profile: loadedProfile, retry } = useVolumeProfile(symbol, `${scope}:${mode}:${method}`,
    generation, brokerOffset, method, connected ? range : null)
  const profile = connected && (mode === 'visible' || fixed || cutoff !== null) ? loadedProfile : null
  if (drawing !== null && (drawingActive || drawing !== drawingKey)) setDrawing(null)

  useLayoutEffect(() => {
    if (mode !== 'visible') return
    const scale = chart.timeScale()
    const update = (range: LogicalRange | null) => setVisible(range)
    update(scale.getVisibleLogicalRange())
    scale.subscribeVisibleLogicalRangeChange(update)
    return () => scale.unsubscribeVisibleLogicalRangeChange(update)
  }, [chart, mode])
  useLayoutEffect(() => {
    const pane = createVolumeProfileOverlay(chart, series)
    overlay.current = pane
    return () => { overlay.current = null; pane.destroy() }
  }, [chart, series])
  useLayoutEffect(() => {
    overlay.current?.sync(profile, preferences, fixed, bars, step)
  }, [profile, preferences, fixed, bars, step])
  useEffect(() => {
    if (!fixed || picking || drawingActive) return
    const element = chart.chartElement()
    const clearOnRightClick = (event: MouseEvent) => {
      if (event.button !== 2) return
      const pane = chart.panes()[0].getHTMLElement() ?? element
      const { left, top } = pane.getBoundingClientRect()
      const leftAxis = chart.options().leftPriceScale.visible ? chart.priceScale('left').width() : 0
      const { width, height } = chart.paneSize(0)
      const x = event.clientX - left - leftAxis, y = event.clientY - top
      if (x < 0 || x >= width || y < 0 || y >= height || !overlay.current?.containsFixed(x, y)) return
      event.preventDefault()
      setSelected(null)
    }
    element.addEventListener('contextmenu', clearOnRightClick)
    return () => element.removeEventListener('contextmenu', clearOnRightClick)
  }, [chart, fixed, picking, drawingActive])

  const historyLabel = method === 'hourly' ? 'H1' : 'Tick'
  const status = !connected ? 'Waiting for MT5.'
    : picking ? mode === 'cutoff' ? 'Click a candle to place the cutoff. Esc cancels.' : 'Drag across the candles. Esc cancels.'
    : mode === 'fixed' && !fixed ? 'Draw a range to start.'
    : mode === 'cutoff' && cutoff === null ? 'Place a line to choose the start.'
    : !range ? 'No visible candles.'
    : current?.incomplete && !current.loading ? `${historyLabel} history may be incomplete.`
    : !current || current.loading ? (current?.total ? `${historyLabel} history · ${current.checked}/${current.total} days checked`
      : `${profile ? 'Updating' : 'Reading'} ${method === 'hourly' ? 'H1' : 'tick'} history…`)
    : !profile ? method === 'hourly' ? 'No H1 activity in this range.' : 'No ticks in this range.' : null
  const poc = profile?.poc
  return <>
    <div className="volume-profile-controls" role="group" aria-label="Tick Volume Profile">
      <select aria-label="Volume profile range" value={mode} onChange={event => {
        const mode = event.target.value as ProfileMode
        onChangePreferences({ mode }); setDrawing(null)
      }}>
        {profileModeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select aria-label="Volume profile side" value={side}
        onChange={event => onChangePreferences({ side: event.target.value as ProfileSide })}>
        <option value="left">Left</option><option value="right">Right</option>
      </select>
      {mode !== 'visible' && <button type="button" aria-pressed={picking} disabled={!connected || !bars.length}
        onClick={() => { if (!picking) onStartDrawing(); setDrawing(picking ? null : drawingKey) }}>
        {picking ? 'Cancel' : mode === 'cutoff' ? 'Place line' : 'Draw range'}
      </button>}
      {method === 'hourly' && <span>H1 estimate</span>}
      {poc && <span className="volume-profile-poc">POC {((poc.low + poc.high) / 2).toFixed(precision)}</span>}
      {status && <span role="status">{status}</span>}
      {current?.incomplete && !current.loading && <button type="button" onClick={retry}>Retry</button>}
    </div>
    {picking && mode === 'fixed' && <FixedProfilePicker chart={chart} series={series} bars={bars} step={step} onCancel={() => setDrawing(null)}
      onSelect={window => { setSelected({ scope, window }); setDrawing(null) }} />}
    {mode === 'cutoff' && (picking || cutoff !== null) && <VolumeProfileCutoff chart={chart} series={series} bars={bars} step={step}
      cutoff={cutoff} placing={picking} interactive={connected && !drawingActive} onCancel={() => setDrawing(null)}
      onSelect={time => { setLine({ scope, time }); setDrawing(null) }} />}
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
