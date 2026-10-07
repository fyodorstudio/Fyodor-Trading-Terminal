import { saveRelativePreferences, useRelativePreferences } from '../storage/relative-preferences'

export function ContextViewSelector({ supported, label = 'Raycaster context view' }: { supported: boolean; label?: string }) {
  const preferences = useRelativePreferences()
  return <label>Context view <select aria-label={label} value={supported ? preferences.mode : 'usd'} disabled={!supported}
    onChange={e => saveRelativePreferences({ ...preferences, mode: e.target.value as 'usd' | 'relative' })}>
    <option value="usd">USD side</option><option value="relative">EUR vs USD</option>
  </select></label>
}
