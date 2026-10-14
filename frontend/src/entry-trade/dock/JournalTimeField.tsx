import { useState } from 'react'
import { displayClockInput, parseDisplayClockInput } from '../../appearance/time-display/display-clock-input'
const jakarta = { mode: 'fixed-offset' as const, utcOffsetMinutes: 420 }
function parts(value: number | null) {
  if (value == null) return { date: '', time: '', period: 'PM' }
  const local = displayClockInput(value, jakarta)
  const hour = Number(local.slice(11, 13))
  return { date: local.slice(0, 10), time: `${String(hour % 12 || 12).padStart(2, '0')}:${local.slice(14, 16)}`, period: hour >= 12 ? 'PM' : 'AM' }
}
export function JournalTimeField({ id, label, value, onChange }: { id: string; label: string; value: number | null; onChange: (value: number | null) => void }) {
  const [previous, setPrevious] = useState(value)
  const [draft, setDraft] = useState(() => parts(value))
  const [error, setError] = useState(false)
  if (previous !== value) { setPrevious(value); setDraft(parts(value)); setError(false) }
  const commit = (next: typeof draft) => {
    if (value != null && JSON.stringify(parts(value)) === JSON.stringify(next)) { setError(false); return }
    if (!next.date && !next.time) { onChange(null); setError(false); return }
    const match = /^(\d{1,2}):(\d{2})$/.exec(next.time)
    const hour = match ? Number(match[1]) : 0, minute = match ? Number(match[2]) : 60
    if (!next.date || hour < 1 || hour > 12 || minute > 59) { setError(true); return }
    const hour24 = hour % 12 + (next.period === 'PM' ? 12 : 0)
    const utc = parseDisplayClockInput(`${next.date}T${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, jakarta)
    if (utc == null) { setError(true); return }
    onChange(utc); setError(false)
  }
  return <div className="journal-time-field">
    <label htmlFor={`${id}-date`}>{label}</label>
    <div className="journal-time-controls">
      <input id={`${id}-date`} type="date" aria-label={`${label} date`} value={draft.date}
        onChange={event => { const next = { ...draft, date: event.target.value }; setDraft(next); if (next.date && next.time) commit(next); else if (!next.date) { setDraft(parts(null)); onChange(null) } }} />
      <input id={`${id}-time`} type="text" inputMode="numeric" placeholder="hh:mm" aria-label={`${label} time`} value={draft.time}
        onChange={event => { setDraft({ ...draft, time: event.target.value }); setError(false) }} onBlur={() => commit(draft)}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit(draft) } }} />
      <select aria-label={`${label} AM or PM`} value={draft.period} onChange={event => { const next = { ...draft, period: event.target.value }; setDraft(next); if (next.date && next.time) commit(next) }}>
        <option>AM</option><option>PM</option>
      </select>
    </div>
    {error && <span role="alert">Enter a date and time such as 07:30 PM.</span>}
  </div>
}
