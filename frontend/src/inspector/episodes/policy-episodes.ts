import type { EconomicCalendarEvent } from '../../economic-calendar/contracts/calendar-event'
import type { InspectorRelease } from '../../economic-calendar/releases/release'

export const policyEpisodeWindowMs = 60 * 60 * 1000
// Explicit country/currency/series identities. Ordinary speeches and minutes
// are not meeting companions, even when their timestamps happen to be close.
export const policyEpisodeRules = [
  { familyId: 'rba', country: 'AU', currency: 'AUD', label: 'RBA rate decision',
    decisionIds: ['36030008'], companionIds: ['36030005', '36030003', '36030004'] },
  { familyId: 'rbnz', country: 'NZ', currency: 'NZD', label: 'RBNZ rate decision',
    decisionIds: ['554020009'], companionIds: ['554020005', '554020007', '554020008'] },
  { familyId: 'boc', country: 'CA', currency: 'CAD', label: 'BoC rate decision',
    decisionIds: ['124040006'], companionIds: ['124040007', '124040004', '124040009'] },
  { familyId: 'snb', country: 'CH', currency: 'CHF', label: 'SNB rate decision',
    decisionIds: ['756010001'], companionIds: ['756010002', '756010009'] },
  { familyId: 'boj', country: 'JP', currency: 'JPY', label: 'BoJ rate decision',
    decisionIds: ['392060022'], companionIds: ['392060018', '392060017', '392060020', '392060019', '392060021'] },
  { familyId: 'boe', country: 'GB', currency: 'GBP', label: 'BoE rate decision',
    decisionIds: ['826020009'], companionIds: ['826020010', '826020011', '826020012', '826020008', '826020031', '826020005', '826020013', '826020021'] },
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

const verified = (release: InspectorRelease, requireChartTime: boolean) => !release.timingUncertain &&
  release.releaseAt !== null && Number.isFinite(release.releaseAt) &&
  (!requireChartTime || release.chartTime !== null && Number.isFinite(release.chartTime)) && release.events.length > 0 &&
  release.events.every((event) => event.time_mode === 0 && event.release_at === release.releaseAt &&
    event.country_code === release.country && event.currency === release.currency)

// Exact publication grouping already combines ECB's simultaneous rate rows.
// Preserve that anchor's identity; attach companions to exactly one decision,
// never extending the window through another companion or across banks.
export function groupPolicyEpisodes(releases: InspectorRelease[], requireChartTime = true): InspectorRelease[] {
  const attached = new Map<InspectorRelease, InspectorRelease[]>()
  const absorbed = new Set<InspectorRelease>()
  for (const rule of policyEpisodeRules) {
    const sameBank = (release: InspectorRelease) => release.familyId === rule.familyId &&
      release.country === rule.country && release.currency === rule.currency && verified(release, requireChartTime)
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
