import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import type { SymbolQuote } from '../contracts/SymbolQuote'
import type { FeedStatus } from '../mt5-feed/use-mt5-market-data'
import { marketCategories, readMarketWatchPreferences, saveMarketWatchPreferences, toggleMarketFavourite, updateFavouriteSections, type FavouriteSection, type FavouriteSectionAction, type MarketCategory } from './market-watch-preferences'
import { FavouriteSections } from './FavouriteSections'
import './market-watch-panel.css'

type MarketWatchPanelProps = {
  symbols: SymbolQuote[]
  selectedSymbol: string
  status: FeedStatus
  error: string | null
  onSelect: (symbol: string) => void
  visible?: boolean
}

const majorPairs = new Set(['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'])
const fxCurrencies = new Set(['EUR', 'GBP', 'USD', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'])

function classifySymbol(rawSymbol: string): MarketCategory {
  const s = rawSymbol.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (s.startsWith('XAU') || s.startsWith('XAG') || s.startsWith('XPT') || s.startsWith('XPD') || s.includes('GOLD') || s.includes('SILVER')) {
    return 'metals'
  }
  if (s.startsWith('BTC') || s.startsWith('ETH') || s.startsWith('SOL') || s.startsWith('XRP') || s.startsWith('LTC') || s.startsWith('DOGE') || s.startsWith('ADA')) {
    return 'crypto'
  }
  if (
    s.includes('US500') || s.includes('SPX') || s.includes('US30') || s.includes('DJI') ||
    s.includes('USTEC') || s.includes('NAS100') || s.includes('GER40') || s.includes('DAX') ||
    s.includes('UK100') || s.includes('FTSE') || s.includes('JP225') || s.includes('HK50') ||
    s.includes('STOXX')
  ) {
    return 'indices'
  }
  if (s.includes('OIL') || s.includes('BRENT') || s.includes('WTI') || s.includes('GAS')) {
    return 'commodities'
  }
  const base6 = s.slice(0, 6)
  if (majorPairs.has(base6)) {
    return 'majors'
  }
  if (base6.length === 6 && fxCurrencies.has(base6.slice(0, 3)) && fxCurrencies.has(base6.slice(3, 6))) {
    return 'crosses'
  }
  return 'all'
}

const symbolClassificationCache = new Map<string, MarketCategory>()

function getSymbolCategory(rawSymbol: string): MarketCategory {
  const cached = symbolClassificationCache.get(rawSymbol)
  if (cached !== undefined) return cached
  const category = classifySymbol(rawSymbol)
  symbolClassificationCache.set(rawSymbol, category)
  return category
}

const categoryLabels: Record<MarketCategory, string> = {
  all: 'All',
  favourites: '★ Favourites',
  majors: 'Majors',
  crosses: 'Crosses',
  metals: 'Metals',
  indices: 'Indices',
  commodities: 'Energy',
  crypto: 'Crypto',
}

function formatPrice(value: number, precision: number) {
  return value.toFixed(precision)
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
  // Keep the controls' state mounted, but do no row/filter work while collapsed.
  return visible ? <MarketWatchContents {...props} query={query} onQueryChange={setQuery}
    selectedCategory={preferences.category} onCategoryChange={setSelectedCategory}
    favourites={favourites} onToggleFavourite={toggleFavourite} sections={preferences.sections} onOrganizeFavourites={organizeFavourites} /> : null
})

function MarketWatchContents({ symbols, selectedSymbol, status, error, onSelect, query, onQueryChange,
  selectedCategory, onCategoryChange, favourites, onToggleFavourite, sections, onOrganizeFavourites }: MarketWatchPanelProps & {
  query: string; onQueryChange: (query: string) => void
  selectedCategory: MarketCategory; onCategoryChange: (category: MarketCategory) => void
  favourites: ReadonlySet<string>; onToggleFavourite: (symbol: string) => void
  sections: FavouriteSection[]; onOrganizeFavourites: (action: FavouriteSectionAction) => void
}) {

  const categoryCounts = useMemo(() => {
    const counts: Record<MarketCategory, number> = {
      all: symbols.length,
      favourites: 0,
      majors: 0,
      crosses: 0,
      metals: 0,
      indices: 0,
      commodities: 0,
      crypto: 0,
    }
    for (const quote of symbols) {
      if (favourites.has(quote.symbol)) counts.favourites++
      const cat = getSymbolCategory(quote.symbol)
      if (cat !== 'all') {
        counts[cat] = (counts[cat] ?? 0) + 1
      }
    }
    return counts
  }, [symbols, favourites])

  const availableCategories = useMemo(() => {
    return marketCategories.filter((cat) => cat === 'all' || cat === 'favourites' || cat === selectedCategory || categoryCounts[cat] > 0)
  }, [categoryCounts, selectedCategory])

  const filteredSymbols = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return symbols.filter((quote) => {
      if (selectedCategory === 'favourites') {
        if (!favourites.has(quote.symbol)) return false
      } else if (selectedCategory !== 'all') {
        const cat = getSymbolCategory(quote.symbol)
        if (cat !== selectedCategory) return false
      }
      if (!normalized) return true
      return (
        quote.symbol.toLowerCase().includes(normalized) ||
        quote.description.toLowerCase().includes(normalized)
      )
    })
  }, [query, selectedCategory, symbols, favourites])

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

      <div className="market-watch-columns" aria-hidden="true">
        <span>Symbol</span>
        <span>Bid</span>
        <span>Ask</span>
      </div>

      <div className="market-watch-list" role="list" aria-label="Available symbols">
        {status !== 'live' && (
          <div className={`market-watch-source-state ${status}`} role="status">
            <i />
            <span>{status === 'loading' ? 'Loading MT5 Market Watch…' : error ?? 'Waiting for MT5 connection'}</span>
          </div>
        )}
        {selectedCategory === 'favourites' ? <FavouriteSections sections={sections} quotes={filteredSymbols} onChange={onOrganizeFavourites}
          renderRow={quote => <MarketWatchRow key={quote.symbol} quote={quote} selected={quote.symbol === selectedSymbol}
            onSelect={onSelect} favourite onToggleFavourite={onToggleFavourite} />} />
          : filteredSymbols.map(quote => <MarketWatchRow key={quote.symbol} quote={quote}
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
  const positive = quote.dailyChange >= 0
  return <div className="market-watch-row-container" role="listitem">
    <button className={`market-watch-favourite${favourite ? ' active' : ''}`} type="button"
      aria-pressed={favourite} aria-label={`${favourite ? 'Remove' : 'Add'} ${quote.symbol} ${favourite ? 'from' : 'to'} favourites`}
      title={`${favourite ? 'Remove from' : 'Add to'} favourites`} onClick={() => onToggleFavourite(quote.symbol)}>
      <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3L12 17.4l-5.6 3 1.1-6.3L2.9 9.6l6.3-.9Z" /></svg>
    </button>
    <button className={`market-watch-row${selected ? ' selected' : ''}`} type="button"
    aria-pressed={selected} onClick={() => onSelect(quote.symbol)}>
    <span className="market-watch-identity"><strong>{quote.symbol}</strong>
      <small className={positive ? 'positive' : 'negative'}>{positive ? '+' : ''}{quote.dailyChange.toFixed(2)}%</small>
    </span>
    <span>{formatPrice(quote.bid, quote.precision)}</span><span>{formatPrice(quote.ask, quote.precision)}</span>
    </button>
  </div>
})
