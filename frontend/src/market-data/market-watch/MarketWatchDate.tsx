import { memo, useEffect, useState } from 'react'
import { pepperstoneDay } from '../mt5-feed/use-daily-market-quotes'

function todayDate() {
  const day = pepperstoneDay(Date.now())
  return day == null ? new Date().toISOString().slice(0, 10) : new Date(day * 1000).toISOString().slice(0, 10)
}

export const MarketWatchDate = memo(function MarketWatchDate({ date, onChange }: {
  date: string | null; onChange: (date: string | null) => void
}) {
  const [today, setToday] = useState(todayDate)
  useEffect(() => {
    const timer = window.setInterval(() => setToday(todayDate()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const selected = date ?? today
  const changeDate = (value: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value) && value <= today) onChange(value === today ? null : value)
  }
  const step = (direction: number) => {
    const next = new Date(`${selected}T00:00:00Z`)
    next.setUTCDate(next.getUTCDate() + direction)
    changeDate(next.toISOString().slice(0, 10))
  }
  return <div className="market-watch-date" role="group" aria-label="Daily change date">
    <button type="button" aria-label="Previous day" onClick={() => step(-1)}>‹</button>
    <label className="market-watch-date-picker" title="Choose a broker daily candle date">
      <span>{new Date(`${selected}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })}</span>
      <input type="date" aria-label="Daily change date" value={selected} max={today}
        onChange={event => changeDate(event.target.value)} />
    </label>
    <button type="button" aria-label="Next day" disabled={selected >= today} onClick={() => step(1)}>›</button>
    <button type="button" className={`market-watch-date-status${date ? ' history' : ''}`}
      title={date ? 'Return to today’s live maximum changes' : 'Today’s live maximum changes'}
      aria-label="Return to today" onClick={() => onChange(null)}>{date ? 'History' : 'Today'}</button>
  </div>
})
