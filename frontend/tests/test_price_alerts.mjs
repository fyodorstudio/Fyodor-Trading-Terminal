import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'AudioContext'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.appendChild(host)
const root = createRoot(host)
let soundStarts = 0, soundStops = [], closes = 0, blocked = false
const scheduledTones = []
globalThis.AudioContext = class {
  _state = 'suspended'; currentTime = 10; destination = {}
  get state() { return blocked ? 'suspended' : this._state }
  async resume() { if (blocked) throw new Error('Audio blocked'); this._state = 'running' }
  async close() { closes++; this._state = 'closed' }
  createOscillator() {
    const node = { frequency: { setValueAtTime(value) { node.pitch = value } }, connect() {}, disconnect() {},
      start(at) { soundStarts++; scheduledTones.push({ waveform: node.type, pitch: node.pitch, at }) }, stop(at) { soundStops.push(at) } }
    return node
  }
  createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} } }
}
const quote = (symbol, bid) => ({ symbol, bid, ask: bid + .0001, precision: 5, description: symbol, dailyChange: 0 })
const lines = new Set()
const seriesApi = { createPriceLine(options) { const line = { options }; lines.add(line); return line }, removePriceLine(line) { lines.delete(line) } }
let api, renderCount = 0
try {
  const { usePriceAlerts } = await server.ssrLoadModule('./src/price-alerts/usePriceAlerts.ts')
  const { PriceAlertLines } = await server.ssrLoadModule('./src/price-alerts/PriceAlertLines.tsx')
  const { PriceAlertsDock } = await server.ssrLoadModule('./src/price-alerts/PriceAlertsDock.tsx')
  const { evaluatePriceAlerts, readPriceAlerts, priceAlertStorageKey } = await server.ssrLoadModule('./src/price-alerts/price-alert-store.ts')
  const { priceAlertSounds } = await server.ssrLoadModule('./src/price-alerts/price-alert-tones.ts')
  const saved = () => JSON.parse(dom.localStorage.getItem(priceAlertStorageKey))
  function Harness({ broker = 'Broker A', quotes = [quote('EURUSD', 1.1)], live = true, symbol = 'EURUSD' }) {
    const controller = usePriceAlerts(broker, quotes, live)
    React.useEffect(() => { api = controller; renderCount++ })
    return React.createElement(React.Fragment, null,
      React.createElement(PriceAlertLines, { seriesApi, alerts: controller.brokerAlerts, symbol }),
      React.createElement(PriceAlertsDock, { controller, brokerId: broker, onSelectSymbol() {}, onCreate() {} }))
  }
  const render = (props = {}, key = 'session') => React.act(async () => root.render(React.createElement(Harness, { ...props, key })))
  const command = fn => React.act(async () => { await fn() })
  const click = node => command(() => { assert.ok(node); node.click() })
  const rowButton = (row, label) => [...row.querySelectorAll('button')].find(node => node.textContent === label)
  let up, down, other
  await render()
  await command(() => api.enableSound())
  const stableAdd = api.addAlert
  await command(() => { up = api.addAlert('EURUSD', 1.2, 5); down = api.addAlert('EURUSD', 1, 5); other = api.addAlert('GBPUSD', 1.3, 5) })
  assert.equal(lines.size, 2)
  assert.equal(saved().alerts.length, 3)
  assert.equal(saved().duration, 3)
  assert.equal(saved().soundId, 'thin')
  assert.deepEqual([...host.querySelector('[aria-label="Price alert sound"]').options].map(option => option.textContent), ['Thin', 'Bell', 'Double beep', 'Digital', 'Soft chime'])
  const upRow = [...host.querySelectorAll('.price-alert-row')].find(row => row.querySelector('.price-alert-title').textContent === 'EURUSD Crossing 1.20000')
  assert.equal(upRow.querySelector('.price-alert-state').textContent, 'Active')
  assert.equal(upRow.querySelector('.price-alert-actions'), null, 'Compact rows keep controls collapsed')
  await click(upRow.querySelector('.price-alert-summary'))
  assert.equal(upRow.querySelector('.price-alert-summary').getAttribute('aria-expanded'), 'true')
  await click(rowButton(upRow, 'Pause'))
  assert.equal(upRow.querySelector('.price-alert-state').textContent, 'Stopped — Paused')
  await click(rowButton(upRow, 'Resume'))
  await click(rowButton(upRow, 'Edit price'))
  assert.ok(upRow.querySelector('[aria-label="Alert price for EURUSD"]'))
  await click(rowButton(upRow, 'Cancel'))
  await click(upRow.querySelector('.price-alert-summary'))
  assert.equal(api.alerts.find(item => item.id === up).direction, 'above')
  assert.equal(api.alerts.find(item => item.id === down).direction, 'below')
  assert.equal(api.alerts.find(item => item.id === other).direction, null)
  const before = api.alerts
  const evaluation = evaluatePriceAlerts(before, 'Broker A', [quote('EURUSD', 1.15)], 100)
  assert.equal(evaluation.alerts, before, 'Unchanged evaluation preserves the saved state identity')
  assert.equal(evaluatePriceAlerts(before, 'Broker A', [quote('EURUSD', .99)], 100).triggered[0].id, down, 'Downward crossings trigger too')
  for (const bid of [NaN, Infinity, 0, -1]) {
    assert.equal(evaluatePriceAlerts(before, 'Broker A', [quote('EURUSD', bid)], 100).alerts, before, 'Invalid quotes never trigger or change the baseline')
  }
  assert.ok(host.textContent.includes('Waiting for quote'), 'Missing quotes are disclosed for individual alerts')
  const stableQuotes = [quote('EURUSD', 1.15)]
  await render({ quotes: stableQuotes })
  assert.equal(api.addAlert, stableAdd, 'Quote polling does not recreate chart drawing callbacks')
  const rendered = renderCount
  await render({ quotes: stableQuotes })
  assert.equal(renderCount, rendered + 1, 'No effect-driven render or polling timer for unchanged alerts')
  await render({ quotes: [quote('EURUSD', 1.21)], live: false })
  assert.equal(api.alerts.find(item => item.id === up).status, 'armed', 'Stale data cannot trigger')
  await render({ quotes: [quote('EURUSD', 1.21)], broker: 'Broker B' })
  assert.equal(api.alerts.find(item => item.id === up).status, 'armed', 'Other brokers cannot trigger')
  assert.equal(lines.size, 0, 'Other brokers do not display saved lines')
  await render({ quotes: [quote('EURUSD', 1.21)] })
  assert.equal(api.alerts.find(item => item.id === up).status, 'triggered', 'A sampled jump over the target triggers')
  assert.equal(api.alerts.find(item => item.id === up).triggeredBid, 1.21)
  assert.equal(lines.size, 1, 'Triggered lines disappear')
  assert.equal(soundStarts, 6, 'Three seconds schedules six thin-chime pulses')
  const triggeredRow = host.querySelector('.price-alert-row.triggered')
  assert.equal(triggeredRow.querySelector('.price-alert-state').textContent, 'Stopped — Triggered')
  assert.equal(triggeredRow.querySelector('time').getAttribute('title'), 'Asia/Jakarta (UTC+07:00)')
  assert.ok(soundStops.every(end => end <= 13), 'Playback ends within the selected duration')
  await render({ quotes: [quote('EURUSD', 1.22)] })
  assert.equal(soundStarts, 6, 'A one-shot alert never repeats')
  await render({ quotes: [quote('EURUSD', 1.23)] }, 'reload')
  assert.equal(soundStarts, 6, 'Persisted triggers do not replay on reload')
  assert.equal(api.alerts.find(item => item.id === up).status, 'triggered')
  await command(() => api.updateAlert(down, 'pause'))
  await render({ quotes: [quote('EURUSD', .99)] }, 'reload')
  assert.equal(api.alerts.find(item => item.id === down).status, 'paused')
  await command(() => api.updateAlert(down, 'arm'))
  assert.equal(api.alerts.find(item => item.id === down).direction, 'above', 'Rearming uses the current side')
  await render({ quotes: [quote('EURUSD', 1)] }, 'reload')
  assert.equal(api.alerts.find(item => item.id === down).status, 'triggered', 'Exact touch triggers')
  assert.equal(api.soundBlocked, true, 'After reload, a trigger reports locked sound immediately instead of waiting for a gesture')
  await command(() => api.setSound(false, 1))
  const mutedStarts = soundStarts
  await render({ quotes: [quote('GBPUSD', 1.2)], symbol: 'EURUSD' }, 'reload')
  await render({ quotes: [quote('GBPUSD', 1.3)], symbol: 'EURUSD' }, 'reload')
  assert.equal(api.alerts.find(item => item.id === other).status, 'triggered', 'All symbols monitor independently of the chart')
  assert.equal(soundStarts, mutedStarts, 'Mute preserves triggers without playing audio')
  await command(() => api.updateAlert(up, 'price', 1.4))
  assert.equal(api.alerts.find(item => item.id === up).status, 'armed')
  await command(() => api.updateAlert(up, 'delete'))
  assert.ok(!saved().alerts.some(item => item.id === up))
  await command(() => api.updateAlert(down, 'price', NaN))
  assert.equal(api.alerts.find(item => item.id === down).price, 1)
  blocked = true
  await command(() => api.previewSound())
  assert.equal(api.soundBlocked, true)
  assert.ok(host.textContent.includes('Sound is blocked'))
  blocked = false
  await command(() => api.enableSound())
  assert.equal(api.soundBlocked, false)
  await command(() => api.setSound(true, 5))
  const previewStarts = soundStarts
  await command(() => api.previewSound())
  assert.equal(soundStarts - previewStarts, 10)
  const signatures = new Set()
  for (const preset of priceAlertSounds) {
    const selector = host.querySelector('[aria-label="Price alert sound"]')
    await command(() => { selector.value = preset.id; selector.dispatchEvent(new dom.Event('change', { bubbles: true })) })
    assert.equal(saved().soundId, preset.id, 'Sound selector persists without changing alerts')
    const start = scheduledTones.length
    const stop = soundStops.length
    await click([...host.querySelectorAll('.price-alert-sound button')].find(node => node.textContent === 'Preview'))
    const tones = scheduledTones.slice(start)
    assert.ok(tones.length > 0, `${preset.label}: preview schedules audio`)
    assert.ok(soundStops.slice(stop).filter(at => at !== undefined).every(at => at <= 15), `${preset.label}: selected duration bounds playback`)
    signatures.add(JSON.stringify(tones))
  }
  assert.equal(signatures.size, priceAlertSounds.length, 'Each preset produces distinct pitches, rhythm or waveform')
  await render({ quotes: [] }, 'selected-sound-reload')
  assert.equal(api.soundId, 'soft-chime', 'Sound selection survives reload')
  await command(() => api.enableSound())
  await command(() => api.updateAlert(down, 'price', 1.4))
  await render({ quotes: [quote('EURUSD', 1.3)] }, 'selected-sound-reload')
  const triggerStart = scheduledTones.length
  await render({ quotes: [quote('EURUSD', 1.4)] }, 'selected-sound-reload')
  assert.equal(api.alerts.find(item => item.id === down).status, 'triggered')
  assert.equal(scheduledTones[triggerStart].pitch, 523, 'Automatic triggers use the saved preset too')
  dom.localStorage.setItem(priceAlertStorageKey, JSON.stringify({ ...saved(), alerts: [] }))
  await command(() => dom.dispatchEvent(new dom.StorageEvent('storage', { key: priceAlertStorageKey })))
  assert.equal(api.alerts.length, 0, 'Other-tab edits synchronize')
  dom.localStorage.setItem(priceAlertStorageKey, '{broken')
  assert.deepEqual(readPriceAlerts(), { alerts: [], playSound: true, duration: 3, soundId: 'thin' })
  dom.localStorage.setItem(priceAlertStorageKey, JSON.stringify({ alerts: [{ price: 'bad' }], duration: 999 }))
  assert.deepEqual(readPriceAlerts(), { alerts: [], playSound: true, duration: 3, soundId: 'thin' })
  const legacyAlert = { id: 'legacy', brokerId: 'Broker A', symbol: 'EURUSD', price: 1.5, precision: 5, direction: 'above', status: 'paused', createdAt: 1, triggeredAt: null, triggeredBid: null }
  dom.localStorage.setItem(priceAlertStorageKey, JSON.stringify({ alerts: [legacyAlert], playSound: false, duration: 10 }))
  assert.deepEqual(readPriceAlerts(), { alerts: [legacyAlert], playSound: false, duration: 10, soundId: 'thin' }, 'Existing saved alerts migrate without changing alarm choices')
  dom.localStorage.setItem(priceAlertStorageKey, JSON.stringify({ ...saved(), soundId: 'unknown' }))
  assert.equal(readPriceAlerts().soundId, 'thin', 'Unknown sounds fall back safely')
  await command(() => { api.addAlert('EURUSD', 1.2, 5) })
  const descriptor = Object.getOwnPropertyDescriptor(dom, 'localStorage')
  try {
    Object.defineProperty(dom, 'localStorage', { configurable: true, value: { getItem() { throw Error('Unavailable') }, setItem() { throw Error('Unavailable') } } })
    await command(() => { api.addAlert('EURUSD', 1.5, 5) })
    assert.equal(api.storageError, true)
    assert.ok(host.textContent.includes('session only'))
  } finally { if (descriptor) Object.defineProperty(dom, 'localStorage', descriptor); else delete dom.localStorage }
  await React.act(async () => root.render(null))
  assert.equal(lines.size, 0, 'All chart lines are removed on unmount')
  assert.ok(closes > 0, 'Audio contexts close on unmount')
  console.log('✓ Price alerts: exact touches/crossings, one-shot persistence, broker/symbol isolation, stale quotes, pause/rearm/edit/delete, sound/mute/duration/unlock, storage failures and cleanup')
} finally {
  await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
