import { memo, useEffect, useState } from 'react'
import type { IChartApi } from 'lightweight-charts'
import type { OhlcBar } from '../../../market-data/contracts/OhlcBar'
import type { ChartTimeframe } from '../../../market-data/contracts/ChartTimeframe'
import type { InspectorMarker } from '../../../inspector/inspector-data'
import type { ComboSnapshot } from '../core/contracts'
import { contextPairLabel } from '../../core/usd-pair'
import { roofCoordinate, visibleRoofCandidates } from './roof-geometry'
import { timeframeSeconds } from '../../../inspector/inspector-data'
import { roofLabel, roofTooltip } from './roof-label'
import { layoutRoofs, type RoofCandidate, type PositionedRoof } from './roof-layout'
import './combo-roofs.css'

function ComboRoofsComponent({ chartApi, episodes, bars, timeframe, markers, now, experimental, onSelect }: {
  chartApi: IChartApi; episodes: readonly ComboSnapshot[]; bars: readonly Pick<OhlcBar, 'time'>[]; timeframe: ChartTimeframe;
  markers: readonly InspectorMarker[]; now: number; experimental: boolean; onSelect: (combo: ComboSnapshot) => void
}) {
  const [positioned, setPositioned] = useState<PositionedRoof[]>([])
  const [overflow, setOverflow] = useState<ComboSnapshot[]>([]), [chooser, setChooser] = useState(false)
  const [focused, setFocused] = useState(true)
  useEffect(() => {
    const scale = chartApi.timeScale()
    const visibleIds = new Set(markers.flatMap(m => [m.release.id, ...(m.release.ismPublications?.map(r => r.id) ?? [])]))
    let frame: number | null = null
    const update = () => {
      frame = null
      const range = scale.getVisibleRange()
      if (!range || !markers.length) { setPositioned([]); setOverflow([]); return }
      const width = scale.width(), eligible: RoofCandidate[] = []
      const candidates = visibleRoofCandidates(episodes, Number(range.from) * 1000,
        Math.min(now, (Number(range.to) + timeframeSeconds[timeframe]) * 1000 - 1))
      for (const combo of candidates) {
        if (combo.experimental && !experimental) continue
        if (combo.sources.some(s => s.chartAt > combo.chartAt)) continue
        const sources = combo.sources.filter(s => visibleIds.has(s.sourceId))
        if (!sources.length) continue
        const end = roofCoordinate(scale, bars, combo.chartAt, timeframe)
        if (end === null || end < 0 || end > width) continue
        const ticks = sources.flatMap(s => { const x = roofCoordinate(scale, bars, s.chartAt, timeframe); return x === null || x < 0 || x > width ? [] : [x] })
        if (!ticks.length) continue
        const left = Math.max(0, Math.min(...ticks, end - 4)), right = end
        const labelX = width < 170 ? width / 2 : Math.max(85, Math.min(width - 85, (left + right) / 2))
        eligible.push({ combo, left, right, ticks: [...new Set(ticks)], hidden: combo.sources.length - sources.length, labelX })
      }
      const layout = layoutRoofs(eligible, focused)
      setPositioned(layout.positioned); setOverflow(layout.overflow)
    }
    const schedule = () => { if (frame === null) frame = window.requestAnimationFrame(update) }
    update()
    scale.subscribeVisibleLogicalRangeChange(schedule); scale.subscribeSizeChange(schedule)
    return () => { if (frame !== null) window.cancelAnimationFrame(frame); scale.unsubscribeVisibleLogicalRangeChange(schedule); scale.unsubscribeSizeChange(schedule) }
  }, [chartApi, episodes, bars, timeframe, markers, now, experimental, focused])
  if (!positioned.length && !overflow.length) return null
  return <div className="combo-roofs" aria-label="Clickable combo roofs">
    <svg width="100%" height="132" aria-hidden="true">{positioned.map(p => {
      const y = 105 - p.lane * 34
      return <g key={p.combo.id} className={p.combo.experimental ? 'experimental' : ''}>
        <path d={`M ${p.left} ${y + 8} V ${y} H ${p.right} V ${y + 8}`} />
        {p.ticks.map(x => <path key={x} d={`M ${x} ${y + 8} V 132`} />)}
        <circle className="combo-roof-activation" cx={p.right} cy={y} r="3" />
      </g>
    })}</svg>
    {positioned.map(p => <button type="button" key={p.combo.id} className={`combo-roof-label ${p.combo.experimental ? 'experimental' : ''}`}
      style={{ left: p.labelX, top: 87 - p.lane * 34 }}
      title={roofTooltip(p.combo, p.hidden)}
      aria-label={`Inspect combo ${p.combo.title}`} onClick={() => onSelect(p.combo)}>
      <span className="combo-roof-names">{roofLabel(p.combo)}</span>
      <span className="combo-roof-direction"> · {p.combo.direction === 'weaker' ? 'Long' : p.combo.direction === 'stronger' ? 'Short' : 'Uncomputed'}</span>
      {p.hidden > 0 && <small> · {p.hidden} hidden</small>}
    </button>)}
    <div className="combo-roof-tools">
      <div className="combo-roof-density" aria-label="Roof display density">
        <button type="button" aria-pressed={focused} title="Prioritize evidence, established relationships and recent updates; repeated overlapping roofs stay in More. This changes display only."
          onClick={() => { setFocused(true); setChooser(false) }}>Focused</button>
        <button type="button" aria-pressed={!focused} onClick={() => { setFocused(false); setChooser(false) }}>All roofs</button>
      </div>
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
