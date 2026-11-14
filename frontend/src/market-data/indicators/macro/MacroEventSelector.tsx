import { useState } from 'react'
import { majorCurrencies } from '../../../economic-calendar/forex/currencies'
import { inspectorCategories } from '../../../inspector/catalog/inspector-families'
import { macroCatalog } from './macro-catalog'
import { macroCategories, macroCategory, moveMacroRow } from './macro-layout'
import { selectedMacroMetrics, setMacroCurrency, setMacroEvents, type MacroPreferences } from './macro-preferences'

export function MacroEventSelector({ preferences, onChange }: { preferences: MacroPreferences; onChange: (next: MacroPreferences) => void }) {
  const [currency, setCurrency] = useState('USD'), [search, setSearch] = useState(''), [open, setOpen] = useState(false)
  const enabled = preferences.currencies ?? ['USD']
  const categories = macroCategories(preferences), selected = selectedMacroMetrics(preferences)
  const savedKeys = (code: string) => preferences.eventsByCurrency?.[code]
    ?? Object.keys(preferences.series).filter(key => macroCatalog[key]?.currency === code)
  const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const matches = Object.entries(macroCatalog).filter(([, event]) => event.currency === currency
    && terms.every(term => `${event.label} ${event.controlLabel} ${event.eventId} ${event.country}`.toLowerCase().includes(term)))
  const toggleEvent = (key: string, checked: boolean) => {
    const keys = savedKeys(currency)
    const next = setMacroEvents(preferences, currency, checked ? [...keys, key] : keys.filter(item => item !== key))
    onChange(checked ? setMacroCurrency(next, currency, true) : next)
  }
  return <>
    <fieldset><legend>Event currencies · saved selections</legend>
      <div className="macro-currency-options">{majorCurrencies.map(code => <label key={code}>
        <input type="checkbox" aria-label={`Show ${code} events`} checked={enabled.includes(code)}
          onChange={event => onChange(setMacroCurrency(preferences, code, event.target.checked))} />
        {code} <span>({savedKeys(code).length})</span>
      </label>)}</div>
    </fieldset>
    <div className="macro-settings-section-heading"><h3>Selected events <span>({selected.length})</span></h3>
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}>+ Add events</button></div>
    {open && <section className="macro-event-picker" aria-label="MFDI event selector">
      <div className="macro-event-tools"><label>Event currency<select aria-label="Event currency" value={currency} onChange={event => setCurrency(event.target.value)}>
        {majorCurrencies.map(code => <option key={code}>{code}</option>)}
      </select></label><input type="search" aria-label="Search MFDI events" placeholder="Search events…" value={search} onChange={event => setSearch(event.target.value)} />
      <button type="button" onClick={() => setOpen(false)}>Done</button></div>
      <div className="macro-event-results">{inspectorCategories.map(category => {
        const rows = matches.filter(([, event]) => event.category === category.id)
        return rows.length ? <fieldset key={category.id}><legend>{category.label}</legend>
          {rows.map(([key, definition]) => <label key={key}><input type="checkbox" aria-label={`Select ${definition.controlLabel}`} checked={savedKeys(currency).includes(key)}
            onChange={event => toggleEvent(key, event.target.checked)} /><span>{definition.controlLabel}<small>{definition.country} · {definition.eventId}</small></span></label>)}
        </fieldset> : null
      })}{!matches.length && <p role="status">No events match this search.</p>}</div>
    </section>}
    {!selected.length ? <p>Tick a currency to restore its saved events, or add events above.</p>
      : <div className="macro-settings-table-scroll"><table className="macro-settings-table macro-events-table">
        <thead><tr><th scope="col">Show</th><th scope="col">Event</th><th scope="col">Category</th><th scope="col"><span className="macro-setting-label">Actions</span></th></tr></thead>
        <tbody>{selected.map(key => <tr className="macro-selected-event" key={key}>
          <td><label><span className="macro-setting-label">Show {macroCatalog[key].label}</span><input type="checkbox" checked={preferences.series[key].visible}
            onChange={event => onChange({ ...preferences, series: { ...preferences.series, [key]: { ...preferences.series[key], visible: event.target.checked } } })} /></label></td>
          <th scope="row">{macroCatalog[key].label}</th>
          <td><select aria-label={`Category for ${macroCatalog[key].controlLabel}`} value={macroCategory(preferences, key)}
            onChange={event => onChange(moveMacroRow(preferences, key, event.target.value))}>
            {categories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</select></td>
          <td><button type="button" aria-label={`Remove ${macroCatalog[key].controlLabel}`} onClick={() => {
          const code = macroCatalog[key].currency
          onChange(setMacroEvents(preferences, code, savedKeys(code).filter(item => item !== key)))
          }}>Remove</button></td>
        </tr>)}</tbody></table></div>}
  </>
}
