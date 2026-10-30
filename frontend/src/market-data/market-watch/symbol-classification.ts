import catalog from '../../../../config/broker-symbol-groups.json'
import type { MarketCategory } from './market-watch-preferences'

export const categoryLabels: Record<MarketCategory, string> = {
  all: 'All', favourites: '★ Favourites', majors: 'Forex · Majors',
  crosses: 'Forex · Crosses', exotics: 'Forex · Exotics',
  metals: 'Metals', commodities: 'Energy', softs: 'Soft commodities', indices: 'Stock indices',
  'currency-indices': 'Currency indices', crypto: 'Crypto', stocks: 'Stocks', etfs: 'ETFs',
  forwards: 'Forwards', perps: 'Perp CFDs',
}

function folderCategory(folder: string): MarketCategory {
  const parts = folder.split('\\')
  if (parts[1] === 'Forwards') return 'forwards'
  if (parts[1] === 'Perp CFDs') return 'perps'
  if (parts[1] === 'Stocks') return 'stocks'
  if (parts[1] === 'ETFs') return 'etfs'
  if (parts[1] === 'Cryptocurrencies') return 'crypto'
  if (parts[1] === 'Indices') return parts[2] === 'Currency' ? 'currency-indices' : 'indices'
  if (parts[1] === 'Forex') return ({ Majors: 'majors', Minors: 'crosses', Crosses: 'crosses', Exotics: 'exotics', NDFs: 'exotics' } as const)[parts[2]] ?? 'all'
  if (parts[1] === 'Commodities') return parts[2] === 'Energies' ? 'commodities' : parts[2] === 'Softs' ? 'softs' : 'metals'
  return 'all'
}

// Preserve the raw folder capture; navigation merges Minors and NDFs and places
// all seven requested USD majors together, independently of broker folders.
const capturedCategories = new Map(Object.entries(catalog.groups).flatMap(([folder, symbols]) =>
  symbols.map(symbol => [symbol, folderCategory(folder)] as const)))
const majorPairs = new Set(['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'])
const fxCurrencies = new Set(['EUR', 'GBP', 'USD', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'])
const fallbackCategories = new Map<string, MarketCategory>()

export function getSymbolCategory(rawSymbol: string, brokerId?: string | null): MarketCategory {
  const pair = rawSymbol.toUpperCase().split(/[._#-]/)[0]
  if (majorPairs.has(pair)) return 'majors'
  const captured = brokerId === catalog.server ? capturedCategories.get(rawSymbol) : undefined
  if (captured) return captured
  const cached = fallbackCategories.get(rawSymbol)
  if (cached) return cached
  const category = classifyFallback(rawSymbol)
  fallbackCategories.set(rawSymbol, category)
  return category
}

export function isNdfSymbol(symbol: string) {
  return catalog.groups['Markets\\Forex\\NDFs'].includes(symbol)
}

function classifyFallback(rawSymbol: string): MarketCategory {
  const symbol = rawSymbol.toUpperCase()
  // Conservative fallback for new symbols and other brokers. Match whole names
  // before suffixes so stock tickers such as GAS.US and SOL.US remain stocks.
  if (symbol.endsWith('-PERP')) return 'perps'
  if (symbol.endsWith('-F')) return 'forwards'
  if (/^[A-Z0-9]+\.[A-Z]{2}(?:-24)?$/.test(symbol)) return 'stocks'
  const base = symbol.split(/[._#-]/)[0]
  if (/^(USDX|EURX|JPYX)$/.test(base)) return 'currency-indices'
  if (/^(XAU|XAG|XPT|XPD)[A-Z]{3}$/.test(base) || /^(GOLD|SILVER|COPPER|ALUMINIUM|NICKEL|ZINC|LEAD)$/.test(base)) return 'metals'
  if (/^(BTC|ETH|SOL|XRP|LTC|DOGE|ADA)(USD|EUR|GBP|AUD)$/.test(base)) return 'crypto'
  if (/^(US500|US400|US2000|SPX|US30|DJI|USTEC|NAS100|GER40|DAX|UK100|FTSE|JP225|JPN225|AUS200|CA60|SWI20|EUSTX50|FRA40|HK50|CN50|CHINAH|HSTECH|SPA35|SCI25|NETH25|TWN|VIX|STOXX)$/.test(base)) return 'indices'
  if (/^(SPOTCRUDE|SPOTBRENT|NATGAS|GASOLINE|WTI|BRENT|OIL)$/.test(base)) return 'commodities'
  if (/^(COCOA|COFFEE|COTTON|SUGAR|LDSUGAR|SOYBEANS|WHEAT|CORN|CATTLE)$/.test(base)) return 'softs'
  const pair = /^([A-Z]{6})(?:[a-z]*)$/.exec(rawSymbol)?.[1] ?? base
  if (majorPairs.has(pair)) return 'majors'
  if (pair.length === 6 && fxCurrencies.has(pair.slice(0, 3)) && fxCurrencies.has(pair.slice(3))) return 'crosses'
  return 'all'
}
