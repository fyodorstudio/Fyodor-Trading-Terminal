import { useState } from 'react'
import { macroCatalog } from './macro-catalog'
import { defaultMacroCategories, macroCategories, macroCategory, macroLayout, moveMacroCategory, moveMacroRow, deleteMacroCategory, patchMacroLayout } from './macro-layout'
import { selectedMacroMetrics, type MacroPreferences } from './macro-preferences'

export function MacroCategorySettings({ preferences, onChange }: { preferences: MacroPreferences; onChange: (value: MacroPreferences) => void }) {
  const [name, setName] = useState('')
  const categories = macroCategories(preferences)
  return <>
    <label>Hide Legend<input type="checkbox" aria-label="Hide MFDI Legend" checked={macroLayout(preferences).hideLegend}
      onChange={event => onChange(patchMacroLayout(preferences, { hideLegend: event.target.checked }))} /></label>
    <fieldset><legend>Categories</legend>
      {categories.map((category, index) => <div key={category.id} className="macro-category-setting">
        <input aria-label={`Category name ${category.id}`} value={category.label} onChange={event => onChange({ ...preferences,
          categories: (preferences.categories ?? defaultMacroCategories).map(item => item.id === category.id ? { ...item, label: event.target.value } : item) })} />
        <button type="button" aria-label={`Move ${category.label} up`} disabled={index === 0} onClick={() => onChange(moveMacroCategory(preferences, category.id, categories[index - 1]?.id))}>↑</button>
        <button type="button" aria-label={`Move ${category.label} down`} disabled={index === categories.length - 1} onClick={() => onChange(moveMacroCategory(preferences, category.id, categories[index + 2]?.id))}>↓</button>
        <button type="button" disabled={category.id === 'uncategorized'} aria-label={`Delete category ${category.label}`} onClick={() => onChange(deleteMacroCategory(preferences, category.id))}>−</button>
      </div>)}
      <div className="macro-category-setting"><input aria-label="New category name" placeholder="New category…" value={name} onChange={event => setName(event.target.value)} />
        <button type="button" disabled={!name.trim()} onClick={() => {
          onChange({ ...preferences, categories: [...(preferences.categories ?? defaultMacroCategories), { id: `custom-${crypto.randomUUID()}`, label: name.trim() }] }); setName('')
        }}>+ Category</button></div>
      {selectedMacroMetrics(preferences).map(key => <label key={key}>{macroCatalog[key].controlLabel}
        <select aria-label={`Category for ${macroCatalog[key].controlLabel}`} value={macroCategory(preferences, key)}
          onChange={event => onChange(moveMacroRow(preferences, key, event.target.value))}>
          {categories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
        </select>
      </label>)}
      <p>In lane view, drag a line label into a category to snap it into place. Drag a category header to move all its lines together. Use its arrow to collapse or expand it.</p>
    </fieldset>
  </>
}
