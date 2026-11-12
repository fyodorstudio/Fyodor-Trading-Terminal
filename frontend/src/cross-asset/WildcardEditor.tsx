import { useEffect, useRef, useState, type ReactNode } from 'react'
import { wildcardNotes, wildcardsMarkdown, type WildcardRow, type WildcardSnapshot } from './wildcards-model'
import { heatmapDate, type HeatmapMode } from './heatmap-model'

function WildcardDialog({ title, children, onClose, busy }: { title: string; children: ReactNode; onClose: () => void; busy: boolean }) {
  const dialog = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLElement>('input, textarea, button')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); if (!busy) onClose() }
      if (event.key === 'Tab') {
        const controls = [...dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)') ?? []]
        const first = controls[0], last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', keydown)
    return () => { window.removeEventListener('keydown', keydown); previous?.focus() }
  }, [onClose, busy])
  return <div className="heatmap-modal-backdrop" onMouseDown={event => { if (!busy && event.target === event.currentTarget) onClose() }}>
    <section ref={dialog} className="wildcard-editor" role="dialog" aria-modal="true" aria-label={title} aria-busy={busy}>
      <header><strong>{title}</strong><button type="button" disabled={busy} onClick={onClose} aria-label="Close Wildcards">×</button></header>
      {children}
    </section>
  </div>
}

type Save = (rows: WildcardRow[], revision: number) => Promise<void>

export function WildcardEditor({ snapshot, rowId, day, mode, onSave, onClose }: {
  snapshot: WildcardSnapshot; rowId?: string; day: string; mode: HeatmapMode; onSave: Save; onClose: () => void
}) {
  const row = snapshot.rows.find(item => item.id === rowId)
  const periodNotes = row ? wildcardNotes(row, day, mode) : []
  const [title, setTitle] = useState(''), [date, setDate] = useState(periodNotes[0]?.[0] ?? day)
  const [notes, setNotes] = useState<Record<string, string>>(() => ({ ...row?.notes }))
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function save() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '2015-01-01' || date > '2100-12-31' || !Number.isFinite(Date.parse(date)) || heatmapDate(Date.parse(date)) !== date) {
      setError('Choose a date between 2015 and 2100.'); return
    }
    if (!row && !title.trim()) { setError('Enter a wildcard title.'); return }
    if (!row && snapshot.rows.length >= 128) { setError('Maximum 128 rows, including archived rows. Export and remove old rows first.'); return }
    const next = { ...(row ?? { id: crypto.randomUUID().replaceAll('-', ''), title: title.trim(), archived: false }),
      notes: Object.fromEntries(Object.entries(notes).filter(([, text]) => text.trim())) } as WildcardRow
    setBusy(true); setError(null)
    try {
      await onSave(row ? snapshot.rows.map(item => item.id === row.id ? next : item) : [...snapshot.rows, next], snapshot.revision)
      if (mounted.current) onClose()
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not save the note.') }
    finally { if (mounted.current) setBusy(false) }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(`${row?.title ?? title}\n${date}\n\n${notes[date] ?? ''}`); if (mounted.current) setCopied(true) }
    catch { if (mounted.current) setError('Clipboard unavailable. Select and copy the details manually.') }
  }
  return <WildcardDialog title={row ? `Wildcard · ${row.title}` : 'Add wildcard'} onClose={onClose} busy={busy}>
    {row ? <p className="wildcard-story">Story: {row.title}<small>Rename or reorder stories in Manage Wildcards.</small></p>
      : <label>Title<input aria-label="Wildcard title" maxLength={120} value={title} disabled={busy} onChange={event => setTitle(event.target.value)} /></label>}
    {mode === 'weekly' && <div className="wildcard-week"><small>Week {day} – {heatmapDate(Date.parse(day) + 6 * 86400_000)} · notes keep their own dates</small>
      {periodNotes.map(([noteDay]) => <button type="button" key={noteDay} disabled={busy} aria-pressed={date === noteDay} onClick={() => { setDate(noteDay); setCopied(false) }}>{noteDay}</button>)}</div>}
    <label>Date<input aria-label="Wildcard note date" type="date" min="2015-01-01" max="2100-12-31" value={date} disabled={busy}
      onChange={event => { if (event.target.value) { setDate(event.target.value); setCopied(false) } }} /></label>
    <label className="wildcard-details">Details<textarea aria-label="Wildcard details" rows={10} maxLength={20000} value={notes[date] ?? ''} disabled={busy}
      placeholder="Write your research, paragraphs and source links…" onChange={event => { setNotes(old => ({ ...old, [date]: event.target.value })); setCopied(false) }} /></label>
    <small>Blank details remove that date’s note when saved. Other dates stay intact.</small>
    {error && <p role="alert">{error}</p>}{copied && <small role="status">Note copied.</small>}
    <footer><button type="button" disabled={busy || !(notes[date] ?? '').trim()} onClick={() => void copy()}>Copy note</button>
      <button type="button" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button><button type="button" disabled={busy} onClick={onClose}>Cancel</button></footer>
  </WildcardDialog>
}

export function WildcardManager({ snapshot, onSave, onClose }: { snapshot: WildcardSnapshot; onSave: Save; onClose: () => void }) {
  const [rows, setRows] = useState(() => snapshot.rows.map(row => ({ ...row })))
  const [remove, setRemove] = useState<string | null>(null), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  function move(index: number, step: number) {
    setRows(old => { const next = [...old]; [next[index], next[index + step]] = [next[index + step], next[index]]; return next })
  }
  async function save() {
    if (rows.some(row => !row.title.trim())) { setError('Every story needs a title.'); return }
    setBusy(true); setError(null)
    try { await onSave(rows, snapshot.revision); if (mounted.current) onClose() }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not save Wildcards.') }
    finally { if (mounted.current) setBusy(false) }
  }
  function exportNotes() {
    const url = URL.createObjectURL(new Blob([wildcardsMarkdown(snapshot.rows)], { type: 'text/markdown;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'wildcards.md'; anchor.click(); URL.revokeObjectURL(url)
  }
  return <WildcardDialog title="Manage Wildcards" onClose={onClose} busy={busy}>
    <p>Rename and reorder stories. Archive hides a row while preserving its dated notes. Changes apply after Save.</p>
    <div className="wildcard-manage-list">{rows.map((row, index) => <section key={row.id} className="wildcard-manage-row">
      <input aria-label={`Rename wildcard ${row.title}`} value={row.title} maxLength={120} disabled={busy} onChange={event => setRows(old => old.map(item => item.id === row.id ? { ...item, title: event.target.value } : item))} />
      <small>{Object.keys(row.notes).length} notes{row.archived ? ' · Archived' : ''}</small>
      <div><button type="button" aria-label={`Move wildcard ${row.title} up`} disabled={busy || index === 0} onClick={() => move(index, -1)}>↑</button>
        <button type="button" aria-label={`Move wildcard ${row.title} down`} disabled={busy || index === rows.length - 1} onClick={() => move(index, 1)}>↓</button>
        <button type="button" disabled={busy} onClick={() => setRows(old => old.map(item => item.id === row.id ? { ...item, archived: !item.archived } : item))}>{row.archived ? 'Restore' : 'Archive'}</button>
        <button type="button" disabled={busy} aria-label={`Delete wildcard ${row.title}`} onClick={() => setRemove(row.id)}>Delete…</button></div>
      {remove === row.id && <div className="wildcard-delete"><p>Delete “{row.title}” and all {Object.keys(row.notes).length} dated notes? This takes effect after Save.</p>
        <button type="button" disabled={busy} onClick={() => { setRows(old => old.filter(item => item.id !== row.id)); setRemove(null) }}>Delete row and all its notes</button>
        <button type="button" disabled={busy} onClick={() => setRemove(null)}>Keep row</button></div>}
    </section>)}{!rows.length && <p>No wildcard rows yet. Use + in the Wildcards section to add one.</p>}</div>
    {error && <p role="alert">{error}</p>}
    <footer><button type="button" disabled={!snapshot.rows.length || busy} onClick={exportNotes}>Export saved notes (.md)</button>
      <button type="button" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button><button type="button" disabled={busy} onClick={onClose}>Cancel</button></footer>
  </WildcardDialog>
}
