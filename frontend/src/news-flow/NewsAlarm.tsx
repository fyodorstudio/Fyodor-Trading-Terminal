import { useEffect, useRef, useState } from 'react'
import type { NewsSettings } from './model'
import { useNewsSettings } from './settings'
import { enableNewsSound, playNewsSound } from './sound'
import { useNewsAlertStatus } from './alert-status'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'

type PhoneStatus = { mode: 'off' | 'included' | 'all'; connection: null | { server: string; reader: string; topic: string; reader_password: string };
  error: string; last_sent: null | { at: number; count: number; title: string; url: string } }

export function NewsAlarmControls({ settings, onChange }: { settings: NewsSettings; onChange: (settings: NewsSettings) => void }) {
  const status = useNewsAlertStatus(), clock = useDisplayClock()
  const [previewError, setPreviewError] = useState('')
  return <fieldset><legend>Desktop sound · selected providers</legend>
    <label>Sound trigger<select aria-label="News sound trigger" value={settings.soundEnabled ? settings.soundMode : 'off'} onChange={event => {
      const mode = event.target.value
      onChange({ ...settings, soundEnabled: mode !== 'off', soundMode: mode === 'all' ? 'all' : 'included' })
      if (mode !== 'off') void enableNewsSound()
    }}><option value="off">Off</option><option value="included">Included keywords</option><option value="all">All new headlines</option></select></label>
    <label>Sound<select aria-label="News alert sound" value={settings.sound} onChange={event => onChange({ ...settings, sound: event.target.value as NewsSettings['sound'] })}>
      <option value="chime">Chime</option><option value="bell">Bell</option><option value="pulse">Pulse</option>
    </select></label>
    <button type="button" aria-label="Preview news sound" onClick={() => void enableNewsSound().then(ok => setPreviewError(ok && playNewsSound(settings.sound) ? '' : 'Audio unavailable in this browser.'))}>Preview / enable audio</button>
    <p role="status">{settings.soundEnabled ? status.ready ? 'Audio ready' : 'Audio needs a click to enable' : 'Desktop sound off'}{status.pending ? ` · ${status.pending} waiting` : ''}</p>
    {(previewError || status.error) && <p role="alert">{previewError || status.error}</p>}
    <p>Included keywords respects Include/Exclude; All new headlines ignores keywords. Initial loading, historical imports and repeat headlines stay silent. Alerts follow collection, even if publication was earlier.</p>
    {status.last && <div><strong>{status.last.played ? 'Last sound' : 'Last alert · sound blocked'} · {clock.utc(status.last.at)}</strong>
      {status.last.items.map(item => <p key={item.id}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a><br />
        Collected {clock.utc(item.received_at ?? item.first_seen)}{item.published_at !== null ? ` · Feed publication ${clock.utc(item.published_at)}` : ' · Publication time unavailable'}</p>)}</div>}
  </fieldset>
}

export function PhoneNewsSettings({ settings }: { settings: NewsSettings }) {
  const [status, setStatus] = useState<PhoneStatus | null>(null), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false), [showLogin, setShowLogin] = useState(false)
  const request = useRef<AbortController | null>(null)
  const revision = useRef(0)
  useEffect(() => {
    const controller = new AbortController()
    let timer = 0
    async function load() {
      const version = revision.current
      try {
        const response = await fetch('/storage-api/news-flow/notifications', { signal: controller.signal })
        if (!response.ok) throw new Error('Phone settings unavailable. Restart pnpm run dev:all.')
        const body = await response.json()
        if (!['off', 'included', 'all'].includes(body.mode)) throw new Error('Invalid phone settings')
        if (!controller.signal.aborted && version === revision.current) { setStatus(body); setError('') }
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load phone settings') }
      finally { if (!controller.signal.aborted) timer = window.setTimeout(load, 5000) }
    }
    void load()
    return () => { controller.abort(); request.current?.abort(); window.clearTimeout(timer) }
  }, [])
  async function save(mode: PhoneStatus['mode']) {
    revision.current++
    const controller = new AbortController(); request.current = controller
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/storage-api/news-flow/notifications', { method: 'PUT', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, include: settings.include, exclude: settings.exclude, hidden: settings.hiddenSources }) })
      if (!response.ok) throw new Error('Could not save phone alerts')
      const body = await response.json()
      if (!controller.signal.aborted) { setStatus(body); setError('') }
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not save phone alerts') }
    finally { revision.current++; if (!controller.signal.aborted) setBusy(false) }
  }
  async function test() {
    const controller = new AbortController(); request.current = controller
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/storage-api/news-flow/notifications/test', { method: 'POST', signal: controller.signal })
      if (!response.ok) throw new Error('Test could not reach ntfy. Check the local phone service.')
      if (!controller.signal.aborted) { setMessage('Test sent to ntfy. Check your phone; this does not confirm phone receipt.'); setError('') }
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Phone test failed') }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  return <fieldset><legend>Android notifications · ntfy</legend>
    <label>Phone trigger<select aria-label="Phone news trigger" disabled={!status || busy} value={status?.mode ?? 'off'} onChange={event => void save(event.target.value as PhoneStatus['mode'])}>
      <option value="off">Off</option><option value="included">Included keywords</option><option value="all">All new headlines</option>
    </select></label>
    <p>Uses desktop keywords and selected providers. Keeps working when this browser closes, while the PC and dev:all services remain running. Phone sound is controlled in Android/ntfy.</p>
    {status?.connection ? <>
      <p>In ntfy, add a subscription using your own server:</p>
      <label>Server<input aria-label="ntfy server" readOnly value={status.connection.server} onFocus={event => event.currentTarget.select()} /></label>
      <label>Topic<input aria-label="ntfy topic" readOnly value={status.connection.topic} onFocus={event => event.currentTarget.select()} /></label>
      <button type="button" aria-expanded={showLogin} onClick={() => setShowLogin(value => !value)}>{showLogin ? 'Hide' : 'Show'} reader login</button>
      {showLogin && <><p>Username: <strong>reader</strong></p><label>Password<input aria-label="Phone reader password" readOnly value={status.connection.reader_password} onFocus={event => event.currentTarget.select()} /></label></>}
      <label>Phone news page<input aria-label="Phone news address" readOnly value={status.connection.reader} onFocus={event => event.currentTarget.select()} /></label>
      <p>Open the news page in your phone browser with the same reader login. Same home Wi-Fi only. Allow ntfy notifications and keep Instant delivery enabled. Use this private LAN connection on trusted Wi-Fi.</p>
      <button type="button" disabled={busy} onClick={() => void test()}>Send test notification</button>
    </> : <p>Start pnpm run dev:all to prepare the private local ntfy server and phone reader.</p>}
    {status?.last_sent && <p>Last sent to ntfy: <a href={status.last_sent.url} target="_blank" rel="noopener noreferrer">{status.last_sent.title}</a> ({status.last_sent.count} headline(s)). Phone receipt unconfirmed.</p>}
    {(error || status?.error) && <p role="alert">{error || status?.error}</p>}
    {message && <p role="status">{message}</p>}
  </fieldset>
}

export function NewsAlarmButton() {
  const [settings, change] = useNewsSettings(), status = useNewsAlertStatus()
  const [open, setOpen] = useState(false), container = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    container.current?.querySelector<HTMLSelectElement>('select')?.focus()
    function outside(event: PointerEvent) { if (!container.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return <div className="news-alarm" ref={container} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); trigger.current?.focus() }
  }} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false) }}>
    <button ref={trigger} type="button" aria-label="Headline alarms" title="Headline alarms and phone setup" aria-expanded={open} aria-controls="news-alarm-options"
      aria-pressed={settings.soundEnabled} data-attention={status.pending > 0} onClick={() => { setOpen(value => !value); if (settings.soundEnabled) void enableNewsSound() }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
    </button>
    {open && <div className="news-alarm-options" id="news-alarm-options" role="group" aria-label="Headline alarm settings">
      <NewsAlarmControls settings={settings} onChange={change} /><PhoneNewsSettings settings={settings} />
    </div>}
  </div>
}
