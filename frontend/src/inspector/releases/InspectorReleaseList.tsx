import { memo, useMemo } from 'react'
import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import type { InspectorRelease, InspectorPreferences } from '../inspector-data'
import { symbolGlyph } from '../event-symbols'
import { releaseStatus } from './release-status'

function InspectorReleaseListComponent({ id, hidden, releases, selectedId, symbols, timeDisplay, brokerTime, now, onSelect }: {
  id: string; hidden: boolean; releases: readonly InspectorRelease[]; selectedId: string | null;
  symbols: InspectorPreferences['symbols']; timeDisplay: TimeDisplayPreference;
  brokerTime: boolean; now: number; onSelect: (id: string) => void
}) {
  const rows = useMemo(() => releases.map(release => ({ release, time: brokerTime
    ? `${formatAppTimestamp(release.serverTime * 1000, { mode: 'utc', utcOffsetMinutes: 0 })} · broker time`
    : release.releaseAt === null ? 'Time unavailable' : formatAppTimestamp(release.releaseAt, timeDisplay) })), [releases, brokerTime, timeDisplay])
  return <nav id={id} hidden={hidden} className="inspector-releases" aria-label="Inspector releases">
    {!rows.length && <p className="inspector-empty">No releases match this date range and filter selection.</p>}
    {rows.map(({ release, time }) => <button type="button" key={release.id} aria-pressed={selectedId === release.id}
      className={`inspector-release${selectedId === release.id ? ' selected' : ''}`} onClick={() => onSelect(release.id)}>
      <span className={`inspector-currency-${release.currency}`}><b>{symbolGlyph(symbols[release.familyId] ?? 'star')} {release.currency}</b> · {release.country}</span>
      <strong>{release.label}</strong><time>{time}</time>
      <small>{release.timingUncertain ? 'Time uncertain · ' : ''}{releaseStatus(release, now, brokerTime)} · {release.events.length} readings</small>
    </button>)}
  </nav>
}
export const InspectorReleaseList = memo(InspectorReleaseListComponent)
