import { useState } from 'react'
import { defaultMacroCategories, macroCategories, macroLayout, moveMacroCategory, deleteMacroCategory, patchMacroLayout } from './macro-layout'
import type { MacroPreferences } from './macro-preferences'

export function MacroCategorySettings({ preferences, onChange }: { preferences: MacroPreferences; onChange: (value: MacroPreferences) => void }) {
  const [name, setName] = useState('')
  const categories = macroCategories(preferences)
  return <>
    <label className="macro-setting-row">Non-numerical events and Wildcards<input type="checkbox" aria-label="Show MFDI event row" checked={preferences.showEventRow !== false}
      onChange={event => onChange({ ...preferences, showEventRow: event.target.checked })} /></label>
    <label className="macro-setting-row">Hide Legend<input type="checkbox" aria-label="Hide MFDI Legend" checked={macroLayout(preferences).hideLegend}
      onChange={event => onChange(patchMacroLayout(preferences, { hideLegend: event.target.checked }))} /></label>
    <fieldset><legend>Categories</legend>
      {categories.map((category, index) => <div key={category.id} className="macro-category-setting">
        <input aria-label={`Category name ${category.id}`} value={category.label} onChange={event => onChange({ ...preferences,
          categories: (preferences.categories ?? defaultMacroCategories).map(item => item.id === category.id ? { ...item, label: event.target.value } : item) })} />
        <button type="button" aria-label={`Move ${category.label} up`} disabled={index === 0} onClick={() => onChange(moveMacroCategory(preferences, category.id, categories[index - 1]?.id))}>↑</button>
        <button type="button" aria-label={`Move ${category.label} down`} disabled={index === categories.length - 1} onClick={() => onChange(moveMacroCategory(preferences, category.id, categories[index + 2]?.id))}>↓</button>
        <button type="button" disabled={category.id === 'uncategorized'} aria-label={`Delete category ${category.label}`} onClick={() => onChange(deleteMacroCategory(preferences, category.id))}>−</button>
      </div>)}
      <div className="macro-category-add"><input aria-label="New category name" placeholder="New category…" value={name} onChange={event => setName(event.target.value)} />
        <button type="button" disabled={!name.trim()} onClick={() => {
          onChange({ ...preferences, categories: [...(preferences.categories ?? defaultMacroCategories), { id: `custom-${crypto.randomUUID()}`, label: name.trim() }] }); setName('')
        }}>+ Category</button></div>
      <p>Use the arrows to reorder categories. Assign events to categories in the Events tab.</p>
    </fieldset>
  </>
}
