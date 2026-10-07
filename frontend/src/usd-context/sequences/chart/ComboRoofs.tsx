import { useEffect, useState } from 'react'
import type { IChartApi } from 'lightweight-charts'
import type { OhlcBar } from '../../../market-data/contracts/OhlcBar'
import type { ChartTimeframe } from '../../../market-data/contracts/ChartTimeframe'
import type { InspectorMarker } from '../../../inspector/inspector-data'
import type { ComboSnapshot } from '../core/contracts'
import { contextPairLabel } from '../../core/usd-pair'
import { roofCoordinate, visibleRoofCandidates } from './roof-geometry'
import { timeframeSeconds } from '../../../inspector/inspector-data'
import './combo-roofs.css'

type Positioned = { combo: ComboSnapshot; left: number; right: number; ticks: number[]; lane: number; hidden: number }
export function ComboRoofs({ chartApi, episodes, bars, timeframe, markers, now, experimental, onSelect }: {
  chartApi: IChartApi; episodes: readonly ComboSnapshot[]; bars: readonly OhlcBar[]; timeframe: ChartTimeframe;
  markers: readonly InspectorMarker[]; now: number; experimental: boolean; onSelect: (combo: ComboSnapshot) => void
}) {
  const [positioned, setPositioned] = useState<Positioned[]>([])
  const [overflow, setOverflow] = useState<ComboSnapshot[]>([]), [chooser, setChooser] = useState(false)
  useEffect(() => {
    const scale = chartApi.timeScale()
    const visibleIds = new Set(markers.flatMap(m => [m.release.id, ...(m.release.ismPublications?.map(r => r.id) ?? [])]))
    let frame: number | null = null
    const update = () => {
      frame = null
      const range = scale.getVisibleRange()
      if (!range || !markers.length) { setPositioned([]); setOverflow([]); return }
      const width = scale.width(), lanes = [-Infinity, -Infinity, -Infinity], next: Positioned[] = [], hiddenItems: ComboSnapshot[] = []
      const candidates = visibleRoofCandidates(episodes, Number(range.from) * 1000,
        Math.min(now, (Number(range.to) + timeframeSeconds[timeframe]) * 1000 - 1))
      for (const combo of candidates) {
        if (combo.experimental && !experimental) continue
        const sources = combo.sources.filter(s => visibleIds.has(s.sourceId))
        if (!sources.length) continue
        const end = roofCoordinate(scale, bars, combo.chartAt, timeframe)
        if (end === null || end < 0 || end > width) continue
        const ticks = sources.flatMap(s => { const x = roofCoordinate(scale, bars, s.chartAt, timeframe); return x === null || x < 0 || x > width ? [] : [x] })
        if (!ticks.length) continue
        const left = Math.max(0, Math.min(...ticks)), right = Math.max(left + 4, Math.min(width, end))
        const occupiedLeft = Math.max(0, (left + right) / 2 - 85), occupiedRight = Math.min(width, (left + right) / 2 + 85)
        const lane = lanes.findIndex(edge => edge + 8 < occupiedLeft)
        if (lane === -1) { hiddenItems.push(combo); continue }
        lanes[lane] = occupiedRight
        next.push({ combo, left, right, ticks: [...new Set(ticks)], lane, hidden: combo.sources.length - sources.length })
      }
      setPositioned(next); setOverflow(hiddenItems)
    }
    const schedule = () => { if (frame === null) frame = window.requestAnimationFrame(update) }
    update()
    scale.subscribeVisibleLogicalRangeChange(schedule); scale.subscribeSizeChange(schedule)
    return () => { if (frame !== null) window.cancelAnimationFrame(frame); scale.unsubscribeVisibleLogicalRangeChange(schedule); scale.unsubscribeSizeChange(schedule) }
  }, [chartApi, episodes, bars, timeframe, markers, now, experimental])
  if (!positioned.length && !overflow.length) return null
  return <div className="combo-roofs" aria-label="Clickable combo roofs">
    <svg width="100%" height="132" aria-hidden="true">{positioned.map(p => {
      const y = 105 - p.lane * 34
      return <g key={p.combo.id} className={p.combo.experimental ? 'experimental' : ''}>
        <path d={`M ${p.left} ${y + 8} V ${y} H ${p.right} V ${y + 8}`} />
        {p.ticks.map(x => <path key={x} d={`M ${x} ${y + 8} V 132`} />)}
      </g>
    })}</svg>
    {positioned.map(p => <button type="button" key={p.combo.id} className={`combo-roof-label ${p.combo.experimental ? 'experimental' : ''}`}
      style={{ left: Math.max(85, Math.min(chartApi.timeScale().width() - 85, (p.left + p.right) / 2)), top: 87 - p.lane * 34 }}
      title={`${p.combo.title} · ${contextPairLabel('EURUSD', p.combo.direction)} · ${p.combo.strength ?? 'weak'} evidence${p.hidden ? ` · ${p.hidden} inputs hidden by marker filters` : ''}\n${p.combo.explanation}`}
      aria-label={`Inspect combo ${p.combo.title}`} onClick={() => onSelect(p.combo)}>
      {p.combo.experimental ? 'Fresh news' : p.combo.kind === 'ism-sectors' ? 'ISM sectors' : p.combo.kind === 'weekly-labor' ? 'Claims + NFP' : 'Labor + inflation'}
      {' · '}{p.combo.direction === 'weaker' ? 'Long' : p.combo.direction === 'stronger' ? 'Short' : 'Uncomputed'}
      {p.hidden > 0 && <small> · {p.hidden} hidden</small>}
    </button>)}
    {overflow.length > 0 && <div className="combo-roof-overflow"><button type="button" aria-expanded={chooser} onClick={() => setChooser(!chooser)}>+{overflow.length} combo roofs</button>
      {chooser && <div>{overflow.map(combo => <button type="button" key={combo.id} onClick={() => { onSelect(combo); setChooser(false) }}>{combo.title} · {contextPairLabel('EURUSD', combo.direction)}</button>)}</div>}
    </div>}
  </div>
}
