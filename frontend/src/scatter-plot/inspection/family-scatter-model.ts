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
  const selected = releases.find((release) => release.id === selectedReleaseId) ?? latest
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
  const points = familyMagnitudeSamples(releases, reference).samples.map(toPoint)
  const admitted = familyMagnitudeSamples(releases.filter((release) => release.releaseAt! < selected.releaseAt!), reference)
  const samples = admitted.samples.map(toPoint), config = magnitudeConfiguration(settings, seriesId)
  const distribution = config.mode === 'undefined' ? null : magnitudeDistribution(samples.map((point) => point.delta), current ? inspectorDelta(current) : null, config.limits)
  const ranked = config.mode === 'p95' ? samples.slice().sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta) || a.at - b.at || a.id.localeCompare(b.id)) : []
  const numerator = (ranked.length - 1) * 19, index = Math.floor(numerator / 20)
  const quantile = ranked.length ? { position: numerator / 20, lower: ranked[index],
    upper: ranked[Math.min(index + 1, ranked.length - 1)], fraction: (numerator % 20) / 20 } : null
  return { points, deltaUnit, formatDelta, formatReading, inspection: {
    releaseId: selected.id, at: selected.releaseAt!, point: points.find((point) => point.releaseId === selected.id) ?? null,
    actual: current?.actual ?? null, previous: current?.previous ?? null, delta: current ? inspectorDelta(current) : null,
    magnitudeMode: config.mode, distribution, samples, excluded: admitted.excluded, quantile,
  } }
}
