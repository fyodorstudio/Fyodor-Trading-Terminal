import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCalendarNow } from '../inspector/useCalendarNow'
import { alarmTime } from './alarm-time'
import { alarmWorkerLabel, defaultAlarmAudio, type AlarmAudioSettings, type AlarmSettings, type useAlarms } from './useAlarms'
import { priceAlertSounds } from '../price-alerts/price-alert-tones'
import { alarmAudioUpload } from './alarm-audio-upload'

type Alarms = ReturnType<typeof useAlarms>
function Settings({ value, busy, onSave }: { value: AlarmSettings; busy: boolean; onSave: (settings: AlarmSettings) => void }) {
  const [draft, setDraft] = useState(value)
  return <form className="alarm-settings" onSubmit={event => { event.preventDefault(); onSave(draft) }}>
    <label>Invoke <input type="number" min="1" max="120" required value={draft.release_minutes} onChange={event => setDraft({ ...draft, release_minutes: Number(event.target.value) })} /> min before</label>
    <button disabled={busy || !Number.isInteger(draft.release_minutes) || draft.release_minutes < 1 || draft.release_minutes > 120}>Save reminder time</button>
  </form>
}
function SoundSettings({ alarms }: { alarms: Alarms }) {
  const value=alarms.data?.audio ?? defaultAlarmAudio
  const [draft,setDraft]=useState<AlarmAudioSettings>(value)
  const [uploading,setUploading]=useState(false), [error,setError]=useState(''), [saved,setSaved]=useState('')
  const fileInput=useRef<HTMLInputElement>(null), request=useRef(0)
  useEffect(() => () => { request.current++ }, [])
  const save=async () => {
    const ok=await alarms.mutate({action:'audio-settings',audio:draft})
    if(ok)setSaved('Sound settings saved.')
    return ok
  }
  return <form className="alarm-audio-settings" aria-label="Economic reminder sound" onSubmit={event=>{event.preventDefault();void save()}}>
    <fieldset disabled={alarms.busy || uploading}>
      <legend>Sound</legend>
      <label><input type="checkbox" checked={draft.enabled} onChange={e=>setDraft({...draft,enabled:e.target.checked})} /> Play sound</label>
      <label>Volume <input aria-label="Economic reminder volume" type="range" min="0" max="100" value={draft.volume} onChange={e=>{setSaved('');setDraft({...draft,volume:Number(e.target.value)})}} /><output>{draft.volume}%</output></label>
      <label>Sound <select aria-label="Economic reminder sound" value={draft.sound_id} onChange={e=>setDraft({...draft,sound_id:e.target.value})}>
        {priceAlertSounds.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
        {alarms.data?.custom_sound_name && <option value="custom">Custom · {alarms.data.custom_sound_name}</option>}
      </select></label>
      <label>Duration <select aria-label="Economic reminder duration" value={draft.duration} onChange={e=>setDraft({...draft,duration:Number(e.target.value)})}>
        {[1,3,5,10].map(s=><option key={s} value={s}>{s} seconds</option>)}
      </select></label>
      <label><input type="checkbox" checked={draft.repeat} onChange={e=>setDraft({...draft,repeat:e.target.checked})} /> Repeat sound until dismissed</label>
      <button>Save sound settings</button>
      <button type="button" onClick={()=>void (async()=>{if(alarms.data?.preview_playing)await alarms.mutate({action:'stop-preview'});else if(await save())await alarms.mutate({action:'preview'})})()}>{alarms.data?.preview_playing ? 'Stop preview' : 'Preview'}</button>
      <button type="button" onClick={()=>fileInput.current?.click()}>Upload sound</button>
      <input hidden ref={fileInput} aria-label="Economic reminder audio file" type="file" accept=".mp3,.wav,.ogg" onChange={event=>{
        const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(!file)return
        const version=++request.current;setUploading(true);setError('')
        void alarmAudioUpload(file).then(async data=>{if(version===request.current)await alarms.mutate({action:'audio-upload',...data})})
          .catch(e=>{if(version===request.current)setError(e.message)})
          .finally(()=>{if(version===request.current)setUploading(false)})
      }} />
    </fieldset>
    {uploading && <p role="status">Loading audio…</p>}{error && <p role="alert">{error}</p>}{saved && <p role="status">{saved}</p>}
  </form>
}
export function AlarmControls({ alarms }: { alarms: Alarms }) {
  const { data, error, busy, mutate } = alarms
  const [open, setOpen] = useState(false), [settingsOpen, setSettingsOpen] = useState(false), [message, setMessage] = useState('')
  const menuId = useId(), menu = useRef<HTMLDivElement>(null), popover = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null)
  const ringing = data?.jobs.filter(job => job.status === 'ringing') ?? []
  const now = useCalendarNow(0, 1000, ringing.length > 0)
  const failures = data?.jobs.filter(job => ['failed', 'interrupted', 'missed'].includes(job.status)) ?? []
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
      Alarm Settings <i className={`alarm-status-dot ${error || data?.schedule_error ? 'error' : data?.settings.enabled ? 'enabled' : 'paused'}`} aria-label={alarmWorkerLabel(data, error)} />
      {ringing.length > 0 && <span role="status">Ringing ({ringing.length})</span>}
    </button>
    {open && createPortal(<div id={menuId} ref={popover} className="alarm-popover" role="region" aria-label="Alarm settings and status">
    <div className="events-toolbar">
      {data && <><label><input type="checkbox" checked={data.settings.enabled} disabled={busy} onChange={event => void mutate({ action: 'settings', settings: { ...data.settings, enabled: event.target.checked } })} /> Enable alarms</label>
        <button disabled={busy} onClick={() => void mutate({ action: 'test' }).then(ok => { if (ok) setMessage('Test launched. Confirm the Windows alarm window and sound; dismiss it when finished.') })}>Test alarm</button>
        <button aria-expanded={settingsOpen} onClick={() => setSettingsOpen(value => !value)}>Reminder settings</button></>}
    </div>
    <p>Invoke reminder: {data?.settings.release_minutes ?? 2} minutes before · Jakarta. Keep Windows awake.</p>
    <p>{alarmWorkerLabel(data, error)}. New events start with no alarm selected.</p>

    {(error || data?.schedule_error) && <p role="alert">{error || data?.schedule_error}</p>}
    {message && <p role="status">{message}</p>}
    {settingsOpen && data && <Settings key={JSON.stringify(data.settings)} value={data.settings} busy={busy} onSave={settings => void mutate({ action: 'settings', settings })} />}
    {data && <SoundSettings key={JSON.stringify(data.audio ?? defaultAlarmAudio)} alarms={alarms} />}
    {ringing.length > 0 && <div className="alarm-ringing" role="alert"><strong>Reminder ringing</strong>{ringing.map(job => <div key={job.id}>
      <span>{job.title} · Reminder</span>
      <button disabled={busy} onClick={() => void mutate({ action: 'dismiss', ids: [job.id] })}>Dismiss</button>
      <button disabled={busy} onClick={() => void mutate({ action: 'silence', ids: [job.id] })}>Stop sound</button>
      <button disabled={busy || job.at <= now + 300000} onClick={() => void mutate({ action: 'snooze', ids: [job.id] })}>Snooze 5 min</button>
    </div>)}</div>}
    {failures.length > 0 && <details><summary>Missed / interrupted reminders ({failures.length})</summary>
      <button disabled={busy} onClick={() => void mutate({ action:'clear-missed' })}>Clear all missed</button>
      {failures.map(job => <p key={job.id}>
      {job.title} · {alarmTime(job.due * 1000)} · {job.status}{job.error && `: ${job.error}`}
      {' '}<button disabled={busy} aria-label={`Clear missed reminder ${job.title}`} onClick={()=>void mutate({action:'dismiss',ids:[job.id]})}>Clear</button>
    </p>)}</details>}
    </div>, document.body)}
  </div>
}
