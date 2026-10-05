import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { inspectorRangeLabel, inspectorRangePresets, shiftInspectorDate, shiftInspectorMonth, validInspectorDate } from './inspector-date-range'
import type { InspectorView } from './useInspector'

const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const monthNames = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat(undefined, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, month, 1))))

function RangePopover({ view, trigger, onClose, id }: { view: InspectorView; trigger: React.RefObject<HTMLButtonElement | null>; onClose: () => void; id: string }) {
  const popup = useRef<HTMLDivElement>(null)
  const [month, setMonth] = useState(() => (validInspectorDate(view.rangeDates.from) ? view.rangeDates.from : view.today).slice(0, 7))
  const [from, setFrom] = useState(view.rangeDates.from)
  const [to, setTo] = useState(view.rangeDates.to)
  const [anchorDay, setAnchorDay] = useState<string | null>(null)
  const [focusedDay, setFocusedDay] = useState(() => validInspectorDate(from) ? from : `${month}-01`)
  const [position, setPosition] = useState({ top: 16, left: 16 })
  const error = !validInspectorDate(from) || !validInspectorDate(to) ? 'Enter complete, valid dates.' : from > to ? 'End must be on or after Start.' : null
  const closeAndFocus = () => { onClose(); trigger.current?.focus() }
  useLayoutEffect(() => {
    const dock = trigger.current?.closest('.inspector-panel')
    const place = () => {
      const button = trigger.current, panel = popup.current
      if (!button || !panel) return
      const rect = button.getBoundingClientRect(), size = panel.getBoundingClientRect()
      const host = dock?.getBoundingClientRect()
      const center = host && host.width > 0 ? host.left + host.width / 2 : rect.left + rect.width / 2
      const margin = 16, gap = 12
      const above = rect.top - size.height - gap, below = rect.bottom + gap
      const top = above >= margin ? above : below + size.height <= window.innerHeight - margin ? below :
        Math.max(margin, (window.innerHeight - size.height) / 2)
      const left = Math.max(margin, Math.min(center - size.width / 2, window.innerWidth - size.width - margin))
      setPosition((current) => current.top === top && current.left === left ? current : { top, left })
    }
    place()
    const observer = window.ResizeObserver ? new window.ResizeObserver(place) : null
    if (trigger.current) observer?.observe(trigger.current)
    if (dock) observer?.observe(dock)
    if (popup.current) observer?.observe(popup.current)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { observer?.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [trigger, month, error, anchorDay])
  useEffect(() => {
    const outside = (event: Event) => {
      if (event.target instanceof Node && !popup.current?.contains(event.target) && !trigger.current?.contains(event.target)) onClose()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); trigger.current?.focus() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', outside); document.removeEventListener('keydown', escape) }
  }, [onClose, trigger])
  useEffect(() => { popup.current?.querySelector<HTMLButtonElement>(`[data-day="${focusedDay}"]`)?.focus() }, [focusedDay])

  function edit(which: 'from' | 'to', value: string) {
    const nextFrom = which === 'from' ? value : from, nextTo = which === 'to' ? value : to
    setFrom(nextFrom); setTo(nextTo); setAnchorDay(null)
    if (validInspectorDate(nextFrom) && validInspectorDate(nextTo) && nextFrom <= nextTo) {
      view.selectCustomRange(nextFrom, nextTo)
      setMonth(nextFrom.slice(0, 7))
    }
  }
  function chooseDay(day: string) {
    if (anchorDay === null) { setAnchorDay(day); setFrom(day); setTo(day); return }
    const start = day < anchorDay ? day : anchorDay, end = day < anchorDay ? anchorDay : day
    view.selectCustomRange(start, end)
    closeAndFocus()
  }
  function moveFocus(day: string, event: React.KeyboardEvent) {
    let next: string | null = null
    const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
    if (event.key === 'ArrowLeft') next = shiftInspectorDate(day, -1)
    if (event.key === 'ArrowRight') next = shiftInspectorDate(day, 1)
    if (event.key === 'ArrowUp') next = shiftInspectorDate(day, -7)
    if (event.key === 'ArrowDown') next = shiftInspectorDate(day, 7)
    if (event.key === 'Home') next = shiftInspectorDate(day, -weekday)
    if (event.key === 'End') next = shiftInspectorDate(day, 6 - weekday)
    if (event.key === 'PageUp' || event.key === 'PageDown') next = `${shiftInspectorMonth(day.slice(0, 7), event.key === 'PageUp' ? -1 : 1)}-01`
    if (!next) return
    event.preventDefault()
    if (next.slice(0, 7) < month || next.slice(0, 7) > shiftInspectorMonth(month, 1)) setMonth(next.slice(0, 7))
    setFocusedDay(next)
  }
  const year = Number(month.slice(0, 4)), currentYear = Number(view.today.slice(0, 4))
  const firstYear = Math.min(2015, year), lastYear = Math.max(currentYear + 2, year)
  return createPortal(<div ref={popup} id={id} role="dialog" aria-label="Inspector date range picker" className="inspector-date-popover" style={position}>
    <header><strong>Date range</strong><span>{view.brokerTime ? 'Broker time' : 'Display time'} · End date included</span>
      <button type="button" aria-label="Close date range picker" onClick={closeAndFocus}>×</button></header>
    <div className="inspector-date-body"><nav aria-label="Date range presets">
      {inspectorRangePresets.map(([preset, label]) => <button type="button" key={preset} aria-pressed={view.rangePreset === preset}
        onClick={() => { view.setRangePreset(preset); closeAndFocus() }}>{label}</button>)}
    </nav><div className="inspector-date-custom">
      <div className="inspector-date-inputs"><label>From<input type="date" aria-label="Inspector range start" value={from} onChange={(event) => edit('from', event.target.value)} /></label>
        <label>To<input type="date" aria-label="Inspector range end" value={to} onChange={(event) => edit('to', event.target.value)} /></label></div>
      <div className="inspector-month-navigation"><button type="button" aria-label="Previous calendar month" onClick={() => setMonth(shiftInspectorMonth(month, -1))}>‹</button>
        <select aria-label="Calendar month" value={Number(month.slice(5))} onChange={(event) => setMonth(`${year}-${event.target.value.padStart(2, '0')}`)}>
          {monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select>
        <select aria-label="Calendar year" value={year} onChange={(event) => setMonth(`${event.target.value}-${month.slice(5)}`)}>
          {Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index).map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <button type="button" aria-label="Next calendar month" onClick={() => setMonth(shiftInspectorMonth(month, 1))}>›</button></div>
      <div className="inspector-calendar-months">{[month, shiftInspectorMonth(month, 1)].map((shown) => {
        const first = `${shown}-01`, next = `${shiftInspectorMonth(shown, 1)}-01`
        const blanks = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7
        const days = Math.round((Date.parse(next) - Date.parse(first)) / 86400000)
        const cells = Array.from({ length: 42 }, (_, index) => index < blanks || index >= blanks + days ? null : shiftInspectorDate(first, index - blanks))
        const focus = focusedDay.startsWith(shown) ? focusedDay : first
        return <table role="grid" key={shown} aria-label={`${monthNames[Number(shown.slice(5)) - 1]} ${shown.slice(0, 4)}`}>
          <caption>{monthNames[Number(shown.slice(5)) - 1]} {shown.slice(0, 4)}</caption>
          <thead><tr>{weekdays.map((name) => <th key={name} scope="col">{name}</th>)}</tr></thead>
          <tbody>{Array.from({ length: cells.length / 7 }, (_, row) => <tr key={row}>{cells.slice(row * 7, row * 7 + 7).map((day, col) =>
            <td key={col} aria-selected={day !== null && day >= from && day <= to}>{day && <button type="button" data-day={day}
              tabIndex={day === focus ? 0 : -1} aria-label={`Choose ${day}`} aria-current={day === view.today ? 'date' : undefined}
              className={`${day === from || day === to ? 'range-endpoint' : ''}${day >= from && day <= to ? ' in-range' : ''}`}
              onFocus={() => setFocusedDay(day)} onKeyDown={(event) => moveFocus(day, event)} onClick={() => chooseDay(day)}>{Number(day.slice(8))}</button>}</td>)}</tr>)}</tbody>
        </table>
      })}</div>
      <p className="inspector-date-help" role={error ? 'alert' : 'status'}>{error ?? (anchorDay ? 'Choose the end date. The completed range updates immediately.' : 'Choose a start and end date, or the same day twice. Complete date edits update immediately.')}</p>
    </div></div>
  </div>, document.body)
}

export function InspectorDateRangePicker({ view }: { view: InspectorView }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const close = useCallback(() => setOpen(false), [])
  const label = inspectorRangeLabel(view.rangeDates.from, view.rangeDates.to)
  return <div className="inspector-range"><button ref={trigger} type="button" aria-label="Inspector date range" aria-haspopup="dialog"
    aria-expanded={open} aria-controls={open ? id : undefined} title={`Date range: ${label}`} onClick={() => setOpen((value) => !value)}>
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="2" />
      <line x1="2" y1="7" x2="14" y2="7" />
      <line x1="5" y1="1.5" x2="5" y2="3.5" />
      <line x1="11" y1="1.5" x2="11" y2="3.5" />
    </svg></button>
    {open && <RangePopover view={view} trigger={trigger} onClose={close} id={id} />}
  </div>
}
