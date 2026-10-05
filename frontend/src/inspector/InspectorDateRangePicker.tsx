import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { inspectorRangeLabel, inspectorRangePresets, shiftInspectorDate, shiftInspectorMonth, validInspectorDate } from './inspector-date-range'
import type { InspectorView } from './useInspector'

const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const monthNames = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat(undefined, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, month, 1))))

function RangePopover({ view, trigger, onClose, id }: { view: InspectorView; trigger: React.RefObject<HTMLButtonElement | null>; onClose: () => void; id: string }) {
  const popup = useRef<HTMLDivElement>(null)
  const initialFrom = validInspectorDate(view.rangeDates.from) ? view.rangeDates.from : view.today
  const initialTo = validInspectorDate(view.rangeDates.to) ? view.rangeDates.to : view.today
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [fromMonth, setFromMonth] = useState(() => initialFrom.slice(0, 7))
  const [toMonth, setToMonth] = useState(() => initialTo.slice(0, 7))
  const [focusedDay, setFocusedDay] = useState(initialFrom)
  const [position, setPosition] = useState({ top: 16, left: 16 })
  const error = !validInspectorDate(from) || !validInspectorDate(to) ? 'Enter complete, valid dates.' : from > to ? 'End must be on or after Start.' : null
  const closeAndFocus = () => {
    if (validInspectorDate(from) && validInspectorDate(to) && from <= to) {
      if (from !== view.rangeDates.from || to !== view.rangeDates.to) {
        view.selectCustomRange(from, to)
      }
    }
    onClose()
    trigger.current?.focus()
  }

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
  }, [trigger, fromMonth, toMonth, from, to])

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

  function chooseFromDay(day: string) {
    const nextFrom = day
    const nextTo = day > to ? day : to
    setFrom(nextFrom)
    if (day > to) {
      setTo(nextTo)
      setToMonth(nextTo.slice(0, 7))
    }
  }

  function chooseToDay(day: string) {
    const nextTo = day
    const nextFrom = day < from ? day : from
    setTo(nextTo)
    if (day < from) {
      setFrom(nextFrom)
      setFromMonth(nextFrom.slice(0, 7))
    }
    view.selectCustomRange(nextFrom, nextTo)
  }

  function moveFocus(day: string, event: React.KeyboardEvent, which: 'from' | 'to') {
    let next: string | null = null
    const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
    if (event.key === 'ArrowLeft') next = shiftInspectorDate(day, -1)
    if (event.key === 'ArrowRight') next = shiftInspectorDate(day, 1)
    if (event.key === 'ArrowUp') next = shiftInspectorDate(day, -7)
    if (event.key === 'ArrowDown') next = shiftInspectorDate(day, 7)
    if (event.key === 'Home') next = shiftInspectorDate(day, -weekday)
    if (event.key === 'End') next = shiftInspectorDate(day, 6 - weekday)
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      const delta = event.key === 'PageUp' ? -1 : 1
      next = `${shiftInspectorMonth(day.slice(0, 7), delta)}-01`
    }
    if (!next) return
    event.preventDefault()
    const nextMonth = next.slice(0, 7)
    if (which === 'from') {
      if (nextMonth !== fromMonth) setFromMonth(nextMonth)
    } else {
      if (nextMonth !== toMonth) setToMonth(nextMonth)
    }
    setFocusedDay(next)
  }

  function renderCalendar(
    shown: string,
    roleLabel: 'From' | 'To',
    selectedDay: string,
    onChoose: (day: string) => void,
    onShiftMonth: (delta: number) => void,
    which: 'from' | 'to'
  ) {
    const first = `${shown}-01`, next = `${shiftInspectorMonth(shown, 1)}-01`
    const blanks = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7
    const days = Math.round((Date.parse(next) - Date.parse(first)) / 86400000)
    const cells = Array.from({ length: 42 }, (_, i) => i < blanks || i >= blanks + days ? null : shiftInspectorDate(first, i - blanks))
    const focus = focusedDay.startsWith(shown) ? focusedDay : first
    const monthNum = Number(shown.slice(5))
    const monthTitle = `${monthNames[monthNum - 1]} ${shown.slice(0, 4)}`

    return (
      <div className="inspector-calendar-block" key={which}>
        <div className="inspector-calendar-header">
          <div className="inspector-calendar-title-row">
            <span className="inspector-calendar-role">{roleLabel}</span>
            <span className="inspector-calendar-value">{selectedDay}</span>
          </div>
          <div className="inspector-calendar-nav">
            <button
              type="button"
              className="inspector-cal-btn"
              aria-label={`Previous year for ${roleLabel.toLowerCase()} date`}
              title="Previous year"
              onClick={() => onShiftMonth(-12)}
            >
              «
            </button>
            <button
              type="button"
              className="inspector-cal-btn"
              aria-label={which === 'from' ? 'Previous calendar month' : `Previous calendar month for ${roleLabel.toLowerCase()} date`}
              title="Previous month"
              onClick={() => onShiftMonth(-1)}
            >
              ‹
            </button>
            <span className="inspector-cal-month-name">{monthTitle}</span>
            <button
              type="button"
              className="inspector-cal-btn"
              aria-label={which === 'from' ? 'Next calendar month' : `Next calendar month for ${roleLabel.toLowerCase()} date`}
              title="Next month"
              onClick={() => onShiftMonth(1)}
            >
              ›
            </button>
            <button
              type="button"
              className="inspector-cal-btn"
              aria-label={`Next year for ${roleLabel.toLowerCase()} date`}
              title="Next year"
              onClick={() => onShiftMonth(12)}
            >
              »
            </button>
          </div>
        </div>
        <table role="grid" aria-label={`${roleLabel} date: ${monthTitle}`}>
          <thead>
            <tr>
              {weekdays.map((name) => (
                <th key={name} scope="col">{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }, (_, row) => (
              <tr key={row}>
                {cells.slice(row * 7, row * 7 + 7).map((day, col) => (
                  <td key={col} aria-selected={day !== null && day >= from && day <= to}>
                    {day && (
                      <button
                        type="button"
                        data-day={day}
                        data-calendar={which}
                        tabIndex={day === focus ? 0 : -1}
                        aria-label={`Choose ${day}`}
                        aria-current={day === view.today ? 'date' : undefined}
                        className={`${day === from || day === to ? 'range-endpoint' : ''}${day >= from && day <= to ? ' in-range' : ''}`}
                        onFocus={() => setFocusedDay(day)}
                        onKeyDown={(event) => moveFocus(day, event, which)}
                        onClick={() => onChoose(day)}
                      >
                        {Number(day.slice(8))}
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return createPortal(
    <div ref={popup} id={id} role="dialog" aria-label="Inspector date range picker" className="inspector-date-popover" style={position}>
      <header>
        <strong>Date range</strong>
        <span>{view.brokerTime ? 'Broker time' : 'Display time'} · End date included</span>
        <button type="button" aria-label="Close date range picker" onClick={closeAndFocus}>×</button>
      </header>
      <div className="inspector-date-body">
        <nav aria-label="Date range presets">
          {inspectorRangePresets.map(([preset, label]) => (
            <button
              type="button"
              key={preset}
              aria-pressed={view.rangePreset === preset}
              onClick={() => { view.setRangePreset(preset); closeAndFocus() }}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="inspector-date-custom">
          <div className="inspector-calendar-months">
            {renderCalendar(fromMonth, 'From', from, chooseFromDay, (delta) => setFromMonth((m) => shiftInspectorMonth(m, delta)), 'from')}
            {renderCalendar(toMonth, 'To', to, chooseToDay, (delta) => setToMonth((m) => shiftInspectorMonth(m, delta)), 'to')}
          </div>
          <p className="inspector-date-help" role={error ? 'alert' : 'status'}>
            {error ?? `From: ${from} · To: ${to}. Click dates to adjust. Range updates immediately.`}
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
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
