import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from 'react'
import { ledgerDay, ledgerDayEnd, type LedgerData, type LedgerViewMemory } from './ledger-model'
import type { DetailReading } from '../currency-details/detail-model'
import { indexLedgerEvents } from './ledger-events'
import { LedgerDayCell } from './LedgerDayCell'
import type { LedgerFilters } from './ledger-filters'

const dayWidth = 176, labelWidth = 64, overscan = 3
const emptyEvents: readonly import('./ledger-events').LedgerOccurrence[]=[]
export const LedgerTimeline = memo(function LedgerTimeline({ data, filters, at, now, focusRequest, viewMemory, landing, onSelect, onOpenCurrency, onViewEvent, onYear }: {
  filters: LedgerFilters
  data: LedgerData; at: number; now: number; focusRequest: number; landing: { year: number; edge: 'start' | 'end' } | null
  onSelect: (at: number, currency?: string, category?: string | null) => void
  onOpenCurrency: (currency: string, category?: string | null) => void
  onYear: (year: number, edge: 'start' | 'end') => void
  viewMemory: RefObject<LedgerViewMemory>; onViewEvent: (reading: DetailReading, currency: string) => void
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const frame = useRef(0), pendingLeft = useRef<number | null>(null), clickTimer = useRef(0), swallowClick = useRef(false)
  const drag = useRef<{ id: number; x: number; left: number; active: boolean } | null>(null)
  const [view, setView] = useState({ first: 0, last: 12, edge: null as 'start' | 'end' | null })
  const selectedDay = ledgerDay(at), memoryKey = `${data.broker}:${data.currencies.join('')}:${data.year}`
  const remember = useCallback(() => {
    const element = viewport.current
    if (element) viewMemory.current.tape.set(memoryKey, { left: element.scrollLeft, top: element.scrollTop, day: selectedDay, request: focusRequest })
  }, [viewMemory, memoryKey, selectedDay, focusRequest])
  const inspect = useCallback((entry: DetailReading,currency:string)=>{remember();onViewEvent(entry,currency)},[remember,onViewEvent])
  const days = useMemo(() => {
    const result = []
    for (let t = Date.UTC(data.year, 0, 1); t < Date.UTC(data.year + 1, 0, 1); t += 86400_000) {
      const date = new Date(t)
      result.push({ date: date.toISOString().slice(0, 10), label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }), day: date.getUTCDate() })
    }
    return result
  }, [data.year])
  const events = useMemo(() => indexLedgerEvents(data,filters), [data,filters])
  const updateView = useCallback(() => {
    const element = viewport.current
    if (!element) return
    const width = element.clientWidth || 1000, max = Math.max(0, labelWidth + days.length * dayWidth - width)
    const left = Math.max(0, Math.min(max, element.scrollLeft))
    const first = Math.max(0, Math.floor((left - labelWidth) / dayWidth) - overscan)
    const last = Math.min(days.length, Math.ceil((left + width) / dayWidth) + overscan)
    const edge = left <= 2 ? 'start' : left >= max - 2 ? 'end' : null
    setView(old => old.first === first && old.last === last && old.edge === edge ? old : { first, last, edge })
  }, [days.length])
  const queueView = useCallback(() => {
    if (frame.current) return
    frame.current = window.requestAnimationFrame(() => {
      frame.current = 0
      if (pendingLeft.current !== null && viewport.current) { viewport.current.scrollLeft = pendingLeft.current; pendingLeft.current = null }
      updateView()
      remember()
    })
  }, [updateView, remember])
  useLayoutEffect(() => {
    const element = viewport.current
    if (!element) return
    const memory = viewMemory.current
    const index = days.findIndex(d => d.date === selectedDay)
    const saved = memory.tape.get(memoryKey)
    const restored = saved?.request === focusRequest && saved.day === selectedDay ? saved : null
    const edge = landing?.year === data.year ? landing.edge : !restored && index < 0 ? data.year < Number(selectedDay.slice(0, 4)) ? 'end' : 'start' : null
    const max = Math.max(0, labelWidth + days.length * dayWidth - (element.clientWidth || 1000))
    element.scrollLeft = edge === 'end' ? max : edge === 'start' ? 0 : restored?.left ?? Math.max(0, (index - 2) * dayWidth)
    element.scrollTop = restored?.top ?? 0
    pendingLeft.current = null
    updateView()
    remember()
    return () => { memory.tape.set(memoryKey, { left: element.scrollLeft, top: element.scrollTop, day: selectedDay, request: focusRequest }) }
  }, [data.year, days, selectedDay, focusRequest, landing, updateView, remember, viewMemory, memoryKey])
  useEffect(() => {
    const element = viewport.current
    if (!element) return
    let width = element.clientWidth
    const observer = new ResizeObserver(() => {
      if (width === element.clientWidth) return
      width = element.clientWidth; queueView()
    })
    observer.observe(element)
    return () => {
      observer.disconnect(); window.cancelAnimationFrame(frame.current); window.clearTimeout(clickTimer.current)
      frame.current = 0; pendingLeft.current = null
      const current = drag.current; drag.current = null
      if (current && element.hasPointerCapture(current.id)) element.releasePointerCapture(current.id)
    }
  }, [queueView])
  function pointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || e.isPrimary === false) return
    const rect = e.currentTarget.getBoundingClientRect()
    if (e.clientY >= rect.top + e.currentTarget.clientHeight && e.currentTarget.clientHeight > 0) return
    const cell = (e.target as HTMLElement).closest<HTMLElement>('.ledger-day-cell')
    if (cell && cell.scrollHeight > cell.clientHeight && e.clientX >= cell.getBoundingClientRect().left + cell.clientWidth) return
    window.clearTimeout(clickTimer.current); swallowClick.current = false
    drag.current = { id: e.pointerId, x: e.clientX, left: e.currentTarget.scrollLeft, active: false }
  }
  function pointerMove(e: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.id !== e.pointerId) return
    const delta = e.clientX - current.x
    if (!current.active && Math.abs(delta) < 6) return
    if (!current.active) { current.active = true; e.currentTarget.setPointerCapture(e.pointerId); e.currentTarget.dataset.dragging = 'true' }
    e.preventDefault(); swallowClick.current = true
    const max = Math.max(0, labelWidth + days.length * dayWidth - (e.currentTarget.clientWidth || 1000))
    pendingLeft.current = Math.max(0, Math.min(max, current.left - delta)); queueView()
  }
  function finish(e: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.id !== e.pointerId) return
    drag.current = null; delete e.currentTarget.dataset.dragging
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (current.active) clickTimer.current = window.setTimeout(() => { swallowClick.current = false }, 200)
  }
  const visible = days.slice(view.first, view.last)
  return <div className="ledger-timeline">
    <div ref={viewport} className="ledger-viewport" tabIndex={0} aria-label="Ledger date tape; drag to browse without changing the as-of date"
      onScroll={event => {
        const target = event.target as HTMLElement
        if (target.dataset.ledgerCell) viewMemory.current.cells.set(`${data.broker}:${target.dataset.ledgerCell}`, target.scrollTop)
        else queueView()
      }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
      onClickCapture={e => { if (swallowClick.current) { e.preventDefault(); e.stopPropagation(); swallowClick.current = false } }}>
      <div className="ledger-tape" style={{ '--ledger-days': days.length } as CSSProperties}>
        <div className="ledger-corner" style={{ gridRow: 1, gridColumn: 1 }}>Date</div>
        {visible.map((day, offset) => <button key={day.date} data-ledger-date={day.date} style={{ gridRow: 1, gridColumn: view.first + offset + 2 }}
          className={`ledger-date${day.date === selectedDay ? ' selected' : ''}`} type="button" aria-pressed={day.date === selectedDay}
          disabled={day.date > ledgerDay(now)} onClick={() => onSelect(ledgerDayEnd(day.date))}><span>{day.label}</span><strong>{day.day}</strong></button>)}
        {data.currencies.map((currency, row) => <div className="ledger-lane" key={currency}>
          <button className="ledger-currency" style={{ gridRow: row + 2, gridColumn: 1 }} type="button" aria-label={`Open ${currency} Ledger scorecard`} onClick={() => onOpenCurrency(currency)}>{currency}</button>
          {visible.map((day,offset)=><LedgerDayCell key={day.date} cellKey={`${currency}-${day.date}`} broker={data.broker}
            selected={day.date===selectedDay} position={{gridRow:row+2,gridColumn:view.first+offset+2}}
            memory={viewMemory} items={events.get(currency+day.date)??emptyEvents} now={now}
            onInspect={inspect} />)}
        </div>)}
      </div>
    </div>
    {view.edge === 'start' && data.year > data.min_year && <button className="ledger-year-popup ledger-year-previous" type="button" onClick={() => onYear(data.year - 1, 'end')}>Go to {data.year - 1}</button>}
    {view.edge === 'end' && data.year < data.max_year && <button className="ledger-year-popup ledger-year-next" type="button" onClick={() => onYear(data.year + 1, 'start')}>Go to {data.year + 1}</button>}
  </div>
})
