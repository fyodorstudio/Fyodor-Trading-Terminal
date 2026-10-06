import type { FamilyAssessment, ClaimsContextTraits } from '../contracts'
import { contextDayMs } from './source-retention'

// Overlapping weekly reports are repeated confirmation, not independent votes.
// Only the current report votes; the streak can qualify a bounded budget transfer.
export function claimsConfirmation(source: FamilyAssessment, preceding: readonly FamilyAssessment[]): ClaimsContextTraits {
  const trendsAgree = (s: FamilyAssessment) => s.traits?.kind !== 'claims' || s.traits.trendAgreement !== false
  let streak = source.usdDirection !== 'uncomputed' && source.total !== 0 && (source.coverage ?? 1) >= .8 && trendsAgree(source) ? 1 : 0
  let newer = source
  for (const older of [...preceding].reverse().slice(0, 2)) {
    const gap = (newer.releaseAt - older.releaseAt) / contextDayMs
    if (!streak || older.usdDirection !== source.usdDirection || older.total === 0 ||
      (older.coverage ?? 1) < .8 || older.reduced || !trendsAgree(older) || gap < 4 || gap > 10) break
    streak++
    newer = older
  }
  return { kind: 'claims', ...(source.traits?.kind === 'claims' ? { trendAgreement: source.traits.trendAgreement } : {}), streak, confirmed: streak === 3 && !source.reduced &&
    (source.strength === 'moderate' || source.strength === 'strong') }
}
