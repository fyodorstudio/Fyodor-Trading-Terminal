import type { InspectorRelease } from '../../inspector/inspector-data'
import type { ContextTimeline } from './contracts'
import { contextAt } from './context-lookup'
import { contextWeights } from './policy'

const format = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })
// Publication snapshots use the same chart clock and lookup as Raycaster.
// CPI's contribution change is separate from simultaneous updates/expiry.
export function compareCpiPublication(timeline: ContextTimeline | null, release: InspectorRelease, now: number) {
  const at = release.chartTime === null ? null : release.chartTime * 1000
  const problem = release.timingUncertain || at === null || !Number.isFinite(at) || release.releaseAt === null ?
    'This release has no verified publication/chart time.' : release.releaseAt > now ? 'This CPI publication is later than the Inspector clock.' : null
  if (problem || !timeline) return { at, before: null, after: null, voteChange: null, explanation: problem ?? 'Context is unavailable.' }
  const before = contextAt(timeline, at! - 1), after = contextAt(timeline, at!)
  if (!timeline.enabled.includes('cpi')) return { at, before, after, voteChange: 0,
    explanation: 'CPI is Off in the shared context inputs. Its standalone interpretation remains visible; this publication adds no context vote.' }
  const source = after?.result.members.find(m => m.family === 'cpi' && m.sourceId === release.id)
  if (!source) return { at, before, after, voteChange: null, explanation: 'This CPI publication was excluded from context; check its source timing and history.' }
  const previous = before?.result.members.find(m => m.family === 'cpi')
  const voteChange = Math.round((source.contribution - (previous?.contribution ?? 0)) * 1e12) / 1e12
  const oldState = previous?.status === 'active' ? `replaces the previous CPI vote ${format(previous.contribution)}` : 'replaces no active CPI vote'
  const stance = source.status !== 'active' ? 'This CPI release has no usable context vote' : source.contribution === 0 ?
    'This CPI release adds zero net USD contribution' : source.usdDirection === 'stronger' ?
    'This CPI release adds USD support' : 'This CPI release adds pressure on USD'
  const directionChange = voteChange > 0 ? 'toward USD strength' : voteChange < 0 ? 'toward USD weakness' : 'with no net CPI contribution change'
  const oldWeights = before?.result.policy?.weights ?? contextWeights, newWeights = after?.result.policy?.weights ?? contextWeights
  const changedWeights = Object.keys(newWeights).some(f => newWeights[f as keyof typeof newWeights] !== oldWeights[f as keyof typeof oldWeights])
  const retained = (member: typeof source | typeof previous) => member?.status === 'active' ?
    member.total! * (member.memory?.retention ?? 1) * (member.memory?.coverage ?? 1) : 0
  const sourceChange = Math.round((retained(source) - retained(previous)) * oldWeights.cpi / 100 * 1e12) / 1e12
  const weightChange = Math.round(retained(source) * (newWeights.cpi - oldWeights.cpi) / 100 * 1e12) / 1e12
  const policyNote = changedWeights ? ` Context priorities changed to ${after?.result.policy?.label ?? 'Balanced priorities'}: CPI ${oldWeights.cpi}% → ${newWeights.cpi}%, NFP ${oldWeights.nfp}% → ${newWeights.nfp}%. CPI source replacement at prior weight ${format(sourceChange)}; CPI priority effect ${format(weightChange)}. Other existing votes also use the new priorities.` : ''
  const other = after?.result.members.filter(m => m.family !== 'cpi' &&
    (m.chartAt === at || before?.result.members.find(b => b.family === m.family)?.status !== m.status)).map(m => m.sourceLabel) ?? []
  return { at, before, after, voteChange, explanation:
    `${stance}; it ${oldState}. CPI contribution change ${format(voteChange)}, ${directionChange}. Age retention and component coverage are included.` +
    policyNote + (other.length ? ` Other updates or status changes at this timestamp: ${other.join(', ')}.` : '') }
}
