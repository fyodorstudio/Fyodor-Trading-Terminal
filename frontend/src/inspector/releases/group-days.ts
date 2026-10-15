import type { InspectorRelease } from '../../economic-calendar/releases/release'
import { calendarDisplayRange, displayDateKey, type CalendarDisplayRange } from '../../economic-calendar/time/calendar-display-range'
import { utcToChartClock, type ChartClockScope } from '../../appearance/time-display/chart-clock'
import type { TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { episodePublications, releaseFamilyIds, selectedPackageSeries } from '../episodes/display-episodes'
import { groupDaySections } from './day-sections'

export function publicationDate(release: InspectorRelease, display: TimeDisplayPreference): string | null {
  // An unknown hour cannot shift a source calendar date into another day.
  if (release.timingUncertain) return release.serverTime > 0 && Number.isFinite(release.serverTime) ?
    new Date(release.serverTime * 1000).toISOString().slice(0, 10) : null
  return release.releaseAt !== null && Number.isFinite(release.releaseAt) ? displayDateKey(release.releaseAt, display) : null
}

export function groupInspectorDays(publications: InspectorRelease[], families: readonly string[], range: CalendarDisplayRange | null,
  display: TimeDisplayPreference, clock: ChartClockScope): InspectorRelease[] {
  if (!range) return []
  const selected = new Set(families), groups = new Map<string, InspectorRelease[]>()
  const fromDate = displayDateKey(range.from, display), toDate = displayDateKey(range.to - 1, display)
  for (const source of publications) {
    const publication = selectedPackageSeries(source, families)
    if (!publication) continue
    if (!releaseFamilyIds(publication).some(id => selected.has(id))) continue
    const date = publicationDate(publication, display)
    if (date === null || date < fromDate || date > toDate || (!publication.timingUncertain &&
      (publication.releaseAt! < range.from || publication.releaseAt! >= range.to))) continue
    const id = `day/${publication.currency}/${date}`
    const members = groups.get(id) ?? []; members.push(publication); groups.set(id, members)
  }
  return [...groups].map(([id, members]): InspectorRelease => {
    const date = id.slice(-10), day = calendarDisplayRange('custom', date, date, date, display)!
    const chartTime = utcToChartClock(day.from, clock), endChartTime = utcToChartClock(day.to, clock)
    const ordered = [...members].sort((a, b) => Number(a.timingUncertain) - Number(b.timingUncertain) ||
      (a.releaseAt ?? Infinity) - (b.releaseAt ?? Infinity) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
    const events = ordered.flatMap(publication => publication.events)
    const sections = groupDaySections(ordered), releaseCount = sections.reduce((sum, section) => sum + section.releaseCount, 0)
    return { id, familyId: 'daily', label: `${releaseCount} release${releaseCount === 1 ? '' : 's'} · ${events.length} series`,
      currency: ordered[0].currency, country: '', releaseAt: day.from, chartTime: chartTime === null ? null : chartTime / 1000,
      serverTime: (chartTime ?? day.from) / 1000, timingUncertain: false, events,
      daily: { date, endChartTime: endChartTime === null ? null : endChartTime / 1000, publications: ordered, sections } }
  }).sort((a, b) => a.releaseAt! - b.releaseAt! || a.currency.localeCompare(b.currency))
}

export function selectedInspectorRelease(releases: InspectorRelease[], sources: InspectorRelease[], id: string | null,
  display: TimeDisplayPreference): InspectorRelease | null {
  if (id === null) return null
  const matches = (release: InspectorRelease) => release.id === id || release.sourceReleaseIds?.includes(id)
  const direct = releases.find(release => matches(release) ||
    (release.daily?.publications ?? episodePublications(release))?.some(matches))
  if (direct) return direct
  const day = /^day\/([A-Z]{3})\/(\d{4}-\d{2}-\d{2})$/.exec(id)
  if (day) return releases.find(release => release.currency === day[1] &&
    (episodePublications(release) ?? [release]).some(member => publicationDate(member, display) === day[2])) ?? null
  const source = sources.find(release => matches(release) || episodePublications(release)?.some(matches))
  // A legacy policy/PMI selection resolves to the day containing its first row.
  const first = source?.events[0]?.value_id
  return first ? releases.find(release => release.daily && release.events.some(event => event.value_id === first)) ?? null : null
}
