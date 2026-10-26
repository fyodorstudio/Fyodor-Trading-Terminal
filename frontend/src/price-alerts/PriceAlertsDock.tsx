import { useState } from 'react'
import type { PriceAlert } from './price-alert-store'
import type { PriceAlertsController } from './usePriceAlerts'
import { priceAlertSounds, type PriceAlertSoundId } from './price-alert-tones'
import './price-alerts.css'

const triggerClock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', weekday: 'short',
  day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })

function AlertRow({ alert, controller, onSelectSymbol, brokerId }: {
  alert: PriceAlert; controller: PriceAlertsController; onSelectSymbol: (symbol: string) => void; brokerId: string | null
}) {
  const [editing, setEditing] = useState<'price' | 'name' | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [price, setPrice] = useState('')
  const [name, setName] = useState('')
  const waitingForBroker = alert.brokerId !== brokerId
  const waitingForQuote = !controller.live || !controller.liveSymbols.has(alert.symbol)
  const status = alert.status === 'triggered' ? 'Stopped — Triggered' : alert.status === 'paused' ? 'Stopped — Paused'
    : waitingForBroker ? 'Waiting for broker' : waitingForQuote ? 'Waiting for quote' : 'Active'
  const statusClass = alert.status !== 'armed' ? 'stopped' : waitingForBroker || waitingForQuote ? 'waiting' : 'active'
  const crossing = `${alert.symbol} Crossing ${alert.price.toFixed(alert.precision)}`
  const title = alert.name || crossing
  return <article className={`price-alert-row ${alert.status}`} aria-label={`${alert.symbol} price alert`}>
    <button className="price-alert-summary" type="button" aria-expanded={expanded} aria-label={`${title}${alert.name ? ` · ${crossing}` : ''} · ${status} · Alert details`}
      onClick={() => { setExpanded(value => !value); setEditing(null) }}>
      <span className="price-alert-title">{title}</span>
      <span className="price-alert-meta">
        <svg className="price-alert-symbol-icon" aria-hidden="true" width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="11" r="6" /><path d="M10 7v4l3 2M3 5l3-3M14 2l3 3" /></svg>
        <span>{alert.name ? crossing : alert.symbol}</span><span aria-hidden="true">•</span>
        <span className={`price-alert-state ${statusClass}`}>{status}</span>
        {alert.triggeredAt !== null && <><span aria-hidden="true">•</span><time dateTime={new Date(alert.triggeredAt).toISOString()} title="Asia/Jakarta (UTC+07:00)">
          {triggerClock.format(alert.triggeredAt).replaceAll(',', '')}</time></>}
      </span>
    </button>
    {expanded && <div className="price-alert-details">
      <p>{alert.direction === 'above' ? 'Bid reaches or crosses above' : alert.direction === 'below' ? 'Bid reaches or crosses below' : 'Waiting for first live Bid'}</p>
      {waitingForBroker && <p>{alert.brokerId} · Waiting for this broker</p>}
      {alert.status === 'armed' && !waitingForBroker && controller.live && !controller.liveSymbols.has(alert.symbol)
        && <p>Waiting for a valid Bid. Keep this symbol visible in MT5 Market Watch.</p>}
      {alert.triggeredBid !== null && <p>Triggered Bid {alert.triggeredBid.toFixed(alert.precision)}</p>}
      {editing ? <form onSubmit={event => {
        event.preventDefault()
        if (editing === 'name') { controller.renameAlert(alert.id, name); setEditing(null); return }
        if (!Number.isFinite(Number(price)) || Number(price) <= 0 || Number(Number(price).toFixed(alert.precision)) <= 0) return
        controller.updateAlert(alert.id, 'price', Number(price)); setEditing(null)
      }}>
        {editing === 'name' ? <input aria-label={`Alert name for ${alert.symbol}`} type="text" maxLength={120} placeholder="Alert name (optional)"
          value={name} onChange={event => setName(event.target.value)} autoFocus />
          : <input aria-label={`Alert price for ${alert.symbol}`} type="number" min={10 ** -alert.precision} step={10 ** -alert.precision}
            value={price} onChange={event => setPrice(event.target.value)} required autoFocus />}
        <button type="submit">{editing === 'name' ? 'Save name' : 'Save & arm'}</button><button type="button" onClick={() => setEditing(null)}>Cancel</button>
      </form> : <div className="price-alert-actions">
        <button type="button" disabled={waitingForBroker} onClick={() => onSelectSymbol(alert.symbol)}>Open chart</button>
        <button type="button" onClick={() => { setName(alert.name ?? ''); setEditing('name') }}>Rename</button>
        <button type="button" onClick={() => { setPrice(alert.price.toFixed(alert.precision)); setEditing('price') }}>Edit price</button>
        <button type="button" onClick={() => { if (alert.status !== 'armed' && controller.playSound) void controller.enableSound(); controller.updateAlert(alert.id, alert.status === 'armed' ? 'pause' : 'arm') }}>
          {alert.status === 'armed' ? 'Pause' : alert.status === 'triggered' ? 'Rearm' : 'Resume'}</button>
        <button type="button" onClick={() => controller.updateAlert(alert.id, 'delete')}>Delete</button>
      </div>}
    </div>}
  </article>
}

export function PriceAlertsDock({ controller, onSelectSymbol, onCreate, brokerId }: {
  controller: PriceAlertsController; onSelectSymbol: (symbol: string) => void; onCreate: () => void; brokerId: string | null
}) {
  return <section className="price-alerts-dock" aria-label="Price Alerts">
    <div className="price-alert-controls">
      <button type="button" onClick={onCreate} disabled={!brokerId || !controller.live}>⏰ New price alert</button>
      <label><input type="checkbox" checked={controller.playSound} onChange={event => controller.setSound(event.target.checked, controller.duration)} /> Play sound</label>
      <div className="price-alert-sound">
        <select aria-label="Price alert sound" value={controller.soundId} onChange={event => controller.setSound(controller.playSound, controller.duration, event.target.value as PriceAlertSoundId)}>
          {priceAlertSounds.map(sound => <option key={sound.id} value={sound.id}>{sound.label}</option>)}
        </select>
        <select aria-label="Price alert sound duration" value={controller.duration} onChange={event => controller.setSound(controller.playSound, Number(event.target.value))}>
          {[1, 3, 5, 10].map(seconds => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
        </select><button type="button" onClick={() => void controller.previewSound()}>Preview</button></div>
      <p>One alert per line. Uses live Bid quotes while this terminal is open. Sampled crossings also trigger.</p>
      {!controller.live && <p role="status">Monitoring paused · waiting for live broker quotes.</p>}
      {controller.storageError && <p role="alert">Browser storage unavailable. Changes are kept for this session only.</p>}
      {controller.soundBlocked && <p role="alert">Sound is blocked. <button type="button" onClick={() => void controller.enableSound()}>Enable sound</button></p>}
    </div>
    <div className="price-alert-list" aria-live="polite">
      {!controller.alerts.length && <p>No price alerts. Choose the alarm drawing tool, then click a price on the chart.</p>}
      {[...controller.alerts].reverse().map(alert => <AlertRow key={alert.id} alert={alert} controller={controller} onSelectSymbol={onSelectSymbol} brokerId={brokerId} />)}
    </div>
  </section>
}
