import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { Window } from 'happy-dom'
import { createServer } from 'vite'

const dom = new Window({ url: 'http://localhost:5173' })
globalThis.window = dom
const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)),
  server: { middlewareMode: true, hmr: false },
})

try {
  const root = './src/market-data/indicators/market-structure'
  const { calculateMarketStructure } = await server.ssrLoadModule(`${root}/market-structure-calculation.ts`)
  const { createMarketStructureOverlay } = await server.ssrLoadModule(`${root}/market-structure-overlay.ts`)
  const { defaultMarketStructurePreferences: defaults, readMarketStructurePreferences, saveMarketStructurePreferences } =
    await server.ssrLoadModule(`${root}/market-structure-preferences.ts`)

  const bars = [
    [10, 5, 7], [15, 6, 10], [12, 7, 10], [16, 8, 14], [17, 4, 16],
    [13, 6, 10], [12, 3, 5], [11, 2, 3], [10, 5, 6],
  ].map(([high, low, close], index) => ({ time: index + 1, open: close, high, low, close }))
  const highBreak = { side: 'high', price: 15, start: 2, end: 5 }
  const lowBreak = { side: 'low', price: 4, start: 5, end: 8 }
  const settings = { ...defaults, enabled: true, swingStrength: 1, showUnbroken: true }
  const closeOnly = { ...settings, breakBy: 'close' }
  const closeResult = calculateMarketStructure(bars, closeOnly)
  assert.deepEqual(closeResult.broken, [highBreak, lowBreak])
  assert.deepEqual(closeResult.high, { side: 'high', price: 17, start: 5 })
  assert.deepEqual(calculateMarketStructure(bars, { ...settings, breakBy: 'wick' }).broken, [
    { ...highBreak, end: 4 }, { ...lowBreak, end: 7 },
  ])
  assert.deepEqual(calculateMarketStructure(bars.slice(0, -1), closeOnly).broken, [highBreak], 'Forming candles cannot confirm a break')
  assert.deepEqual(calculateMarketStructure(bars.slice(0, 3), closeOnly), {
    broken: [], signals: [], pending: [], high: undefined, low: undefined,
  }, 'Forming candles cannot confirm a swing')
  const plateau = bars.slice(0, 5).map((bar, index) => ({ ...bar, high: [10, 15, 15, 12, 11][index] }))
  assert.deepEqual(calculateMarketStructure(plateau, closeOnly).high, { side: 'high', price: 15, start: 3 })

  const fixture = rows => rows.map(([high, low, close], index) => ({ time: index + 1, open: close, high, low, close }))
  const sequence = fixture([[10, 5, 7], [15, 6, 10], [12, 7, 10], [16, 8, 14], [17, 9, 16], [16, 10, 15.5], [14, 11, 13]])
  const withoutBuffer = { ...settings, atrBufferPercent: 0 }
  const events = (result, side = 'high') => result.signals.filter(signal => signal.side === side)
    .map(({ kind, time, start }) => [kind, time, start])
  const expected = [['sweep', 4, 2], ['pending', 5, 2], ['confirmed', 6, 2]]
  const confirmed = calculateMarketStructure(sequence, withoutBuffer)
  assert.deepEqual(events(confirmed), expected)
  assert.deepEqual(confirmed.broken, [{ ...highBreak, end: 6 }], 'A solid segment ends at the confirming candle')
  const pending = calculateMarketStructure(sequence.slice(0, -1), withoutBuffer)
  assert.deepEqual(events(pending), expected.slice(0, -1), 'The forming candle cannot confirm the candidate')
  assert.equal(pending.pending[0].price, 15)
  assert.deepEqual(pending.broken, [], 'The sweep and pending close leave the line active')
  const mirror = sequence.map(bar => ({ ...bar, high: 30 - bar.low, low: 30 - bar.high, close: 30 - bar.close, open: 30 - bar.open }))
  assert.deepEqual(events(calculateMarketStructure(mirror, withoutBuffer), 'low'), expected, 'Low-side breaks mirror high-side breaks')
  const failed = sequence.map(bar => bar.time === 6 ? { ...bar, close: 14 } : bar)
  assert.deepEqual(events(calculateMarketStructure(failed, withoutBuffer)), [...expected.slice(0, 2), ['failed', 6, 2]])
  const multiClose = calculateMarketStructure(sequence, { ...withoutBuffer, confirmationCloses: 3 })
  assert.deepEqual(events(multiClose), expected.slice(0, 2))
  assert.equal(multiClose.pending[0].start, 2, 'A newer swing cannot replace a pending breakout')

  const atrFixture = [
    ...Array.from({ length: 14 }, () => [11, 9, 10]), [12, 10, 10], [11, 9, 10],
  ]
  const qualifying = fixture([...atrFixture, [100, 9, 12.2], [13, 11, 12.1], [12, 10, 11]])
  assert.deepEqual(events(calculateMarketStructure(qualifying, settings)), [['pending', 17, 15], ['confirmed', 18, 15]],
    'The exact threshold uses the previous ATR, and later closes only need to hold the swing')
  const marginal = fixture([...atrFixture, [13, 9, 12.1], [12, 11, 11.9], [12, 10, 11]])
  assert.deepEqual(events(calculateMarketStructure(marginal, settings)), [['reclaim', 18, 15]])

  assert.deepEqual(readMarketStructurePreferences(), defaults)
  const legacyKey = 'fyodor.indicators.market-structure.v1'
  const currentKey = 'fyodor.indicators.market-structure.v2'
  dom.localStorage.setItem(legacyKey, '{"breakBy":"close","enabled":true,"swingStrength":12}')
  assert.deepEqual(readMarketStructurePreferences(), { ...defaults, enabled: true, swingStrength: 12 })
  dom.localStorage.setItem(legacyKey, '{"breakBy":"wick"}')
  assert.deepEqual(readMarketStructurePreferences(), { ...defaults, breakBy: 'wick' })
  saveMarketStructurePreferences(settings)
  assert.deepEqual(readMarketStructurePreferences(), settings)
  dom.localStorage.setItem(currentKey, '{"swingStrength":51,"highColor":"red","lineWidth":0,"atrBufferPercent":101,"confirmationCloses":1}')
  assert.deepEqual(readMarketStructurePreferences(), defaults)

  let attached
  let updates = 0
  const scale = { getVisibleRange: () => ({ from: 3, to: 8 }), timeToCoordinate: time => time * 10 }
  const chart = { timeScale: () => scale }
  const series = {
    attachPrimitive(primitive) {
      attached = primitive
      primitive.attached({ requestUpdate: () => { updates++ } })
    },
    detachPrimitive(primitive) {
      assert.equal(primitive, attached)
      attached = undefined
    },
    priceToCoordinate: price => 100 - price,
  }
  const overlay = createMarketStructureOverlay(chart, series)
  overlay.sync(bars, closeOnly)
  assert.equal(updates, 1)
  let dash = []
  const strokes = []
  const textLabels = []
  const context = {
    save() {}, restore() {}, beginPath() {},
    moveTo(x, y) { this.start = [x, y] },
    lineTo(x, y) { this.end = [x, y] },
    setLineDash(next) { dash = next },
    stroke() { strokes.push([this.start, this.end, this.strokeStyle, dash]) },
    arc() {}, fill() {}, fillRect() {},
    measureText(text) { return { width: text.length * 5 } },
    fillText(text) { textLabels.push(text) },
  }
  const drawOverlay = () => attached.paneViews()[0].renderer().draw({
    useMediaCoordinateSpace: draw => draw({ context, mediaSize: { width: 200, height: 200 } }),
  })
  drawOverlay()
  assert.deepEqual(strokes, [
    [[20, 85], [50, 85], settings.highColor, []],
    [[50, 96], [80, 96], settings.lowColor, []],
    [[50, 83], [90, 83], settings.highColor, [4, 3]],
  ])
  strokes.length = 0
  overlay.sync(sequence.slice(0, -1), { ...withoutBuffer, showUnbroken: false })
  drawOverlay()
  assert.deepEqual(strokes, [[[20, 85], [60, 85], settings.highColor, [4, 3]]], 'A pending level is visible even with unbroken levels hidden')
  assert.deepEqual(textLabels, ['Pending', 'Sweep'])
  textLabels.length = 0
  overlay.sync(sequence, { ...withoutBuffer, showLabels: false })
  drawOverlay()
  assert.deepEqual(textLabels, [], 'The label toggle preserves level lines')
  overlay.destroy()
  assert.equal(attached, undefined)
  console.log('✓ Market Structure: live sweep, pending, confirmed, failed and reclaim signals; prior ATR and migrated settings; projected lines and labels')
} finally {
  await server.close()
  await dom.happyDOM.close()
  delete globalThis.window
}
