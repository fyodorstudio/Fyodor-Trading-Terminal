import { formatHeatmapChange, heatmapDate, orderHeatmapGroups, type HeatmapMode, type HeatmapRow } from './heatmap-model'

export function heatmapChangesText(rows: HeatmapRow[], dates: string | readonly string[], mode: HeatmapMode, groupOrder: string[]) {
  const groups = orderHeatmapGroups(rows.map(row => row.group), groupOrder).map(group => ({ group, rows: rows.filter(row => row.group === group) }))
  return [...new Set(typeof dates === 'string' ? [dates] : dates)].sort().flatMap(day => {
    const heading = mode === 'weekly' ? `${day} – ${heatmapDate(Date.parse(day) + 6 * 86400_000)} · Weekly` : `${day} · Daily`
    const sections = groups.flatMap(group => {
      const entries = group.rows.map(row => ({ label: row.label, value: row.points.get(day)?.value }))
        .filter((entry): entry is { label: string; value: number } => entry.value != null && Number.isFinite(entry.value))
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
      return entries.length ? [`${group.group}\n${entries.map(entry => `${entry.label} ${formatHeatmapChange(entry.value)}`).join('\n')}`] : []
    })
    return sections.length ? [[heading, ...sections].join('\n\n')] : []
  }).join('\n\n')
}
