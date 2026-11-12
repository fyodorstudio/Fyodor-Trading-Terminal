import { macroCatalog } from './macro-catalog'
import { defaultMacroCategories, macroLayout, rememberMacroLanes } from './macro-layout'
import type { MacroPreferences } from './macro-preferences'

export type MacroPreset = { id: string; name: string; preferences: MacroPreferences }
const storageKey = 'fyodor.indicators.macro.presets.v1'
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const knownKey = (key: string) => Object.hasOwn(macroCatalog, key)
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string')
export function validateMacroSnapshot(value: unknown): MacroPreferences {
  const invalid = () => { throw new Error('Invalid MFDI preset. Import a file exported from MFDI.') }
  if (!object(value) || typeof value.enabled !== 'boolean' || typeof value.axisTarget !== 'string' || !knownKey(value.axisTarget)
    || !strings(value.currencies) || !value.currencies.every(code => ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'].includes(code))
    || !object(value.series) || !object(value.eventsByCurrency)) return invalid()
  for (const [key, style] of Object.entries(value.series)) if (!knownKey(key) || !object(style)
    || typeof style.color !== 'string' || !/^#[\da-f]{6}$/i.test(style.color) || ![1, 2, 3, 4].includes(style.lineWidth as number)
    || !['visible', 'pointsVisible', 'forecastVisible', 'numbersVisible'].every(field => typeof style[field] === 'boolean')) return invalid()
  for (const [currency, keys] of Object.entries(value.eventsByCurrency)) if (!strings(keys)
    || !keys.every(key => knownKey(key) && macroCatalog[key].currency === currency && object((value.series as Record<string, unknown>)[key]))) return invalid()
  if (value.categories !== undefined && (!Array.isArray(value.categories) || !value.categories.every(item => object(item) && typeof item.id === 'string' && typeof item.label === 'string'))) return invalid()
  if (value.categoryByEvent !== undefined && (!object(value.categoryByEvent) || !Object.values(value.categoryByEvent).every(item => typeof item === 'string'))) return invalid()
  if (value.layout !== undefined) {
    const layout = value.layout
    if (!object(layout) || typeof layout.hideLegend !== 'boolean' || typeof layout.laneMode !== 'boolean'
      || !['categoryOrder', 'collapsed', 'rowOrder'].every(field => strings(layout[field]))) return invalid()
    for (const field of ['laneOffset', 'laneSpacing', 'laneScroll']) if (layout[field] !== undefined && !Number.isFinite(layout[field])) return invalid()
    if (layout.laneSpacing !== undefined && ((layout.laneSpacing as number) < 0.1 || (layout.laneSpacing as number) > 120)) return invalid()
    if (layout.axisRestoreId !== undefined && typeof layout.axisRestoreId !== 'string') return invalid()
    if (layout.categoryTarget !== undefined && typeof layout.categoryTarget !== 'string') return invalid()
    if (layout.linked !== undefined && typeof layout.linked !== 'boolean') return invalid()
    for (const field of ['rowOffsets', 'laneSlots']) if (layout[field] !== undefined && (!object(layout[field]) || !Object.entries(layout[field]).every(([key, n]) => knownKey(key) && Number.isFinite(n)))) return invalid()
    if (layout.axisPlacements !== undefined && (!object(layout.axisPlacements) || !Object.entries(layout.axisPlacements).every(([key, p]) => knownKey(key) && object(p)
      && [p.from, p.to, p.height, p.unitsPerPixel, p.topValue].every(Number.isFinite) && (p.from as number) < (p.to as number) && (p.height as number) > 1 && (p.unitsPerPixel as number) > 0))) return invalid()
  }
  return clone(value) as MacroPreferences
}
let cachedText: string | null | undefined, cachedPresets: MacroPreset[] = []
export function readMacroPresets(): MacroPreset[] {
  try {
    const text = window.localStorage.getItem(storageKey)
    if (text !== cachedText) { cachedPresets = parseMacroPresets(text ?? '{"version":1,"presets":[]}'); cachedText = text }
    return cachedPresets
  } catch { return [] }
}
export function writeMacroPresets(presets: MacroPreset[]) {
  window.localStorage.setItem(storageKey, exportMacroPresets(presets))
}
export function exportMacroPresets(presets: MacroPreset[]) { return JSON.stringify({ version: 1, presets }, null, 2) }
export function parseMacroPresets(text: string): MacroPreset[] {
  if (text.length > 2_000_000) throw new Error('MFDI preset file is too large.')
  const data = JSON.parse(text)
  if (!object(data) || data.version !== 1 || !Array.isArray(data.presets) || data.presets.length > 100) throw new Error('Invalid MFDI preset file.')
  const ids = new Set<string>()
  return data.presets.map(item => {
    if (!object(item) || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim()) throw new Error('Invalid MFDI preset name or ID.')
    ids.add(item.id)
    return { id: item.id, name: item.name.trim().slice(0, 80), preferences: validateMacroSnapshot(item.preferences) }
  })
}
export function saveMacroPreset(presets: MacroPreset[], name: string, preferences: MacroPreferences, id: string = crypto.randomUUID()): MacroPreset[] {
  name = name.trim().slice(0, 80)
  if (!name) throw new Error('Enter a preset name first.')
  if (!presets.some(item => item.id === id) && presets.length >= 100) throw new Error('You can save up to 100 MFDI presets.')
  const snapshot = clone({ ...rememberMacroLanes(preferences), categories: preferences.categories ?? defaultMacroCategories, categoryByEvent: preferences.categoryByEvent ?? {} }); delete snapshot.presetId
  const item = { id, name, preferences: snapshot }
  return presets.some(preset => preset.id === id) ? presets.map(preset => preset.id === id ? item : preset) : [...presets, item]
}
export function loadMacroPreset(preset: MacroPreset, enabled: boolean): MacroPreferences {
  return { ...clone(preset.preferences), categories: clone(preset.preferences.categories ?? defaultMacroCategories), categoryByEvent: clone(preset.preferences.categoryByEvent ?? {}), enabled, presetId: preset.id, layout: { ...clone(macroLayout(preset.preferences)), axisRestoreId: crypto.randomUUID() } }
}
export function importMacroPresets(current: MacroPreset[], text: string): MacroPreset[] {
  const imported = parseMacroPresets(text).map(preset => ({ ...preset, id: crypto.randomUUID() }))
  if (current.length + imported.length > 100) throw new Error('Import would exceed 100 MFDI presets.')
  return [...current, ...imported]
}
export function downloadMacroPresets(presets: MacroPreset[]) {
  const url = URL.createObjectURL(new Blob([exportMacroPresets(presets)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = 'mfdi-presets.json'; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
