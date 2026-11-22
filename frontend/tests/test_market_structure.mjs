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
  const settings = { ...defaults, enabled: true, swingStrength: 1, showUnbroken: true }
  assert.deepEqual(calculateMarketStructure(bars.slice(0, 3), settings), {
    broken: [], signals: [], pending: [], high: undefined, low: undefined,
  }, 'Forming candles cannot confirm a swing')
  const plateau = bars.slice(0, 5).map((bar, index) => ({ ...bar, high: [10, 15, 15, 12, 11][index] }))
  assert.deepEqual(calculateMarketStructure(plateau, settings).high, { side: 'high', price: 15, start: 3 })

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
  dom.localStorage.setItem(currentKey, '{"breakBy":"wick","enabled":true,"confirmationCloses":3}')
  assert.deepEqual(readMarketStructurePreferences(), { ...defaults, enabled: true, confirmationCloses: 3 })
  saveMarketStructurePreferences(settings)
  assert.deepEqual(readMarketStructurePreferences(), settings)
  dom.localStorage.setItem(currentKey, '{"swingStrength":51,"highColor":"red","lineWidth":0,"atrBufferPercent":101,"confirmationCloses":1}')
  assert.deepEqual(readMarketStructurePreferences(), defaults)

  let attached
  let updates = 0
  let hover
  const container = dom.document.createElement('div')
  const scale = { getVisibleRange: () => ({ from: 3, to: 8 }), timeToCoordinate: time => time * 10 }
  const chart = {
    timeScale: () => scale,
    chartElement: () => container,
    options: () => ({ localization: { timeFormatter: time => `Candle ${time}` } }),
    priceScale: () => ({ width: () => 0 }),
    paneSize: () => ({ height: 200 }),
    subscribeCrosshairMove(callback) { hover = callback },
    unsubscribeCrosshairMove(callback) { assert.equal(hover, callback); hover = undefined },
  }
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
    priceFormatter: () => ({ format: price => String(price) }),
  }
  const overlay = createMarketStructureOverlay(chart, series)
  overlay.sync(sequence, withoutBuffer)
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
    [[20, 85], [60, 85], settings.highColor, []],
    [[50, 83], [70, 83], settings.highColor, [4, 3]],
  ])
  assert.deepEqual(textLabels, ['Breakout confirmed', 'Sweep'], 'Resolved attempts leave no Pending badge')
  strokes.length = 0
  textLabels.length = 0
  const repeated = fixture([[10, 5, 7], [15, 6, 10], [12, 7, 10], [16, 8, 14], [17, 8.5, 14.5], [18, 9, 16], [17, 10, 15.5], [14, 11, 13]])
  overlay.sync(repeated.slice(0, -1), { ...withoutBuffer, showUnbroken: false })
  drawOverlay()
  assert.deepEqual(strokes, [[[20, 85], [70, 85], settings.highColor, [4, 3]]], 'A pending level is visible even with unbroken levels hidden')
  assert.deepEqual(textLabels, ['Pending', 'Sweep ×2'])
  const tooltip = container.querySelector('[role="tooltip"]')
  hover({ paneIndex: 0, point: { x: 40, y: 85 } })
  assert.equal(tooltip.hidden, false)
  assert.deepEqual([...tooltip.querySelectorAll('li')].map(row => row.textContent), [
    'Candle 4 · Sweep', 'Candle 5 · Sweep', 'Candle 6 · Pending',
  ])
  hover({ paneIndex: 1, point: { x: 40, y: 85 } })
  assert.equal(tooltip.hidden, true)
  textLabels.length = 0
  overlay.sync(failed, withoutBuffer)
  drawOverlay()
  assert.deepEqual(textLabels, ['Sweep'], 'Failed attempts have no chart badge')
  hover({ paneIndex: 0, point: { x: 40, y: 85 } })
  assert.match(tooltip.textContent, /Candle 6 · Failed breakout/)
  textLabels.length = 0
  const failedWithoutSweep = fixture([[10, 5, 7], [15, 6, 10], [12, 7, 10], [16, 8, 15.5], [12, 9, 14], [11, 10, 10]])
  overlay.sync(failedWithoutSweep, withoutBuffer)
  drawOverlay()
  assert.deepEqual(textLabels, [], 'A standalone failed attempt leaves only a hover marker')
  hover({ paneIndex: 0, point: { x: 50, y: 85 } })
  assert.equal(tooltip.hidden, false)
  assert.match(tooltip.textContent, /Candle 5 · Failed breakout/)
  overlay.sync(sequence, { ...withoutBuffer, showLabels: false })
  drawOverlay()
  assert.deepEqual(textLabels, [], 'The label toggle preserves level lines')
  assert.equal(tooltip.hidden, true)
  overlay.destroy()
  assert.equal(attached, undefined)
  assert.equal(hover, undefined)
  assert.equal(container.childElementCount, 0)
  console.log('✓ Market Structure: grouped sweeps, live Pending, outcome history on hover, prior ATR, migrated settings and cleanup')
} finally {
  await server.close()
  await dom.happyDOM.close()
  delete globalThis.window
}
