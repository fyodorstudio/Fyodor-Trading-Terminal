import type { EurAssessment } from '../../../inspector/scoring/PAIR/EURUSD/EUR/assessment/eur-score'
import type { EurSlot, EurSource } from '../contracts'

/** Split monthly unemployment and quarterly employment into independent memories. */
export function eurSources(assessment: EurAssessment, chartAt: number, releaseAt: number, series: readonly string[]): EurSource[] {
  const family = assessment.policy.family
  const source = (slot: EurSlot, score = assessment.total, coverage = assessment.coverage): EurSource => ({
    slot, family, label: assessment.policy.label, chartAt, releaseAt,
    reference: assessment.referenceMonth, score, coverage,
    provisional: ['german-inflation', 'german-pmi', 'french-pmi'].includes(family),
  })
  if (family !== 'euro-labor') {
    const slot = family.includes('inflation') ? 'inflation' : family.endsWith('pmi') ? 'pmi' : family === 'euro-wages' ? 'wages' : 'gdp'
    return [source(slot)]
  }
  const rows: EurSource[] = []
  if (series.includes('999030020')) {
    const unemployment = assessment.readings.find(r => r.id === 'unemployment')!
    rows.push(source('unemployment', unemployment.points, unemployment.points === null ? 0 : 1))
  }
  if (series.some(id => ['999030001', '999030002'].includes(id))) {
    const employment = assessment.readings.filter(r => r.id.startsWith('employment'))
    const weight = employment.reduce((sum, r) => sum + r.weight, 0)
    const score = employment.some(r => r.points !== null)
      ? employment.reduce((sum, r) => sum + (r.contribution ?? 0), 0) / (weight / 100) : null
    const coverage = employment.reduce((sum, r) => sum + (r.points === null ? 0 : r.weight), 0) / weight
    rows.push(source('employment', score, coverage))
  }
  return rows
}
