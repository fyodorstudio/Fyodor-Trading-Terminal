import type { EconomicCalendarEvent } from '../calendar-event'
import type { InspectorRelease } from '../inspector-data'

export const policyEpisodeWindowMs = 60 * 60 * 1000
// Explicit country/currency/series identities. Ordinary speeches and minutes
// are not meeting companions, even when their timestamps happen to be close.
export const policyEpisodeRules = [
  { familyId: 'fomc', country: 'US', currency: 'USD', label: 'Fed rate decision',
    decisionIds: ['840050014'], companionIds: ['840050002', '840050003', '840050018'] },
  { familyId: 'ecb', country: 'EU', currency: 'EUR', label: 'ECB rate decision',
    decisionIds: ['999010007', '999010006', '999010015'], companionIds: ['999010024', '999010003'] },
] as const

export function policyEpisodeRule(familyId: string) {
  return policyEpisodeRules.find((rule) => rule.familyId === familyId)
}
export function isPolicyRateDecision(event: EconomicCalendarEvent, familyId?: string): boolean {
  return policyEpisodeRules.some((rule) => (familyId === undefined || rule.familyId === familyId) &&
    rule.country === event.country_code && rule.currency === event.currency &&
    (rule.decisionIds as readonly string[]).includes(event.event_id))
}

const verified = (release: InspectorRelease) => !release.timingUncertain &&
  release.releaseAt !== null && Number.isFinite(release.releaseAt) &&
  release.chartTime !== null && Number.isFinite(release.chartTime) && release.events.length > 0 &&
  release.events.every((event) => event.time_mode === 0 && event.release_at === release.releaseAt &&
    event.country_code === release.country && event.currency === release.currency)

// Exact publication grouping already combines ECB's simultaneous rate rows.
// Preserve that anchor's identity; attach companions to exactly one decision,
// never extending the window through another companion or across banks.
export function groupPolicyEpisodes(releases: InspectorRelease[]): InspectorRelease[] {
  const attached = new Map<InspectorRelease, InspectorRelease[]>()
  const absorbed = new Set<InspectorRelease>()
  for (const rule of policyEpisodeRules) {
    const sameBank = (release: InspectorRelease) => release.familyId === rule.familyId &&
      release.country === rule.country && release.currency === rule.currency && verified(release)
    const anchors = releases.filter((release) => sameBank(release) &&
      release.events.every((event) => (rule.decisionIds as readonly string[]).includes(event.event_id)))
    for (const release of releases) {
      if (!sameBank(release) || !release.events.every((event) =>
        (rule.companionIds as readonly string[]).includes(event.event_id))) continue
      const candidates = anchors.filter((anchor) => release.releaseAt! >= anchor.releaseAt! &&
        release.releaseAt! - anchor.releaseAt! <= policyEpisodeWindowMs)
      if (candidates.length !== 1) continue
      const anchor = candidates[0]
      attached.set(anchor, [...(attached.get(anchor) ?? []), release])
      absorbed.add(release)
    }
  }
  return releases.filter((release) => !absorbed.has(release)).map((release) => attached.has(release) ?
    { ...release, events: [...release.events, ...attached.get(release)!.flatMap((companion) => companion.events)] } : release)
}
