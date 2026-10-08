import { memo, useMemo, useState } from 'react'
import type { SymbolQuote } from '../contracts/SymbolQuote'
import type { FeedStatus } from '../mt5-feed/use-mt5-market-data'
import './market-watch-panel.css'

type MarketWatchPanelProps = {
  symbols: SymbolQuote[]
  selectedSymbol: string
  status: FeedStatus
  error: string | null
  onSelect: (symbol: string) => void
  visible?: boolean
}

type MarketCategory = 'all' | 'majors' | 'crosses' | 'metals' | 'indices' | 'commodities' | 'crypto'

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
  const [selectedCategory, setSelectedCategory] = useState<MarketCategory>('all')
  // Keep the controls' state mounted, but do no row/filter work while collapsed.
  return visible ? <MarketWatchContents {...props} query={query} onQueryChange={setQuery}
    selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory} /> : null
})

function MarketWatchContents({ symbols, selectedSymbol, status, error, onSelect, query, onQueryChange,
  selectedCategory, onCategoryChange }: MarketWatchPanelProps & {
  query: string; onQueryChange: (query: string) => void
  selectedCategory: MarketCategory; onCategoryChange: (category: MarketCategory) => void
}) {

  const categoryCounts = useMemo(() => {
    const counts: Record<MarketCategory, number> = {
      all: symbols.length,
      majors: 0,
      crosses: 0,
      metals: 0,
      indices: 0,
      commodities: 0,
      crypto: 0,
    }
    for (const quote of symbols) {
      const cat = getSymbolCategory(quote.symbol)
      if (cat !== 'all') {
        counts[cat] = (counts[cat] ?? 0) + 1
      }
    }
    return counts
  }, [symbols])

  const availableCategories = useMemo(() => {
    const order: MarketCategory[] = ['all', 'majors', 'crosses', 'metals', 'indices', 'commodities', 'crypto']
    return order.filter((cat) => cat === 'all' || categoryCounts[cat] > 0)
  }, [categoryCounts])

  const filteredSymbols = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return symbols.filter((quote) => {
      if (selectedCategory !== 'all') {
        const cat = getSymbolCategory(quote.symbol)
        if (cat !== selectedCategory) return false
      }
      if (!normalized) return true
      return (
        quote.symbol.toLowerCase().includes(normalized) ||
        quote.description.toLowerCase().includes(normalized)
      )
    })
  }, [query, selectedCategory, symbols])

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

      {availableCategories.length > 1 && (
        <div className="market-watch-categories" role="tablist" aria-label="Symbol category filter">
          {availableCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={selectedCategory === cat}
              className={`market-watch-category-pill${selectedCategory === cat ? ' active' : ''}`}
              onClick={() => onCategoryChange(cat)}
            >
              <span>{categoryLabels[cat]}</span>
              <small>{categoryCounts[cat]}</small>
            </button>
          ))}
        </div>
      )}

      <div className="market-watch-columns" aria-hidden="true">
        <span>Symbol</span>
        <span>Bid</span>
        <span>Ask</span>
      </div>

      <div className="market-watch-list" role="listbox" aria-label="Available symbols">
        {status !== 'live' && (
          <div className={`market-watch-source-state ${status}`} role="status">
            <i />
            <span>{status === 'loading' ? 'Loading MT5 Market Watch…' : error ?? 'Waiting for MT5 connection'}</span>
          </div>
        )}
        {filteredSymbols.map(quote => <MarketWatchRow key={quote.symbol} quote={quote}
          selected={quote.symbol === selectedSymbol} onSelect={onSelect} />)}

        {filteredSymbols.length === 0 && symbols.length > 0 && <p className="market-watch-empty">No matching symbol</p>}
      </div>
    </aside>
  )
}

const MarketWatchRow = memo(function MarketWatchRow({ quote, selected, onSelect }: {
  quote: SymbolQuote; selected: boolean; onSelect: (symbol: string) => void
}) {
  const positive = quote.dailyChange >= 0
  return <button className={`market-watch-row${selected ? ' selected' : ''}`} type="button" role="option"
    aria-selected={selected} onClick={() => onSelect(quote.symbol)}>
    <span className="market-watch-identity"><strong>{quote.symbol}</strong>
      <small className={positive ? 'positive' : 'negative'}>{positive ? '+' : ''}{quote.dailyChange.toFixed(2)}%</small>
    </span>
    <span>{formatPrice(quote.bid, quote.precision)}</span><span>{formatPrice(quote.ask, quote.precision)}</span>
  </button>
})
