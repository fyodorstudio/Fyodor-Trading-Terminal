import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCalendarNow } from '../inspector/useCalendarNow'
import { alarmTime } from './alarm-time'
import { alarmWorkerLabel, type AlarmSettings, type useAlarms } from './useAlarms'

type Alarms = ReturnType<typeof useAlarms>
function Settings({ value, busy, onSave }: { value: AlarmSettings; busy: boolean; onSave: (settings: AlarmSettings) => void }) {
  const [draft, setDraft] = useState(value)
  return <form className="alarm-settings" onSubmit={event => { event.preventDefault(); onSave(draft) }}>
    <label>Prepare <input type="number" min="2" max="120" required value={draft.prepare_minutes} onChange={event => setDraft({ ...draft, prepare_minutes: Number(event.target.value) })} /> min before</label>
    <label>Invoke <input type="number" min="1" max="119" required value={draft.release_minutes} onChange={event => setDraft({ ...draft, release_minutes: Number(event.target.value) })} /> min before</label>
    <button disabled={busy || draft.prepare_minutes <= draft.release_minutes}>Save reminder times</button>
  </form>
}
export function AlarmControls({ alarms }: { alarms: Alarms }) {
  const { data, error, busy, mutate } = alarms
  const [open, setOpen] = useState(false), [settingsOpen, setSettingsOpen] = useState(false), [message, setMessage] = useState('')
  const menuId = useId(), menu = useRef<HTMLDivElement>(null), popover = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null)
  const ringing = data?.jobs.filter(job => job.status === 'ringing') ?? []
  const now = useCalendarNow(0, 1000, ringing.length > 0)
  const failures = data?.jobs.filter(job => ['failed', 'interrupted', 'missed'].includes(job.status)).slice(0, 8) ?? []
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !popover.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape) }
  }, [open])
  return <div className="alarm-menu" ref={menu}>
    <button ref={trigger} type="button" className="alarm-menu-trigger" aria-label="Alarm controls" aria-expanded={open} aria-controls={menuId}
      title={error || data?.schedule_error || 'Alarm settings, test sound and delivery history'} onClick={() => setOpen(value => !value)}>
      {ringing.length ? `Reminder ringing (${ringing.length})` : alarmWorkerLabel(data, error)} <span aria-hidden="true">▾</span>
    </button>
    {open && createPortal(<div id={menuId} ref={popover} className="alarm-popover" role="region" aria-label="Alarm settings and status">
    <div className="events-toolbar">
      {data && <><label><input type="checkbox" checked={data.settings.enabled} disabled={busy} onChange={event => void mutate({ action: 'settings', settings: { ...data.settings, enabled: event.target.checked } })} /> Enable alarms</label>
        <button disabled={busy} onClick={() => void mutate({ action: 'test' }).then(ok => { if (ok) setMessage('Test launched. Confirm the Windows alarm window and sound; dismiss it when finished.') })}>Test alarm</button>
        <button aria-expanded={settingsOpen} onClick={() => setSettingsOpen(value => !value)}>Reminder settings</button></>}
    </div>
    <p>Reminders: {data?.settings.prepare_minutes ?? 10} and {data?.settings.release_minutes ?? 1} minutes before · Jakarta. Keep Windows awake.</p>
    {(error || data?.schedule_error) && <p role="alert">{error || data?.schedule_error}</p>}
    {message && <p role="status">{message}</p>}
    {settingsOpen && data && <Settings key={JSON.stringify(data.settings)} value={data.settings} busy={busy} onSave={settings => void mutate({ action: 'settings', settings })} />}
    {ringing.length > 0 && <div className="alarm-ringing" role="alert"><strong>Reminder ringing</strong>{ringing.map(job => <div key={job.id}>
      <span>{job.title} · {job.stage === 'prepare' ? 'Prepare now' : 'Invoke now'}</span>
      <button disabled={busy} onClick={() => void mutate({ action: 'dismiss', ids: [job.id] })}>Dismiss</button>
      <button disabled={busy || job.at <= now + 300000} onClick={() => void mutate({ action: 'snooze', ids: [job.id] })}>Snooze 5 min</button>
    </div>)}</div>}
    {failures.length > 0 && <details><summary>Missed / interrupted reminders ({failures.length})</summary>{failures.map(job => <p key={job.id}>
      {job.title} · {alarmTime(job.due * 1000)} · {job.status}{job.error && `: ${job.error}`}
    </p>)}</details>}
    </div>, document.body)}
  </div>
}
