import { memo, useCallback, useMemo, useState, type ReactNode } from 'react'
import { formatAppTimestamp, timeDisplayLabel, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { chartClockToUtc, utcToChartClock } from '../../appearance/time-display/chart-clock'
import { useStoredCalendar } from '../../economic-calendar/storage/useStoredCalendar'
import { CalendarBoundary, CalendarClock } from '../../inspector/CalendarClock'
import { majorCurrencies } from '../../economic-calendar/forex/currencies'
import { policyEpisodeWindowMs } from '../../inspector/episodes/policy-episodes'
import { groupInspectorReleases } from '../../inspector/releases/group-releases'
import { inspectorFamilies } from '../../inspector/catalog/inspector-families'
import { alertEpisodesFromReleases, alertCalendarScope, type AlertEpisode } from '../model/alert-episodes'
import { alertCurrencies, alertHorizons, readAlertPreferences, saveAlertPreferences, readHighlightVisibility, saveHighlightVisibility, type AlertPreferences, type HighlightVisibility } from '../model/alert-preferences'
import { AlertFiltersModal } from './AlertFiltersModal'
import './alert-dock.css'
import type { InspectorRelease } from '../../economic-calendar/releases/release'
import { HighlightList } from '../highlights/HighlightList'
import { useHighlights } from '../highlights/useHighlights'
import { highlightForRelease, type Highlight } from '../highlights/highlight-model'
import { ReleaseCountdown } from '../highlights/ReleaseCountdown'

const day = 86400000
export const AlertDock = memo(function AlertDock({ brokerId, timeDisplay, clockOffsetMs = 0, brokerOffsetSeconds = 0, onPrepareResearch, renderHeader, renderHighlightAlarm, calendarOnly = false }: {
  brokerId: string | null; timeDisplay: TimeDisplayPreference; clockOffsetMs?: number; brokerOffsetSeconds?: number
  onPrepareResearch?: (release: InspectorRelease) => void
  renderHeader?: (controls: ReactNode, currencies?: ReactNode) => ReactNode
  renderHighlightAlarm?: (item: Highlight, now: number) => ReactNode
  calendarOnly?: boolean
}) {
  const [preferences, setPreferences] = useState(readAlertPreferences)
  const [savedHighlight, setHighlight] = useState(() => { try { return localStorage.getItem('fyodor.alert.highlight-view.v1') === 'true' } catch { return false } })
  const highlight = !calendarOnly && savedHighlight
  const changeHighlight = (value: boolean) => { setHighlight(value); try { localStorage.setItem('fyodor.alert.highlight-view.v1', String(value)) } catch { /* Keep the active tab for this session. */ } }
  const [visibility, setVisibility] = useState(readHighlightVisibility)
  const changeVisibility = (value: HighlightVisibility) => { setVisibility(value); saveHighlightVisibility(value) }
  const pins = useHighlights(highlight ? null : brokerId)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const closeFilters = useCallback(() => setFiltersOpen(false), [])
  const updatePreferences = useCallback((next: AlertPreferences) => { setPreferences(next); saveAlertPreferences(next) }, [])
  const [now, setNow] = useState(() => Date.now() + clockOffsetMs)
  const today = Math.floor(now / day) * day
  const clock = useMemo(() => ({ brokerId, brokerOffsetSeconds }), [brokerId, brokerOffsetSeconds])
  const range = useMemo(() => ({ from: utcToChartClock(today - policyEpisodeWindowMs, clock) ?? today,
    to: utcToChartClock(today + (preferences.days + 2) * day + policyEpisodeWindowMs, clock) ?? today }), [today, preferences.days, clock])
  const families = preferences.families
  const scope = useMemo(() => alertCalendarScope({ families }), [families])
  const storage = useStoredCalendar(brokerId, range, !highlight && families.length > 0, scope)
  // Currency buttons filter the loaded inventory locally. Countdown ticks never regroup it.
  // A verified publication UTC clock is sufficient for Alert. Chart placement
  // separately requires the broker's historical chart-clock profile.
  const grouped = useMemo(() => groupInspectorReleases(storage.events.filter(event => event.availability === 'observed'), true, 'publication'), [storage.events])
  const times = useMemo(() => grouped.flatMap(release => release.releaseAt === null ? [] :
    [release.releaseAt, release.releaseAt + 1, release.releaseAt - preferences.days * day]), [grouped, preferences.days])
  const episodes = useMemo(() => alertEpisodesFromReleases(grouped, preferences, now, preferences.days,
    utcToChartClock(now, clock) ?? now)
    .filter(({ release }) => preferences.currency === 'all' || release.currency === preferences.currency), [grouped, preferences, now, clock])
  const days = useMemo(() => {
    const result = new Map<string, typeof episodes>()
    for (const episode of episodes) {
      const at = episode.release.releaseAt ?? chartClockToUtc(episode.release.serverTime * 1000, clock)
      const date = episode.release.timingUncertain ? formatAppTimestamp(episode.release.serverTime * 1000, { mode: 'utc', utcOffsetMinutes: 0 }, 'date') :
        at === null || !Number.isFinite(at) ? 'Date unconfirmed' : formatAppTimestamp(at, timeDisplay, 'date')
      const group = result.get(date) ?? []; group.push(episode); result.set(date, group)
    }
    return result
  }, [episodes, clock, timeDisplay])
  const pinned = useMemo(() => new Map(episodes.map(({ release }) => [release.id, highlightForRelease(pins.items, release)])), [episodes, pins.items])
  const currencies = inspectorFamilies.filter(f => preferences.families.includes(f.id) && (preferences.currency === 'all' || preferences.currency === f.currency)).map(f => f.currency)
  const brokerNow = utcToChartClock(now, clock) ?? now
  const partial = !!storage.source && currencies.some(currency => !storage.coverage[currency] ||
    storage.coverage[currency].missing.some(([from, to]) => from * 1000 < brokerNow + preferences.days * day && to * 1000 > brokerNow))
  const offline = !!storage.source && storage.source.publisher_status !== 'live'
  const message = !brokerId ? 'Alert needs calendar storage' : !families.length ? 'No families selected in Alert filters' : storage.loading ? 'Loading upcoming releases…' : null
  const collections = <nav className="alert-collections" aria-label="Alert collection">
    <button type="button" aria-pressed={!highlight} onClick={() => changeHighlight(false)}>Upcoming</button>
    <button type="button" aria-pressed={highlight} onClick={() => changeHighlight(true)}>Highlight</button>
  </nav>
  const scheduleControls = !highlight && <div className="alert-schedule-controls"><label><select aria-label="Alert horizon" value={preferences.days} onChange={event => updatePreferences({ ...preferences, days: Number(event.target.value) as AlertPreferences['days'] })}>
    {alertHorizons.map(days => <option key={days} value={days}>Next {days} days</option>)}
  </select></label><button type="button" onClick={() => setFiltersOpen(true)}>Filters</button></div>
  return <CalendarClock clockOffsetMs={clockOffsetMs}>
  <CalendarBoundary times={times} onBoundary={setNow} timeDisplay={timeDisplay} dayOffsetMinutes={brokerOffsetSeconds / 60} />
  <section className="alert-dock" aria-label="Alert">
    {renderHeader ? renderHeader(<>
      {!calendarOnly && collections}
      {highlight && <select aria-label="Highlight view" value={visibility} onChange={event => changeVisibility(event.target.value as HighlightVisibility)}>
        <option value="active">Active</option><option value="archived">Archive</option>
      </select>}
      {scheduleControls}
    </>, <nav className="events-currency-buttons" aria-label="Alert currency">
      {(['all', ...majorCurrencies] as const).map(currency => <button type="button" key={currency}
        aria-pressed={preferences.currency === currency} onClick={() => updatePreferences({ ...preferences, currency })}>{currency === 'all' ? 'All' : currency}</button>)}
    </nav>) : <header className="alert-header">
      <div className="alert-toolbar">
        {collections}
        {highlight && <nav className="highlight-views" aria-label="Highlight view">
          <button type="button" aria-pressed={visibility === 'active'} onClick={() => changeVisibility('active')}>Active</button>
          <button type="button" aria-pressed={visibility === 'archived'} onClick={() => changeVisibility('archived')}>Archive</button>
        </nav>}
        <span className="alert-timezone">{timeDisplayLabel(timeDisplay)}</span>
      </div>
      <div className="alert-toolbar alert-filter-toolbar">
      <nav className="alert-currencies" aria-label="Alert currency">
        {(['all', ...alertCurrencies] as const).map(currency => <button type="button" key={currency}
        aria-pressed={preferences.currency === currency} onClick={() => updatePreferences({ ...preferences, currency })}>{currency === 'all' ? 'All' : currency}</button>)}</nav>
      {scheduleControls}
      </div>
    </header>}
    {brokerId && <p className="alert-source-status">Calendar source: {brokerId}</p>}
    {highlight ? <HighlightList brokerId={brokerId} now={now} timeDisplay={timeDisplay} visibility={visibility} currency={preferences.currency} onPrepareResearch={onPrepareResearch} renderAlarm={renderHighlightAlarm} /> : message ? <p role="status">{message}</p> : <>
      {pins.error && <p role="status">{pins.error}</p>}
      {(storage.error || storage.collectorError || offline || partial) && <p className="alert-source-status" role="status">
        {storage.error ?? storage.collectorError ?? (offline ? 'Publisher offline · stored schedule may be stale' : 'Partial schedule coverage')}
      </p>}
      {!days.size && <p role="status">{storage.error ? 'Upcoming schedule unavailable' : `No upcoming releases in the available ${preferences.days}-day schedule`}</p>}
      <div className="alert-days">{[...days].map(([date, episodes]) => <section className="alert-day" key={date} aria-label={date}>
        <h3>{date}</h3>{episodes.map(episode => <AlertReleaseRow key={episode.release.id} episode={episode} now={now} timeDisplay={timeDisplay}
          brokerId={brokerId} pins={pins} pinned={pinned.get(episode.release.id)} onPrepareResearch={onPrepareResearch} />)}
      </section>)}</div>
    </>}
    {filtersOpen && <AlertFiltersModal preferences={preferences} onSave={next => updatePreferences({ ...preferences, families: next.families })} onClose={closeFilters} />}
  </section></CalendarClock>
})

const AlertReleaseRow = memo(function AlertReleaseRow({ episode: { release, state }, now, timeDisplay, brokerId, pins, pinned, onPrepareResearch }: {
  episode: AlertEpisode; now: number; timeDisplay: TimeDisplayPreference; brokerId: string | null; pins: ReturnType<typeof useHighlights>
  pinned?: Highlight; onPrepareResearch?: (release: InspectorRelease) => void
}) {
  return <article className={`alert-row alert-${state}`} data-alert-id={release.id}>
    <span className="alert-currency">{release.currency}</span><strong>{release.label}</strong>
    <time>{state === 'unconfirmed' ? '—' : formatAppTimestamp(release.releaseAt!, timeDisplay, 'time-short')}</time>
    <span className={state === 'upcoming' ? 'alert-countdown' : 'alert-release-status'}>{state === 'upcoming' ? <ReleaseCountdown at={release.releaseAt!} now={now} /> :
      state === 'awaiting' ? 'Awaiting release data' : state === 'partial' ? 'Partial release data' : 'Time unconfirmed'}</span>
    {onPrepareResearch && <button type="button" className="alert-research" aria-label={`Prepare research for ${release.currency} ${release.label}`}
      onClick={() => onPrepareResearch(release)}>Research</button>}
    <button type="button" className="alert-pin" disabled={!brokerId || pins.busy} aria-pressed={!!pinned}
      aria-label={`${pinned ? 'Archive' : 'Pin'} ${release.currency} ${release.label}`}
      onClick={() => void (pinned ? pins.archive(pinned.id) : pins.pin(release))}>{pinned ? 'Archive' : 'Pin'}</button>
  </article>
})
