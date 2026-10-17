export const marketCategories = ['all', 'favourites', 'majors', 'crosses', 'metals', 'indices', 'commodities', 'crypto'] as const
export type MarketCategory = typeof marketCategories[number]

export type MarketWatchPreferences = {
  favourites: string[]
  category: MarketCategory
}

const storageKey = 'fyodor.market-watch.v1'
// Requested initial shortlist, applied only until the user saves a preference.
const initialFavourites = ['NZDCHF', 'EURUSD', 'EURAUD']

export function readMarketWatchPreferences(): MarketWatchPreferences {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as Partial<MarketWatchPreferences> | null
    const category = parsed?.category
    return {
      favourites: Array.isArray(parsed?.favourites)
        ? [...new Set(parsed.favourites.filter((symbol): symbol is string => typeof symbol === 'string' && symbol.trim().length > 0))]
        : [...initialFavourites],
      category: category && marketCategories.includes(category) ? category : 'all',
    }
  } catch {
    return { favourites: [...initialFavourites], category: 'all' }
  }
}

export function saveMarketWatchPreferences(preferences: MarketWatchPreferences) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(preferences))
  } catch {
    // Keep favourites usable in this session when browser storage is unavailable.
  }
}
