import type { InspectorRelease } from '../inspector-data'

export const pmiFamilyIds = ['euro-pmi', 'german-pmi', 'french-pmi'] as const
export const pmiEpisodeWindowMs = 3 * 3600000
const countries: Record<string, string> = { 'euro-pmi': 'EU', 'german-pmi': 'DE', 'french-pmi': 'FR' }
export const pmiSectionLabel = (release: InspectorRelease) => release.familyId === 'french-pmi' ? 'France' : release.familyId === 'german-pmi' ? 'Germany' : 'Euro area'

/** Display only. Match one reference month and publication day, never flash to a later final. */
export function groupPmiEpisodes(releases: InspectorRelease[]): InspectorRelease[] {
  const rounds = new Map<string, InspectorRelease[]>()
  for (const release of releases) {
    if (!countries[release.familyId] || release.country !== countries[release.familyId] || release.currency !== 'EUR' ||
      release.pmiPublications || release.timingUncertain || release.releaseAt === null || release.chartTime === null ||
      !Number.isFinite(release.releaseAt) || !Number.isFinite(release.chartTime) || !release.events.length) continue
    const periods = release.events.map(event => {
      if (event.time_mode !== 0 || event.release_at !== release.releaseAt || event.country_code !== release.country || event.currency !== 'EUR' ||
        !Number.isFinite(event.period_seconds) || event.period_seconds <= 0) return null
      const date = new Date(event.period_seconds * 1000)
      return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 7) : null
    })
    if (periods.some(period => period === null || period !== periods[0])) continue
    const published = new Date(release.releaseAt)
    if (!Number.isFinite(published.getTime())) continue
    const key = `${periods[0]}/${published.toISOString().slice(0, 10)}`
    const members = rounds.get(key) ?? []; members.push(release); rounds.set(key, members)
  }
  const replacements = new Map<InspectorRelease, InspectorRelease>(), absorbed = new Set<InspectorRelease>()
  for (const [key, members] of rounds) {
    if (new Set(members.map(member => member.familyId)).size !== members.length) continue
    const ordered = [...members].sort((a, b) => a.releaseAt! - b.releaseAt! || a.id.localeCompare(b.id))
    const first = ordered[0], last = ordered.at(-1)!
    if (last.releaseAt! - first.releaseAt! > pmiEpisodeWindowMs || last.chartTime! - first.chartTime! > pmiEpisodeWindowMs / 1000 ||
      ordered.some((member, i) => i > 0 && member.chartTime! < ordered[i - 1].chartTime!)) continue
    replacements.set(first, { ...first, id: `EUR-PMI/${key}`, label: 'Euro-area PMI · France / Germany / Euro area',
      country: 'EU', familyId: 'euro-pmi', events: ordered.flatMap(member => member.events), pmiPublications: ordered })
    ordered.slice(1).forEach(member => absorbed.add(member))
  }
  return releases.filter(release => !absorbed.has(release)).map(release => replacements.get(release) ?? release)
}

export function pmiSourceRelease(release: InspectorRelease | null, sourceId?: string | null, now = Infinity): InspectorRelease | null {
  const members = release?.pmiPublications
  return members ? members.find(member => member.id === sourceId) ?? [...members].reverse().find(member => member.releaseAt! <= now) ?? members[0] : release
}
