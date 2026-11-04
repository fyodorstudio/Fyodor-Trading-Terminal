import type { InspectorRelease } from '../../economic-calendar/releases/release'

// Known publisher packages, never a name/time-only join. Construction, policy
// stages and unrelated publishers retain their individual identities.
const rules = [
  { id: 'baker-hughes-us', label: 'Baker Hughes US rig counts', country: 'US', ids: ['840100001', '840100002'] },
  { id: 'jibun-pmi', label: 'au Jibun Bank PMI', country: 'JP', ids: ['392500001', '392500002', '392500003'] },
  ...[['US', '840'], ['EU', '999'], ['DE', '276'], ['FR', '250'], ['IT', '380'], ['ES', '724'], ['AU', '36']].map(([country, prefix]) => ({
    id: `${country}-sp-pmi`, label: `${country === 'EU' ? 'Euro-area' : country} S&P Global PMI`, country,
    ids: ['1', '2', '3'].map(suffix => `${prefix}50000${suffix}`),
  })),
  { id: 'uk-sp-pmi', label: 'UK S&P Global/CIPS PMI', country: 'GB', ids: ['826500001', '826500002', '826500005'] },
  { id: 'ivey-pmi', label: 'Canada Ivey PMI', country: 'CA', ids: ['124020001', '124020002'] },
]
const bySeries = new Map(rules.flatMap(rule => rule.ids.map(id => [id, rule] as const)))

export function groupAlertPublications(releases: InspectorRelease[]): InspectorRelease[] {
  const packages = new Map<string, InspectorRelease[]>()
  for (const release of releases) {
    const first = release.events[0], rule = first && bySeries.get(first.event_id)
    if (!rule || release.familyIds || release.timingUncertain || release.releaseAt === null || !Number.isFinite(release.releaseAt)
      || release.country !== rule.country || release.events.some(event => bySeries.get(event.event_id) !== rule
        || event.country_code !== release.country || event.currency !== release.currency || event.time_mode !== 0
        || event.release_at !== release.releaseAt || event.period_seconds !== first.period_seconds)) continue
    const key = JSON.stringify([rule.id, release.country, release.currency, release.releaseAt, first.period_seconds])
    const members = packages.get(key) ?? []; members.push(release); packages.set(key, members)
  }
  const replacements = new Map<InspectorRelease, InspectorRelease>(), absorbed = new Set<InspectorRelease>()
  for (const [id, members] of packages) {
    if (members.length < 2) continue
    const rule = bySeries.get(members[0].events[0].event_id)!
    const ordered = [...members].sort((a, b) => rule.ids.indexOf(a.events[0].event_id) - rule.ids.indexOf(b.events[0].event_id) || a.id.localeCompare(b.id))
    replacements.set(ordered[0], { ...ordered[0], id: `package:${id}`, label: rule.label,
      events: ordered.flatMap(member => member.events), familyIds: [...new Set(ordered.map(member => member.familyId))],
      sourceReleaseIds: ordered.map(member => member.id) })
    ordered.slice(1).forEach(member => absorbed.add(member))
  }
  return releases.filter(release => !absorbed.has(release)).map(release => replacements.get(release) ?? release)
}
