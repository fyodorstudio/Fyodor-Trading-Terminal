import { useEffect, useRef, useState } from 'react'
import type { NewsSettings } from './model'
import { useNewsSettings } from './settings'
import { enableNewsSound, playNewsSound } from './sound'
import { useNewsAlertStatus } from './alert-status'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { saveNewsAlertProfile, useNewsAlertProfile } from './alert-profile'
import { NewsPopupSettings } from './NewsPopupSettings'

export function NewsAlarmControls({ settings, onChange }: { settings: NewsSettings; onChange: (settings: NewsSettings) => void }) {
  const status = useNewsAlertStatus(), clock = useDisplayClock(), profile = useNewsAlertProfile()
  const [previewError, setPreviewError] = useState('')
  const age = profile.data?.max_age_seconds === undefined ? 86400 : profile.data.max_age_seconds
  const [draft, setDraft] = useState<{ base: number | null; enabled: boolean; amount: string; unit: 'hours' | 'days' } | null>(null)
  const value = draft?.base === age ? draft : { base: age, enabled: age !== null, amount: String(age === null ? 24 : age % 86400 === 0 ? age / 86400 : age / 3600), unit: age !== null && age % 86400 === 0 ? 'days' as const : 'hours' as const }
  const seconds = value.enabled ? Number(value.amount) * (value.unit === 'days' ? 86400 : 3600) : null
  const valid = seconds === null || Number.isInteger(Number(value.amount)) && Number(value.amount) >= 1 && seconds <= 31536000
  const disabled = !profile.data || profile.loading || profile.saving
  return <fieldset className="news-alert-settings"><legend>News alerts · desktop + phone</legend>
    <label>Alert trigger<select aria-label="News alert trigger" disabled={disabled} value={profile.data?.mode ?? 'off'} onChange={event => {
      const mode = event.target.value as 'off' | 'priority' | 'included' | 'all'
      if (mode !== 'off') void enableNewsSound()
      void saveNewsAlertProfile(mode, age)
    }}><option value="off">Off</option><option value="priority">Priority 1 only</option><option value="included">Priority 1 + Priority 2</option><option value="all">All new headlines</option></select></label>
    <p className="news-alert-note">One trigger for desktop sound, Windows popups and phone notifications. Priority 1 includes important catalysts, risk sentiment and fundamental repricing.</p>
    <form className="news-alert-age" onSubmit={event => { event.preventDefault(); if (valid && !disabled) void saveNewsAlertProfile(profile.data!.mode, seconds) }}>
      <label className="news-checkbox"><input aria-label="Limit news publication age" type="checkbox" disabled={disabled} checked={value.enabled} onChange={event => setDraft({ ...value, enabled: event.target.checked })} />Only alert on recent publications</label>
      <div className="news-alert-age-range"><label>Published within<input aria-label="News publication age amount" type="number" min="1" max={value.unit === 'hours' ? 8760 : 365} step="1" disabled={disabled || !value.enabled} value={value.amount} onChange={event => setDraft({ ...value, amount: event.target.value })} /></label>
        <label>Unit<select aria-label="News publication age unit" disabled={disabled || !value.enabled} value={value.unit} onChange={event => setDraft({ ...value, unit: event.target.value as 'hours' | 'days' })}><option value="hours">Hours</option><option value="days">Days</option></select></label>
        <button type="submit" disabled={disabled || !valid || seconds === age}>Apply age limit</button></div>
      <p>Applies to both devices. Older headlines stay readable but silent. Missing or scheduled publication times cannot pass an enabled limit.</p>
    </form>
    {profile.error && <p role="alert">{profile.error}</p>}
    <NewsPopupSettings />
    <label>Desktop sound<select aria-label="News alert sound" value={settings.sound} onChange={event => onChange({ ...settings, sound: event.target.value as NewsSettings['sound'] })}>
      <option value="chime">Chime</option><option value="bell">Bell</option><option value="pulse">Pulse</option>
    </select></label>
    <button type="button" aria-label="Preview news sound" onClick={() => void enableNewsSound().then(ok => setPreviewError(ok && playNewsSound(settings.sound) ? '' : 'Audio unavailable in this browser.'))}>Preview / enable audio</button>
    <p role="status">{profile.data?.mode !== 'off' ? status.ready ? 'Desktop audio ready' : 'Desktop audio needs a click to enable' : 'News alerts off'}{status.pending ? ` · ${status.pending} waiting` : ''}</p>
    {(previewError || status.error) && <p role="alert">{previewError || status.error}</p>}
    <p>New collection can alert only when it passes the shared trigger and publication-age limit. Startup, historical imports and repeat headlines stay silent. Desktop audio requires this page open; phone delivery needs the PC services running.</p>
    {status.last && <div className="news-last-alert"><strong>{status.last.played ? 'Last sound' : 'Last alert · sound blocked'} · {clock.utc(status.last.at)}</strong>
      {status.last.items.map(item => <p key={item.id}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a><br />
        Collected {clock.utc(item.received_at ?? item.first_seen)}{item.published_at !== null ? ` · Feed publication ${clock.utc(item.published_at)}` : ' · Publication time unavailable'}</p>)}</div>}
  </fieldset>
}

export function PhoneNewsSettings() {
  const profile = useNewsAlertProfile(), status = profile.data
  const [error, setError] = useState(''), [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false), [showLogin, setShowLogin] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
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
  return <fieldset className="news-phone-setup"><legend>Phone connection · ntfy</legend>
    <p>Uses the shared News alerts settings above. Android/ntfy controls phone sound.</p>
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
  const [settings, change] = useNewsSettings(), status = useNewsAlertStatus(), profile = useNewsAlertProfile()
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
      data-enabled={!!profile.data && profile.data.mode !== 'off'} data-attention={status.pending > 0} onClick={() => { setOpen(value => !value); if (profile.data?.mode !== 'off') void enableNewsSound() }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
    </button>
    {open && <div className="news-alarm-options" id="news-alarm-options" role="group" aria-label="Headline alarm settings">
      <NewsAlarmControls settings={settings} onChange={change} /><PhoneNewsSettings />
    </div>}
  </div>
}
