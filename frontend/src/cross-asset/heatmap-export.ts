import { formatHeatmapChange, heatmapDate, orderHeatmapGroups, type HeatmapMode, type HeatmapRow } from './heatmap-model'

export function heatmapChangesText(rows: HeatmapRow[], day: string, mode: HeatmapMode, groupOrder: string[]) {
  const heading = mode === 'weekly' ? `${day} – ${heatmapDate(Date.parse(day) + 6 * 86400_000)} · Weekly` : `${day} · Daily`
  const sections = orderHeatmapGroups(rows.map(row => row.group), groupOrder).flatMap(group => {
    const entries = rows.filter(row => row.group === group).map(row => ({ label: row.label, value: row.points.get(day)?.value }))
      .filter((entry): entry is { label: string; value: number } => entry.value != null && Number.isFinite(entry.value))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    return entries.length ? [`${group}\n${entries.map(entry => `${entry.label} ${formatHeatmapChange(entry.value)}`).join('\n')}`] : []
  })
  return sections.length ? [heading, ...sections].join('\n\n') : ''
}
