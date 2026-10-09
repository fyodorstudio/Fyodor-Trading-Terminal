import { useEffect, useRef, useState } from 'react'
import type { ExternalEvent } from '../core/external-event'
import { deleteExternalEvent, saveExternalEvent } from '../storage/external-event-store'
import { useDisplayClock } from '../../appearance/time-display/useDisplayClock'

export function ExternalEventManager({ events, initialId, defaults, symbol, brokerId, onClose, embedded = false }: {
  events: readonly ExternalEvent[]; initialId: string | null; defaults: { from: number; to: number }; symbol: string; brokerId: string; onClose?: () => void; embedded?: boolean
}) {
  const panel = useRef<HTMLDivElement>(null)
  const clock = useDisplayClock(), clockInput = clock.input, parseClockInput = clock.parse, displayClock = clock.chart
  const previousClock = useRef(clock)
  const blank = () => ({ id: null as string | null, title: '', note: '', from: clockInput(defaults.from), to: clockInput(defaults.to) })
  const fields = (e: ExternalEvent) => ({ id: e.id, title: e.title, note: e.note, from: clockInput(e.from), to: e.to === null ? '' : clockInput(e.to) })
  const [draft, setDraft] = useState(() => { const event = events.find(e => e.id === initialId); return event ? fields(event) : blank() })
  const [status, setStatus] = useState(''), [error, setError] = useState('')
  useEffect(() => {
    const old = previousClock.current
    if (old === clock) return
    previousClock.current = clock
    setDraft(current => {
      const from = old.parse(current.from), to = current.to ? old.parse(current.to) : null
      return { ...current, from: from === null ? current.from : clock.input(from), to: to === null ? current.to : clock.input(to) }
    })
  }, [clock])
  useEffect(() => {
    panel.current?.focus({ preventScroll: true })
    if (embedded) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose?.() } }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose, embedded])
  const selected = events.find(e => e.id === draft.id)
  return <div ref={panel} tabIndex={-1} role={embedded ? 'group' : 'dialog'} aria-label="Manual outside events" className={`external-event-manager${embedded ? ' embedded' : ''}`}>
    <header><strong>Outside events · Manual notes</strong>{onClose && <button type="button" aria-label={embedded ? 'Back to tool settings' : 'Close outside events'} onClick={onClose}>{embedded ? 'Back' : '×'}</button>}</header>
    <p>Gray highlights mark your notes and chosen window; they do not affect scores.</p>
    <small>{symbol} · {brokerId} · Enter dates in {clock.zone}. Notes may be added retrospectively.</small>
    <form onSubmit={e => {
      e.preventDefault(); setError(''); setStatus('')
      const from = parseClockInput(draft.from), to = draft.to ? parseClockInput(draft.to) : null
      if (from === null || (draft.to && to === null) || (to !== null && to <= from)) { setError('Choose valid chart dates, with the end after the start.'); return }
      try {
        const saved = saveExternalEvent({ brokerId, symbol, title: draft.title, note: draft.note, from, to }, draft.id ?? undefined)
        setDraft(fields(saved.event)); setStatus(saved.persisted ? 'Saved locally.' : 'Saved for this session only; browser storage is unavailable.')
      } catch (err) { setError(err instanceof Error ? err.message : 'Could not save the note.') }
    }}>
      <label>Event title<input required maxLength={160} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="An outside event you want to audit" /></label>
      <div className="external-event-dates"><label>Start · {clock.zone}<input required type="datetime-local" value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })} /></label>
        <label>End · blank means ongoing<input type="datetime-local" value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })} /></label></div>
      <label>Observation / source reference<textarea rows={3} maxLength={4000} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="What happened? What might our dataset be missing? Optional source reference." /></label>
      {selected && <small>Recorded {clock.utc(selected.createdAt)} ({clock.zone}) · Recording time is separate from the selected highlight window.</small>}
      <div className="external-event-actions"><button type="submit">{draft.id ? 'Save changes' : 'Save highlight'}</button>
        <button type="button" onClick={() => { setDraft(blank()); setStatus(''); setError('') }}>New highlight</button>
        {selected && <button type="button" onClick={() => { const persisted = deleteExternalEvent(selected.id); setDraft(blank()); setStatus(persisted ? 'Deleted.' : 'Deleted for this session only.'); setError('') }}>Delete highlight</button>}</div>
      {error && <p role="alert">{error}</p>}{status && <p role="status">{status}</p>}
    </form>
    <h3>Saved notes for this pair / broker</h3>
    {!events.length && <p>No outside events recorded yet.</p>}
    <div className="external-event-list">{[...events].reverse().map(event => <button type="button" key={event.id} onClick={() => { setDraft(fields(event)); setStatus(''); setError('') }}>
      <strong>{event.title}</strong><small>{displayClock(event.from)} → {event.to === null ? 'Ongoing' : displayClock(event.to)}</small></button>)}</div>
  </div>
}
