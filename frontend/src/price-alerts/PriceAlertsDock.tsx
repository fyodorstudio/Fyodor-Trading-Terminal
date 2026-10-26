import { useState } from 'react'
import type { PriceAlert } from './price-alert-store'
import type { PriceAlertsController } from './usePriceAlerts'
import './price-alerts.css'

function AlertRow({ alert, controller, onSelectSymbol, brokerId }: {
  alert: PriceAlert; controller: PriceAlertsController; onSelectSymbol: (symbol: string) => void; brokerId: string | null
}) {
  const [editing, setEditing] = useState(false)
  const [price, setPrice] = useState('')
  return <article className={`price-alert-row ${alert.status}`} aria-label={`${alert.symbol} price alert`}>
    <header><button type="button" disabled={alert.brokerId !== brokerId} onClick={() => onSelectSymbol(alert.symbol)}>{alert.symbol}</button>
      <strong>{alert.price.toFixed(alert.precision)}</strong><span>{alert.status}</span></header>
    <p>{alert.direction === 'above' ? 'Bid reaches or crosses above' : alert.direction === 'below' ? 'Bid reaches or crosses below' : 'Waiting for first live Bid'}</p>
    {alert.brokerId !== brokerId && <p>{alert.brokerId} · Waiting for this broker</p>}
    {alert.status === 'armed' && alert.brokerId === brokerId && controller.live && !controller.liveSymbols.has(alert.symbol)
      && <p>Waiting for a valid Bid. Keep this symbol visible in MT5 Market Watch.</p>}
    {alert.triggeredAt !== null && <p>Triggered {new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta',
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(alert.triggeredAt)} Jakarta
      {alert.triggeredBid !== null && ` · Bid ${alert.triggeredBid.toFixed(alert.precision)}`}</p>}
    {editing ? <form onSubmit={event => {
      event.preventDefault()
      if (!Number.isFinite(Number(price)) || Number(price) <= 0 || Number(Number(price).toFixed(alert.precision)) <= 0) return
      controller.updateAlert(alert.id, 'price', Number(price)); setEditing(false)
    }}>
      <input aria-label={`Alert price for ${alert.symbol}`} type="number" min={10 ** -alert.precision} step={10 ** -alert.precision}
        value={price} onChange={event => setPrice(event.target.value)} required autoFocus />
      <button type="submit">Save & arm</button><button type="button" onClick={() => setEditing(false)}>Cancel</button>
    </form> : <div className="price-alert-actions">
      <button type="button" onClick={() => { setPrice(alert.price.toFixed(alert.precision)); setEditing(true) }}>Edit price</button>
      <button type="button" onClick={() => { if (controller.playSound) void controller.enableSound(); controller.updateAlert(alert.id, alert.status === 'armed' ? 'pause' : 'arm') }}>
        {alert.status === 'armed' ? 'Pause' : alert.status === 'triggered' ? 'Rearm' : 'Resume'}</button>
      <button type="button" onClick={() => controller.updateAlert(alert.id, 'delete')}>Delete</button>
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
      <div className="price-alert-sound"><span>Thin chime</span>
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
