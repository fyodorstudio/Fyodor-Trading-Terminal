import { isMacroTextEvent, macroCatalog } from './macro-catalog'
import { macroCategory, macroLayout, normalizeMacroCategories } from './macro-layout'
import { macroCategoryColor } from './macro-essentials'
import { macroDefaultStyle, type MacroPreferences } from './macro-preferences'

export function initializeMacroWorkspace(preferences: MacroPreferences): MacroPreferences {
  let next = normalizeMacroCategories(preferences)
  if (next.workspaceVersion !== 2) {
    const eventsByCurrency = { ...next.eventsByCurrency }, series = { ...next.series }
    // Preserve the formerly automatic announcement feed as an editable selection.
    for (const [key, definition] of Object.entries(macroCatalog)) if (isMacroTextEvent(key)) {
      const keys = eventsByCurrency[definition.currency] ?? []
      if (!keys.includes(key)) eventsByCurrency[definition.currency] = [...keys, key]
      series[key] ??= { ...macroDefaultStyle(key), color: macroCategoryColor(next, 'uncategorized') }
    }
    next = { ...next, eventsByCurrency, series, workspaceVersion: 2 }
  }
  if (next.numberPlacement === 'dots') next = { ...next, numberPlacement: 'inside', series: Object.fromEntries(Object.entries(next.series).map(([key, style]) => [key, { ...style, numbersVisible: false }])) }
  return { ...next, showReadout: next.showReadout ?? !macroLayout(next).hideLegend }
}

export function resetMacroAppearance(preferences: MacroPreferences): MacroPreferences {
  return { ...preferences, numberPlacement: 'inside', showReadout: false,
    series: Object.fromEntries(Object.entries(preferences.series).map(([key, style]) => [key, {
      ...style, color: macroCategoryColor(preferences, macroCategory(preferences, key)), lineWidth: 2,
      pointsVisible: true, numbersVisible: true,
    }])) }
}
