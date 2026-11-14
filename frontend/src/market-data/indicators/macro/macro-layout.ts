import { macroEventRowKey } from './macro-event-key'
import { macroCatalog } from './macro-catalog'
import { macroAxis, selectedMacroMetrics, type MacroPreferences } from './macro-preferences'

export type MacroCategory = { id: string; label: string }
export type MacroPlacement = { from: number; to: number; height: number; unitsPerPixel: number; topValue: number }
export type MacroLayout = { hideLegend: boolean; laneMode: boolean; categoryOrder: string[]; collapsed: string[]; rowOrder: string[]; laneOffset?: number; laneSpacing?: number; hiddenCategories?: string[]; categoryTarget?: string; rowTarget?: string; laneScroll?: number; axisPlacements?: Record<string, MacroPlacement>; linked?: boolean; axisRestoreId?: string }
export const defaultMacroCategories: MacroCategory[] = [
  { id: 'policy', label: 'Monetary Policy' }, { id: 'inflation', label: 'Inflation' }, { id: 'labor', label: 'Labor' },
  { id: 'growth', label: 'Growth' }, { id: 'uncategorized', label: 'Uncategorized' },
]
export function macroLayout(preferences: MacroPreferences): MacroLayout {
  return { hideLegend: true, laneMode: false, categoryOrder: [], collapsed: [], rowOrder: [], laneOffset: 0, laneSpacing: 24, hiddenCategories: [], ...preferences.layout }
}
function categoryDefinitions(preferences: MacroPreferences) {
  const aliases = new Map<string, string>(), names = new Map<string, string>(), categories: MacroCategory[] = []
  const standard = new Map(defaultMacroCategories.map(category => [category.id, category]))
  const known: Record<string, string> = { policy: 'policy', monetarypolicy: 'policy', inflation: 'inflation', labor: 'labor', labour: 'labor', growth: 'growth', uncategorized: 'uncategorized', uncategorised: 'uncategorized' }
  for (const category of preferences.categories ?? defaultMacroCategories) {
    const name = category.label.trim(), token = name.toLowerCase().replace(/[^a-z0-9]/g, '')
    const id = standard.has(category.id) ? category.id : known[token] ?? names.get(name.toLowerCase()) ?? category.id
    aliases.set(category.id, id); names.set(name.toLowerCase(), id)
    if (!categories.some(item => item.id === id)) categories.push({ id, label: standard.get(id)?.label ?? (name || 'Category') })
  }
  if (!categories.some(category => category.id === 'uncategorized')) categories.push({ id: 'uncategorized', label: 'Uncategorized' })
  return { categories, aliases }
}
/** Merge former category IDs and their references, including inactive currency layouts. */
export function normalizeMacroCategories(preferences: MacroPreferences): MacroPreferences {
  const { categories, aliases } = categoryDefinitions(preferences), resolve = (id: string) => aliases.get(id) ?? id
  const normalizeLayout = (layout: MacroLayout | undefined): MacroLayout | undefined => {
    if (!layout) return layout
    const { categoryOrder, collapsed, hiddenCategories, categoryTarget, ...rest } = layout
    const cleaned = { ...rest } as MacroLayout & { rowOffsets?: unknown; laneSlots?: unknown }
    delete cleaned.rowOffsets; delete cleaned.laneSlots
    return { ...cleaned, categoryOrder: [...new Set(categoryOrder.map(resolve))], collapsed: [...new Set(collapsed.map(resolve))],
      hiddenCategories: [...new Set((hiddenCategories ?? []).map(resolve))], ...(categoryTarget ? { categoryTarget: resolve(categoryTarget) } : {}) }
  }
  const categoryColors: Record<string, string> = {}
  for (const category of preferences.categories ?? []) {
    const color = preferences.categoryColors?.[category.id]
    if (color) categoryColors[resolve(category.id)] ??= color
  }
  for (const [id, color] of Object.entries(preferences.categoryColors ?? {})) categoryColors[resolve(id)] ??= color
  return { ...preferences, categories, categoryColors,
    categoryByEvent: Object.fromEntries(Object.entries(preferences.categoryByEvent ?? {}).map(([key, id]) => [key, resolve(id)])),
    ...(preferences.layout ? { layout: normalizeLayout(preferences.layout) } : {}),
    ...(preferences.currencyViews ? { currencyViews: Object.fromEntries(Object.entries(preferences.currencyViews).map(([currency, view]) => [currency, { ...view, layout: normalizeLayout(view.layout) }])) } : {}) }
}
export function macroCategories(preferences: MacroPreferences) {
  const { categories, aliases } = categoryDefinitions(preferences)
  const order = [...new Set(macroLayout(preferences).categoryOrder.map(id => aliases.get(id) ?? id))]
  return categories.sort((a, b) => (order.includes(a.id) ? order.indexOf(a.id) : order.length) - (order.includes(b.id) ? order.indexOf(b.id) : order.length))
}
export function macroCategory(preferences: MacroPreferences, key: string) {
  const { aliases, categories } = categoryDefinitions(preferences), original = preferences.categoryByEvent?.[key] ?? macroCatalog[key]?.category
  const id = aliases.get(original) ?? original
  return categories.some(category => category.id === id) ? id : 'uncategorized'
}
export function macroRowVisible(preferences: MacroPreferences, key: string) {
  return !macroLayout(preferences).hiddenCategories?.includes(macroCategory(preferences, key))
    && (key === macroEventRowKey ? preferences.showEventRow !== false : preferences.series[key]?.visible === true)
}
export function macroSelection(preferences: MacroPreferences) {
  const layout = macroLayout(preferences)
  return layout.categoryTarget ? [...selectedMacroMetrics(preferences), macroEventRowKey].filter(key => macroCategory(preferences, key) === layout.categoryTarget)
    : [layout.rowTarget === macroEventRowKey ? macroEventRowKey : macroAxis(preferences)]
}
export function macroLanes(preferences: MacroPreferences) {
  const selected = [...selectedMacroMetrics(preferences), macroEventRowKey], layout = macroLayout(preferences)
  const order = [...new Set([...layout.rowOrder, ...selected])].filter(key => selected.includes(key))
  const spacing = Math.max(16, Math.min(120, layout.laneSpacing ?? 24))
  let y = 0
  const groups = macroCategories(preferences).map(category => {
    const keys = order.filter(key => macroCategory(preferences, key) === category.id), top = y
    const visible = keys.filter(key => macroRowVisible(preferences, key))
    const rows = visible.map((key, index) => ({ key, y: top + (index + 0.5) * spacing }))
    y += visible.length * spacing
    return { ...category, top, bottom: y, collapsed: layout.collapsed.includes(category.id), hidden: layout.hiddenCategories?.includes(category.id) === true, rows, keys }
  })
  return { groups, height: y }
}
export function patchMacroLayout(preferences: MacroPreferences, patch: Partial<MacroLayout>): MacroPreferences {
  return { ...preferences, layout: Object.fromEntries(Object.entries({ ...macroLayout(preferences), ...patch }).filter(([, value]) => value !== undefined)) as MacroLayout }
}
export function moveMacroRow(preferences: MacroPreferences, key: string, category: string, before?: string): MacroPreferences {
  const layout = macroLayout(preferences), order = [...new Set([...layout.rowOrder, ...selectedMacroMetrics(preferences), macroEventRowKey])].filter(item => item !== key)
  const index = before ? order.indexOf(before) : -1
  order.splice(index < 0 ? order.length : index, 0, key)
  const color = preferences.categoryColors?.[category]
  return { ...patchMacroLayout(preferences, { rowOrder: order }), categoryByEvent: { ...preferences.categoryByEvent, [key]: category },
    ...(color && preferences.series[key] ? { series: { ...preferences.series, [key]: { ...preferences.series[key], color } } } : {}) }
}
export function moveMacroCategory(preferences: MacroPreferences, id: string, before?: string) {
  const order = macroCategories(preferences).map(category => category.id).filter(key => key !== id)
  const index = before ? order.indexOf(before) : -1
  order.splice(index < 0 ? order.length : index, 0, id)
  return patchMacroLayout(preferences, { categoryOrder: order })
}
export function toggleMacroCategory(preferences: MacroPreferences, id: string) {
  const hidden = macroLayout(preferences).hiddenCategories ?? []
  return patchMacroLayout(preferences, { hiddenCategories: hidden.includes(id) ? hidden.filter(key => key !== id) : [...hidden, id] })
}
export function deleteMacroCategory(preferences: MacroPreferences, id: string): MacroPreferences {
  if (defaultMacroCategories.some(category => category.id === id)) return preferences
  const categoryByEvent = { ...preferences.categoryByEvent }
  for (const key of [...Object.keys(preferences.series), macroEventRowKey]) if (macroCategory(preferences, key) === id) categoryByEvent[key] = 'uncategorized'
  return { ...preferences, categories: macroCategories(preferences).filter(category => category.id !== id), categoryByEvent }
}
