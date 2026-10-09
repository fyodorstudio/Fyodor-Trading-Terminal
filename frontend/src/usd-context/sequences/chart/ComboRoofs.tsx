import { activationLabel, comboActivation } from '../../../scoring-system/relationships/combo-activation'
import { alignRoofMarkers } from './roof-marker-alignment'
import { indexMarkers, projectMarkers } from '../../../inspector/chart/marker-projection'
import { emphasizeMarkers } from '../../../inspector/chart/marker-emphasis'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { IChartApi, MouseEventParams, Time } from 'lightweight-charts'
import type { OhlcBar } from '../../../market-data/contracts/OhlcBar'
import type { ChartTimeframe } from '../../../market-data/contracts/ChartTimeframe'
import type { InspectorMarker } from '../../../inspector/inspector-data'
import type { ComboSnapshot, RoofComboGroup } from '../../../scoring-system/relationships/contracts'
import { currencyColorStyle, type CurrencyColors } from '../../../inspector/currency-colors'
import { roofSupport } from '../../../scoring-system/relationships/relationship-support'
import { SupportSplit } from '../../ui/SupportSplit'
import { createRoofPlan, knownRoofCount, prepareRoofAnchors, projectRoofPlan, roofOverflowRowHeight, roofOverflowWidth, roofConciseWidth,
  type RoofPlan, type RoofOverflowColumn } from './roof-plan'
import { roofLabel, roofTooltip, roofRateLabel } from './roof-label'
import { type PositionedRoof, roofLabelWidth, roofLabelHeight, roofRowHeight } from './roof-layout'
import { endpointPublications, roofEndpointKey, roofLaneY } from './roof-symbols'
import { useSequencePreferences } from '../storage/sequence-preferences'
import { roofDisplayVisible } from '../../../scoring-system/relationships/relationship-display'
import './combo-roofs.css'
import { useDisplayClock } from '../../../appearance/time-display/useDisplayClock'
import { comboColumnSummary } from './combo-column-summary'
import { RoofColumnMenu } from './RoofColumnMenu'

function ComboRoofsComponent({ chartApi, episodes, bars, timeframe, markers, now, experimental, onSelect, selectedId, currencyColors = {}, onOpenGroup, activeGroupCandleAt }: {
  chartApi: IChartApi; episodes: readonly ComboSnapshot[]; bars: readonly Pick<OhlcBar, 'time'>[]; timeframe: ChartTimeframe;
  markers: readonly InspectorMarker[]; now: number; experimental: boolean; onSelect: (combo: ComboSnapshot) => void;
  selectedId?: string; currencyColors?: CurrencyColors
  onOpenGroup?: (group: RoofComboGroup) => void; activeGroupCandleAt?: number
}) {
  const [positioned, setPositioned] = useState<PositionedRoof[]>([])
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const clock = useDisplayClock()
  const [overflow, setOverflow] = useState<RoofOverflowColumn[]>([]), [chooser, setChooser] = useState<number | null>(null)
  const [footerHeight, setFooterHeight] = useState(roofOverflowRowHeight)
  const [axisInset, setAxisInset] = useState(34)
  const previousLanes = useRef(new Map<string, number>())
  const preferences = useSequencePreferences(), focused = preferences.density !== 'all', concise = preferences.density === 'concise'
  const { fresh, hiddenRoofs } = preferences
  const visibleEpisodes = useMemo(() => episodes.filter(combo => roofDisplayVisible(combo, { fresh, hiddenRoofs })),
    [episodes, fresh, hiddenRoofs])
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
  const count = knownRoofCount(visibleEpisodes, now)
  const anchors = useMemo(() => prepareRoofAnchors(visibleEpisodes, bars, timeframe, markers, experimental, count),
    [visibleEpisodes, bars, timeframe, markers, experimental, count])
  const columnSummaries = useMemo(() => new Map(concise ? overflow.map(group => [group.column, comboColumnSummary(group.combos)] as const) : []), [overflow, concise])
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
      const chartHeight = chartApi.chartElement?.().clientHeight
      if (concise) setAxisInset(chartHeight ? Math.max(0, chartHeight - paneHeight) : 34)
      // Leave space for both Candy strips, outside-event notes and More.
      const rows = Math.max(1, Math.floor((paneHeight - 176) / roofRowHeight))
      if (!cached || cached.spacing !== spacing || cached.rows !== rows)
        cached = { spacing, rows, plan: createRoofPlan(anchors, spacing, focused, rows, selectedId) }
      let rowLimit = rows, layout = projectRoofPlan(cached.plan, Number(offset), scale.width(), previousLanes.current, rowLimit, concise)
      // Closely spaced columns keep separate More buttons in staggered rows.
      // Reserve additional footer space when one row cannot hold those buttons.
      while (!concise && rowLimit > 1) {
        const next = Math.max(1, rows - Math.ceil((layout.footerHeight - roofOverflowRowHeight) / roofRowHeight))
        if (next >= rowLimit) break
        rowLimit = next; layout = projectRoofPlan(cached.plan, Number(offset), scale.width(), previousLanes.current, rowLimit)
      }
      const aligned = concise ? [] : alignRoofMarkers(layout.positioned, projectMarkers(scale, markerIndex))
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
  }, [chartApi, anchors, bars, focused, concise, markerIndex, selectedId])
  if (!positioned.length && !overflow.length) return null
  const height = concise ? footerHeight + 42 : Math.max(1, ...positioned.map(p => p.lane + 1)) * roofRowHeight + 16 + footerHeight
  const labelHeight = height - footerHeight, width = chartApi.timeScale().width(), menuWidth = Math.min(340, Math.max(1, width - 16))
  const buttonWidth = concise ? roofConciseWidth : roofOverflowWidth
  const buttonTop = (group: RoofOverflowColumn) => (concise ? 2 : labelHeight + 2) + group.lane * roofOverflowRowHeight
  return <div className={`combo-roofs${concise ? ' concise' : ''}${chooser !== null ? ' combo-roof-choosing' : ''}`} style={{ ...currencyColorStyle(currencyColors), height, ...(concise ? { bottom: axisInset } : {}) }} aria-label="Clickable combo roofs"
    onClick={e => e.stopPropagation()}>
    <div className="combo-roof-content">
    <svg className="combo-roof-lines" width="100%" height={height} aria-hidden="true">
    {concise && overflow.map(group => <path key={group.column} className="combo-column-stem" data-roof-column={group.column}
      d={`M ${group.x - 4} ${buttonTop(group) + 22} H ${group.x + 4} M ${group.x} ${buttonTop(group) + 22} V ${height - 1} M ${group.x - 4} ${height - 1} H ${group.x + 4}`} />)}
    {positioned.filter(p => !connected.includes(p)).map(p => <path key={p.combo.id} className="combo-roof-anchor"
      data-roof-id={p.combo.id} d={`M ${p.labelX} ${roofLaneY(p.lane, labelHeight)} v 8`} />)}
    {connected.map(p => {
      const y = roofLaneY(p.lane, labelHeight)
      return <g key={p.combo.id} data-roof-id={p.combo.id} className={`combo-roof-connection${p.combo.experimental ? ' experimental' : ''}${p.combo.id === selectedId ? ' selected' : ' preview'}`}>
        {p.endpoints.some(endpoint => endpoint.publications.length) ?
          <path d={`M ${p.endpoints[0]?.x ?? p.left} ${y} H ${p.right}`} /> :
          <path className="combo-roof-anchor" d={`M ${p.labelX} ${y} v 8`} />}
        {p.endpoints.filter(endpoint => endpointPublications(endpoint, p.combo.chartAt).length &&
          (!endpoint.activation || endpoint.symbolX === undefined || Math.abs(endpoint.symbolX - endpoint.x) < .01))
          .map(endpoint => <path key={roofEndpointKey(endpoint)} className="combo-roof-stem" d={`M ${endpoint.x} ${y} V ${height}`} />)}
      </g>
    })}</svg>
    {positioned.map(p => {
      const support = roofSupport(p.combo), activation = comboActivation(p.combo), rate = roofRateLabel(p.combo)
      const neutral = support.state === 'balanced' ? 'Balanced' : support.state === 'unchanged' ? 'Unchanged' : support.state === 'insufficient' ? 'Insufficient' : null
      return <button type="button" key={p.combo.id} className={`combo-roof-label ${support.direction ?? support.state} ${p.combo.experimental ? 'experimental' : ''}`}
      style={{ left: p.labelX, top: roofLaneY(p.lane, labelHeight), width: roofLabelWidth, height: roofLabelHeight }} data-roof-id={p.combo.id} aria-pressed={p.combo.id === selectedId}
      title={roofTooltip(p.combo, p.hidden, clock.chart)}
      onPointerEnter={() => setHoveredId(p.combo.id)} onPointerLeave={() => setHoveredId(null)}
      onFocus={() => setFocusedId(p.combo.id)} onBlur={() => setFocusedId(null)}
      aria-label={`Inspect combo ${p.combo.title}`} onClick={() => onSelect(p.combo)}>
      <span className="combo-roof-heading"><span className="combo-roof-names">{roofLabel(p.combo)}</span></span>
      <span className="combo-roof-annotations">
        {activation.kind !== 'publication' && <span className="combo-roof-update-badge">({activationLabel(activation.kind)})</span>}
        {rate && <span className="combo-roof-rate">({rate})</span>}
        {neutral && <span>{neutral}</span>}
      </span>
      <span className="combo-roof-scope">{p.combo.kind === 'fresh-news' ? 'Changes in support' : 'Release support'}</span>
      <SupportSplit support={support} />
    </button>})}
    </div>
    {overflow.map(group => <RoofColumnMenu key={group.column} group={group} summary={columnSummaries.get(group.column)}
      concise={concise} open={chooser === group.column} selectedId={selectedId} top={buttonTop(group)}
      buttonWidth={buttonWidth} menuWidth={menuWidth} chartWidth={width}
      candleAt={(bars[group.column]?.time ?? group.combos[0].chartAt / 1000) * 1000} clock={clock.chart}
      groupActive={activeGroupCandleAt === undefined ? undefined : activeGroupCandleAt === (bars[group.column]?.time ?? group.combos[0].chartAt / 1000) * 1000}
      onOpenGroup={onOpenGroup ? () => { setChooser(null); onOpenGroup({ candleAt: (bars[group.column]?.time ?? group.combos[0].chartAt / 1000) * 1000, combos: [...group.combos] }) } : undefined}
      onToggle={() => setChooser(chooser === group.column ? null : group.column)}
      onSelect={combo => { onSelect(combo); setChooser(null) }} />)}
  </div>
}
export const ComboRoofs = memo(ComboRoofsComponent)
