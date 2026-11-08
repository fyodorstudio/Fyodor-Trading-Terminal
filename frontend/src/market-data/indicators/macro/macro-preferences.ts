export type MacroGroup = 'policy' | 'labour' | 'inflation'
export type MacroMetric = 'rate' | 'payrolls' | 'unemployment' | 'coreCpi' | 'headlineCpi'
export type MacroAxis = MacroMetric
export type MacroStyle = { visible: boolean; color: string; lineWidth: 1 | 2 | 3 | 4; pointsVisible: boolean; forecastVisible: boolean; numbersVisible: boolean }
export type MacroPreferences = { enabled: boolean; axisTarget: MacroAxis; series: Record<MacroMetric, MacroStyle> }
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
export function readMacroPreferences(): MacroPreferences {
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
export function saveMacroPreferences(value: MacroPreferences) {
  try { window.localStorage.setItem(storageKey, JSON.stringify(value)) } catch { /* Keep controls usable without storage. */ }
}
export function macroAxis(preferences: MacroPreferences): MacroAxis {
  const visible = (axis: typeof macroAxes[number]) => axis.metrics.some(key => macroMetricVisible(preferences, key))
  const selected = macroAxes.find(axis => axis.id === preferences.axisTarget)!
  return visible(selected) ? selected.id : macroAxes.find(visible)?.id ?? selected.id
}
export function macroMetricVisible(preferences: MacroPreferences, key: MacroMetric) {
  return preferences.series[key].visible
}
export function macroMetricAxis(key: MacroMetric): MacroAxis {
  return key
}
export function selectMacroAxis(preferences: MacroPreferences, axisTarget: MacroAxis): MacroPreferences {
  const axis = macroAxes.find(axis => axis.id === axisTarget)!
  return selectMacroMetric(preferences, axis.metrics.find(key => preferences.series[key].visible) ?? axis.metrics[0])
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
