import { useMemo } from 'react'
import { formatAppTimestamp, timeDisplayLabel, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { useStoredCalendar } from '../../inspector/useStoredCalendar'
import { useCalendarNow } from '../../inspector/useCalendarNow'
import { policyEpisodeWindowMs } from '../../inspector/episodes/policy-episodes'
import { groupInspectorReleases, inspectorFamilies, type InspectorPreferences } from '../../inspector/inspector-data'
import { alertCountdown, alertEpisodesFromReleases, alertLookaheadDays, alertRecentDays, alertSeriesIds } from '../model/alert-episodes'
import './alert-dock.css'

export function AlertDock({ brokerId, preferences, timeDisplay, clockOffsetMs = 0, brokerOffsetSeconds = 0, supported = true }: {
  brokerId: string | null; preferences: InspectorPreferences; timeDisplay: TimeDisplayPreference
  clockOffsetMs?: number; brokerOffsetSeconds?: number; supported?: boolean
}) {
  const now = useCalendarNow(clockOffsetMs, 1000)
  const today = Math.floor(now / 86400000) * 86400000
  const range = useMemo(() => ({ from: today - alertRecentDays * 86400000 - policyEpisodeWindowMs,
    to: today + (alertLookaheadDays + 2) * 86400000 + policyEpisodeWindowMs }), [today])
  const eventIds = useMemo(() => alertSeriesIds(preferences), [preferences])
  const scope = useMemo(() => ({ eventIds }), [eventIds])
  const storage = useStoredCalendar(brokerId, range, supported && eventIds.length > 0, scope)
  // Group only when inventory/filters change, not on every countdown tick.
  const grouped = useMemo(() => groupInspectorReleases(storage.events.filter((event) => event.availability === 'observed')), [storage.events])
  const episodes = useMemo(() => alertEpisodesFromReleases(grouped, preferences, now), [grouped, preferences, now])
  const currencies = [...new Set(inspectorFamilies.filter((family) => preferences.families.includes(family.id)).map((family) => family.currency))]
  const brokerNow = now + brokerOffsetSeconds * 1000
  // Fetch margins protect grouping/clock boundaries but should not report an
  // uncovered margin beyond the visible 60-day schedule as missing coverage.
  const partial = !!storage.source && currencies.some((currency) => !storage.coverage[currency] ||
    storage.coverage[currency].missing.some(([from, to]) => from * 1000 < brokerNow + alertLookaheadDays * 86400000 &&
      to * 1000 > brokerNow - alertRecentDays * 86400000))
  const offline = !!storage.source && storage.source.publisher_status !== 'live'
  const message = !supported ? 'Alert currently supports EURUSD' : !brokerId ? 'Alert needs calendar storage' :
    !eventIds.length ? 'No families selected in Inspector filters' : storage.loading ? 'Loading upcoming releases…' : null
  return <section className="alert-dock" aria-label="Alert">
    <header className="alert-toolbar"><strong>Alert</strong><span>Inspector filters · {brokerId ?? 'No broker'}</span>
      <span>{timeDisplayLabel(timeDisplay)}</span></header>
    {message ? <p role="status">{message}</p> : <>
      {(storage.error || storage.collectorError || offline || partial) && <p className="alert-source-status" role="status">
        {storage.error ?? storage.collectorError ?? (offline ? 'Publisher offline · stored schedule may be stale' : 'Partial schedule coverage')}
      </p>}
      {!episodes.length && <p role="status">{storage.error ? 'Upcoming schedule unavailable' : 'No upcoming or awaiting releases in the available 60-day schedule'}</p>}
      <div className="alert-cards">{episodes.map(({ release, state }) => <article className={`alert-card alert-${state}`} key={release.id} data-alert-id={release.id}>
        <header><strong>{release.label}</strong><span>{state === 'upcoming' ? 'Upcoming' : state === 'awaiting' ? 'Awaiting release data' :
          state === 'partial' ? 'Partial release data' : 'Time unconfirmed'}</span></header>
        {state === 'upcoming' && <p className="alert-countdown">{alertCountdown(release.releaseAt!, now)}</p>}
        <span>{release.country} · {release.currency} · {state !== 'unconfirmed' ?
          formatAppTimestamp(release.releaseAt!, timeDisplay) : 'Exact release time unavailable'}</span>
      </article>)}</div>
    </>}
  </section>
}
