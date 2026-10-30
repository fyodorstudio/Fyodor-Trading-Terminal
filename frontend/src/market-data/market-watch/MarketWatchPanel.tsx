import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import type { SymbolQuote } from '../contracts/SymbolQuote'
import type { FeedStatus } from '../mt5-feed/use-mt5-market-data'
import { marketCategories, readMarketWatchPreferences, saveMarketWatchPreferences, toggleMarketFavourite, updateFavouriteSections, type FavouriteSection, type FavouriteSectionAction, type MarketCategory, type MarketSort } from './market-watch-preferences'
import { FavouriteSections } from './FavouriteSections'
import { categoryLabels, getSymbolCategory } from './symbol-classification'
import { sortMarketQuotes } from './market-watch-sort'
import './market-watch-panel.css'

type MarketWatchPanelProps = {
  symbols: SymbolQuote[]
  selectedSymbol: string
  status: FeedStatus
  error: string | null
  onSelect: (symbol: string) => void
  visible?: boolean
  brokerId?: string | null
}

export const MarketWatchPanel = memo(function MarketWatchPanel({ visible = true, ...props }: MarketWatchPanelProps) {
  const [query, setQuery] = useState('')
  const [preferences, setPreferences] = useState(readMarketWatchPreferences)
  useEffect(() => saveMarketWatchPreferences(preferences), [preferences])
  const favourites = useMemo(() => new Set(preferences.favourites), [preferences.favourites])
  const toggleFavourite = useCallback((symbol: string) => {
    setPreferences(current => toggleMarketFavourite(current, symbol))
  }, [])
  const organizeFavourites = useCallback((action: FavouriteSectionAction) => {
    setPreferences(current => updateFavouriteSections(current, action))
  }, [])
  const setSelectedCategory = useCallback((category: MarketCategory) => {
    setPreferences(current => current.category === category ? current : { ...current, category })
  }, [])
  const setSort = useCallback((sort: MarketSort) => {
    setPreferences(current => current.sort === sort ? current : { ...current, sort })
  }, [])
  // Keep the controls' state mounted, but do no row/filter work while collapsed.
  return visible ? <MarketWatchContents {...props} query={query} onQueryChange={setQuery}
    selectedCategory={preferences.category} onCategoryChange={setSelectedCategory}
    favourites={favourites} onToggleFavourite={toggleFavourite} sections={preferences.sections} onOrganizeFavourites={organizeFavourites}
    sort={preferences.sort} onSortChange={setSort} /> : null
})

function MarketWatchContents({ symbols, selectedSymbol, status, error, onSelect, brokerId, query, onQueryChange,
  selectedCategory, onCategoryChange, favourites, onToggleFavourite, sections, onOrganizeFavourites, sort, onSortChange }: MarketWatchPanelProps & {
  query: string; onQueryChange: (query: string) => void
  selectedCategory: MarketCategory; onCategoryChange: (category: MarketCategory) => void
  favourites: ReadonlySet<string>; onToggleFavourite: (symbol: string) => void
  sections: FavouriteSection[]; onOrganizeFavourites: (action: FavouriteSectionAction) => void
  sort: MarketSort; onSortChange: (sort: MarketSort) => void
}) {
  const [sortOpen, setSortOpen] = useState(false)
  const [sortPass, setSortPass] = useState(0)
  const rankKey = `${brokerId}:${selectedCategory}:${query}:${sort}:${sortPass}`
  const [ranking, setRanking] = useState<{ key: string; values: Map<string, number | null> }>(() => ({ key: '', values: new Map() }))
  let rankValues = ranking.values
  if (ranking.key !== rankKey) {
    rankValues = new Map(symbols.map(quote => [quote.symbol, quote.dailyChange]))
    setRanking({ key: rankKey, values: rankValues })
  } else {
    // Fill previously unavailable anchors once. Live prices then update in place;
    // choosing a sort again takes a fresh ranking without rows jumping under clicks.
    const ready = symbols.filter(quote => quote.dailyChange != null && ranking.values.get(quote.symbol) == null)
    if (ready.length) {
      rankValues = new Map(ranking.values)
      ready.forEach(quote => rankValues.set(quote.symbol, quote.dailyChange))
      setRanking({ key: rankKey, values: rankValues })
    }
  }

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(marketCategories.map(category => [category, 0])) as Record<MarketCategory, number>
    counts.all = symbols.length
    for (const quote of symbols) {
      if (favourites.has(quote.symbol)) counts.favourites++
      const cat = getSymbolCategory(quote.symbol, brokerId)
      if (cat !== 'all') {
        counts[cat] = (counts[cat] ?? 0) + 1
      }
    }
    return counts
  }, [symbols, favourites, brokerId])

  const availableCategories = useMemo(() => {
    return marketCategories.filter((cat) => cat === 'all' || cat === 'favourites' || cat === selectedCategory || categoryCounts[cat] > 0)
  }, [categoryCounts, selectedCategory])

  const filteredSymbols = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return symbols.filter((quote) => {
      if (selectedCategory === 'favourites') {
        if (!favourites.has(quote.symbol)) return false
      } else if (selectedCategory !== 'all') {
        const cat = getSymbolCategory(quote.symbol, brokerId)
        if (cat !== selectedCategory) return false
      }
      if (!normalized) return true
      return (
        quote.symbol.toLowerCase().includes(normalized) ||
        quote.description.toLowerCase().includes(normalized)
      )
    })
  }, [query, selectedCategory, symbols, favourites, brokerId])
  const sortedSymbols = useMemo(() => sortMarketQuotes(filteredSymbols, sort, rankValues), [filteredSymbols, sort, rankValues])

  return (
    <aside className="market-watch" aria-label="Market Watch">
      <div className="market-watch-heading">
        <div>
          <p className="market-watch-eyebrow">Instruments</p>
          <h2>Market Watch</h2>
        </div>
        <span className="market-watch-count">{symbols.length}</span>
      </div>

      <label className="market-watch-search">
        <span aria-hidden="true">⌕</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search symbols"
          aria-label="Search symbols"
        />
      </label>

      <div className="market-watch-categories">
        <select
          className="market-watch-category-select"
          aria-label="Symbol category filter"
          value={selectedCategory}
          onChange={(event) => onCategoryChange(event.target.value as MarketCategory)}
        >
          {availableCategories.map((cat) => (
            <option key={cat} value={cat}>{categoryLabels[cat]} ({categoryCounts[cat]})</option>
          ))}
        </select>
      </div>

      <div className="market-watch-columns">
        <div className="market-watch-sort" onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setSortOpen(false)
        }} onKeyDown={event => { if (event.key === 'Escape') { setSortOpen(false); event.currentTarget.querySelector('button')?.focus() } }}>
          <button type="button" aria-label="Sort symbols" aria-expanded={sortOpen} aria-controls="market-watch-sort-options"
            onClick={() => setSortOpen(open => !open)}>Symbol ▾</button>
          {sortOpen && <div className="market-watch-sort-options" id="market-watch-sort-options" role="group" aria-label="Symbol sorting">
            {([['highest', 'Daily change: highest first'], ['lowest', 'Daily change: lowest first'],
              ['biggest', 'Biggest move: either direction'], ...(selectedCategory === 'favourites' ? [['saved', 'Saved order'] as const] : [])] as const).map(([value, label]) =>
              <button key={value} type="button" aria-pressed={sort === value} onClick={event => {
                onSortChange(value); setSortPass(pass => pass + 1); setSortOpen(false)
                event.currentTarget.closest('.market-watch-sort')?.querySelector('button')?.focus()
              }}>{label}</button>)}
          </div>}
        </div>
        <span title="Current price versus the previous completed Pepperstone daily candle’s close"
          aria-label={`Daily percent change${sort === 'saved' ? '' : `, ${sort === 'highest' ? 'highest first' : sort === 'lowest' ? 'lowest first' : 'biggest absolute move first'}`}`}>
          Daily % {sort === 'highest' ? '↓' : sort === 'lowest' ? '↑' : sort === 'biggest' ? '↕' : ''}</span>
      </div>

      <div className="market-watch-list" role="list" aria-label="Available symbols">
        {status !== 'live' && (
          <div className={`market-watch-source-state ${status}`} role="status">
            <i />
            <span>{status === 'loading' ? 'Loading MT5 Market Watch…' : error ?? 'Waiting for MT5 connection'}</span>
          </div>
        )}
        {selectedCategory === 'favourites' ? <FavouriteSections sections={sections} quotes={filteredSymbols} onChange={onOrganizeFavourites} sort={sort} sortValues={rankValues}
          renderRow={quote => <MarketWatchRow key={quote.symbol} quote={quote} selected={quote.symbol === selectedSymbol}
            onSelect={onSelect} favourite onToggleFavourite={onToggleFavourite} />} />
          : sortedSymbols.map(quote => <MarketWatchRow key={quote.symbol} quote={quote}
            selected={quote.symbol === selectedSymbol} onSelect={onSelect}
            favourite={favourites.has(quote.symbol)} onToggleFavourite={onToggleFavourite} />)}

        {filteredSymbols.length === 0 && (symbols.length > 0 || selectedCategory === 'favourites') && <p className="market-watch-empty">
          {selectedCategory === 'favourites' && !query.trim() && categoryCounts.favourites === 0
            ? favourites.size === 0 ? 'Star an instrument to add it here.' : 'Your favourite symbols are unavailable from the current feed.'
            : 'No matching symbol'}
        </p>}
      </div>
    </aside>
  )
}

const MarketWatchRow = memo(function MarketWatchRow({ quote, selected, onSelect, favourite, onToggleFavourite }: {
  quote: SymbolQuote; selected: boolean; onSelect: (symbol: string) => void
  favourite: boolean; onToggleFavourite: (symbol: string) => void
}) {
  const positive = quote.dailyChange != null && quote.dailyChange >= 0
  return <div className="market-watch-row-container" role="listitem">
    <button className={`market-watch-favourite${favourite ? ' active' : ''}`} type="button"
      aria-pressed={favourite} aria-label={`${favourite ? 'Remove' : 'Add'} ${quote.symbol} ${favourite ? 'from' : 'to'} favourites`}
      title={`${favourite ? 'Remove from' : 'Add to'} favourites`} onClick={() => onToggleFavourite(quote.symbol)}>
      <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3L12 17.4l-5.6 3 1.1-6.3L2.9 9.6l6.3-.9Z" /></svg>
    </button>
    <button className={`market-watch-row${selected ? ' selected' : ''}`} type="button"
    aria-pressed={selected} onClick={() => onSelect(quote.symbol)}>
    <span className="market-watch-identity"><strong>{quote.symbol}</strong></span>
    <span className={quote.dailyChange == null ? undefined : positive ? 'positive' : 'negative'}
      title={quote.dailyChange == null ? 'Previous completed D1 close unavailable' : undefined}>
      {quote.dailyChange == null ? '—' : `${positive ? '+' : ''}${quote.dailyChange.toFixed(2)}%`}</span>
    </button>
  </div>
})
