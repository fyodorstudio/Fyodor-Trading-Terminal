import { memo, useMemo } from 'react'
import type { ExternalSource } from './external-source-model'
import { formatAppTimestamp } from '../appearance/time-display/time-display-preference'
import { useCalendarNow } from '../inspector/useCalendarNow'
import { alertComingIn } from '../alert/model/alert-format'
import { useOngoingRiskVisibility } from './ongoing-risk-visibility'
import './ongoing-risk-notices.css'

const riskDisplay = { mode: 'fixed-offset' as const, utcOffsetMinutes: 420, hour12: true }
const NextScheduledRisk = memo(function NextScheduledRisk({ next, now, onSelect }: {
  next?: ExternalSource; now: number; onSelect: (key: string) => void
}) {
  return next ? <button type="button" className="ongoing-risk-next" onClick={() => onSelect(next.key)}>
    <span>Next scheduled: {next.title}</span>
    <small>{alertComingIn(Date.parse(next.event_at!), now)} · {formatAppTimestamp(Date.parse(next.event_at!), riskDisplay)} Jakarta</small>
  </button> : <small>No verified future release time in saved risks.</small>
})

export const OngoingRiskNotices = memo(function OngoingRiskNotices({ items, onSelect }: {
  items: readonly ExternalSource[]; onSelect: (key: string) => void
}) {
  const visible = useOngoingRiskVisibility()
  const scheduled = useMemo(() => items.filter(item => !item.archived && item.kind === 'scheduled' && item.status === 'confirmed'
    && item.risk_status !== 'resolved' && item.event_at).sort((a, b) => Date.parse(a.event_at!) - Date.parse(b.event_at!)), [items])
  const now = useCalendarNow(0, 1000, visible && scheduled.length > 0)
  let low = 0, high = scheduled.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (Date.parse(scheduled[middle].event_at!) <= now) low = middle + 1
    else high = middle
  }
  const next = scheduled[low]
  const ongoing = useMemo(() => items.filter(item => !item.archived && item.risk_status === 'ongoing'), [items])
  if (!visible || !ongoing.length && !next) return null
  return <section className="ongoing-risk-notices" aria-label="Current ongoing risks">
    <strong>Current ongoing risks · updates may be unscheduled</strong>
    {ongoing.map(item => <button type="button" key={item.key} onClick={() => onSelect(item.key)}>
      <span>★ {item.title}</span>
      <small>{item.visibility_scope === 'global' ? 'Global · ' : ''}Assessed {item.risk_checked_utc
        ? formatAppTimestamp(Date.parse(item.risk_checked_utc), riskDisplay) : 'time unavailable'} Jakarta</small>
    </button>)}
    <NextScheduledRisk next={next} now={now} onSelect={onSelect} />
  </section>
})
