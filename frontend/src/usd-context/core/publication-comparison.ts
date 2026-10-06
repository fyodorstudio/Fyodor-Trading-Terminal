import type { InspectorRelease } from '../../inspector/inspector-data'
import type { ContextTimeline } from './contracts'
import { contextAt } from './context-lookup'

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
  const other = after?.result.members.filter(m => m.family !== 'cpi' &&
    (m.chartAt === at || before?.result.members.find(b => b.family === m.family)?.status !== m.status)).map(m => m.sourceLabel) ?? []
  return { at, before, after, voteChange, explanation:
    `${stance}; it ${oldState}. CPI contribution change ${format(voteChange)}, ${directionChange}.` +
    (other.length ? ` Other updates or status changes at this timestamp: ${other.join(', ')}.` : '') }
}
