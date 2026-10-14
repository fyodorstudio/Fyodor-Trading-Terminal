import { useEffect, useMemo, useRef, useState } from 'react'
import { timeDisplayLabel, type TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { majorCurrencies } from '../economic-calendar/forex/currencies'
import { useExternalSources } from './useExternalSources'
import { ExternalRecordCard } from './ExternalRecordCard'
import { externalIconEnabled, setExternalIconVisibility, useExternalIconVisibility } from './external-icon-visibility'
import './external-sources.css'

function savedCurrency() {
  try {
    const value = JSON.parse(localStorage.getItem('fyodor.external-sources.filters.v1') ?? '{}')
    return majorCurrencies.some(currency => currency === value.currency) ? value.currency as string : 'all'
  } catch { return 'all' }
}
export function ExternalSourcesDock({ timeDisplay, focusKey = null }: { timeDisplay: TimeDisplayPreference; symbol?: string; focusKey?: string | null }) {
  const [currency, setCurrency] = useState(savedCurrency), [search, setSearch] = useState(''), [iconError, setIconError] = useState('')
  const [savedFocus, setSavedFocus] = useState<string | null>(null)
  if (savedFocus !== focusKey) {
    setSavedFocus(focusKey)
    if (focusKey) { setCurrency('all'); setSearch('') }
  }
  const records = useExternalSources(currency, 'all')
  const visibility = useExternalIconVisibility()
  const terms = useMemo(() => search.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean), [search])
  const items = useMemo(() => !terms.length ? records.items : records.items.filter(item => {
    const text = [item.title, item.key, ...item.currencies, item.kind, item.status, item.facts, item.interpretation,
      ...item.sources.flatMap(source => [source.label, source.locator])].join(' ').toLocaleLowerCase()
    return terms.every(term => text.includes(term))
  }), [records.items, terms])
  const panel = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (focusKey) panel.current?.querySelector(`[data-external-key="${focusKey}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }, [focusKey, items])
  const changeCurrency = (next: string) => { setCurrency(next); try { localStorage.setItem('fyodor.external-sources.filters.v1', JSON.stringify({ currency: next })) } catch { /* Retain session filter. */ } }
  return <section ref={panel} className="external-sources-dock" aria-label="External Sources">
    <header>
      <div className="external-toolbar"><strong>External Sources <span className="external-count">{items.length}</span></strong>
        <input type="search" aria-label="Search External Sources" placeholder="Search events, risks or sources" value={search} onChange={event => setSearch(event.target.value)} />
        <span className="external-timezone">{timeDisplayLabel(timeDisplay)}</span><button type="button" onClick={records.refresh}>Refresh</button>
      </div>
      <nav aria-label="External Sources currency">{['all', ...majorCurrencies].map(value => <button type="button" key={value}
        aria-pressed={currency === value} onClick={() => changeCurrency(value)}>{value === 'all' ? 'All' : value}</button>)}</nav>
      <p className="external-meta">Outside-feed events and risks · Stars appear on pairs containing an affected currency.</p>
    </header>
    {records.error && <p role="status">{records.error} {records.items.length ? 'Showing the last loaded records.' : ''}</p>}
    {iconError && <p role="status">{iconError}</p>}
    {records.loading && <p role="status">Loading External Sources…</p>}
    {!records.loading && !records.error && !items.length && <p role="status">{search ? 'No records match this search.' : 'No external records for this currency.'}</p>}
    <div className="external-records">
      {!!items.length && <div className="external-column-headings" aria-hidden="true"><span>Event / risk</span><span>Currency</span><span>Type / status</span><span>Date / time</span><span>Chart visibility</span></div>}
      {items.map(item => <ExternalRecordCard key={item.key} item={item} timeDisplay={timeDisplay} focused={focusKey === item.key}
        iconVisible={externalIconEnabled(item, visibility)} onIconChange={visible => {
          setIconError(setExternalIconVisibility(item.key, visible) ? '' : 'Could not save chart visibility. Check browser storage and try again.')
        }} />)}
    </div>
  </section>
}
