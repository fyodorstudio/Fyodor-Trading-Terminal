import { isMacroTextEvent, macroCatalog } from './macro-catalog'
import { chartEventSymbol } from '../../../economic-calendar/forex/chart-event-scope'
import { rememberMacroLanes, type MacroCategory, type MacroLayout } from './macro-layout'
export type MacroGroup = 'policy' | 'labour' | 'inflation'
export type MacroMetric = string
export type MacroAxis = MacroMetric
export type MacroStyle = { visible: boolean; color: string; lineWidth: 1 | 2 | 3 | 4; pointsVisible: boolean; forecastVisible: boolean; numbersVisible: boolean }
export type MacroPreferences = { enabled: boolean; axisTarget: MacroAxis; series: Record<MacroMetric, MacroStyle>; currencies?: string[]; eventsByCurrency?: Record<string, string[]>;
  categories?: MacroCategory[]; categoryByEvent?: Record<string, string>; layout?: MacroLayout; presetId?: string;
  activeCurrency?: string; currencyViews?: Record<string, { axisTarget: string; layout?: MacroLayout }>; showEventRow?: boolean }
export const macroGroups: { id: MacroGroup; label: string; metrics: MacroMetric[] }[] = [
  { id: 'policy', label: 'Policy', metrics: ['rate'] },
  { id: 'labour', label: 'Labour', metrics: ['payrolls', 'unemployment'] },
  { id: 'inflation', label: 'Inflation', metrics: ['coreCpi', 'headlineCpi'] },
]
export const macroAxes: { id: MacroAxis; label: string; metrics: MacroMetric[] }[] = [
  { id: 'rate', label: 'Fed Rate (%)', metrics: ['rate'] },
  { id: 'payrolls', label: 'Payrolls (k)', metrics: ['payrolls'] },
  { id: 'unemployment', label: 'Unemployment (%)', metrics: ['unemployment'] },
  { id: 'headlineCpi', label: 'Headline CPI (% MoM)', metrics: ['headlineCpi'] },
  { id: 'coreCpi', label: 'Core CPI (% MoM)', metrics: ['coreCpi'] },
]
const style = (color: string, forecastVisible = false): MacroStyle => ({ visible: true, color, lineWidth: 2, pointsVisible: true, forecastVisible, numbersVisible: false })
export const defaultMacroPreferences: MacroPreferences = { enabled: false, axisTarget: 'rate', series: {
  rate: style('#3b82f6'), payrolls: style('#0d9488', true), unemployment: style('#d97706'), coreCpi: style('#8b5cf6'), headlineCpi: style('#e05270'),
} }
const storageKey = 'fyodor.indicators.macro.v1'
function readLegacyPreferences(): MacroPreferences {
  const d = defaultMacroPreferences
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw === null) return { ...d, enabled: window.localStorage.getItem('fyodor.indicators.fed-rate.v1') === 'true' }
    const p = JSON.parse(raw)
    if (!p || typeof p !== 'object' || Array.isArray(p)) return d
    const series = { ...d.series }
    for (const key of Object.keys(series) as MacroMetric[]) {
      const value = p.series?.[key], fallback = d.series[key]
      series[key] = {
        visible: typeof value?.visible === 'boolean' ? value.visible : fallback.visible,
        color: typeof value?.color === 'string' && /^#[\da-f]{6}$/i.test(value.color) ? value.color : fallback.color,
        lineWidth: [1, 2, 3, 4].includes(value?.lineWidth) ? value.lineWidth : fallback.lineWidth,
        pointsVisible: typeof value?.pointsVisible === 'boolean' ? value.pointsVisible : fallback.pointsVisible,
        forecastVisible: typeof value?.forecastVisible === 'boolean' ? value.forecastVisible : fallback.forecastVisible,
        numbersVisible: typeof value?.numbersVisible === 'boolean' ? value.numbersVisible : fallback.numbersVisible,
      }
    }
    // Fold legacy category hides into individual eyes. Revealing one series
    // must never reveal a sibling that used to share its category switch.
    for (const group of macroGroups) if (p.groups?.[group.id] === false)
      for (const key of group.metrics) series[key] = { ...series[key], visible: false }
    // Preserve the former exclusive view's active axis, visibility and styles.
    const legacyAxis = p.axisTarget === 'inflation' || p.view === 'inflation'
      ? series.coreCpi.visible ? 'coreCpi' : 'headlineCpi'
      : p.view === 'labour' ? p.labourAxis === 'unemployment' ? 'unemployment' : 'payrolls' : d.axisTarget
    return { enabled: p.enabled === true,
      axisTarget: macroAxes.some(axis => axis.id === p.axisTarget) ? p.axisTarget : legacyAxis, series }
  } catch { return d }
}
const configKey = 'fyodor.indicators.macro.v2'
type MacroProfile = Pick<MacroPreferences, 'enabled' | 'axisTarget' | 'layout' | 'presetId' | 'activeCurrency' | 'currencyViews' | 'showEventRow'> & { currencies: string[] }
type SavedMacro = { eventsByCurrency: Record<string, string[]>; styles: Record<string, MacroStyle>;
  categories?: MacroCategory[]; categoryByEvent?: Record<string, string>;
  global?: MacroProfile; symbols: Record<string, MacroProfile> }
const symbolKey = (symbol: string) => chartEventSymbol(symbol) ?? symbol.trim().toUpperCase()
const colors = ['#3b82f6', '#0d9488', '#d97706', '#8b5cf6', '#e05270', '#0891b2', '#65a30d', '#db2777']
export function macroDefaultStyle(key: string): MacroStyle {
  if (defaultMacroPreferences.series[key]) return { ...defaultMacroPreferences.series[key] }
  const hash = [...key].reduce((value, char) => value + char.charCodeAt(0), 0)
  return style(colors[hash % colors.length])
}
function savedConfig(): SavedMacro | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(configKey) ?? 'null')
    return value && typeof value === 'object' && value.symbols && value.eventsByCurrency && value.styles ? value : null
  } catch { return null }
}
export function readMacroPreferences(symbol = 'USDX'): MacroPreferences {
  const saved = savedConfig(), legacy = readLegacyPreferences(), key = symbolKey(symbol)
  const eventsByCurrency: Record<string, string[]> = { USD: Object.keys(defaultMacroPreferences.series) }
  if (saved) for (const [currency, keys] of Object.entries(saved.eventsByCurrency))
    eventsByCurrency[currency] = Array.isArray(keys) ? [...new Set(keys.filter(key => macroCatalog[key]?.currency === currency))] : []
  const series = { ...legacy.series }
  for (const keys of Object.values(eventsByCurrency)) for (const key of keys) {
    const fallback = macroDefaultStyle(key), raw = saved?.styles[key]
    series[key] = { visible: typeof raw?.visible === 'boolean' ? raw.visible : series[key]?.visible ?? fallback.visible,
      color: typeof raw?.color === 'string' && /^#[\da-f]{6}$/i.test(raw.color) ? raw.color : series[key]?.color ?? fallback.color,
      lineWidth: [1, 2, 3, 4].includes(raw?.lineWidth ?? 0) ? raw!.lineWidth : series[key]?.lineWidth ?? fallback.lineWidth,
      pointsVisible: typeof raw?.pointsVisible === 'boolean' ? raw.pointsVisible : series[key]?.pointsVisible ?? fallback.pointsVisible,
      forecastVisible: typeof raw?.forecastVisible === 'boolean' ? raw.forecastVisible : series[key]?.forecastVisible ?? fallback.forecastVisible,
      numbersVisible: typeof raw?.numbersVisible === 'boolean' ? raw.numbersVisible : series[key]?.numbersVisible ?? fallback.numbersVisible }
  }
  const shared = saved?.global
  const profile = shared && typeof shared === 'object' && !Array.isArray(shared) ? shared
    : saved?.symbols[key] ?? saved?.symbols.USDX ?? Object.values(saved?.symbols ?? {}).find(item => item?.enabled) ?? Object.values(saved?.symbols ?? {})[0]
  let hasLegacy = legacy.enabled
  try { hasLegacy ||= window.localStorage.getItem(storageKey) !== null || window.localStorage.getItem('fyodor.indicators.fed-rate.v1') !== null } catch { /* Storage may be unavailable. */ }
  return { enabled: profile ? profile.enabled === true : legacy.enabled,
    currencies: profile && Array.isArray(profile.currencies) ? [...new Set(profile.currencies.filter(currency => currency in eventsByCurrency))]
      : hasLegacy ? ['USD'] : [],
    axisTarget: profile && macroCatalog[profile.axisTarget] ? profile.axisTarget : legacy.axisTarget,
    eventsByCurrency, series, ...(typeof profile?.presetId === 'string' ? { presetId: profile.presetId } : {}),
    ...(profile?.activeCurrency ? { activeCurrency: profile.activeCurrency } : {}),
    ...(profile?.currencyViews ? { currencyViews: profile.currencyViews } : {}),
    ...(typeof profile?.showEventRow === 'boolean' ? { showEventRow: profile.showEventRow } : {}),
    ...(Array.isArray(saved?.categories) ? { categories: saved.categories.filter(item => item && typeof item.id === 'string' && typeof item.label === 'string') } : {}),
    ...(saved?.categoryByEvent && typeof saved.categoryByEvent === 'object' ? { categoryByEvent: saved.categoryByEvent } : {}),
    ...(profile?.layout ? { layout: { hideLegend: profile.layout.hideLegend !== false, laneMode: profile.layout.laneMode === true,
      ...(typeof profile.layout.axisRestoreId === 'string' ? { axisRestoreId: profile.layout.axisRestoreId } : {}),
      ...(typeof profile.layout.linked === 'boolean' ? { linked: profile.layout.linked } : {}),
      ...(Number.isFinite(profile.layout.laneScroll) ? { laneScroll: Math.max(0, profile.layout.laneScroll!) } : {}),
      ...(profile.layout.laneSlots ? { laneSlots: Object.fromEntries(Object.entries(profile.layout.laneSlots).filter(([key, value]) => macroCatalog[key] && Number.isFinite(value))) } : {}),
      ...(profile.layout.axisPlacements ? { axisPlacements: Object.fromEntries(Object.entries(profile.layout.axisPlacements).filter(([key, value]) => macroCatalog[key] && value
        && [value.from, value.to, value.height, value.unitsPerPixel, value.topValue].every(Number.isFinite) && value.from < value.to && value.height > 1 && value.unitsPerPixel > 0)) } : {}),
      ...(typeof profile.layout.categoryTarget === 'string' ? { categoryTarget: profile.layout.categoryTarget } : {}),
      categoryOrder: Array.isArray(profile.layout.categoryOrder) ? profile.layout.categoryOrder : [],
      collapsed: Array.isArray(profile.layout.collapsed) ? profile.layout.collapsed : [], rowOrder: Array.isArray(profile.layout.rowOrder) ? profile.layout.rowOrder : [],
      ...(Number.isFinite(profile.layout.laneOffset) ? { laneOffset: Math.max(-100000, Math.min(100000, profile.layout.laneOffset!)) } : {}),
      ...(Number.isFinite(profile.layout.laneSpacing) ? { laneSpacing: Math.max(0.1, Math.min(120, profile.layout.laneSpacing!)) } : {}),
      ...(profile.layout.rowOffsets && typeof profile.layout.rowOffsets === 'object' && !Array.isArray(profile.layout.rowOffsets)
        ? { rowOffsets: Object.fromEntries(Object.entries(profile.layout.rowOffsets).filter(([key, value]) => macroCatalog[key] && Number.isFinite(value))
          .map(([key, value]) => [key, Math.max(-100000, Math.min(100000, value))])) } : {}) } } : {}) }
}
export function saveMacroPreferences(value: MacroPreferences, _symbol = 'USDX') {
  try {
    const saved = savedConfig() ?? { eventsByCurrency: { USD: Object.keys(defaultMacroPreferences.series) }, styles: {}, symbols: {} }
    saved.eventsByCurrency = { ...saved.eventsByCurrency, ...value.eventsByCurrency }
    saved.styles = { ...saved.styles, ...value.series }
    if (value.categories) saved.categories = value.categories
    if (value.categoryByEvent) saved.categoryByEvent = value.categoryByEvent
    saved.global = { enabled: value.enabled, currencies: value.currencies ?? ['USD'], axisTarget: value.axisTarget, ...(value.layout ? { layout: value.layout } : {}), ...(value.presetId ? { presetId: value.presetId } : {}),
      ...(value.activeCurrency ? { activeCurrency: value.activeCurrency } : {}), ...(value.currencyViews ? { currencyViews: value.currencyViews } : {}), ...(value.showEventRow !== undefined ? { showEventRow: value.showEventRow } : {}) }
    window.localStorage.setItem(configKey, JSON.stringify(saved))
    return true
  } catch { return false }
}
export function selectedMacroEvents(preferences: MacroPreferences, allCurrencies = false): string[] {
  const currencies = !allCurrencies && preferences.activeCurrency ? (preferences.currencies?.includes(preferences.activeCurrency) ? [preferences.activeCurrency] : []) : preferences.currencies
  const keys = currencies ? currencies.flatMap(currency => preferences.eventsByCurrency?.[currency] ?? []) : Object.keys(preferences.series)
  const order = ['rate', 'payrolls', 'unemployment', 'headlineCpi', 'coreCpi']
  return [...new Set(keys)].filter(key => macroCatalog[key] && preferences.series[key])
    .sort((a, b) => (order.includes(a) ? order.indexOf(a) : 5) - (order.includes(b) ? order.indexOf(b) : 5))
}
export function selectedMacroMetrics(preferences: MacroPreferences): string[] { return selectedMacroEvents(preferences).filter(key => !isMacroTextEvent(key)) }
export function switchMacroCurrency(preferences: MacroPreferences, currency: string): MacroPreferences {
  const current = preferences.activeCurrency ?? preferences.currencies?.[0] ?? 'USD'
  if (current === currency && preferences.activeCurrency && preferences.currencies?.includes(currency)) return preferences
  const remembered = rememberMacroLanes(preferences)
  const currencyViews = { ...preferences.currencyViews, [current]: { axisTarget: preferences.axisTarget, layout: remembered.layout } }
  const saved = currencyViews[currency]
  const key = preferences.eventsByCurrency?.[currency]?.find(key => !isMacroTextEvent(key)) ?? 'rate'
  return { ...preferences, activeCurrency: currency, currencies: [...new Set([...(preferences.currencies ?? []), currency])], currencyViews,
    eventsByCurrency: { ...preferences.eventsByCurrency, [currency]: preferences.eventsByCurrency?.[currency] ?? [] },
    axisTarget: saved?.axisTarget ?? key,
    layout: { ...(saved?.layout ?? { hideLegend: preferences.layout?.hideLegend ?? true, laneMode: preferences.layout?.laneMode ?? false, categoryOrder: [], collapsed: [], rowOrder: [] }), axisRestoreId: crypto.randomUUID() } }
}
export function setMacroCurrency(preferences: MacroPreferences, currency: string, enabled: boolean): MacroPreferences {
  preferences = rememberMacroLanes(preferences)
  const currencies = preferences.currencies ?? ['USD']
  return { ...preferences, currencies: enabled ? [...new Set([...currencies, currency])] : currencies.filter(item => item !== currency),
    eventsByCurrency: { ...preferences.eventsByCurrency, [currency]: preferences.eventsByCurrency?.[currency] ?? [] } }
}
export function setMacroEvents(preferences: MacroPreferences, currency: string, keys: string[]): MacroPreferences {
  preferences = rememberMacroLanes(preferences)
  const series = { ...preferences.series }
  const admitted = [...new Set(keys)].filter(key => macroCatalog[key]?.currency === currency)
  for (const key of admitted) series[key] ??= macroDefaultStyle(key)
  return { ...preferences, series, eventsByCurrency: { ...preferences.eventsByCurrency, [currency]: admitted } }
}
export function macroAxis(preferences: MacroPreferences): MacroAxis {
  const keys = selectedMacroMetrics(preferences)
  return keys.includes(preferences.axisTarget) && macroMetricVisible(preferences, preferences.axisTarget) ? preferences.axisTarget
    : keys.find(key => macroMetricVisible(preferences, key)) ?? preferences.axisTarget
}
export function macroMetricVisible(preferences: MacroPreferences, key: MacroMetric) {
  const currency = macroCatalog[key]?.currency
  return !!preferences.series[key]?.visible && (!preferences.currencies ||
    preferences.currencies.includes(currency) && !!preferences.eventsByCurrency?.[currency]?.includes(key)) && (!preferences.activeCurrency || currency === preferences.activeCurrency)
}
export function macroMetricAxis(key: MacroMetric): MacroAxis {
  return key
}
export function selectMacroAxis(preferences: MacroPreferences, axisTarget: MacroAxis): MacroPreferences {
  return selectMacroMetric(preferences, axisTarget)
}
export function selectMacroMetric(preferences: MacroPreferences, key: MacroMetric): MacroPreferences {
  const layout = preferences.layout && { ...preferences.layout }
  if (layout) { delete layout.categoryTarget; layout.linked = false }
  return { ...preferences, axisTarget: macroMetricAxis(key), series: { ...preferences.series,
    [key]: { ...preferences.series[key], visible: true } },
    ...(layout ? { layout } : {}) }
}
export function toggleMacroMetric(preferences: MacroPreferences, key: MacroMetric): MacroPreferences {
  return { ...preferences, series: { ...preferences.series, [key]: { ...preferences.series[key], visible: !preferences.series[key].visible } } }
}
export function toggleMacroForecast(preferences: MacroPreferences, key: MacroMetric): MacroPreferences {
  return { ...preferences, series: { ...preferences.series, [key]: { ...preferences.series[key], forecastVisible: !preferences.series[key].forecastVisible } } }
}
export function toggleMacroNumbers(preferences: MacroPreferences, key: MacroMetric): MacroPreferences {
  return { ...preferences, series: { ...preferences.series, [key]: { ...preferences.series[key], numbersVisible: !preferences.series[key].numbersVisible } } }
}
export function toggleMacroAll(preferences: MacroPreferences, field: 'visible' | 'forecastVisible' | 'numbersVisible'): MacroPreferences {
  const keys = selectedMacroMetrics(preferences), enabled = !keys.some(key => preferences.series[key][field])
  const series = { ...preferences.series }
  for (const key of keys) series[key] = { ...series[key], [field]: enabled }
  return { ...preferences, series }
}
