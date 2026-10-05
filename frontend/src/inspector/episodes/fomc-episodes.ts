import type { InspectorRelease } from '../inspector-data'

export const fomcDecisionId = '840050014'
export const fomcCompanionIds = ['840050002', '840050003', '840050018'] as const
export const fomcEpisodeWindowMs = 60 * 60 * 1000
const verified = (release: InspectorRelease) => release.familyId === 'fomc' && release.country === 'US' &&
  release.currency === 'USD' && !release.timingUncertain && release.releaseAt !== null && Number.isFinite(release.releaseAt) &&
  release.chartTime !== null && Number.isFinite(release.chartTime)

// Attach only known meeting companions to exactly one decision. Never chain
// proximity through a companion or infer a meeting from generic Chair speeches.
export function groupFomcEpisodes(releases: InspectorRelease[]): InspectorRelease[] {
  const anchors = releases.filter((release) => verified(release) &&
    release.events.every((event) => event.event_id === fomcDecisionId))
  const attached = new Map<InspectorRelease, InspectorRelease[]>()
  const absorbed = new Set<InspectorRelease>()
  for (const release of releases) {
    if (!verified(release) || !release.events.every((event) =>
      (fomcCompanionIds as readonly string[]).includes(event.event_id))) continue
    const candidates = anchors.filter((anchor) => release.events.every((event) => event.time_mode === 0 &&
      event.release_at !== null && Number.isFinite(event.release_at) &&
      event.release_at >= anchor.releaseAt! && event.release_at - anchor.releaseAt! <= fomcEpisodeWindowMs))
    if (candidates.length !== 1) continue
    const anchor = candidates[0]
    attached.set(anchor, [...(attached.get(anchor) ?? []), release])
    absorbed.add(release)
  }
  return releases.filter((release) => !absorbed.has(release)).map((release) => attached.has(release) ?
    { ...release, events: [...release.events, ...attached.get(release)!.flatMap((companion) => companion.events)] } : release)
}
