import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost:5173' })
const oldWindow = globalThis.window
globalThis.window = dom
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} vs ${expected}`)
const candle = (close, i) => ({ time: 1700000000 + i * 60, open: close + 1, high: close + 3, low: close - 2, close })
try {
  const { createRsiCalculator } = await server.ssrLoadModule('./src/market-data/indicators/rsi/rsi-calculation.ts')
  const { defaultRsiPreferences: defaults, readRsiPreferences, saveRsiPreferences, rsiSources, rsiSmoothingTypes } = await server.ssrLoadModule('./src/market-data/indicators/rsi/rsi-preferences.ts')
  const { replaceRecentBars } = await server.ssrLoadModule('./src/market-data/mt5-feed/market-snapshots.ts')
  const input = { ...defaults, smoothing: 'None' }
  // Published Wilder example: the first 14 changes seed the RMA, then Wilder's
  // recursion gives these independently recorded values.
  const example = [44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28,46,46.03,46.41,46.22,45.64,46.21].map(candle)
  const result = createRsiCalculator().sync(example, input, 'EURUSD:H1')
  assert.ok(result.rsi.slice(0, 14).every(point => !('value' in point)), 'Warmup does not fabricate RSI values')
  close(result.rsi[14].value, 70.46413502109705, 'First Wilder RSI')
  close(result.rsi[15].value, 66.24961855355505, 'Next Wilder RSI')
  close(result.rsi[20].value, 62.880718309962404, 'Subsequent Wilder recursion')
  for (const [name, values, expected] of [['rising', [1,2,3,4],100], ['falling',[4,3,2,1],0], ['flat',[2,2,2,2],100]]) {
    const rows = createRsiCalculator().sync(values.map(candle), { ...input, length: 2 }, name).rsi
    close(rows.at(-1).value, expected, `${name} source follows Pine zero-loss/zero-gain precedence`)
  }
  const bars = Array.from({ length: 220 }, (_, i) => candle(100 + Math.sin(i * .73) * 4 + Math.cos(i * .19), i))
  for (const source of rsiSources) {
    const projected = bars.map(bar => ({ ...bar, close: source === 'Open' ? bar.open : source === 'High' ? bar.high : source === 'Low' ? bar.low : source === 'HL2' ? (bar.high + bar.low) / 2 : source === 'HLC3' ? (bar.high + bar.low + bar.close) / 3 : source === 'OHLC4' ? (bar.open + bar.high + bar.low + bar.close) / 4 : bar.close }))
    assert.deepEqual(createRsiCalculator().sync(bars, { ...input, source }, source).rsi,
      createRsiCalculator().sync(projected, input, 'projected').rsi, `${source} uses the selected candle source`)
  }
  for (const smoothing of rsiSmoothingTypes) {
    const settings = { ...defaults, smoothing, smoothingLength: 5 }
    const full = createRsiCalculator().sync(bars, settings, 'full')
    const values = full.rsi.filter(point => 'value' in point).map(point => point.value)
    let recursive
    for (let i = 0; i < values.length; i++) {
      const slice = values.slice(Math.max(0, i - 4), i + 1)
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length
      let expected
      if (smoothing === 'EMA') expected = recursive === undefined ? values[i] : recursive + (values[i] - recursive) / 3
      else if (smoothing !== 'None' && i >= 4) {
        expected = smoothing === 'WMA' ? slice.reduce((sum, value, j) => sum + value * (j + 1), 0) / 15 :
          smoothing === 'SMMA (RMA)' && recursive !== undefined ? (recursive * 4 + values[i]) / 5 : mean
      }
      recursive = expected
      const point = full.average[i + settings.length]
      if (expected === undefined) assert.ok(!('value' in point))
      else close(point.value, expected, `${smoothing} independent rolling-window average`)
    }
    const engine = createRsiCalculator()
    let live = bars.slice(0, 150)
    engine.sync(live, settings, 'live')
    for (let i = 0; i < 20; i++) {
      live = replaceRecentBars(live, [{ ...live.at(-1), close: 99 + i / 7 }])
      const next = engine.sync(live, settings, 'live')
      assert.equal(next.from, live.length - 1, 'A live tick recalculates exactly one candle')
      const fresh = createRsiCalculator().sync(live, settings, 'fresh')
      assert.deepEqual(next.rsi, fresh.rsi, 'Live RSI never compounds the open candle twice')
      assert.deepEqual(next.average, fresh.average)
    }
    live = replaceRecentBars(live, [candle(101, 150)])
    assert.equal(engine.sync(live, settings, 'live').from, 150, 'A new candle advances one step')
    live = replaceRecentBars(live, live.slice(-3).map((bar, i) => ({ ...bar, close: bar.close + i + 1 })))
    const corrected = engine.sync(live, settings, 'live')
    assert.equal(corrected.from, live.length - 3, 'A three-candle correction replays only three states')
    assert.deepEqual(corrected.average, createRsiCalculator().sync(live, settings, 'fresh').average)
    const prepended = [candle(95, -1), ...live]
    const backfill = engine.sync(prepended, settings, 'live')
    assert.equal(backfill.rebuilt, true, 'Earlier history reseeds Wilder RSI')
    assert.deepEqual(backfill.rsi, createRsiCalculator().sync(prepended, settings, 'fresh').rsi)
    assert.equal(engine.sync(prepended, settings, 'other-symbol').from, 0, 'Symbol/timeframe scope changes reseed even for identical snapshots')
    assert.equal(engine.sync(prepended, settings, 'other-symbol').from, prepended.length, 'Identical snapshots perform no calculation work')
  }
  // Work is bounded independently of loaded history; candle reads count real
  // source accesses, rather than timing assertions on a particular machine.
  let reads = 0
  const large = Array.from({ length: 40000 }, (_, i) => {
    const row = candle(100 + Math.sin(i), i), value = row.close
    Object.defineProperty(row, 'close', { enumerable: true, get() { reads++; return value } })
    return row
  })
  const fast = createRsiCalculator(); fast.sync(large, defaults, 'large')
  const updated = replaceRecentBars(large, [{ ...large.at(-1), close: 103 }]); reads = 0
  fast.sync(updated, defaults, 'large')
  assert.ok(reads <= 2, `40,000 loaded candles use at most two source reads on a live tick, got ${reads}`)
  assert.deepEqual(readRsiPreferences(), defaults)
  const shared = { ...defaults, enabled: true, length: 9, source: 'HLC3', upper: { ...defaults.upper, value: 80 } }
  saveRsiPreferences(shared)
  assert.deepEqual(readRsiPreferences(), shared, 'All symbols/timeframes read one durable preference')
  dom.localStorage.setItem('fyodor.indicators.rsi.v1', JSON.stringify({ enabled: true, length: 0, source: 'bad', lineColor: 'red', smoothingLength: 1.5, upper: { value: 10 }, lower: { value: 90 } }))
  const sanitized = readRsiPreferences()
  assert.equal(sanitized.enabled, true); assert.equal(sanitized.length, 14); assert.equal(sanitized.source, 'Close')
  assert.equal(sanitized.smoothingLength, 14); assert.equal(sanitized.lineColor, defaults.lineColor); assert.deepEqual(sanitized.upper, defaults.upper)
  for (const corrupt of ['null', '[]', '{invalid']) {
    dom.localStorage.setItem('fyodor.indicators.rsi.v1', corrupt); assert.deepEqual(readRsiPreferences(), defaults)
  }
  console.log('✓ RSI: Wilder reference values, Pine edge cases, seven sources, five smoothing modes, warmup/live/corrections/backfill, bounded tick work and shared validated persistence')
} finally {
  await server.close(); await dom.happyDOM.close()
  if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow
}
