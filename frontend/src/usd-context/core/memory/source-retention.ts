import type { ContextFamily, FamilyAssessment } from '../contracts'

export const contextDayMs = 86400000
// Cadence-based prototype half-lives, independent of dates and FX returns.
// The existing hard expiry remains a separate maximum lifetime.
export const contextHalfLifeDays = (family: ContextFamily) => family === 'claims' ? 7 : family === 'gdp' ? 90 : 30
export const sourceAgeDays = (source: FamilyAssessment, chartAt: number) =>
  Math.max(0, Math.floor(chartAt / contextDayMs) - Math.floor(source.chartAt / contextDayMs))

export function sourceMemory(source: FamilyAssessment, chartAt: number, weight: number) {
  const ageDays = sourceAgeDays(source, chartAt), halfLifeDays = contextHalfLifeDays(source.family)
  const retention = 2 ** (-ageDays / halfLifeDays)
  // Compatibility with older in-memory assessments; canonical sources supply coverage.
  const available = source.coverage ?? 1
  const coverage = Number.isFinite(available) && available >= 0 && available <= 1 ? available : 0
  return { ageDays, halfLifeDays, retention, coverage, effectiveWeight: weight * retention * coverage }
}
