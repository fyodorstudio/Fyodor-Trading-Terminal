import type { ContextFamily, FamilyAssessment } from '../contracts'

export const contextDayMs = 86400000
// Cadence-based prototype half-lives, independent of dates and FX returns.
// The existing hard expiry remains a separate maximum lifetime.
export const contextHalfLifeDays = (family: ContextFamily) => family === 'claims' ? 7 : family === 'gdp' ? 90 : 30
export const sourceAgeDays = (source: FamilyAssessment, chartAt: number) =>
  Math.max(0, Math.floor(chartAt / contextDayMs) - Math.floor(source.chartAt / contextDayMs))

export function sourceMemory(source: FamilyAssessment, chartAt: number, weight: number) {
  const validTime = Number.isFinite(source.chartAt) && Number.isFinite(chartAt) && source.chartAt <= chartAt
  const ageDays = validTime ? sourceAgeDays(source, chartAt) : 0, halfLifeDays = contextHalfLifeDays(source.family)
  const retention = validTime ? 2 ** (-ageDays / halfLifeDays) : 0
  // Compatibility with older in-memory assessments; canonical sources supply coverage.
  const available = source.coverage ?? 1
  const coverage = Number.isFinite(available) && available >= 0 && available <= 1 ? available : 0
  // Source totals already retain the original weights of unavailable components.
  // Coverage qualifies the interpretation; multiplying it again would count the
  // same missing component twice. This weight is the retained assigned budget.
  return { ageDays, halfLifeDays, retention, coverage, effectiveWeight: weight * retention }
}
