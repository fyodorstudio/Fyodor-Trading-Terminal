import { useState } from 'react'
import type { ExternalSource } from '../external-sources/external-source-model'
import { RecordDetails, VersionHistory } from '../external-sources/ExternalRecordDetails'
import { externalIconEnabled, setExternalIconVisibility, useExternalIconVisibility } from '../external-sources/external-icon-visibility'
import { jakartaDisplay } from './alarm-time'

export function ExternalEventDetails({ item, compact = false }: { item: ExternalSource; compact?: boolean }) {
  const visibility = useExternalIconVisibility(), [error, setError] = useState('')
  return <div className="alert-external-evidence">
    {(item.event_at || item.event_date || item.risk_status === 'ongoing') && <label className="alert-chart-choice"><input type="checkbox" aria-label={`Show ${item.title} icon on chart`}
      checked={externalIconEnabled(item, visibility)} onChange={event => {
        setError(setExternalIconVisibility(item.key, event.target.checked, item.chart_icon_request_id ?? null) ? '' : 'Could not save chart visibility')
      }} />{item.event_at || item.event_date ? 'Show icon on chart' : 'Show risk notice on charts'}</label>}
    {error && <p role="status">{error}</p>}
    {compact ? <>
      <ul>{item.sources.filter(source => source.kind === 'web').map((source, index) => <li key={index}>
        <a href={source.locator} target="_blank" rel="noreferrer">{source.label}</a>{source.note && ` · ${source.note}`}</li>)}</ul>
      <details><summary>Source details &amp; version history</summary><RecordDetails item={item} timeDisplay={jakartaDisplay} />
        <VersionHistory key={item.id} item={item} timeDisplay={jakartaDisplay} /></details>
    </> : <><RecordDetails item={item} timeDisplay={jakartaDisplay} /><VersionHistory key={item.id} item={item} timeDisplay={jakartaDisplay} /></>}
  </div>
}
