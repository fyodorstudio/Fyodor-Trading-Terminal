import { formatAppTimestamp, timeDisplayZoneLabel, type TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { symbolGlyph } from '../economic-calendar/presentation/event-symbols'
import { InspectorInfoTooltip } from './InspectorInfoTooltip'
import type { InspectorRelease } from '../economic-calendar/releases/release'
import type { InspectorView } from './useInspector'
import { releaseTimeLabel } from './releases/release-time-label'
import { InspectorCalendarIcon } from './chart/InspectorCalendarIcon'
import { officialActualSource } from '../economic-calendar/presentation/calendar-evidence'

function releaseSources(release: InspectorRelease) {
  const sources = new Map<string, { field: string; name: string; url?: string }>()
  for (const event of release.events) {
    const schedule = event.calendar_sources?.schedule ?? { name: event.timing_basis === 'manual-override' ? 'Calendar override' : 'MT5' }
    const actual = officialActualSource(event) ?? (event.actual == null ? undefined : { name: 'MT5' })
    const forecast = event.calendar_sources?.forecast ?? (event.forecast == null ? undefined : { name: 'MT5' })
    for (const [field, source] of [['Schedule', schedule], ['Actual', actual], ['Forecast', forecast]] as const) {
      if (source) sources.set(`${field}:${source.name}:${'url' in source ? source.url : ''}`, { field, ...source })
    }
  }
  return [...sources.values()]
}

export function InspectorReleaseHeading({ release, view, timeDisplay, status, sharedPeriod, calendarDetail, coverageDetail }: {
  release: InspectorRelease; view: InspectorView; timeDisplay: TimeDisplayPreference; status: string
  sharedPeriod: number | null; calendarDetail: string
  coverageDetail?: string | null
}) {
  const sources = releaseSources(release)
  return <div className="inspector-detail-heading" aria-label="Selected release details">
    <strong className={`inspector-currency-${release.currency}`}>
      {release.daily ? <><InspectorCalendarIcon /> {release.currency} · {release.label}</> : <>
        {symbolGlyph(view.preferences.symbols[release.familyId] ?? 'star')} {release.label} · {release.country} · {release.currency}</>}</strong>
    <span className="inspector-release-date" data-clock="display">{release.releaseAt === null && !release.timingUncertain ? 'Display time unavailable' : releaseTimeLabel(release, timeDisplay)}
      {!release.timingUncertain && ` (${timeDisplayZoneLabel(timeDisplay)})`}</span>
    <InspectorInfoTooltip label={release.daily ? 'Day information' : 'Release information'}>
      {!release.daily && <span className="inspector-info-line">{status}{sharedPeriod !== null && <> <span className="inspector-shared-period"
        title="Reference period covered by these readings. The source represents the period by its starting date.">Period: {formatAppTimestamp(sharedPeriod * 1000,
          { mode: 'utc', utcOffsetMinutes: 0 }, 'date')}</span></>}</span>}
      <span className="inspector-info-line">{calendarDetail}</span>
      {coverageDetail && <span className="inspector-info-line">{coverageDetail}</span>}
      <span className="inspector-info-line">A−P uses Previous; revised Previous is shown separately.
        pp = percentage points · bp = basis points.
</span>
    </InspectorInfoTooltip>
    <div className="inspector-release-sources"><span>Source</span>{sources.map(({ field, name, url }) =>
      <span key={`${field}:${name}:${url ?? ''}`}>
        {field} · {url ? <a href={url} target="_blank" rel="noreferrer">{name}</a> : name}
      </span>)}</div>
  </div>
}
