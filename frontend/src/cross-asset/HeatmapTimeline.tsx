import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { formatHeatmapChange, type HeatmapPeriod, type HeatmapPoint, type HeatmapRow } from './heatmap-model'

const labelWidth = 184, columnWidth = 92, rowHeight = 30, headerHeight = 42
type Memory = Map<string, { left: number; top: number }>
type TapeRow = { group: string; row: HeatmapRow | null }

function cellTitle(row: HeatmapRow, period: HeatmapPeriod, point: HeatmapPoint | undefined, stale: boolean) {
  if (period.future) return `${row.label} · ${period.day} · Future period`
  if (!point || point.value === null) return `${row.label} · ${period.day} · ${point?.reason || 'No candle or history unavailable'}${row.id.startsWith('basket:') ? ` · ${point?.coverage ?? 0}/7 counterparts` : ''}`
  const prices = point.start !== null ? `\nPrevious close ${point.start} → ${point.close}\nRange ${point.low}–${point.high}` : '\nEqual-weight geometric basket · 7/7 counterparts'
  return `${row.label} · ${period.day}${period.partial ? ' · In progress' : ''}\n${formatHeatmapChange(point.value)} · ${point.from} → ${point.through}${prices}\nRelative to prior volatility: ${formatHeatmapChange(point.relative, '×')}${point.reason ? `\n${point.reason}` : ''}${stale ? '\nReading is stale; refresh or check the connection' : ''}`
}

export const HeatmapTimeline = memo(function HeatmapTimeline({ rows, periods, selected, shade, focusRequest, memory, memoryKey, observedAt, onHover, onPin }: {
  rows: HeatmapRow[]; periods: HeatmapPeriod[]; selected: string; shade: 'return' | 'relative'; focusRequest: number
  memory: Memory; memoryKey: string; observedAt: number; onHover: (day: string) => void; onPin: (day: string) => void
}) {
  const viewport = useRef<HTMLDivElement>(null), frame = useRef(0), pendingScroll = useRef<{ left: number; top: number } | null>(null)
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number; active: boolean } | null>(null), swallow = useRef(false)
  const swallowTimer = useRef(0)
  const [view, setView] = useState({ left: 0, top: 0, width: 900, height: 250 })
  const [collapsed, setCollapsed] = useState<string[]>([])
  const groups = useMemo(() => [...new Set(rows.map(r => r.group))], [rows])
  const tapeRows = useMemo(() => groups.flatMap(group => [{ group, row: null } as TapeRow,
    ...(!collapsed.includes(group) ? rows.filter(r => r.group === group).map(row => ({ group, row })) : [])]), [rows, groups, collapsed])
  const measure = useCallback(() => {
    const el = viewport.current
    if (!el) return
    const next = { left: el.scrollLeft, top: el.scrollTop, width: el.clientWidth || 900, height: el.clientHeight || 250 }
    memory.delete(memoryKey); memory.set(memoryKey, { left: next.left, top: next.top })
    while (memory.size > 8) memory.delete(memory.keys().next().value!)
    setView(old => Object.keys(next).every(k => old[k as keyof typeof old] === next[k as keyof typeof next]) ? old : next)
  }, [memory, memoryKey])
  const queue = useCallback(() => {
    if (frame.current) return
    frame.current = window.requestAnimationFrame(() => {
      frame.current = 0
      if (pendingScroll.current && viewport.current) {
        viewport.current.scrollLeft = pendingScroll.current.left
        viewport.current.scrollTop = pendingScroll.current.top
        pendingScroll.current = null
      }
      measure()
    })
  }, [measure])
  const selectedRef = useRef(selected)
  useLayoutEffect(() => { selectedRef.current = selected }, [selected])
  useLayoutEffect(() => {
    const el = viewport.current
    if (!el) return
    const saved = focusRequest === 0 ? memory.get(memoryKey) : null
    const index = Math.max(0, periods.findIndex(p => p.day === selectedRef.current))
    el.scrollLeft = saved?.left ?? Math.max(0, (index - 3) * columnWidth)
    el.scrollTop = saved?.top ?? 0
    measure()
  }, [memory, memoryKey, periods, focusRequest, measure])
  useEffect(() => {
    const el = viewport.current
    if (!el) return
    const observer = new ResizeObserver(queue)
    observer.observe(el)
    return () => {
      observer.disconnect(); window.cancelAnimationFrame(frame.current); window.clearTimeout(swallowTimer.current)
      frame.current = 0; pendingScroll.current = null
      memory.set(memoryKey, { left: el.scrollLeft, top: el.scrollTop })
      const current = drag.current; drag.current = null
      if (current && el.hasPointerCapture?.(current.id)) el.releasePointerCapture(current.id)
    }
  }, [queue, memory, memoryKey])
  function down(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || e.isPrimary === false || (e.target as HTMLElement).closest('.heatmap-label')) return
    const rect = e.currentTarget.getBoundingClientRect()
    if (e.currentTarget.clientHeight && e.clientY >= rect.top + e.currentTarget.clientHeight) return
    if (e.currentTarget.clientWidth && e.clientX >= rect.left + e.currentTarget.clientWidth) return
    window.clearTimeout(swallowTimer.current); swallow.current = false
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop, active: false }
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.id !== e.pointerId) return
    const dx = e.clientX - current.x, dy = e.clientY - current.y
    if (!current.active && Math.hypot(dx, dy) < 6) return
    if (!current.active) { current.active = true; e.currentTarget.setPointerCapture(e.pointerId); e.currentTarget.dataset.dragging = 'true' }
    e.preventDefault(); swallow.current = true
    const maxLeft = Math.max(0, labelWidth + periods.length * columnWidth - (e.currentTarget.clientWidth || 900))
    const maxTop = Math.max(0, headerHeight + tapeRows.length * rowHeight - (e.currentTarget.clientHeight || 250))
    pendingScroll.current = { left: Math.min(maxLeft, Math.max(0, current.left - dx)), top: Math.min(maxTop, Math.max(0, current.top - dy)) }
    queue()
  }
  function finish(e: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.id !== e.pointerId) return
    drag.current = null; delete e.currentTarget.dataset.dragging
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (current.active) swallowTimer.current = window.setTimeout(() => { swallow.current = false }, 200)
  }
  const first = Math.max(0, Math.floor(view.left / columnWidth) - 2)
  const last = Math.min(periods.length, Math.ceil((view.left + view.width) / columnWidth) + 2)
  const top = Math.max(0, Math.floor((view.top - headerHeight) / rowHeight) - 3)
  const bottom = Math.min(tapeRows.length, Math.ceil((view.top + view.height) / rowHeight) + 3)
  const visible = periods.slice(first, last)
  return <div ref={viewport} className="heatmap-viewport" tabIndex={0} aria-label="Cross-asset timeline; drag or scroll to browse, click a date to pin"
    onScroll={queue} onPointerDown={down} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
    onClickCapture={e => { if (swallow.current) { e.preventDefault(); e.stopPropagation(); swallow.current = false } }}>
    <div className="heatmap-tape" style={{ gridTemplateColumns: `${labelWidth}px repeat(${periods.length}, ${columnWidth}px)`,
      gridTemplateRows: `${headerHeight}px repeat(${tapeRows.length}, ${rowHeight}px)` }}>
      <div className="heatmap-corner">Instrument / date</div>
      {visible.map((p, i) => <button key={p.day} type="button" className={`heatmap-date${p.day === selected ? ' selected' : ''}`}
        style={{ gridColumn: first + i + 2, gridRow: 1 }} disabled={p.future} aria-pressed={p.day === selected} data-heatmap-date={p.day}
        onMouseEnter={() => { if (!drag.current) onHover(p.day) }} onFocus={() => onHover(p.day)} onClick={() => onPin(p.day)}>
        <span>{p.label}</span><small>{p.partial ? p.day === p.end ? 'In progress' : 'Week to date' : p.day === p.end
          ? new Date(`${p.day}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }) : `to ${p.end.slice(5)}`}</small>
      </button>)}
      {tapeRows.slice(top, bottom).map((entry, index) => {
        const y = top + index + 2
        if (!entry.row) return <div key={`group:${entry.group}`} className="heatmap-group" style={{ gridRow: y, gridColumn: '1 / -1' }}>
          <button type="button" className="heatmap-label" aria-expanded={!collapsed.includes(entry.group)} onClick={() => setCollapsed(old => old.includes(entry.group) ? old.filter(g => g !== entry.group) : [...old, entry.group])}>
            {collapsed.includes(entry.group) ? '▸' : '▾'} {entry.group}
          </button></div>
        const row = entry.row
        return <div className="heatmap-row" key={row.id}>
          <div className="heatmap-label" style={{ gridRow: y, gridColumn: 1 }} title={row.id.startsWith('basket:') ? 'Synthetic equal-weight basket against the other seven currencies' : row.label}>{row.label}</div>
          {visible.map((period, i) => {
            const point = row.points.get(period.day), value = period.future ? null : point?.value ?? null
            const intensity = shade === 'relative' ? point?.relative : value
            const strength = intensity == null ? 0 : Math.min(1, Math.abs(intensity) / (shade === 'relative' ? 3 : 2))
            const stale = !!point?.reason || period.partial && point?.checkedAt != null && observedAt - point.checkedAt > 90
            return <button type="button" key={period.day} data-heatmap-cell={`${row.id}:${period.day}`}
              className={`heatmap-cell${period.day === selected ? ' selected' : ''}${value === null ? ' empty' : value > 0 ? ' positive' : value < 0 ? ' negative' : ''}${stale ? ' stale' : ''}`}
              style={{ gridRow: y, gridColumn: first + i + 2, '--heat-strength': intensity == null ? '0%' : `${Math.round(6 + strength * 48)}%` } as CSSProperties}
              disabled={period.future} title={cellTitle(row, period, point, stale)}
              onMouseEnter={() => { if (!drag.current) onHover(period.day) }} onFocus={() => onHover(period.day)} onClick={() => onPin(period.day)}>
              {formatHeatmapChange(value)}
            </button>
          })}
        </div>
      })}
    </div>
  </div>
})
