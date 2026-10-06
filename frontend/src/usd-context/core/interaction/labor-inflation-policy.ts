import type { ContextMember, ContextPolicy, ContextPolicyCheck } from '../contracts'
import { contextWeights } from '../policy'

// Declared prototype safeguards, not Fed targets or fitted FX coefficients.
// Freeze policy before auditing; no dates, prices, surveys or future guidance enter.
export const laborPriorityGuards = { monthlyCore: .3, threeMonthCore: .3, annualCore: 3.5, pressure: 2 } as const
export const laborPriorityWeights = { ...contextWeights, nfp: contextWeights.nfp + 20, cpi: contextWeights.cpi - 20 }
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const within = (value: number, ceiling: number) => Math.round(value * 1e12) / 1e12 <= ceiling
const percent = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 3 })}%`

export function resolveLaborInflationPolicy(members: readonly ContextMember[], guards: typeof laborPriorityGuards | {
  monthlyCore: number; threeMonthCore: number; annualCore: number; pressure: number
} = laborPriorityGuards): ContextPolicy {
  const nfp = members.find(m => m.family === 'nfp' && m.status === 'active')
  const cpi = members.find(m => m.family === 'cpi' && m.status === 'active')
  const labor = nfp?.traits?.kind === 'nfp' ? nfp.traits : null
  const inflation = cpi?.traits?.kind === 'cpi' ? cpi.traits : null
  const checks: ContextPolicyCheck[] = []
  const check = (label: string, known: boolean, pass: boolean, detail: string) => {
    checks.push({ label, state: !known ? 'unavailable' : pass ? 'pass' : 'fail', detail })
  }
  check('Confirmed labor deterioration', !!nfp && !!labor && finite(labor.hiringChange) && finite(labor.unemploymentSignal),
    !!nfp && !nfp.reduced && nfp.strength === 'strong' && nfp.usdDirection === 'weaker' &&
      !!labor && labor.hiringChange! < 0 && labor.unemploymentSignal! < 0,
    'Requires a complete, Strong NFP weakness assessment, hiring below its recent average, and rising unemployment.')
  check('Usable opposing CPI', !!cpi, !!cpi && !cpi.reduced && cpi.usdDirection === 'stronger',
    'Requires a complete, active CPI assessment supporting USD; cooling CPI keeps the balanced policy.')
  const level = (label: string, value: number | null | undefined, ceiling: number) =>
    check(label, finite(value), finite(value) && within(value, ceiling),
      `${finite(value) ? percent(value) : 'Unavailable'}; declared ceiling ${percent(ceiling)}.`)
  level('Latest core monthly pace', inflation?.monthlyCore, guards.monthlyCore)
  level('Recent core monthly average', inflation?.threeMonthCore, guards.threeMonthCore)
  level('Annual core level', inflation?.annualCore, guards.annualCore)
  check('Inflation acceleration guard', !!inflation && finite(inflation.monthlyPressure) && finite(inflation.annualPressure),
    !!inflation && finite(inflation.monthlyPressure) && finite(inflation.annualPressure) &&
      inflation.monthlyPressure <= guards.pressure && inflation.annualPressure <= guards.pressure,
    `Positive core acceleration must be at most ${guards.pressure} magnitude points (Medium). Related monthly signals use their largest positive magnitude, not a sum.`)
  const otherInflation = members.filter(m => ['pce','ppi'].includes(m.family) && m.status === 'active')
  if (otherInflation.length) check('Other inflation escalation guard', true,
    otherInflation.every(m => !(m.usdDirection === 'stronger' && m.strength === 'strong' && Math.abs(m.total ?? 0) >= 2)),
    'An active Strong USD-supportive PCE or PPI score of at least 2 blocks the labor-priority transfer. Smaller or opposing votes retain their inflation-budget weight.')
  const triggered = checks.every(c => c.state === 'pass')
  return { mode: triggered ? 'labor-priority' : 'balanced',
    label: triggered ? 'Labor priority' : 'Balanced priorities',
    weights: triggered ? laborPriorityWeights : contextWeights, checks,
    reason: triggered ? 'Confirmed labor deterioration receives priority while core inflation stays within the declared escalation guards. This is an easing-pressure interpretation, not observed Fed guidance.' :
      `Base priorities retained: ${checks.find(c => c.state !== 'pass')!.label.toLowerCase()} ${checks.find(c => c.state !== 'pass')!.state === 'unavailable' ? 'is unavailable' : 'does not meet the interaction rule'}.` }
}
