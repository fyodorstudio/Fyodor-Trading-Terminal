import { relativePreferencesKey, validRelativePreferences } from '../pair-context/storage/relative-preferences'
import { sequencePreferencesKey, validSequencePreferences } from '../usd-context/sequences/storage/sequence-preferences'
import { magnitudeFamilies } from '../inspector/magnitude/magnitude-families'
import { signalMagnitudeStores } from '../inspector/scoring/shared/core/signal-magnitude-settings'
import { validMagnitudeLimits } from '../inspector/magnitude/magnitude-distribution'
import { inspectorFamilies, inspectorStorageKey } from '../inspector/inspector-data'
import { isEventSymbol } from '../inspector/event-symbols'
import { normalizeScatterAppearance, scatterAppearanceKey } from '../scatter-plot/settings/scatter-plot-appearance'
import { drawingTools } from '../market-data/chart-drawings/drawing-tool'
import { activitySources } from '../system-observability/activity-log/activity-log-entry'
import { contextFamiliesKey, validContextFamilyPreference } from '../usd-context/storage/context-family-settings'
import { isStoredInspectorDetailView, normalizeInspectorDetailView } from '../inspector/inspector-detail-view'

export const workspaceFormat = 'fyodor-workspace'
export const workspaceMaxBytes = 10 * 1024 * 1024
type RecordValue = Record<string, unknown>
const record = (v: unknown): v is RecordValue => !!v && typeof v === 'object' && !Array.isArray(v)
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const text = (v: unknown): v is string => typeof v === 'string'
const color = (v: unknown) => text(v) && /^#[\da-f]{6}$/i.test(v)
const nullableNumber = (v: unknown) => v === null || finite(v)
const direction = (v: unknown) => v === 'long' || v === 'short'
const array = (v: unknown, check: (v: unknown) => boolean) => Array.isArray(v) && v.every(check)
const frame = (v: unknown) => ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'].includes(v as string)
const symbolKey = (key: string, prefix: string) => key.startsWith(prefix) && key.length > prefix.length &&
  key.length <= prefix.length + 128 && [...key.slice(prefix.length)].every((char) => char.charCodeAt(0) >= 32)

const validators: Record<string, (v: unknown) => boolean> = {
  'fyodor.color-theme': (v) => v === 'dark' || v === 'light',
  'fyodor.time-display.v1': (v) => record(v) && ['local', 'utc', 'fixed-offset'].includes(v.mode as string) && finite(v.utcOffsetMinutes) && v.utcOffsetMinutes >= -720 && v.utcOffsetMinutes <= 840,
  'fyodor.chart-appearance.v1': (v) => record(v) && color(v.upCandleColor) && color(v.downCandleColor) && color(v.priceLineColor) && typeof v.showGrid === 'boolean' && finite(v.barSpacing) && v.barSpacing >= 3 && v.barSpacing <= 16 && ['adaptive', 'charcoal', 'blue', 'red'].includes(v.scrollbarStyle as string),
  [inspectorStorageKey]: (v) => record(v) && v.version === 2 && array(v.families, (id) => inspectorFamilies.some((f) => f.id === id)) && typeof v.showSymbols === 'boolean' && (v.showHistograms === undefined || typeof v.showHistograms === 'boolean') && (v.detailView === undefined || isStoredInspectorDetailView(v.detailView)) && (v.currencyColors === undefined || (record(v.currencyColors) && Object.entries(v.currencyColors).every(([id, value]) => ['EUR', 'USD'].includes(id) && color(value)))) && record(v.symbols) && Object.entries(v.symbols).every(([id, symbol]) => inspectorFamilies.some((f) => f.id === id) && isEventSymbol(symbol)),
  [scatterAppearanceKey]: record,
  'fyodor.market-watch.collapsed.v1': (v) => typeof v === 'boolean',
  'fyodor.raycaster.visible.v1': (v) => typeof v === 'boolean',
  [contextFamiliesKey]: validContextFamilyPreference,
  [relativePreferencesKey]: validRelativePreferences,
  [sequencePreferencesKey]: validSequencePreferences,
  'fyodor.raycaster.position.v1': (v) => record(v) && finite(v.x) && finite(v.y) && v.x >= 0 && v.y >= 0,
  'fyodor.drawing-toolbar-position.v1': (v) => record(v) && finite(v.x) && finite(v.y) && v.x >= 0 && v.y >= 0,
  'fyodor.activity-visible-sources.v2': (v) => array(v, (source) => activitySources.includes(source as typeof activitySources[number])),
  'fyodor.chart-drawings.v1': (v) => array(v, (d) => record(d) && text(d.id) && text(d.symbol) && frame(d.timeframe) && drawingTools.some((t) => t.id === d.tool) && finite(d.createdAt) && (d.text === undefined || text(d.text)) && array(d.points, (p) => record(p) && finite(p.time) && finite(p.price))),
  'fyodor.registered_arrows.v1': (v) => array(v, (a) => record(a) && text(a.id) && text(a.symbol) && direction(a.direction) && text(a.note) && ['time', 'entryPrice', 'tpPrice', 'slPrice', 'tpPips', 'slPips', 'rrRatio', 'createdAt'].every((key) => finite(a[key]))),
}
for (const dock of ['inspector', 'notebook', 'activity', 'scatter-plot', 'alert']) validators[`fyodor.${dock}.dock-height.v1`] = (v) => finite(v) && v > 0 && v <= 100000
for (const family of magnitudeFamilies) validators[family.settings.key] = (v) => record(v) && Object.entries(v).every(([id, limits]) => family.seriesIds.includes(id) && validMagnitudeLimits(limits))
for (const store of signalMagnitudeStores) validators[store.key] = (v) => record(v) && Object.entries(v).every(([id, limits]) => store.seriesIds.includes(id) && validMagnitudeLimits(limits))

function validator(key: string) {
  if (Object.hasOwn(validators, key)) return validators[key]
  if (symbolKey(key, 'trader_notebook_note_')) return text
  if (symbolKey(key, 'trader_plan_')) return (v: unknown) => record(v) && direction(v.direction) && nullableNumber(v.entryPrice) && nullableNumber(v.tpPrice) && nullableNumber(v.slPrice) && typeof v.showOnChart === 'boolean'
  return null
}
const rawStringKeys = (key: string) => key === 'fyodor.color-theme' || key.startsWith('trader_notebook_note_')
function validatedEntry(key: string, raw: unknown): string {
  const check = validator(key)
  if (!check || !text(raw)) throw new Error(`Unsupported workspace setting: ${key}`)
  let value: unknown
  try { value = rawStringKeys(key) ? raw : JSON.parse(raw) } catch { throw new Error(`Invalid workspace setting: ${key}`) }
  if (!check(value)) throw new Error(`Invalid workspace setting: ${key}`)
  if (key === inspectorStorageKey && record(value)) return JSON.stringify({ ...value, detailView: normalizeInspectorDetailView(value.detailView) })
  return key === scatterAppearanceKey ? JSON.stringify(normalizeScatterAppearance(value)) : raw
}
function ownedKeys(storage: Storage) {
  return Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((key): key is string => key !== null && validator(key) !== null)
}
export type WorkspaceSnapshot = Readonly<{ format: typeof workspaceFormat; version: 1; exportedAt: string; entries: Readonly<Record<string, string>> }>
export function parseWorkspaceSnapshot(raw: string): WorkspaceSnapshot {
  if (new TextEncoder().encode(raw).length > workspaceMaxBytes) throw new Error('Workspace file exceeds 10 MB')
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new Error('Choose a valid workspace JSON file') }
  if (!record(value) || value.format !== workspaceFormat || value.version !== 1 || !text(value.exportedAt) || !Number.isFinite(Date.parse(value.exportedAt)) || !record(value.entries)) throw new Error('Unsupported workspace format or version')
  const entries = Object.fromEntries(Object.entries(value.entries).map(([key, raw]) => [key, validatedEntry(key, raw)]))
  return Object.freeze({ format: workspaceFormat, version: 1, exportedAt: value.exportedAt, entries: Object.freeze(entries) })
}
export function exportWorkspace(storage: Storage = window.localStorage): WorkspaceSnapshot {
  const entries = Object.fromEntries(ownedKeys(storage).sort().map((key) => {
    let raw = storage.getItem(key)!
    // Removed automatic modes never become invented manual cutoffs on migration.
    const family = magnitudeFamilies.find((f) => f.settings.key === key)
    if (family) raw = JSON.stringify(family.settings.normalize(JSON.parse(raw)))
    const signalStore = signalMagnitudeStores.find((store) => store.key === key)
    if (signalStore) raw = JSON.stringify(signalStore.normalize(JSON.parse(raw)))
    return [key, validatedEntry(key, raw)]
  }))
  return parseWorkspaceSnapshot(JSON.stringify({ format: workspaceFormat, version: 1, exportedAt: new Date().toISOString(), entries }))
}
export function restoreWorkspace(snapshot: WorkspaceSnapshot, storage: Storage = window.localStorage) {
  // Validate again at the mutation boundary, including programmatic callers.
  const incoming = parseWorkspaceSnapshot(JSON.stringify(snapshot))
  const keys = [...new Set([...ownedKeys(storage), ...Object.keys(incoming.entries)])]
  const before = new Map(keys.map((key) => [key, storage.getItem(key)]))
  try {
    for (const key of keys) storage.removeItem(key)
    for (const [key, raw] of Object.entries(incoming.entries)) storage.setItem(key, raw)
  } catch (error) {
    try {
      for (const key of keys) storage.removeItem(key)
      for (const [key, raw] of before) if (raw !== null) storage.setItem(key, raw)
    } catch { throw new Error('Restore failed and rollback was incomplete. Keep your export and retry when browser storage is available.') }
    throw new Error(`Restore failed; previous settings were restored. ${error instanceof Error ? error.message : ''}`)
  }
  // Shared stores also update before the page reloads; other windows receive native events.
  window.dispatchEvent(new window.StorageEvent('storage', { key: null }))
}
