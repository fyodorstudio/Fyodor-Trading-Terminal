import { macroCatalog } from './macro-catalog'
import { defaultMacroCategories, macroCategories, macroCategory, macroLayout, normalizeMacroCategories } from './macro-layout'
import { macroDefaultStyle, type MacroPreferences } from './macro-preferences'

// Exact MT5 series already present in the terminal's calendar catalog.
export const macroEssentials: Record<string, Record<string, string[]>> = {
  USD: {
    policy: ['840050014'], inflation: ['840030005', '840030007', '840030006', '840030008', '840010001', '840010002', '840010004'],
    labor: ['840030016', '840030015', '840030018', '840140001', '840140002', '840030021', '840030025'],
    growth: ['840010007', '840020010', '840020012', '840040001', '840040003'],
  },
  EUR: {
    policy: ['999010006'], inflation: ['999030011', '999030013', '999030012'],
    labor: ['999030020', '999030001', '999030023'], growth: ['999030016', '999500001', '999500002', '999030003'],
  },
  GBP: {
    policy: ['826020009'], inflation: ['826010011', '826010012', '826010013'],
    labor: ['826010003', '826010001', '826010046'], growth: ['826010039', '826010037', '826010019', '826500001', '826500002'],
  },
  JPY: {
    policy: ['392060022'], inflation: ['392030001', '392030003', '392030006'],
    labor: ['392050001', '392050004', '392030007', '392050002'], growth: ['392010001', '392060008', '392060010', '392020006'],
  },
  CHF: {
    policy: ['756010001'], inflation: ['756020001', '756020002'], labor: ['756040003', '756020008'],
    growth: ['756040001', '756050001', '756060001', '756020007'],
  },
  CAD: {
    policy: ['124040006'], inflation: ['124010003', '124010004', '124010034', '124010033'],
    labor: ['124010011', '124010014'], growth: ['124010021', '124010036', '124010007', '124020001'],
  },
  AUD: {
    policy: ['36030008'], inflation: ['36010014', '36010015', '36030014', '36030015'],
    labor: ['36010003', '36010006', '36010031', '36010032'], growth: ['36010019', '36040002'],
  },
  NZD: {
    policy: ['554020009'], inflation: ['554010005', '554010006', '554020010'],
    labor: ['554010016', '554010014', '554010018'], growth: ['554010024', '554010019', '554060001', '554060002'],
  },
}
export const macroEssentialGaps: Record<string, string> = {
  AUD: 'Monthly headline CPI, monthly trimmed-mean CPI and Household Spending are not in the stored MT5 catalog. This setup uses the available quarterly inflation history; discontinued Retail Sales is excluded.',
  CAD: 'Wage growth is not in the stored MT5 catalog.',
  GBP: 'A dedicated services CPI series is not in the stored MT5 catalog.',
}
export const defaultMacroCategoryColors: Record<string, string> = {
  policy: '#3b82f6', inflation: '#dc2626', labor: '#16a34a', growth: '#ca8a04', uncategorized: '#64748b',
}
export function macroCategoryColor(preferences: MacroPreferences, category: string) {
  return preferences.categoryColors?.[category] ?? defaultMacroCategoryColors[category] ?? '#64748b'
}
export function setMacroCategoryColor(preferences: MacroPreferences, category: string, color: string): MacroPreferences {
  const series = { ...preferences.series }
  for (const key of Object.keys(series)) if (macroCategory(preferences, key) === category) series[key] = { ...series[key], color }
  return { ...preferences, categoryColors: { ...preferences.categoryColors, [category]: color }, series }
}
export function applyMacroEssentials(preferences: MacroPreferences): MacroPreferences {
  preferences = normalizeMacroCategories(preferences)
  const layout = preferences.layout ?? { ...macroLayout(preferences), laneMode: true }
  const eventsByCurrency = { ...preferences.eventsByCurrency }, series = { ...preferences.series }, categoryByEvent = { ...preferences.categoryByEvent }
  const categoryColors = { ...defaultMacroCategoryColors, ...preferences.categoryColors }
  for (const [currency, groups] of Object.entries(macroEssentials)) {
    const added: string[] = []
    for (const [category, ids] of Object.entries(groups)) for (const id of ids) {
      const key = Object.keys(macroCatalog).find(key => macroCatalog[key].currency === currency && macroCatalog[key].eventId === id)
      if (!key) throw new Error(`MFDI essential series missing: ${currency} ${id}`)
      added.push(key)
      categoryByEvent[key] ??= category
      series[key] = { ...(series[key] ?? macroDefaultStyle(key)), numbersVisible: true }
    }
    eventsByCurrency[currency] = [...new Set([...(eventsByCurrency[currency] ?? []), ...added])]
  }
  let next: MacroPreferences = { ...preferences, essentialsVersion: 1, eventsByCurrency, series, categoryByEvent, categoryColors,
    currencies: Object.keys(macroEssentials), activeCurrency: preferences.activeCurrency ?? preferences.currencies?.[0] ?? 'USD',
    numberPlacement: 'inside', categories: preferences.categories ? [...preferences.categories, ...defaultMacroCategories.filter(category => !preferences.categories!.some(item => item.id === category.id))] : [
      { id: 'policy', label: 'Monetary Policy' }, { id: 'inflation', label: 'Inflation' }, { id: 'labor', label: 'Labor' },
      { id: 'growth', label: 'Growth' }, { id: 'uncategorized', label: 'Uncategorized' },
    ], layout,
    currencyViews: { ...Object.fromEntries(Object.keys(macroEssentials).map(currency => [currency, {
      axisTarget: eventsByCurrency[currency].find(key => macroEssentials[currency].policy.includes(macroCatalog[key].eventId))!,
      layout: { hideLegend: true, laneMode: true, categoryOrder: ['policy', 'inflation', 'labor', 'growth', 'uncategorized'], collapsed: [], rowOrder: [], laneSpacing: 24 },
    }])), ...preferences.currencyViews },
  }
  for (const category of macroCategories(next)) next = setMacroCategoryColor(next, category.id, macroCategoryColor(next, category.id))
  return next
}
