import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useWildcards } from './useWildcards'
import { wildcardDay, wildcardLocalTime, type WildcardDraft } from './wildcard-model'

export function WildcardDialog() {
  const { editor, close, saving, mutate, openEntry, openNew } = useWildcards()
  const list = editor && 'items' in editor ? editor : null
  const source = editor && !('items' in editor) ? editor : null
  const [draft, setDraft] = useState<WildcardDraft>(() => source?.entry ?? { date: source?.date ?? wildcardDay(Date.now()),
    at: source?.at !== undefined ? new Date(source.at).toISOString() : null, title: '', details: '', url: '', archived: false })
  const [time, setTime] = useState(() => draft.at ? wildcardLocalTime(Date.parse(draft.at)) : '')
  const [error, setError] = useState(''), [deleting, setDeleting] = useState(false)
  const dialog = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLElement>('input, button')?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [])
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.stopPropagation(); if (!saving) close() }
    if (event.key !== 'Tab') return
    const elements = [...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]')]
    const first = elements[0], last = elements.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    try { await mutate({ ...draft, at: time ? new Date(`${draft.date}T${time}+07:00`).toISOString() : null }, source?.entry?.id) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save Wildcard') }
  }
  async function remove() {
    try { await mutate(null, source!.entry!.id) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete Wildcard') }
  }
  return <div className="wildcards-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) close() }}>
    <section ref={dialog} className="wildcards-dialog" role="dialog" aria-modal="true" aria-label={list ? `Wildcards · ${list.date}` : source?.entry ? 'Edit wildcard' : 'Add wildcard'} onKeyDown={keydown}>
      <header><strong>{list ? `Wildcards · ${list.date}` : source?.entry ? 'Edit wildcard' : 'Add wildcard'}</strong><button type="button" disabled={saving} onClick={close} aria-label="Close Wildcard">×</button></header>
      {list ? <><div className="wildcards-list">{list.items.map(entry => <button type="button" key={entry.id} onClick={() => openEntry(entry)}><strong>{entry.title}</strong><span>{entry.at ? wildcardLocalTime(Date.parse(entry.at)) : 'Date only'}</span><p>{entry.details}</p></button>)}{!list.items.length && <p>No wildcards for this period.</p>}</div>
        <footer><button type="button" onClick={() => openNew(undefined, list.date)}>Add wildcard</button><button type="button" onClick={close}>Close</button></footer></>
        : <form onSubmit={submit}><div className="wildcards-fields"><label>Date<input aria-label="Wildcard date" type="date" min="2015-01-01" max="2100-12-31" required disabled={saving} value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })} /></label>
          <label>Time · Jakarta (optional)<input aria-label="Wildcard time" type="time" step="1" disabled={saving} value={time} onChange={event => setTime(event.target.value)} /></label>
          <label className="wildcards-wide">Title<input aria-label="Wildcard title" maxLength={300} required disabled={saving} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
          <label className="wildcards-wide">Details<textarea aria-label="Wildcard details" maxLength={20000} rows={7} disabled={saving} value={draft.details} onChange={event => setDraft({ ...draft, details: event.target.value })} /></label>
          <label className="wildcards-wide">Source URL (optional)<input aria-label="Wildcard source URL" type="url" maxLength={2000} disabled={saving} value={draft.url} onChange={event => setDraft({ ...draft, url: event.target.value })} /></label>
          <label className="wildcards-wide"><span>Archived <input type="checkbox" disabled={saving} checked={draft.archived} onChange={event => setDraft({ ...draft, archived: event.target.checked })} /></span></label></div>
          {error && <p role="alert">{error}</p>}
          {deleting && <p>Delete this wildcard everywhere? <button type="button" disabled={saving} onClick={() => void remove()}>Confirm delete</button></p>}
          <footer>{source?.entry && <button type="button" disabled={saving} onClick={() => setDeleting(value => !value)}>Delete…</button>}<span /><button type="button" disabled={saving} onClick={close}>Cancel</button><button type="submit" disabled={saving || !draft.title.trim()}>{saving ? 'Saving…' : 'Save'}</button></footer>
        </form>}
    </section>
  </div>
}
