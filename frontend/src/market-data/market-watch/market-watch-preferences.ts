export const marketCategories = ['all', 'favourites', 'majors', 'crosses', 'metals', 'indices', 'commodities', 'crypto'] as const
export type MarketCategory = typeof marketCategories[number]

export type MarketWatchPreferences = {
  favourites: string[]
  category: MarketCategory
  sections: FavouriteSection[]
}

export type FavouriteSection = { id: string; name: string; symbols: string[] }
export type FavouriteSectionAction =
  | { type: 'add'; id: string; name: string }
  | { type: 'rename'; id: string; name: string }
  | { type: 'remove'; id: string }
  | { type: 'move'; symbol: string; sectionId: string; before?: string }

function normalizeSections(value: unknown, favourites: string[]): FavouriteSection[] {
  const allowed = new Set(favourites), assigned = new Set<string>(), ids = new Set<string>()
  const sections: FavouriteSection[] = []
  if (Array.isArray(value)) for (const section of value) {
    if (!section || typeof section.id !== 'string' || !section.id || ids.has(section.id)
      || typeof section.name !== 'string' || !section.name.trim() || !Array.isArray(section.symbols)) continue
    ids.add(section.id)
    const symbols = section.symbols.filter((symbol: unknown): symbol is string => {
      if (typeof symbol !== 'string' || !allowed.has(symbol) || assigned.has(symbol)) return false
      assigned.add(symbol); return true
    })
    sections.push({ id: section.id, name: section.name.trim(), symbols })
  }
  if (!ids.has('default')) sections.unshift({ id: 'default', name: 'Favourites', symbols: [] })
  sections.find(section => section.id === 'default')!.symbols.push(...favourites.filter(symbol => !assigned.has(symbol)))
  return sections
}

export function toggleMarketFavourite(current: MarketWatchPreferences, symbol: string): MarketWatchPreferences {
  const removing = current.favourites.includes(symbol)
  const favourites = removing ? current.favourites.filter(item => item !== symbol) : [...current.favourites, symbol]
  return { ...current, favourites, sections: normalizeSections(current.sections, favourites) }
}

export function updateFavouriteSections(current: MarketWatchPreferences, action: FavouriteSectionAction): MarketWatchPreferences {
  let sections = current.sections
  if (action.type === 'add') {
    if (!action.id || !action.name.trim() || sections.some(section => section.id === action.id)) return current
    sections = [...sections, { id: action.id, name: action.name.trim(), symbols: [] }]
  } else if (action.type === 'rename') {
    if (!action.name.trim()) return current
    sections = sections.map(section => section.id === action.id ? { ...section, name: action.name.trim() } : section)
  } else if (action.type === 'remove') {
    const removed = sections.find(section => section.id === action.id)
    if (!removed || removed.id === 'default') return current
    sections = sections.filter(section => section.id !== action.id).map(section => section.id === 'default'
      ? { ...section, symbols: [...section.symbols, ...removed.symbols] } : section)
  } else {
    if (!current.favourites.includes(action.symbol) || action.before === action.symbol
      || !sections.some(section => section.id === action.sectionId
        && (action.before === undefined || section.symbols.includes(action.before)))) return current
    sections = sections.map(section => {
      const symbols = section.symbols.filter(symbol => symbol !== action.symbol)
      if (section.id === action.sectionId) symbols.splice(action.before === undefined ? symbols.length : symbols.indexOf(action.before), 0, action.symbol)
      return { ...section, symbols }
    })
  }
  return { ...current, sections, favourites: sections.flatMap(section => section.symbols) }
}

const storageKey = 'fyodor.market-watch.v1'
// Requested initial shortlist, applied only until the user saves a preference.
const initialFavourites = ['NZDCHF', 'EURUSD', 'EURAUD']

export function readMarketWatchPreferences(): MarketWatchPreferences {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as Partial<MarketWatchPreferences> | null
    const category = parsed?.category
    const favourites = Array.isArray(parsed?.favourites)
      ? [...new Set(parsed.favourites.filter((symbol): symbol is string => typeof symbol === 'string' && symbol.trim().length > 0))]
      : [...initialFavourites]
    return {
      favourites,
      category: category && marketCategories.includes(category) ? category : 'all',
      sections: normalizeSections(parsed?.sections, favourites),
    }
  } catch {
    return { favourites: [...initialFavourites], category: 'all', sections: normalizeSections(null, initialFavourites) }
  }
}

export function saveMarketWatchPreferences(preferences: MarketWatchPreferences) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(preferences))
  } catch {
    // Keep favourites usable in this session when browser storage is unavailable.
  }
}
