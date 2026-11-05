import { memo } from 'react'
import { formatAppTimestamp } from '../../appearance/time-display/time-display-preference'
import { safeWebUrl } from '../../external-sources/external-source-model'
import type { AlertImpact } from './useAlertImpact'
import { calendarTier, eventClassification, eventTiers, isEventTier } from '../../event-tiers/event-tiers'
import './impact.css'

const display = { mode: 'fixed-offset' as const, utcOffsetMinutes: 420, hour12: true }
const assessedAt = (item: AlertImpact) => `${formatAppTimestamp(Date.parse(item.as_of_utc), display)} Jakarta`
type TierEvent = { event_id: string; currency: string; country_code: string }
function tierFor(item?: AlertImpact, event?: TierEvent) {
  return event ? calendarTier(event) : isEventTier(item?.level) ? item.level : 'C'
}
export const ImpactBadge = memo(function ImpactBadge({ item, event }: { item?: AlertImpact; event?: TierEvent }) {
  const tier = tierFor(item, event), label = eventTiers.find(t => t.id === tier)!.label
  const note = event && !eventClassification(event) ? 'Secondary fallback for an unmapped series.'
    : !event && !isEventTier(item?.level) ? 'Secondary fallback; no S/A/B/C assessment is saved for this record.' : 'Shared currency tier list.'
  return <span className={`alert-ai-impact tier-${tier}`} aria-label={`Tier: ${label}`}
    title={`${note}${item ? `\nAssessment · ${assessedAt(item)}\n${item.reason}` : ''}`}>
    <span className="alert-ai-impact-box" aria-hidden="true" />{label}
  </span>
})
export const ImpactDetails = memo(function ImpactDetails({ item, event }: { item?: AlertImpact; event?: TierEvent }) {
  if (!item) return null
  return <div className="alert-ai-impact-details"><p><strong>Tier: {tierFor(item, event)}</strong> · Assessed {assessedAt(item)}</p>
    <p>{item.reason}</p><p>Expected market relevance; direction depends on the surprise and current backdrop.</p>
    <p>{item.sources.filter(source => source.kind === 'web' && safeWebUrl(source.locator)).map((source, index) => <a key={`${index}:${source.locator}`}
      href={source.locator} target="_blank" rel="noreferrer">{source.label}</a>)}</p>
  </div>
})
