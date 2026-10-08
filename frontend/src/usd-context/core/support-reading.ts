import type { RelationshipSupport } from '../sequences/core/relationship-support'

export const supportDisplayVersion = 'support-display-v1'

export type SupportBalance = { state: 'aligned' | 'conflicted' | 'balanced' | 'unchanged' | 'insufficient';
  direction: 'long' | 'short' | null; long: number; short: number; narrow: boolean; qualified: boolean }
type Vote = { label: string; towardLong: number }

/** Explain the displayed support, using the same signed votes without rescoring. */
export function supportReading(s: SupportBalance, votes: readonly Vote[]) {
  if (s.state === 'insufficient') return 'There is not enough usable evidence to name a leading side.'
  if (s.state === 'unchanged') return 'The available inputs add no net directional support.'
  if (s.state === 'balanced') return 'Long and Short support cancel exactly. Neither side leads.'
  const side = s.direction === 'long' ? 'Long' : 'Short', sign = s.direction === 'long' ? 1 : -1
  const ranked = [...votes].sort((a, b) => Math.abs(b.towardLong) - Math.abs(a.towardLong))
  const leader = ranked.find(v => v.towardLong * sign > 0)
  const opposing = ranked.find(v => v.towardLong * sign < 0)
  return `${leader?.label ?? 'Available evidence'} gives most ${side} support.${opposing ? ` ${opposing.label} gives opposing ${side === 'Long' ? 'Short' : 'Long'} support.` : ' The voting inputs agree on direction.'}${s.narrow ? ' The lead is narrow.' : ''}${s.qualified ? ' Some evidence is missing or incomplete.' : ''}`
}

export function relationshipReading(s: RelationshipSupport) {
  return supportReading(s, s.votes.map(v => ({ label: v.source.sourceLabel, towardLong: -v.vote })))
}

export const supportEvidenceNote = (s: SupportBalance) => s.state === 'insufficient' ? 'Insufficient evidence' :
  s.state === 'balanced' ? 'Balanced conflict' : s.state === 'unchanged' ? 'No lead' :
  s.narrow ? 'Weak · narrow lead' : s.qualified ? 'Weak · limited inputs' : s.state === 'conflicted' ? 'Conflicting inputs' : 'Inputs agree'
