import type { MagnitudeDistribution } from '../../inspector/magnitude/magnitude-distribution'
import type { MagnitudeMode } from '../../inspector/magnitude/settings/magnitude-settings-store'
import type { calibrateHistoricalSignal } from '../../inspector/scoring/shared/core/historical-release-signals'

export type ScatterSignal = ReturnType<typeof calibrateHistoricalSignal> & { description: string }

export type ScatterOption = { id: string; label: string }
export type ScatterReleaseTarget = { brokerId: string; familyId: string; releaseId: string; at: number }
export type ScatterPlotDockProps = { brokerId: string | null; clockOffsetMs?: number; target?: ScatterReleaseTarget | null }
export type ScatterPoint = {
  id: string; releaseId: string; at: number; delta: number; actual: number; previous: number
  tone: 'higher' | 'lower' | 'unchanged' | 'missing' | 'unrated'; breakBefore?: boolean
  signal?: ScatterSignal
}
export type ScatterInspection = {
  releaseId: string; at: number; point: ScatterPoint | null
  actual: number | null; previous: number | null; delta: number | null
  distribution: MagnitudeDistribution | null; samples: ScatterPoint[]; excluded: number; earlierCount: number
  magnitudeMode: MagnitudeMode | 'automatic'
  signal?: ScatterSignal
}
export type ScatterModel = {
  points: ScatterPoint[]; inspection: ScatterInspection | null
  deltaUnit: string
  formatDelta: (value: number | null, maximumFractionDigits?: number) => string
  formatReading: (value: number | null) => string
  measure?: 'signal'; description?: string; axisLabel?: string
}
