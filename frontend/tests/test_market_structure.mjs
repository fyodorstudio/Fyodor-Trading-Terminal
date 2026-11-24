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
    broken: [], replacedTestedLevels: [], signals: [], trendlines: [], pending: [], activeTestedLevels: [], high: undefined, low: undefined,
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
  assert.deepEqual(confirmed.replacedTestedLevels, [], 'A confirmed breakout has only its solid line')
  const pending = calculateMarketStructure(sequence.slice(0, -1), withoutBuffer)
  assert.deepEqual(events(pending), expected.slice(0, -1), 'The forming candle cannot confirm the candidate')
  assert.equal(pending.pending[0].price, 15)
  assert.deepEqual(pending.broken, [], 'The sweep and pending close leave the line active')
  const mirror = rows => rows.map(bar => ({ ...bar, high: 30 - bar.low, low: 30 - bar.high, close: 30 - bar.close, open: 30 - bar.open }))
  assert.deepEqual(events(calculateMarketStructure(mirror(sequence), withoutBuffer), 'low'), expected, 'Low-side breaks mirror high-side breaks')
  const failed = sequence.map(bar => bar.time === 6 ? { ...bar, close: 14 } : bar)
  assert.deepEqual(events(calculateMarketStructure(failed, withoutBuffer)), [...expected.slice(0, 2), ['failed', 6, 2]])
  const sweptAndReplaced = failed.map(bar => bar.time === 5 ? { ...bar, close: 14.5 } : bar)
  const archivedHigh = { ...highBreak, end: 6 }
  assert.deepEqual(calculateMarketStructure(sweptAndReplaced, withoutBuffer).replacedTestedLevels, [archivedHigh])
  assert.deepEqual(calculateMarketStructure(mirror(sweptAndReplaced), withoutBuffer).replacedTestedLevels, [
    { ...archivedHigh, side: 'low' },
  ], 'Swept lows are retained when replaced too')
  const untouched = fixture([[10, 5, 7], [15, 6, 10], [12, 7, 10], [14, 8, 13], [14.8, 9, 14], [14.7, 10, 14], [14, 11, 13]])
  assert.deepEqual(calculateMarketStructure(untouched, withoutBuffer).replacedTestedLevels, [], 'Untouched replaced levels drop off')
  const multiClose = calculateMarketStructure(sequence, { ...withoutBuffer, confirmationCloses: 3 })
  assert.deepEqual(events(multiClose), expected.slice(0, 2))
  assert.equal(multiClose.pending[0].start, 2, 'A newer swing cannot replace a pending breakout')

  const next = (time, close) => ({ time, open: close, high: Math.max(close, 16), low: Math.min(13, close), close })
  const rapidFailure = [...sequence, next(8, 13)]
  assert.deepEqual(calculateMarketStructure(rapidFailure, { ...withoutBuffer, confirmationCloses: 3 }).replacedTestedLevels, [
    { ...highBreak, end: 7 },
  ], 'A queued swing replaces a swept level only when the pending attempt resolves')
  const invalidated = [...expected, ['invalidated', 7, 2]]
  assert.deepEqual(events(calculateMarketStructure(rapidFailure, withoutBuffer)), invalidated,
    'A closed candle back through the old level invalidates a confirmed breakout')
  assert.deepEqual(events(calculateMarketStructure(mirror(rapidFailure), withoutBuffer), 'low'), invalidated)
  assert.deepEqual(events(calculateMarketStructure(rapidFailure, { ...withoutBuffer, failureWindow: 0 })), expected)
  const holding = [...sequence.slice(0, 6), next(7, 15), next(8, 15.5)]
  assert.deepEqual(events(calculateMarketStructure([...holding, next(9, 14), next(10, 14)], withoutBuffer)),
    [...expected, ['invalidated', 9, 2]], 'The last candle in the failure window counts; an exact touch does not fail it')
  assert.deepEqual(events(calculateMarketStructure([...holding, next(9, 15.5), next(10, 14), next(11, 14)], withoutBuffer)),
    expected, 'Later pullbacks leave the breakout label intact')

  const atrFixture = [
    ...Array.from({ length: 14 }, () => [11, 9, 10]), [12, 10, 10], [11, 9, 10],
  ]
  const qualifying = fixture([...atrFixture, [100, 9, 12.2], [13, 11, 12.1], [12, 10, 11]])
  assert.deepEqual(events(calculateMarketStructure(qualifying, settings)), [['pending', 17, 15], ['confirmed', 18, 15]],
    'The exact threshold uses the previous ATR, and later closes only need to hold the swing')
  const marginal = fixture([...atrFixture, [13, 9, 12.1], [12, 11, 11.9], [12, 10, 11]])
  assert.deepEqual(events(calculateMarketStructure(marginal, settings)), [['reclaim', 18, 15]])

  const trendlineSettings = { ...withoutBuffer, showAutoTrendlines: true }
  const trendBars = fixture([
    [20, 5, 10], [20, 2, 10], [20, 6, 10], [20, 4, 10], [20, 8, 10],
    [20, 6, 10], [20, 6.5, 11], [20, 7, 7], [20, 8, 8], [20, 10, 11],
  ])
  const support = { side: 'low', startIndex: 1, startPrice: 2, endIndex: 8, endPrice: 9, broken: false }
  const brokenSupport = { ...support, broken: true }
  assert.deepEqual(calculateMarketStructure(trendBars, withoutBuffer).trendlines, [], 'Trendlines are opt-in')
  assert.deepEqual(calculateMarketStructure(trendBars.slice(0, 5), trendlineSettings).trendlines, [],
    'A second pivot confirmed only by the live candle cannot anchor a trendline')
  assert.deepEqual(calculateMarketStructure(trendBars.slice(0, 9), trendlineSettings).trendlines, [support],
    'The first crossing and a live second crossing keep the trendline active')
  assert.deepEqual(calculateMarketStructure(trendBars, trendlineSettings).trendlines, [brokenSupport],
    'A confirmed break pins the endpoint to the confirming candle')
  assert.deepEqual(calculateMarketStructure(mirror(trendBars), trendlineSettings).trendlines, [
    { ...brokenSupport, side: 'high', startPrice: 28, endPrice: 21 },
  ], 'Falling resistance mirrors rising support')
  const crossedAnchors = fixture([
    [20, 5, 10], [20, 2, 10], [20, 3.5, 3.5], [20, 11, 12], [20, 12, 13],
    [20, 10, 13], [20, 13, 14], [20, 14, 15],
  ])
  assert.deepEqual(calculateMarketStructure(crossedAnchors, trendlineSettings).trendlines, [],
    'A line that cuts through a close between its anchors is rejected')
  const competingSupport = [
    ...trendBars.slice(0, 6), ...fixture([[20, 10, 11], [20, 7, 11], [20, 10, 11], [20, 10, 11]])
      .map((bar, index) => ({ ...bar, time: 7 + index })),
  ]
  assert.deepEqual(calculateMarketStructure(competingSupport, trendlineSettings).trendlines, [
    { ...support, endIndex: 9, endPrice: 10 },
  ], 'A third confirmed touch outranks a wider two-touch line, even after a wick sweep')

  assert.deepEqual(readMarketStructurePreferences(), defaults)
  const legacyKey = 'fyodor.indicators.market-structure.v1'
  const currentKey = 'fyodor.indicators.market-structure.v2'
  dom.localStorage.setItem(legacyKey, '{"breakBy":"close","enabled":true,"swingStrength":12}')
  assert.deepEqual(readMarketStructurePreferences(), { ...defaults, enabled: true, swingStrength: 12 })
  dom.localStorage.setItem(currentKey, '{"breakBy":"wick","enabled":true,"confirmationCloses":3}')
  assert.deepEqual(readMarketStructurePreferences(), { ...defaults, enabled: true, confirmationCloses: 3 })
  dom.localStorage.setItem(currentKey, '{"showLabels":false,"markerColors":{"sweep":"#123456","confirmed":"bad"}}')
  assert.deepEqual(readMarketStructurePreferences(), {
    ...defaults, showMarkers: false, markerColors: { ...defaults.markerColors, sweep: '#123456' },
  })
  assert.equal(defaults.showUnbroken, true)
  const savedSettings = { ...settings, failureWindow: 0, showUnbroken: false, extendLines: true, showDashedLines: false, showSolidLines: false, showAutoTrendlines: true }
  saveMarketStructurePreferences(savedSettings)
  assert.deepEqual(readMarketStructurePreferences(), savedSettings)
  dom.localStorage.setItem(currentKey, '{"swingStrength":51,"highColor":"red","lineWidth":0,"atrBufferPercent":101,"confirmationCloses":1,"failureWindow":6}')
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
  const dots = []
  const colors = defaults.markerColors
  const context = {
    save() {}, restore() {}, beginPath() {},
    moveTo(x, y) { this.start = [x, y] },
    lineTo(x, y) { this.end = [x, y] },
    setLineDash(next) { dash = next },
    stroke() { strokes.push([this.start, this.end, this.strokeStyle, dash]) },
    arc(x, y) { this.center = [x, y] },
    fill() { dots.push([...this.center, this.fillStyle]) },
  }
  const drawOverlay = () => {
    dots.length = 0
    attached.paneViews()[0].renderer().draw({
      useMediaCoordinateSpace: draw => draw({ context, mediaSize: { width: 200, height: 200 } }),
    })
  }
  drawOverlay()
  assert.deepEqual(strokes, [
    [[50, 83], [70, 83], settings.highColor, [4, 3]],
    [[20, 85], [60, 85], settings.highColor, []],
  ])
  assert.deepEqual(dots, [[40, 85, colors.sweep], [60, 85, colors.confirmed]], 'Events use their own colors, away from the line palette')
  strokes.length = 0
  overlay.sync(sequence, { ...withoutBuffer, showDashedLines: false })
  drawOverlay()
  assert.deepEqual(strokes, [[[20, 85], [60, 85], settings.highColor, []]], 'Hiding dashed lines keeps confirmed lines')
  assert.deepEqual(dots, [[40, 85, colors.sweep], [60, 85, colors.confirmed]], 'Line visibility is independent of markers')
  strokes.length = 0
  overlay.sync(sequence, { ...withoutBuffer, showSolidLines: false })
  drawOverlay()
  assert.deepEqual(strokes, [[[50, 83], [70, 83], settings.highColor, [4, 3]]], 'Hiding solid lines keeps dashed levels')
  strokes.length = 0
  overlay.sync(sequence, { ...withoutBuffer, extendLines: true, markerColors: { ...colors, sweep: '#123456' } })
  drawOverlay()
  assert.deepEqual(strokes.at(-1), [[20, 85], [70, 85], settings.highColor, []], 'Extend keeps the breakout line solid through the latest candle')
  assert.deepEqual(dots, [[40, 85, '#123456'], [60, 85, colors.confirmed]])
  overlay.sync(rapidFailure, withoutBuffer)
  drawOverlay()
  assert.deepEqual(dots, [[40, 85, colors.sweep], [70, 85, colors.failed]], 'Quick failure replaces the confirmed marker')
  const tooltip = container.querySelector('[role="tooltip"]')
  hover({ paneIndex: 0, point: { x: 70, y: 85 } })
  assert.deepEqual([...tooltip.querySelectorAll('li')].slice(-2).map(row => row.textContent), [
    'Candle 6 · Breakout confirmed', 'Candle 7 · Failed breakout',
  ])
  strokes.length = 0
  overlay.sync(sequence.slice(0, 4), withoutBuffer)
  drawOverlay()
  assert.deepEqual(strokes, [[[20, 85], [40, 85], settings.highColor, [4, 3]]], 'An active level is dashed before its first test')
  const hideUntouched = { ...withoutBuffer, showUnbroken: false }
  strokes.length = 0
  overlay.sync(sequence.slice(0, 4), hideUntouched)
  drawOverlay()
  assert.deepEqual(strokes, [], 'Untouched levels can be hidden')
  overlay.sync(sequence.slice(0, 5), hideUntouched)
  drawOverlay()
  assert.deepEqual(strokes, [[[20, 85], [50, 85], settings.highColor, [4, 3]]], 'A sweep leaves the active dashed line in place')
  strokes.length = 0
  overlay.sync(sweptAndReplaced, hideUntouched)
  drawOverlay()
  assert.deepEqual(strokes, [[[20, 85], [60, 85], settings.highColor, [4, 3]]], 'A retired swept line ends at replacement')
  assert.deepEqual(dots, [[40, 85, colors.sweep]], 'Repeated sweeps share one marker')
  strokes.length = 0
  overlay.sync(sweptAndReplaced, { ...hideUntouched, extendLines: true })
  drawOverlay()
  assert.deepEqual(strokes, [[[20, 85], [70, 85], settings.highColor, [4, 3]]], 'Extend keeps the historical sweep line dashed through the latest candle')
  strokes.length = 0
  const repeated = fixture([[10, 5, 7], [15, 6, 10], [12, 7, 10], [16, 8, 14], [17, 8.5, 14.5], [18, 9, 16], [17, 10, 15.5], [14, 11, 13]])
  overlay.sync(repeated.slice(0, -1), hideUntouched)
  drawOverlay()
  assert.deepEqual(strokes, [[[20, 85], [70, 85], settings.highColor, [4, 3]]], 'A pending level is visible even with unbroken levels hidden')
  assert.deepEqual(dots, [[40, 85, colors.sweep], [60, 85, colors.pending]])
  hover({ paneIndex: 0, point: { x: 40, y: 85 } })
  assert.equal(tooltip.hidden, false)
  assert.match(tooltip.textContent, /2 sweeps/)
  assert.deepEqual([...tooltip.querySelectorAll('li')].map(row => row.textContent), [
    'Candle 4 · Sweep', 'Candle 5 · Sweep', 'Candle 6 · Pending',
  ])
  hover({ paneIndex: 1, point: { x: 40, y: 85 } })
  assert.equal(tooltip.hidden, true)
  overlay.sync(failed, withoutBuffer)
  drawOverlay()
  assert.deepEqual(dots, [[40, 85, colors.sweep]], 'A sweep marker includes subsequent failed attempts in its history')
  hover({ paneIndex: 0, point: { x: 40, y: 85 } })
  assert.match(tooltip.textContent, /Candle 6 · Failed breakout/)
  strokes.length = 0
  const failedWithoutSweep = fixture([[10, 5, 7], [15, 6, 10], [12, 7, 10], [16, 8, 15.5], [12, 9, 14], [11, 10, 10]])
  overlay.sync(failedWithoutSweep, hideUntouched)
  drawOverlay()
  assert.deepEqual(dots, [[50, 85, colors.failed]])
  assert.deepEqual(strokes, [[[20, 85], [50, 85], settings.highColor, [4, 3]]], 'A failed attempt keeps its level line even without a sweep')
  hover({ paneIndex: 0, point: { x: 50, y: 85 } })
  assert.equal(tooltip.hidden, false)
  assert.match(tooltip.textContent, /Candle 5 · Failed breakout/)
  strokes.length = 0
  overlay.sync(sequence, { ...withoutBuffer, showMarkers: false })
  drawOverlay()
  assert.deepEqual(dots, [])
  assert.equal(strokes.length, 2, 'The marker toggle preserves level lines')
  assert.equal(tooltip.hidden, true)
  const trendlineOnly = { ...trendlineSettings, showDashedLines: false, showSolidLines: false, extendLines: true }
  const activeTrendBars = trendBars.slice(0, 9)
  strokes.length = 0
  overlay.sync(activeTrendBars, { ...trendlineOnly, showAutoTrendlines: false })
  drawOverlay()
  assert.deepEqual(strokes, [])
  overlay.sync(activeTrendBars, trendlineOnly)
  drawOverlay()
  assert.deepEqual(strokes, [[[20, 98], [90, 91], settings.lowColor, [8, 4]]], 'Toggling on draws the active diagonal immediately')
  strokes.length = 0
  overlay.sync(trendBars, trendlineOnly)
  drawOverlay()
  assert.deepEqual(strokes, [[[20, 98], [90, 91], settings.lowColor, []]], 'Broken trendlines stop extending')
  overlay.destroy()
  assert.equal(attached, undefined)
  assert.equal(hover, undefined)
  assert.equal(container.childElementCount, 0)
  console.log('✓ Market Structure: level lines, configurable color markers, hover history and settings migration')
} finally {
  await server.close()
  await dom.happyDOM.close()
  delete globalThis.window
}
