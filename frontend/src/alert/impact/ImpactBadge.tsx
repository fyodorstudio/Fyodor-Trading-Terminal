import { memo } from 'react'
import { formatAppTimestamp } from '../../appearance/time-display/time-display-preference'
import { safeWebUrl } from '../../external-sources/external-source-model'
import type { AlertImpact } from './useAlertImpact'
import './impact.css'

const display = { mode: 'fixed-offset' as const, utcOffsetMinutes: 420, hour12: true }
const assessedAt = (item: AlertImpact) => `${formatAppTimestamp(Date.parse(item.as_of_utc), display)} Jakarta`
export const ImpactBadge = memo(function ImpactBadge({ item }: { item?: AlertImpact }) {
  const label = item ? item.level[0].toUpperCase() + item.level.slice(1) : 'Not assessed'
  return <span className={`alert-ai-impact ${item?.level ?? 'unassessed'}`} aria-label={`AI impact: ${label}`}
    title={item ? `AI-assessed impact · ${assessedAt(item)}\n${item.reason}\nExpected market relevance, not trade direction or guaranteed volatility.` : 'AI impact has not been assessed. Broker importance is not used.'}>
    <span className="alert-ai-impact-box" aria-hidden="true" />AI {item ? label : '—'}
  </span>
})
export const ImpactDetails = memo(function ImpactDetails({ item }: { item?: AlertImpact }) {
  if (!item) return null
  return <div className="alert-ai-impact-details"><p><strong>AI impact: {item.level}</strong> · Assessed {assessedAt(item)}</p>
    <p>{item.reason}</p><p>Expected market relevance; direction depends on the surprise and current backdrop.</p>
    <p>{item.sources.filter(source => source.kind === 'web' && safeWebUrl(source.locator)).map((source, index) => <a key={`${index}:${source.locator}`}
      href={source.locator} target="_blank" rel="noreferrer">{source.label}</a>)}</p>
  </div>
})
