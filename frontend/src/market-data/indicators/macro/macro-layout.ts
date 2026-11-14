import { macroEventRowKey } from './macro-event-key'
import { macroCatalog } from './macro-catalog'
import { macroAxis, selectedMacroMetrics, type MacroPreferences } from './macro-preferences'

export type MacroCategory = { id: string; label: string }
export type MacroPlacement = { from: number; to: number; height: number; unitsPerPixel: number; topValue: number }
export type MacroLayout = { hideLegend: boolean; laneMode: boolean; categoryOrder: string[]; collapsed: string[]; rowOrder: string[]; laneOffset?: number; laneSpacing?: number; rowOffsets?: Record<string, number>; categoryTarget?: string; laneSlots?: Record<string, number>; laneScroll?: number; axisPlacements?: Record<string, MacroPlacement>; linked?: boolean; axisRestoreId?: string }
export const defaultMacroCategories: MacroCategory[] = [
  { id: 'policy', label: 'Policy' }, { id: 'labor', label: 'Labor' },
  { id: 'inflation', label: 'Inflation' }, { id: 'growth', label: 'Growth' }, { id: 'uncategorized', label: 'Uncategorized' },
]
export function macroLayout(preferences: MacroPreferences): MacroLayout {
  return { hideLegend: true, laneMode: false, categoryOrder: [], collapsed: [], rowOrder: [], laneOffset: 0, laneSpacing: 28, rowOffsets: {}, ...preferences.layout }
}
export function macroCategories(preferences: MacroPreferences) {
  const categories = [...new Map((preferences.categories ?? defaultMacroCategories).map(category => [category.id, category])).values()]
  if (!categories.some(category => category.id === 'uncategorized')) categories.push({ id: 'uncategorized', label: 'Uncategorized' })
  const order = macroLayout(preferences).categoryOrder
  return [...categories].sort((a, b) => (order.includes(a.id) ? order.indexOf(a.id) : order.length) - (order.includes(b.id) ? order.indexOf(b.id) : order.length))
}
export function macroCategory(preferences: MacroPreferences, key: string) {
  const id = preferences.categoryByEvent?.[key] ?? macroCatalog[key]?.category
  return macroCategories(preferences).some(category => category.id === id) ? id! : 'uncategorized'
}
export function macroSelection(preferences: MacroPreferences) {
  const target = macroLayout(preferences).categoryTarget
  return target ? [...selectedMacroMetrics(preferences), macroEventRowKey].filter(key => macroCategory(preferences, key) === target) : [macroAxis(preferences)]
}
export function macroLanes(preferences: MacroPreferences) {
  const selected = [...selectedMacroMetrics(preferences), macroEventRowKey], layout = macroLayout(preferences)
  if (!selected.length) return { groups: [] as { id: string; label: string; top: number; bottom: number; collapsed: boolean; rows: { key: string; y: number }[]; keys: string[] }[], height: Math.max(0, ...Object.values(layout.laneSlots ?? {}).map(slot => (slot + 1) * (layout.laneSpacing ?? 28))) }
  const slots = { ...layout.laneSlots }, frozen = Object.keys(slots).length > 0
  let nextSlot = Math.max(0, ...Object.values(slots)) + 1
  const order = [...new Set([...layout.rowOrder, ...selected])].filter(key => selected.includes(key))
  let y = 0
  const groups = macroCategories(preferences).flatMap(category => {
    const keys = order.filter(key => macroCategory(preferences, key) === category.id)
    const top = y, collapsed = layout.collapsed.includes(category.id)
    const spacing = Math.max(0.1, Math.min(120, layout.laneSpacing ?? 28))
    const rows = keys.map((key, index) => {
      if (frozen && slots[key] === undefined) slots[key] = nextSlot++
      return { key, y: frozen ? slots[key] * spacing : top + 0.8 * spacing + index * spacing }
    })
    y += 0.8 * spacing + keys.length * spacing
    return [{ ...category, top, bottom: y, collapsed, rows, keys }]
  })
  return { groups, height: frozen ? Math.max(y, ...Object.values(slots).map(slot => (slot + 1) * (layout.laneSpacing ?? 28))) : y }
}
/** Capture current row anchors before a selection changes; hidden currencies keep their slots. */
export function rememberMacroLanes(preferences: MacroPreferences): MacroPreferences {
  const layout = macroLayout(preferences), laneSlots = { ...layout.laneSlots }, spacing = layout.laneSpacing ?? 28
  for (const group of macroLanes(preferences).groups) for (const row of group.rows) laneSlots[row.key] = row.y / spacing
  return patchMacroLayout(preferences, { laneSlots })
}
export function patchMacroLayout(preferences: MacroPreferences, patch: Partial<MacroLayout>): MacroPreferences {
  return { ...preferences, layout: { ...macroLayout(preferences), ...patch } }
}
export function moveMacroRow(preferences: MacroPreferences, key: string, category: string, before?: string): MacroPreferences {
  const layout = macroLayout(preferences), rowOffsets = { ...layout.rowOffsets }
  delete rowOffsets[key]
  const order = [...new Set([...layout.rowOrder, ...selectedMacroMetrics(preferences), macroEventRowKey])].filter(item => item !== key)
  const index = before ? order.indexOf(before) : -1
  order.splice(index < 0 ? order.length : index, 0, key)
  const color = preferences.categoryColors?.[category]
  return { ...patchMacroLayout(preferences, { rowOrder: order, rowOffsets, laneSlots: {} }), categoryByEvent: { ...preferences.categoryByEvent, [key]: category },
    ...(color && preferences.series[key] ? { series: { ...preferences.series, [key]: { ...preferences.series[key], color } } } : {}) }
}
export function moveMacroCategory(preferences: MacroPreferences, id: string, before?: string) {
  const order = macroCategories(preferences).map(category => category.id).filter(key => key !== id)
  const index = before ? order.indexOf(before) : -1
  order.splice(index < 0 ? order.length : index, 0, id)
  return patchMacroLayout(preferences, { categoryOrder: order, laneSlots: {} })
}
export function deleteMacroCategory(preferences: MacroPreferences, id: string): MacroPreferences {
  if (id === 'uncategorized') return preferences
  const categoryByEvent = { ...preferences.categoryByEvent }
  for (const key of selectedMacroMetrics(preferences).concat(Object.keys(categoryByEvent)))
    if (macroCategory(preferences, key) === id) categoryByEvent[key] = 'uncategorized'
  const layout = preferences.layout && { ...preferences.layout }
  if (layout?.categoryTarget === id) delete layout.categoryTarget
  return { ...preferences, categories: (preferences.categories ?? defaultMacroCategories).filter(category => category.id !== id), categoryByEvent,
    ...(layout ? { layout } : {}) }
}
