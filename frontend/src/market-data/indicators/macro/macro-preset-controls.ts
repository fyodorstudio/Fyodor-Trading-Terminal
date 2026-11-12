import { loadMacroPreset, readMacroPresets, saveMacroPreset, writeMacroPresets } from './macro-presets'
import type { MacroPreferences } from './macro-preferences'

export function createMacroPresetControls(change: (next: MacroPreferences) => void, beforeAction?: () => MacroPreferences | undefined) {
  const element = document.createElement('div'); element.className = 'macro-preset-controls'
  const select = document.createElement('select'); select.setAttribute('aria-label', 'MFDI quick preset')
  const name = document.createElement('input'); name.placeholder = 'Preset name'; name.maxLength = 80; name.setAttribute('aria-label', 'MFDI quick preset name')
  const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Save as…'
  const update = document.createElement('button'); update.type = 'button'; update.textContent = 'Update preset'
  const status = document.createElement('span'); status.setAttribute('role', 'status')
  element.append(select, name, save, update, status)
  let preferences: MacroPreferences | undefined, signature = ''
  const option = (label: string, value: string) => { const item = document.createElement('option'); item.textContent = label; item.value = value; return item }
  const refresh = () => {
    const presets = readMacroPresets(), next = JSON.stringify(presets.map(item => [item.id, item.name]))
    if (signature !== next) {
      signature = next; select.replaceChildren(option('Working layout', ''), ...presets.map(item => option(item.name, item.id)))
    }
    select.value = presets.some(item => item.id === preferences?.presetId) ? preferences!.presetId! : ''
    update.disabled = !select.value
  }
  const prepare = () => { const current = beforeAction?.(); if (current) preferences = current }
  const run = (action: () => void) => { try { prepare(); action() } catch (error) { status.textContent = `Could not save preset: ${error instanceof Error ? error.message : String(error)}` } }
  select.onchange = () => {
    prepare()
    const preset = readMacroPresets().find(item => item.id === select.value)
    if (preset && preferences) { change(loadMacroPreset(preset, preferences.enabled)); status.textContent = 'Preset loaded.' }
  }
  save.onclick = () => run(() => {
    if (!preferences) return
    const next = saveMacroPreset(readMacroPresets(), name.value, preferences), preset = next.at(-1)!
    writeMacroPresets(next); change({ ...preferences, presetId: preset.id }); status.textContent = 'Preset saved.'; refresh()
  })
  update.onclick = () => run(() => {
    const presets = readMacroPresets(), preset = presets.find(item => item.id === select.value)
    if (!preferences || !preset) return
    writeMacroPresets(saveMacroPreset(presets, preset.name, preferences, preset.id)); status.textContent = 'Preset updated.'
  })
  select.onfocus = refresh
  return { element, sync(next: MacroPreferences) { preferences = next; refresh() } }
}
