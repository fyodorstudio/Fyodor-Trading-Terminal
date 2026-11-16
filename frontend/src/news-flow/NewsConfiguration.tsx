import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { type NewsSettings, type NewsSource } from './model'
import { saveNewsSource } from './useNewsFlow'
import { ProviderBrowser } from './ProviderBrowser'
import { NewsTabs } from './NewsTabs'
import { NewsGlobalSettings } from './NewsGlobalSettings'
import { useOptionalWildcards } from '../wildcards/useWildcards'

export function NewsConfiguration({ sources, settings, onChange, onSaved, onClose }: {
  sources: NewsSource[]; settings: NewsSettings; onChange: (value: NewsSettings) => void; onSaved: () => void; onClose: () => void
}) {
  const [index, setIndex] = useState(0), [adding, setAdding] = useState(false)
  const [tab, setTab] = useState('browse'), [settingsTab, setSettingsTab] = useState('global'), [browseDate, setBrowseDate] = useState('')
  const source = adding ? undefined : sources[Math.min(index, sources.length - 1)]
  const activeId = source?.id ?? 'new'
  const [draft, setDraft] = useState<{ id: string; name: string; url: string; poll: string } | null>(null)
  const { name, url, poll } = draft?.id === activeId ? draft : { name: source?.name ?? '', url: source?.url ?? '', poll: String(source?.poll_seconds ?? 1) }
  const [saving, setSaving] = useState(false), [error, setError] = useState('')
  const wildcards = useOptionalWildcards(), suspended = !!wildcards?.editor
  const dialog = useRef<HTMLDivElement>(null), backdrop = useRef<HTMLDivElement>(null), request = useRef<AbortController | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (suspended) return
    opener.current ??= document.activeElement as HTMLElement | null
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
      document.removeEventListener('focusin', containFocus)
      for (const { element, inert } of background) { if (inert === null) element.removeAttribute('inert'); else element.setAttribute('inert', inert) }
      document.body.style.overflow = overflow
      if (opener.current?.isConnected) opener.current.focus()
    }
  }, [suspended])
  useEffect(() => () => request.current?.abort(), [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    if (!Number.isInteger(Number(poll)) || Number(poll) < 1 || Number(poll) > 3600) { setError('Choose a polling interval from 1 to 3600 seconds.'); return }
    const controller = new AbortController(); request.current = controller
    setSaving(true); setError('')
    try {
      await saveNewsSource(name.trim(), url.trim(), source?.id, controller.signal, Number(poll))
      if (!controller.signal.aborted) { onSaved(); if (adding) setIndex(sources.length); setAdding(false) }
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not save provider') }
    finally { if (!controller.signal.aborted) setSaving(false) }
  }
  function selectProvider(id: string) {
    if (saving) return
    setError(''); setDraft(null)
    if (id === 'new') { setAdding(true); setTab('settings'); setSettingsTab('providers') }
    else { setAdding(false); setIndex(sources.findIndex(source => source.id === id)) }
  }
  return createPortal(<div ref={backdrop} className="news-modal-backdrop" hidden={suspended} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={dialog} id="news-configuration" className="news-configuration" role="dialog" aria-modal="true" aria-label="News Flow Extended View"
      onKeyUp={event => event.stopPropagation()} onKeyDown={event => {
        event.stopPropagation()
        if (event.key === 'Escape') onClose()
        if (event.key === 'Tab') {
          const controls = [...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')].filter(element => element.tabIndex >= 0)
          const next = event.shiftKey && document.activeElement === controls[0] ? controls.at(-1) : !event.shiftKey && document.activeElement === controls.at(-1) ? controls[0] : null
          if (next) { event.preventDefault(); next.focus() }
        }
      }}>
      <header><strong>News Flow Extended View</strong><button type="button" aria-label="Close news configuration" onClick={onClose}>×</button></header>
      <NewsTabs label="News Flow configuration tabs" value={tab} onChange={setTab} controls="news-config-panel"
        items={[{ id: 'browse', label: 'Browse providers' }, { id: 'priority', label: 'Priority' }, { id: 'settings', label: 'Settings' }]} />
      <div id="news-config-panel" className="news-config-panel" role="tabpanel" aria-labelledby={`news-config-panel-${tab}-tab`}>
        {tab === 'settings' && <NewsTabs label="News settings sections" value={settingsTab} onChange={setSettingsTab} controls="news-settings-panel"
          items={[{ id: 'global', label: 'Global' }, { id: 'providers', label: 'Providers' }]} />}
        {(tab === 'browse' || tab === 'settings' && settingsTab === 'providers') && <NewsTabs label="News providers" value={activeId} onChange={selectProvider} controls="news-source-panel"
          items={[...sources.map(source => ({ id: source.id, label: source.name })), { id: 'new', label: 'Add provider' }]} />}
        {tab === 'priority' ? <ProviderBrowser key="priority" sources={sources} priority date={browseDate} onDateChange={setBrowseDate} />
          : <div id={tab === 'settings' ? 'news-settings-panel' : 'news-source-panel'} className="news-source-panel" role="tabpanel"
            aria-labelledby={tab === 'settings' ? `news-settings-panel-${settingsTab}-tab` : `news-source-panel-${activeId}-tab`}>
            {tab === 'browse' ? <ProviderBrowser sources={sources} selectedId={source?.id} date={browseDate} onDateChange={setBrowseDate} />
              : settingsTab === 'global' ? <NewsGlobalSettings settings={settings} onChange={onChange} />
              : <div id="news-source-panel" role="tabpanel" aria-labelledby={`news-source-panel-${activeId}-tab`} className="news-provider-settings"><section aria-label="Provider setup">
                <form onSubmit={submit}>
                  <label>Name<input aria-label="Provider name" required maxLength={100} disabled={saving} value={name} onChange={event => setDraft({ id: activeId, name: event.target.value, url, poll })} /></label>
                  <label>Feed / provider URL<input aria-label="Provider feed URL" type="url" required maxLength={2000} disabled={saving} value={url} onChange={event => setDraft({ id: activeId, name, url: event.target.value, poll })} placeholder="https://…" /></label>
                  <label>Fetch every (seconds)<input aria-label="Provider polling interval" type="number" required min="1" max="3600" step="1" list="news-poll-options" disabled={saving} value={poll} onChange={event => setDraft({ id: activeId, name, url, poll: event.target.value })} /></label>
                  <datalist id="news-poll-options"><option value="1">1 second · default</option><option value="60">1 minute</option><option value="120">2 minutes</option><option value="180">3 minutes</option><option value="300">5 minutes</option></datalist>
                  <p>Default: 1 second. Override only this provider; 60–300 seconds is 1–5 minutes. Server cooldowns remain in effect.</p>
                  <button type="submit" disabled={saving || !name.trim() || !url.trim()}>{saving ? 'Saving…' : adding ? 'Add provider' : 'Save provider'}</button>
                  {source && <label className="news-checkbox"><input type="checkbox" aria-label="Show this provider" checked={!settings.hiddenSources.includes(source.id)} onChange={event => onChange({ ...settings,
                    hiddenSources: event.target.checked ? settings.hiddenSources.filter(id => id !== source.id) : [...settings.hiddenSources, source.id] })} />Show this provider</label>}
                  {error && <p role="alert">{error}</p>}
                </form>
              </section></div>}
          </div>}
      </div>
    </div>
  </div>, document.body)
}
