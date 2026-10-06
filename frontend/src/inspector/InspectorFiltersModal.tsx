import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { currencyColorStyle, defaultCurrencyColors } from './currency-colors'
import { eventSymbols, type EventSymbol } from './event-symbols'
import { inspectorCategories, inspectorFamilies, type InspectorPreferences } from './inspector-data'
import { inspectorFilterRows } from './filters/inspector-filter-rows'

export function InspectorFiltersModal({ preferences, onApply, onClose }: {
  preferences: InspectorPreferences; onApply: (next: InspectorPreferences) => void; onClose: () => void
}) {
  const [draft, setDraft] = useState(() => ({ ...preferences, families: [...preferences.families], currencyColors: { ...preferences.currencyColors }, symbols: { ...preferences.symbols } }))
  const [search, setSearch] = useState('')
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const matches = inspectorFilterRows.filter((family) => {
    const category = inspectorCategories.find((item) => (item.families as readonly string[]).includes(family.id))!
    return terms.every((term) => `${family.label} ${category.label} ${family.currency} ${family.currency === 'EUR' ? 'base' : 'quote'} ${family.ids.join(' ')}`.toLocaleLowerCase().includes(term))
  })
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    return () => { previousFocus?.focus() }
  }, [])
  function toggle(ids: string[], checked: boolean) {
    setDraft((current) => ({ ...current, families: checked ? [...new Set([...current.families, ...ids])] :
      current.families.filter((id) => !ids.includes(id)) }))
  }
  return createPortal(<dialog ref={dialog} className="inspector-modal" style={currencyColorStyle(draft.currencyColors)} aria-labelledby="inspector-filter-title"
    onCancel={(event) => { event.preventDefault(); onClose() }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="inspector-modal-content">
      <header><div><h2 id="inspector-filter-title">Filters · EURUSD</h2><p>Monetary policy · Inflation · Labor / wages · Growth / activity</p></div>
        <button type="button" onClick={onClose} aria-label="Close Inspector filters">×</button></header>
      <div className="inspector-filter-tools"><label className="inspector-symbol-toggle"><input type="checkbox" checked={draft.showSymbols}
        onChange={(event) => setDraft({ ...draft, showSymbols: event.target.checked })} /> Show symbols on chart</label>
        <div className="inspector-filter-search"><input type="search" aria-label="Search Inspector families" placeholder="Search families…"
          value={search} onChange={(event) => setSearch(event.target.value)} />
          {search && <button type="button" aria-label="Clear family search" onClick={() => setSearch('')}>×</button>}</div>
      </div>
      <div className="inspector-filter-columns">
        {(['EUR', 'USD'] as const).map((currency, column) => <Fragment key={currency}>
          <h3 className={`inspector-currency-${currency}`} style={{ gridColumn: column + 1, gridRow: 1 }}>
            {currency} · {currency === 'EUR' ? 'Base' : 'Quote'}
            <input type="color" aria-label={`${currency} ${currency === 'EUR' ? 'Base' : 'Quote'} color`}
              value={draft.currencyColors[currency] ?? defaultCurrencyColors[currency]}
              onChange={(event) => setDraft({ ...draft, currencyColors: { ...draft.currencyColors, [currency]: event.target.value } })} />
          </h3>
          {inspectorCategories.map((category, row) => {
            const families = inspectorFamilies.filter((family) => family.currency === currency && (category.families as readonly string[]).includes(family.id))
            const visible = matches.filter(family => families.some(source => source.id === family.id))
            if (!visible.length) return null
            const ids = families.map((family) => family.id)
            const checked = ids.every((id) => draft.families.includes(id))
            const partial = !checked && ids.some((id) => draft.families.includes(id))
            return <fieldset key={category.id} style={{ gridColumn: column + 1, gridRow: row + 2 }}><legend><label><input type="checkbox" checked={checked}
              ref={(input) => { if (input) input.indeterminate = partial }} aria-label={`${currency} ${category.label}`}
              onChange={(event) => toggle(ids, event.target.checked)} />{category.label}</label></legend>
              {visible.map((family) => <div className="inspector-family" key={family.id}>
                <label><input type="checkbox" checked={family.ids.every(id => draft.families.includes(id))} aria-label={family.label}
                  ref={input => { if (input) input.indeterminate = family.ids.some(id => draft.families.includes(id)) && !family.ids.every(id => draft.families.includes(id)) }}
                  onChange={(event) => toggle(family.ids, event.target.checked)} />{family.label}</label>
                <select aria-label={`Symbol for ${family.label}`} value={draft.symbols[family.id]} onChange={(event) =>
                  setDraft({ ...draft, symbols: { ...draft.symbols, ...Object.fromEntries(family.ids.map(id => [id, event.target.value as EventSymbol])) } })}>
                  {eventSymbols.map(([id, glyph, name]) => <option key={id} value={id}>{glyph} {name}</option>)}
                </select>
              </div>)}
            </fieldset>
          })}
        </Fragment>)}
      </div>
      {!matches.length && <p className="inspector-search-note" role="status">No families match “{search}”.</p>}
      {terms.length > 0 && <p className="inspector-search-note" role="status">Search changes visibility only. Category checkboxes still control the whole category; hidden selections are preserved.</p>}
      <p className="inspector-modal-note">Symbols follow the applied date range and families. Releases with uncertain times stay in the list without a timed chart symbol.</p>
      <footer><button type="button" onClick={onClose}>Cancel</button><button type="button" className="inspector-primary"
        onClick={() => { onApply(draft); onClose() }}>Apply</button></footer>
    </div>
  </dialog>, document.body)
}
