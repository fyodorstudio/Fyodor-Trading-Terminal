type Reading = { points: number | null; weight: number; baseWeight?: number }

// Completeness is distinct from agreement. Use NFP's base weights so its
// deliberate participation qualifier is not counted again as missing coverage.
export function sourceCoverage(readings: readonly Reading[] | undefined) {
  if (!readings?.length) return 0
  const nominal = readings.reduce((sum, r) => sum + (r.baseWeight ?? r.weight), 0)
  const usable = readings.reduce((sum, r) => sum + (r.points === null ? 0 : r.baseWeight ?? r.weight), 0)
  return nominal > 0 ? usable / nominal : 0
}
