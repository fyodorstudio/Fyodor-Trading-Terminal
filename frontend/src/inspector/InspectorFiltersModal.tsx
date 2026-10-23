import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { currencyColorStyle, defaultCurrencyColors } from './currency-colors'
import { eventSymbols, type EventSymbol } from '../economic-calendar/presentation/event-symbols'
import { inspectorCategories, inspectorFamilies } from './catalog/inspector-families'
import { chartEventSymbol as inspectorPair, chartEventCurrencies as inspectorPairCurrencies } from '../economic-calendar/forex/chart-event-scope'
import { type InspectorPreferences, type InspectorPreferenceUpdate } from './preferences/inspector-preferences'
import { FamilyFilterGroups } from './filters/FamilyFilterGroups'
import { inspectorFilterRows } from './filters/inspector-filter-rows'

export function InspectorFiltersModal({ preferences, onApply, onClose, symbol = 'EURUSD' }: {
  preferences: InspectorPreferences; onApply: (next: InspectorPreferences, mode?: InspectorPreferenceUpdate) => void; onClose: () => void
  symbol?: string
}) {
  const currencies = inspectorPairCurrencies(symbol)
  const currencyRole = (column: number) => currencies.length === 1 ? 'Events' : column === 0 ? 'Base' : 'Quote'
  const [draft, setDraft] = useState(() => ({ ...preferences, families: [...preferences.families], currencyColors: { ...preferences.currencyColors }, symbols: { ...preferences.symbols } }))
  const original = useRef(draft)
  const filterPreferences = (value: InspectorPreferences) => ({ ...preferences, families: value.families,
    showSymbols: value.showSymbols, symbolGrouping: value.symbolGrouping, currencyColors: value.currencyColors, symbols: value.symbols })
  function updateDraft(next: InspectorPreferences) {
    setDraft(next)
    onApply(filterPreferences(next), 'preview')
  }
  const [search, setSearch] = useState('')
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const matches = inspectorFilterRows.filter((family) => {
    if (!(currencies as readonly string[]).includes(family.currency)) return false
    const category = inspectorCategories.find((item) => (item.families as readonly string[]).includes(family.id))!
    return terms.every((term) => `${family.label} ${family.search ?? ''} ${category.label} ${family.currency} ${currencyRole(family.currency === currencies[0] ? 0 : 1)} ${family.ids.join(' ')}`.toLocaleLowerCase().includes(term))
  })
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    dialog.current?.show()
    return () => { previousFocus?.focus() }
  }, [])
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [onClose])
  function toggle(ids: string[], checked: boolean) {
    updateDraft({ ...draft, families: checked ? [...new Set([...draft.families, ...ids])] :
      draft.families.filter((id) => !ids.includes(id)) })
  }
  return createPortal(<dialog ref={dialog} className="inspector-modal" style={currencyColorStyle(draft.currencyColors)} aria-labelledby="inspector-filter-title" aria-modal="false"
    onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="inspector-modal-content">
      <header><div><h2 id="inspector-filter-title">Filters · {inspectorPair(symbol) ?? symbol}</h2><p>All MT5 event families</p></div>
        <button type="button" onClick={onClose} aria-label="Close Inspector filters">×</button></header>
      <div className="inspector-filter-tools"><div className="inspector-symbol-controls">
        <select className="inspector-symbol-grouping" aria-label="Group Inspector symbols" value={draft.symbolGrouping}
          onChange={event => updateDraft({ ...draft, symbolGrouping: event.target.value === 'day' ? 'day' : 'release' })}>
          <option value="release">By release</option><option value="day">By day</option>
        </select></div>
        <div className="inspector-filter-search"><input type="search" aria-label="Search Inspector families" placeholder="Search families…"
          value={search} onChange={(event) => setSearch(event.target.value)} />
          {search && <button type="button" aria-label="Clear family search" onClick={() => setSearch('')}>×</button>}</div>
      </div>
      <div className="inspector-filter-columns" style={currencies.length === 1 ? { gridTemplateColumns: 'minmax(0, 1fr)' } : undefined}>
        {currencies.map((currency, column) => <Fragment key={currency}>
          <h3 className={`inspector-currency-${currency}`} style={{ gridColumn: column + 1, gridRow: 1 }}>
            {currency} · {currencyRole(column)}
            <input type="color" aria-label={`${currency} ${currencyRole(column)} color`}
              value={draft.currencyColors[currency] ?? defaultCurrencyColors[currency]}
              onChange={(event) => updateDraft({ ...draft, currencyColors: { ...draft.currencyColors, [currency]: event.target.value } })} />
            <label className="inspector-select-all"><input type="checkbox" aria-label={`Select all ${currency} ${currencyRole(column)}`}
              checked={inspectorFamilies.filter(f => f.currency === currency).every(f => draft.families.includes(f.id))}
              ref={input => { if (input) { const families = inspectorFamilies.filter(f => f.currency === currency)
                input.indeterminate = families.some(f => draft.families.includes(f.id)) && !families.every(f => draft.families.includes(f.id)) } }}
              onChange={event => toggle(inspectorFamilies.filter(f => f.currency === currency).map(f => f.id), event.target.checked)} />Select all</label>
          </h3>
          <FamilyFilterGroups currency={currency} column={column} selected={draft.families} matches={matches} toggle={toggle}
            renderControl={family => <select aria-label={`Symbol for ${family.label}`} value={draft.symbols[family.id]} onChange={event =>
              updateDraft({ ...draft, symbols: { ...draft.symbols, ...Object.fromEntries(family.ids.map(id => [id, event.target.value as EventSymbol])) } })}>
              {eventSymbols.map(([id, glyph, name]) => <option key={id} value={id}>{glyph} {name}</option>)}
            </select>} />
        </Fragment>)}
      </div>
      {!matches.length && <p className="inspector-search-note" role="status">No families match “{search}”.</p>}
      {terms.length > 0 && <p className="inspector-search-note" role="status">Search changes visibility only. Category checkboxes still control the whole category; hidden selections are preserved.</p>}
      <p className="inspector-modal-note">Use the event icons button beside the chart timeframes to show or hide all event icons. Inspector icons follow these families and dates; date-only icons mark the release day.</p>
      <footer><span className="inspector-filter-save-note">Changes preview here. Save shares family selections across charts with this currency.</span>
        <button type="button" onClick={() => { onApply(filterPreferences(original.current), 'preview'); onClose() }}>Cancel</button><button type="button" className="inspector-primary"
        onClick={() => { onApply(filterPreferences(draft), 'save'); onClose() }}>Save</button></footer>
    </div>
  </dialog>, document.body)
}
