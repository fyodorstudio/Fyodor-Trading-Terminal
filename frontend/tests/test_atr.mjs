import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost:5173' }), oldWindow = globalThis.window
globalThis.window = dom
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} vs ${expected}`)
const candle = (high, low, close, i) => ({ time: 1700000000 + i * 60, open: close, high, low, close })
try {
  const { createAtrCalculator } = await server.ssrLoadModule('./src/market-data/indicators/atr/atr-calculation.ts')
  const { defaultAtrPreferences: defaults, readAtrPreferences, saveAtrPreferences } = await server.ssrLoadModule('./src/market-data/indicators/atr/atr-preferences.ts')
  const { replaceRecentBars } = await server.ssrLoadModule('./src/market-data/mt5-feed/market-snapshots.ts')
  // Independent true ranges: 2, 5 (gap up), 8 (gap down), 4, 6.
  const fixture = [[11, 9, 10], [15, 13, 14], [8, 6, 7], [10, 6, 8], [13, 7, 10]].map((row, i) => candle(...row, i))
  const expected = [undefined, undefined, 5, 14 / 3, 46 / 9]
  createAtrCalculator().sync(fixture, 3, 'reference').atr.forEach((point, i) => {
    if (expected[i] === undefined) assert.equal('value' in point, false, 'Warmup never invents values')
    else close(point.value, expected[i])
  })
  assert.deepEqual(createAtrCalculator().sync(fixture, 1, 'one').atr.map(point => point.value), [2, 5, 8, 4, 6])
  const flat = Array.from({ length: 20 }, (_, i) => candle(10, 10, 10, i))
  assert.equal(createAtrCalculator().sync(flat, 14, 'flat').atr.at(-1).value, 0)
  assert.deepEqual(createAtrCalculator().sync([], 14, 'empty').atr, [])
  const bars = Array.from({ length: 200 }, (_, i) => candle(100 + Math.sin(i) * 3 + 5, 95 + Math.sin(i) * 3, 100 + Math.sin(i) * 3, i))
  const engine = createAtrCalculator()
  let live = bars.slice(0, 100)
  engine.sync(live, 14, 'live')
  for (let i = 0; i < 10; i++) {
    live = replaceRecentBars(live, [{ ...live.at(-1), high: 110 + i }])
    const result = engine.sync(live, 14, 'live')
    assert.equal(result.from, live.length - 1, 'Live ticks replay only the open candle')
    assert.deepEqual(result.atr, createAtrCalculator().sync(live, 14, 'fresh').atr, 'Open candles never compound twice')
  }
  live = replaceRecentBars(live, [bars[100]])
  assert.equal(engine.sync(live, 14, 'live').from, 100)
  live = replaceRecentBars(live, live.slice(-3).map(bar => ({ ...bar, close: bar.close + 2 })))
  const correction = engine.sync(live, 14, 'live')
  assert.equal(correction.from, live.length - 3)
  assert.deepEqual(correction.atr, createAtrCalculator().sync(live, 14, 'fresh').atr)
  live = [candle(101, 91, 96, -1), ...live]
  assert.equal(engine.sync(live, 14, 'live').rebuilt, true, 'History prepends reseed Wilder smoothing')
  assert.deepEqual(engine.sync(live, 14, 'live').atr, createAtrCalculator().sync(live, 14, 'fresh').atr)
  assert.equal(engine.sync(live, 14, 'new-symbol').from, 0)
  assert.equal(engine.sync(live, 14, 'new-symbol').from, live.length, 'Unchanged snapshots do no calculation work')
  assert.deepEqual(engine.sync(live, 7, 'new-symbol').atr, createAtrCalculator().sync(live, 7, 'fresh').atr)
  let reads = 0
  const large = Array.from({ length: 100000 }, (_, i) => {
    const row = candle(106, 94, 100, i)
    Object.defineProperty(row, 'high', { enumerable: true, get() { reads++; return 106 } })
    return row
  })
  const fast = createAtrCalculator(); fast.sync(large, 14, 'large')
  const updated = replaceRecentBars(large, [{ ...large.at(-1), high: 108 }]); reads = 0
  assert.equal(fast.sync(updated, 14, 'large').from, large.length - 1)
  assert.ok(reads <= 2, 'Live calculation work is bounded independently of history length')
  assert.deepEqual(readAtrPreferences(), defaults)
  const settings = { ...defaults, enabled: true, length: 7, lineColor: '#123456', lineWidth: 3 }
  saveAtrPreferences(settings); assert.deepEqual(readAtrPreferences(), settings)
  for (const value of ['null', '[]', '{bad', JSON.stringify({ length: 0, enabled: 'yes', lineColor: 'red', lineWidth: 7 })]) {
    dom.localStorage.setItem('fyodor.indicators.atr.v1', value)
    assert.deepEqual(readAtrPreferences(), defaults)
  }
  console.log('✓ ATR: gap-aware Wilder reference, warmup/flat/length-one, bounded live ticks, corrections/backfill/scope and validated persistence')
} finally {
  await server.close(); await dom.happyDOM.close()
  if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow
}
