import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import { groupInspectorReleases, type InspectorRelease } from '../../../../../../inspector-data'
import { calibrateHistoricalSignal, earlierSignalReadings, nativeNumber, releaseSignalContext,
  usableSignal, unavailableSignal, type TimedReading, type HistoricalFeature } from '../../../../../shared/core/historical-release-signals'
import { magnitudeEvidence } from '../../../../../shared/core/magnitude-evidence'

export const nfpScoreV2Version = 'nfp-eurusd-labor-context-v2'
export const nfpV2SeriesIds = ['840030015', '840030016', '840030017', '840030018', '840030019',
  '840030020', '840030022', '840030023', '840030024', '840030032'] as const
const rules = nfpV2SeriesIds.map((id) => ({ id, units: id === '840030020' ? [3] :
  ['840030016', '840030022', '840030023', '840030032'].includes(id) ? [0, 4] : [1],
  multiplier: ['840030016', '840030022', '840030023', '840030032'].includes(id) ? 1 : 0 }))
const scoringIds = ['840030016', '840030015', '840030018', '840030020']
const signals = [
  { id: 'hiring', label: 'Hiring pace', group: 'employment', weight: 40, unit: 'thousand jobs',
    description: 'Actual payroll job change minus the preceding three-month average, with the comparison average floored at zero.' },
  { id: 'unemployment', label: 'Unemployment', group: 'slack', weight: 30, unit: 'pp',
    description: 'Inverse Actual minus supplied Previous unemployment change. Weight halves when unemployment and participation both fall.' },
  { id: 'wages', label: 'Wage pace', group: 'wages', weight: 15, unit: 'pp',
    description: 'Actual monthly earnings growth minus its preceding three-month average.' },
  { id: 'revision', label: 'Payroll revision', group: 'employment', weight: 10, unit: 'thousand jobs',
    description: 'Supplied Revised Previous minus Previous payrolls. Covers the preceding month only, not the full two-month BLS revision.' },
  { id: 'hours', label: 'Working hours', group: 'employment', weight: 5, unit: 'hours',
    description: 'Actual weekly hours minus supplied Previous weekly hours.' },
] as const
type SignalId = typeof signals[number]['id']
type Features = Record<SignalId, HistoricalFeature>
const mean = (values: number[]) => values.reduce((sum, n) => sum + n, 0) / values.length

export function supportsNfpV2(release: InspectorRelease | null) {
  return !!release && release.familyId === 'jobs' && release.currency === 'USD' && release.country === 'US'
}
function releaseFeatures(release: InspectorRelease, history: readonly TimedReading[]) {
  const context = releaseSignalContext(release, history, rules, scoringIds)
  const { current, reasons, recent, delta } = context
  function pace(id: string, floor: boolean) {
    const actual = nativeNumber(current.get(id)), preceding = recent(id)
    return actual === null ? unavailableSignal(reasons.get(id)!) : !preceding ?
      unavailableSignal('Requires usable actuals for the preceding three consecutive reference months.') :
      usableSignal(actual - (floor ? Math.max(0, mean(preceding)) : mean(preceding)))
  }
  function change(id: string, inverse = false) {
    const value = delta(id)
    return value === null ? unavailableSignal(reasons.get(id) || 'Actual and supplied Previous are required.') : usableSignal(inverse ? -value : value)
  }
  const payroll = current.get('840030016')
  const revised = nativeNumber(payroll, 'revised_previous'), previous = nativeNumber(payroll, 'previous')
  const features: Features = {
    hiring: pace('840030016', true), unemployment: change('840030015', true), wages: pace('840030018', false),
    revision: revised === null || previous === null ? unavailableSignal(reasons.get('840030016') || 'Supplied Revised Previous and Previous payrolls are required.') : usableSignal(revised - previous),
    hours: change('840030020'),
  }
  return { features, context }
}

export function assessNfpScoreV2(release: InspectorRelease | null, events: readonly EconomicCalendarEvent[]) {
  if (!release || !supportsNfpV2(release)) return null
  const history = earlierSignalReadings(release, events, nfpV2SeriesIds)
  const past = groupInspectorReleases(history).filter(supportsNfpV2).map((r) => releaseFeatures(r, history).features)
  const { features, context } = releaseFeatures(release, history)
  const participation = context.delta('840030017')
  const unemploymentFall = features.unemployment.value !== null && features.unemployment.value > 0
  const participationCaution = unemploymentFall && (participation === null || participation < 0)
  const readings = signals.map((signal) => {
    const samples = past.map((f) => f[signal.id].value).filter((n): n is number => n !== null)
    const calibrated = calibrateHistoricalSignal(features[signal.id], samples)
    const weight = signal.id === 'unemployment' && unemploymentFall && participation !== null && participation < 0 ? signal.weight / 2 : signal.weight
    return { ...signal, ...calibrated, baseWeight: signal.weight, weight,
      contribution: calibrated.points === null ? null : calibrated.points * weight / 100 }
  })
  const usable = readings.filter((r) => r.points !== null)
  const hasEmployment = usable.some((r) => r.id === 'hiring' || r.id === 'unemployment')
  const units = hasEmployment ? usable.reduce((sum, r) => sum + r.points! * r.weight, 0) : null
  const total = units === null ? null : units / 100
  const tieBreak = units === 0 ? usable.find((r) => r.points !== 0) ?? null : null
  const deciding = units === 0 ? tieBreak?.points ?? 0 : units
  const direction = deciding === null || deciding === 0 ? 'uncomputed' : deciding > 0 ? 'short' : 'long'
  const label = direction === 'short' ? 'EURUSD Short' : direction === 'long' ? 'EURUSD Long' : 'Uncomputed'
  const cautions = participationCaution ? [participation === null ?
    'Participation is unavailable; the unemployment improvement has limited context.' :
    'Unemployment fell alongside lower participation; its positive vote is halved. This does not establish why unemployment fell.'] : []
  const evidence = magnitudeEvidence(readings, direction, !!tieBreak, cautions)
  const driver = usable.filter((r) => Math.sign(r.contribution!) === Math.sign(deciding ?? 0))
    .sort((a, b) => Math.abs(b.contribution!) - Math.abs(a.contribution!))[0]
  const messages = {
    hiring: nativeNumber(context.current.get('840030016'))! < 0 ? 'Employers cut jobs.' :
      features.hiring.value! < 0 ? 'Hiring is below its recent pace.' : 'Hiring is above its recent pace.',
    unemployment: features.unemployment.value! < 0 ? 'Unemployment increased.' : 'Unemployment decreased.',
    wages: features.wages.value! < 0 ? 'Monthly wage growth is below its recent pace.' : 'Monthly wage growth is above its recent pace.',
    revision: features.revision.value! < 0 ? 'The preceding month’s payroll reading was revised down.' : 'The preceding month’s payroll reading was revised up.',
    hours: features.hours.value! < 0 ? 'Working hours decreased.' : 'Working hours increased.',
  }
  const explanation = !hasEmployment ? 'No usable hiring or unemployment component; supporting readings alone cannot establish this bias.' :
    units === 0 ? tieBreak ? `Scores cancel; ${tieBreak.label.toLowerCase()} breaks the tie.` : 'Usable signals show no directional change.' : driver ? messages[driver.id] : ''
  const supporting = [
    { id: '840030017', label: 'Participation', text: participation === null ? 'Unavailable.' : participation < 0 ?
      'Participation decreased; it has no standalone directional vote.' : participation > 0 ?
        'Participation increased; it has no standalone directional vote.' : 'Participation was unchanged.' },
    ...[['840030019', 'Annual wages'], ['840030024', 'Broader unemployment']].map(([id, label]) => {
      const value = context.delta(id)
      return { id, label, text: value === null ? 'Unavailable.' : value < 0 ? 'Decreased; supporting context only.' :
        value > 0 ? 'Increased; supporting context only.' : 'Unchanged; supporting context only.' }
    }),
    ...[['840030023', 'Private payrolls'], ['840030022', 'Government payrolls'], ['840030032', 'Manufacturing payrolls']].map(([id, label]) => {
      const actual = nativeNumber(context.current.get(id))
      return { id, label, text: actual === null ? 'Unavailable.' : actual < 0 ? 'Jobs were lost; composition only.' :
        actual > 0 ? 'Jobs were added; composition only.' : 'No net job change; composition only.' }
    }),
  ]
  return { readings, supporting, total, tieBreak, direction, label, explanation, ...evidence, version: nfpScoreV2Version }
}
