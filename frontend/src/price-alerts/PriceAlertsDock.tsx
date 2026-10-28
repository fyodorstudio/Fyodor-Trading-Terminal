import { useMemo, useRef, useState } from 'react'
import type { PriceAlert } from './price-alert-store'
import type { PriceAlertsController } from './usePriceAlerts'
import { priceAlertSounds, type PriceAlertSoundId } from './price-alert-tones'
import './price-alerts.css'

const triggerClock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', weekday: 'short',
  day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })

function AlertRow({ alert, controller, onSelectSymbol, brokerId }: {
  alert: PriceAlert; controller: PriceAlertsController; onSelectSymbol: (symbol: string) => void; brokerId: string | null
}) {
  const [editing, setEditing] = useState(false)
  const renameActive = useRef(false)
  const [name, setName] = useState('')
  const waitingForBroker = alert.brokerId !== brokerId
  const waitingForQuote = !controller.live || !controller.liveSymbols.has(alert.symbol)
  const status = alert.status === 'triggered' ? 'Stopped — Triggered' : alert.status === 'paused' ? 'Stopped — Paused'
    : waitingForBroker ? 'Waiting for broker' : waitingForQuote ? 'Waiting for quote' : 'Active'
  const statusClass = alert.status !== 'armed' ? 'stopped' : waitingForBroker || waitingForQuote ? 'waiting' : 'active'
  const crossing = `${alert.symbol} Crossing ${alert.price.toFixed(alert.precision)}`
  const title = alert.name || crossing
  const startRename = () => {
    renameActive.current = true
    setName(alert.name || alert.symbol)
    setEditing(true)
  }
  const saveName = () => {
    if (!renameActive.current) return
    renameActive.current = false
    controller.renameAlert(alert.id, name)
    setEditing(false)
  }
  const action = alert.status === 'armed' ? 'Pause' : alert.status === 'triggered' ? 'Rearm' : 'Resume'
  return <article className={`price-alert-row ${alert.status}`} aria-label={`${alert.symbol} price alert`}>
    {editing ? <form className="price-alert-rename" onSubmit={event => { event.preventDefault(); saveName() }}>
      <input aria-label={`Alert name for ${alert.symbol}`} type="text" maxLength={120} value={name} autoFocus
        onChange={event => setName(event.target.value)} onBlur={saveName}
        onFocus={event => event.currentTarget.setSelectionRange(event.currentTarget.value.length, event.currentTarget.value.length)}
        onKeyDown={event => {
          if (event.key !== 'Escape') return
          event.preventDefault(); event.stopPropagation(); renameActive.current = false; setEditing(false)
        }} />
    </form> : <button className="price-alert-summary" type="button" aria-disabled={waitingForBroker}
      aria-label={`Open ${alert.symbol} chart · ${title} · ${status}`}
      title={waitingForBroker ? `Waiting for ${alert.brokerId}` : 'Click to open chart · Double-click or press F2 to rename'}
      onDoubleClick={event => { event.preventDefault(); event.stopPropagation(); startRename() }}
      onClick={() => { if (!waitingForBroker) onSelectSymbol(alert.symbol) }} onKeyDown={event => {
        if (event.key === 'F2') { event.preventDefault(); startRename() }
      }}>
      <span className="price-alert-title">{title}</span>
      <span className="price-alert-meta">
        <svg className="price-alert-symbol-icon" aria-hidden="true" width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="11" r="6" /><path d="M10 7v4l3 2M3 5l3-3M14 2l3 3" /></svg>
        <span>{alert.name ? crossing : alert.symbol}</span><span aria-hidden="true">•</span>
        <span className={`price-alert-state ${statusClass}`}>{status}</span>
        {alert.triggeredAt !== null && <><span aria-hidden="true">•</span><time dateTime={new Date(alert.triggeredAt).toISOString()} title="Asia/Jakarta (UTC+07:00)">
          {triggerClock.format(alert.triggeredAt).replaceAll(',', '')}</time></>}
      </span>
    </button>}
    <div className="price-alert-actions">
      <button type="button" aria-label={`${action} ${title}`} title={`${action} alert`} onClick={() => {
        if (alert.status !== 'armed' && controller.playSound) void controller.enableSound()
        controller.updateAlert(alert.id, alert.status === 'armed' ? 'pause' : 'arm')
      }}>
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
          {alert.status === 'armed' ? <path d="M7 4v12M13 4v12" strokeWidth="3" />
            : alert.status === 'triggered' ? <><path d="M4 7a6.5 6.5 0 1 1 0 6M4 3v4h4" /><path d="M10 6v4l3 2" /></>
              : <path d="m7 4 9 6-9 6Z" />}
        </svg>
      </button>
      <button type="button" aria-label={`Delete ${title}`} title="Delete alert" onClick={() => controller.updateAlert(alert.id, 'delete')}>
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 5h14M7 5V3h6v2M5 5l1 12h8l1-12M8 8v6M12 8v6" />
        </svg>
      </button>
    </div>
  </article>
}

export function PriceAlertsDock({ controller, onSelectSymbol, onCreate, brokerId }: {
  controller: PriceAlertsController; onSelectSymbol: (symbol: string) => void; onCreate: () => void; brokerId: string | null
}) {
  const soundFileInput = useRef<HTMLInputElement>(null)
  const orderedAlerts = useMemo(() => [...controller.alerts].reverse().sort((a, b) => {
    const aTriggered = a.status === 'triggered', bTriggered = b.status === 'triggered'
    return Number(bTriggered) - Number(aTriggered) || (aTriggered && bTriggered ? (b.triggeredAt ?? 0) - (a.triggeredAt ?? 0) : 0)
  }), [controller.alerts])
  return <section className="price-alerts-dock" aria-label="Price Alerts">
    <div className="price-alert-controls">
      <div className="price-alert-create">
        <button type="button" onClick={onCreate} disabled={!brokerId || !controller.live}>⏰ New price alert</button>
        <label><input type="checkbox" checked={controller.playSound} onChange={event => controller.setSound(event.target.checked, controller.duration)} /> Play sound</label>
        <button type="button" className="price-alert-upload" aria-label="Upload custom alert sound" disabled={controller.customSoundLoading}
          title={controller.customSoundLoading ? 'Loading audio…' : 'Upload custom sound · MP3, WAV or OGG · up to 2 MB / 60 seconds'}
          onClick={() => soundFileInput.current?.click()}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 13V2m-4 4 4-4 4 4M3 12v5h14v-5" />
          </svg>
        </button>
        <input ref={soundFileInput} type="file" hidden aria-label="Custom alert audio file" accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg"
          onChange={event => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) void controller.uploadCustomSound(file)
          }} />
      </div>
      <div className="price-alert-sound">
        <select aria-label="Price alert sound" value={controller.soundId} onChange={event => controller.setSound(controller.playSound, controller.duration, event.target.value as PriceAlertSoundId)}>
          {priceAlertSounds.map(sound => <option key={sound.id} value={sound.id}>{sound.label}</option>)}
          {(controller.customSoundName || controller.soundId === 'custom') && <option value="custom">Custom · {controller.customSoundName || 'Upload audio'}</option>}
        </select>
        <select aria-label="Price alert sound duration" value={controller.duration} onChange={event => controller.setSound(controller.playSound, Number(event.target.value))}>
          {[1, 3, 5, 10].map(seconds => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
        </select><button type="button" disabled={controller.customSoundLoading} onClick={() => void controller.previewSound()}>Preview</button></div>
      {controller.customSoundError && <p role="alert">{controller.customSoundError}</p>}
      {!controller.live && <p role="status">Monitoring paused · waiting for live broker quotes.</p>}
      {controller.storageError && <p role="alert">Browser storage unavailable. Changes are kept for this session only.</p>}
      {controller.soundBlocked && <p role="alert">Sound is blocked. <button type="button" onClick={() => void controller.enableSound()}>Enable sound</button></p>}
    </div>
    <div className="price-alert-list" aria-live="polite">
      {orderedAlerts.map(alert => <AlertRow key={alert.id} alert={alert} controller={controller} onSelectSymbol={onSelectSymbol} brokerId={brokerId} />)}
    </div>
  </section>
}
