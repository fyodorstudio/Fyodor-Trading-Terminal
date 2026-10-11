import { shiftInspectorDate, shiftInspectorMonth } from '../inspector-date-range'
import type { useRangePopover } from './useRangePopover'

const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const monthNames = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat(undefined, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, month, 1))))

export function CalendarMonth({ shown, roleLabel, selectedDay, onChoose, onShiftMonth, which, state, today }: {
  shown: string; roleLabel: 'From' | 'To'; selectedDay: string; onChoose: (day: string) => void
  onShiftMonth: (delta: number) => void; which: 'from' | 'to'; state: ReturnType<typeof useRangePopover>; today: string
}) {
  const { focusedDay, from, to, anchor, setFocusedDay, moveFocus } = state
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
                        title={day === anchor ? `${day} (Anchor)` : undefined}
                        aria-current={day === today ? 'date' : undefined}
                        className={`${day === from || day === to ? 'range-endpoint' : ''}${day >= from && day <= to ? ' in-range' : ''}${day === anchor && day !== from && day !== to ? ' anchor-date' : ''}`}
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
