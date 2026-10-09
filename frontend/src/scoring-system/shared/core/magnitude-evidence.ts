type EvidenceReading = { group: string; points: number | null; weight: number }

// Descriptive policy grades, not statistical confidence or price probabilities.
// Related features share a group and cannot provide separate confirmations.
export function magnitudeEvidence(readings: readonly EvidenceReading[], direction: string,
  tieBreak: boolean, cautions: readonly string[] = []) {
  const usable = readings.filter((r) => r.points !== null)
  const reduced = usable.length !== readings.length
  const net = usable.reduce((sum, r) => sum + r.points! * r.weight, 0)
  const gross = usable.reduce((sum, r) => sum + Math.abs(r.points! * r.weight), 0)
  const availableWeight = usable.reduce((sum, r) => sum + r.weight, 0)
  const agreement = gross === 0 ? null : Math.abs(net) / gross
  const grouped = new Map<string, number>()
  for (const r of usable) grouped.set(r.group, (grouped.get(r.group) ?? 0) + r.points! * r.weight)
  const sign = direction === 'short' ? 1 : direction === 'long' ? -1 : 0
  const supportingGroups = sign === 0 ? 0 : [...grouped.values()].filter((n) => Math.sign(n) === sign).length
  const strength = sign === 0 ? null : reduced || tieBreak || agreement! < 1 / 3 ? 'weak' :
    supportingGroups >= 2 && agreement! >= 2 / 3 && cautions.length === 0 ? 'strong' : 'moderate'
  const reasons = [
    ...(reduced ? ['Limited data: some scoring components are unavailable.'] : []),
    ...(tieBreak ? ['Conflicting readings cancel; the published priority decides the bias.'] :
      sign !== 0 && agreement! < 1 / 3 ? ['Conflicting readings leave a narrow weighted lead.'] : []),
    ...(sign !== 0 && supportingGroups < 2 ? ['One evidence group drives the direction; related signals are not separate confirmations.'] : []),
    ...cautions,
  ]
  const strengthReason = reasons.join(' ') || (sign === 0 ? 'No usable directional evidence.' :
    strength === 'strong' ? 'Different evidence groups broadly support the same direction.' : 'Some readings point in opposite directions.')
  const averageMagnitude = availableWeight === 0 ? null : gross / availableWeight
  const changeSize = averageMagnitude === null || gross === 0 ? null :
    averageMagnitude <= 1 ? 'Modest change' : averageMagnitude <= 2 ? 'Noticeable change' : averageMagnitude <= 3 ? 'Large change' : 'Extreme change'
  return { reduced, agreement, availableWeight, supportingGroups, strength, strengthReason, averageMagnitude, changeSize }
}
