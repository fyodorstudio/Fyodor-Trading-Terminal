import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  server: { middlewareMode: true, hmr: false } })
try {
  const { replaceRecentBars, changedRecentBarStart, retainSymbolQuotes } = await server.ssrLoadModule('./src/market-data/mt5-feed/market-snapshots.ts')
  let reads = 0
  const bars = Array.from({ length: 100_000 }, (_, i) => ({ get time() { reads++; return i }, open: 1, high: 2, low: 0, close: 1 }))
  const tail = [99_997, 99_998, 99_999].map(time => ({ time, open: 1, high: 2, low: 0, close: 1 }))
  assert.equal(replaceRecentBars(bars, tail), bars)
  assert.ok(reads < 40, `An unchanged three-bar reply must not scan loaded history (${reads} reads)`)
  const unchangedReads = reads
  const live = replaceRecentBars(bars, tail.map((bar, i) => i === 2 ? { ...bar, close: 1.2 } : bar))
  assert.equal(live[0], bars[0]); assert.equal(live[99_998], bars[99_998])
  assert.equal(live.at(-1).close, 1.2)
  assert.equal(changedRecentBarStart(live, bars), 99_999)
  assert.equal(changedRecentBarStart(live, []), null, 'Change metadata belongs to the exact preceding snapshot')
  const appended = replaceRecentBars(live, [{ ...live.at(-1) }, { ...tail.at(-1), time: 100_000 }])
  assert.equal(appended.length, 100_001); assert.equal(appended[99_999], live.at(-1))
  assert.equal(changedRecentBarStart(appended, live), 100_000)

  // Reconciliation must detect corrections away from the last three candles.
  const window = Array.from({ length: 800 }, (_, i) => ({ ...tail[0], time: 99_200 + i }))
  window[10] = { ...window[10], high: 3 }
  const corrected = replaceRecentBars(bars, window)
  assert.equal(corrected[99_210].high, 3)
  assert.equal(corrected[99_211], bars[99_211])
  assert.equal(changedRecentBarStart(corrected, bars), 99_210)
  assert.equal(replaceRecentBars(corrected, window.map(bar => ({ ...bar }))), corrected)
  const shortened = replaceRecentBars(corrected, window.slice(0, -1))
  assert.equal(shortened.length, 99_999)
  assert.deepEqual(replaceRecentBars(shortened, []), [])
  const gap = replaceRecentBars(bars, tail.filter(bar => bar.time !== 99_998))
  assert.deepEqual(gap.slice(-2).map(bar => bar.time), [99_997, 99_999])

  const quotes = ['EURUSD', 'GBPUSD'].map(symbol => ({ symbol, description: symbol, bid: 1, ask: 2, dailyChange: 0, precision: 5 }))
  assert.equal(retainSymbolQuotes(quotes, quotes.map(quote => ({ ...quote }))), quotes)
  for (const patch of [{ bid: 1.1 }, { ask: 2.1 }, { dailyChange: -.1 }, { description: 'Updated' }, { precision: 3 }]) {
    const next = retainSymbolQuotes(quotes, [quotes[0], { ...quotes[1], ...patch }])
    assert.notEqual(next, quotes); assert.equal(next[0], quotes[0]); assert.deepEqual(next[1], { ...quotes[1], ...patch })
  }
  assert.deepEqual(retainSymbolQuotes(quotes, [...quotes].reverse()), [...quotes].reverse(), 'Order changes are preserved')
  assert.equal(retainSymbolQuotes(quotes, [quotes[1]])[0], quotes[1], 'Removed symbols do not discard retained row identities')
  assert.deepEqual(retainSymbolQuotes(quotes, []), [])
  console.log(`✓ 100,000-candle unchanged tail uses ${unchangedReads} time reads; live/appended/interior corrected windows and exact quote identity`)
} finally { await server.close() }
