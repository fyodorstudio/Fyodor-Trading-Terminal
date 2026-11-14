import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'
import fs from 'node:fs'

// Mount production hooks, shell, chart and overlays. Only external network,
// worker ports and the canvas library are faked; no production boundary is stubbed.
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, localStorage: dom.localStorage, ResizeObserver: dom.ResizeObserver,
  getComputedStyle: dom.getComputedStyle.bind(dom), IS_REACT_ACT_ENVIRONMENT: true }
const keys = [...Object.keys(globals), 'fetch', 'Worker', '__terminalProbe']
const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const originalNow = Date.now
let now = Date.UTC(2026, 9, 8, 12), sequence = 0
Date.now = () => now
const timers = new Map(), intervals = new Map(), frames = new Map()
const panListeners = new Map(['pointermove', 'pointerup', 'pointercancel'].map(type => [type, new Set()]))
const addWindowListener = dom.addEventListener.bind(dom), removeWindowListener = dom.removeEventListener.bind(dom)
dom.addEventListener = (type, listener, options) => { panListeners.get(type)?.add(listener); addWindowListener(type, listener, options) }
dom.removeEventListener = (type, listener, options) => { panListeners.get(type)?.delete(listener); removeWindowListener(type, listener, options) }
dom.setTimeout = (fn, ms) => { timers.set(++sequence, { fn, ms }); return sequence }
dom.clearTimeout = id => timers.delete(id)
dom.setInterval = (fn, ms) => { intervals.set(++sequence, { fn, ms }); return sequence }
dom.clearInterval = id => intervals.delete(id)
dom.requestAnimationFrame = fn => { frames.set(++sequence, fn); return sequence }
dom.cancelAnimationFrame = id => frames.delete(id)
dom.HTMLElement.prototype.scrollTo = function(options) { count('alertScroll'); this.scrollTop = options.top }
localStorage.setItem('fyodor.time-display.v1', JSON.stringify({ mode: 'utc', utcOffsetMinutes: 0 }))
// This regression exercises a user's intentionally empty MFDI setup after initial population.
localStorage.setItem('fyodor.indicators.macro.v2', JSON.stringify({ eventsByCurrency: {}, styles: {}, symbols: {},
  global: { enabled: false, currencies: [], axisTarget: 'rate', essentialsVersion: 1 } }))
localStorage.setItem('fyodor.chart-drawings.v1', JSON.stringify([{ id: 'drawing', symbol: 'EURUSD', timeframe: 'H1', tool: 'parallel-channel',
  points: [{ time: now / 1000 - 5 * 3600, price: 1.1 }, { time: now / 1000 - 3 * 3600, price: 1.2 },
    { time: now / 1000 - 5 * 3600, price: 1 }], createdAt: 1 },
  ...['H1', 'D1'].map(timeframe => ({ id: `other-${timeframe}`, symbol: 'TEST1', timeframe, tool: 'horizontal-line',
    points: [{ time: now / 1000, price: 1.1 }], createdAt: 1 })),
  { id: 'third-pair', symbol: 'TEST2', timeframe: 'H4', tool: 'horizontal-line',
    points: [{ time: now / 1000, price: 1.2 }], createdAt: 1 }]))
localStorage.setItem('fyodor.inspector.eurusd.v1', JSON.stringify({ version: 2, catalogVersion: 1, families: ['us-cpi','ecb'], showSymbols: true, symbolGrouping: 'release', detailView: 'r1', showHistograms: true, symbols: { 'us-cpi': 'star', ecb: 'moon' }, currencyColors: {} }))
const primitives = new Set(), captures = new Set(), pointerPrices = [], tradeMarkers = new Set(), tradeLines = new Set()
let priceShift = 0, priceRange = { from: 1, to: 2 }
dom.SVGElement.prototype.setPointerCapture = id => captures.add(id)
dom.SVGElement.prototype.hasPointerCapture = id => captures.has(id)
dom.SVGElement.prototype.releasePointerCapture = id => captures.delete(id)
const drawChartFrame = () => { for (const primitive of primitives) for (const view of primitive.paneViews()) view.renderer().draw() }

const counters = {}, clocks = [], workerInputs = [], rangeListeners = new Set(), sizeListeners = new Set(), hoverListeners = new Set(), clickListeners = new Set()
const count = name => { counters[name] = (counters[name] ?? 0) + 1 }
const reset = () => { for (const key of Object.keys(counters)) delete counters[key]; clocks.length = 0 }
let range = { from: now / 1000 + 10800 - 10 * 3600, to: now / 1000 + 10800 }, logicalRange = { from: 790, to: 800 }, plotted = [], ledgerPickTime = null
let futureTimes = []
const scale = {
  width: () => 900, options: () => ({ barSpacing: 80 }), getVisibleRange: () => range,
  getVisibleLogicalRange: () => logicalRange,
  timeToCoordinate: time => (Number(time) - Number(range.from)) / 3600 * 80,
  coordinateToTime: () => ledgerPickTime,
  timeToIndex: time => plotted.findIndex(bar => bar.time === time),
  logicalToCoordinate: index => Number.isInteger(index) ? (index - logicalRange.from) * 80 : 0,
  coordinateToLogical: x => Math.ceil(x / 80 + logicalRange.from),
  subscribeVisibleLogicalRangeChange: fn => rangeListeners.add(fn), unsubscribeVisibleLogicalRangeChange: fn => rangeListeners.delete(fn),
  subscribeSizeChange: fn => sizeListeners.add(fn), unsubscribeSizeChange: fn => sizeListeners.delete(fn),
  // This canvas fixture keeps fixed ten-bar projection geometry. Real startup
  // spacing and refresh behavior are exercised by test_chart_viewport.mjs.
  setVisibleLogicalRange: next => {
    const startup = next.to === plotted.length + 7 && (next.from === 0 || Math.abs(next.to - next.from - 900 / 7) < 1e-9)
    if (!startup) logicalRange = next
    for (const notify of rangeListeners) notify(next)
  }, setVisibleRange: next => { range = next }, fitContent: () => {},
}
const series = { applyOptions: () => {},
  setData: bars => { count('setData'); plotted = [...bars] },
  update: bar => { count('update'); if (plotted.at(-1)?.time === bar.time) plotted[plotted.length - 1] = bar; else plotted.push(bar) },
  priceToCoordinate: price => price * 100 + priceShift, coordinateToPrice: coordinate => { pointerPrices.push(coordinate); return (coordinate - priceShift) / 100 },
  attachPrimitive: primitive => primitives.add(primitive), detachPrimitive: primitive => primitives.delete(primitive),
  createPriceLine: options => { count('tradeLineCreates'); const line = { options, applyOptions: next => { count('tradeLineUpdates'); Object.assign(options, next) } }; tradeLines.add(line); return line },
  removePriceLine: line => tradeLines.delete(line),
}
const priceScale = { options: () => ({ autoScale: true }), width: () => 0, applyOptions: () => {}, getVisibleRange: () => priceRange,
  setVisibleRange: next => { priceRange = next; priceShift = (1 - next.from) * 100 } }
const timeSeries = { setData: rows => { count('futureSetData'); futureTimes = rows },
  update: row => { count('futureUpdate'); futureTimes = [...futureTimes, row] },
  applyOptions() {}, attachPrimitive: primitive => primitives.add(primitive), detachPrimitive: primitive => primitives.delete(primitive),
  priceToCoordinate: series.priceToCoordinate, coordinateToPrice: series.coordinateToPrice,
  createPriceLine: series.createPriceLine, removePriceLine: series.removePriceLine }
const indicatorSeries = new Set()
const pricePane = { setStretchFactor() {}, getHeight: () => 420, getHTMLElement: () => null }
const panes = [pricePane]
const addIndicatorPane = () => {
  count('rsiPaneCreates')
  const paneSeries = new Set(); let volumePane = false
  const pane = { setStretchFactor() {}, paneIndex: () => panes.indexOf(pane), moveTo: index => { const old = panes.indexOf(pane); panes.splice(old, 1); panes.splice(index, 0, pane) }, getHeight: () => 140,
    attachPrimitive: primitive => primitives.add(primitive), detachPrimitive: primitive => primitives.delete(primitive),
    getHTMLElement: () => ({ offsetTop: 428 }), priceScale: () => ({ width: () => 0, applyOptions() {} }),
    addSeries: definition => {
      if (definition?.type === 'histogram') volumePane = true
      let rows = []
      const line = { applyOptions() {}, setData: next => { count(volumePane ? 'volumeSetData' : 'rsiSetData'); rows = [...next] },
        update: row => { count(volumePane ? 'volumeUpdate' : 'rsiUpdate'); if (rows.at(-1)?.time === row.time) rows[rows.length - 1] = row; else rows.push(row) },
        data: () => rows, priceToCoordinate: value => 140 - value,
        seriesOrder: () => [...paneSeries].indexOf(line), setSeriesOrder() {},
        attachPrimitive: primitive => primitives.add(primitive), detachPrimitive: primitive => primitives.delete(primitive),
        createPriceLine: () => ({ applyOptions() {} }) }
      indicatorSeries.add(line); paneSeries.add(line); return line
    } }
  pane.fixtureSeries = paneSeries
  panes.push(pane); return pane
}
const chart = { options: () => ({ leftPriceScale: { visible: false }, rightPriceScale: { minimumWidth: 0 } }), addSeries: definition => definition.type === 'line' ? timeSeries : series, timeScale: () => scale, priceScale: () => priceScale,
  applyOptions: () => count('chartOptions'), paneSize: () => ({ width: 900, height: 420 }),
  addPane: addIndicatorPane, panes: () => panes,
  removeSeries: item => { indicatorSeries.delete(item); for (const pane of panes) pane.fixtureSeries?.delete(item) },
  removePane: index => { const [removed] = panes.splice(index, 1); assert.equal(removed.fixtureSeries.size, 0, 'Indicator series must be unregistered before removing their pane') },
  subscribeCrosshairMove: fn => hoverListeners.add(fn), unsubscribeCrosshairMove: fn => hoverListeners.delete(fn),
  subscribeClick: fn => clickListeners.add(fn), unsubscribeClick: fn => clickListeners.delete(fn),
  remove: () => count('chartRemoved'), chartElement: () => document.querySelector('.market-chart-canvas') }
globalThis.__terminalProbe = { count, clocks, createChart: () => { count('chartCreated'); return chart },
  createMarkers: markers => {
    count('tradeMarkerCreates'); tradeMarkers.add(markers)
    let current = markers
    return { setMarkers: next => { count('tradeMarkerUpdates'); tradeMarkers.delete(current); tradeMarkers.add(next); current = next },
      detach: () => tradeMarkers.delete(current) }
  } }
globalThis.Worker = class { constructor() { count('workerCreated'); throw new Error('Lite must not create calculation workers') } }

const canvasModule = `export const CandlestickSeries = {type:'candle'}, HistogramSeries = {type:'histogram'}, LineSeries = {type:'line'}, ColorType = { Solid: 'solid' }, CrosshairMode = { Normal: 0 },
  TickMarkType = { Year: 0, Month: 1, DayOfMonth: 2, Time: 3, TimeWithSeconds: 4 }, LineStyle = { Dotted: 1, Dashed: 2 }, LineType = { Simple: 0 };
  export const createChart = (...args) => globalThis.__terminalProbe.createChart(...args);
  export const createSeriesMarkers = (_series, markers) => globalThis.__terminalProbe.createMarkers(markers);`
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  ssr: { noExternal: ['lightweight-charts'] },
  server: { middlewareMode: true, hmr: false }, plugins: [{ name: 'terminal-work-counts', enforce: 'pre',
    resolveId(source) { if (source === 'lightweight-charts') return '\0terminal-canvas-fixture' },
    load(id) { if (id === '\0terminal-canvas-fixture') return canvasModule },
    transform(code, id) {
      if (id.endsWith('/heatmap-model.ts')) return code.replace('  const pairs = heatmapPairs(catalog), points =',
        "  globalThis.__terminalProbe.count('heatmapBuild'); const pairs = heatmapPairs(catalog), points =")
      if (id.endsWith('/LedgerTimeline.tsx')) return code.replace('  const viewport =', "  globalThis.__terminalProbe.count('ledgerTimeline'); const viewport =")
      if (id.endsWith('/EventsDock.tsx')) return code.replace('  const alarms = useAlarms()',
        "  globalThis.__terminalProbe.count('eventsDock'); const alarms = useAlarms()")
      if (id.endsWith('/HighlightDock.tsx')) return code.replace('const [expanded, setExpanded]', "globalThis.__terminalProbe.count('highlightCard'); const [expanded, setExpanded]")
      if (id.endsWith('/alert-day-model.ts')) return code.replace('const groups: AlertDayGroup[]', "globalThis.__terminalProbe.count('highlightSort'); const groups: AlertDayGroup[]")
      if (id.endsWith('/EventAlarmButton.tsx')) return code.replace('const events = useMemo',
        "globalThis.__terminalProbe.count('alarmButton'); const events = useMemo")
      if (id.endsWith('/useExternalSources.ts')) return code
        .replace('old.items.map(item => [item.key, item])', "old.items.map(item => { globalThis.__terminalProbe.count('externalIndex'); return [item.key, item] })")
        .replace('const previous = previousByKey.get(item.key)', "globalThis.__terminalProbe.count('externalLookup'); const previous = previousByKey.get(item.key)")
      if (id.endsWith('/TerminalWorkspace.tsx')) return code.replace('function TerminalWorkspace() {',
        "function TerminalWorkspace() { globalThis.__terminalProbe.count('workspace');")
      if (id.endsWith('/MarketWatchPanel.tsx')) return code.replace('const positive = quote.dailyChange != null',
        "globalThis.__terminalProbe.count('quoteRows'); const positive = quote.dailyChange != null")
      if (id.endsWith('/WildcardsDock.tsx')) return code.replace('  return <tr data-news-story=',
        "  globalThis.__terminalProbe.count('newsRows'); return <tr data-news-story=")
      if (id.endsWith('/MarketCandlestickChart.tsx')) return code.replace('}: MarketCandlestickChartProps) {',
        "}: MarketCandlestickChartProps) { globalThis.__terminalProbe.inspectMacro = onInspectMacroRelease; globalThis.__terminalProbe.count('chartRender');")
      if (id.endsWith('/volume-calculation.ts')) return code.replace('for (let i = from; i < bars.length; i++) {',
        "for (let i = from; i < bars.length; i++) { globalThis.__terminalProbe.count('volumeCandle');")
      if (id.endsWith('/rsi-calculation.ts')) return code.replace('for (let i = from; i < bars.length; i++) {',
        "for (let i = from; i < bars.length; i++) { globalThis.__terminalProbe.count('rsiCandle');")
      if (id.endsWith('/chart-price-space.ts')) return code.replace('for (let i = Math.max(0, count - 100); i < count; i++) {',
        "for (let i = Math.max(0, count - 100); i < count; i++) { globalThis.__terminalProbe.count('priceSpaceSeed');")
      if (id.endsWith('/useCalendarNow.ts')) return code.replace('return now', 'globalThis.__terminalProbe.clocks.push(now); return now')
      if (id.endsWith('/releases/group-days.ts')) return code.replace('  if (!range) return []', "  globalThis.__terminalProbe.count('dailyGrouping'); if (!range) return []")
      if (id.endsWith('/external-markers.ts')) return code.replace('  if (!bars.length) return []', "  globalThis.__terminalProbe.count('externalBuild'); if (!bars.length) return []")
    },
  }] })

const pending = new Map(), requests = []
let broker = 'Pepperstone-Demo', generation = 1, observed = 0, connected = true, clockOffset = 0, failHealth = false
let quotes = Array.from({ length: 200 }, (_, i) => ({ symbol: i === 0 ? 'EURUSD' : `TEST${i}`, description: `Quote ${i}`,
  bid: 1.1, ask: 1.2, daily_change: 0, precision: i === 1 ? 3 : 5 }))
let bars = Array.from({ length: 800 }, (_, i) => ({ time: now / 1000 + 10800 + (i - 799) * 3600, open: 1.1, high: 1.2, low: 1, close: 1.15, tick_volume: 100 }))
const catalog = JSON.parse(fs.readFileSync(new URL('./inspector/fixtures/major-calendar-catalog.json', import.meta.url), 'utf8'))
const event = (id, at, actual = .3, previous = .1) => {
  const meta = catalog.find(row => row.event_id === id)
  return { value_id: id + '/' + at, event_id: id, name: meta.event_name, event_code: id,
    currency: meta.country_currency, country_code: meta.country_code, country_name: meta.country_code,
    unit: +meta.unit_code, multiplier: +meta.multiplier_code, digits: +meta.digits, time_mode: 0,
    release_at: at, chart_time_seconds: at / 1000 + 10800, server_time_seconds: at / 1000 + 10800,
    period_seconds: Date.UTC(2026, 8, 1) / 1000, revision: 0, actual, previous,
    forecast: .2, revised_previous: null, importance: 'high', impact: 'none', availability: 'observed' }
}
// Use the exported CPI family fixture's actual names, never a guessed source ID.
const cpiMeta = catalog.filter(row => row.country_currency === 'USD' && /^(?:Core )?CPI(?: |$)/.test(row.event_name))
let events = [...cpiMeta.map(row => event(row.event_id, now - 2 * 3600000)), event('999010006', now - 2 * 3600000, 2, 2)]
for (const currency of ['USD','EUR','GBP','JPY','CHF','CAD','AUD','NZD']) {
  const meta = catalog.find(row => currency === 'EUR' ? row.event_id === '999010006' : row.country_currency === currency)
  events.push(event(meta.event_id, now + 86400000, null))
}
let calendarRevision = 1
const health = () => ({ api_version: '1', bridge: { status: 'running', started_at: 1, now: now + clockOffset },
  mt5: { connected, process_running: true, generation, account_server: broker },
  calendar: { status: 'live', instance_id: 'fixture', server_utc_offset_seconds: 10800 }, operations: {} })
const journalFixture = { version: 1, revision: 0, arrows: [], deletedIds: [] }
let wildcardFixture = { schema: 1, revision: 0, items: [] }
globalThis.fetch = (url, options = {}) => {
  const u = String(url); requests.push(u)
  if (u.startsWith('/storage-api/wildcards')) {
    if (options.method === 'POST') wildcardFixture = { ...wildcardFixture, revision: wildcardFixture.revision + 1, items: [...wildcardFixture.items,{id:String(wildcardFixture.revision),...JSON.parse(options.body)}] }
    return Promise.resolve({ ok: true, json: async () => structuredClone(wildcardFixture) })
  }
  if (u === '/storage-api/market-watch/daily') {
    const body = JSON.parse(options.body)
    return Promise.resolve({ ok: true, json: async () => ({ source_id: broker, generation,
      day: Math.floor((now / 1000 + 10800) / 86400) * 86400, observed_at: now / 1000,
      symbols: Object.fromEntries(body.symbols.map(symbol => [symbol, { open: 1.1, high: 1.2, low: 1, checked_at: now / 1000 }])) }) })
  }
  if (u === '/storage-api/heatmap/history') {
    const body = JSON.parse(options.body), today = new Date(now + 3 * 3600000).toISOString().slice(0, 10)
    const midnight = Date.parse(`${today}T00:00:00Z`) / 1000
    return Promise.resolve({ ok: true, json: async () => ({ schema: 1, source_id: broker, generation,
      year: body.year, today, observed_at: now / 1000, revision: 'a'.repeat(64), pending: 0,
      symbols: Object.fromEntries(body.symbols.map(symbol => [symbol, { availability: 'available', checked_at: now / 1000,
        bars: Array.from({ length: 5 }, (_, i) => ({ time: midnight - (4 - i) * 86400, open: 100, low: 99, high: 110, close: 100 + i })) }])) }) })
  }
  if (u === '/entry-trade-api/journal') {
    if (options.method === 'POST') {
      for (const op of JSON.parse(options.body).operations) {
        if (op.action === 'delete') journalFixture.arrows = journalFixture.arrows.filter(item => item.id !== op.id)
        else if (op.action === 'update') journalFixture.arrows = journalFixture.arrows.map(item => item.id === op.id ? { ...item, ...op.changes } : item)
        else if (!journalFixture.arrows.some(item => item.id === op.id)) journalFixture.arrows.unshift(op.arrow)
      }
      journalFixture.revision++
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(journalFixture)) })
  }
  if (u.startsWith('/alarm-api/alarms')) return Promise.resolve({ ok: true, json: async () => ({ application: 'fyodor-alarms', schedule_schema: 2, revision: 1, now,
    settings: { enabled: true, release_minutes: 2 }, native_available: true, schedule_error: null, refreshed_at: now / 1000, jobs: [],
    events: [] }) })
  if (u.startsWith('/storage-api/highlights')) return Promise.resolve({ ok: true, json: async () => ({ source_id: broker, revision: 'fixture-pins', items: [] }) })
  if (u.startsWith('/storage-api/alert-calendar')) {
    const params = new URL(u, 'http://localhost').searchParams
    const date = params.get('date')
    return Promise.resolve({ ok: true, json: async () => ({ source_id: params.get('source_id'), date, revision: String(calendarRevision),
      source: { publisher_status: 'live' }, coverage: {}, events: events.filter(event => event.release_at !== null
        ? new Date(event.release_at + 7 * 3600000).toISOString().slice(0, 10) === date
        : new Date(event.server_time_seconds * 1000).toISOString().slice(0, 10) === date) }) })
  }
  if (u.startsWith('/storage-api/recent-calendar')) {
    const q = new URL(u, 'http://localhost').searchParams
    const from = Number(q.get('from_utc_ms')), to = Number(q.get('to_utc_ms')), currencies = q.get('currencies').split(',')
    return Promise.resolve({ ok: true, json: async () => ({ source_id: q.get('source_id'), from_utc_ms: from, to_utc_ms: to,
      currencies, source_available: true, events: events.filter(event => currencies.includes(event.currency)
        && event.release_at !== null && event.release_at >= from && event.release_at <= to) }) })
  }
  if (u.startsWith('/storage-api/currency-ledger')) {
    const q = new URL(u, 'http://localhost').searchParams, year=Number(q.get('year')), revision = 'e'.repeat(64)
    const registry = JSON.parse(fs.readFileSync(new URL('../../config/calendar-measures.json', import.meta.url), 'utf8'))
    const day = new Date(now - 86400000).toISOString().slice(0,10),currencies=[q.get('scope').slice(0,3),q.get('scope').slice(3)]
    return Promise.resolve({ ok: true, json: async () => q.get('after_revision') === revision
      ? { schema: 1, broker, year, currencies, revision, unchanged: true }
      : { schema: 1, broker, year, min_year:2015,max_year:2026,revision, currencies, from_date: `${year}-01-01`, through_date: `${year}-12-31`,
          metrics: registry.metrics.filter(m => currencies.includes(m.currency) && (m.id.endsWith('.rate')||['usd.cpi-yoy','usd.cpi-mom'].includes(m.id))).map(m => ({ ...m,
            country:m.broker_country,event_id:m.broker_event_id,source_url: registry.sources[m.source].url, entries: [{ value_id: m.id, event_id: m.broker_event_id,
              name: m.label, value: m.currency === 'USD' ? 4 : 2.5, previous: m.currency === 'USD' ? 4 : 2.25,
              revised_previous: null, forecast: null, period: day, at: now-86400000, date: day, day,
              availability: 'observed', known_at: now-86400000, captured_at: new Date(now-86400000).toISOString() }] })) } })
  }
  if (u.startsWith('/storage-api/health')) return Promise.resolve({ ok: true, json: async () => ({ revision: calendarRevision,
    sources: [{ id: broker, publisher_status: 'live', server_now: now / 1000, instance_id: 'fixture' }], collector_error: null }) })
  if (u.startsWith('/storage-api/calendar')) {
    const params = new URL(u, 'http://localhost').searchParams, ids = params.get('event_ids')?.split(',') ?? null
    return Promise.resolve({ ok: true, json: async () => ({ source_id: broker, revision: calendarRevision, timestamp_convention: 'trade_server_time', time_basis: 'chart',
      event_ids: ids, events: events.filter(event => (!params.get('currencies') || params.get('currencies').split(',').includes(event.currency)) && (!ids || ids.includes(event.event_id)) && event.chart_time_seconds >= Number(params.get('from_server_seconds')) &&
        event.chart_time_seconds <= Number(params.get('to_server_seconds'))), coverage: {}, next_cursor: null }) })
  }
  if (u.includes('/activity')) return Promise.resolve({ ok: true, json: async () => ({ events: [], latest_sequence: 0 }) })
  const name = u.includes('/market-watch') ? 'watch' : u.includes('/ohlc') ? 'ohlc' : 'health'
  return new Promise((resolve, reject) => {
    const queue = pending.get(name) ?? []; queue.push({ url: u, resolve, reject, signal: options.signal }); pending.set(name, queue)
    options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  })
}
const { createRoot } = await import('react-dom/client')
// SSR drops CSS imports; include the real layout rules for chart containment checks.
const layoutStyles = document.createElement('style')
layoutStyles.textContent = ['terminal-shell/terminal-shell.layout.css', 'market-data/candlestick-chart/market-candlestick-chart.css']
  .map(file => fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')).join('\n')
document.head.appendChild(layoutStyles)
const container = document.createElement('div'); document.body.appendChild(container)
const root = createRoot(container)
function assertChartContainment() {
  const row = container.querySelector('.chart-workspace-row'), frame = row.querySelector(':scope > .chart-frame')
  assert.equal(dom.getComputedStyle(row).display, 'flex', 'The chart row distributes its bounded height to the chart and side panels')
  assert.equal(parseFloat(dom.getComputedStyle(row).minHeight), 0)
  assert.equal(dom.getComputedStyle(frame).flexGrow, '1', 'The chart frame fills the available row instead of collapsing around absolute children')
  assert.equal(parseFloat(dom.getComputedStyle(frame).minWidth), 0)
  assert.equal(dom.getComputedStyle(frame).position, 'relative', 'Chart canvases and calendar overlays stay anchored inside the chart frame')
  const host = frame.querySelector('.market-chart-host')
  assert.ok(host)
  assert.equal(dom.getComputedStyle(host).position, 'absolute')
}
const props = element => element[Object.getOwnPropertyNames(element).find(key => key.startsWith('__reactProps$'))]
async function reply(name) {
  await React.act(async () => {
    const request = pending.get(name)?.shift(); assert.ok(request, `Pending ${name} reply`)
    if (name === 'health' && failHealth) { request.reject(new Error('Bridge offline')); return }
    let body = health()
    if (name === 'watch') body = { symbols: quotes.map(quote => ({ ...quote })), observed_at: ++observed }
    if (name === 'ohlc') {
      const params = new URL(request.url, 'http://localhost').searchParams, start = Number(params.get('start_pos')), count = Number(params.get('count'))
      const end = bars.length - start, next = start + count
      body = { symbol: params.get('symbol'), timeframe: params.get('timeframe'), bars: bars.slice(Math.max(0, end - count), end).map(bar => ({ ...bar })),
        start_pos: start, next_start_pos: next, has_older: next < bars.length, observed_at: ++observed, source_generation: generation }
    }
    request.resolve({ ok: true, json: async () => body })
  })
}
async function tick(name, ms) {
  const timer = [...timers].find(([, t]) => t.fn.name === name && t.ms === ms)
  assert.ok(timer, `${name}/${ms} timer`); timers.delete(timer[0])
  await React.act(async () => { void timer[1].fn() })
}
const button = label => [...container.querySelectorAll('button')].find(element => element.textContent.trim().replace(/^⚙\s*/, '').startsWith(label))
async function click(element) { assert.ok(element); await React.act(async () => element.click()) }
function assertQuiet(label, workspace = false) {
  for (const key of ['quoteRows', 'chartRender', 'setData', 'update', 'futureSetData', 'futureUpdate', 'priceSpaceSeed', 'rsiCandle', 'rsiSetData', 'rsiUpdate', 'workerPosts', 'tradeLineCreates', 'tradeMarkerCreates', ...(workspace ? ['workspace'] : [])])
    assert.equal(counters[key] ?? 0, 0, `${label}: ${key} must remain unchanged`)
}
let append
try {
  const { FyodorTerminalShell } = await server.ssrLoadModule('./src/terminal-shell/FyodorTerminalShell.tsx')
  const { ActivityLogProvider } = await server.ssrLoadModule('./src/system-observability/activity-log/activity-log-store.tsx')
  const { useActivityActions } = await server.ssrLoadModule('./src/system-observability/activity-log/use-activity-log.ts')
  function CommandOnly() {
    count('commandSubscriber')
    const actions = useActivityActions()
    React.useEffect(() => { append = actions.appendActivity }, [actions])
    return null
  }
  await React.act(async () => root.render(React.createElement(ActivityLogProvider, null,
    React.createElement(FyodorTerminalShell), React.createElement(CommandOnly))))
  assertChartContainment()
  await reply('health'); await reply('watch')
  while (pending.get('ohlc')?.length) await reply('ohlc')
  assert.equal(counters.priceSpaceSeed, 100, 'Price-space initialization reads a bounded 100-candle tail')
  assert.equal(container.querySelectorAll('.market-watch-columns > span').length, 1, 'The watchlist has only the Daily % numeric column')
  assert.equal(container.querySelector('.quote-summary'), null, 'Bid/Ask is removed from the chart header')
  assert.equal(container.querySelectorAll('.session-timeline-labels span').length, 4)
  assert.ok(container.querySelector('.market-daily-range').textContent.includes('1000 pips below high'))
  reset()
  await tick('pollDaily', 5000)
  assertQuiet('Unchanged daily candle poll', true)
  assert.equal(container.querySelector('[data-currency-summary]'), null, 'The retired Fundamentals projection is absent')
  const beforeSummaryClock = { ...counters }
  await React.act(async () => [...intervals.values()].find(timer => timer.ms === 30000).fn())
  for (const key of ['workspace', 'chartRender', 'setData', 'update', 'futureSetData', 'futureUpdate', 'quoteRows'])
    assert.equal(counters[key], beforeSummaryClock[key], `Currency summary clock leaves ${key} unchanged`)
  const inspectorQuery = requests.find(url => url.startsWith('/storage-api/calendar') && new URL(url, 'http://localhost').searchParams.has('currencies'))
  assert.ok(inspectorQuery)
  const queryRange = new URL(inspectorQuery, 'http://localhost').searchParams
  const { utcToChartClock } = await server.ssrLoadModule('./src/appearance/time-display/chart-clock.ts')
  const clockScope = { brokerId: broker, brokerOffsetSeconds: 10800 }
  const selectedStart = utcToChartClock(Date.UTC(2025, 9, 8), clockScope) / 1000
  const selectedEnd = utcToChartClock((Math.floor(now / 86400000) + 91) * 86400000, clockScope) / 1000
  const queriedStart = Number(queryRange.get('from_server_seconds')), queriedEnd = Number(queryRange.get('to_server_seconds'))
  assert.ok(queriedStart <= selectedStart && queriedEnd >= selectedEnd, 'Inspector retains the full selected date window')
  assert.ok(selectedStart - queriedStart + queriedEnd - selectedEnd <= 2 * 3600,
    'Inspector padding is bounded to legacy policy companions; presentation does not fetch unrelated weeks')
  const flush = async () => React.act(async () => { for (const [id, fn] of frames) { frames.delete(id); fn() } })
  await flush()
  assert.equal(plotted.length, 800)
  assert.equal(Math.floor(futureTimes.at(-1).time / 86400), Math.floor(plotted.at(-1).time / 86400) + 90)
  assert.equal(container.querySelector('[aria-label="Volume settings"] svg').outerHTML, container.querySelector('[aria-label="RSI settings"] svg').outerHTML, 'Volume and RSI use the identical gear icon')
  const indicatorControls = container.querySelector('[aria-label="Show RSI"]').parentElement
  assert.equal(container.querySelector('[aria-label="Show Volume"]').parentElement.nextElementSibling, indicatorControls, 'Volume sits beside RSI')
  const macroControls = indicatorControls.nextElementSibling
  assert.equal(macroControls.getAttribute('aria-label'), 'MFDI indicator', 'MFDI is available beside RSI on FX pairs')
  assert.equal(macroControls.nextElementSibling.getAttribute('role'), 'separator')
  assert.equal(macroControls.nextElementSibling.nextElementSibling, container.querySelector('.chart-event-toggle'))
  assert.equal(container.querySelector('.chart-toolbar-center').firstElementChild.getAttribute('aria-label'), 'Chart timeframe')
  assert.equal(container.querySelector('.timeframe-selector').nextElementSibling.getAttribute('aria-label'), 'Refocus chart')
  for (const label of ['Show events', 'Show Detail']) assert.ok(container.querySelector(`[aria-label="${label}"] svg`), 'Panel buttons use matching outline SVG icons')
  const beforeRsiRange = { ...logicalRange }
  const beforeEmptyMacroQueries = requests.filter(url => url.startsWith('/storage-api/calendar')).length
  await click(container.querySelector('[aria-label="Show MFDI"]')); await flush()
  assert.equal(panes.length, 2, 'A new FX symbol can open an empty MFDI pane')
  assert.match(container.querySelector('.macro-note').textContent, /Choose currencies/)
  assert.equal(requests.filter(url => url.startsWith('/storage-api/calendar')).length, beforeEmptyMacroQueries, 'An empty MFDI selection does not poll calendar history')
  await click(container.querySelector('[aria-label="Hide MFDI"]')); await flush()
  assert.equal(panes.length, 1)
  reset()
  await click(container.querySelector('[aria-label="Show RSI"]')); await flush(); drawChartFrame()
  assert.equal(panes.length, 2); assert.equal(indicatorSeries.size, 3)
  assert.equal(counters.rsiCandle, 800, 'Enabling RSI seeds exactly the loaded candle count')
  assert.equal(counters.setData ?? 0, 0, 'Enabling RSI does not replace price candles')
  assert.equal(counters.chartCreated ?? 0, 0, 'Enabling RSI keeps the existing chart')
  assert.deepEqual(logicalRange, beforeRsiRange)
  assert.equal(JSON.parse(localStorage.getItem('fyodor.indicators.rsi.v1')).enabled, true)
  await click(container.querySelector('[aria-label="RSI settings"]'))
  assert.ok(container.querySelector('[role="dialog"][aria-modal="true"]'))
  await click([...container.querySelectorAll('.rsi-settings-dialog button')].find(button => button.textContent === 'Cancel'))
  reset(); await tick('poll', 2500); await reply('watch')
  assertQuiet('RSI enabled, unchanged watch poll')
  reset(); await tick('poll', 2000); await reply('ohlc')
  assert.equal(counters.rsiCandle ?? 0, 0, 'Unchanged OHLC poll performs no RSI calculation')
  const closeBefore = bars.at(-1).close
  bars[bars.length - 1] = { ...bars.at(-1), close: closeBefore + .001 }
  reset(); await tick('poll', 2000); await reply('ohlc')
  assert.equal(counters.rsiCandle, 1, 'Assembled live quote replays one RSI candle')
  assert.equal(counters.rsiUpdate, 2, 'Assembled live quote updates RSI and smoothing once each')
  assert.equal(counters.rsiSetData ?? 0, 0, 'A live tick does not replace indicator history')
  bars[bars.length - 1] = { ...bars.at(-1), close: closeBefore }
  await tick('poll', 2000); await reply('ohlc')
  reset()
  await click(container.querySelector('[aria-label="Show Volume"]')); await flush(); drawChartFrame()
  assert.equal(panes.length, 3)
  assert.equal(counters.volumeCandle, 800, 'Enabling Volume processes the loaded history once')
  assert.equal(counters.chartCreated ?? 0, 0); assert.equal(counters.setData ?? 0, 0)
  assert.equal(JSON.parse(localStorage.getItem('fyodor.indicators.volume.v1')).enabled, true)
  const layerWindow = { ...logicalRange }
  const layerControl = label => container.querySelector(`[aria-label="Show ${label}"]`)
  reset(); await click(layerControl('volume bars')); await flush()
  assert.equal(JSON.parse(localStorage.getItem('fyodor.indicators.volume.v1')).barsVisible, false)
  assert.equal(counters.volumeCandle ?? 0, 0, 'Hiding bars does not recalculate baseline history')
  assert.equal(counters.setData ?? 0, 0, 'Hiding a Volume layer never replaces price candles')
  await click(layerControl('relative line')); await flush()
  assert.equal(container.querySelectorAll('.volume-controls button').length, 4, 'All visibility controls remain reachable with every layer hidden')
  const axisControl = () => container.querySelector('[aria-label="Right axis target"]')
  assert.equal(axisControl().disabled, false, 'The Raw-mode axis selector stays clickable with hidden layers')
  await click(axisControl()); await flush()
  assert.equal(JSON.parse(localStorage.getItem('fyodor.indicators.volume.v1')).relativeLineVisible, true, 'Choosing the Relative axis reveals its hidden line')
  assert.equal(axisControl().textContent, 'Axis: Relative')
  await click(axisControl()); await flush()
  assert.equal(JSON.parse(localStorage.getItem('fyodor.indicators.volume.v1')).barsVisible, true, 'Choosing Volume reveals bars if no tick layer was visible')
  assert.equal(axisControl().textContent, 'Axis: Volume')
  await click(layerControl('volume bars')); await click(layerControl('relative line')); await flush()
  await click(layerControl('average line')); await flush()
  assert.equal(JSON.parse(localStorage.getItem('fyodor.indicators.volume.v1')).averageVisible, true)
  await click(layerControl('average line')); await click(layerControl('volume bars')); await click(layerControl('relative line')); await flush()
  assert.deepEqual(logicalRange, layerWindow, 'Layer switches preserve the chart viewport')
  reset(); await tick('poll', 2000); await reply('ohlc')
  assert.equal(counters.volumeCandle ?? 0, 0, 'Unchanged replies do no Volume calculation')
  bars[bars.length - 1] = { ...bars.at(-1), tick_volume: 150 }
  reset(); await tick('poll', 2000); await reply('ohlc')
  assert.equal(counters.volumeCandle, 1, 'A volume-only feed update calculates one row')
  assert.equal(counters.volumeUpdate, 3, 'Histogram, optional average and exact Relative line each update once')
  assert.equal(counters.volumeSetData ?? 0, 0, 'A volume tick never replaces indicator history')
  assert.match(container.querySelector('.volume-readout').textContent, /Ticks 150/)
  const activeSessions = () => [...container.querySelectorAll('.volume-session-name[data-active="true"]')].map(node => node.textContent)
  assert.deepEqual([...container.querySelectorAll('.volume-session-name')].map(node => node.textContent), ['Sydney','Tokyo','London','New York'])
  assert.deepEqual(activeSessions(), ['London', 'New York'])
  const fireVolumeHover = async event => {
    await React.act(async () => { for (const fn of hoverListeners) fn(event) }); await flush()
  }
  const sessionBars = [...plotted]
  reset()
  const tokyoUtc = Date.UTC(2026, 9, 8, 1)
  await fireVolumeHover({ point: { x: 200, y: 200 }, time: tokyoUtc / 1000 + 10800 })
  assert.deepEqual(activeSessions(), ['Sydney', 'Tokyo'])
  const volumeSessionTimer = [...intervals.values()].filter(timer => timer.ms === 30000).at(-1)
  await React.act(async () => volumeSessionTimer.fn())
  assert.deepEqual(activeSessions(), ['Sydney', 'Tokyo'], 'A historical hover stays put while the current session clock ticks')
  assert.equal(counters.volumeCandle ?? 0, 0); assert.equal(counters.volumeSetData ?? 0, 0); assert.equal(counters.volumeUpdate ?? 0, 0)
  await fireVolumeHover({})
  assert.deepEqual(activeSessions(), ['London', 'New York'], 'Leaving hover returns to actual current time')
  const originalSessionNow = now
  now = Date.UTC(2026, 9, 10, 12)
  reset(); await React.act(async () => volumeSessionTimer.fn())
  assert.deepEqual(activeSessions(), [], 'All four session labels stay visible but inactive over the weekend')
  assert.match(container.querySelector('.volume-readout-note').textContent, /No current candle loaded/, 'A historical final candle is never presented as current activity')
  assert.equal(counters.workspace ?? 0, 0); assert.equal(counters.volumeCandle ?? 0, 0); assert.equal(counters.volumeSetData ?? 0, 0)
  now = originalSessionNow
  await React.act(async () => volumeSessionTimer.fn())
  assert.deepEqual(plotted, sessionBars, 'Hover and idle session updates never change price candles')
  await click(container.querySelector('[aria-label="Volume settings"]'))
  assert.doesNotMatch(container.querySelector('[role="dialog"]').textContent, /Comparison clock/)
  assert.match(container.querySelector('[role="dialog"]').textContent, /Sessions are automatic/)
  await React.act(async () => {
    const mode = container.querySelector('.rsi-settings-dialog select')
    mode.value = 'relative'; mode.dispatchEvent(new dom.Event('change', { bubbles: true }))
  })
  const volumeStyleTab = () => [...container.querySelectorAll('[role="tab"]')].find(tab => tab.textContent === 'Style')
  await click(volumeStyleTab())
  const volumeCheckbox = text => [...container.querySelectorAll('.rsi-settings-dialog label')].find(label => label.textContent.trim() === text).querySelector('input')
  const changeCheckbox = async (text, checked) => React.act(async () => {
    const input = volumeCheckbox(text)
    input[Object.getOwnPropertyNames(input).find(key => key.startsWith('__reactProps$'))].onChange({ target: { checked } })
  })
  await changeCheckbox('Show volume bars', false)
  await changeCheckbox('Show Relative activity line', false)
  await click([...container.querySelectorAll('.rsi-settings-dialog button')].find(button => button.textContent === 'OK')); await flush()
  assert.equal(container.querySelector('[aria-label="Show volume bars"]').getAttribute('aria-pressed'), 'false')
  assert.equal(JSON.parse(localStorage.getItem('fyodor.indicators.volume.v1')).barsVisible, false)
  assert.equal(JSON.parse(localStorage.getItem('fyodor.indicators.volume.v1')).relativeLineVisible, false)
  await click(container.querySelector('[aria-label="Volume settings"]'))
  await click(volumeStyleTab())
  assert.equal(volumeCheckbox('Show volume bars').checked, false)
  await changeCheckbox('Show volume bars', true)
  await changeCheckbox('Show Relative activity line', true)
  await click([...container.querySelectorAll('.rsi-settings-dialog button')].find(button => button.textContent === 'Cancel')); await flush()
  assert.equal(container.querySelector('[aria-label="Show volume bars"]').getAttribute('aria-pressed'), 'false', 'Cancel leaves the saved layer visibility intact')
  await click(container.querySelector('[aria-label="Hide Volume"]')); await flush()
  assert.equal(panes.length, 2); assert.equal(indicatorSeries.size, 3, 'Volume removal preserves the RSI series')
  assert.equal(container.querySelector('.volume-legend'), null)
  assert.deepEqual([...container.querySelectorAll('[aria-label="App features"] button')].map(node => node.textContent.trim().replace(/\s+\d+$/, '')),
    ['Alert', 'Wildcards', 'Ledger', 'Heatmap', 'Inspector', 'Entry Trade', 'Activity', '⚙ Settings'])
  reset()
  const ledgerRequests = requests.length
  await click(button('Ledger'))
  assert.ok(container.querySelector('[aria-label="Open EUR developments"]'))
  assert.ok(container.querySelector('[aria-label="Resize Ledger dock"]'))
  assert.equal(requests.slice(ledgerRequests).some(url => url.startsWith('/storage-api/currency-ledger')), true, 'Every major pair can load Ledger data')
  assertQuiet('Opening EUR/USD Ledger')
  await click(button('Ledger'))
  reset()
  await click(button('Wildcards'))
  assert.ok(container.querySelector('[aria-label="Wildcards"]'))
  assert.ok([...container.querySelectorAll('.wildcards-dock header button')].some(n=>n.textContent==='Add wildcard'))
  assert.equal(container.querySelectorAll('[data-news-story]').length,0)
  assertQuiet('Opening manual Wildcards')
  await click(button('Wildcards'))
  await click(button('Alert'))
  assert.ok(container.querySelector('[aria-label="Alert"]'))
  assert.equal(container.querySelector('[aria-label="Event view"]'), null)
  assert.equal(container.querySelector('.event-timeline-row'), null)
  const beforeAlertScrollRequests = requests.length
  reset()
  await React.act(async () => { for (let i = 0; i < 200; i++) container.querySelector('.alert-date-scroll').dispatchEvent(new dom.Event('scroll')) })
  await flush()
  for (const key of ['highlightSort', 'highlightCard', 'alarmButton', 'eventsDock', 'alertScroll'])
    assert.equal(counters[key] ?? 0, 0, `Scrolling Alert performs zero ${key} work`)
  assert.equal(requests.length, beforeAlertScrollRequests, 'Native Alert scrolling makes no data requests')
  assertQuiet('Scrolling Alert', true)
  reset()
  now += 1000
  await React.act(async () => { for (const timer of intervals.values()) if (timer.ms === 1000) timer.fn() })
  assertQuiet('Events countdown', true)
  for (const key of ['highlightSort', 'highlightCard', 'alarmButton', 'eventsDock'])
    assert.equal(counters[key] ?? 0, 0, `A real countdown tick leaves ${key} unchanged`)
  reset()
  await React.act(async () => { for (let i = 0; i < 200; i++) for (const notify of rangeListeners) notify(logicalRange) })
  await flush()
  assertQuiet('Panning with Alert open', true)
  for (const key of ['highlightSort', 'highlightCard', 'alarmButton', 'eventsDock'])
    assert.equal(counters[key] ?? 0, 0, `Panning leaves ${key} unchanged`)
  now -= 1000 // Keep the later drawing-coordinate fixtures anchored to their original clock.
  assert.ok(container.querySelector('.alert-event-group'), 'Alert retains the date table')
  assert.ok(container.querySelector('.alert-event-table'))
  await click(button('Alert'))
  // One header switch hides both calendar layers without editing their choices.
  const iconKey = 'fyodor.chart-event-icons-visible.v1'
  const inspectorChoices = localStorage.getItem('fyodor.inspector.shared.v1')
  const refocusButton = container.querySelector('[aria-label="Refocus chart"]')
  assert.equal(refocusButton.textContent.trim(), '⛶')
  assert.equal(container.querySelector('.timeframe-selector').nextElementSibling, refocusButton)
  assert.equal(refocusButton.nextElementSibling.className, 'chart-header-actions')
  const visibleWindow = { ...logicalRange }, beforeIconToggle = counters.setData ?? 0
  await click(container.querySelector('[aria-label="Hide event icons"]')); await flush()
  assert.equal(container.querySelector('[aria-label="Show event icons"]').getAttribute('aria-pressed'), 'false')
  assert.equal(container.querySelector('.inspector-chart-markers'), null)
  assert.equal(localStorage.getItem(iconKey), 'false')
  assert.deepEqual(logicalRange, visibleWindow)
  assert.equal(counters.setData ?? 0, beforeIconToggle, 'Visibility changes do not rewrite candle data')
  await click([...container.querySelectorAll('[aria-label="Chart timeframe"] button')].find(node => node.textContent === 'M30'))
  while (pending.get('ohlc')?.length) await reply('ohlc')
  await flush()
  await click([...container.querySelectorAll('[aria-label="Chart timeframe"] button')].find(node => node.textContent === 'H1'))
  while (pending.get('ohlc')?.length) await reply('ohlc')
  await click(container.querySelector('[aria-label="Show event icons"]')); await flush()
  assert.ok(container.querySelector('.inspector-chart-markers'))
  assert.equal(localStorage.getItem('fyodor.inspector.shared.v1'), inspectorChoices)
  // A nearby-release chooser dismisses on blank chart clicks before selecting.
  await click(container.querySelector('[aria-label="2 nearby Inspector releases"]'))
  assert.equal(container.querySelectorAll('.inspector-marker-popup button').length, 3)
  await React.act(async () => { for (const handler of clickListeners) handler({ point: { x: 100, y: 100 } }) })
  assert.equal(container.querySelector('.inspector-marker-popup'), null)
  await click(container.querySelector('[aria-label="2 nearby Inspector releases"]'))
  await click(container.querySelector('.inspector-marker-popup .inspector-currency-USD').parentElement)
  await flush()
  assert.ok(container.querySelector('.inspector-panel'), 'Calendar symbols open Inspector first')
  assert.equal(container.querySelector('.inspector-pin'), null)
  await click(button('View in Alert')); await flush()
  assert.ok(container.querySelector('[aria-label="Alert"] [data-alert-focused="true"]'), 'View in Alert focuses the exact selected release')
  await click(button('Inspector'))
  const usdCount = events.filter(event => event.currency === 'USD' && event.actual !== null).length
  assert.equal(container.querySelectorAll('.inspector-panel tr[data-series-id]').length, usdCount)
  assert.equal(container.querySelector('[aria-label="Inspector view"]'), null, 'Legacy R1 preferences still open raw tables')
  assert.equal(container.querySelector('.inspector-histogram-btn'), null)
  assert.ok(container.querySelector('.inspector-panel').textContent.includes('Forecast'))
  // Save/Cancel retains the selection and shows the preview immediately.
  const savedBefore = localStorage.getItem('fyodor.inspector.eurusd.v1')
  const sharedBefore = localStorage.getItem('fyodor.inspector.shared.v1')
  await click(container.querySelector('[data-inspector-filter-trigger]'))
  assert.equal(document.querySelector('.inspector-symbol-toggle'), null, 'Visibility lives in the universal header button')
  const change = async (element, value) => React.act(async () => {
    assert.ok(element)
    const native = props(element)
    if (native) native.onChange({ target: { value } })
    else { element.value = value; element.dispatchEvent(new dom.Event('change', { bubbles: true })) }
  })
  await change(document.querySelector('[aria-label="Group Inspector symbols"]'), 'day')
  assert.ok(container.querySelector('.inspector-day-symbol'))
  await click([...document.querySelectorAll('dialog button')].find(node => node.textContent === 'Cancel'))
  assert.equal(localStorage.getItem('fyodor.inspector.eurusd.v1'), savedBefore)
  assert.equal(localStorage.getItem('fyodor.inspector.shared.v1'), sharedBefore)
  await click(container.querySelector('[data-inspector-filter-trigger]'))
  await change(document.querySelector('[aria-label="Group Inspector symbols"]'), 'day')
  await click([...document.querySelectorAll('dialog button')].find(node => node.textContent === 'Save'))
  await flush()
  const saved = JSON.parse(localStorage.getItem('fyodor.inspector.shared.v1')).pairs.EURUSD
  assert.equal(saved.symbolGrouping, 'day'); assert.equal(saved.detailView, undefined); assert.equal(saved.showHistograms, undefined)
  const dailyIcon = container.querySelector('.inspector-day-symbol.inspector-currency-USD')
  await click(dailyIcon)
  await flush()
  assert.ok(container.querySelector('.inspector-panel'), 'A daily symbol also opens Inspector first')
  await click(button('View in Alert')); await flush()
  assert.ok(container.querySelector('[aria-label="Alert"] [data-alert-focused="true"]'), 'View in Alert focuses a daily selection’s original publication')
  await click(button('Inspector'))
  assert.equal(container.querySelectorAll('.inspector-day-table tr[data-series-id]').length, Number(dailyIcon.textContent))
  assert.ok([...container.querySelectorAll('.inspector-day-table tr[data-series-id]')].every(row => row.querySelector('.inspector-day-time').textContent))
  // Current date range and anchor/QoL: twelve months before today, 90 after.
  await click(container.querySelector('[aria-label="Inspector date range"]'))
  assert.equal(document.querySelector('[aria-label="Days after anchor date"]').value, '90')
  const before = Number(document.querySelector('[aria-label="Days before anchor date"]').value)
  assert.ok(before === 365 || before === 366)
  await React.act(async () => window.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape' })))
  await React.act(async () => { for (const handler of clickListeners) handler({ point: { x: 100, y: 100 } }) })
  assert.equal(container.querySelector('.inspector-panel'), null, 'Blank chart deselects the icon and collapses Inspector')
  await click(dailyIcon)
  assert.ok(container.querySelector('.inspector-panel'))
  // Settings retains existing options, with no Workspace backup child.
  await click(button('Settings'))
  assert.ok(container.querySelector('[aria-label="Chart settings"]'))
  assert.equal(container.querySelector('.workspace-transfer'), null)
  assert.ok(!container.querySelector('[aria-label="Chart settings"]').textContent.includes('Workspace backup'))
  const grid = container.querySelector('.toggle-setting input')
  await React.act(async () => props(grid).onChange({ target: { checked: false } }))
  assert.equal(JSON.parse(localStorage.getItem('fyodor.chart-appearance.v1')).showGrid, false)
  await click(container.querySelector('[aria-label="Close chart settings"]'))
  // Polling/activity/viewport work never creates workers or resubmits unchanged data.
  reset()
  await React.act(async () => append('Application', 'Manual activity regression'))
  assert.equal(counters.workspace ?? 0, 0, 'Logging does not invalidate the workspace')
  assert.equal(counters.chartRender ?? 0, 0)
  reset(); await tick('poll', 2500); await reply('watch'); assertQuiet('Identical Market Watch quotes')
  const beforeFavouriteRequests = requests.length
  reset()
  await click(container.querySelector('[aria-label="Add TEST1 to favourites"]'))
  assert.equal(counters.quoteRows, 1, 'Starring a symbol renders only that row in the assembled terminal')
  assert.equal(counters.workspace ?? 0, 0); assert.equal(counters.chartRender ?? 0, 0)
  assert.equal(container.querySelector('.market-watch-row.selected strong').textContent, 'EURUSD', 'Starring does not change the active chart')
  const marketCategory = async value => React.act(async () => {
    const select = container.querySelector('select[aria-label="Symbol category filter"]')
    select.value = value
    select.dispatchEvent(new dom.Event('change', { bubbles: true }))
  })
  await marketCategory('favourites')
  assert.deepEqual([...container.querySelectorAll('.market-watch-row strong')].map(node => node.textContent), ['EURUSD', 'TEST1'])
  await click(container.querySelector('[aria-label="Remove TEST1 from favourites"]'))
  await marketCategory('all')
  assert.equal(requests.length, beforeFavouriteRequests, 'Favourite controls add no chart or polling requests')
  reset(); await tick('poll', 2000); await reply('ohlc'); assertQuiet('Identical candles')
  reset()
  await React.act(async () => { for (let i = 0; i < 200; i++) for (const notify of rangeListeners) notify() })
  await flush()
  assert.equal(counters.dailyGrouping ?? 0, 0); assert.equal(counters.futureSetData ?? 0, 0)
  const stableWindow = { ...logicalRange }
  await click(button('Alert'))
  assert.equal(container.querySelectorAll('[aria-label="Alert currency"] button').length, 9)
  assert.ok(container.querySelectorAll('.alert-event-table .alert-event-group').length > 0, 'The selected day has calendar and external event groups')
  await click([...container.querySelectorAll('.market-watch-row')].find(row => row.textContent.includes('TEST1')))
  while (pending.get('ohlc')?.length) await reply('ohlc')
  assert.deepEqual(logicalRange, stableWindow, 'Pair selection preserves date zoom/pan')
  assert.equal(container.querySelectorAll('[aria-label="Alert currency"] button').length, 9)
  reset()
  now += 1000
  await React.act(async () => { for (const timer of intervals.values()) if (timer.ms === 1000) timer.fn() })
  assertQuiet('Alert countdown', true)
  now -= 1000
  // Genuine price and calendar corrections continue to reach the UI.
  bars = bars.map((bar, i) => i === bars.length - 1 ? { ...bar, close: 1.17 } : bar)
  reset(); await tick('poll', 2000); await reply('ohlc')
  assert.equal(counters.update, 1); assert.equal(counters.futureSetData ?? 0, 0)
  assert.equal(plotted.at(-1).close, 1.17)
  await click(button('Activity'))
  assert.ok(container.querySelector('[aria-label="Activity log"]'))
  await click([...container.querySelectorAll('.market-watch-row')].find(row => row.textContent.includes('EURUSD')))
  while (pending.get('ohlc')?.length) await reply('ohlc')
  await flush()
  await click(container.querySelector('.inspector-day-symbol.inspector-currency-USD'))
  const id = events.find(event => event.currency === 'USD' && event.actual !== null).value_id
  events = events.map(event => event.value_id === id ? { ...event, actual: .8, revision: 2 } : event)
  calendarRevision++
  const poll = [...timers].find(([, timer]) => timer.fn.name === 'poll' && timer.ms === 10000)
  timers.delete(poll[0]); await React.act(async () => poll[1].fn())
  assert.match(container.querySelector('.inspector-day-table').textContent, /0.8%/)
  assert.match(container.querySelector('.inspector-day-table').textContent, /Revision 2/)
  const drawing = () => container.querySelector('.drawing-object')
  const drawingSvg = () => container.querySelector('.chart-drawing-overlay')
  const canvasForDrawing = container.querySelector('.market-chart-canvas')
  canvasForDrawing.getBoundingClientRect = () => ({ top: 200, left: 0, right: 900 })
  drawingSvg().getBoundingClientRect = () => ({ top: 200, left: 0 })
  async function pointer(element, type, x, y, shiftKey = false) {
    await React.act(async () => element.dispatchEvent(new dom.PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, clientX: x, clientY: y, shiftKey })))
  }
  await pointer(drawing(), 'pointerdown', 400, 310)
  assert.ok(drawing().classList.contains('selected'), 'The terminal selects a saved channel')
  await pointer(drawing(), 'pointerdown', 400, 310)
  await pointer(drawingSvg(), 'pointermove', 440, 315)
  await pointer(drawingSvg(), 'pointerup', 440, 315)
  assert.equal(captures.size, 0)
  const dragged = JSON.parse(localStorage.getItem('fyodor.chart-drawings.v1'))[0]
  assert.equal(dragged.points[0].time, now / 1000 - 5 * 3600 + 1800, 'Fractional body movement is persisted through terminal callbacks')
  assert.ok(Math.abs(dragged.points[0].price - 1.15) < 1e-9)
  assert.equal([...panListeners.values()].reduce((sum, listeners) => sum + listeners.size, 0), 0, 'Dragging drawings does not start chart panning')
  await pointer(canvasForDrawing, 'pointerdown', 100, 300)
  assert.ok(!drawing().classList.contains('selected'), 'Clicking blank chart space deselects drawings through the host capture handler')
  pointerPrices.length = 0
  const priorY = Number(drawing().querySelector('line').getAttribute('y1'))
  const postsBeforeDrawingPan = workerInputs.length
  await pointer(window, 'pointermove', 100, 315)
  assert.deepEqual(pointerPrices, [100, 115], 'Vertical pan converts client coordinates to chart-local coordinates')
  await React.act(async () => drawChartFrame())
  assert.ok(Math.abs(Number(drawing().querySelector('line').getAttribute('y1')) - priorY - 15) < 1e-9,
    'A vertical pan without a horizontal event updates the drawing in the same chart frame')
  await pointer(window, 'pointerup', 100, 315)
  assert.equal(workerInputs.length, postsBeforeDrawingPan, 'Drawing navigation never starts calculation workers')
  assert.deepEqual(JSON.parse(localStorage.getItem('fyodor.chart-drawings.v1'))[0], dragged, 'Chart pan preserves saved drawing anchors')
  const rectangleIcon = container.querySelector('[aria-label="Rectangle"] svg rect')
  assert.ok(rectangleIcon, 'The assembled drawing toolbar uses a real SVG rectangle icon')
  const postsBeforeText = workerInputs.length
  await click(container.querySelector('[aria-label="Text"]'))
  const sameOverlay = drawingSvg()
  await pointer(sameOverlay, 'pointerdown', 520, 315)
  assert.equal(drawingSvg(), sameOverlay, 'Exiting drawing mode does not remount the overlay and discard its editor state')
  let textInput = container.querySelector('[aria-label="Drawing text"]')
  assert.ok(textInput, 'Creating text in the real terminal opens an editable input after exiting drawing mode')
  await React.act(async () => props(textInput).onChange({ target: { value: 'Terminal annotation' } }))
  await React.act(async () => textInput.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
  let savedText = JSON.parse(localStorage.getItem('fyodor.chart-drawings.v1')).find(item => item.tool === 'text')
  assert.equal(savedText.text, 'Terminal annotation', 'Text commits through the assembled terminal callback and persists')
  const textDrawing = () => [...container.querySelectorAll('.drawing-object')].find(node => node.getAttribute('data-drawing-id') === savedText.id)
  await React.act(async () => textDrawing().dispatchEvent(new dom.MouseEvent('dblclick', { bubbles: true })))
  textInput = container.querySelector('[aria-label="Drawing text"]')
  assert.ok(textInput, 'Saved text can be reopened in the terminal')
  await React.act(async () => props(textInput).onChange({ target: { value: 'Edited annotation' } }))
  await React.act(async () => textInput.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
  savedText = JSON.parse(localStorage.getItem('fyodor.chart-drawings.v1')).find(item => item.tool === 'text')
  assert.equal(savedText.text, 'Edited annotation')
  assert.equal(workerInputs.length, postsBeforeText, 'Text creation and editing never launch calculation jobs')
  for (const [label, tool] of [['Trend line', 'trend-line'], ['Price note', 'price-note']]) {
    await click(container.querySelector(`[aria-label="${label}"]`))
    await pointer(drawingSvg(), 'pointerdown', 320, 310, true)
    await pointer(drawingSvg(), 'pointermove', 480, 350, true)
    await pointer(drawingSvg(), 'pointerup', 480, 350, true)
    const saved = JSON.parse(localStorage.getItem('fyodor.chart-drawings.v1')).find(item => item.tool === tool)
    assert.equal(saved.points[0].price, saved.points[1].price, `${label}: the assembled terminal saves Shift-constrained prices`)
  }
  assert.ok(container.querySelector('.drawing-note-background'), 'Price notes display a filled price tag in the assembled chart')
  await click(container.querySelector('[aria-label="Date and price range"]'))
  await pointer(drawingSvg(), 'pointerdown', 320, 310)
  await pointer(drawingSvg(), 'pointermove', 480, 320)
  assert.equal(container.querySelector('.drawing-draft .drawing-range-duration .drawing-range-label').textContent, '0d 2h 0m')
  await pointer(drawingSvg(), 'pointerup', 480, 320)
  assert.equal(container.querySelector('.drawing-range-pips .drawing-range-label').textContent, '1000.0 pips · +10.53%', 'The assembled range displays pips and percentage from its first anchor')
  // Opening data panels leaves chart state intact.
  const recentWindow={...logicalRange},recentDrawings=localStorage.getItem('fyodor.chart-drawings.v1')
  reset();await click(container.querySelector('[aria-label="Show events"]'));await flush()
  assert.ok(container.querySelector('.recent-events-panel'))
  assert.deepEqual(logicalRange,recentWindow);assert.equal(counters.setData??0,0)
  await click(container.querySelector('[aria-label="Hide events"]'));await flush()
  reset();await click(container.querySelector('[aria-label="Show Detail"]'));await flush()
  assertChartContainment()
  assert.deepEqual([...container.querySelectorAll('.ledger-categories thead th')].map(n=>n.textContent),['Category','EUR','USD'])
  assert.equal(container.querySelectorAll('.ledger-categories tbody > tr').length,4)
  assert.equal(container.querySelectorAll('.currency-detail-panel button').length,3)
  assert.deepEqual(logicalRange,recentWindow);assert.equal(counters.setData??0,0)
  await click(container.querySelector('[aria-label="Close Detail"]'));await flush()
  assertChartContainment()
  assert.equal(localStorage.getItem('fyodor.chart-drawings.v1'),recentDrawings)
  // Entry Trade uses the real shell, storage and chart callbacks.
  await click(button('Entry Trade'))
  const entryPanel = () => container.querySelector('[aria-label="Entry Trade"]')
  assert.ok(entryPanel())
  assert.equal(entryPanel().children.length, 3)
  const journal = () => entryPanel().querySelector('.entry-trade-journal-col')
  assert.equal(journal().children.length, 2, 'Journal has only its text box and Save action')
  assert.equal(journal().firstElementChild.tagName, 'TEXTAREA')
  assert.equal(entryPanel().querySelectorAll('textarea').length, 1, 'No workflow or context fields return')
  const pinButton = () => entryPanel().querySelector('.register-arrow-btn-compact')
  assert.ok(!pinButton().disabled, 'An empty journal entry can be saved')
  await click([...entryPanel().querySelectorAll('button')].find(node => node.textContent.trim() === 'Use Market'))
  assert.equal(entryPanel().querySelector('#plan-entry').value, String(Number(((quotes[0].ask + quotes[0].bid) / 2).toFixed(quotes[0].precision))))
  await change(entryPanel().querySelector('#plan-entry'), '1.1')
  await change(entryPanel().querySelector('#plan-sl'), '1.09')
  await change(entryPanel().querySelector('#plan-rr'), '2')
  assert.equal(entryPanel().querySelector('#plan-tp').value, '1.12', 'Target R:R calculates take profit')
  assert.ok(!pinButton().disabled)
  await click(button('Entry Trade'))
  await click(button('Entry Trade'))
  await change(entryPanel().querySelector('#plan-sl'), '1.08')
  assert.equal(entryPanel().querySelector('#plan-tp').value, '1.14', 'Closing the dock preserves the chosen target R:R')
  await change(entryPanel().querySelector('#plan-sl'), '1.09')
  await change(entryPanel().querySelector('#plan-sl'), '1.11')
  assert.ok(!pinButton().disabled, 'Journal records do not enforce execution completeness or stop orientation')
  await change(entryPanel().querySelector('#plan-sl'), '1.09')
  await click(entryPanel().querySelector('.header-chart-toggle input'))
  assert.deepEqual([...tradeLines].map(line => line.options.price), [1.1, 1.12, 1.09])
  const dragTrade = async (label, delta, finish = 'pointerup') => {
    const line = container.querySelector(`[aria-label="Drag ${label} price"]`)
    assert.ok(line, `${label} has a draggable chart line`)
    const svg = line.parentElement, clientY = Number(line.getAttribute('y1')) + 200
    await pointer(line, 'pointerdown', 400, clientY)
    const pendingFrames = frames.size
    reset()
    for (let i = 1; i <= 20; i++) await pointer(svg, 'pointermove', 400, clientY + delta * 100 * i / 20)
    assert.equal(frames.size, pendingFrames + 2, 'Line preview and native-crosshair forwarding each batch a pointer burst into one frame')
    assert.equal(counters.tradeLineUpdates ?? 0, 0)
    const savedBefore = localStorage.getItem('fyodor.registered_arrows.v1')
    await flush()
    assert.equal(counters.tradeLineUpdates, 1, 'One frame previews one line')
    assertQuiet('Price-line drag preview', true)
    assert.equal(localStorage.getItem('fyodor.registered_arrows.v1'), savedBefore, 'Preview does not persist partial changes')
    await pointer(svg, finish, 400, clientY + delta * 100)
    assert.equal(captures.size, 0)
  }
  await dragTrade('Entry', .001)
  assert.equal(entryPanel().querySelector('#plan-entry').value, '1.101')
  await dragTrade('Take Profit', .002)
  assert.equal(entryPanel().querySelector('#plan-tp').value, '1.122')
  await dragTrade('Stop Loss', -.001, 'pointercancel')
  assert.equal(entryPanel().querySelector('#plan-sl').value, '1.09', 'Cancelling a drag restores its original price')
  await change(entryPanel().querySelector('#plan-entry'), '1.1')
  await change(entryPanel().querySelector('#plan-tp'), '1.12')
  reset()
  await change(journal().querySelector('textarea'), 'EURUSD trade thesis')
  assertQuiet('Writing Entry Trade journal', true)
  assert.notEqual(localStorage.getItem('trader_notebook_note_EURUSD'), 'EURUSD trade thesis', 'Typing does not save automatically')
  await click(journal().querySelector('button'))
  assert.equal(localStorage.getItem('trader_notebook_note_EURUSD'), 'EURUSD trade thesis')
  await click(pinButton())
  const storedArrow = JSON.parse(localStorage.getItem('fyodor.registered_arrows.v1'))[0]
  assert.equal(storedArrow.note, 'EURUSD trade thesis')
  assert.equal(storedArrow.symbol, 'EURUSD')
  assert.equal(storedArrow.time, bars.at(-1).time)
  assert.ok(Math.abs(storedArrow.rrRatio - 2) < 1e-9)
  assert.equal(storedArrow.workflow, undefined)
  assert.equal(entryPanel().querySelectorAll('.pinned-arrow-row').length, 1)
  assert.ok(!entryPanel().querySelector('#plan-entry').readOnly, 'Pinned journal levels remain editable')
  const pinnedMarker = [...tradeMarkers].flat().find(marker => marker.id === storedArrow.id)
  assert.ok(pinnedMarker, 'Pinning draws an arrow on the actual chart boundary')
  const dragDate = async (id, dx, finish = 'pointerup') => {
    const handle = container.querySelector(`.trade-arrow-handle[data-arrow-id="${id}"]`)
    assert.ok(handle, 'Pinned arrow has a draggable date target')
    const svg = handle.parentElement, x = Number(handle.getAttribute('x')) + 9 + 200
    await pointer(handle, 'pointerdown', x, 100)
    const pendingFrames = frames.size, before = localStorage.getItem('fyodor.registered_arrows.v1')
    reset()
    for (let i = 1; i <= 20; i++) await pointer(svg, 'pointermove', x + dx * i / 20, 350)
    assert.equal(frames.size, pendingFrames + 2, 'Arrow date preview and native hover each coalesce into one frame')
    assert.equal(counters.tradeMarkerUpdates ?? 0, 0)
    await flush()
    assert.equal(counters.tradeMarkerUpdates, 1)
    assertQuiet('Dragging an arrow date', true)
    assert.equal(localStorage.getItem('fyodor.registered_arrows.v1'), before, 'Date previews do not rewrite saved records')
    await pointer(svg, finish, x + dx, 350)
    assert.equal(captures.size, 0)
  }
  const originalDate = entryPanel().querySelector('.pinned-date').textContent
  await dragDate(storedArrow.id, -160)
  const redatedArrow = JSON.parse(localStorage.getItem('fyodor.registered_arrows.v1'))[0]
  assert.deepEqual(redatedArrow, { ...storedArrow, time: bars.at(-3).time }, 'Dragging changes only the date and snaps to the target candle')
  assert.equal(entryPanel().querySelector('.pinned-date').textContent, originalDate, 'Dragging an arrow never changes the event date in the table')
  assert.equal([...tradeMarkers].flat().find(marker => marker.id === storedArrow.id).time, redatedArrow.time)
  await dragDate(storedArrow.id, 80, 'pointercancel')
  assert.equal(JSON.parse(localStorage.getItem('fyodor.registered_arrows.v1'))[0].time, redatedArrow.time, 'Cancelling a date drag keeps the saved date')
  await dragTrade('Stop Loss', -.005)
  const draggedArrow = JSON.parse(localStorage.getItem('fyodor.registered_arrows.v1'))[0]
  assert.equal(draggedArrow.slPrice, 1.085, 'Pinned price-line changes persist on release')
  assert.ok(Math.abs(draggedArrow.rrRatio - 4 / 3) < 1e-9)
  await dragTrade('Stop Loss', .03)
  assert.equal(JSON.parse(localStorage.getItem('fyodor.registered_arrows.v1'))[0].slPrice, 1.115, 'Journal records accept manually chosen levels without execution validation')
  await change(entryPanel().querySelector('#plan-sl'), '1.085')
  reset()
  await tick('poll', 2500); await reply('watch')
  assertQuiet('Unchanged quote poll with a pinned trade')
  await click(button('Alert'))
  assert.equal(entryPanel(), null)
  assert.ok([...tradeMarkers].flat().some(marker => marker.id === storedArrow.id), 'Chart pins remain while the dock is hidden')
  await React.act(async () => { for (const handler of [...clickListeners]) handler({ hoveredInfo: { objectId: storedArrow.id }, point: { x: 100, y: 100 } }) })
  assert.ok(entryPanel(), 'Clicking a chart arrow opens Entry Trade')
  assert.equal(journal().querySelector('textarea').value, 'EURUSD trade thesis', 'Journal survives closing and reopening')
  await click(entryPanel().querySelector('.new-draft-btn-compact'))
  assert.ok(!entryPanel().querySelector('#plan-entry').readOnly)
  await click(entryPanel().querySelector('.pinned-arrow-row'))
  assert.equal(entryPanel().querySelector('#plan-entry').value, '1.1', 'Pinned row selects its editable stored levels')
  await click(entryPanel().querySelector('.pinned-delete-btn'))
  assert.deepEqual(JSON.parse(localStorage.getItem('fyodor.registered_arrows.v1')), [])
  assert.equal([...tradeMarkers].flat().length, 0)
  await click(entryPanel().querySelector('.new-draft-btn-compact'))
  await click([...entryPanel().querySelectorAll('button')].find(node => node.textContent.trim() === 'SHORT (SELL)'))
  await change(entryPanel().querySelector('#plan-entry'), '1.1')
  await change(entryPanel().querySelector('#plan-sl'), '1.11')
  await change(entryPanel().querySelector('#plan-rr'), '3')
  assert.equal(entryPanel().querySelector('#plan-tp').value, '1.07', 'Short plans calculate take profit below entry')
  await click(pinButton())
  assert.equal(JSON.parse(localStorage.getItem('fyodor.registered_arrows.v1'))[0].direction, 'short')
  const switchSymbol = async symbol => {
    await click([...container.querySelectorAll('.market-watch-row')].find(node => node.textContent.includes(symbol)))
    while (pending.get('ohlc')?.length) await reply('ohlc')
    await flush()
  }
  await switchSymbol('TEST1')
  assert.equal(entryPanel().querySelector('#plan-entry').value, '')
  assert.equal(entryPanel().querySelectorAll('.pinned-arrow-row').length, 1, 'The table includes every pair')
  assert.equal(entryPanel().querySelector('.pinned-pair').textContent, 'EURUSD')
  assert.equal(journal().querySelector('textarea').value, '')
  await change(journal().querySelector('textarea'), 'Other symbol note')
  await click(journal().querySelector('button'))
  await click([...entryPanel().querySelectorAll('button')].find(node => node.textContent.trim() === 'WAITING'))
  assert.ok(entryPanel().querySelector('[placeholder="SL Pips"]').disabled, 'Waiting has no implied price side until levels are set')
  await change(entryPanel().querySelector('#plan-entry'), '1.1')
  await change(entryPanel().querySelector('#plan-sl'), '1.09')
  await change(entryPanel().querySelector('#plan-rr'), '2')
  assert.equal(entryPanel().querySelector('#plan-tp').value, '1.12')
  await click(pinButton())
  const waitingArrow = JSON.parse(localStorage.getItem('fyodor.registered_arrows.v1'))[0]
  assert.equal(waitingArrow.direction, 'waiting')
  assert.equal([...tradeMarkers].flat().find(marker => marker.id === waitingArrow.id).shape, 'square')
  assert.equal(entryPanel().querySelectorAll('.pinned-arrow-row').length, 2)
  await change(journal().querySelector('textarea'), 'Waiting setup note')
  await click(journal().querySelector('button'))
  await click([...entryPanel().querySelectorAll('button')].find(node => node.textContent.trim() === 'LONG (BUY)'))
  assert.equal(JSON.parse(localStorage.getItem('fyodor.registered_arrows.v1')).find(arrow => arrow.id === waitingArrow.id).direction, 'long', 'A waiting pin can become a directional setup')
  await click([...entryPanel().querySelectorAll('button')].find(node => node.textContent.trim() === 'WAITING'))
  const pendingLine = container.querySelector('[aria-label="Drag Entry price"]'), pendingSvg = pendingLine.parentElement
  await pointer(pendingLine, 'pointerdown', 400, 200)
  await pointer(pendingSvg, 'pointermove', 400, 201)
  await React.act(async () => window.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape' })))
  assert.equal(captures.size, 0, 'Escape releases drag capture')
  assert.equal(JSON.parse(localStorage.getItem('fyodor.registered_arrows.v1')).find(arrow => arrow.id === waitingArrow.id).entryPrice, 1.1)
  await pointer(pendingLine, 'pointerdown', 400, 200)
  await pointer(pendingSvg, 'pointermove', 400, 201)
  await click([...entryPanel().querySelectorAll('.pinned-arrow-row')].find(node => node.querySelector('.pinned-pair').textContent === 'EURUSD'))
  while (pending.get('ohlc')?.length) await reply('ohlc')
  await flush()
  assert.equal(captures.size, 0, 'Changing pair during a drag cancels and releases capture')
  assert.equal(JSON.parse(localStorage.getItem('fyodor.registered_arrows.v1')).find(arrow => arrow.id === waitingArrow.id).entryPrice, 1.1, 'A stale drag cannot change the previous pair')
  assert.equal(entryPanel().querySelector('.entry-trade-symbol-title').textContent, 'EURUSD', 'Selecting another pair switches its chart')
  assert.equal([...entryPanel().querySelectorAll('.pinned-arrow-row')].find(row => row.querySelector('.pinned-pair').textContent === 'TEST1').children[3].textContent, '1.100', 'Each pair keeps its own price precision')
  assert.equal(journal().querySelector('textarea').value, 'EURUSD trade thesis')
  await change(journal().querySelector('textarea'), 'Pinned EURUSD note')
  assert.equal(JSON.parse(localStorage.getItem('fyodor.registered_arrows.v1')).find(arrow => arrow.symbol === 'EURUSD').note, 'EURUSD trade thesis')
  await click(journal().querySelector('button'))
  assert.equal(JSON.parse(localStorage.getItem('fyodor.registered_arrows.v1')).find(arrow => arrow.symbol === 'EURUSD').note, 'Pinned EURUSD note')
  assert.equal(JSON.parse(localStorage.getItem('fyodor.registered_arrows.v1')).find(arrow => arrow.symbol === 'TEST1').note, 'Waiting setup note', 'Saving one arrow never edits another')
  const firstEurArrow = JSON.parse(localStorage.getItem('fyodor.registered_arrows.v1')).find(arrow => arrow.symbol === 'EURUSD')
  await click(entryPanel().querySelector('.new-draft-btn-compact'))
  assert.equal(journal().querySelector('textarea').value, 'EURUSD trade thesis', 'Pinned note edits do not overwrite the draft')
  await click(pinButton())
  const secondEurArrow = JSON.parse(localStorage.getItem('fyodor.registered_arrows.v1'))[0]
  assert.notEqual(secondEurArrow.id, firstEurArrow.id)
  await change(journal().querySelector('textarea'), 'Second EURUSD note')
  await click(journal().querySelector('button'))
  await click(entryPanel().querySelector(`[data-arrow-id="${firstEurArrow.id}"]`))
  assert.equal(journal().querySelector('textarea').value, 'Pinned EURUSD note', 'Two arrows on the same pair have independent notes')
  await change(journal().querySelector('textarea'), 'Unsaved EURUSD edit')
  await switchSymbol('TEST1')
  assert.equal(journal().querySelector('textarea').value, 'Other symbol note', 'The unselected draft has its own journal')
  await click([...entryPanel().querySelectorAll('.pinned-arrow-row')].find(node => node.querySelector('.pinned-pair').textContent === 'TEST1'))
  assert.equal(journal().querySelector('textarea').value, 'Waiting setup note')
  await click(entryPanel().querySelector(`[data-arrow-id="${firstEurArrow.id}"]`))
  while (pending.get('ohlc')?.length) await reply('ohlc')
  await flush()
  assert.equal(journal().querySelector('textarea').value, 'Unsaved EURUSD edit', 'Unsaved edits survive changing arrows')
  await click(journal().querySelector('button'))
  for (const row of [...entryPanel().querySelectorAll('.pinned-arrow-row')]) await click(row.querySelector('.pinned-delete-btn'))
  await click(button('Alert'))
  // Shared dock height persists across dock switches.
  const handle = container.querySelector('[role="separator"]')
  await React.act(async () => handle.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })))
  const height = localStorage.getItem('fyodor.bottom-dock.height.v2')
  await click(button('Alert'))
  assert.equal(localStorage.getItem('fyodor.bottom-dock.height.v2'), height)
  await click(button('Alert'))
  // The real toolbar counts/deletes only its current pair. A confirmation
  // opened on another pair must close when the selected pair changes.
  const drawingsBeforeClear = JSON.parse(localStorage.getItem('fyodor.chart-drawings.v1'))
  const eurDrawings = drawingsBeforeClear.filter(drawing => drawing.symbol === 'EURUSD')
  const trash = () => container.querySelector('.drawing-toolbar-trash')
  await click(trash())
  assert.equal(trash().getAttribute('aria-label'), 'Delete EURUSD drawings')
  assert.ok(container.querySelector('.drawing-delete-popover').textContent.includes(`${eurDrawings.length} saved EURUSD`))
  await click([...container.querySelectorAll('.market-watch-row')].find(row => row.textContent.includes('TEST1')))
  while (pending.get('ohlc')?.length) await reply('ohlc')
  await flush()
  assert.equal(container.querySelector('.drawing-delete-popover'), null, 'Changing pairs cancels the previous confirmation')
  assert.equal(trash().getAttribute('aria-label'), 'Delete TEST1 drawings')
  await click(trash())
  assert.ok(container.querySelector('.drawing-delete-popover').textContent.includes('2 saved TEST1 drawings across all timeframes'))
  await click([...container.querySelectorAll('.drawing-delete-popover button')].find(node => node.textContent === 'Cancel'))
  assert.deepEqual(JSON.parse(localStorage.getItem('fyodor.chart-drawings.v1')), drawingsBeforeClear, 'Cancel leaves every pair intact')
  await click(trash())
  await click(container.querySelector('.confirm-delete'))
  const retainedDrawings = drawingsBeforeClear.filter(drawing => drawing.symbol !== 'TEST1')
  assert.deepEqual(JSON.parse(localStorage.getItem('fyodor.chart-drawings.v1')), retainedDrawings,
    'Deleting TEST1 across H1/D1 preserves EURUSD and TEST2 records exactly')
  assert.equal(container.querySelectorAll('.drawing-object').length, 0)
  assert.equal(trash().disabled, true, 'The empty pair cannot delete drawings from other pairs')
  await click([...container.querySelectorAll('.market-watch-row')].find(row => row.textContent.includes('EURUSD')))
  while (pending.get('ohlc')?.length) await reply('ohlc')
  await flush()
  assert.equal(container.querySelectorAll('.drawing-object').length, eurDrawings.length, 'Returning to EURUSD retains its drawings')
  assert.equal(trash().disabled, false)
  // Real drawing gesture -> broker-scoped alert store -> native line -> live quote
  // trigger, while ordinary drawing storage and the shared viewport stay intact.
  const ordinaryDrawings = localStorage.getItem('fyodor.chart-drawings.v1')
  const alertWindow = { ...logicalRange }
  await click(container.querySelector('[aria-label="Price alert"]'))
  assert.equal(button('Price Alerts').getAttribute('aria-pressed'), 'true')
  const soundCheckbox = container.querySelector('.price-alert-controls input[type="checkbox"]')
  await click(soundCheckbox) // Audio scheduling is verified separately with a Web Audio fixture.
  await pointer(drawingSvg(), 'pointerdown', 320, drawingSvg().getBoundingClientRect().top + 1.3 * 100 + priceShift)
  await flush()
  const priceAlertKey = 'fyodor.price-alerts.v1'
  const createdAlert = JSON.parse(localStorage.getItem(priceAlertKey)).alerts[0]
  assert.equal(createdAlert.symbol, 'EURUSD')
  assert.equal(createdAlert.brokerId, broker)
  assert.equal(createdAlert.price, 1.3)
  assert.equal(createdAlert.status, 'armed')
  assert.ok([...tradeLines].some(line => line.options.price === 1.3 && line.options.title.includes('Price alert')))
  assert.equal(localStorage.getItem('fyodor.chart-drawings.v1'), ordinaryDrawings)
  assert.deepEqual(logicalRange, alertWindow)
  reset(); await tick('poll', 2500); await reply('watch')
  assertQuiet('Unchanged quotes with armed price alert', true)
  await React.act(async () => container.querySelector('.price-alert-title').dispatchEvent(new dom.MouseEvent('dblclick', { bubbles: true })))
  await change(container.querySelector('[aria-label="Alert name for EURUSD"]'), 'London level')
  await React.act(async () => container.querySelector('.price-alert-row form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(JSON.parse(localStorage.getItem(priceAlertKey)).alerts[0].name, 'London level')
  assert.ok([...tradeLines].some(line => line.options.title.includes('London level')))
  const beforeAlertSelection = localStorage.getItem(priceAlertKey)
  await click(container.querySelector('.price-alert-summary')); await flush()
  assert.ok(container.querySelector('.price-alert-row.selected'))
  assert.ok([...tradeLines].some(line => line.options.title.includes('London level') && line.options.color === '#0891b2'), 'Selecting a row highlights its line through the production overlay composition')
  assert.equal(localStorage.getItem(priceAlertKey), beforeAlertSelection)
  assert.deepEqual(logicalRange, alertWindow, 'Selecting an alert preserves the shared date viewport')
  assert.equal(container.querySelector('.price-alert-group-title span').textContent, 'EURUSD')
  const alertHandle = () => container.querySelector('.price-alert-handle')
  const alertSvg = () => container.querySelector('.price-alert-handles')
  await pointer(alertHandle(), 'pointerdown', 320, 1.3 * 100 + priceShift)
  const beforeAlertPreview = localStorage.getItem(priceAlertKey)
  await pointer(alertSvg(), 'pointermove', 320, 1.4 * 100 + priceShift); await flush()
  assert.equal(localStorage.getItem(priceAlertKey), beforeAlertPreview, 'Alert previews do not write local storage')
  await pointer(alertSvg(), 'pointerup', 320, 1.4 * 100 + priceShift); await flush()
  assert.equal(JSON.parse(localStorage.getItem(priceAlertKey)).alerts[0].price, 1.4, 'Dragging through the assembled shell saves the target')
  assert.deepEqual(logicalRange, alertWindow, 'Dragging an alert does not pan the chart')
  assert.equal([...panListeners.values()].reduce((sum, listeners) => sum + listeners.size, 0), 0)
  assert.equal(captures.size, 0)
  reset(); await tick('poll', 2500); await reply('watch')
  assertQuiet('First unchanged snapshot after an alert edit')
  assert.ok((counters.workspace ?? 0) <= 1, 'React may settle an edit with one shell invocation; chart and quote work remain zero')
  reset(); await tick('poll', 2500); await reply('watch')
  assertQuiet('Settled unchanged quotes after dragging an alert', true)
  await click(button('Market Watch'))
  await switchSymbol('TEST1')
  assert.ok(![...tradeLines].some(line => line.options.title?.includes('London level')), 'Other symbols hide the line')
  quotes[0] = { ...quotes[0], bid: 1.41 }
  await tick('poll', 2500); await reply('watch'); await flush()
  assert.equal(JSON.parse(localStorage.getItem(priceAlertKey)).alerts[0].status, 'triggered', 'Alerts monitor while viewing another chart and dock')
  await click(button('Price Alerts'))
  assert.ok(container.querySelector('.price-alert-row.triggered'))
  await click(container.querySelector('.price-alert-row.triggered .price-alert-summary'))
  while (pending.get('ohlc')?.length) await reply('ohlc')
  await flush()
  assert.equal(container.querySelector('.market-title-row h1').textContent, 'EURUSD', 'Clicking an alert block opens its chart')
  assert.ok([...tradeLines].some(line => line.options.title.includes('London level') && line.options.price === 1.4 && line.options.color === '#9333ea'), 'The selected triggered line remains at its saved price in purple')
  assert.equal(container.querySelector('.price-alert-details'), null, 'Clicking alert rows never expands controls')
  await click(container.querySelector('.price-alert-row.triggered [aria-label^="Delete "]'))
  assert.deepEqual(JSON.parse(localStorage.getItem(priceAlertKey)).alerts, [])
  await click([...container.querySelectorAll('.price-alert-controls button')].find(node => node.textContent.includes('New price alert')))
  await pointer(drawingSvg(), 'pointerdown', 320, drawingSvg().getBoundingClientRect().top + 1.5 * 100 + priceShift)
  await flush()
  assert.equal(container.querySelectorAll('.price-alert-row').length, 1)
  await React.act(async () => alertHandle().dispatchEvent(new dom.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })))
  await flush()
  assert.deepEqual(JSON.parse(localStorage.getItem(priceAlertKey)).alerts, [], 'Right-click deletes through the production chart composition')
  assert.equal(container.querySelector('.price-alert-row'), null)
  assert.equal(alertHandle(), null)
  assert.ok(![...tradeLines].some(line => line.options.title?.includes('Price alert')))
  assert.equal(localStorage.getItem('fyodor.chart-drawings.v1'), ordinaryDrawings, 'Right-clicking alerts preserves ordinary drawings')
  assert.deepEqual(logicalRange, alertWindow, 'Right-click deletion preserves the shared viewport')
  await click(button('Market Watch'))
  quotes[0] = { ...quotes[0], bid: 1.1 }
  await tick('poll', 2500); await reply('watch')
  await switchSymbol('EURUSD')
  // Exercise new instrument scopes through the assembled shell, live quote
  // adapter, stored-calendar API and real production overlay composition.
  const instrumentScopes = { JPYX: 'JPY', EURX: 'EUR', USDX: 'USD', JPN225: 'JPY', XAUUSD: 'USD' }
  for (const currency of ['JPY', 'EUR']) {
    const meta = catalog.find(row => row.country_currency === currency && /CPI/.test(row.event_name))
    assert.ok(meta)
    events.push(event(meta.event_id, now - 2 * 3600000))
  }
  calendarRevision++
  quotes = [...quotes, ...Object.keys(instrumentScopes).map(symbol => ({ ...quotes[0], symbol, description: symbol }))]
  await tick('poll', 2500); await reply('watch'); await flush()
  await marketCategory('currency-indices')
  assert.deepEqual([...container.querySelectorAll('.market-watch-row strong')].map(node => node.textContent), ['JPYX', 'EURX', 'USDX'])
  await marketCategory('all')
  localStorage.removeItem('fyodor.inspector.shared.v1')
  if (!container.querySelector('.inspector-panel')) await click(button('Inspector'))
  await click(container.querySelector('[aria-label="Hide event icons"]'))
  for (const [symbol, currency] of Object.entries(instrumentScopes)) {
    const windowBefore = { ...logicalRange }
    await click([...container.querySelectorAll('.market-watch-row')].find(row => row.querySelector('strong').textContent === symbol))
    while (pending.get('ohlc')?.length) await reply('ohlc')
    await flush()
    assert.equal(container.querySelector('[aria-label="Hide RSI"]').getAttribute('aria-pressed'), 'true', 'Shared RSI stays enabled across symbols')
    assert.equal(panes.length, 2, 'Symbol changes reuse the RSI pane')
    if (symbol === 'JPYX') {
      assert.equal(container.querySelector('.inspector-chart-markers'), null, 'Global hide survives switching from a pair to an index')
      await click(container.querySelector('[aria-label="Show event icons"]')); await flush()
    }
    assert.deepEqual(logicalRange, windowBefore, `${symbol}: the shared date viewport survives symbol changes`)
    assert.equal(container.querySelector('[data-inspector-filter-trigger]').disabled, false)
    const latestQuery = requests.filter(url => url.startsWith('/storage-api/calendar')).at(-1)
    assert.equal(new URL(latestQuery, 'http://localhost').searchParams.get('currencies'), currency)
    assert.ok(container.querySelector(`.inspector-chart-markers .inspector-currency-${currency}`), `${symbol}: mapped currency icons appear in the assembled chart`)
    assert.equal(container.querySelector('.inspector-chart-markers .inspector-currency-GBP'), null)
    reset(); await tick('poll', 2500); await reply('watch')
    assertQuiet(`${symbol}: unchanged Market Watch poll`, true)
    assert.equal(counters.dailyGrouping ?? 0, 0, `${symbol}: stable scope arrays avoid calendar regrouping`)
    if (symbol === 'USDX') {
      const release = events.find(row => row.event_id === '840030005' && row.actual !== null && row.release_at <= now)
      const companion = events.find(row => row.event_id === '840030006' && row.release_at === release.release_at)
      const savedFilters = localStorage.getItem('fyodor.inspector.shared.v1'), savedWindow = { ...logicalRange }
      await React.act(async () => globalThis.__terminalProbe.inspectMacro({ id: release.value_id,
        time: release.chart_time_seconds, releasedAt: release.release_at, value: release.actual }))
      await flush()
      assert.ok(container.querySelector('.inspector-panel'), 'An MFDI dot opens the Inspector bottom dock')
      assert.ok(container.querySelector(`[data-value-id="${release.value_id}"][data-ledger-focused="true"]`), 'The exact clicked source value is highlighted')
      assert.ok(container.querySelector(`[data-value-id="${companion.value_id}"]`), 'The entire CPI package accompanies the selected measure')
      assert.ok(![...container.querySelectorAll('.inspector-header button')].some(node => node.textContent === 'Return to Ledger'))
      await React.act(async () => globalThis.__terminalProbe.inspectMacro({ id: companion.value_id,
        time: companion.chart_time_seconds, releasedAt: companion.release_at, value: companion.actual }))
      await flush()
      assert.ok(container.querySelector(`[data-value-id="${companion.value_id}"][data-ledger-focused="true"]`), 'Another dot replaces the prior focused measure')
      assert.equal(localStorage.getItem('fyodor.inspector.shared.v1'), savedFilters)
      assert.deepEqual(logicalRange, savedWindow, 'Inspector navigation preserves the chart window')
      await React.act(async () => { for (const listener of [...clickListeners]) listener({ point: { x: 100, y: 100 }, paneIndex: 0 }) })
      await flush()
      assert.equal(container.querySelector('.inspector-panel'), null, 'A subsequent blank-chart click dismisses inspection')
      await click(button('Inspector')); await flush()
    }
  }
  await click(container.querySelector('[aria-label="Hide event icons"]'))
  assert.equal(container.querySelector('[aria-label="Hide left panel"]'), null, 'The left panel has no redundant close button')
  const drawingsBeforeRefocus = localStorage.getItem('fyodor.chart-drawings.v1')
  logicalRange = { from: plotted.length + 100, to: plotted.length + 130 }
  reset(); await click(container.querySelector('[aria-label="Refocus chart"]')); await flush()
  assert.deepEqual(logicalRange, { from: plotted.length - 23, to: plotted.length + 7 }, 'Header Refocus returns to actual candles and retains the 30-bar zoom')
  for (const key of ['chartCreated', 'setData', 'update', 'futureSetData', 'priceSpaceSeed', 'rsiCandle', 'rsiSetData', 'rsiUpdate'])
    assert.equal(counters[key] ?? 0, 0, `Refocus performs no ${key} work`)
  assert.equal(localStorage.getItem('fyodor.chart-drawings.v1'), drawingsBeforeRefocus, 'Refocus leaves saved drawing anchors unchanged')
  await click(container.querySelector('.market-watch-toggle'))
  assert.equal(container.querySelector('.left-dock').hidden, true)
  await click(container.querySelector('.market-watch-toggle'))
  assert.equal(container.querySelector('.left-dock').hidden, false)
  assert.equal(container.querySelector('[data-currency-summary]'), null, 'Retired Fundamentals stays absent after reopening')
  await click(button('Wildcards'))
  assert.equal(container.querySelectorAll('[data-news-story]').length,0,'Manual news starts empty when reopened')
  await click(button('Wildcards'))
  // The supported Ledger shares its cutoff with the right Detail without
  // making chart ticks, viewport work or calendar selections depend on that clock.
  quotes = [...quotes, { ...quotes[0], symbol: 'USDCAD', description: 'USD / CAD' }]
  await tick('poll', 2500); await reply('watch'); await flush()
  await switchSymbol('USDCAD')
  for(const [id,valueId] of [['840030007','usd.cpi-yoy'],['840030005','usd.cpi-mom']]) {
    events.push({...event(id,now-86400000,4,4),value_id:valueId})
  }
  calendarRevision++
  const ledgerViewportBefore = { ...logicalRange }, ledgerDrawingsBefore = localStorage.getItem('fyodor.chart-drawings.v1')
  reset(); await click(button('Ledger')); await flush()
  assert.ok(container.querySelector('[aria-label="Open CAD developments"]'))
  assertQuiet('Opening supported Ledger')
  await click(container.querySelector('[aria-label="Open CAD developments"]')); await flush()
  assert.equal(container.querySelector('#currency-detail-title').textContent, 'Detail')
  assert.ok(container.querySelector('[data-ledger-category="CAD-policy"]'))
  assert.equal(container.querySelector('.detail-ledger-tabs'), null)
  assert.doesNotMatch(container.querySelector('.ledger-detail').textContent, /\/100|Momentum|Scoring rules|Contribution:|scored categories/)

  assert.deepEqual(logicalRange, ledgerViewportBefore, 'Opening Ledger Detail preserves the chart viewport')
  reset()
  const ledgerResize=container.querySelector('[aria-label="Resize Ledger dock"]')
  const resizeCaptures=new Set()
  ledgerResize.setPointerCapture=id=>resizeCaptures.add(id)
  ledgerResize.hasPointerCapture=id=>resizeCaptures.has(id)
  ledgerResize.releasePointerCapture=id=>resizeCaptures.delete(id)
  await React.act(async()=>props(ledgerResize).onPointerDown({button:0,pointerId:91,clientY:500,currentTarget:ledgerResize,preventDefault(){}}))
  for(let i=0;i<40;i++) await React.act(async()=>props(ledgerResize).onPointerMove({pointerId:91,clientY:500-i*3,currentTarget:ledgerResize}))
  await React.act(async()=>props(ledgerResize).onPointerUp({pointerId:91,currentTarget:ledgerResize}))
  assert.equal(counters.ledgerTimeline??0,0,'Forty dock resize updates never repaint the date tape')
  assertQuiet('Ledger dock resize')
  reset()
  const ledgerInput = container.querySelector('[aria-label="Ledger as-of date"]')
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype,'value').set.call(ledgerInput,'2026-09-09')
    ledgerInput.dispatchEvent(new dom.Event('input',{bubbles:true}))
    ledgerInput.dispatchEvent(new dom.Event('change',{bubbles:true}))
  })
  assertQuiet('Ledger historical cutoff', true)
  assert.match(container.querySelector('[data-ledger-category="CAD-policy"]').textContent, /—/)
  const filtersButton=container.querySelector('[aria-label="Ledger filters"]')
  assert.equal(filtersButton.nextElementSibling.getAttribute('aria-label'),'Pick Ledger date from a chart candle')
  const filtersBefore=localStorage.getItem('fyodor.inspector.shared.v1'),cutoffBeforeFilter=ledgerInput.value,requestsBeforeFilter=requests.length
  reset();await click(filtersButton)
  const filterPopover=()=>document.querySelector('.ledger-filters-popover')
  await click([...filterPopover().querySelectorAll('button')].find(n=>n.textContent==='All events'))
  assertQuiet('Ledger family preview',true)
  assert.equal(ledgerInput.value,cutoffBeforeFilter)
  assert.equal(requests.length,requestsBeforeFilter,'Visibility filtering never fetches history')
  await click([...filterPopover().querySelectorAll('button')].find(n=>n.textContent==='Cancel'))
  assert.equal(filterPopover(),null)
  assert.equal(localStorage.getItem('fyodor.inspector.shared.v1'),filtersBefore,'Ledger filters never rewrite Inspector preferences')
  const ledgerRequestCount = requests.length
  await React.act(async () => { for (let i=0;i<100;i++) container.querySelector('.ledger-viewport').dispatchEvent(new dom.Event('scroll')) })
  await flush()
  assert.equal(requests.length,ledgerRequestCount)
  assertQuiet('Ledger tape scrolling', true)
  await tick('pollLedger',30000)
  assertQuiet('Ledger local clock / unchanged poll', true)
  assert.equal(ledgerInput.value,'2026-09-09')
  assert.equal(localStorage.getItem('fyodor.chart-drawings.v1'),ledgerDrawingsBefore)
  const pickerButton=container.querySelector('[aria-label="Pick Ledger date from a chart candle"]')
  assert.equal(pickerButton.nextElementSibling.textContent,'Today','Cursor sits immediately left of Today')
  assert.equal(pickerButton.textContent.trim(),'⌖')
  reset();await click(pickerButton)
  assertQuiet('Arming Ledger candle picker',true)
  assert.equal(pickerButton.getAttribute('aria-pressed'),'true')
  assert.equal(container.querySelector('.ledger-candle-picker'),null,'No overlay intercepts native crosshair movement')
  assert.equal(chart.chartElement().dataset.ledgerPicking,'true')
  const pickAt=async(x=100,y=50)=>React.act(async()=>{
    for(const listener of [...clickListeners]) listener({point:{x,y},time:ledgerPickTime,paneIndex:y>=420?1:0})
  })
  ledgerPickTime=Number(bars.at(-1).time)+86400
  await pickAt()
  assert.equal(ledgerInput.value,'2026-09-09','Future whitespace cannot select a date')
  assert.equal(chart.chartElement().dataset.ledgerPicking,'true')
  ledgerPickTime=Number(bars.at(-10).time)
  await pickAt(950,50);await pickAt(100,500)
  assert.equal(ledgerInput.value,'2026-09-09','Axes and indicator-pane clicks are ignored')
  const pickedDay=new Date(ledgerPickTime*1000+4*3600000).toISOString().slice(0,10) // October: broker UTC+3, Jakarta UTC+7.
  await pickAt();await flush()
  assert.equal(ledgerInput.value,pickedDay)
  assert.equal(pickerButton.getAttribute('aria-pressed'),'false','Picking is one-use')
  assert.equal(chart.chartElement().dataset.ledgerPicking,undefined)
  assert.ok(container.querySelector(`[data-ledger-date="${pickedDay}"]`),'Selected candle date is brought into the tape viewport')
  assert.deepEqual(logicalRange,ledgerViewportBefore)
  assert.equal(localStorage.getItem('fyodor.chart-drawings.v1'),ledgerDrawingsBefore)
  await click(pickerButton)
  await React.act(async()=>window.dispatchEvent(new dom.KeyboardEvent('keydown',{key:'Escape',bubbles:true})))
  assert.equal(chart.chartElement().dataset.ledgerPicking,undefined,'Escape cancels picking')
  await click(pickerButton);await click(pickerButton.nextElementSibling)
  assert.equal(chart.chartElement().dataset.ledgerPicking,undefined,'Today cancels picking')
  assert.equal(ledgerInput.value,new Date(now+7*3600000).toISOString().slice(0,10))
  const beforeInspectDate=ledgerInput.value, beforeInspectFilters=localStorage.getItem('fyodor.inspector.shared.v1')
  const ledgerScroll=container.querySelector('.ledger-viewport')
  assert.equal(container.querySelector('.ledger-release-header'),null,'Ledger release summary is removed')
  ledgerScroll.scrollLeft+=100;ledgerScroll.scrollTop=21
  await React.act(async()=>ledgerScroll.dispatchEvent(new dom.Event('scroll')));await flush()
  const savedLedgerLeft=ledgerScroll.scrollLeft
  const cpiEvent=[...container.querySelectorAll('.ledger-event')].find(n=>n.querySelector('strong').textContent==='Headline CPI YoY')
  await click(cpiEvent);await flush()
  assert.ok(container.querySelector('[aria-label="Inspector"]'),'Ledger event opens Inspector')
  assert.ok(container.querySelector('[data-value-id="usd.cpi-yoy"][data-ledger-focused="true"]'),'Clicked measure is highlighted')
  assert.ok(container.querySelector('[data-value-id="usd.cpi-mom"]'),'Complete same-time source package remains visible')
  assert.equal(localStorage.getItem('fyodor.inspector.shared.v1'),beforeInspectFilters)
  await click([...container.querySelectorAll('.inspector-header button')].find(n=>n.textContent==='Return to Ledger'));await flush()
  assert.equal(container.querySelector('[aria-label="Ledger as-of date"]').value,beforeInspectDate)
  assert.equal(container.querySelector('.ledger-viewport').scrollLeft,savedLedgerLeft)
  assert.equal(container.querySelector('.ledger-viewport').scrollTop,21)
  const restoredPickerButton=container.querySelector('[aria-label="Pick Ledger date from a chart candle"]')
  await click(restoredPickerButton)
  await click(container.querySelector('[aria-label="Close Detail"]')); await click(button('Ledger'))
  assert.equal(chart.chartElement().dataset.ledgerPicking,undefined,'Closing Ledger removes its chart picker')
  assert.equal([...timers.values()].some(t => t.fn.name==='pollLedger'),false)
  const heatmapRange = { ...logicalRange }, heatmapDrawings = localStorage.getItem('fyodor.chart-drawings.v1')
  reset(); await click(button('Heatmap')); await flush()
  assert.ok(container.querySelector('[aria-label="Heatmap"]'))
  assert.ok(container.querySelector('[aria-label="Resize Heatmap dock"]'))
  assert.ok(container.querySelector('[data-heatmap-cell^="symbol:EURUSD:"]'))
  assertQuiet('Opening heatmap history')
  const beforeCopyRangeRequests = requests.length
  reset(); await click(button('Copy range')); await flush()
  const copyEnd = container.querySelector('[aria-label="Copy through date"]').value
  await change(container.querySelector('[aria-label="Copy from date"]'), new Date(Date.parse(copyEnd) - 2 * 86400_000).toISOString().slice(0, 10)); await flush()
  assertQuiet('Selecting copy dates', true)
  assert.equal(counters.heatmapBuild ?? 0, 0, 'Copy date selection performs no price or basket calculations')
  assert.equal(requests.length, beforeCopyRangeRequests, 'Copy date selection uses loaded history')
  assert.deepEqual(logicalRange, heatmapRange)
  await click(button('Single date')); await flush()
  const beforeWildcardHistory = requests.filter(url => url === '/storage-api/heatmap/history').length
  reset(); await click(button('Manage Wildcards')); await flush()
  assertQuiet('Opening Wildcards editor', true)
  await click([...container.querySelectorAll('[role="dialog"] button')].find(node => node.textContent === 'Close')); await flush()
  const wildcardViewport = container.querySelector('.heatmap-viewport')
  wildcardViewport.scrollTop = 100000
  await React.act(async () => wildcardViewport.dispatchEvent(new dom.Event('scroll'))); await flush()
  // happy-dom does not clamp native scrolling; use the final virtual rows.
  const heatmapGrid = container.querySelector('.heatmap-tape').style.gridTemplateRows
  wildcardViewport.scrollTop = 42 + Number(/repeat\((\d+),/.exec(heatmapGrid)[1]) * 30 - 100
  await React.act(async () => wildcardViewport.dispatchEvent(new dom.Event('scroll'))); await flush()
  reset(); await click(button('+ Add wildcard')); await flush()
  await change(container.querySelector('[aria-label="Wildcard title"]'), 'Assembled catalyst')
  await change(container.querySelector('[aria-label="Wildcard details"]'), 'First paragraph.\n\nSecond paragraph.')
  await click([...container.querySelectorAll('[role="dialog"] button')].find(node => node.textContent === 'Save')); await flush()
  assert.equal(wildcardFixture.items[0].title, 'Assembled catalyst')
  assertQuiet('Saving Wildcards notes', true)
  assert.equal(counters.heatmapBuild ?? 0, 0, 'Saving manual notes does no price or basket calculations')
  assert.equal(requests.filter(url => url === '/storage-api/heatmap/history').length, beforeWildcardHistory)
  assert.deepEqual(logicalRange, heatmapRange)
  assert.equal(localStorage.getItem('fyodor.chart-drawings.v1'), heatmapDrawings)
  wildcardViewport.scrollTop = 0
  await React.act(async () => wildcardViewport.dispatchEvent(new dom.Event('scroll'))); await flush()
  const heatmapViewport = container.querySelector('.heatmap-viewport'), heatmapDate = container.querySelector('[aria-label="Heatmap date"]').value
  const beforeHeatmapScroll = requests.length
  reset()
  heatmapViewport.scrollLeft = 200
  await React.act(async () => { for (let i = 0; i < 100; i++) heatmapViewport.dispatchEvent(new dom.Event('scroll')) })
  assert.equal(frames.size, 1, 'Heatmap scroll bursts queue one frame in the assembled terminal')
  await flush()
  assertQuiet('Browsing heatmap history', true)
  assert.equal(counters.heatmapBuild ?? 0, 0, 'Browsing never recalculates return history')
  assert.equal(requests.length, beforeHeatmapScroll)
  assert.equal(container.querySelector('[aria-label="Heatmap date"]').value, heatmapDate)
  const heatmapCaptures = new Set()
  heatmapViewport.setPointerCapture = id => heatmapCaptures.add(id)
  heatmapViewport.hasPointerCapture = id => heatmapCaptures.has(id)
  heatmapViewport.releasePointerCapture = id => heatmapCaptures.delete(id)
  const heatmapGesture = (type, x, y) => React.act(async () => props(heatmapViewport)[type]({
    button: 0, isPrimary: true, pointerId: 92, clientX: x, clientY: y, target: heatmapViewport, currentTarget: heatmapViewport, preventDefault() {} }))
  reset()
  await heatmapGesture('onPointerDown', 500, 100)
  await React.act(async () => { for (let i = 0; i < 100; i++) props(heatmapViewport).onPointerMove({
    pointerId: 92, clientX: 500 - i, clientY: 100 - i, currentTarget: heatmapViewport, preventDefault() {} }) })
  assert.equal(frames.size, 1, 'Both drag axes share one frame in the assembled terminal')
  await flush()
  assert.equal(heatmapViewport.scrollLeft, 299)
  assert.equal(heatmapViewport.scrollTop, 99)
  await heatmapGesture('onPointerUp', 401, 1)
  assert.equal(heatmapCaptures.size, 0)
  assertQuiet('Dragging heatmap dates and rows', true)
  assert.equal(counters.heatmapBuild ?? 0, 0)
  assert.equal(requests.length, beforeHeatmapScroll)
  assert.equal(container.querySelector('[aria-label="Heatmap date"]').value, heatmapDate)
  reset(); await click(button('Weekly')); await flush()
  assertQuiet('Weekly heatmap view', true)
  assert.equal(requests.length, beforeHeatmapScroll, 'Weekly uses the same history response')
  reset(); await tick('pollHeatmap', 20000); await flush()
  assertQuiet('Heatmap poll', true)
  assert.equal(counters.heatmapBuild ?? 0, 0, 'Unchanged history retains its calculation identity')
  assert.deepEqual(logicalRange, heatmapRange)
  assert.equal(localStorage.getItem('fyodor.chart-drawings.v1'), heatmapDrawings)
  const beforeCloseHeatmapRequests = requests.length
  const savedHeatmapView = { left: heatmapViewport.scrollLeft, top: heatmapViewport.scrollTop }
  await click(button('Heatmap')); await flush()
  assert.equal([...timers.values()].some(t => t.fn.name === 'pollHeatmap'), true, 'Closing the heatmap keeps its data poll active')
  assert.equal(container.querySelector('.heatmap-viewport'), null, 'Closed heatmap removes its visual viewport')
  assert.equal(container.querySelector('.bottom-dock').hidden, true)
  reset(); await tick('pollHeatmap', 20000); await flush()
  assertQuiet('Closed heatmap background poll', true)
  assert.equal(counters.heatmapBuild ?? 0, 0, 'Closed polling performs no row calculations')
  await click(button('Ledger')); await flush()
  assert.ok(container.querySelector('.ledger-viewport'))
  assert.equal(container.querySelector('.heatmap-viewport'), null)
  const beforeReopenHeatmap = requests.filter(url => url === '/storage-api/heatmap/history').length
  await click(button('Heatmap')); await flush()
  assert.equal(requests.filter(url => url === '/storage-api/heatmap/history').length, beforeReopenHeatmap, 'Switching from another dock reuses the warmed history')
  assert.ok(beforeCloseHeatmapRequests < requests.length)
  assert.equal(container.querySelector('.heatmap-viewport').scrollLeft, savedHeatmapView.left)
  assert.equal(container.querySelector('.heatmap-viewport').scrollTop, savedHeatmapView.top)
  await click(button('Heatmap')); await flush()
  const rankingWindow = {...logicalRange}, rankingRequests = requests.filter(url=>url.startsWith('/storage-api/heatmap/history')).length
  reset(); await click(container.querySelector('[aria-label="Show Heatmap Ranking"]')); await flush()
  assert.ok(container.querySelector('#heatmap-ranking-panel .heatmap-ranking'))
  assert.equal(container.querySelector('.heatmap-viewport'),null,'Standalone ranking never mounts a hidden timeline')
  assert.equal(requests.filter(url=>url.startsWith('/storage-api/heatmap/history')).length,rankingRequests,'The ranking reuses the warmed heatmap request')
  assert.deepEqual(logicalRange,rankingWindow)
  assertQuiet('Standalone Heatmap ranking')
  await React.act(async()=>container.querySelector('#heatmap-ranking-panel .heatmap-ranking').dispatchEvent(new dom.KeyboardEvent('keydown',{key:'Escape',bubbles:true})))
  assert.equal(container.querySelector('#heatmap-ranking-panel'),null,'Escape closes portal-rendered ranking content')
  await click(container.querySelector('[aria-label="Show Heatmap Ranking"]')); await flush()
  await click(container.querySelector('[aria-label="Show Detail"]')); await flush()
  assert.equal(container.querySelector('#heatmap-ranking-panel'),null,'Detail and ranking use the shared right panel')
  await click(container.querySelector('[aria-label="Hide Detail"]')); await flush()

  assert.deepEqual(logicalRange, heatmapRange)
  await React.act(async () => root.render(null))
  assert.equal(indicatorSeries.size, 0); assert.equal(panes.length, 1)
  assert.equal(rangeListeners.size, 0); assert.equal(clickListeners.size, 0)
  assert.equal(counters.workerCreated ?? 0, 0)
  try {
    await React.act(async () => root.render(React.createElement(React.StrictMode, null,
      React.createElement(ActivityLogProvider, null, React.createElement(FyodorTerminalShell)))))
    assert.equal(container.querySelector('[aria-label="Show event icons"]').getAttribute('aria-pressed'), 'false', 'Universal visibility is restored after remount')
    assert.equal(container.querySelector('[aria-label="Hide RSI"]').getAttribute('aria-pressed'), 'true', 'Shared RSI visibility is restored after StrictMode remount')
  } finally { await React.act(async () => root.render(null)) }
  console.log('✓ Assembled Lite: shared RSI controls/pane/persistence and bounded tick work, navigation, filters/raw tables, dates, future axis, drawings, Entry Trade plans/pins/journal, Alert/Activity, viewport/corrections, zero polling/pan work and StrictMode cleanup')
} finally {
  await React.act(async () => root.unmount())
  assert.equal(timers.size, 0); assert.equal(intervals.size, 0); assert.equal(frames.size, 0)
  assert.equal(rangeListeners.size, 0); assert.equal(sizeListeners.size, 0); assert.equal(hoverListeners.size, 0); assert.equal(clickListeners.size, 0)
  assert.equal(tradeMarkers.size, 0); assert.equal(tradeLines.size, 0)
  Date.now = originalNow
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
  }
}
