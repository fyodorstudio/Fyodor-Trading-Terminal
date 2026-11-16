import type { HeatmapPeriod, HeatmapRow } from './heatmap-model'

export type HeatmapCell = { rowId: string; day: string }
export type HeatmapSelection = { scope: string; anchor: string } & (
  | { kind: 'cells'; cells: HeatmapCell[] }
  | { kind: 'columns'; from: string; to: string; days?: string[] }
)

export const heatmapCellKey = (rowId: string, day: string) => JSON.stringify([rowId, day])

export function heatmapColumnSelection(scope: string, day: string, anchor = day, periods?: HeatmapPeriod[]): HeatmapSelection {
  const left = periods?.findIndex(p => p.day === anchor) ?? -1, right = periods?.findIndex(p => p.day === day) ?? -1
  const days = periods && left >= 0 && right >= 0 ? periods.slice(Math.min(left, right), Math.max(left, right) + 1).filter(p => !p.future).map(p => p.day) : undefined
  return { kind: 'columns', scope, anchor, from: anchor < day ? anchor : day, to: anchor > day ? anchor : day, days }
}

export const heatmapColumnSelected = (selection: Extract<HeatmapSelection, { kind: 'columns' }>, day: string) => selection.days ? selection.days.includes(day) : day >= selection.from && day <= selection.to

export function toggleHeatmapCell(selection: HeatmapSelection | null, cell: HeatmapCell, scope: string, rows: HeatmapRow[], periods: HeatmapPeriod[]): HeatmapSelection | null {
  const cells = selection?.kind === 'cells' ? selection.cells : selection?.kind === 'columns'
    ? periods.filter(p => !p.future && heatmapColumnSelected(selection, p.day))
      .flatMap(p => rows.map(row => ({ rowId: row.id, day: p.day }))) : []
  const exists = cells.some(c => c.rowId === cell.rowId && c.day === cell.day)
  const next = exists ? cells.filter(c => c.rowId !== cell.rowId || c.day !== cell.day) : [...cells, cell]
  return next.length ? { kind: 'cells', scope, anchor: selection?.anchor ?? cell.day, cells: next } : null
}

// Filter each row's points as well as its identity: scattered cells must never
// turn into the Cartesian product of selected instruments and dates on export.
export function selectedHeatmapRows(rows: HeatmapRow[], selection: HeatmapSelection): HeatmapRow[] {
  if (selection.kind === 'columns') return rows.map(row => ({ ...row,
    points: new Map([...row.points].filter(([day]) => heatmapColumnSelected(selection, day))) }))
  const wanted = new Map<string, Set<string>>()
  for (const cell of selection.cells) {
    if (!wanted.has(cell.rowId)) wanted.set(cell.rowId, new Set())
    wanted.get(cell.rowId)!.add(cell.day)
  }
  return rows.filter(row => wanted.has(row.id)).map(row => ({ ...row,
    points: new Map([...row.points].filter(([day]) => wanted.get(row.id)!.has(day))) }))
}
