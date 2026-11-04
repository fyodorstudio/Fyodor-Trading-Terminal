import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { jakartaDate, moveDate } from '../model/alert-day-model'
import './alert-date-selector.css'

function useRevolverWheel(ref: RefObject<HTMLDivElement | null>, onMove: (offset: number) => void) {
  useEffect(() => {
    let frame = 0, delta = 0
    const element = ref.current
    const scroll = (event: WheelEvent) => {
      event.preventDefault(); delta += event.deltaX || event.deltaY
      if (!frame) frame = window.requestAnimationFrame(() => {
        if (Math.abs(delta) > 8) { onMove(delta > 0 ? 1 : -1); delta = 0 }
        frame = 0
      })
    }
    element?.addEventListener('wheel', scroll, { passive: false })
    return () => { element?.removeEventListener('wheel', scroll); window.cancelAnimationFrame(frame) }
  }, [ref, onMove])
}

function monthDate(date: string, offset: number) {
  const [year, month, day] = date.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + offset, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, last))
  return target.toISOString().slice(0, 10)
}

export function AlertDateSelector({ date, onChange, label = 'Alert' }: { date: string; onChange: (date: string) => void; label?: string }) {
  const wheel = useRef<HTMLDivElement>(null), monthWheel = useRef<HTMLDivElement>(null)
  const moveDay = useCallback((offset: number) => onChange(moveDate(date, offset)), [date, onChange])
  const moveMonth = useCallback((offset: number) => onChange(monthDate(date, offset)), [date, onChange])
  useRevolverWheel(wheel, moveDay)
  useRevolverWheel(monthWheel, moveMonth)
  const [year, month, day] = date.split('-').map(Number)
  const jumpYear = (nextYear: number) => {
    const lastDay = new Date(Date.UTC(nextYear, month, 0)).getUTCDate()
    onChange(`${nextYear}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`)
  }
  return <div className="alert-date-selector">
    <div ref={wheel} className="alert-date-wheel" role="group" aria-label={`${label} date selector`}>
      <button type="button" aria-label="Previous date" onClick={() => moveDay(-1)}>‹</button>
      {[-2, -1, 0, 1, 2].map(offset => { const value = moveDate(date, offset); return <button key={value} type="button"
        aria-label={value} aria-pressed={offset === 0} aria-current={offset === 0 ? 'date' : undefined} onClick={() => onChange(value)}>
        <small>{new Date(`${value}T00:00:00Z`).toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' })}</small>{Number(value.slice(-2))}
      </button> })}
      <button type="button" aria-label="Next date" onClick={() => moveDay(1)}>›</button>
    </div>
    <div ref={monthWheel} className="alert-month-wheel" role="group" aria-label={`${label} month selector`}>
      <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>‹</button>
      {[-1, 0, 1].map(offset => { const value = monthDate(date, offset); return <button key={value.slice(0, 7)} type="button"
        aria-label={value.slice(0, 7)} aria-pressed={offset === 0} onClick={() => onChange(value)}>
        {new Date(`${value}T00:00:00Z`).toLocaleDateString('en', { month: 'short', timeZone: 'UTC' }).toUpperCase()}
      </button> })}
      <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>›</button>
    </div>
    <input type="number" aria-label={`${label} year`} min="2015" max="2100" value={year} onChange={event => {
      const value = Number(event.target.value); if (Number.isInteger(value) && value >= 2015 && value <= 2100) jumpYear(value)
    }} />
    <button type="button" onClick={() => onChange(jakartaDate(Date.now()))}>Today</button>
  </div>
}
