import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { inspectorDefaultAfterDays, shiftInspectorDate, shiftInspectorMonth, validInspectorDate } from '../inspector-date-range'
import { inspectorCalendarPosition } from '../inspector-popover-layout'
import type { InspectorView } from '../useInspector'

export function useRangePopover({ view, trigger, onClose, filtersOpen }: { view: InspectorView; trigger: React.RefObject<HTMLButtonElement | null>; onClose: () => void; id: string; filtersOpen: boolean }) {
  const popup = useRef<HTMLDivElement>(null)
  const initialFrom = validInspectorDate(view.rangeDates.from) ? view.rangeDates.from : view.today
  const initialTo = validInspectorDate(view.rangeDates.to) ? view.rangeDates.to : view.today
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [fromMonth, setFromMonth] = useState(() => initialFrom.slice(0, 7))
  const [toMonth, setToMonth] = useState(() => initialTo.slice(0, 7))
  const [focusedDay, setFocusedDay] = useState(initialFrom)
  const [position, setPosition] = useState(() => inspectorCalendarPosition(window.innerWidth, window.innerHeight, window.innerWidth / 2, filtersOpen))
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
      const rect = button.getBoundingClientRect()
      const host = dock?.getBoundingClientRect()
      const center = host && host.width > 0 ? host.left + host.width / 2 : rect.left + rect.width / 2
      const next = inspectorCalendarPosition(window.innerWidth, window.innerHeight, center, filtersOpen)
      setPosition(current => Object.keys(next).every(key => current[key as keyof typeof next] === next[key as keyof typeof next]) ? current : next)
    }
    place()
    const observer = window.ResizeObserver ? new window.ResizeObserver(place) : null
    if (trigger.current) observer?.observe(trigger.current)
    if (dock) observer?.observe(dock)
    if (popup.current) observer?.observe(popup.current)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { observer?.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [trigger, fromMonth, toMonth, from, to, filtersOpen])

  useEffect(() => {
    const outside = (event: Event) => {
      if (event.target instanceof HTMLElement && event.target.closest('.inspector-modal, [data-inspector-filter-trigger]')) return
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

  const diffDays = (validInspectorDate(from) && validInspectorDate(to) && to >= from)
    ? Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
    : 0
  const totalDays = diffDays + 1

  function daysBetween(start: string, end: string): number {
    if (!validInspectorDate(start) || !validInspectorDate(end)) return 0
    return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000)
  }

  const defaultAnchor = validInspectorDate(view.today) ? view.today : initialFrom
  const [anchor, setAnchor] = useState(defaultAnchor)
  const [anchorInput, setAnchorInput] = useState(defaultAnchor)

  const [beforeDays, setBeforeDays] = useState(() => {
    if (validInspectorDate(initialFrom) && validInspectorDate(defaultAnchor) && initialFrom <= defaultAnchor) {
      return daysBetween(initialFrom, defaultAnchor)
    }
    return 0
  })

  const [afterDays, setAfterDays] = useState(() => {
    if (view.rangePreset !== 'custom') return inspectorDefaultAfterDays
    if (validInspectorDate(initialTo) && validInspectorDate(defaultAnchor) && initialTo >= defaultAnchor) {
      return daysBetween(defaultAnchor, initialTo)
    }
    return 0
  })

  function applyAnchor(newAnchor: string) {
    setAnchor(newAnchor)
    setAnchorInput(newAnchor)
    if (!validInspectorDate(newAnchor)) return
    const nextFrom = shiftInspectorDate(newAnchor, -beforeDays)
    const nextTo = shiftInspectorDate(newAnchor, afterDays)
    setFrom(nextFrom)
    setTo(nextTo)
    setFromMonth(nextFrom.slice(0, 7))
    setToMonth(nextTo.slice(0, 7))
    view.selectCustomRange(nextFrom, nextTo)
  }

  function applyBeforeDays(days: number) {
    const safeDays = Math.max(0, Math.min(3650, days))
    setBeforeDays(safeDays)
    if (!validInspectorDate(anchor)) return
    const nextFrom = shiftInspectorDate(anchor, -safeDays)
    setFrom(nextFrom)
    setFromMonth(nextFrom.slice(0, 7))
    const nextTo = shiftInspectorDate(anchor, afterDays)
    setTo(nextTo)
    setToMonth(nextTo.slice(0, 7))
    view.selectCustomRange(nextFrom, nextTo)
  }

  function applyAfterDays(days: number) {
    const safeDays = Math.max(0, Math.min(3650, days))
    setAfterDays(safeDays)
    if (!validInspectorDate(anchor)) return
    const nextTo = shiftInspectorDate(anchor, safeDays)
    setTo(nextTo)
    setToMonth(nextTo.slice(0, 7))
    const nextFrom = shiftInspectorDate(anchor, -beforeDays)
    setFrom(nextFrom)
    setFromMonth(nextFrom.slice(0, 7))
    view.selectCustomRange(nextFrom, nextTo)
  }

  function chooseFromDay(day: string) {
    const nextFrom = day
    let nextTo = to
    if (day > to) {
      nextTo = day
      setTo(nextTo)
      setToMonth(nextTo.slice(0, 7))
    }
    setFrom(nextFrom)
    if (validInspectorDate(anchor)) {
      if (day <= anchor) {
        setBeforeDays(daysBetween(day, anchor))
      } else {
        setAnchor(day)
        setAnchorInput(day)
        setBeforeDays(0)
        setAfterDays(Math.max(0, daysBetween(day, nextTo)))
      }
    }
    if (day > to) {
      view.selectCustomRange(nextFrom, nextTo)
    }
  }

  function chooseToDay(day: string) {
    const nextTo = day
    let nextFrom = from
    if (day < from) {
      nextFrom = day
      setFrom(nextFrom)
      setFromMonth(nextFrom.slice(0, 7))
    }
    setTo(nextTo)
    if (validInspectorDate(anchor)) {
      if (day >= anchor) {
        setAfterDays(daysBetween(anchor, day))
      } else {
        setAnchor(day)
        setAnchorInput(day)
        setAfterDays(0)
        setBeforeDays(Math.max(0, daysBetween(nextFrom, day)))
      }
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

  return { popup, position, closeAndFocus, from, to, anchorInput, setAnchorInput, anchor, applyAnchor, beforeDays, afterDays, applyBeforeDays, applyAfterDays, totalDays, fromMonth, toMonth, chooseFromDay, chooseToDay, setFromMonth, setToMonth, focusedDay, setFocusedDay, moveFocus, error }
}
