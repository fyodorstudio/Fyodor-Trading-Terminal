import { inspectorDelta, formatInspectorValue, inspectorValueUnit } from '../../../../../inspector/inspector-data'
import { nfpReadingRules, gradeNfpReading } from '../../../../../inspector/grading/nfp-grading'
import { nfpHistoryReleases, nfpMagnitudeSamples } from '../../../../../inspector/magnitude/nfp-magnitude-history'
import { magnitudeDistribution } from '../../../../../inspector/magnitude/magnitude-distribution'
import type { StoredCalendarEvent } from '../../../../../inspector/useStoredCalendar'
import type { ScatterModel, ScatterPoint } from '../../../../contracts/scatter-plot-types'
import type { NfpMagnitudeSettings } from './magnitude/nfp-magnitude-settings'

export function nfpScatterModel(events: StoredCalendarEvent[], now: number, seriesId: string,
  selectedReleaseId: string | null, settings: NfpMagnitudeSettings = {}): ScatterModel {
  const releases = nfpHistoryReleases(events, now + 1).sort((a, b) => a.releaseAt! - b.releaseAt!)
  const required = Object.keys(nfpReadingRules)
  const latest = releases.findLast((release) => release.events.length === required.length && required.every((id) => {
    const rows = release.events.filter((row) => row.event_id === id)
    return rows.length === 1 && inspectorDelta(rows[0]) !== null
  }))
  const selected = releases.find((release) => release.id === selectedReleaseId) ?? latest
  const currentRows = selected?.events.filter((row) => row.event_id === seriesId) ?? []
  const current = currentRows.length === 1 ? currentRows[0] : null
  const reference = current ?? releases.flatMap((release) => release.events).findLast((row) => row.event_id === seriesId)
  const deltaUnit = reference ? inspectorValueUnit(reference, true).trim() : ''
  const formatDelta = (value: number | null, maximumFractionDigits = 6) => reference ? formatInspectorValue(value, reference, true, maximumFractionDigits) : '—'
  const formatReading = (value: number | null) => reference ? formatInspectorValue(value, reference) : '—'
  if (!reference || !selected) return { points: [], inspection: null, deltaUnit, formatDelta, formatReading }
  const toPoint = (sample: ReturnType<typeof nfpMagnitudeSamples>['samples'][number]): ScatterPoint => ({
    id: sample.event.value_id, releaseId: sample.releaseId, at: sample.at, delta: sample.delta,
    actual: sample.event.actual!, previous: sample.event.previous!,
    tone: gradeNfpReading(sample.event, 'jobs')?.grade ?? 'unrated',
  })
  const points = nfpMagnitudeSamples(releases, reference).samples.map(toPoint)
  const earlier = releases.filter((release) => release.releaseAt! < selected.releaseAt!)
  const admitted = nfpMagnitudeSamples(earlier, reference)
  const samples = admitted.samples.map(toPoint)
  const distribution = magnitudeDistribution(samples.map((point) => point.delta), current ? inspectorDelta(current) : null, settings[seriesId])
  const ranked = settings[seriesId] ? [] : samples.slice().sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta) || a.at - b.at || a.id.localeCompare(b.id))
  const numerator = (ranked.length - 1) * 19, index = Math.floor(numerator / 20)
  const quantile = !settings[seriesId] && ranked.length ? { position: numerator / 20, lower: ranked[index],
    upper: ranked[Math.min(index + 1, ranked.length - 1)], fraction: (numerator % 20) / 20 } : null
  return { points, deltaUnit, formatDelta, formatReading, inspection: {
    releaseId: selected.id, at: selected.releaseAt!, point: points.find((point) => point.releaseId === selected.id) ?? null,
    actual: current?.actual ?? null, previous: current?.previous ?? null, delta: current ? inspectorDelta(current) : null,
    distribution, samples, excluded: admitted.excluded, quantile,
  } }
}
