import type { OhlcBar } from '../contracts/OhlcBar'
import type { SymbolQuote } from '../contracts/SymbolQuote'

const quoteFields = ['symbol', 'description', 'bid', 'ask', 'dailyChange', 'precision'] as const
export function retainSymbolQuotes(current: SymbolQuote[], incoming: SymbolQuote[]) {
  const bySymbol = new Map(current.map(quote => [quote.symbol, quote]))
  const next = incoming.map(quote => {
    const old = bySymbol.get(quote.symbol)
    return old && quoteFields.every(field => Object.is(old[field], quote[field])) ? old : quote
  })
  return current.length === next.length && next.every((quote, i) => quote === current[i]) ? current : next
}

const snapshotIds = new WeakMap<readonly OhlcBar[], number>()
const changes = new WeakMap<readonly OhlcBar[], { previousId: number; from: number }>()
let nextId = 0
function snapshotId(bars: readonly OhlcBar[]) {
  const known = snapshotIds.get(bars)
  if (known !== undefined) return known
  const id = ++nextId; snapshotIds.set(bars, id); return id
}
function sameBar(a: OhlcBar | undefined, b: OhlcBar) {
  return !!a && a.time === b.time && a.open === b.open && a.high === b.high && a.low === b.low && a.close === b.close
}

/** Sorted MT5 windows replace the recent tail. An unchanged three-bar reply
 * reads only that window plus a binary boundary, regardless of loaded history. */
export function replaceRecentBars(current: OhlcBar[], incoming: OhlcBar[]) {
  if (!incoming.length) return current.length ? [] : current
  let lo = 0, hi = current.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (current[mid].time < incoming[0].time) lo = mid + 1; else hi = mid
  }
  const start = lo
  let from = current.length
  const tail = incoming.map((bar, i) => {
    const old = current[start + i]
    if (sameBar(old, bar)) return old!
    from = Math.min(from, start + i)
    return bar
  })
  if (from === current.length && current.length === start + tail.length) return current
  // Tokens avoid retaining previous full histories through a metadata chain.
  const next = [...current.slice(0, start), ...tail]
  changes.set(next, { previousId: snapshotId(current), from: Math.min(from, next.length) })
  return next
}

export function changedRecentBarStart(next: OhlcBar[], previous: OhlcBar[]) {
  const change = changes.get(next)
  return change?.previousId === snapshotId(previous) ? change.from : null
}
