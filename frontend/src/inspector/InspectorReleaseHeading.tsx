import { formatAppTimestamp, timeDisplayZoneLabel, type TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { symbolGlyph } from './event-symbols'
import { InspectorInfoTooltip } from './InspectorInfoTooltip'
import type { InspectorRelease } from './inspector-data'
import type { InspectorView } from './useInspector'

export function InspectorReleaseHeading({ release, view, timeDisplay, status, sharedPeriod, hasMagnitude, calendarDetail, coverageDetail }: {
  release: InspectorRelease; view: InspectorView; timeDisplay: TimeDisplayPreference; status: string
  sharedPeriod: number | null; hasMagnitude: boolean; calendarDetail: string
  coverageDetail?: string | null
}) {
  return <div className="inspector-detail-heading" aria-label="Selected release details">
    <strong className={`inspector-currency-${release.currency}`}>
      {symbolGlyph(view.preferences.symbols[release.familyId] ?? 'star')} {release.label} · {release.country} · {release.currency}</strong>
    <span className="inspector-release-date" data-clock="display">{release.releaseAt === null ? 'Display time unavailable' :
      formatAppTimestamp(release.releaseAt, timeDisplay)} ({timeDisplayZoneLabel(timeDisplay)})</span>
    <InspectorInfoTooltip label="Release information">
      {view.brokerTime && <span className="inspector-info-line" data-clock="broker">{release.chartTime === null ? 'Broker time unavailable' :
        `broker time · ${formatAppTimestamp(release.chartTime * 1000, { mode: 'utc', utcOffsetMinutes: 0 })}`}</span>}
      <span className="inspector-info-line">{status}{sharedPeriod !== null && <> <span className="inspector-shared-period"
        title="Reference period covered by these readings. The source represents the period by its starting date.">Period: {formatAppTimestamp(sharedPeriod * 1000,
          { mode: 'utc', utcOffsetMinutes: 0 }, 'date')}</span></>}</span>
      <span className="inspector-info-line">{calendarDetail}</span>
      {coverageDetail && <span className="inspector-info-line">{coverageDetail}</span>}
      <span className="inspector-info-line">A−P uses Previous; revised Previous is shown separately.
        pp = percentage points · bp = basis points.
        {hasMagnitude && <> Reading colors: Higher = green, Lower = red, Unchanged = gray. Signed USD scores use their own direction rules. Sizes appear only when a magnitude mode is configured in Scatter Plot.</>}</span>
    </InspectorInfoTooltip>
  </div>
}
