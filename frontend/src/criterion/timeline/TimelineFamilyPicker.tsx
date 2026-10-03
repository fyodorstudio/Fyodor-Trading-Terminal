import { useState, type ReactNode } from 'react'
import { eventSymbols, type EventSymbol } from './timeline-event-view'
import { eventCurrencySide, eventFamilyKey, pairCurrencySides, type EventCurrencySide, type EventFamilyOption } from './timeline-event-filters'
import type { TimelineEventAnnotations } from './useTimelineEventAnnotations'
import { isMostRelevantSelection, mostRelevantFamilies, priorityCategories, type PriorityCategory } from './timeline-priority-categories'

export function TimelineFamilyPicker({ view, close }: { view: TimelineEventAnnotations; close: () => void }) {
  const [draft, setDraft] = useState(view.shortlist)
  const [showAll, setShowAll] = useState(view.watchlist === null)
  // All releases temporarily explores beyond the custom shortlist. Choosing
  // Most relevant is an explicit reset to the approved editorial preset.
  const [customDraft, setCustomDraft] = useState(view.shortlist)
  const [sides, setSides] = useState(view.currencySides)
  const [symbols, setSymbols] = useState<Record<string, EventSymbol>>(() => Object.fromEntries(view.familyOptions.map((option) =>
    [option.id, view.familySymbols[option.id] ?? option.symbol])))
  const inScope = view.windowGroups.filter((group) => sides.includes(eventCurrencySide(group.currency)))
  const count = inScope.filter((group) => showAll || draft.includes(eventFamilyKey(group))).length
  function apply(mark: boolean) {
    view.applyFamilies(showAll ? null : draft, symbols, mark, { currencySides: sides, shortlist: draft })
    close()
  }
  function toggleSide(side: EventCurrencySide, checked: boolean) {
    setSides(checked ? [...new Set([...sides, side])] : sides.filter((item) => item !== side))
  }
  function familyControl(option: EventFamilyOption) {
    return <label key={option.id} className="timeline-family-choice">
      <input type="checkbox" aria-label={option.label} checked={draft.includes(option.id)}
        onChange={(event) => {
          const next = event.target.checked ? [...new Set([...draft, option.id])] : draft.filter((id) => id !== option.id)
          setDraft(next); setCustomDraft(next); setShowAll(false)
        }} />
      <span>{option.label}<small>{option.count} releases in window</small></span>
    </label>
  }
  function categoryControl(category: PriorityCategory, currency: 'EUR' | 'USD', rank: number) {
    const members = view.familyOptions.filter((option) => category.families.some((id) => id === option.id))
    const checked = category.families.every((id) => draft.includes(id))
    const partial = !checked && category.families.some((id) => draft.includes(id))
    const releases = members.reduce((total, option) => total + option.count, 0)
    return <div key={category.id} className="timeline-priority-category" data-priority-category={category.id}>
      <label className="timeline-family-choice">
        <input type="checkbox" aria-label={`${currency} ${category.label}`} checked={checked}
          ref={(input) => { if (input) input.indeterminate = partial }}
          onChange={(event) => {
            const next = event.target.checked ? [...new Set([...draft, ...category.families])] :
              draft.filter((id) => !category.families.some((family) => family === id))
            setDraft(next); setCustomDraft(next); setShowAll(false)
          }} />
        <span><strong>{rank} · {category.label}</strong><small>{releases} releases in window</small></span>
      </label>
      <p>{category.description}</p>
      <details className="timeline-category-customize"><summary>Customize</summary>
        {members.map(familyControl)}
      </details>
    </div>
  }
  return <>
    <div className="timeline-popover-heading"><strong>Event filters · EURUSD</strong><button type="button" onClick={close} aria-label="Close event filters">×</button></div>
    <div className="timeline-filter-toolbar">
      <div role="group" aria-label="Currencies">{pairCurrencySides.slice(0, 2).map((side) =>
        <label key={side.id} className={`timeline-currency-${side.id}`}><input type="checkbox" aria-label={`Show ${side.label}`}
          checked={sides.includes(side.id)} onChange={(event) => toggleSide(side.id, event.target.checked)} />{side.label}</label>)}</div>
      <label>Show <select aria-label="Show releases" value={showAll ? 'all' : isMostRelevantSelection(draft) ? 'relevant' : 'selected'}
        onChange={(event) => {
          const mode = event.target.value
          if (mode === 'relevant') { setDraft([...mostRelevantFamilies]); setShowAll(false) }
          else if (mode === 'selected') { setDraft(customDraft); setShowAll(false) }
          else setShowAll(true)
        }}>
        <option value="relevant">Most relevant</option><option value="selected">Custom selection</option><option value="all">All releases</option>
      </select></label>
    </div>
    <p className="timeline-symbol-help">{showAll ? 'Browsing all releases; your shortlist is kept.' : 'Four priorities for episode review. Supporting releases are under More context.'} Order guides attention; actual impact varies.</p>
    <div className="timeline-family-columns">
      {pairCurrencySides.slice(0, 2).map((side) => {
        const options = view.familyOptions.filter((option) => option.currency === side.currency)
        const currency = side.currency as 'EUR' | 'USD'
        const categories = priorityCategories[currency]
        const main = categories.flatMap((category) => category.families)
        const more = options.filter((option) => !main.some((id) => id === option.id))
        return <section key={side.id} className={`timeline-family-column${sides.includes(side.id) ? '' : ' inactive'}`} aria-label={`${side.currency} families`}>
          <h3 className={`timeline-currency-${side.id}`}>{side.label}</h3>
          <fieldset disabled={!sides.includes(side.id)}><legend className="timeline-sr-only">{side.currency} shortlist</legend>
            {categories.map((category, index) => categoryControl(category, currency, index + 1))}
            <MoreFamilies currency={side.currency} options={more} renderOption={familyControl} />
          </fieldset>
        </section>
      })}
    </div>
    <details className="timeline-symbol-settings"><summary>Symbols · Configure</summary>
      <div className="timeline-symbol-settings-list">{view.familyOptions.filter((option) => draft.includes(option.id)).map((option) =>
        <label key={option.id} className={`timeline-currency-${eventCurrencySide(option.currency)}`}>{option.label}
          <select aria-label={`Family symbol for ${option.label}`} value={symbols[option.id]}
            onChange={(event) => setSymbols({ ...symbols, [option.id]: event.target.value as EventSymbol })}>
            {eventSymbols.map(([id, glyph, name]) => <option key={id} value={id}>{glyph} {name}</option>)}
          </select>
        </label>)}</div>
    </details>
    <details className="timeline-filter-coverage"><summary>Coverage &amp; publication stages</summary>
      <p className="timeline-symbol-help">Flash/first versus final publications are not identified reliably in this snapshot. All recorded updates of selected families are included. Speeches retain their source readings; their content is not ranked. Fiscal and geopolitical coverage is partial, and crises can take priority over the normal order.</p>
    </details>
    {view.windowGroups.some((group) => eventCurrencySide(group.currency) === 'other') && <details className="timeline-other-currencies">
      <summary>Other currencies</summary>
      <label><input type="checkbox" aria-label="Show other currencies" checked={sides.includes('other')}
        onChange={(event) => toggleSide('other', event.target.checked)} /> Include other currencies</label>
      <MoreFamilies currency="other" options={view.familyOptions.filter((option) => eventCurrencySide(option.currency) === 'other')} renderOption={familyControl} />
    </details>}
    <p className="timeline-symbol-help">{count} of {inScope.length} releases in enabled currencies · Blue = base · Purple = quote</p>
    <div className="timeline-family-actions"><button type="button" onClick={() => apply(false)}>Apply</button>
      <button type="button" className="primary" disabled={!view.auditBars || !count} onClick={() => apply(true)}>Apply &amp; mark releases</button></div>
    <p className="timeline-symbol-help">Apply filters the list and chart. Mark also adds symbols. Hidden selections stay saved{view.hiddenMarkerCount > 0 && ` (${view.hiddenMarkerCount} currently hidden)`}; red/green stays reserved for direction.</p>
  </>
}

function MoreFamilies({ currency, options, renderOption }: {
  currency: string
  options: EventFamilyOption[]
  renderOption: (option: EventFamilyOption) => ReactNode
}) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const matching = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.label.localeCompare(b.label))
  return <details className="timeline-more-families" onToggle={(event) => setExpanded(event.currentTarget.open)}><summary>More context ({options.length} families)</summary>
    {expanded && <><input type="search" aria-label={`Search ${currency} families`} placeholder="Search families" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div>{matching.map(renderOption)}{!matching.length && <p className="timeline-symbol-help">No families match.</p>}</div></>}
  </details>
}
