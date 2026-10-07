import { useMemo, useState, type ReactNode } from 'react'
import type { TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { activitySources, type ActivityLogEntry, type ActivitySource } from './activity-log-entry'
import { readVisibleActivitySources, saveVisibleActivitySources } from './activity-source-preference'
import { ActivityLogRows } from './ActivityLogRows'
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
    () => entries.filter((entry) => visibleSources.has(entry.source)).reverse(),
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

      <ActivityLogRows entries={visibleEntries} mode={timeDisplay.mode} utcOffsetMinutes={timeDisplay.utcOffsetMinutes} />
    </section>
  )
}
