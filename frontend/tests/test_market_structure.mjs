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
  const closeResult = calculateMarketStructure(bars, 1, 'close')
  assert.deepEqual(closeResult.broken, [highBreak, lowBreak])
  assert.deepEqual(closeResult.high, { side: 'high', price: 17, start: 5 })
  assert.deepEqual(calculateMarketStructure(bars, 1, 'wick').broken, [
    { ...highBreak, end: 4 }, { ...lowBreak, end: 7 },
  ])
  assert.deepEqual(calculateMarketStructure(bars.slice(0, -1), 1, 'close').broken, [highBreak], 'Forming candles cannot confirm a break')
  assert.deepEqual(calculateMarketStructure(bars.slice(0, 3), 1, 'close'), {
    broken: [], high: undefined, low: undefined,
  }, 'Forming candles cannot confirm a swing')
  const plateau = bars.slice(0, 5).map((bar, index) => ({ ...bar, high: [10, 15, 15, 12, 11][index] }))
  assert.deepEqual(calculateMarketStructure(plateau, 1, 'close').high, { side: 'high', price: 15, start: 3 })

  assert.deepEqual(readMarketStructurePreferences(), defaults)
  const settings = { ...defaults, enabled: true, swingStrength: 1, showUnbroken: true }
  saveMarketStructurePreferences(settings)
  assert.deepEqual(readMarketStructurePreferences(), settings)
  dom.localStorage.setItem('fyodor.indicators.market-structure.v1', '{"swingStrength":51,"highColor":"red","lineWidth":0}')
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
  overlay.sync(bars, settings)
  assert.equal(updates, 1)
  let dash = []
  const strokes = []
  const context = {
    save() {}, restore() {}, beginPath() {},
    moveTo(x, y) { this.start = [x, y] },
    lineTo(x, y) { this.end = [x, y] },
    setLineDash(next) { dash = next },
    stroke() { strokes.push([this.start, this.end, this.strokeStyle, dash]) },
  }
  attached.paneViews()[0].renderer().draw({ useMediaCoordinateSpace: draw => draw({ context }) })
  assert.deepEqual(strokes, [
    [[20, 85], [50, 85], settings.highColor, []],
    [[50, 96], [80, 96], settings.lowColor, []],
    [[50, 83], [90, 83], settings.highColor, [4, 3]],
  ])
  overlay.destroy()
  assert.equal(attached, undefined)
  console.log('✓ Market Structure: confirmed swings and breaks, saved preferences, and projected price-pane segments')
} finally {
  await server.close()
  await dom.happyDOM.close()
  delete globalThis.window
}
