import type { InspectorRelease } from '../inspector-data'

export const ismEpisodeWindowMs = 10 * 86400000

// Display grouping only. Scoring and Scatter still consume original publications.
export function groupIsmEpisodes(releases: InspectorRelease[]): InspectorRelease[] {
  const months = new Map<number, InspectorRelease[]>()
  for (const release of releases) {
    if (!['ism-manufacturing', 'ism-services'].includes(release.familyId) || release.country !== 'US' ||
      release.currency !== 'USD' || release.timingUncertain || release.releaseAt === null || release.chartTime === null ||
      !Number.isFinite(release.releaseAt) || !Number.isFinite(release.chartTime) || !release.events.length) continue
    const periods = release.events.map((event) => {
      if (event.time_mode !== 0 || event.release_at !== release.releaseAt || event.country_code !== 'US' ||
        event.currency !== 'USD' || !Number.isFinite(event.period_seconds) || event.period_seconds <= 0) return null
      const date = new Date(event.period_seconds * 1000)
      return Number.isFinite(date.getTime()) ? date.getUTCFullYear() * 12 + date.getUTCMonth() : null
    })
    if (periods.some((month) => month === null || month !== periods[0])) continue
    const month = periods[0]!
    months.set(month, [...(months.get(month) ?? []), release])
  }
  const replacements = new Map<InspectorRelease, InspectorRelease>(), absorbed = new Set<InspectorRelease>()
  for (const [month, members] of months) {
    // Ambiguous/reissued sector publications remain separate for inspection.
    if (members.some((member, i) => members.slice(i + 1).some((other) => member.familyId === other.familyId))) continue
    const ordered = [...members].sort((a, b) => a.releaseAt! - b.releaseAt!)
    const anchor = ordered[0]
    if (ordered.length > 1 && (anchor.familyId !== 'ism-manufacturing' ||
      ordered[1].releaseAt! <= anchor.releaseAt! || ordered[1].releaseAt! - anchor.releaseAt! > ismEpisodeWindowMs)) continue
    const period = `${Math.floor(month / 12)}-${String(month % 12 + 1).padStart(2, '0')}`
    replacements.set(anchor, { ...anchor, id: `ISM/${period}`, label: 'US ISM · Manufacturing / Services',
      events: ordered.flatMap((member) => member.events), ismPublications: ordered })
    ordered.slice(1).forEach((member) => absorbed.add(member))
  }
  return releases.filter((release) => !absorbed.has(release)).map((release) => replacements.get(release) ?? release)
}

export function ismSourceRelease(release: InspectorRelease | null, sourceId?: string | null, now = Infinity): InspectorRelease | null {
  const members = release?.ismPublications
  if (!members) return release
  return members.find((member) => member.id === sourceId) ??
    [...members].reverse().find((member) => member.releaseAt! <= now) ?? members[0]
}
