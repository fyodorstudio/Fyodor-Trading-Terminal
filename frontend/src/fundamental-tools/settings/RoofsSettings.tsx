import { saveSequencePreferences, useSequencePreferences } from '../../usd-context/sequences/storage/sequence-preferences'
import { roofDisplayOptions } from '../../scoring-system/relationships/relationship-display'
import { useState } from 'react'

export function RoofsSettings({ supported }: { supported: boolean }) {
  const preferences = useSequencePreferences()
  const [search, setSearch] = useState('')
  const visibleOptions = roofDisplayOptions.filter(option => `${option.label} ${option.group}`.toLowerCase().includes(search.trim().toLowerCase()))
  const enabled = (id: string) => !preferences.hiddenRoofs?.includes(id) && (id !== 'fresh-news' || preferences.fresh)
  const toggle = (id: string, checked: boolean) => {
    const hidden = new Set(preferences.hiddenRoofs ?? [])
    if (checked || id === 'fresh-news') hidden.delete(id); else hidden.add(id)
    saveSequencePreferences({ ...preferences, hiddenRoofs: [...hidden], ...(id === 'fresh-news' ? { fresh: checked } : {}) })
  }
  return <div className="tool-settings-sections">
    <section><h3>Display</h3>
      <label>Display density <select aria-label="Roof display density" value={preferences.density ?? 'focused'}
        onChange={e => saveSequencePreferences({ ...preferences, density: e.target.value as 'focused' | 'all' | 'concise' })}>
        <option value="concise">Concise</option><option value="focused">Focused</option><option value="all">All roofs</option></select></label>
      <p>Concise groups by candle; Focused prioritizes relationships; All roofs shows every enabled label.</p>

      {!supported && <p>Roofs are available on EURUSD.</p>}
    </section>
    <section><h3>Visible combinations</h3>
      <label>Search combinations <input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <p>Display filters only; scores and context inputs stay unchanged.</p>
      <div className="roof-filter-actions"><button type="button" onClick={() => saveSequencePreferences({ ...preferences, hiddenRoofs: [], fresh: true })}>Show all combinations</button>
        <button type="button" onClick={() => saveSequencePreferences({ ...preferences, hiddenRoofs: roofDisplayOptions.filter(option => option.id !== 'fresh-news').map(option => option.id), fresh: false })}>Hide all combinations</button></div>
      {['Macro pairs', 'Fed pairs', 'Specialized relationships'].map(group => {
        const options = visibleOptions.filter(option => option.group === group)
        return options.length ? <details key={group} className="roof-combination-group" open={!!search.trim() || group === 'Specialized relationships'}><summary>{group} · {options.filter(option => enabled(option.id)).length}/{options.length} shown</summary>
          {options.map(option => <label key={option.id}><input type="checkbox" aria-label={`Show ${option.label}`} checked={enabled(option.id)} onChange={event => toggle(option.id, event.target.checked)} /> {option.label}</label>)}</details> : null
      })}
      {!visibleOptions.length && <p>No matching combinations.</p>}
    </section>
  </div>
}
