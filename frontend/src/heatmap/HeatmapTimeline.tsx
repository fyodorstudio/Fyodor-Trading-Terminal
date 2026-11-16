import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { formatHeatmapChange, formatHeatmapOHLC, heatmapOHLC, orderHeatmapGroups, heatmapFields, type HeatmapField, type HeatmapPeriod, type HeatmapPoint, type HeatmapRow } from './heatmap-model'
import { wildcardNotes, type WildcardRow } from './wildcards-model'
import { heatmapCellKey, heatmapColumnSelected, type HeatmapSelection } from './heatmap-selection'

const labelWidth = 184, rowHeight = 30, headerHeight = 42
const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' })
type Memory = Map<string, { left: number; top: number }>
type TapeRow = { group: string; row: HeatmapRow | null; wildcard?: WildcardRow; add?: boolean }

function cellTitle(row: HeatmapRow, period: HeatmapPeriod, point: HeatmapPoint | undefined, stale: boolean) {
  if (period.future) return `${row.label} · ${period.day} · Future period`
  if (!point || point.value === null) return `${row.label} · ${period.day} · ${point?.reason || 'No candle or history unavailable'}${row.id.startsWith('basket:') ? ` · ${point?.coverage ?? 0}/7 counterparts` : ''}`
  const prices = point.start !== null ? `\n${period.caption ? 'Anchor baseline' : 'Previous close'} ${point.start} → ${point.close}\nRange ${point.low}–${point.high}` : '\nEqual-weight geometric basket · 7/7 counterparts'
  const extremes = point.start === null ? 'Synthetic basket O/H/L unavailable; only net C is calculated from the seven pair endpoints.'
    : `${formatHeatmapOHLC(point)} · Open/high/low/close percentage changes versus ${period.caption ? 'the anchor baseline' : 'previous close'}; H/L need not occur together.`
  return `${row.label} · ${period.day}${period.partial ? ' · In progress' : ''}\n${formatHeatmapChange(point.value)} · ${point.from} → ${point.through}${prices}\n${extremes}\nRelative to prior volatility: ${formatHeatmapChange(point.relative, '×')}${point.reason ? `\n${point.reason}` : ''}${stale ? '\nReading is stale; refresh or check the connection' : ''}`
}

const HeatmapGridRows = memo(function HeatmapGridRows({ entries, top, first, visible, shade, observedAt, fields, selection,
  wildcardsReady, onAddWildcard, onManageWildcards, onEditWildcard, collapsed, onToggleGroup, onHover, onFocus, onSelectCell }: {
  entries: TapeRow[]; top: number; first: number; visible: HeatmapPeriod[]; shade: 'return' | 'relative'; observedAt: number
  fields: readonly HeatmapField[]; selection: HeatmapSelection | null; wildcardsReady: boolean
  onAddWildcard: () => void; onManageWildcards: () => void; onEditWildcard: (id: string, day: string) => void
  collapsed: string[]; onToggleGroup: (group: string) => void; onHover: (day: string) => void; onFocus: (day: string) => void
  onSelectCell: (rowId: string, day: string, extend: boolean, toggle: boolean) => void
}) {
  const selectedCells = useMemo(() => new Set(selection?.kind === 'cells' ? selection.cells.map(cell => heatmapCellKey(cell.rowId, cell.day)) : []), [selection])
  const columnSelected = (day: string) => selection?.kind === 'columns' && heatmapColumnSelected(selection, day)
  return <>
      {entries.map((entry, index) => {
        const y = top + index + 2
        if (entry.add) return <div key="wildcard:add" className="heatmap-row">
          <button type="button" className="heatmap-label wildcard-add" style={{ gridRow: y, gridColumn: 1 }} disabled={!wildcardsReady} onClick={onAddWildcard}>+ Add wildcard</button>
        </div>
        if (entry.wildcard) {
          const wildcard = entry.wildcard
          return <div className="heatmap-row" key={`wildcard:${wildcard.id}`}>
            <button type="button" className="heatmap-label" style={{ gridRow: y, gridColumn: 1 }} title={wildcard.title} onClick={onManageWildcards}>{wildcard.title}</button>
            {visible.map((period, i) => {
              const notes = wildcardNotes(wildcard, period.day, period.day === period.end ? 'daily' : 'weekly')
              return <button type="button" key={period.day} className="heatmap-cell wildcard-cell"
                data-wildcard-cell={`${wildcard.id}:${period.day}`} style={{ gridRow: y, gridColumn: first + i + 2 }} disabled={!wildcardsReady}
                aria-label={`${wildcard.title} · ${period.day} · ${notes.length ? `${notes.length} notes` : 'Add note'}`}
                title={notes.length ? notes.map(([date, text]) => `${date}\n${text.slice(0, 500)}`).join('\n\n') : `${wildcard.title} · ${period.day} · Add note`}
                onClick={() => onEditWildcard(wildcard.id, period.day)}>{notes.length ? `▤${period.day !== period.end ? ` ${notes.length}` : ''}` : ''}</button>
            })}
          </div>
        }
        if (!entry.row) return <div key={`group:${entry.group}`} className="heatmap-group" style={{ gridRow: y, gridColumn: '1 / -1' }}>
          <button type="button" className="heatmap-label" aria-expanded={!collapsed.includes(entry.group)} onClick={() => onToggleGroup(entry.group)}>
            {collapsed.includes(entry.group) ? '▸' : '▾'} {entry.group}
          </button></div>
        const row = entry.row
        return <div className="heatmap-row" key={row.id}>
          <div className="heatmap-label" style={{ gridRow: y, gridColumn: 1 }} title={row.id.startsWith('basket:') ? 'Synthetic equal-weight basket against the other seven currencies' : row.label}>{row.label}</div>
          {visible.map((period, i) => {
            const point = row.points.get(period.day), value = period.future ? null : point?.value ?? null
            const intensity = shade === 'relative' ? point?.relative : value
            const strength = intensity == null ? 0 : Math.min(1, Math.abs(intensity) / (shade === 'relative' ? 3 : 2))
            const stale = !!point?.reason || period.partial && row.checkedAt != null && observedAt - row.checkedAt > 90
            const highlighted = columnSelected(period.day) || selectedCells.has(heatmapCellKey(row.id, period.day))
            return <button type="button" key={period.day} data-heatmap-cell={`${row.id}:${period.day}`}
              className={`heatmap-cell${highlighted ? ' copy-selected' : ''}${value === null ? ' empty' : value > 0 ? ' positive' : value < 0 ? ' negative' : ''}${stale ? ' stale' : ''}`}
              style={{ gridRow: y, gridColumn: first + i + 2, '--heat-strength': intensity == null ? '0%' : `${Math.round(6 + strength * 48)}%` } as CSSProperties}
              disabled={period.future} aria-pressed={highlighted} aria-label={`${row.label} · ${period.caption ?? period.day} · ${formatHeatmapChange(value)}`} title={cellTitle(row, period, point, stale)}
              onMouseEnter={() => { if (!period.future) onHover(period.day) }} onFocus={() => onFocus(period.day)} onClick={event => onSelectCell(row.id, period.day, event.shiftKey, event.ctrlKey || event.metaKey)}>
              {value === null ? '—' : <span className="heatmap-ohlc">{heatmapOHLC(point).filter(field => fields.includes(field.label)).map(field => <span key={field.label} className={field.label === 'C' ? 'ohlc-close' : undefined}>
                <small>{field.label}</small>{formatHeatmapChange(field.value)}</span>)}</span>}
            </button>
          })}
        </div>
      })}
  </>
})

export const HeatmapTimeline = memo(function HeatmapTimeline({ rows, periods, selected, shade, focusRequest, memory, memoryKey, observedAt, onHover, onPin, groupOrder, collapsed, onToggleGroup,
  wildcards, wildcardsReady, onAddWildcard, onEditWildcard, onManageWildcards, selection, onSelectCell, fields = heatmapFields, showWildcards = true, hoverEnabled = true }: {
  rows: HeatmapRow[]; periods: HeatmapPeriod[]; selected: string; shade: 'return' | 'relative'; focusRequest: number
  memory: Memory; memoryKey: string; observedAt: number; onHover: (day: string) => void; onPin: (day: string, extend?: boolean) => void
  groupOrder: string[]; collapsed: string[]; onToggleGroup: (group: string) => void
  wildcards: WildcardRow[]; wildcardsReady: boolean; onAddWildcard: () => void; onEditWildcard: (id: string, day: string) => void; onManageWildcards: () => void
  fields?: readonly HeatmapField[]; showWildcards?: boolean; hoverEnabled?: boolean
  selection: HeatmapSelection | null
  onSelectCell: (rowId: string, day: string, extend: boolean, toggle: boolean) => void
}) {
  const columnWidth = 12 + 66 * fields.length
  const viewport = useRef<HTMLDivElement>(null), frame = useRef(0), pendingScroll = useRef<{ left: number; top: number } | null>(null)
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number; active: boolean } | null>(null), swallow = useRef(false)
  const swallowTimer = useRef(0)
  const [view, setView] = useState({ left: 0, top: 0, width: 900, height: 250 })
  const groups = useMemo(() => orderHeatmapGroups(rows.map(r => r.group), groupOrder), [rows, groupOrder])
  const tapeRows = useMemo<TapeRow[]>(() => [...groups.flatMap(group => [{ group, row: null } as TapeRow,
    ...(!collapsed.includes(group) ? rows.filter(r => r.group === group).map(row => ({ group, row })) : [])]),
    ...(showWildcards ? [{ group: 'Wildcards', row: null }, ...(!collapsed.includes('Wildcards') ? [
      ...wildcards.filter(row => !row.archived).map(wildcard => ({ group: 'Wildcards', row: null, wildcard })),
      { group: 'Wildcards', row: null, add: true }] : [])] : [])], [rows, groups, collapsed, wildcards, showWildcards])
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
  const hoverFrame = useRef(0), hoverDay = useRef<string | null>(null)
  const cancelHover = useCallback(() => {
    window.cancelAnimationFrame(hoverFrame.current)
    hoverFrame.current = 0; hoverDay.current = null
  }, [])
  const queueHover = useCallback((day: string) => {
    if (!hoverEnabled || drag.current) return
    if (day === selectedRef.current) { cancelHover(); return }
    hoverDay.current = day
    if (hoverFrame.current) return
    hoverFrame.current = window.requestAnimationFrame(() => {
      hoverFrame.current = 0
      const next = hoverDay.current; hoverDay.current = null
      if (next && next !== selectedRef.current && !drag.current) onHover(next)
    })
  }, [hoverEnabled, onHover, cancelHover])
  const focusPeriod = useCallback((day: string) => { cancelHover(); if (!drag.current) onHover(day) }, [cancelHover, onHover])
  useLayoutEffect(() => {
    if (!hoverEnabled) cancelHover()
    return cancelHover
  }, [hoverEnabled, memoryKey, cancelHover])
  const lastFocus = useRef<number | null>(null)
  useLayoutEffect(() => { selectedRef.current = selected }, [selected])
  useLayoutEffect(() => {
    const el = viewport.current
    if (!el) return
    const saved = lastFocus.current === null || lastFocus.current === focusRequest ? memory.get(memoryKey) : null
    lastFocus.current = focusRequest
    const index = Math.max(0, periods.findIndex(p => p.day === selectedRef.current))
    el.scrollLeft = saved?.left ?? Math.max(0, (index - 3) * columnWidth)
    el.scrollTop = saved?.top ?? 0
    measure()
  }, [memory, memoryKey, periods, focusRequest, measure, columnWidth])
  useEffect(() => {
    const el = viewport.current
    if (!el) return
    const observer = new ResizeObserver(queue)
    observer.observe(el)
    return () => {
      observer.disconnect(); window.cancelAnimationFrame(frame.current); window.clearTimeout(swallowTimer.current)
      frame.current = 0; pendingScroll.current = null
      swallow.current = false; delete el.dataset.dragging
      const current = drag.current; drag.current = null
      if (current && el.hasPointerCapture?.(current.id)) el.releasePointerCapture(current.id)
    }
  }, [queue, memory, memoryKey])
  function down(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || e.isPrimary === false || (e.target as HTMLElement).closest('.heatmap-label')) return
    const rect = e.currentTarget.getBoundingClientRect()
    if (e.currentTarget.clientHeight && e.clientY >= rect.top + e.currentTarget.clientHeight) return
    if (e.currentTarget.clientWidth && e.clientX >= rect.left + e.currentTarget.clientWidth) return
    cancelHover()
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
  const visible = useMemo(() => periods.slice(first, last), [periods, first, last])
  const entries = useMemo(() => tapeRows.slice(top, bottom), [tapeRows, top, bottom])
  const columnSelected = (day: string) => selection?.kind === 'columns' && heatmapColumnSelected(selection, day)
  return <div ref={viewport} className="heatmap-viewport" tabIndex={0} aria-label="Heatmap timeline; drag or scroll to browse, click to select a cell, Ctrl-click to toggle cells, Shift-click to select dates"
    onScroll={queue} onPointerDown={down} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
    onMouseLeave={cancelHover} onClickCapture={e => { cancelHover(); if (swallow.current) { e.preventDefault(); e.stopPropagation(); swallow.current = false } }}>
    <div className="heatmap-tape" style={{ gridTemplateColumns: `${labelWidth}px repeat(${periods.length}, ${columnWidth}px)`,
      gridTemplateRows: `${headerHeight}px repeat(${tapeRows.length}, ${rowHeight}px)`, '--heat-fields': fields.length } as CSSProperties}>
      <div className="heatmap-corner">Instrument / date</div>
      {visible.map((p, i) => <button key={p.day} type="button" className={`heatmap-date${p.day === selected ? ' active-date' : ''}${columnSelected(p.day) ? ' copy-selected' : ''}`}
        style={{ gridColumn: first + i + 2, gridRow: 1 }} disabled={p.future} aria-pressed={columnSelected(p.day)} title={p.caption ?? `${p.day} → ${p.end}`} data-heatmap-date={p.day}
        onMouseEnter={() => { if (!p.future) queueHover(p.day) }} onFocus={() => focusPeriod(p.day)} onClick={event => onPin(p.day, event.shiftKey)}>
        <span>{p.label}</span><small>{p.caption ?? (p.partial ? p.day === p.end ? 'In progress' : 'Week to date' : p.day === p.end
          ? weekdayFormatter.format(new Date(`${p.day}T00:00:00Z`)) : `to ${p.end.slice(5)}`)}</small>
      </button>)}
      <HeatmapGridRows entries={entries} top={top} first={first} visible={visible} shade={shade} observedAt={observedAt}
        fields={fields} selection={selection} wildcardsReady={wildcardsReady} onAddWildcard={onAddWildcard} onManageWildcards={onManageWildcards}
        onEditWildcard={onEditWildcard} collapsed={collapsed} onToggleGroup={onToggleGroup} onHover={queueHover} onFocus={focusPeriod} onSelectCell={onSelectCell} />
    </div>
  </div>
})
