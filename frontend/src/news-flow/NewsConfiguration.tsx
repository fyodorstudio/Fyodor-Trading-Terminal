import { useEffect, useRef, useState, type FormEvent } from 'react'
import { type NewsSettings, type NewsSource } from './model'
import { saveNewsSource } from './useNewsFlow'

export function NewsConfiguration({ sources, settings, onChange, onSaved, onClose }: {
  sources: NewsSource[]; settings: NewsSettings; onChange: (value: NewsSettings) => void; onSaved: () => void; onClose: () => void
}) {
  const [index, setIndex] = useState(0), [adding, setAdding] = useState(false)
  const source = adding ? undefined : sources[Math.min(index, sources.length - 1)]
  const activeId = source?.id ?? 'new'
  const [draft, setDraft] = useState<{ id: string; name: string; url: string } | null>(null)
  const { name, url } = draft?.id === activeId ? draft : { name: source?.name ?? '', url: source?.url ?? '' }
  const [saving, setSaving] = useState(false), [error, setError] = useState('')
  const dialog = useRef<HTMLDivElement>(null), request = useRef<AbortController | null>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLElement>('button, input')?.focus()
    const outside = (event: PointerEvent) => {
      if (!dialog.current?.contains(event.target as Node) && !(event.target as Element).closest?.('[aria-controls="news-configuration"]')) onClose()
    }
    document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('pointerdown', outside); request.current?.abort(); if (previous?.isConnected) previous.focus() }
  }, [onClose])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    const controller = new AbortController(); request.current = controller
    setSaving(true); setError('')
    try {
      await saveNewsSource(name.trim(), url.trim(), source?.id, controller.signal)
      if (!controller.signal.aborted) { onSaved(); if (adding) setIndex(sources.length); setAdding(false) }
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not save provider') }
    finally { if (!controller.signal.aborted) setSaving(false) }
  }
  return <div ref={dialog} id="news-configuration" className="news-configuration" role="dialog" aria-label="News Flow configuration"
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <header><strong>Configure News Flow</strong><button type="button" aria-label="Close news configuration" onClick={onClose}>×</button></header>
    <nav aria-label="News providers">
      <button type="button" aria-label="Previous provider" disabled={saving || (!adding && index <= 0)} onClick={() => { setAdding(false); setIndex(Math.max(0, index - 1)) }}>←</button>
      <strong>{adding ? 'New provider' : source?.name ?? 'Providers'}</strong>
      <button type="button" aria-label="Next provider" disabled={saving || adding || index >= sources.length - 1} onClick={() => setIndex(index + 1)}>→</button>
      <button type="button" aria-label="Add provider" disabled={saving || adding} onClick={() => { setAdding(true); setDraft(null); setError('') }}>+</button>
    </nav>
    <form onSubmit={submit}>
      <label>Name<input aria-label="Provider name" required maxLength={100} disabled={saving} value={name} onChange={event => setDraft({ id: activeId, name: event.target.value, url })} /></label>
      <label>Feed URL<input aria-label="Provider feed URL" type="url" required maxLength={2000} disabled={saving} value={url} onChange={event => setDraft({ id: activeId, name, url: event.target.value })} placeholder="https://…" /></label>
      <button type="submit" disabled={saving || !name.trim() || !url.trim()}>{saving ? 'Saving…' : adding ? 'Add provider' : 'Save provider'}</button>
      {source && <label className="news-checkbox"><input type="checkbox" checked={!settings.hiddenSources.includes(source.id)} onChange={event => onChange({ ...settings,
        hiddenSources: event.target.checked ? settings.hiddenSources.filter(id => id !== source.id) : [...settings.hiddenSources, source.id] })} />Show this provider</label>}
      {error && <p role="alert">{error}</p>}
    </form>
    <fieldset><legend>Keywords · all providers</legend>
      <label>Include<input aria-label="Include keywords" maxLength={2000} value={settings.include} placeholder="Iran, OPEC, interest rates" onChange={event => onChange({ ...settings, include: event.target.value })} /></label>
      <label>Match<select aria-label="Keyword matching" value={settings.match} onChange={event => onChange({ ...settings, match: event.target.value as 'any' | 'all' })}><option value="any">Any included term</option><option value="all">All included terms</option></select></label>
      <label>Exclude<input aria-label="Exclude keywords" maxLength={2000} value={settings.exclude} placeholder="hockey, football" onChange={event => onChange({ ...settings, exclude: event.target.value })} /></label>
      <p>Separate words or phrases with commas. Matches headlines and available feed summaries; exclusions take priority.</p>
      <button type="button" onClick={() => onChange({ ...settings, hiddenSources: [], include: '', exclude: '', match: 'any' })}>Show all headlines</button>
    </fieldset>
  </div>
}
