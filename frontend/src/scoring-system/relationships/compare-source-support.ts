import type { FamilyAssessment, SupportComponent } from '../context/usd/contracts'

/** Grade the preceding derived features under limits known at the latest release.
 * This is interpretation change, not a native-unit economic growth estimate.
 * No historical assessment is rewritten and no future calibration is admitted.
 */
export function compareSourceSupport(previous: FamilyAssessment, current: FamilyAssessment) {
  const unavailable = (reason: string) => ({ previousAtCurrentCalibration: null, reason })
  if (previous.total === null || current.total === null || !Number.isFinite(previous.total) || !Number.isFinite(current.total))
    return unavailable('Both assessments require finite calibrated scores.')
  if (previous.calibrationBasis && previous.calibrationBasis === current.calibrationBasis)
    return { previousAtCurrentCalibration: previous.total, reason: 'Matching calibration limits.' }
  const before = previous.components?.filter(c => c.points !== null), after = current.components?.filter(c => c.points !== null)
  if (!before?.length || !after?.length || before.length !== after.length ||
    new Set(before.map(c => c.id)).size !== before.length || new Set(after.map(c => c.id)).size !== after.length)
    return unavailable('Component and calibration provenance is unavailable or ambiguous.')
  let total = 0
  for (const now of after) {
    const old = before.find(c => c.id === now.id)
    if (!old || old.weight !== now.weight || !Number.isFinite(now.weight) || now.weight < 0)
      return unavailable('Comparison components or their weights differ.')
    const points = grade(old.value, now.limits)
    if (points === null) return unavailable('The preceding feature cannot be graded under the current limits.')
    total += points * now.weight
  }
  return { previousAtCurrentCalibration: total / 100, reason: 'Both features compared under the latest release calibration.' }
}

function grade(value: number | null, limits: SupportComponent['limits']) {
  if (value === null || !Number.isFinite(value)) return null
  if (value === 0) return 0
  if (!limits || limits.length !== 3 || !limits.every(Number.isFinite) || limits[0] <= 0 || limits[0] > limits[1] || limits[1] > limits[2]) return null
  return Math.sign(value) * (Math.abs(value) <= limits[0] ? 1 : Math.abs(value) <= limits[1] ? 2 : Math.abs(value) <= limits[2] ? 3 : 4)
}
