import { useCallback, useMemo, useState } from 'react'
import { formatAppTimestamp, timeDisplayLabel, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { chartClockToUtc, utcToChartClock } from '../../appearance/time-display/chart-clock'
import { useStoredCalendar } from '../../economic-calendar/storage/useStoredCalendar'
import { useCalendarNow } from '../../inspector/useCalendarNow'
import { policyEpisodeWindowMs } from '../../inspector/episodes/policy-episodes'
import { groupInspectorReleases } from '../../inspector/releases/group-releases'
import { inspectorFamilies } from '../../inspector/catalog/inspector-families'
import { alertCountdown, alertEpisodesFromReleases, alertCalendarScope } from '../model/alert-episodes'
import { alertCurrencies, alertHorizons, readAlertPreferences, saveAlertPreferences, type AlertPreferences } from '../model/alert-preferences'
import { AlertFiltersModal } from './AlertFiltersModal'
import './alert-dock.css'
import type { InspectorRelease } from '../../economic-calendar/releases/release'
import { HighlightList } from '../highlights/HighlightList'
import { useHighlights } from '../highlights/useHighlights'
import { highlightForRelease } from '../highlights/highlight-model'

const day = 86400000
export function AlertDock({ brokerId, timeDisplay, clockOffsetMs = 0, brokerOffsetSeconds = 0, onPrepareResearch }: {
  brokerId: string | null; timeDisplay: TimeDisplayPreference; clockOffsetMs?: number; brokerOffsetSeconds?: number
  onPrepareResearch?: (release: InspectorRelease) => void
}) {
  const [preferences, setPreferences] = useState(readAlertPreferences)
  const [highlight, setHighlight] = useState(() => { try { return localStorage.getItem('fyodor.alert.highlight-view.v1') === 'true' } catch { return false } })
  const changeHighlight = (value: boolean) => { setHighlight(value); try { localStorage.setItem('fyodor.alert.highlight-view.v1', String(value)) } catch { /* Keep the active tab for this session. */ } }
  const pins = useHighlights(highlight ? null : brokerId)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const closeFilters = useCallback(() => setFiltersOpen(false), [])
  const updatePreferences = useCallback((next: AlertPreferences) => { setPreferences(next); saveAlertPreferences(next) }, [])
  const now = useCalendarNow(clockOffsetMs, 1000)
  const today = Math.floor(now / day) * day
  const clock = useMemo(() => ({ brokerId, brokerOffsetSeconds }), [brokerId, brokerOffsetSeconds])
  const range = useMemo(() => ({ from: utcToChartClock(today - policyEpisodeWindowMs, clock) ?? today,
    to: utcToChartClock(today + (preferences.days + 2) * day + policyEpisodeWindowMs, clock) ?? today }), [today, preferences.days, clock])
  const families = preferences.families
  const scope = useMemo(() => alertCalendarScope({ families }), [families])
  const storage = useStoredCalendar(brokerId, range, !highlight && families.length > 0, scope)
  // Currency buttons filter the loaded inventory locally. Countdown ticks never regroup it.
  const grouped = useMemo(() => groupInspectorReleases(storage.events.filter(event => event.availability === 'observed')), [storage.events])
  const episodes = useMemo(() => alertEpisodesFromReleases(grouped, preferences, now, preferences.days,
    utcToChartClock(now, clock) ?? now)
    .filter(({ release }) => preferences.currency === 'all' || release.currency === preferences.currency), [grouped, preferences, now, clock])
  const days = new Map<string, typeof episodes>()
  for (const episode of episodes) {
    const at = episode.release.releaseAt ?? chartClockToUtc(episode.release.serverTime * 1000, clock)
    const date = episode.release.timingUncertain ? formatAppTimestamp(episode.release.serverTime * 1000, { mode: 'utc', utcOffsetMinutes: 0 }, 'date') :
      at === null || !Number.isFinite(at) ? 'Date unconfirmed' : formatAppTimestamp(at, timeDisplay, 'date')
    const group = days.get(date) ?? []; group.push(episode); days.set(date, group)
  }
  const currencies = inspectorFamilies.filter(f => preferences.families.includes(f.id) && (preferences.currency === 'all' || preferences.currency === f.currency)).map(f => f.currency)
  const brokerNow = utcToChartClock(now, clock) ?? now
  const partial = !!storage.source && currencies.some(currency => !storage.coverage[currency] ||
    storage.coverage[currency].missing.some(([from, to]) => from * 1000 < brokerNow + preferences.days * day && to * 1000 > brokerNow))
  const offline = !!storage.source && storage.source.publisher_status !== 'live'
  const message = !brokerId ? 'Alert needs calendar storage' : !families.length ? 'No families selected in Alert filters' : storage.loading ? 'Loading upcoming releases…' : null
  return <section className="alert-dock" aria-label="Alert">
    <header className="alert-toolbar"><strong>Alert</strong>
      <nav className="alert-currencies" aria-label="Alert currency"><button type="button" aria-pressed={highlight} onClick={() => changeHighlight(true)}>Highlight</button>
        {(['all', ...alertCurrencies] as const).map(currency => <button type="button" key={currency}
        aria-pressed={!highlight && preferences.currency === currency} onClick={() => { changeHighlight(false); updatePreferences({ ...preferences, currency }) }}>{currency === 'all' ? 'All' : currency}</button>)}</nav>
      {!highlight && <><label><select aria-label="Alert horizon" value={preferences.days} onChange={event => updatePreferences({ ...preferences, days: Number(event.target.value) as AlertPreferences['days'] })}>
        {alertHorizons.map(days => <option key={days} value={days}>Next {days} days</option>)}
      </select></label>
      <button type="button" onClick={() => setFiltersOpen(true)}>Filters</button></>}<span>{timeDisplayLabel(timeDisplay)}</span>
    </header>
    {highlight ? <HighlightList brokerId={brokerId} now={now} timeDisplay={timeDisplay} onPrepareResearch={onPrepareResearch} /> : message ? <p role="status">{message}</p> : <>
      {pins.error && <p role="status">{pins.error}</p>}
      {(storage.error || storage.collectorError || offline || partial) && <p className="alert-source-status" role="status">
        {storage.error ?? storage.collectorError ?? (offline ? 'Publisher offline · stored schedule may be stale' : 'Partial schedule coverage')}
      </p>}
      {!days.size && <p role="status">{storage.error ? 'Upcoming schedule unavailable' : `No upcoming releases in the available ${preferences.days}-day schedule`}</p>}
      <div className="alert-days">{[...days].map(([date, episodes]) => <section className="alert-day" key={date} aria-label={date}>
        <h3>{date}</h3>{episodes.map(({ release, state }) => <article className={`alert-row alert-${state}`} key={release.id} data-alert-id={release.id}>
          <span className="alert-currency">{release.currency}</span><strong>{release.label}</strong>
          <time>{state === 'unconfirmed' ? '—' : formatAppTimestamp(release.releaseAt!, timeDisplay, 'time-short')}</time>
          <span className={state === 'upcoming' ? 'alert-countdown' : 'alert-release-status'}>{state === 'upcoming' ? alertCountdown(release.releaseAt!, now) :
            state === 'awaiting' ? 'Awaiting release data' : state === 'partial' ? 'Partial release data' : 'Time unconfirmed'}</span>
          {onPrepareResearch && <button type="button" className="alert-research" aria-label={`Prepare research for ${release.currency} ${release.label}`}
            onClick={() => onPrepareResearch(release)}>Research</button>}
          <button type="button" className="alert-pin" disabled={!brokerId || pins.busy} aria-pressed={!!highlightForRelease(pins.items, release)}
            aria-label={`${highlightForRelease(pins.items, release) ? 'Unpin' : 'Pin'} ${release.currency} ${release.label}`}
            onClick={() => { const pinned = highlightForRelease(pins.items, release); void (pinned ? pins.remove(pinned.id) : pins.pin(release)) }}>
            {highlightForRelease(pins.items, release) ? 'Unpin' : 'Pin'}</button>
        </article>)}
      </section>)}</div>
    </>}
    {filtersOpen && <AlertFiltersModal preferences={preferences} onSave={next => updatePreferences({ ...preferences, families: next.families })} onClose={closeFilters} />}
  </section>
}
