import { activationLabel, comboActivation } from '../core/combo-activation'
import { alignRoofMarkers } from './roof-marker-alignment'
import { indexMarkers, projectMarkers } from '../../../inspector/chart/marker-projection'
import { emphasizeMarkers } from '../../../inspector/chart/marker-emphasis'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { IChartApi, MouseEventParams, Time } from 'lightweight-charts'
import type { OhlcBar } from '../../../market-data/contracts/OhlcBar'
import type { ChartTimeframe } from '../../../market-data/contracts/ChartTimeframe'
import type { InspectorMarker } from '../../../inspector/inspector-data'
import type { ComboSnapshot } from '../core/contracts'
import { currencyColorStyle, type CurrencyColors } from '../../../inspector/currency-colors'
import { roofResultLabel, roofSupport } from '../core/relationship-support'
import { SupportSplit } from '../../ui/SupportSplit'
import { createRoofPlan, knownRoofCount, prepareRoofAnchors, projectRoofPlan, roofOverflowRowHeight, roofOverflowWidth,
  type RoofPlan, type RoofOverflowColumn } from './roof-plan'
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
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const clock = useDisplayClock()
  const [overflow, setOverflow] = useState<RoofOverflowColumn[]>([]), [chooser, setChooser] = useState<number | null>(null)
  const [footerHeight, setFooterHeight] = useState(roofOverflowRowHeight)
  const previousLanes = useRef(new Map<string, number>())
  const focused = useSequencePreferences().density !== 'all'
  const connected = useMemo(() => positioned.filter(p =>
    p.combo.id === selectedId || p.combo.id === hoveredId || p.combo.id === focusedId),
  [positioned, selectedId, hoveredId, focusedId])
  useEffect(() => {
    emphasizeMarkers(chartApi, connected.flatMap(p => p.combo.sources.map(source => source.sourceId)))
    return () => emphasizeMarkers(chartApi, [])
  }, [chartApi, connected])
  useEffect(() => {
    if (chooser === null) return
    const clear = (event: MouseEventParams<Time>) => {
      if (event.point && !event.hoveredObjectId) setChooser(null)
    }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setChooser(null) }
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
      setChooser(null)
      setHoveredId(null)
      const offset = bars.length ? scale.timeToCoordinate(bars[0].time) : null
      if (offset === null || !scale.getVisibleRange()) { setPositioned([]); setOverflow([]); setFocusedId(null); previousLanes.current.clear(); return }
      const second = bars[1] && scale.timeToCoordinate(bars[1].time)
      const spacing = Math.round((second == null ? scale.options().barSpacing : Number(second) - Number(offset)) * 1e6) / 1e6
      if (!Number.isFinite(spacing) || spacing <= 0) { setPositioned([]); setOverflow([]); setFocusedId(null); previousLanes.current.clear(); return }
      const paneHeight = chartApi.paneSize?.().height ?? 420
      // Leave space for both Candy strips, outside-event notes and More.
      const rows = Math.max(1, Math.floor((paneHeight - 176) / 48))
      if (!cached || cached.spacing !== spacing || cached.rows !== rows)
        cached = { spacing, rows, plan: createRoofPlan(anchors, spacing, focused, rows, selectedId) }
      let rowLimit = rows, layout = projectRoofPlan(cached.plan, Number(offset), scale.width(), previousLanes.current, rowLimit)
      // Closely spaced columns keep separate More buttons in staggered rows.
      // Reserve additional footer space when one row cannot hold those buttons.
      while (rowLimit > 1) {
        const next = Math.max(1, rows - Math.ceil((layout.footerHeight - roofOverflowRowHeight) / 48))
        if (next >= rowLimit) break
        rowLimit = next; layout = projectRoofPlan(cached.plan, Number(offset), scale.width(), previousLanes.current, rowLimit)
      }
      const aligned = alignRoofMarkers(layout.positioned, projectMarkers(scale, markerIndex))
      // Removing a focused button does not dispatch blur. Its preview must not
      // revive when a later viewport/filter change brings the label back.
      setFocusedId(current => aligned.some(p => p.combo.id === current) ? current : null)
      previousLanes.current = new Map(aligned.map(p => [p.combo.id, p.lane]))
      setPositioned(aligned); setOverflow(layout.overflowColumns); setFooterHeight(layout.footerHeight)
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
  const height = Math.max(1, ...positioned.map(p => p.lane + 1)) * 48 + 16 + footerHeight
  const labelHeight = height - footerHeight, width = chartApi.timeScale().width(), menuWidth = Math.min(340, Math.max(1, width - 16))
  return <div className={`combo-roofs${chooser !== null ? ' combo-roof-choosing' : ''}`} style={{ ...currencyColorStyle(currencyColors), height }} aria-label="Clickable combo roofs"
    onClick={e => e.stopPropagation()}>
    <div className="combo-roof-content">
    <svg className="combo-roof-lines" width="100%" height={height} aria-hidden="true">
    {positioned.filter(p => !connected.includes(p)).map(p => <path key={p.combo.id} className="combo-roof-anchor"
      data-roof-id={p.combo.id} d={`M ${p.labelX} ${roofLaneY(p.lane, labelHeight)} v 8`} />)}
    {connected.map(p => {
      const y = roofLaneY(p.lane, labelHeight)
      return <g key={p.combo.id} data-roof-id={p.combo.id} className={`combo-roof-connection${p.combo.experimental ? ' experimental' : ''}${p.combo.id === selectedId ? ' selected' : ' preview'}`}>
        <path d={`M ${p.endpoints[0]?.x ?? p.left} ${y} H ${p.right}`} />
        {p.endpoints.filter(endpoint => endpointPublications(endpoint, p.combo.chartAt).length &&
          (!endpoint.activation || endpoint.symbolX === undefined || Math.abs(endpoint.symbolX - endpoint.x) < .01))
          .map(endpoint => <path key={roofEndpointKey(endpoint)} className="combo-roof-stem" d={`M ${endpoint.x} ${y} V ${height}`} />)}
      </g>
    })}</svg>
    {positioned.map(p => <button type="button" key={p.combo.id} className={`combo-roof-label ${p.combo.experimental ? 'experimental' : ''}${comboActivation(p.combo).kind !== 'publication' ? ' combo-roof-memory-label' : ''}`}
      style={{ left: p.labelX, top: roofLaneY(p.lane, labelHeight) }} data-roof-id={p.combo.id} aria-pressed={p.combo.id === selectedId}
      title={roofTooltip(p.combo, p.hidden, clock.chart)}
      onPointerEnter={() => setHoveredId(p.combo.id)} onPointerLeave={() => setHoveredId(null)}
      onFocus={() => setFocusedId(p.combo.id)} onBlur={() => setFocusedId(null)}
      aria-label={`Inspect combo ${p.combo.title}`} onClick={() => onSelect(p.combo)}>
      <span className="combo-roof-heading"><span className="combo-roof-names">{roofLabel(p.combo)}</span>
        {comboActivation(p.combo).kind !== 'publication' && <span className="combo-roof-update-badge">{activationLabel(comboActivation(p.combo).kind)}</span>}</span>
      <span className="combo-roof-direction"> · {p.combo.kind === 'fresh-news' ? 'Change: ' : ''}{roofResultLabel(p.combo)}</span>
      <SupportSplit support={roofSupport(p.combo)} compact />
    </button>)}
    </div>
    {overflow.map(group => <div className="combo-roof-overflow" key={group.column} data-roof-column={group.column}
      style={{ left: group.x, top: labelHeight + 2 + group.lane * roofOverflowRowHeight }}>
      <button type="button" style={{ width: roofOverflowWidth }} aria-expanded={chooser === group.column}
        aria-label={`More combos on candle ${clock.chart((bars[group.column]?.time ?? group.combos[0].chartAt / 1000) * 1000)} · ${group.combos.length} hidden`}
        onClick={() => setChooser(chooser === group.column ? null : group.column)}>+{group.combos.length} more</button>
        {chooser === group.column && <div aria-label="More combo roofs" style={{ width: menuWidth,
          left: Math.max(8, Math.min(group.x - menuWidth / 2, width - menuWidth - 8)) - group.x + roofOverflowWidth / 2 }}>
          {group.combos.map(combo => <button type="button" key={combo.id} data-roof-id={combo.id} title={roofTooltip(combo, 0, clock.chart)} onClick={() => { onSelect(combo); setChooser(null) }}>
          <span>{roofLabel(combo)} · {roofResultLabel(combo)}</span>
          <SupportSplit support={roofSupport(combo)} compact />
          <small>{combo.strength ? `${combo.strength} evidence` : 'Direction withheld'} · {clock.chart(combo.chartAt)}</small>
        </button>)}</div>}
      </div>)}
  </div>
}
export const ComboRoofs = memo(ComboRoofsComponent)
