import { useState, type ReactNode } from 'react'
import { eventSymbols, type EventSymbol } from './timeline-event-view'
import { eventCurrencySide, eventFamilyKey, pairCurrencySides, type EventCurrencySide, type EventFamilyOption } from './timeline-event-filters'
import type { TimelineEventAnnotations } from './useTimelineEventAnnotations'

export function TimelineFamilyPicker({ view, close }: { view: TimelineEventAnnotations; close: () => void }) {
  const [draft, setDraft] = useState(view.shortlist)
  const [showAll, setShowAll] = useState(view.watchlist === null)
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
        onChange={(event) => setDraft(event.target.checked ? [...new Set([...draft, option.id])] : draft.filter((id) => id !== option.id))} />
      <span>{option.label}<small>{option.count} releases in window</small></span>
    </label>
  }
  return <>
    <div className="timeline-popover-heading"><strong>Event filters · EURUSD</strong><button type="button" onClick={close} aria-label="Close event filters">×</button></div>
    <div className="timeline-filter-toolbar">
      <div role="group" aria-label="Currencies">{pairCurrencySides.slice(0, 2).map((side) =>
        <label key={side.id} className={`timeline-currency-${side.id}`}><input type="checkbox" aria-label={`Show ${side.label}`}
          checked={sides.includes(side.id)} onChange={(event) => toggleSide(side.id, event.target.checked)} />{side.label}</label>)}</div>
      <label>Show <select aria-label="Show releases" value={showAll ? 'all' : 'selected'}
        onChange={(event) => setShowAll(event.target.value === 'all')}>
        <option value="selected">Selected families</option><option value="all">All releases</option>
      </select></label>
    </div>
    <p className="timeline-symbol-help">Your high-impact shortlist. {showAll ? 'Browsing all releases; your shortlist is kept.' : 'Choose the families you want to follow.'}</p>
    <div className="timeline-family-columns">
      {pairCurrencySides.slice(0, 2).map((side) => {
        const options = view.familyOptions.filter((option) => option.currency === side.currency)
        const main = options.filter((option) => option.curated && (side.id === 'base' ||
          ['jobs', 'fomc', 'ppi', 'retail', 'gdp', 'ism-manufacturing'].includes(option.id)))
        const more = options.filter((option) => !main.includes(option))
        return <section key={side.id} className={`timeline-family-column${sides.includes(side.id) ? '' : ' inactive'}`} aria-label={`${side.currency} families`}>
          <h3 className={`timeline-currency-${side.id}`}>{side.label}</h3>
          <fieldset disabled={!sides.includes(side.id)}><legend className="timeline-sr-only">{side.currency} shortlist</legend>
            {main.map(familyControl)}
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
  return <details className="timeline-more-families" onToggle={(event) => setExpanded(event.currentTarget.open)}><summary>More {currency} families ({options.length})</summary>
    {expanded && <><input type="search" aria-label={`Search ${currency} families`} placeholder="Search families" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div>{matching.map(renderOption)}{!matching.length && <p className="timeline-symbol-help">No families match.</p>}</div></>}
  </details>
}
