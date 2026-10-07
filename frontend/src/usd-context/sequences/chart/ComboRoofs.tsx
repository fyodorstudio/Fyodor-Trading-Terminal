import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import type { IChartApi } from 'lightweight-charts'
import type { OhlcBar } from '../../../market-data/contracts/OhlcBar'
import type { ChartTimeframe } from '../../../market-data/contracts/ChartTimeframe'
import type { InspectorMarker } from '../../../inspector/inspector-data'
import type { ComboSnapshot, ComboSource } from '../core/contracts'
import { currencyColorStyle, type CurrencyColors } from '../../../inspector/currency-colors'
import { contextPairLabel } from '../../core/usd-pair'
import { createRoofPlan, knownRoofCount, prepareRoofAnchors, projectRoofPlan, type RoofPlan } from './roof-plan'
import { roofLabel, roofTooltip } from './roof-label'
import { type PositionedRoof } from './roof-layout'
import { endpointPublications, roofEndpointKey, roofEndpointTooltip, roofLaneY, type RoofEndpoint } from './roof-symbols'
import { RoofReleaseChooser } from './RoofReleaseChooser'
import { useSequencePreferences } from '../storage/sequence-preferences'
import './combo-roofs.css'

function ComboRoofsComponent({ chartApi, episodes, bars, timeframe, markers, now, experimental, onSelect, onOpenSource, currencyColors = {} }: {
  chartApi: IChartApi; episodes: readonly ComboSnapshot[]; bars: readonly Pick<OhlcBar, 'time'>[]; timeframe: ChartTimeframe;
  markers: readonly InspectorMarker[]; now: number; experimental: boolean; onSelect: (combo: ComboSnapshot) => void;
  onOpenSource?: (source: ComboSource) => void; currencyColors?: CurrencyColors
}) {
  const [positioned, setPositioned] = useState<PositionedRoof[]>([])
  const [overflow, setOverflow] = useState<ComboSnapshot[]>([]), [chooser, setChooser] = useState(false)
  const focused = useSequencePreferences().density !== 'all'
  const [releaseSelection, setReleaseSelection] = useState<{ roof: PositionedRoof; endpoint: RoofEndpoint; trigger: HTMLButtonElement } | null>(null)
  const closeReleases = useCallback(() => setReleaseSelection(null), [])
  const releaseChooser = releaseSelection && positioned.includes(releaseSelection.roof) ? releaseSelection : null
  const count = knownRoofCount(episodes, now)
  const anchors = useMemo(() => prepareRoofAnchors(episodes, bars, timeframe, markers, experimental, count),
    [episodes, bars, timeframe, markers, experimental, count])
  useEffect(() => {
    const scale = chartApi.timeScale()
    let frame: number | null = null, cached: { spacing: number; plan: RoofPlan } | null = null
    const update = () => {
      frame = null
      const offset = bars.length ? scale.timeToCoordinate(bars[0].time) : null
      if (offset === null || !scale.getVisibleRange()) { setPositioned([]); setOverflow([]); return }
      const second = bars[1] && scale.timeToCoordinate(bars[1].time)
      const spacing = Math.round((second == null ? scale.options().barSpacing : Number(second) - Number(offset)) * 1e6) / 1e6
      if (!Number.isFinite(spacing) || spacing <= 0) { setPositioned([]); setOverflow([]); return }
      if (!cached || cached.spacing !== spacing) cached = { spacing, plan: createRoofPlan(anchors, spacing, focused) }
      const layout = projectRoofPlan(cached.plan, Number(offset), scale.width())
      setPositioned(layout.positioned); setOverflow(layout.overflow)
    }
    const schedule = () => { if (frame === null) frame = window.requestAnimationFrame(update) }
    update()
    scale.subscribeVisibleLogicalRangeChange(schedule); scale.subscribeSizeChange(schedule)
    return () => { if (frame !== null) window.cancelAnimationFrame(frame); scale.unsubscribeVisibleLogicalRangeChange(schedule); scale.unsubscribeSizeChange(schedule) }
  }, [chartApi, anchors, bars, focused])
  if (!positioned.length && !overflow.length) return null
  return <div className={`combo-roofs${releaseChooser ? ' combo-roof-choosing' : ''}`} style={currencyColorStyle(currencyColors)} aria-label="Clickable combo roofs">
    <div className="combo-roof-content">
    <svg className="combo-roof-lines" width="100%" height="132" aria-hidden="true">{positioned.map(p => {
      const y = roofLaneY(p.lane)
      return <g key={p.combo.id} className={p.combo.experimental ? 'experimental' : ''}>
        <path d={`M ${p.endpoints[0]?.x ?? p.left} ${y} H ${p.right}`} />
        {p.endpoints.map(endpoint => <path key={roofEndpointKey(endpoint)} className="combo-roof-stem"
          d={`M ${endpoint.x} ${y} V ${endpointPublications(endpoint, p.combo.chartAt).length ? 132 : y + 8}`} />)}
      </g>
    })}</svg>
    {positioned.map(p => <button type="button" key={p.combo.id} className={`combo-roof-label ${p.combo.experimental ? 'experimental' : ''}`}
      style={{ left: p.labelX, top: roofLaneY(p.lane) - 27 }}
      title={roofTooltip(p.combo, p.hidden)}
      aria-label={`Inspect combo ${p.combo.title}`} onClick={() => onSelect(p.combo)}>
      <span className="combo-roof-names">{roofLabel(p.combo)}</span>
      <span className="combo-roof-direction"> · {p.combo.direction === 'weaker' ? 'Long' : p.combo.direction === 'stronger' ? 'Short' : 'Uncomputed'}</span>
    </button>)}
    {positioned.flatMap(p => p.endpoints.map(endpoint => {
      const publications = endpointPublications(endpoint, p.combo.chartAt), active = endpoint.activation
      const publicationUpdate = p.combo.sources.some(s => s.chartAt === p.combo.chartAt)
      const tooltip = roofEndpointTooltip(endpoint, p.combo.chartAt, publicationUpdate)
      return <button type="button" key={`${p.combo.id}/${roofEndpointKey(endpoint)}`} className={`combo-roof-endpoint${active ? ' combo-roof-start' : ''}`}
        style={{ left: endpoint.x, top: roofLaneY(p.lane) }} title={tooltip}
        aria-label={`${active ? publicationUpdate ? 'Combo starts' : 'Combo memory update' : 'Inspect roof release'}: ${publications.map(s => s.source.sourceLabel).join(' + ') || 'No visible activation release'}`}
        aria-haspopup={publications.length > 1 ? 'dialog' : undefined}
        disabled={!active && (!publications.length || !onOpenSource)}
        onClick={e => {
          if (!publications.length || !onOpenSource) onSelect(p.combo)
          else if (publications.length === 1) onOpenSource(publications[0].source)
          else setReleaseSelection({ roof: p, endpoint: { ...endpoint, publications }, trigger: e.currentTarget })
        }}>
        <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="2.5" /></svg>
      </button>
    }))}
    </div>
    {releaseChooser && onOpenSource && <RoofReleaseChooser endpoint={releaseChooser.endpoint} trigger={releaseChooser.trigger}
      left={Math.max(0, Math.min(releaseChooser.endpoint.x - 130, chartApi.timeScale().width() - 280))} onClose={closeReleases} onOpen={onOpenSource} />}
    <div className="combo-roof-tools">
      {overflow.length > 0 && <div className="combo-roof-overflow"><button type="button" aria-expanded={chooser} onClick={() => setChooser(!chooser)}>+{overflow.length} more</button>
        {chooser && <div aria-label="More combo roofs">{overflow.map(combo => <button type="button" key={combo.id} title={roofTooltip(combo)} onClick={() => { onSelect(combo); setChooser(false) }}>
          <span>{roofLabel(combo)} · {contextPairLabel('EURUSD', combo.direction)}</span>
          <small>{combo.strength ?? 'weak'} evidence · {new Date(combo.chartAt).toISOString().slice(0, 16).replace('T', ' ')} broker time</small>
        </button>)}</div>}
      </div>}
    </div>
  </div>
}
export const ComboRoofs = memo(ComboRoofsComponent)
