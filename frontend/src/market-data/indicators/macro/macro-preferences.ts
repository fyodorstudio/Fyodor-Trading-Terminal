import { macroCatalog } from './macro-catalog'
import { chartEventSymbol } from '../../../economic-calendar/forex/chart-event-scope'
export type MacroGroup = 'policy' | 'labour' | 'inflation'
export type MacroMetric = string
export type MacroAxis = MacroMetric
export type MacroStyle = { visible: boolean; color: string; lineWidth: 1 | 2 | 3 | 4; pointsVisible: boolean; forecastVisible: boolean; numbersVisible: boolean }
export type MacroPreferences = { enabled: boolean; axisTarget: MacroAxis; series: Record<MacroMetric, MacroStyle>; currencies?: string[]; eventsByCurrency?: Record<string, string[]> }
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
type SavedMacro = { eventsByCurrency: Record<string, string[]>; styles: Record<string, MacroStyle>;
  symbols: Record<string, { enabled: boolean; currencies: string[]; axisTarget: string }> }
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
  const profile = saved?.symbols[key]
  return { enabled: profile ? profile.enabled === true : key === 'USDX' && legacy.enabled,
    currencies: profile && Array.isArray(profile.currencies) ? [...new Set(profile.currencies.filter(currency => currency in eventsByCurrency))]
      : key === 'USDX' ? ['USD'] : [],
    axisTarget: profile && macroCatalog[profile.axisTarget] ? profile.axisTarget : key === 'USDX' ? legacy.axisTarget : 'rate',
    eventsByCurrency, series }
}
export function saveMacroPreferences(value: MacroPreferences, symbol = 'USDX') {
  try {
    const saved = savedConfig() ?? { eventsByCurrency: { USD: Object.keys(defaultMacroPreferences.series) }, styles: {}, symbols: {} }
    saved.eventsByCurrency = { ...saved.eventsByCurrency, ...value.eventsByCurrency }
    saved.styles = { ...saved.styles, ...value.series }
    saved.symbols[symbolKey(symbol)] = { enabled: value.enabled, currencies: value.currencies ?? ['USD'], axisTarget: value.axisTarget }
    window.localStorage.setItem(configKey, JSON.stringify(saved))
  } catch { /* Keep controls usable without storage. */ }
}
export function selectedMacroMetrics(preferences: MacroPreferences): string[] {
  const keys = preferences.currencies ? preferences.currencies.flatMap(currency => preferences.eventsByCurrency?.[currency] ?? []) : Object.keys(preferences.series)
  const order = ['rate', 'payrolls', 'unemployment', 'headlineCpi', 'coreCpi']
  return [...new Set(keys)].filter(key => macroCatalog[key] && preferences.series[key])
    .sort((a, b) => (order.includes(a) ? order.indexOf(a) : 5) - (order.includes(b) ? order.indexOf(b) : 5))
}
export function setMacroCurrency(preferences: MacroPreferences, currency: string, enabled: boolean): MacroPreferences {
  const currencies = preferences.currencies ?? ['USD']
  return { ...preferences, currencies: enabled ? [...new Set([...currencies, currency])] : currencies.filter(item => item !== currency),
    eventsByCurrency: { ...preferences.eventsByCurrency, [currency]: preferences.eventsByCurrency?.[currency] ?? [] } }
}
export function setMacroEvents(preferences: MacroPreferences, currency: string, keys: string[]): MacroPreferences {
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
    preferences.currencies.includes(currency) && !!preferences.eventsByCurrency?.[currency]?.includes(key))
}
export function macroMetricAxis(key: MacroMetric): MacroAxis {
  return key
}
export function selectMacroAxis(preferences: MacroPreferences, axisTarget: MacroAxis): MacroPreferences {
  return selectMacroMetric(preferences, axisTarget)
}
export function selectMacroMetric(preferences: MacroPreferences, key: MacroMetric): MacroPreferences {
  return { ...preferences, axisTarget: macroMetricAxis(key), series: { ...preferences.series,
    [key]: { ...preferences.series[key], visible: true } } }
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
