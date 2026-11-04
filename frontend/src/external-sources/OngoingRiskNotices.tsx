import type { ExternalSource } from './external-source-model'
import { formatAppTimestamp } from '../appearance/time-display/time-display-preference'
import './ongoing-risk-notices.css'

export function OngoingRiskNotices({ items, onSelect }: {
  items: readonly ExternalSource[]; onSelect: (key: string) => void
}) {
  const ongoing = items.filter(item => !item.archived && item.risk_status === 'ongoing')
  if (!ongoing.length) return null
  return <section className="ongoing-risk-notices" aria-label="Current ongoing risks">
    <strong>Current ongoing risks · updates may be unscheduled</strong>
    {ongoing.map(item => <button type="button" key={item.key} onClick={() => onSelect(item.key)}>
      <span>★ {item.title}</span>
      <small>{item.visibility_scope === 'global' ? 'Global · ' : ''}Assessed {item.risk_checked_utc
        ? formatAppTimestamp(Date.parse(item.risk_checked_utc), { mode: 'fixed-offset', utcOffsetMinutes: 420, hour12: true }) : 'time unavailable'} Jakarta</small>
    </button>)}
  </section>
}
