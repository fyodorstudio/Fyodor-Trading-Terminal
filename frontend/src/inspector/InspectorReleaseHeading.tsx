import { useId } from 'react'
import { formatAppTimestamp, timeDisplayLabel, type TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { symbolGlyph } from './event-symbols'
import type { InspectorRelease } from './inspector-data'
import type { InspectorView } from './useInspector'

export function InspectorReleaseHeading({ release, view, timeDisplay, status, sharedPeriod, hasMagnitude }: {
  release: InspectorRelease; view: InspectorView; timeDisplay: TimeDisplayPreference; status: string
  sharedPeriod: number | null; hasMagnitude: boolean
}) {
  const infoId = useId()
  return <div className="inspector-detail-heading" aria-label="Selected release details">
    <strong className={`inspector-currency-${release.currency}`}>
      {symbolGlyph(view.preferences.symbols[release.familyId] ?? 'star')} {release.label} · {release.country} · {release.currency}</strong>
    <div className="inspector-release-clocks" aria-label="Selected release clocks">
      <span data-clock="display">Display · {timeDisplayLabel(timeDisplay)} · {release.releaseAt === null ? 'Display time unavailable' :
        formatAppTimestamp(release.releaseAt, timeDisplay)}</span>
      {view.brokerTime && <><span aria-hidden="true"> | </span><span data-clock="broker">{release.chartTime === null ? 'Broker time unavailable' :
        `broker time · ${formatAppTimestamp(release.chartTime * 1000, { mode: 'utc', utcOffsetMinutes: 0 })}`}</span></>}
      <span aria-hidden="true"> | </span>
      <span>{status}{sharedPeriod !== null && <> <span className="inspector-shared-period"
        title="Reference period covered by these readings. The source represents the period by its starting date.">Period: {formatAppTimestamp(sharedPeriod * 1000,
          { mode: 'utc', utcOffsetMinutes: 0 }, 'date')}</span></>}</span>
    </div>
    <span className="inspector-info"><button type="button" aria-label="About A−P" aria-describedby={infoId}>ⓘ</button>
      <span id={infoId} role="tooltip">A−P uses Previous; revised Previous is shown separately.
        pp = percentage points · bp = basis points.
        {hasMagnitude && <> Reading colors: Higher = green, Lower = red, Unchanged = gray. Signed USD scores use their own direction rules. Sizes appear only when a magnitude mode is configured in Scatter Plot.</>}</span></span>
  </div>
}
