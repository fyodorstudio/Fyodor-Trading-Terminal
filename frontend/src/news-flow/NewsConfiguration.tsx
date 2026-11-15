import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { type NewsSettings, type NewsSource } from './model'
import { saveNewsSource } from './useNewsFlow'
import { ProviderBrowser } from './ProviderBrowser'
import { enableNewsSound, playNewsSound } from './sound'

export function NewsConfiguration({ sources, settings, onChange, onSaved, onClose }: {
  sources: NewsSource[]; settings: NewsSettings; onChange: (value: NewsSettings) => void; onSaved: () => void; onClose: () => void
}) {
  const [index, setIndex] = useState(0), [adding, setAdding] = useState(false)
  const [tab, setTab] = useState<'browse' | 'settings'>('browse'), [audioError, setAudioError] = useState('')
  const [browseDate, setBrowseDate] = useState('')
  const source = adding ? undefined : sources[Math.min(index, sources.length - 1)]
  const activeId = source?.id ?? 'new'
  const [draft, setDraft] = useState<{ id: string; name: string; url: string } | null>(null)
  const { name, url } = draft?.id === activeId ? draft : { name: source?.name ?? '', url: source?.url ?? '' }
  const [saving, setSaving] = useState(false), [error, setError] = useState('')
  const dialog = useRef<HTMLDivElement>(null), backdrop = useRef<HTMLDivElement>(null), request = useRef<AbortController | null>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const background = [...document.body.children].filter(element => element !== backdrop.current)
      .map(element => ({ element, inert: element.getAttribute('inert') }))
    for (const { element } of background) element.setAttribute('inert', '')
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.querySelector<HTMLElement>('button, input')?.focus()
    const containFocus = (event: FocusEvent) => {
      if (!dialog.current?.contains(event.target as Node)) dialog.current?.querySelector<HTMLElement>('button, input')?.focus()
    }
    document.addEventListener('focusin', containFocus)
    return () => {
      document.removeEventListener('focusin', containFocus); request.current?.abort()
      for (const { element, inert } of background) { if (inert === null) element.removeAttribute('inert'); else element.setAttribute('inert', inert) }
      document.body.style.overflow = overflow
      if (previous?.isConnected) previous.focus()
    }
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
  return createPortal(<div ref={backdrop} className="news-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={dialog} id="news-configuration" className="news-configuration" role="dialog" aria-modal="true" aria-label="News Flow configuration"
    onKeyUp={event => event.stopPropagation()}
    onKeyDown={event => {
      event.stopPropagation()
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') {
        const controls = [...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]')].filter(element => element.tabIndex >= 0)
        const next = event.shiftKey && document.activeElement === controls[0] ? controls.at(-1)
          : !event.shiftKey && document.activeElement === controls.at(-1) ? controls[0] : null
        if (next) { event.preventDefault(); next.focus() }
      }
    }}>
    <header><strong>News Flow</strong><button type="button" aria-label="Close news configuration" onClick={onClose}>×</button></header>
    <div className="news-tabs" role="tablist" aria-label="News Flow configuration tabs" onKeyDown={event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault()
        const next = event.key === 'Home' ? 'browse' : event.key === 'End' ? 'settings' : tab === 'browse' ? 'settings' : 'browse'
        setTab(next); document.getElementById(`news-${next}-tab`)?.focus()
      }
    }}>
      <button type="button" role="tab" id="news-browse-tab" tabIndex={tab === 'browse' ? 0 : -1} aria-controls="news-browse-panel" aria-selected={tab === 'browse'} onClick={() => setTab('browse')}>Browse providers</button>
      <button type="button" role="tab" id="news-settings-tab" tabIndex={tab === 'settings' ? 0 : -1} aria-controls="news-settings-panel" aria-selected={tab === 'settings'} onClick={() => setTab('settings')}>Settings</button>
    </div>
    {tab === 'browse' ? <div id="news-browse-panel" className="news-browse-panel" role="tabpanel" aria-labelledby="news-browse-tab">
      <ProviderBrowser sources={sources} selectedId={sources[Math.min(index, sources.length - 1)]?.id ?? ''} date={browseDate} onDateChange={setBrowseDate} onSelect={id => { setIndex(sources.findIndex(entry => entry.id === id)); setAdding(false) }} />
    </div> : <div id="news-settings-panel" className="news-configuration-body" role="tabpanel" aria-labelledby="news-settings-tab"><section aria-label="Provider setup">
    <nav aria-label="News providers">
      <button type="button" aria-label="Previous provider" disabled={saving || (!adding && index <= 0)} onClick={() => { setAdding(false); setIndex(Math.max(0, index - 1)) }}>←</button>
      <strong>{adding ? 'New provider' : source?.name ?? 'Providers'}</strong>
      <button type="button" aria-label="Next provider" disabled={saving || adding || index >= sources.length - 1} onClick={() => setIndex(index + 1)}>→</button>
      <button type="button" aria-label="Add provider" disabled={saving || adding} onClick={() => { setAdding(true); setDraft(null); setError('') }}>+</button>
    </nav>
    <form onSubmit={submit}>
      <label>Name<input aria-label="Provider name" required maxLength={100} disabled={saving} value={name} onChange={event => setDraft({ id: activeId, name: event.target.value, url })} /></label>
      <label>Feed / provider URL<input aria-label="Provider feed URL" type="url" required maxLength={2000} disabled={saving} value={url} onChange={event => setDraft({ id: activeId, name, url: event.target.value })} placeholder="https://…" /></label>
      <button type="submit" disabled={saving || !name.trim() || !url.trim()}>{saving ? 'Saving…' : adding ? 'Add provider' : 'Save provider'}</button>
      {source && <label className="news-checkbox"><input type="checkbox" checked={!settings.hiddenSources.includes(source.id)} onChange={event => onChange({ ...settings,
        hiddenSources: event.target.checked ? settings.hiddenSources.filter(id => id !== source.id) : [...settings.hiddenSources, source.id] })} />Show this provider</label>}
      {error && <p role="alert">{error}</p>}
    </form></section>
    <section><fieldset><legend>Keywords · all providers</legend>
      <label>Include words<input aria-label="Include keywords" maxLength={2000} value={settings.include} placeholder="Iran, oil, interest rates" onChange={event => onChange({ ...settings, include: event.target.value })} /></label>
      <p>Show stories containing any of these words or phrases. Leave empty to include everything.</p>
      <label>Exclude words<input aria-label="Exclude keywords" maxLength={2000} value={settings.exclude} placeholder="India, hockey" onChange={event => onChange({ ...settings, exclude: event.target.value })} /></label>
      <p>Hide stories containing any excluded word or phrase, even if an included word matches.</p>
      <p>Separate entries with commas. Matching ignores case and checks headline text. Switch the panel to <strong>Filtered</strong> to apply these rules; <strong>All</strong> keeps them saved without applying them.</p>
    </fieldset>
    <fieldset><legend>Sound alerts</legend>
      <label className="news-checkbox"><input type="checkbox" aria-label="Enable news sound" checked={settings.soundEnabled} onChange={event => {
        const enabled = event.target.checked; onChange({ ...settings, soundEnabled: enabled })
        if (enabled) void enableNewsSound().then(ok => setAudioError(ok ? '' : 'Audio unavailable. Try Preview.'))
      }} />Play sound for included keywords</label>
      <label>Sound<select aria-label="News alert sound" value={settings.sound} onChange={event => onChange({ ...settings, sound: event.target.value as NewsSettings['sound'] })}>
        <option value="chime">Chime</option><option value="bell">Bell</option><option value="pulse">Pulse</option>
      </select></label>
      <button type="button" aria-label="Preview news sound" onClick={() => void enableNewsSound().then(ok => setAudioError(ok && playNewsSound(settings.sound) ? '' : 'Audio unavailable in this browser.'))}>Preview</button>
      <p>New live headlines matching Include trigger a sound, unless excluded or from a hidden provider. Empty Include stays silent. Works with the panel closed while this terminal is open; All/Filtered does not change alerts.</p>
      {audioError && <p role="alert">{audioError}</p>}
    </fieldset></section>
    </div>}
    </div>
  </div>, document.body)
}
