import { useEffect, useRef, useState } from 'react'
import { clockInput, parseClockInput, type ExternalEvent } from '../core/external-event'
import { deleteExternalEvent, saveExternalEvent } from '../storage/external-event-store'
import { brokerClock } from '../../raycaster/ribbon/broker-clock'

export function ExternalEventManager({ events, initialId, defaults, symbol, brokerId, onClose }: {
  events: readonly ExternalEvent[]; initialId: string | null; defaults: { from: number; to: number }; symbol: string; brokerId: string; onClose: () => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  const blank = () => ({ id: null as string | null, title: '', note: '', from: clockInput(defaults.from), to: clockInput(defaults.to) })
  const fields = (e: ExternalEvent) => ({ id: e.id, title: e.title, note: e.note, from: clockInput(e.from), to: e.to === null ? '' : clockInput(e.to) })
  const [draft, setDraft] = useState(() => { const event = events.find(e => e.id === initialId); return event ? fields(event) : blank() })
  const [status, setStatus] = useState(''), [error, setError] = useState('')
  useEffect(() => {
    panel.current?.focus({ preventScroll: true })
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])
  const selected = events.find(e => e.id === draft.id)
  return <div ref={panel} tabIndex={-1} role="dialog" aria-label="Manual outside events" className="external-event-manager">
    <header><strong>Outside events · Manual notes</strong><button type="button" aria-label="Close outside events" onClick={onClose}>×</button></header>
    <p>Gray highlights flag context outside the dataset. Your selected window is an annotation, not a measured impact period or a directional vote. These notes never change Candy or scoring.</p>
    <small>{symbol} · {brokerId} · Enter dates in broker chart time. Notes may be added retrospectively.</small>
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
      <div className="external-event-dates"><label>Start · broker time<input required type="datetime-local" value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })} /></label>
        <label>End · blank means ongoing<input type="datetime-local" value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })} /></label></div>
      <label>Observation / source reference<textarea rows={3} maxLength={4000} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="What happened? What might our dataset be missing? Optional source reference." /></label>
      {selected && <small>Recorded {new Date(selected.createdAt).toISOString().slice(0, 19).replace('T', ' ')} UTC · Recording time is separate from the selected broker-time window.</small>}
      <div className="external-event-actions"><button type="submit">{draft.id ? 'Save changes' : 'Save highlight'}</button>
        <button type="button" onClick={() => { setDraft(blank()); setStatus(''); setError('') }}>New highlight</button>
        {selected && <button type="button" onClick={() => { const persisted = deleteExternalEvent(selected.id); setDraft(blank()); setStatus(persisted ? 'Deleted.' : 'Deleted for this session only.'); setError('') }}>Delete highlight</button>}</div>
      {error && <p role="alert">{error}</p>}{status && <p role="status">{status}</p>}
    </form>
    <h3>Saved notes for this pair / broker</h3>
    {!events.length && <p>No outside events recorded yet.</p>}
    <div className="external-event-list">{[...events].reverse().map(event => <button type="button" key={event.id} onClick={() => { setDraft(fields(event)); setStatus(''); setError('') }}>
      <strong>{event.title}</strong><small>{brokerClock(event.from)} → {event.to === null ? 'Ongoing' : brokerClock(event.to)}</small></button>)}</div>
  </div>
}
