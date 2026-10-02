import { useEffect, useState, type ReactNode } from 'react'
import { formatUtcOffset } from '../../appearance/time-display/time-display-preference'
import type { BridgeHealth, BridgeOperation } from './bridge-contract'
import './data-heartbeat-panel.css'

type DataHeartbeatPanelProps = {
  health: BridgeHealth | null
  reachable: boolean
  lastContactAt: number | null
  roundTripMs: number | null
  probeStartedAt: number | null
  clockExtra?: ReactNode
}

function elapsedLabel(milliseconds: number | null) {
  if (milliseconds === null) return 'Never'
  if (milliseconds < 1_000) return `${milliseconds}ms`
  if (milliseconds < 60_000) return `${(milliseconds / 1_000).toFixed(1)}s`
  return `${Math.floor(milliseconds / 60_000)}m ${Math.floor(milliseconds % 60_000 / 1_000)}s`
}

function operationDetail(operation: BridgeOperation | undefined, now: number) {
  if (!operation) return 'No operation yet'
  if (operation.state === 'running' && operation.operation_started_at) {
    return `${operation.operation} · ${elapsedLabel(now - operation.operation_started_at)}`
  }
  if (operation.last_error) return operation.last_error
  if (operation.last_success_at) {
    return `Last ${elapsedLabel(operation.last_duration_ms)} · ${elapsedLabel(now - operation.last_success_at)} ago`
  }
  return operation.operation ?? 'Waiting'
}

const VERIFIED_CLOCK_STORAGE_KEY = 'fyodor.source-clock.verified'

function readVerifiedClock(): boolean {
  try {
    return window.localStorage.getItem(VERIFIED_CLOCK_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function saveVerifiedClock(verified: boolean): void {
  try {
    window.localStorage.setItem(VERIFIED_CLOCK_STORAGE_KEY, verified ? 'true' : 'false')
  } catch {
    // Ignore storage quota
  }
}

export function DataHeartbeatPanel({ health, reachable, lastContactAt, roundTripMs, probeStartedAt, clockExtra }: DataHeartbeatPanelProps) {
  const [now, setNow] = useState(() => Date.now())
  const [clockVerified, setClockVerified] = useState(readVerifiedClock)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [])

  const toggleClockVerification = () => {
    setClockVerified((current) => {
      const next = !current
      saveVerifiedClock(next)
      return next
    })
  }

  const mt5 = health?.mt5
  const calendar = health?.calendar
  const probeAge = probeStartedAt ? now - probeStartedAt : 0
  const healthOverdue = !reachable
    || lastContactAt === null
    || probeAge > 5_000
    || now - lastContactAt > 7_000
  const healthFresh = !healthOverdue
  const mt5Available = healthFresh && mt5?.connected === true
  const terminalName = mt5?.terminal_path ? mt5.terminal_path.split(/[\\/]/).pop() : null
  const cards = [
    {
      label: 'Bridge',
      state: healthOverdue ? 'bad' : probeStartedAt ? 'busy' : 'good',
      value: healthOverdue ? (reachable ? 'Unresponsive' : 'Unreachable') : probeStartedAt ? 'Checking' : 'Running',
      detail: healthOverdue && probeStartedAt
        ? `Health probe overdue · ${elapsedLabel(probeAge)}`
        : probeStartedAt
        ? `Probe ${elapsedLabel(now - probeStartedAt)}`
        : lastContactAt
          ? `${elapsedLabel(roundTripMs)} round trip · ${elapsedLabel(now - lastContactAt)} ago`
          : 'No contact yet',
      onClick: undefined,
    },
    {
      label: 'MT5 terminal',
      state: !healthFresh ? 'bad' : mt5?.connected ? 'good' : mt5?.process_running ? 'warn' : 'bad',
      value: !healthFresh ? 'Unknown' : mt5?.connected ? 'Connected' : mt5?.process_running ? 'Disconnected' : 'Not running',
      detail: !healthFresh ? 'Fresh bridge health is unavailable' : mt5?.connected
        ? `${mt5.account_server ?? 'Broker'} · login ${mt5.account_login ?? '—'} · gen ${mt5.generation} · PID ${mt5.process_id ?? '—'}${terminalName ? ` (${terminalName})` : ''}`
        : mt5?.last_error ?? 'Waiting for status',
      onClick: undefined,
    },
    {
      label: 'Market Watch',
      state: !mt5Available ? 'bad' : !health?.operations.market_watch ? 'warn' : health.operations.market_watch.state === 'failed' ? 'bad' : health.operations.market_watch.state === 'running' ? 'busy' : 'good',
      value: !healthFresh ? 'Unknown' : !mt5Available ? 'Unavailable' : health?.operations.market_watch?.state === 'running' ? 'Fetching' : `${health?.operations.market_watch?.count ?? 0} symbols`,
      detail: !healthFresh ? 'Fresh bridge health is unavailable' : !mt5Available ? mt5?.last_error ?? 'MT5 is not connected' : operationDetail(health?.operations.market_watch, now),
      onClick: undefined,
    },
    {
      label: 'Chart OHLC',
      state: !mt5Available ? 'bad' : !health?.operations.ohlc ? 'warn' : health.operations.ohlc.state === 'failed' ? 'bad' : health.operations.ohlc.state === 'running' ? 'busy' : 'good',
      value: !healthFresh ? 'Unknown' : !mt5Available ? 'Unavailable' : health?.operations.ohlc?.state === 'running' ? 'Fetching' : `${health?.operations.ohlc?.count ?? 0} bars`,
      detail: !healthFresh ? 'Fresh bridge health is unavailable' : !mt5Available ? mt5?.last_error ?? 'MT5 is not connected' : operationDetail(health?.operations.ohlc, now),
      onClick: undefined,
    },
    {
      label: 'Calendar EA',
      state: !healthFresh ? 'bad' : calendar?.status === 'live' ? 'good' : calendar?.status === 'stale' ? 'bad' : 'warn',
      value: !healthFresh ? 'Unknown' : calendar?.status === 'live' ? 'Live' : calendar?.status.replaceAll('-', ' ') ?? 'Waiting',
      detail: !healthFresh ? 'Fresh bridge health is unavailable' : calendar?.last_heartbeat_at
        ? `${calendar.event_count} events · send ${elapsedLabel(calendar.publisher_request_duration_ms)} · ${elapsedLabel(now - calendar.last_heartbeat_at)} ago`
        : 'Attach the calendar publisher EA',
      onClick: undefined,
    },
    {
      label: 'Source clock',
      state: healthFresh && calendar?.clock_trust === 'observed' && calendar.status === 'live'
        ? (clockVerified ? 'good' : 'warn')
        : 'bad',
      value: healthFresh && calendar?.clock_trust === 'observed'
        ? (clockVerified ? 'Verified' : calendar.status === 'live' ? 'Observed' : 'Last observed')
        : 'Unverified',
      detail: !healthFresh
        ? 'Fresh bridge health is unavailable'
        : calendar?.server_utc_offset_seconds === null || calendar?.server_utc_offset_seconds === undefined
        ? 'Waiting for broker clock'
        : clockVerified
        ? `Broker ${formatUtcOffset(calendar.server_utc_offset_seconds / 60)} · verified (click to reset)`
        : `Broker ${formatUtcOffset(calendar.server_utc_offset_seconds / 60)} · click to verify`,
      onClick: calendar?.clock_trust === 'observed' && calendar.status === 'live' ? toggleClockVerification : undefined,
      extra: clockExtra,
    },
  ]
  return (
    <section className="data-heartbeat" aria-label="Data heartbeat">
      {cards.map((card) => (
        <article
          className={`heartbeat-card ${card.state}${card.onClick ? ' clickable' : ''}`}
          key={card.label}
          onClick={card.onClick}
          role={card.onClick ? 'button' : undefined}
          tabIndex={card.onClick ? 0 : undefined}
        >
          <div className="heartbeat-card-header">
            <span>{card.label}</span>
            {card.extra && <div className="heartbeat-card-extra" onClick={(e) => e.stopPropagation()}>{card.extra}</div>}
          </div>
          <strong><i />{card.value}</strong>
          <small title={card.detail}>{card.detail}</small>
        </article>
      ))}
    </section>
  )
}
