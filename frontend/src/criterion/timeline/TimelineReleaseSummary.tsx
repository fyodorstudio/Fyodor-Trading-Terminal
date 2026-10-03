import type { TimelineReleaseBlock } from './CpiEventTimelineTable'
import { releaseSummary, signedChange } from './timeline-release-summary'
import { eventCurrencySide } from './timeline-event-filters'

export function TimelineReleaseSummary({ block }: { block: TimelineReleaseBlock }) {
  const lines = releaseSummary(block)
  if (!lines.length) return null
  return <span className={`timeline-release-summary timeline-currency-${eventCurrencySide(block.currency)}`}
    aria-label="Release change summary" title="pp = percentage points; bp = basis points (100 bp = 1 pp). A−P uses exported Previous, not Forecast or revised Previous. Headline already includes core; their sum is descriptive arithmetic, not an official inflation aggregate or a measure of market impact. Rate changes do not quantify policy guidance.">
    {lines.map((line) => <span className="timeline-summary-line" key={line.label}>
      <strong>{line.label}</strong>
      <span>{line.values.map((value) => `${value.label} ${value.delta === null ? '—' : signedChange(value.delta)}${value.delta === null ? '' : ` ${line.unit}`}`).join(' · ')}</span>
      {'sum' in line && <b>Sum {line.sum === null || line.sum === undefined ? '—' : `${signedChange(line.sum)} pp`}</b>}
      <span className="timeline-summary-assessment" title={line.reason}>{line.assessment}</span>
      {line.reason && <small>{line.reason}</small>}
    </span>)}
    {lines.some((line) => 'sum' in line) && <small className="timeline-summary-note">A−P vs Previous · descriptive sum; headline includes core</small>}
    {lines.some((line) => line.unit === 'bp' && line.values.length > 0) && <small className="timeline-summary-note">Rate change only · speeches and guidance are not scored</small>}
  </span>
}
