import { useState } from 'react'
import { downloadMacroPresets, importMacroPresets, loadMacroPreset, saveMacroPreset, type MacroPreset } from './macro-presets'
import type { MacroPreferences } from './macro-preferences'

export function MacroPresetSettings({ preferences, onChange, presets, onPresets }: { preferences: MacroPreferences; onChange: (next: MacroPreferences) => void;
  presets: MacroPreset[]; onPresets: (next: MacroPreset[]) => void }) {
  const [id, setId] = useState(preferences.presetId ?? ''), [name, setName] = useState(presets.find(item => item.id === preferences.presetId)?.name ?? ''), [message, setMessage] = useState('')
  const selected = presets.find(item => item.id === id)
  const run = (action: () => void) => { try { action(); setMessage('Preset changes will be saved with OK.') } catch (error) { setMessage(String(error instanceof Error ? error.message : error)) } }
  return <fieldset className="macro-preset-settings"><legend>Named presets</legend>
    <label>Preset<select aria-label="MFDI preset" value={selected ? id : ''} onChange={event => { setId(event.target.value); setName(presets.find(item => item.id === event.target.value)?.name ?? '') }}>
      <option value="">Working layout</option>{presets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    <label>Name<input aria-label="MFDI preset name" value={name} maxLength={80} onChange={event => setName(event.target.value)} /></label>
    <div className="macro-preset-actions">
      <button type="button" disabled={!selected} onClick={() => { onChange(loadMacroPreset(selected!, preferences.enabled)); setMessage('Preset loaded into this draft. Click OK to apply.') }}>Load</button>
      <button type="button" onClick={() => run(() => { const next = saveMacroPreset(presets, name, preferences); onPresets(next); setId(next.at(-1)!.id); onChange({ ...preferences, presetId: next.at(-1)!.id }) })}>Save as…</button>
      <button type="button" disabled={!selected} onClick={() => run(() => onPresets(saveMacroPreset(presets, selected!.name, preferences, id)))}>Update preset</button>
      <button type="button" disabled={!selected} onClick={() => run(() => { if (!name.trim()) throw new Error('Enter a preset name first.'); onPresets(presets.map(item => item.id === id ? { ...item, name: name.trim() } : item)) })}>Rename</button>
      <button type="button" disabled={!selected} onClick={() => run(() => { const next = saveMacroPreset(presets, name.trim() && name !== selected!.name ? name : `${selected!.name} copy`, selected!.preferences); onPresets(next); setId(next.at(-1)!.id) })}>Duplicate</button>
      <button type="button" disabled={!selected} onClick={() => run(() => { onPresets(presets.filter(item => item.id !== id)); setId('') })}>Delete</button>
      <button type="button" disabled={!presets.length} onClick={() => run(() => downloadMacroPresets(presets))}>Export</button>
      <label className="macro-preset-import">Import<input aria-label="Import MFDI presets" type="file" accept=".json,application/json" onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
        try { if (file.size > 2_000_000) throw new Error('MFDI preset file is too large.'); onPresets(importMacroPresets(presets, await file.text())); setMessage('Imported copies added. Click OK to save.') }
        catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
      }} /></label>
    </div>
    <p>Save the working layout as a named preset. Only Update preset overwrites it. Import adds copies. Cancel discards draft and library edits.</p>
    <p role="status">{message}</p>
  </fieldset>
}
