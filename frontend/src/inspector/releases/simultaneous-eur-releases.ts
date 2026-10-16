import type { InspectorRelease } from '../../economic-calendar/releases/release'
import { inspectorFamilyById } from '../catalog/inspector-families'
import { releaseFamilyIds } from '../episodes/display-episodes'

// Chart presentation only: exact verified clocks, with country/period/value
// identities retained on every row. Policy and PMI stages remain separate.
export function groupSimultaneousEurReleases(releases: InspectorRelease[]): InspectorRelease[] {
  const batches = new Map<string, InspectorRelease[]>()
  for (const release of releases) {
    if (release.currency !== 'EUR' || release.daily || release.pmiPublications || release.timingUncertain ||
      releaseFamilyIds(release).some(id => inspectorFamilyById.get(id)?.category === 'policy') ||
      release.releaseAt === null || !Number.isFinite(release.releaseAt) ||
      release.chartTime === null || !Number.isFinite(release.chartTime) || !release.events.length ||
      release.events.some(event => event.currency !== 'EUR' || event.time_mode !== 0 || event.release_at !== release.releaseAt)) continue
    const key = JSON.stringify(['EUR-simultaneous', release.releaseAt, release.chartTime])
    const members = batches.get(key) ?? []
    members.push(release); batches.set(key, members)
  }
  const replacements = new Map<InspectorRelease, InspectorRelease>(), absorbed = new Set<InspectorRelease>()
  for (const [id, members] of batches) {
    if (members.length < 2) continue
    const ordered = [...members].sort((a, b) => Number(b.familyId === 'euro-inflation') - Number(a.familyId === 'euro-inflation') ||
      a.country.localeCompare(b.country) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
    const first = ordered[0], familyIds = [...new Set(ordered.flatMap(releaseFamilyIds))]
    replacements.set(members[0], { ...first, id,
      label: familyIds.every(family => inspectorFamilyById.get(family)?.category === 'inflation') ? 'EUR inflation' : 'EUR releases',
      country: [...new Set(ordered.map(member => member.country))].join(' / '),
      events: ordered.flatMap(member => member.events), familyIds,
      sourceReleaseIds: [...new Set(ordered.flatMap(member => [member.id, ...(member.sourceReleaseIds ?? [])]))] })
    members.slice(1).forEach(member => absorbed.add(member))
  }
  return releases.filter(release => !absorbed.has(release)).map(release => replacements.get(release) ?? release)
}
