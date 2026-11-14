import { heatmapDate, type HeatmapMode } from './heatmap-model'
import { wildcardHeatmapDay, type WildcardEntry } from '../wildcards/wildcard-model'
import type { ChartClockScope } from '../appearance/time-display/chart-clock'

export type WildcardRow = { id: string; title: string; archived: boolean; notes: Record<string, string[]> }
export function wildcardHeatmapRows(items: readonly WildcardEntry[], scope: ChartClockScope): WildcardRow[] {
  const notes: Record<string, string[]> = {}
  for (const entry of items) {
    if (entry.archived) continue
    const date = wildcardHeatmapDay(entry, scope)
    if (date !== null) (notes[date] ??= []).push(`${entry.title}\n${entry.details}`)
  }
  return [{ id: 'global', title: 'All wildcards', archived: false, notes }]
}
export function wildcardNotes(row: WildcardRow, day: string, mode: HeatmapMode) {
  return Array.from({ length: mode === 'weekly' ? 7 : 1 }, (_, index) => heatmapDate(Date.parse(day) + index * 86400_000))
    .flatMap(date => (row.notes[date] ?? []).map(text => [date, text] as [string, string]))
}
