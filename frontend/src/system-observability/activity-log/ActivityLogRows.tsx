import { memo, useMemo } from 'react'
import { formatAppTimestamp, type TimeDisplayMode } from '../../appearance/time-display/time-display-preference'
import type { ActivityLogEntry } from './activity-log-entry'

type RowProps = { entry: ActivityLogEntry; mode: TimeDisplayMode; utcOffsetMinutes: number }
const ActivityLogRow = memo(function ActivityLogRow({ entry, mode, utcOffsetMinutes }: RowProps) {
  const timestamp = useMemo(() => ({
    iso: new Date(entry.occurredAt).toISOString(),
    label: formatAppTimestamp(entry.occurredAt, { mode, utcOffsetMinutes }, 'time'),
  }), [entry.occurredAt, mode, utcOffsetMinutes])
  return <div className={`activity-row ${entry.severity ?? 'info'}`}>
    <time dateTime={timestamp.iso}>{timestamp.label}</time>
    <strong>{entry.source}</strong>
    <span>{entry.action}</span>
    <span>{entry.detail ?? '—'}</span>
  </div>
})

// Health-status renders update the heartbeat, without rebuilding an unchanged log.
// Appending an entry preserves existing rows and formats only the new timestamp.
export const ActivityLogRows = memo(function ActivityLogRows({ entries, mode, utcOffsetMinutes }: {
  entries: readonly ActivityLogEntry[]; mode: TimeDisplayMode; utcOffsetMinutes: number
}) {
  return <div className="activity-table" role="log" aria-live="polite">
    <div className="activity-table-columns" aria-hidden="true">
      <span>Time</span><span>Source</span><span>Action</span><span>Detail</span>
    </div>
    <div className="activity-table-rows">
      {entries.map(entry => <ActivityLogRow key={entry.id} entry={entry} mode={mode} utcOffsetMinutes={utcOffsetMinutes} />)}
      {entries.length === 0 && <p className="activity-empty">No activity matches the selected sources.</p>}
    </div>
  </div>
})
