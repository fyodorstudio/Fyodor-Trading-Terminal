import { heatmapDate, type HeatmapMode } from './heatmap-model'

export type WildcardRow = { id: string; title: string; archived: boolean; notes: Record<string, string> }
export type WildcardSnapshot = { schema: 1; source_id: string; revision: number; rows: WildcardRow[] }

export function wildcardNotes(row: WildcardRow, day: string, mode: HeatmapMode) {
  // At most seven lookups per visible cell, regardless of the story's history.
  return Array.from({ length: mode === 'weekly' ? 7 : 1 }, (_, index) => heatmapDate(Date.parse(day) + index * 86400_000))
    .flatMap(date => row.notes[date] ? [[date, row.notes[date]] as [string, string]] : [])
}

export function wildcardsMarkdown(rows: WildcardRow[]) {
  return ['# Wildcards', ...rows.map(row => [`## ${row.title}${row.archived ? ' (archived)' : ''}`,
    ...Object.entries(row.notes).sort(([a], [b]) => a.localeCompare(b)).map(([date, text]) => `### ${date}\n\n${text}`)].join('\n\n'))].join('\n\n') + '\n'
}

export function validWildcardSnapshot(value: unknown, broker: string): value is WildcardSnapshot {
  if (!value || typeof value !== 'object') return false
  const body = value as WildcardSnapshot
  if (body.schema !== 1 || body.source_id !== broker || !Number.isSafeInteger(body.revision) || body.revision < 0 || !Array.isArray(body.rows) || body.rows.length > 128) return false
  const ids = new Set<string>()
  return body.rows.every(row => {
    if (!row || !/^[a-f0-9]{32}$/.test(row.id) || ids.has(row.id) || typeof row.title !== 'string' || !row.title.trim() || row.title.length > 120
      || typeof row.archived !== 'boolean' || !row.notes || typeof row.notes !== 'object' || Array.isArray(row.notes)) return false
    ids.add(row.id)
    const entries = Object.entries(row.notes)
    return entries.length <= 3660 && entries.every(([date, text]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= '2015-01-01' && date <= '2100-12-31'
      && Number.isFinite(Date.parse(date)) && heatmapDate(Date.parse(date)) === date && typeof text === 'string' && !!text.trim() && text.length <= 20000)
  })
}
