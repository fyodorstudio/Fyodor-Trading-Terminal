import type { ChartDrawingRecord } from './chart-drawing-record'

const storageKey = 'fyodor.chart-drawings.v1'

function isDrawingRecord(value: unknown): value is ChartDrawingRecord {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ChartDrawingRecord>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.symbol === 'string' &&
    typeof candidate.timeframe === 'string' &&
    typeof candidate.tool === 'string' &&
    Array.isArray(candidate.points) &&
    candidate.points.every(
      (point) =>
        point &&
        typeof point === 'object' &&
        typeof point.time === 'number' &&
        Number.isFinite(point.time) &&
        typeof point.price === 'number' &&
        Number.isFinite(point.price),
    )
  )
}

export function readChartDrawings(): ChartDrawingRecord[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed.filter(isDrawingRecord) : []
  } catch {
    return []
  }
}

export function saveChartDrawings(drawings: ChartDrawingRecord[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(drawings))
  } catch {
    // Drawings remain available for this session when storage is unavailable.
  }
}
