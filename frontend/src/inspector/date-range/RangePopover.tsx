import { createPortal } from 'react-dom'
import { inspectorRangePresets, shiftInspectorMonth, validInspectorDate } from '../inspector-date-range'
import type { InspectorView } from '../useInspector'
import { useRangePopover } from './useRangePopover'
import { CalendarMonth } from './CalendarMonth'

export function RangePopover(props: { view: InspectorView; trigger: React.RefObject<HTMLButtonElement | null>; onClose: () => void; id: string; filtersOpen: boolean }) {
  const { view, id } = props
  const state = useRangePopover(props)
  const { popup, position, closeAndFocus, from, to, anchorInput, setAnchorInput, anchor, applyAnchor, beforeDays, afterDays, applyBeforeDays, applyAfterDays, totalDays, fromMonth, toMonth, chooseFromDay, chooseToDay, setFromMonth, setToMonth, error } = state
  return createPortal(
    <div ref={popup} id={id} role="dialog" aria-label="Inspector date range picker" className="inspector-date-popover" data-compact={position.width < 620} style={position}>
      <header>
        <strong>Date range</strong>
        <span>Display time · End date included</span>
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
          <div className="inspector-range-controls-row">
            <div className="inspector-anchor-group">
              <label htmlFor="inspector-anchor-input">Anchor:</label>
              <div className="inspector-anchor-input-wrapper">
                <input
                  id="inspector-anchor-input"
                  type="text"
                  aria-label="Anchor date (YYYY-MM-DD)"
                  value={anchorInput}
                  onChange={(e) => {
                    const val = e.target.value
                    setAnchorInput(val)
                    if (validInspectorDate(val)) applyAnchor(val)
                  }}
                  onBlur={() => {
                    if (!validInspectorDate(anchorInput)) setAnchorInput(anchor)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (validInspectorDate(anchorInput)) applyAnchor(anchorInput)
                      else setAnchorInput(anchor)
                    }
                  }}
                  placeholder="YYYY-MM-DD"
                  pattern="\d{4}-\d{2}-\d{2}"
                />
              </div>
              <button
                type="button"
                className="inspector-anchor-today-btn"
                aria-label="Set anchor date to today"
                aria-pressed={anchor === view.today}
                onClick={() => applyAnchor(view.today)}
                title={`Set anchor to today (${view.today})`}
              >
                Today
              </button>
            </div>
            <div className="inspector-offsets-group">
              <div className="inspector-offset-control">
                <label htmlFor="inspector-before-days-input">Before:</label>
                <div className="inspector-offset-input-wrapper">
                  <span>-</span>
                  <input
                    id="inspector-before-days-input"
                    type="number"
                    min="0"
                    max="3650"
                    aria-label="Days before anchor date"
                    value={beforeDays}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (!Number.isNaN(val) && val >= 0) applyBeforeDays(val)
                    }}
                  />
                  <span>{beforeDays === 1 ? 'day' : 'days'}</span>
                </div>
              </div>
              <div className="inspector-offset-control">
                <label htmlFor="inspector-after-days-input">After:</label>
                <div className="inspector-offset-input-wrapper">
                  <span>+</span>
                  <input
                    id="inspector-after-days-input"
                    type="number"
                    min="0"
                    max="3650"
                    aria-label="Days after anchor date"
                    value={afterDays}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (!Number.isNaN(val) && val >= 0) applyAfterDays(val)
                    }}
                  />
                  <span>{afterDays === 1 ? 'day' : 'days'}</span>
                </div>
              </div>
            </div>
            <div className="inspector-range-total-badge">
              <strong>{totalDays}</strong> {totalDays === 1 ? 'day' : 'days'} total
            </div>
          </div>
          <div className="inspector-calendar-months">
            <CalendarMonth shown={fromMonth} roleLabel="From" selectedDay={from} onChoose={chooseFromDay} onShiftMonth={delta => setFromMonth(m => shiftInspectorMonth(m, delta))} which="from" state={state} today={view.today} />
            <CalendarMonth shown={toMonth} roleLabel="To" selectedDay={to} onChoose={chooseToDay} onShiftMonth={delta => setToMonth(m => shiftInspectorMonth(m, delta))} which="to" state={state} today={view.today} />
          </div>
          <p className="inspector-date-help" role={error ? 'alert' : 'status'}>
            {error ?? `Anchor: ${anchor} · From: ${from} (-${beforeDays}d) · To: ${to} (+${afterDays}d) · ${totalDays} ${totalDays === 1 ? 'day' : 'days'} total`}
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
