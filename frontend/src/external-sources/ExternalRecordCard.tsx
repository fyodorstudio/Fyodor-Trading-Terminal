import { useState } from 'react'
import { formatAppTimestamp, type TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import type { ExternalSource } from './external-source-model'
import { RecordDetails, VersionHistory } from './ExternalRecordDetails'

export function ExternalRecordCard({ item, timeDisplay, focused, iconVisible, onIconChange }: {
  item: ExternalSource; timeDisplay: TimeDisplayPreference; focused: boolean; iconVisible: boolean; onIconChange: (visible: boolean) => void
}) {
  const [open, setOpen] = useState(focused), [savedFocus, setSavedFocus] = useState(focused)
  if (savedFocus !== focused) { setSavedFocus(focused); if (focused) setOpen(true) }
  const timed = item.kind !== 'watch' && !!(item.event_at || item.event_date)
  const kind = item.kind === 'scheduled' ? 'Scheduled' : item.kind === 'headline' ? 'Headline' : 'Watch item'
  return <article className="external-record" data-external-key={item.key}>
    <div className="external-record-row">
      <button type="button" className="external-record-toggle" aria-expanded={open} aria-controls={`external-details-${item.key}`} onClick={() => setOpen(value => !value)}>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span><strong>{item.title}</strong>
      </button>
      <span className="external-record-currency">{item.currencies.join(' / ')}</span>
      <span className="external-record-type">{kind}<small>{item.status}</small></span>
      <span className="external-record-time">{item.event_at ? formatAppTimestamp(Date.parse(item.event_at), timeDisplay) : item.event_date ?
        formatAppTimestamp(Date.parse(item.event_date + 'T00:00:00Z'), { mode: 'utc', utcOffsetMinutes: 0 }, 'date') : 'Unscheduled'}
        {!item.event_at && <small>{item.event_date ? 'Hour unconfirmed' : 'No verified event time'}</small>}
      </span>
      <label className="external-icon-toggle" title={timed ? 'Show this record’s star on pairs containing an affected currency' : 'A verified date or time is needed for a chart icon'}>
        <input type="checkbox" checked={timed && iconVisible} disabled={!timed} onChange={event => onIconChange(event.target.checked)} /> Show icon on chart
      </label>
    </div>
    {open && <div className="external-expanded-record" id={`external-details-${item.key}`}>
      <RecordDetails item={item} timeDisplay={timeDisplay} /><VersionHistory key={item.id} item={item} timeDisplay={timeDisplay} />
    </div>}
  </article>
}
