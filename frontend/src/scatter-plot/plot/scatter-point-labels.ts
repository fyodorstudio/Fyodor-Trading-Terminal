import { magnitudeSizeForValue } from '../../inspector/magnitude/magnitude-distribution'
import type { ScatterModel } from '../contracts/scatter-plot-types'
import { scatterNumber } from '../inspection/scatter-number-format'

export function scatterPointLabels(model: ScatterModel): string[] {
  const { points, inspection, formatDelta, formatReading } = model
  const distribution = inspection?.distribution
  return points.map((point) => {
    const selected = point.releaseId === inspection?.releaseId
    const later = inspection ? point.at > inspection.at : false
    const date = new Date(point.at).toISOString().slice(0, 10)
    const signal = point.signal
    if (signal) {
      const reading = (value: number) => `${scatterNumber(value)} ${signal.inputs!.unit ?? model.deltaUnit}`
      return `${date}. ${signal.description} ${signal.inputs!.actualLabel} ${reading(point.actual)}; ${signal.inputs!.baselineLabel} ${reading(point.previous)}; Scoring signal ${formatDelta(point.delta)}. ` +
        `${signal.size ?? 'Unrated'}; ${signal.magnitudeMode === 'automatic' ? 'automatic earlier-history thresholds' : 'manual override'}; N = ${signal.sampleCount}. ${signal.reason} ` +
        `${selected ? 'Inspected release.' : later ? 'Later release; context only.' : 'Earlier release.'}`
    }
    const category = inspection?.magnitudeMode === 'undefined' ? 'Magnitude undefined' :
      distribution ? magnitudeSizeForValue(distribution.limits, point.delta) : 'No usable dataset'
    return `${date}. Actual ${formatReading(point.actual)}; Previous ${formatReading(point.previous)}; A−P ${formatDelta(point.delta)}. ` +
      `${category}${distribution ? ' against all-dataset thresholds' : ''}. ${selected ? 'Inspected release.' : later ? 'Later release.' : 'Earlier release.'} Included in dataset.`
  })
}
