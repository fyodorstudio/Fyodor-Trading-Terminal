import type { TimelineReleaseBlock } from './CpiEventTimelineTable'
import { releaseSummary, signedChange } from './timeline-release-summary'
import { eventCurrencySide } from './timeline-event-filters'

function assessmentBadgeClass(assessment: string): string {
  const lower = assessment.toLowerCase()
  if (lower === 'both higher' || lower === 'higher' || lower === 'hike') return 'status-higher'
  if (lower === 'both lower' || lower === 'lower' || lower === 'cut') return 'status-lower'
  if (lower === 'both unchanged' || lower === 'unchanged' || lower === 'hold') return 'status-unchanged'
  if (lower.includes('mixed') || (lower.includes('higher') && (lower.includes('lower') || lower.includes('unchanged')))) return 'status-mixed'
  return 'status-neutral'
}

export function TimelineReleaseSummary({ block }: { block: TimelineReleaseBlock }) {
  const lines = releaseSummary(block)
  if (!lines.length) return null
  const isCommentary = lines.length === 1 && (lines[0].label === 'Policy commentary' || lines[0].values.length === 0)
  return <span className={`timeline-release-summary timeline-currency-${eventCurrencySide(block.currency)}${isCommentary ? ' timeline-summary-inline' : ''}`}
    aria-label="Release change summary" title="pp = percentage points; bp = basis points (100 bp = 1 pp). A−P uses exported Previous, not Forecast or revised Previous. Headline already includes core; their sum is descriptive arithmetic, not an official inflation aggregate or a measure of market impact. Rate changes do not quantify policy guidance.">
    {lines.map((line) => <span className="timeline-summary-line" key={line.label}>
      <strong className="timeline-summary-metric-badge">{line.label}</strong>
      <span className="timeline-summary-values">
        {line.values.map((value, idx) => (
          <span key={value.label} className="timeline-summary-value-item">
            {idx > 0 && <span className="timeline-summary-bullet" aria-hidden="true">·</span>}
            <span className="timeline-summary-val-label">{value.label}</span>
            <span className="timeline-summary-val-num">{value.delta === null ? '—' : signedChange(value.delta)}{value.delta === null ? '' : ` ${line.unit}`}</span>
          </span>
        ))}
      </span>
      {'sum' in line && <span className="timeline-summary-sum">
        <span className="timeline-summary-divider" aria-hidden="true">│</span>
        <span className="timeline-summary-sum-label">Sum</span>
        <b className="timeline-summary-sum-num">{line.sum === null || line.sum === undefined ? '—' : `${signedChange(line.sum)} pp`}</b>
      </span>}
      <span className={`timeline-summary-assessment ${assessmentBadgeClass(line.assessment)}`} title={line.reason}>
        {line.assessment}
      </span>
      {line.reason && <small className="timeline-summary-reason">{line.reason}</small>}
    </span>)}
    {lines.some((line) => 'sum' in line) && <small className="timeline-summary-note">A−P vs Previous · descriptive sum; headline includes core</small>}
    {lines.some((line) => line.unit === 'bp' && line.values.length > 0) && <small className="timeline-summary-note">Rate change only · speeches and guidance are not scored</small>}
  </span>
}
