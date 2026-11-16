import { useEffect, useRef, useState, type FormEvent } from 'react'
import { exportNews } from './useNewsFlow'

export function NewsCopy({ query, enabled = true, id = 'news-copy' }: { query: string; enabled?: boolean; id?: string }) {
  const params = new URLSearchParams(query)
  for (const name of ['start', 'end', 'order', 'offset', 'limit']) params.delete(name)
  // Changing a provider/filter cancels the old request and clears its result.
  return <CopyControl key={params.toString()} scope={params.toString()} enabled={enabled} id={id} />
}

function CopyControl({ scope, enabled, id }: { scope: string; enabled: boolean; id: string }) {
  const [open, setOpen] = useState(false), [amount, setAmount] = useState('1'), [unit, setUnit] = useState('hours')
  const [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState(''), [fallback, setFallback] = useState('')
  const container = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), request = useRef<AbortController | null>(null)
  const max = unit === 'hours' ? 87600 : 3650
  const valid = Number.isInteger(Number(amount)) && Number(amount) >= 1 && Number(amount) <= max
  function close() { request.current?.abort(); setBusy(false); setOpen(false) }
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (!open) return
    container.current?.querySelector<HTMLInputElement>('input')?.focus()
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) close() }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  function reset() { setStatus(''); setError(''); setFallback('') }
  async function copy(event: FormEvent) {
    event.preventDefault()
    if (!valid || busy) return
    const controller = new AbortController(); request.current = controller
    setBusy(true); reset()
    try {
      const query = new URLSearchParams(scope); query.set('amount', amount); query.set('unit', unit)
      const result = await exportNews(query.toString(), controller.signal)
      if (controller.signal.aborted) return
      if (!result.count) { setStatus('No collected headlines match this range and filters.'); return }
      // Retain a selectable fallback if the browser denies clipboard access.
      setFallback(result.text)
      try { await navigator.clipboard.writeText(result.text) }
      catch { throw new Error('Clipboard unavailable. Select the text below and copy it manually.') }
      if (!controller.signal.aborted) { setStatus(`Copied ${result.count} headline${result.count === 1 ? '' : 's'} and links.`); setFallback('') }
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not copy headlines.') }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  return <div className="news-copy" ref={container} onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) close()
  }} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.stopPropagation(); close(); trigger.current?.focus() }
  }}>
    <button ref={trigger} type="button" aria-label="Copy news headlines" title="Copy headlines and links" aria-expanded={open} aria-controls={id} disabled={!enabled} onClick={() => { if (open) close(); else { reset(); setOpen(true) } }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>
    </button>
    {open && <div id={id} className="news-copy-options" role="group" aria-label="Copy headline range">
      <form onSubmit={event => void copy(event)}>
        <strong>Copy headlines and links</strong>
        <div className="news-copy-range"><label>Last<input aria-label="Copy range amount" type="number" min="1" max={max} step="1" required value={amount} disabled={busy} onChange={event => { setAmount(event.target.value); reset() }} /></label>
          <label>Unit<select aria-label="Copy range unit" value={unit} disabled={busy} onChange={event => { setUnit(event.target.value); reset() }}><option value="hours">Hours</option><option value="days">Days</option></select></label></div>
        <p>Ending now. Uses this view’s provider and headline filters, across all pages. Copies collected headlines only; the calendar date is ignored.</p>
        <button type="submit" aria-label="Copy selected news range" disabled={busy || !valid}>{busy ? 'Copying…' : 'Copy'}</button>
      </form>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
      {fallback && <textarea aria-label="Headlines to copy manually" readOnly value={fallback} onFocus={event => event.target.select()} />}
    </div>}
  </div>
}
