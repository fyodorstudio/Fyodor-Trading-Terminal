import { useMemo, useState, type ReactNode } from 'react'
import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { activitySources, type ActivityLogEntry, type ActivitySource } from './activity-log-entry'
import { readVisibleActivitySources, saveVisibleActivitySources } from './activity-source-preference'
import './activity-log-panel.css'

type ActivityLogPanelProps = {
  entries: ActivityLogEntry[]
  timeDisplay: TimeDisplayPreference
  onClear: () => void
  renderHeartbeat?: (actions: ReactNode) => ReactNode
  heartbeat?: ReactNode
}

export function ActivityLogPanel({ entries, timeDisplay, onClear, renderHeartbeat, heartbeat }: ActivityLogPanelProps) {
  const [visibleSources, setVisibleSources] = useState<Set<ActivitySource>>(readVisibleActivitySources)
  const visibleEntries = useMemo(
    () => entries.filter((entry) => visibleSources.has(entry.source)),
    [entries, visibleSources],
  )

  const toggleSource = (source: ActivitySource) => {
    setVisibleSources((current) => {
      const next = new Set(current)
      if (next.has(source)) next.delete(source)
      else next.add(source)
      saveVisibleActivitySources(next)
      return next
    })
  }

  const actions = (
    <div className="activity-heading-actions" onClick={(event) => event.stopPropagation()}>
      <details className="activity-source-filter">
        <summary>Sources <span>{visibleSources.size}/{activitySources.length}</span></summary>
        <div>
          {activitySources.map((source) => (
            <label key={source}>
              <input type="checkbox" checked={visibleSources.has(source)} onChange={() => toggleSource(source)} />
              {source}
            </label>
          ))}
        </div>
      </details>
      <button type="button" onClick={onClear} disabled={entries.length === 0}>Clear</button>
    </div>
  )

  const heartbeatNode = renderHeartbeat ? renderHeartbeat(actions) : heartbeat

  return (
    <section className="activity-panel" aria-label="Activity log">
      {heartbeatNode}

      <div className="activity-table" role="log" aria-live="polite">
        <div className="activity-table-columns" aria-hidden="true">
          <span>Time</span><span>Source</span><span>Action</span><span>Detail</span>
        </div>
        <div className="activity-table-rows">
          {[...visibleEntries].reverse().map((entry) => (
            <div className={`activity-row ${entry.severity ?? 'info'}`} key={entry.id}>
              <time dateTime={new Date(entry.occurredAt).toISOString()}>{formatAppTimestamp(entry.occurredAt, timeDisplay, 'time')}</time>
              <strong>{entry.source}</strong>
              <span>{entry.action}</span>
              <span>{entry.detail ?? '—'}</span>
            </div>
          ))}
          {visibleEntries.length === 0 && <p className="activity-empty">No activity matches the selected sources.</p>}
        </div>
      </div>
    </section>
  )
}
