import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost:5173' }), oldWindow = globalThis.window
globalThis.window = dom
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`)
const candle = (utc, ticks = 100, high = 2) => ({ time: utc / 1000, open: 1, high, low: 0, close: 1.5, tickVolume: ticks })
try {
  const { createVolumeCalculator, summarizeVolumeRange } = await server.ssrLoadModule('./src/market-data/indicators/volume/volume-calculation.ts')
  const { defaultVolumePreferences, readVolumePreferences, saveVolumePreferences } = await server.ssrLoadModule('./src/market-data/indicators/volume/volume-preferences.ts')
  const { replaceRecentBars } = await server.ssrLoadModule('./src/market-data/mt5-feed/market-snapshots.ts')
  const { utcToChartClock } = await server.ssrLoadModule('./src/appearance/time-display/chart-clock.ts')
  const clock = { brokerId: null, brokerOffsetSeconds: 0 }, p = { ...defaultVolumePreferences, lookback: 5, minimumSamples: 3, averageLength: 3 }
  const begin = Date.UTC(2026, 8, 1)
  const dates = Array.from({ length: 30 }, (_, i) => begin + i * 86400000).filter(at => ![0,6].includes(new Date(at).getUTCDay())).slice(0,12)
  const bars = dates.flatMap((at, day) => [candle(at + 8 * 3600000, (day + 1) * 100), candle(at + 9 * 3600000, (day + 1) * 1000)])
  const result = createVolumeCalculator().sync(bars, p, clock, 3600)
  assert.equal(result.rows[4].relative, undefined, 'Insufficient history has no invented value')
  close(result.rows[6].relative, 400 / 200)
  close(result.rows[7].relative, 4000 / 2000)
  close(result.rows[22].relative, 1200 / 900)
  assert.equal(result.rows[22].samples, 5)
  close(result.rows[2].average, (100 + 1000 + 200) / 3)
  const prefix = createVolumeCalculator().sync(bars.slice(0, 9), p, clock, 3600)
  assert.deepEqual(prefix.rows, result.rows.slice(0, 9), 'Future dates never enter historical baselines')
  const zeros = bars.map(bar => ({ ...bar, tickVolume: 0 }))
  assert.equal(createVolumeCalculator().sync(zeros, p, clock, 3600).rows.at(-1).relative, undefined, 'Zero denominator is unavailable, not infinity')
  const missing = bars.map(bar => ({ ...bar, tickVolume: undefined }))
  assert.equal(createVolumeCalculator().sync(missing, p, clock, 3600).rows.at(-1).ticks, undefined)
  assert.equal(createVolumeCalculator().sync(bars, p, { brokerId: 'unknown', brokerOffsetSeconds: 7200 }, 3600).rows.at(-1).relative, undefined, 'Unknown historical clock never borrows today’s offset')
  const { createForexSessionLookup, forexSessions } = await server.ssrLoadModule('./src/market-data/market-watch/forex-sessions.ts')
  const sessionAt = createForexSessionLookup()
  for (const at of [Date.UTC(2026, 0, 6, 1), Date.UTC(2026, 0, 6, 14), Date.UTC(2026, 2, 20, 13), Date.UTC(2026, 9, 26, 13), Date.UTC(2026, 10, 2, 14)]) {
    assert.deepEqual(sessionAt(at).names, forexSessions(at).sessions.filter(session => session.active).map(session => session.name), 'Automatic session names match the header, including both DST mismatch weeks')
  }
  assert.equal(sessionAt(Date.UTC(2026, 0, 6, 1)).key, 'Sydney + Tokyo')
  assert.equal(sessionAt(Date.UTC(2026, 0, 6, 14)).key, 'London + New York')
  assert.equal(sessionAt(Date.UTC(2026, 0, 6, 18)).from, Date.UTC(2026, 0, 6, 17), 'London closing defines the start of NY-only even across the Jakarta date boundary')
  assert.equal(sessionAt(Date.UTC(2026, 9, 31, 12)).key, '', 'Weekend has no active session')
  assert.equal(sessionAt(Date.UTC(2026, 0, 6, 13)).key, 'London + New York', 'Open boundary is inclusive')
  assert.equal(sessionAt(Date.UTC(2026, 0, 6, 17)).key, 'New York', 'Close boundary is exclusive')
  // The same hour into the London/NY overlap follows US and UK DST automatically.
  const utcDates = [Date.UTC(2026, 9, 22, 13), Date.UTC(2026, 9, 23, 13), Date.UTC(2026, 10, 2, 14), Date.UTC(2026, 10, 3, 14)]
  const brokerClock = { brokerId: 'Pepperstone-Demo', brokerOffsetSeconds: 10800 }
  const dstBars = utcDates.map((utc, i) => ({ ...candle(utc, (i + 1) * 100), time: utcToChartClock(utc, brokerClock) / 1000 }))
  const dst = createVolumeCalculator().sync(dstBars, { ...p, minimumSamples: 2 }, brokerClock, 3600)
  close(dst.rows[2].relative, 300 / 150); close(dst.rows[3].relative, 400 / 200)
  assert.ok(dst.rows.every(row => row.session === 'London + New York'))
  assert.notEqual(result.rows[6].session, result.rows[7].session, 'Solo and overlap baselines remain separate')
  const weekend = [candle(Date.UTC(2026, 9, 31, 12), 100)]
  assert.equal(createVolumeCalculator().sync(weekend, p, clock, 3600).rows[0].relative, undefined)
  const spanning = createVolumeCalculator().sync(bars, p, clock, 14400)
  assert.match(spanning.rows[0].session, /→/, 'Multi-hour candles explicitly identify changes of session')
  const daily = createVolumeCalculator().sync(bars.filter((_, i) => i % 2 === 0), p, clock, 86400)
  close(daily.rows.at(-1).relative, 1200 / 900)
  const engine = createVolumeCalculator()
  let live = bars.slice(0, -1)
  engine.sync(live, p, clock, 3600)
  for (let i = 0; i < 5; i++) {
    const next = replaceRecentBars(live, [{ ...live.at(-1), tickVolume: 1000 + i }])
    assert.notEqual(next, live, 'Volume changes retain a new market snapshot even if OHLC is unchanged')
    live = next
    const incremental = engine.sync(live, p, clock, 3600)
    assert.equal(incremental.work, 1)
    assert.deepEqual(incremental.rows, createVolumeCalculator().sync(live, p, clock, 3600).rows)
  }
  live = replaceRecentBars(live, [bars.at(-1)])
  const appended = engine.sync(live, p, clock, 3600)
  assert.equal(appended.work, 2)
  assert.deepEqual(appended.rows, createVolumeCalculator().sync(live, p, clock, 3600).rows)
  assert.equal(engine.sync(live, p, clock, 3600).work, 0)
  const correction = replaceRecentBars(live, live.slice(-6).map((bar, i) => i === 0 ? { ...bar, tickVolume: 777 } : bar))
  assert.equal(engine.sync(correction, p, clock, 3600).rebuilt, true)
  const prepended = [candle(begin - 86400000 + 8 * 3600000, 50), ...correction]
  assert.deepEqual(engine.sync(prepended, p, clock, 3600).rows, createVolumeCalculator().sync(prepended, p, clock, 3600).rows)
  const range = { from: bars[6].time, to: bars[9].time }
  const summary = summarizeVolumeRange(bars, result.rows, range, 3600, begin + 100 * 86400000)
  assert.equal(summary.candles, 4); assert.equal(summary.minutes, 240); assert.equal(summary.ticks, 9900)
  close(summary.averageRelative, (2 + 2 + 2 + 2) / 4)
  const withOpen = summarizeVolumeRange(bars, result.rows, { from: bars.at(-2).time, to: bars.at(-1).time }, 3600, bars.at(-1).time * 1000 + 1800000)
  assert.equal(withOpen.candles, 1); assert.equal(withOpen.excluded, 1)
  assert.equal(summarizeVolumeRange(bars, result.rows, { from: bars[0].time, to: bars[9].time }, 3600, Infinity).averageRelative, undefined, 'Partial baseline coverage never produces a misleading mean')
  const large = Array.from({ length: 100000 }, (_, i) => candle(begin + i * 60000))
  const big = createVolumeCalculator(); big.sync(large, p, clock, 60)
  const tick = replaceRecentBars(large, [{ ...large.at(-1), tickVolume: 101 }])
  assert.equal(big.sync(tick, p, clock, 60).work, 1, '100,000-bar history still processes one live row')
  saveVolumePreferences({ ...p, enabled: true, mode: 'relative' })
  assert.equal(readVolumePreferences().enabled, true); assert.equal(readVolumePreferences().mode, 'relative')
  dom.localStorage.setItem('fyodor.indicators.volume.v1', JSON.stringify({ lookback: 5, minimumSamples: 50, clock: 'invalid', upColor: 'transparent' }))
  const sanitized = readVolumePreferences()
  assert.equal(sanitized.minimumSamples, 5); assert.equal('clock' in sanitized, false, 'Legacy clock choice is ignored without losing other preferences'); assert.equal(sanitized.upColor, defaultVolumePreferences.upColor)
  assert.equal(sanitized.relativeLineVisible, true, 'Existing settings enable the new exact Relative line')
  assert.equal(sanitized.paneControlsVisible, true, 'Existing pane buttons remain available until hidden')
  saveVolumePreferences({ ...p, relativeLineVisible: false, paneControlsVisible: false, relativeLineColor: '#123456' })
  assert.equal(readVolumePreferences().relativeLineVisible, false)
  assert.equal(readVolumePreferences().paneControlsVisible, false)
  assert.equal(readVolumePreferences().relativeLineColor, '#123456')
  console.log('✓ Volume: automatic sessions/overlaps/header parity, session-relative ratios, prior-only baselines, DST/historical clocks, missing/zero data, mutable tail, correction/prepend, range coverage and closed bars; 100,000-bar live work = 1')
} finally { await server.close(); await dom.happyDOM.close(); globalThis.window = oldWindow }
