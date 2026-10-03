import { useState } from 'react'
import { eventFamilyOptions, sixEventFamilies, type FamilyWatchlist } from './timeline-event-families'
import { eventSymbols, type EventSymbol } from './timeline-event-view'
import type { TimelineEventAnnotations } from './useTimelineEventAnnotations'

export function TimelineFamilyPicker({ view, close }: { view: TimelineEventAnnotations; close: () => void }) {
  const [draft, setDraft] = useState<FamilyWatchlist>(view.watchlist)
  const [mode, setMode] = useState<'six' | 'custom' | 'all'>(() => view.watchlist === null ? 'all' :
    view.watchlist.length === sixEventFamilies.length && sixEventFamilies.every((id) => view.watchlist!.includes(id)) ? 'six' : 'custom')
  const [symbols, setSymbols] = useState<Record<string, EventSymbol>>(() => Object.fromEntries(eventFamilyOptions.map((option) =>
    [option.id, view.familySymbols[option.id] ?? view.familySymbols[view.windowGroups.find((group) => group.familyId === option.id)?.family ?? ''] ?? option.symbol])))
  const count = view.windowGroups.filter((group) => draft === null || group.familyId && draft.includes(group.familyId)).length
  function apply(mark: boolean) { view.applyFamilies(draft, symbols, mark); close() }
  return <>
    <div className="timeline-popover-heading"><strong>Event families</strong><button type="button" onClick={close} aria-label="Close event families">×</button></div>
    <div className="timeline-family-presets" role="group" aria-label="Family presets">
      <button type="button" aria-pressed={mode === 'six'} onClick={() => { setDraft([...sixEventFamilies]); setMode('six') }}>Your six</button>
      <button type="button" aria-pressed={mode === 'custom'} onClick={() => { setDraft(draft ?? [...sixEventFamilies]); setMode('custom') }}>Custom</button>
      <button type="button" aria-pressed={mode === 'all'} onClick={() => { setDraft(null); setMode('all') }}>All events</button>
    </div>
    <p className="timeline-symbol-help">Same-time readings share a release. Decisions, press conferences and minutes keep their own times.</p>
    <div className="timeline-family-list">
      {eventFamilyOptions.map((option, index) => <div key={option.id} className={`timeline-family-option${index === 6 ? ' timeline-family-extras' : ''}`}>
        <label><input type="checkbox" aria-label={option.label} checked={draft === null || draft.includes(option.id)}
          onChange={(event) => {
            const current = draft ?? eventFamilyOptions.map((family) => family.id)
            setMode('custom')
            setDraft(event.target.checked ? [...new Set([...current, option.id])] : current.filter((id) => id !== option.id))
          }} /><span>{option.label}<small>{view.windowGroups.filter((group) => group.familyId === option.id).length} releases in window</small></span></label>
        <select aria-label={`Family symbol for ${option.label}`} value={symbols[option.id]}
          onChange={(event) => setSymbols({ ...symbols, [option.id]: event.target.value as EventSymbol })}>
          {eventSymbols.map(([id, glyph, name]) => <option key={id} value={id}>{glyph} {name}</option>)}
        </select>
      </div>)}
    </div>
    <p className="timeline-symbol-help">{count} of {view.windowGroups.length} surrounding releases. All events also includes families outside this list.</p>
    <div className="timeline-family-actions">
      <button type="button" onClick={() => apply(false)}>Apply</button>
      <button type="button" className="primary" disabled={!view.auditBars || !count} onClick={() => apply(true)}>Apply &amp; mark releases</button>
    </div>
    <p className="timeline-symbol-help">Apply changes the list only. Mark adds timed releases in this window; existing symbols stay selected. Symbols identify events, not importance or trade direction.</p>
  </>
}
