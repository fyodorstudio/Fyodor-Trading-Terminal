import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import type { IChartApi, ISeriesApi, LogicalRange, Time } from 'lightweight-charts'
import { useDrawingViewport } from '../../chart-drawings/useDrawingViewport'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { createVolumeProfileOverlay, type FixedProfileWindow } from './volume-profile-overlay'
import { movingProfileWindow, profileCandleWindow, profileFromCutoff, type ProfileMode, type ProfileSide, type ProfileWindow } from './volume-profile'
import { useVolumeProfile } from './useVolumeProfile'
import { VolumeProfileCutoff } from './VolumeProfileCutoff'
import { VolumeProfileMovingRange } from './VolumeProfileMovingRange'
import { profileModeOptions, type VolumeProfilePreferences } from './volume-profile-preferences'
import './volume-profile.css'

type Chart = { chart: IChartApi; series: ISeriesApi<'Candlestick', Time>; bars: readonly OhlcBar[]; step: number }
export type VolumeProfileOptions = {
  symbol: string; scope: string; generation: number; precision: number; connected: boolean; brokerOffset: number
  replayEnd?: number | null
  replaySeekRevision?: number | null
  drawingActive: boolean; onStartDrawing: () => void
  preferences: VolumeProfilePreferences; onChangePreferences: (patch: Partial<VolumeProfilePreferences>) => void
  onArmProfile?: (fixed?: ProfileWindow) => void
}

export function VolumeProfileOverlay({ chart, series, bars, step, symbol, scope, generation, precision, connected, brokerOffset, replayEnd, replaySeekRevision,
  drawingActive, onStartDrawing, preferences, onChangePreferences, onArmProfile }: Chart & VolumeProfileOptions) {
  const { mode, side, cutoffSide, lookbackMinutes, anchorRatio, follow = 'camera' } = preferences
  const [selected, setSelected] = useState<{ scope: string; window: FixedProfileWindow } | null>(null)
  const [line, setLine] = useState<{ scope: string; time: number } | null>(null)
  const [drawing, setDrawing] = useState<string | null>(null)
  const [visible, setVisible] = useState<LogicalRange | null>(null)
  const overlay = useRef<ReturnType<typeof createVolumeProfileOverlay> | null>(null)
  const verticalLine = mode === 'cutoff'
  const fixed = mode === 'fixed' && selected?.scope === scope ? selected.window : null
  const cutoff = verticalLine && line?.scope === scope ? line.time : null
  const drawingKey = `${scope}:${mode}`
  const picking = drawing === drawingKey && !drawingActive && connected && mode !== 'visible'
  const selectedRange = mode === 'fixed' ? fixed
    : verticalLine ? cutoff === null ? null : profileFromCutoff(bars, cutoff, step, cutoffSide)
    : visible && movingProfileWindow(bars, visible.from, visible.to, step, lookbackMinutes, anchorRatio, follow === 'price')
  const range = selectedRange && replayEnd != null ? selectedRange.from < replayEnd
    ? { from: selectedRange.from, to: Math.min(selectedRange.to, replayEnd) } : null
    : selectedRange
  const profileScope = `${scope}:${step}:${mode}:${replayEnd == null ? 'live' : `replay:${replaySeekRevision}`}${mode === 'visible' ? `:${follow}` : verticalLine ? `:${cutoffSide}` : ''}`
  const { current, profile: loadedProfile, retry } = useVolumeProfile(symbol, profileScope,
    generation, brokerOffset, connected ? range : null, replayEnd == null)
  const profile = connected && (mode === 'visible' || range) ? loadedProfile : null
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

  const status = !connected ? 'Waiting for MT5.'
    : picking ? verticalLine ? 'Click a candle to place the line. Esc cancels.' : 'Drag across the candles. Esc cancels.'
    : mode === 'fixed' && !fixed ? 'Draw a range to start.'
    : verticalLine && cutoff === null ? 'Place a line to set the boundary.'
    : !range ? verticalLine ? 'No candles on this side of the line.' : 'No visible candles.'
    : current?.incomplete && !current.loading ? 'Tick history may be incomplete.'
    : !current || current.loading ? (current?.total ? `Tick history · ${current.checked}/${current.total} days checked`
      : `${profile ? 'Updating' : 'Reading'} tick history…`)
    : !profile ? 'No ticks in this range.' : null
  const poc = profile?.poc
  return <>
    <div className="volume-profile-controls" role="group" aria-label="Tick Volume Profile">
      <select aria-label="Volume profile range" value={mode} onChange={event => {
        const mode = event.target.value as ProfileMode
        onChangePreferences({ mode }); setDrawing(null)
      }}>
        {profileModeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {mode === 'visible' && <>
        <select aria-label="Follow Mode anchor" value={follow} onChange={event => onChangePreferences({ follow: event.target.value === 'price' ? 'price' : 'camera' })}>
          <option value="camera">Follow Camera</option><option value="price">Follow Last Price</option>
        </select>
        <span>Box Size {lookbackMinutes} min</span>
      </>}
      <label className="volume-profile-side">{verticalLine ? 'Calculation side' : 'Histogram placement'}
        <select aria-label={verticalLine ? 'Volume profile calculation side' : 'Volume profile side'}
          title={verticalLine ? 'Side of the line to calculate' : undefined}
          value={verticalLine ? cutoffSide : side}
          onChange={event => {
            const value = event.target.value as ProfileSide
            onChangePreferences(verticalLine ? { cutoffSide: value } : { side: value })
          }}>
          <option value="left">Left</option><option value="right">Right</option>
        </select>
      </label>
      {mode !== 'visible' && <button type="button" aria-pressed={picking} disabled={!connected || !bars.length}
        onClick={() => { if (!picking) onStartDrawing(); setDrawing(picking ? null : drawingKey) }}>
        {picking ? 'Cancel' : verticalLine ? 'Place line' : 'Draw range'}
      </button>}
      {poc && <span className="volume-profile-poc">POC {((poc.low + poc.high) / 2).toFixed(precision)}</span>}
      {status && <span role="status">{status}</span>}
      {current?.incomplete && !current.loading && <button type="button" onClick={retry}>Retry</button>}
      {range && onArmProfile && <button type="button" onClick={() => onArmProfile(mode === 'visible' ? undefined : range)}>Arm alert</button>}
    </div>
    {picking && mode === 'fixed' && <FixedProfilePicker chart={chart} series={series} bars={bars} step={step} onCancel={() => setDrawing(null)}
      onSelect={window => { setSelected({ scope, window }); setDrawing(null) }} />}
    {mode === 'visible' && visible && <VolumeProfileMovingRange chart={chart} series={series} visible={visible} bars={bars} step={step}
      settings={preferences} interactive={!drawingActive && connected} onChange={onChangePreferences} />}
    {verticalLine && (picking || cutoff !== null) && <VolumeProfileCutoff chart={chart} series={series} bars={bars} step={step}
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
