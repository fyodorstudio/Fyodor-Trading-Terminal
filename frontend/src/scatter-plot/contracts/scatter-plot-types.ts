import type { MagnitudeDistribution } from '../../inspector/magnitude/magnitude-distribution'

export type ScatterOption = { id: string; label: string }
export type ScatterPlotDockProps = { brokerId: string | null; clockOffsetMs?: number }
export type ScatterPoint = {
  id: string; releaseId: string; at: number; delta: number; actual: number; previous: number
  tone: 'good' | 'bad' | 'unchanged' | 'missing' | 'unrated'
}
export type ScatterInspection = {
  releaseId: string; at: number; point: ScatterPoint | null
  actual: number | null; previous: number | null; delta: number | null
  distribution: MagnitudeDistribution | null; samples: ScatterPoint[]; excluded: number
  quantile: { position: number; lower: ScatterPoint; upper: ScatterPoint; fraction: number } | null
}
export type ScatterModel = {
  points: ScatterPoint[]; inspection: ScatterInspection | null
  deltaUnit: string
  formatDelta: (value: number | null, maximumFractionDigits?: number) => string
  formatReading: (value: number | null) => string
}
