import type { ContextPoint, ContextResult, Evidence } from '../../usd-context/core/contracts'
import { contextWeights, contextNames } from '../../usd-context/core/policy'
import { interpretationLimits } from '../../usd-context/core/interpretation-quality'
import { contextPairLabel, usdPair } from '../../usd-context/core/usd-pair'

export const usdPresentationVersion = 'USD presentation v1'
export type UsdContextPresentation = {
  state: 'aligned' | 'conflicted' | 'balanced' | 'unchanged' | 'insufficient';
  direction: 'long' | 'short' | null; label: string; evidence: Evidence | null;
  long: number; short: number; net: number; separation: number; coverage: number;
  narrow: boolean; qualified: boolean; leaders: string[]; explanation: string;
}
const cache = new WeakMap<ContextResult, Map<string, UsdContextPresentation>>()
const clean = (n: number) => Math.round(n * 1e12) / 1e12

/** Presentation only: reuse canonical votes, never reweight, recalibrate or infer missing inputs. */
export function usdContextPresentation(symbol: string, result: ContextResult | null | undefined, asOf?: number): UsdContextPresentation {
  const unavailable = (reason: string, coverage = 0): UsdContextPresentation => ({
    state: 'insufficient', direction: null, label: 'Insufficient context', evidence: null,
    long: 0, short: 0, net: 0, separation: 0, coverage, narrow: false, qualified: true, leaders: [], explanation: reason,
  })
  const pair = usdPair(symbol)
  if (!pair || !result) return unavailable('No usable USD context is available for this pair and time.')
  const active = result.members.filter(m => m.status === 'active')
  if (asOf !== undefined && (!Number.isFinite(asOf) || active.some(m => !Number.isFinite(m.chartAt) || m.chartAt > asOf)))
    return unavailable('A source is not known at the inspected clock; no directional interpretation is available.')
  const cached = cache.get(result)?.get(symbol)
  if (cached) return cached
  const configured = [...new Set([...result.members.map(m => m.family), ...result.missing])]
  const weight = (f: keyof typeof contextWeights) => result.policy?.weights[f] ?? contextWeights[f]
  const budget = configured.reduce((n, f) => n + weight(f), 0)
  const coverage = result.decision?.coverage ?? (budget ? active.reduce((n, m) => n + weight(m.family) * (m.coverage ?? 1), 0) / budget : 0)
  let presentation: UsdContextPresentation
  const valid = Number.isFinite(result.total) && active.length > 0 && new Set(active.map(m => m.family)).size === active.length &&
    active.every(m => m.family in contextWeights && Number.isFinite(m.contribution) && Number.isFinite(m.coverage ?? 1) && (m.coverage ?? 1) > 0 && (m.coverage ?? 1) <= 1) &&
    Number.isFinite(coverage) && coverage >= 0 && coverage <= 1 + 1e-12
  if (!valid || result.total === null || Math.abs(active.reduce((n, m) => n + m.contribution, 0) - result.total) > 1e-10)
    presentation = unavailable('Invalid or unavailable numerical context cannot establish a direction.')
  else if (result.decision?.state === 'insufficient' || coverage + 1e-12 < interpretationLimits.coverage)
    presentation = unavailable(result.decision?.reason ?? 'Less than 60% of the configured budget has usable components. Missing observations are not inferred.', coverage)
  else {
    const orient = pair.usdSide === 'base' ? 1 : -1
    const long = active.reduce((n, m) => n + Math.max(0, orient * m.contribution), 0)
    const short = active.reduce((n, m) => n + Math.max(0, -orient * m.contribution), 0)
    const net = clean(orient * result.total), gross = long + short
    const direction = net > 0 ? 'long' : net < 0 ? 'short' : null
    const state = gross <= 1e-12 ? 'unchanged' : net === 0 ? 'balanced' : long > 0 && short > 0 ? 'conflicted' : 'aligned'
    const separation = gross ? Math.min(1, Math.abs(net) / gross) : 0
    const narrow = state === 'conflicted' && separation < interpretationLimits.agreement
    const qualified = coverage < 1 - 1e-12 || result.missing.length > 0 || active.some(m => m.reduced || (m.coverage ?? 1) < 1)
    const evidence = !direction ? null : narrow || qualified || result.strength === 'weak' ? 'weak' :
      state === 'conflicted' ? 'moderate' : result.strength ?? 'moderate'
    const side = direction === 'long' ? 'Long' : 'Short'
    const classification = state === 'unchanged' ? 'Unchanged · No lead' : state === 'balanced' ? 'Balanced conflict · No lead' :
      state === 'conflicted' ? `Conflicted · ${side} leads` : `Aligned · ${side}`
    const leaders = direction ? active.filter(m => Math.sign(orient * m.contribution) === Math.sign(net))
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).map(m => m.sourceLabel ?? contextNames[m.family]) : []
    const explanation = state === 'unchanged' ? 'Usable family votes are zero. No directional support is added.' :
      state === 'balanced' ? 'Long and Short weighted support cancel at the engine’s score precision. Neither side leads; no priority tie-break is used.' :
        `${side} has more retained, policy-weighted support${state === 'conflicted' ? '; opposing family support remains present' : ' among the active family votes'}.${narrow ? ' The lead is narrow and evidence is Weak.' : ''}`
    presentation = { state, direction, label: `${symbol} · ${classification}`, evidence, long, short, net, separation,
      coverage, narrow, qualified, leaders,
      explanation: `${explanation}${qualified ? ' Some configured evidence is missing, incomplete or expired; it does not confirm the lead.' : ''} USD inputs only; support shares are not probabilities. This describes accumulated support, not Roof fresh-change scores.` }
  }
  const entries = cache.get(result) ?? new Map<string, UsdContextPresentation>()
  entries.set(symbol, presentation); cache.set(result, entries)
  return presentation
}

export function usdPresentationUpdate(symbol: string, point: ContextPoint, presentation: UsdContextPresentation) {
  const incoming = point.result.members.filter(m => m.chartAt === point.chartAt)
  if (!incoming.length) return point.update
  return `${incoming.map(m => `${m.sourceLabel}: ${m.status !== 'active' ? 'no usable new vote' : m.total === 0 ?
    'zero net source vote' : `${contextPairLabel(symbol, m.usdDirection)} standalone; latest family vote updated`}`).join('; ')}. Accumulated context: ${presentation.label}.`
}
