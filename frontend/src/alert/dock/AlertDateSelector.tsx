import { useEffect, useRef } from 'react'
import { jakartaDate, moveDate } from '../model/alert-day-model'

export function AlertDateSelector({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  const wheel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let frame = 0, delta = 0
    const element = wheel.current
    const scroll = (event: WheelEvent) => {
      event.preventDefault(); delta += event.deltaX || event.deltaY
      if (!frame) frame = window.requestAnimationFrame(() => {
        if (Math.abs(delta) > 8) { onChange(moveDate(date, delta > 0 ? 1 : -1)); delta = 0 }
        frame = 0
      })
    }
    element?.addEventListener('wheel', scroll, { passive: false })
    return () => { element?.removeEventListener('wheel', scroll); window.cancelAnimationFrame(frame) }
  }, [date, onChange])
  const [year, month, day] = date.split('-').map(Number)
  const jump = (nextYear: number, nextMonth: number) => {
    const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate()
    onChange(`${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`)
  }
  return <div className="alert-date-selector">
    <div ref={wheel} className="alert-date-wheel" role="group" aria-label="Alert date selector">
      <button aria-label="Previous date" onClick={() => onChange(moveDate(date, -1))}>‹</button>
      {[-2, -1, 0, 1, 2].map(offset => { const value = moveDate(date, offset); return <button key={value} type="button"
        aria-label={value} aria-pressed={offset === 0} aria-current={offset === 0 ? 'date' : undefined} onClick={() => onChange(value)}>
        <small>{new Date(`${value}T00:00:00Z`).toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' })}</small>{Number(value.slice(-2))}
      </button> })}
      <button aria-label="Next date" onClick={() => onChange(moveDate(date, 1))}>›</button>
    </div>
    <select aria-label="Alert month" value={month} onChange={event => jump(year, Number(event.target.value))}>
      {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Date(Date.UTC(2000, i, 1)).toLocaleDateString('en', { month: 'short', timeZone: 'UTC' }).toUpperCase()}</option>)}
    </select>
    <input type="number" aria-label="Alert year" min="2015" max="2100" value={year} onChange={event => {
      const value = Number(event.target.value); if (Number.isInteger(value) && value >= 2015 && value <= 2100) jump(value, month)
    }} />
    <button type="button" onClick={() => onChange(jakartaDate(Date.now()))}>Today</button>
  </div>
}
