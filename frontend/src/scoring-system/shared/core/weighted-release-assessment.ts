import { calibrateHistoricalSignal, type HistoricalFeature } from './historical-release-signals'
import { magnitudeEvidence } from './magnitude-evidence'
import type { MagnitudeSettings } from '../../../inspector/magnitude/settings/magnitude-settings-store'

export type WeightedSignal = { id: string; label: string; description: string; group: string; weight: number; unit: string }
export function weightedReleaseAssessment(signals: readonly WeightedSignal[], current: Record<string, HistoricalFeature>,
  past: readonly Record<string, HistoricalFeature>[], settings: MagnitudeSettings, required: readonly string[], version: string) {
  const readings = signals.map(signal => {
    const samples = past.map(f => f[signal.id].value).filter((v): v is number => v !== null)
    const calibrated = calibrateHistoricalSignal(current[signal.id], samples, settings[signal.id])
    return { ...signal, ...calibrated, contribution: calibrated.points === null ? null : calibrated.points * signal.weight / 100 }
  })
  const usable = readings.filter(r => r.points !== null)
  const admitted = usable.some(r => required.includes(r.id))
  const units = admitted ? usable.reduce((sum, r) => sum + r.points! * r.weight, 0) : null
  const total = units === null ? null : units / 100
  const tieBreak = units === 0 ? usable.find(r => r.points !== 0) ?? null : null
  const deciding = units === 0 ? tieBreak?.points ?? 0 : units
  const direction = deciding === null || deciding === 0 ? 'uncomputed' : deciding > 0 ? 'short' : 'long'
  const driver = usable.filter(r => Math.sign(r.contribution!) === Math.sign(deciding ?? 0))
    .sort((a, b) => Math.abs(b.contribution!) - Math.abs(a.contribution!))[0]
  const explanation = !admitted ? 'No usable required component; supporting readings alone cannot establish a bias.' : units === 0 ?
    tieBreak ? `Scores cancel; ${tieBreak.label.toLowerCase()} breaks the tie.` : 'Usable signals show no directional change.' :
    `${driver?.label}: ${(driver?.value ?? 0) > 0 ? 'above' : 'below'} its comparison. This supplies the largest supporting vote.`
  return { readings, total, direction, label: direction === 'short' ? 'EURUSD Short' : direction === 'long' ? 'EURUSD Long' : 'Uncomputed',
    tieBreak, explanation, version, ...magnitudeEvidence(readings, direction, !!tieBreak) }
}
