import type { InspectorRelease } from '../../economic-calendar/releases/release'

// Exact catalog IDs; names alone never merge unrelated inflation releases.
const seriesOrder = ['250010001', '250010003', '250010002', '250010004']
const series = new Set(seriesOrder)

export function groupFrenchCpiReleases(releases: InspectorRelease[], requireChartTime = true): InspectorRelease[] {
  const packages = new Map<string, InspectorRelease[]>()
  for (const release of releases) {
    if (release.country !== 'FR' || release.currency !== 'EUR' || release.familyIds || release.timingUncertain ||
      release.releaseAt === null || !Number.isFinite(release.releaseAt) || (requireChartTime && (release.chartTime === null || !Number.isFinite(release.chartTime))) || !release.events.length) continue
    const period = release.events[0].period_seconds
    if (!Number.isFinite(period) || period <= 0 || release.events.some(event => !series.has(event.event_id) ||
      event.country_code !== 'FR' || event.currency !== 'EUR' || event.time_mode !== 0 || event.release_at !== release.releaseAt || event.period_seconds !== period)) continue
    const key = JSON.stringify(['FR-CPI-HICP', release.releaseAt, release.chartTime, period])
    const members = packages.get(key) ?? []; members.push(release); packages.set(key, members)
  }
  const replacements = new Map<InspectorRelease, InspectorRelease>(), absorbed = new Set<InspectorRelease>()
  for (const [id, members] of packages) {
    if (members.length < 2) continue
    const events = members.flatMap(member => member.events).sort((a, b) => seriesOrder.indexOf(a.event_id) - seriesOrder.indexOf(b.event_id) ||
      a.revision - b.revision || a.value_id.localeCompare(b.value_id))
    const first = members.find(member => member.events.some(event => event.event_id === seriesOrder[0])) ?? members[0]
    replacements.set(first, { ...first, id, label: 'French CPI / HICP', events,
      familyIds: [...new Set(members.map(member => member.familyId))], sourceReleaseIds: members.map(member => member.id) })
    members.filter(member => member !== first).forEach(member => absorbed.add(member))
  }
  return releases.filter(release => !absorbed.has(release)).map(release => replacements.get(release) ?? release)
}
