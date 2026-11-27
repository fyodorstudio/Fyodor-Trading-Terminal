import { useState } from 'react'
import type { ProfileWindow } from './volume-profile'
import { profileNodes, type ProfileAlertTrigger, type ProfileNode } from './volume-profile-alerts'
import type { useProfileAlerts } from './use-profile-alerts'
import './volume-profile.css'

export function VolumeProfileAlertsDock({ controller, symbol, lookback, fixed, canArm, onSelectSymbol }: {
  controller: ReturnType<typeof useProfileAlerts>
  symbol: string; lookback: number; fixed?: ProfileWindow; canArm: boolean
  onSelectSymbol: (symbol: string) => void
}) {
  const [node, setNode] = useState<ProfileNode>('POC')
  const [trigger, setTrigger] = useState<ProfileAlertTrigger>(fixed ? 'touch' : 'both')
  const [repeat, setRepeat] = useState(false)
  const [minutes, setMinutes] = useState(lookback)
  return <section className="vp-alert-dock" aria-label="Volume profile alerts">
    <form onSubmit={event => {
      event.preventDefault()
      if (canArm && symbol && Number.isSafeInteger(minutes) && minutes > 0)
        controller.add({ symbol, node, trigger: fixed ? 'touch' : trigger, repeat, lookbackMinutes: minutes, fixed })
    }}>
      <strong>{symbol || 'Select a symbol'}</strong>
      <label>Level <select value={node} onChange={event => setNode(event.target.value as ProfileNode)}>
        {profileNodes.map(value => <option key={value}>{value}</option>)}
      </select></label>
      {fixed ? <span>Price reaches a level in the selected window</span> : <>
        <label>Trigger <select value={trigger} onChange={event => setTrigger(event.target.value as ProfileAlertTrigger)}>
          <option value="both">New level or price reaches level</option>
          <option value="new-level">New level</option>
          <option value="touch">Price reaches level</option>
        </select></label>
        <label>Live lookback in minutes <input type="number" min="1" step="1" required value={minutes || ''}
          onChange={event => setMinutes(Number(event.target.value))} /></label>
      </>}
      <label><input type="checkbox" checked={repeat} onChange={event => setRepeat(event.target.checked)} /> Repeat for the same level</label>
      <button type="submit" disabled={!canArm || !symbol}>Arm VP alert</button>
    </form>
    {controller.alerts.length ? <ul>
      {controller.alerts.map(alert => <li key={alert.id}>
        <div><button type="button" onClick={() => onSelectSymbol(alert.symbol)}>{alert.symbol}</button> <strong>{alert.node}</strong>
          <small>{alert.fixed ? 'Fixed window' : `${alert.lookbackMinutes} min`} · {
            alert.trigger === 'both' ? 'New level or price reach' : alert.trigger === 'touch' ? 'Price reach' : 'New level'
          }</small></div>
        <div><button type="button" onClick={() => controller.toggle(alert.id)}>{alert.armed ? 'Disarm' : 'Rearm'}</button>
          <button type="button" onClick={() => controller.remove(alert.id)} aria-label={`Remove ${alert.symbol} ${alert.node} alert`}>×</button></div>
        {alert.last && <small>{alert.last.message}</small>}
      </li>)}
    </ul> : <p>Arm a level to monitor it while the terminal is open.</p>}
  </section>
}
