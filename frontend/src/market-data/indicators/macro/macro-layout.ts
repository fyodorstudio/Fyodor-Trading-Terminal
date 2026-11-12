import { macroCatalog } from './macro-catalog'
import { selectedMacroMetrics, type MacroPreferences } from './macro-preferences'

export type MacroCategory = { id: string; label: string }
export type MacroLayout = { hideLegend: boolean; laneMode: boolean; categoryOrder: string[]; collapsed: string[]; rowOrder: string[]; laneOffset?: number; laneSpacing?: number }
export const defaultMacroCategories: MacroCategory[] = [
  { id: 'policy', label: 'Policy' }, { id: 'labor', label: 'Labor' },
  { id: 'inflation', label: 'Inflation' }, { id: 'growth', label: 'Growth' }, { id: 'uncategorized', label: 'Uncategorized' },
]
export function macroLayout(preferences: MacroPreferences): MacroLayout {
  return { hideLegend: false, laneMode: false, categoryOrder: [], collapsed: [], rowOrder: [], laneOffset: 0, laneSpacing: 28, ...preferences.layout }
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
export function macroLanes(preferences: MacroPreferences) {
  const selected = selectedMacroMetrics(preferences), layout = macroLayout(preferences)
  if (!selected.length) return { groups: [] as { id: string; label: string; top: number; bottom: number; collapsed: boolean; rows: { key: string; y: number }[]; keys: string[] }[], height: 0 }
  const order = [...new Set([...layout.rowOrder, ...selected])].filter(key => selected.includes(key))
  let y = 0
  const groups = macroCategories(preferences).flatMap(category => {
    const keys = order.filter(key => macroCategory(preferences, key) === category.id)
    const top = y, collapsed = layout.collapsed.includes(category.id)
    const spacing = Math.max(0.1, Math.min(120, layout.laneSpacing ?? 28))
    const rows = collapsed ? [] : keys.map((key, index) => ({ key, y: top + 0.8 * spacing + index * spacing }))
    y += 0.8 * spacing + (collapsed ? 0 : keys.length * spacing)
    return [{ ...category, top, bottom: y, collapsed, rows, keys }]
  })
  return { groups, height: y }
}
export function patchMacroLayout(preferences: MacroPreferences, patch: Partial<MacroLayout>): MacroPreferences {
  return { ...preferences, layout: { ...macroLayout(preferences), ...patch } }
}
export function moveMacroRow(preferences: MacroPreferences, key: string, category: string, before?: string): MacroPreferences {
  const order = [...new Set([...macroLayout(preferences).rowOrder, ...selectedMacroMetrics(preferences)])].filter(item => item !== key)
  const index = before ? order.indexOf(before) : -1
  order.splice(index < 0 ? order.length : index, 0, key)
  return { ...patchMacroLayout(preferences, { rowOrder: order }), categoryByEvent: { ...preferences.categoryByEvent, [key]: category } }
}
export function moveMacroCategory(preferences: MacroPreferences, id: string, before?: string) {
  const order = macroCategories(preferences).map(category => category.id).filter(key => key !== id)
  const index = before ? order.indexOf(before) : -1
  order.splice(index < 0 ? order.length : index, 0, id)
  return patchMacroLayout(preferences, { categoryOrder: order })
}
export function deleteMacroCategory(preferences: MacroPreferences, id: string): MacroPreferences {
  if (id === 'uncategorized') return preferences
  const categoryByEvent = { ...preferences.categoryByEvent }
  for (const key of selectedMacroMetrics(preferences).concat(Object.keys(categoryByEvent)))
    if (macroCategory(preferences, key) === id) categoryByEvent[key] = 'uncategorized'
  return { ...preferences, categories: (preferences.categories ?? defaultMacroCategories).filter(category => category.id !== id), categoryByEvent }
}
