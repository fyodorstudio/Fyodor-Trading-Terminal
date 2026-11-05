import type { InspectorRelease } from '../../economic-calendar/releases/release'
import { inspectorFamilyById } from '../catalog/inspector-families'
import { releaseFamilyIds } from '../episodes/display-episodes'
import { groupInspectorReleases, isPublishedTentative } from './group-releases'

// Chart presentation only: exact verified clocks, with country/period/value
// identities retained on every row. Category never changes package membership.
export function groupSimultaneousReleases(releases: InspectorRelease[]): InspectorRelease[] {
  // Legacy policy/PMI episodes can contain several publication clocks. Restore
  // their individual publications before grouping by the exact UTC instant.
  const publications = releases.flatMap(release => release.daily ? [release] : release.pmiPublications ??
    (release.events.some(event => event.release_at !== release.releaseAt) ? groupInspectorReleases(release.events, false) : [release]))
  const batches = new Map<string, InspectorRelease[]>()
  for (const release of publications) {
    if (release.daily || release.timingUncertain ||
      release.releaseAt === null || !Number.isFinite(release.releaseAt) ||
      !release.events.length || release.events.some(event => event.currency !== release.currency ||
        event.time_mode !== 0 && !isPublishedTentative(event) || event.release_at !== release.releaseAt)) continue
    const key = JSON.stringify(['simultaneous', release.currency, release.releaseAt])
    const members = batches.get(key) ?? []
    members.push(release); batches.set(key, members)
  }
  const replacements = new Map<InspectorRelease, InspectorRelease>(), absorbed = new Set<InspectorRelease>()
  for (const [id, members] of batches) {
    if (members.length < 2) continue
    const ordered = [...members].sort((a, b) => Number(b.familyId === 'euro-inflation') - Number(a.familyId === 'euro-inflation') ||
      a.country.localeCompare(b.country) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
    const first = ordered[0], familyIds = [...new Set(ordered.flatMap(releaseFamilyIds))]
    const chartTimes = [...new Set(ordered.flatMap(member => member.chartTime !== null && Number.isFinite(member.chartTime) ? [member.chartTime] : []))]
    const chartTime = chartTimes.length === 1 ? chartTimes[0] : null
    replacements.set(members[0], { ...first, id,
      label: familyIds.every(family => inspectorFamilyById.get(family)?.category === 'inflation') ? `${first.currency} inflation` : `${first.currency} releases`,
      country: [...new Set(ordered.map(member => member.country))].join(' / '),
      chartTime, serverTime: chartTime ?? first.serverTime,
      events: ordered.flatMap(member => member.events), familyIds,
      sourceReleaseIds: [...new Set(ordered.flatMap(member => [member.id, ...(member.sourceReleaseIds ?? [])]))] })
    members.slice(1).forEach(member => absorbed.add(member))
  }
  return publications.filter(release => !absorbed.has(release)).map(release => replacements.get(release) ?? release)
    .sort((a, b) => (a.releaseAt ?? a.serverTime * 1000) - (b.releaseAt ?? b.serverTime * 1000)
      || a.currency.localeCompare(b.currency) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
}
