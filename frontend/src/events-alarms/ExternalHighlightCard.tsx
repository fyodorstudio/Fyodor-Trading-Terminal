import { useState } from 'react'
import type { ExternalSource } from '../external-sources/external-source-model'
import { RecordDetails, VersionHistory } from '../external-sources/ExternalRecordDetails'
import { externalIconEnabled, setExternalIconVisibility, useExternalIconVisibility } from '../external-sources/external-icon-visibility'
import { jakartaDisplay } from './alarm-time'

export function ExternalEventDetails({ item }: { item: ExternalSource }) {
  const visibility = useExternalIconVisibility(), [error, setError] = useState('')
  return <div className="alert-external-evidence">
    {(item.event_at || item.event_date) && <label className="alert-chart-choice"><input type="checkbox" aria-label={`Show ${item.title} icon on chart`}
      checked={externalIconEnabled(item, visibility)} onChange={event => {
        setError(setExternalIconVisibility(item.key, event.target.checked, item.chart_icon_request_id ?? null) ? '' : 'Could not save chart visibility')
      }} />Show icon on chart</label>}
    {error && <p role="status">{error}</p>}
    <RecordDetails item={item} timeDisplay={jakartaDisplay} /><VersionHistory key={item.id} item={item} timeDisplay={jakartaDisplay} />
  </div>
}
