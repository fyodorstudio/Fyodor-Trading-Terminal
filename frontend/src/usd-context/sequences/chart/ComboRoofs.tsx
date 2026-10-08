import { activationLabel, comboActivation } from '../core/combo-activation'
import { alignRoofMarkers } from './roof-marker-alignment'
import { indexMarkers, projectMarkers } from '../../../inspector/chart/marker-projection'
import { memo, useEffect, useMemo, useState } from 'react'
import type { IChartApi, MouseEventParams, Time } from 'lightweight-charts'
import type { OhlcBar } from '../../../market-data/contracts/OhlcBar'
import type { ChartTimeframe } from '../../../market-data/contracts/ChartTimeframe'
import type { InspectorMarker } from '../../../inspector/inspector-data'
import type { ComboSnapshot } from '../core/contracts'
import { currencyColorStyle, type CurrencyColors } from '../../../inspector/currency-colors'
import { roofResultLabel, roofSupport } from '../core/relationship-support'
import { SupportSplit } from '../../ui/SupportSplit'
import { createRoofPlan, knownRoofCount, prepareRoofAnchors, projectRoofPlan, type RoofPlan } from './roof-plan'
import { roofLabel, roofTooltip } from './roof-label'
import { type PositionedRoof } from './roof-layout'
import { endpointPublications, roofEndpointKey, roofLaneY } from './roof-symbols'
import { useSequencePreferences } from '../storage/sequence-preferences'
import './combo-roofs.css'
import { useDisplayClock } from '../../../appearance/time-display/useDisplayClock'

function ComboRoofsComponent({ chartApi, episodes, bars, timeframe, markers, now, experimental, onSelect, selectedId, currencyColors = {} }: {
  chartApi: IChartApi; episodes: readonly ComboSnapshot[]; bars: readonly Pick<OhlcBar, 'time'>[]; timeframe: ChartTimeframe;
  markers: readonly InspectorMarker[]; now: number; experimental: boolean; onSelect: (combo: ComboSnapshot) => void;
  selectedId?: string; currencyColors?: CurrencyColors
}) {
  const [positioned, setPositioned] = useState<PositionedRoof[]>([])
  const clock = useDisplayClock()
  const [overflow, setOverflow] = useState<ComboSnapshot[]>([]), [chooser, setChooser] = useState(false)
  const focused = useSequencePreferences().density !== 'all'
  useEffect(() => {
    if (!chooser) return
    const clear = (event: MouseEventParams<Time>) => {
      if (event.point && !event.hoveredObjectId) setChooser(false)
    }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setChooser(false) }
    document.addEventListener('keydown', key)
    chartApi.subscribeClick(clear)
    return () => { chartApi.unsubscribeClick(clear); document.removeEventListener('keydown', key) }
  }, [chartApi, chooser])
  const markerIndex = useMemo(() => indexMarkers(markers), [markers])
  const count = knownRoofCount(episodes, now)
  const anchors = useMemo(() => prepareRoofAnchors(episodes, bars, timeframe, markers, experimental, count),
    [episodes, bars, timeframe, markers, experimental, count])
  useEffect(() => {
    const scale = chartApi.timeScale()
    let frame: number | null = null, cached: { spacing: number; rows: number; plan: RoofPlan } | null = null
    const update = () => {
      frame = null
      setChooser(false)
      const offset = bars.length ? scale.timeToCoordinate(bars[0].time) : null
      if (offset === null || !scale.getVisibleRange()) { setPositioned([]); setOverflow([]); return }
      const second = bars[1] && scale.timeToCoordinate(bars[1].time)
      const spacing = Math.round((second == null ? scale.options().barSpacing : Number(second) - Number(offset)) * 1e6) / 1e6
      if (!Number.isFinite(spacing) || spacing <= 0) { setPositioned([]); setOverflow([]); return }
      const paneHeight = chartApi.paneSize?.().height ?? 420
      // Leave space for both Candy strips, outside-event notes and More.
      const rows = Math.max(1, Math.floor((paneHeight - 176) / 48))
      if (!cached || cached.spacing !== spacing || cached.rows !== rows)
        cached = { spacing, rows, plan: createRoofPlan(anchors, spacing, focused, rows, selectedId) }
      const layout = projectRoofPlan(cached.plan, Number(offset), scale.width())
      setPositioned(alignRoofMarkers(layout.positioned, projectMarkers(scale, markerIndex))); setOverflow(layout.overflow)
    }
    const schedule = () => { if (frame === null) frame = window.requestAnimationFrame(update) }
    const element = chartApi.chartElement?.()
    const observer = element ? new ResizeObserver(schedule) : null
    if (element) observer?.observe(element)
    update()
    scale.subscribeVisibleLogicalRangeChange(schedule); scale.subscribeSizeChange(schedule)
    return () => { if (frame !== null) window.cancelAnimationFrame(frame); observer?.disconnect(); scale.unsubscribeVisibleLogicalRangeChange(schedule); scale.unsubscribeSizeChange(schedule) }
  }, [chartApi, anchors, bars, focused, markerIndex, selectedId])
  if (!positioned.length && !overflow.length) return null
  const height = Math.max(1, ...positioned.map(p => p.lane + 1)) * 48 + 16
  return <div className={`combo-roofs${chooser ? ' combo-roof-choosing' : ''}`} style={{ ...currencyColorStyle(currencyColors), height }} aria-label="Clickable combo roofs"
    onClick={e => e.stopPropagation()}>
    <div className="combo-roof-content">
    <svg className="combo-roof-lines" width="100%" height={height} aria-hidden="true">{positioned.map(p => {
      const y = roofLaneY(p.lane, height)
      return <g key={p.combo.id} data-roof-id={p.combo.id} className={`${p.combo.experimental ? 'experimental' : ''}${p.combo.id === selectedId ? ' selected' : ''}`}>
        <path d={`M ${p.endpoints[0]?.x ?? p.left} ${y} H ${p.right}`} />
        {p.endpoints.filter(endpoint => endpointPublications(endpoint, p.combo.chartAt).length &&
          (!endpoint.activation || endpoint.symbolX === undefined || Math.abs(endpoint.symbolX - endpoint.x) < .01))
          .map(endpoint => <path key={roofEndpointKey(endpoint)} className="combo-roof-stem" d={`M ${endpoint.x} ${y} V ${height}`} />)}
      </g>
    })}</svg>
    {positioned.map(p => <button type="button" key={p.combo.id} className={`combo-roof-label ${p.combo.experimental ? 'experimental' : ''}${comboActivation(p.combo).kind !== 'publication' ? ' combo-roof-memory-label' : ''}`}
      style={{ left: p.labelX, top: roofLaneY(p.lane, height) }} data-roof-id={p.combo.id} aria-pressed={p.combo.id === selectedId}
      title={roofTooltip(p.combo, p.hidden, clock.chart)}
      aria-label={`Inspect combo ${p.combo.title}`} onClick={() => onSelect(p.combo)}>
      <span className="combo-roof-heading"><span className="combo-roof-names">{roofLabel(p.combo)}</span>
        {comboActivation(p.combo).kind !== 'publication' && <span className="combo-roof-update-badge">{activationLabel(comboActivation(p.combo).kind)}</span>}</span>
      <span className="combo-roof-direction"> · {p.combo.kind === 'fresh-news' ? 'Change: ' : ''}{roofResultLabel(p.combo)}</span>
      <SupportSplit support={roofSupport(p.combo)} compact />
    </button>)}
    </div>
    <div className="combo-roof-tools">
      {overflow.length > 0 && <div className="combo-roof-overflow"><button type="button" aria-expanded={chooser} onClick={() => setChooser(!chooser)}>+{overflow.length} more</button>
        {chooser && <div aria-label="More combo roofs">{overflow.map(combo => <button type="button" key={combo.id} title={roofTooltip(combo, 0, clock.chart)} onClick={() => { onSelect(combo); setChooser(false) }}>
          <span>{roofLabel(combo)} · {roofResultLabel(combo)}</span>
          <SupportSplit support={roofSupport(combo)} compact />
          <small>{combo.strength ? `${combo.strength} evidence` : 'Direction withheld'} · {clock.chart(combo.chartAt)}</small>
        </button>)}</div>}
      </div>}
    </div>
  </div>
}
export const ComboRoofs = memo(ComboRoofsComponent)
