import { inspectorDelta, formatInspectorValue, inspectorValueUnit } from '../../inspector/inspector-data'
import { gradeFamilyReading } from '../../inspector/grading/reading-grading'
import { familyHistoryReleases, familyMagnitudeSamples } from '../../inspector/magnitude/family-magnitude-history'
import type { MagnitudeFamily } from '../../inspector/magnitude/magnitude-families'
import { magnitudeDistribution } from '../../inspector/magnitude/magnitude-distribution'
import { magnitudeConfiguration, type MagnitudeSettings } from '../../inspector/magnitude/settings/magnitude-settings-store'
import type { StoredCalendarEvent } from '../../inspector/useStoredCalendar'
import type { ScatterModel, ScatterPoint } from '../contracts/scatter-plot-types'

export function familyScatterModel(events: StoredCalendarEvent[], now: number, seriesId: string,
  selectedReleaseId: string | null, family: MagnitudeFamily, settings: MagnitudeSettings = {}): ScatterModel {
  const releases = familyHistoryReleases(events, now + 1, family).sort((a, b) => a.releaseAt! - b.releaseAt!)
  const latest = releases.findLast((release) => release.events.length === family.seriesIds.length && family.seriesIds.every((id) => {
    const rows = release.events.filter((row) => row.event_id === id)
    return rows.length === 1 && inspectorDelta(rows[0]) !== null
  }))
  const selected = selectedReleaseId ? releases.find((release) => release.id === selectedReleaseId) : latest
  const currentRows = selected?.events.filter((row) => row.event_id === seriesId) ?? []
  const current = currentRows.length === 1 ? currentRows[0] : null
  const reference = current ?? releases.flatMap((release) => release.events).findLast((row) => row.event_id === seriesId)
  const deltaUnit = reference ? inspectorValueUnit(reference, true).trim() : ''
  const formatDelta = (value: number | null, maximumFractionDigits = 6) => reference ? formatInspectorValue(value, reference, true, maximumFractionDigits) : '—'
  const formatReading = (value: number | null) => reference ? formatInspectorValue(value, reference) : '—'
  if (!reference || !selected || !family.seriesIds.includes(seriesId)) return { points: [], inspection: null, deltaUnit, formatDelta, formatReading }
  const toPoint = (sample: ReturnType<typeof familyMagnitudeSamples>['samples'][number]): ScatterPoint => ({
    id: sample.event.value_id, releaseId: sample.releaseId, at: sample.at, delta: sample.delta,
    actual: sample.event.actual!, previous: sample.event.previous!,
    tone: gradeFamilyReading(sample.event, family.familyId, family)?.grade ?? 'unrated',
  })
  const admitted = familyMagnitudeSamples(releases, reference)
  const positions = new Map(releases.map((release, index) => [release.id, index]))
  const points = admitted.samples.map((sample, index) => ({ ...toPoint(sample), breakBefore: index > 0 &&
    positions.get(sample.releaseId)! !== positions.get(admitted.samples[index - 1].releaseId)! + 1 }))
  const samples = points, config = magnitudeConfiguration(settings, seriesId)
  const distribution = config.mode === 'undefined' ? null : magnitudeDistribution(samples.map((point) => point.delta), current ? inspectorDelta(current) : null, config.limits)
  return { points, deltaUnit, formatDelta, formatReading, inspection: {
    releaseId: selected.id, at: selected.releaseAt!, point: points.find((point) => point.releaseId === selected.id) ?? null,
    actual: current?.actual ?? null, previous: current?.previous ?? null, delta: current ? inspectorDelta(current) : null,
    magnitudeMode: config.mode, distribution, samples, excluded: admitted.excluded,
    earlierCount: samples.filter((point) => point.at < selected.releaseAt!).length,
  } }
}
