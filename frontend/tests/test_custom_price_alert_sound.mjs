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
let blocked = false, decodeCount = 0, deferredDecode = null
const sources = [], contexts = []
globalThis.AudioContext = class {
  currentTime = 20; destination = {}; state = 'suspended'
  constructor() { contexts.push(this) }
  async resume() { if (blocked) throw Error('Blocked'); this.state = 'running' }
  async close() { this.state = 'closed' }
  async decodeAudioData(bytes) {
    decodeCount++
    const view = new DataView(bytes)
    if (bytes.byteLength < 44 || view.getUint32(0) !== 0x52494646) throw Error('Invalid audio')
    const buffer = { duration: view.getUint32(40, true) / view.getUint32(28, true) }
    if (deferredDecode) return deferredDecode(buffer)
    return buffer
  }
  createBufferSource() {
    const source = { kind: 'file', connect() {}, disconnect() { source.disconnected = true },
      start(at) { source.started = at }, stop(at) { source.stops.push(at) }, stops: [] }
    sources.push(source); return source
  }
  createOscillator() {
    const source = { kind: 'tone', frequency: { setValueAtTime() {} }, connect() {}, disconnect() {},
      start(at) { source.started = at }, stop(at) { source.stops.push(at) }, stops: [] }
    sources.push(source); return source
  }
  createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} } }
}
// Small, valid PCM WAV clips. Only the browser's audio device/decoder is mocked.
function wav(seconds = .25) {
  const samples = Math.round(seconds * 8000), bytes = new ArrayBuffer(44 + samples * 2), view = new DataView(bytes)
  for (const [offset, text] of [[0, 'RIFF'], [8, 'WAVE'], [12, 'fmt '], [36, 'data']])
    [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)))
  view.setUint32(4, bytes.byteLength - 8, true); view.setUint32(16, 16, true)
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 8000, true)
  view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  view.setUint32(40, samples * 2, true)
  for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, Math.round(Math.sin(i * 2 * Math.PI * 440 / 8000) * 4000), true)
  return bytes
}
const file = (name = 'My chime.wav', bytes = wav()) => new dom.File([bytes], name, { type: 'audio/wav' })
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host)
const root = createRoot(host)
let api, quotes = []
try {
  const { usePriceAlerts } = await server.ssrLoadModule('./src/price-alerts/usePriceAlerts.ts')
  const { PriceAlertsDock } = await server.ssrLoadModule('./src/price-alerts/PriceAlertsDock.tsx')
  const { customAlertSoundKey, customAlertSoundMaxBytes, readCustomAlertSound, decodeCustomAlertSound } = await server.ssrLoadModule('./src/price-alerts/custom-alert-sound.ts')
  const { priceAlertStorageKey } = await server.ssrLoadModule('./src/price-alerts/price-alert-store.ts')
  function Harness() {
    const controller = usePriceAlerts('Broker', quotes, true)
    React.useEffect(() => { api = controller })
    return React.createElement(PriceAlertsDock, { controller, brokerId: 'Broker', onSelectSymbol() {}, onCreate() {} })
  }
  const render = key => React.act(async () => root.render(React.createElement(Harness, { key })))
  const command = fn => React.act(async () => { await fn() })
  const saved = () => JSON.parse(dom.localStorage.getItem(priceAlertStorageKey))
  const upload = audio => command(() => api.uploadCustomSound(audio))
  const latestFile = () => sources.filter(source => source.kind === 'file').at(-1)
  await render('first')
  await command(() => api.setSound(false, 5))
  let alert
  await command(() => { alert = api.addAlert('EURUSD', 1.2, 5) })
  const originalAlerts = structuredClone(saved().alerts)
  const input = host.querySelector('input[type="file"]')
  assert.equal(input.hidden, true)
  assert.ok(input.accept.includes('.mp3') && input.accept.includes('.wav') && input.accept.includes('.ogg'))
  let opened = 0
  input.click = () => opened++
  await command(() => host.querySelector('[aria-label="Upload custom alert sound"]').click())
  assert.equal(opened, 1, 'The upload button invokes the native file input directly from the click')
  const onChange = input[Object.keys(input).find(key => key.startsWith('__reactProps'))].onChange
  const target = { files: [file()], value: 'selected-file' }
  await command(() => onChange({ currentTarget: target }))
  assert.equal(target.value, '', 'Resetting the input permits choosing the same filename again')
  assert.equal(api.customSoundName, 'My chime.wav')
  assert.equal(api.customSoundLoading, false)
  assert.equal(api.customSoundError, '')
  assert.equal(saved().soundId, 'custom')
  assert.equal(saved().playSound, false, 'Uploading preserves the existing mute choice')
  assert.deepEqual(saved().alerts, originalAlerts, 'Uploading never changes alert records')
  assert.equal(saved().duration, 5)
  assert.equal(sources.length, 0, 'Uploading does not play unexpectedly')
  assert.ok(host.querySelector('option[value="custom"]').textContent.includes('My chime.wav'))
  const record = readCustomAlertSound()
  assert.deepEqual(new Uint8Array(decodeCustomAlertSound(record.data)), new Uint8Array(wav()), 'The saved file bytes round-trip intact')
  await command(() => onChange({ currentTarget: { files: [], value: '' } }))
  assert.deepEqual(readCustomAlertSound(), record, 'Canceling the picker keeps the saved sound')
  await command(() => api.previewSound())
  assert.equal(latestFile().loop, true, 'A short clip repeats for the selected alert duration')
  assert.equal(latestFile().started, 20)
  assert.deepEqual(latestFile().stops, [25], 'Playback is capped at the selected duration')
  assert.equal(latestFile().buffer.duration, .25)
  const decoded = decodeCount
  await command(() => api.previewSound())
  assert.equal(decodeCount, decoded, 'Previews reuse the decoded file')
  assert.ok(sources[0].stops.includes(undefined), 'Preview replaces the previous playback')
  const wasPlaying = latestFile()
  await command(() => api.setSound(false, 5, 'bell'))
  assert.ok(wasPlaying.stops.includes(undefined), 'Switching presets stops the uploaded clip')
  await command(() => api.setSound(true, 3, 'custom'))
  quotes = [{ symbol: 'EURUSD', bid: 1.1, ask: 1.1001, precision: 5 }]
  await render('first')
  quotes = [{ ...quotes[0], bid: 1.21 }]
  const beforeTrigger = sources.length
  await render('first')
  assert.equal(api.alerts.find(item => item.id === alert).status, 'triggered')
  assert.equal(sources.length, beforeTrigger + 1)
  assert.equal(latestFile().stops[0], 23, 'Automatic alerts use the custom file and chosen duration')
  await render('reload')
  assert.equal(api.customSoundName, 'My chime.wav')
  assert.equal(api.soundId, 'custom')
  const beforeReload = decodeCount
  await command(() => api.previewSound())
  assert.equal(decodeCount, beforeReload + 1, 'Reload restores and decodes the saved bytes')
  assert.equal(latestFile().buffer.duration, .25)

  for (const [audio, message] of [[file('bad.txt'), /MP3, WAV or OGG/], [file('empty.wav', new ArrayBuffer(0)), /nonempty/],
    [file('big.wav', new ArrayBuffer(customAlertSoundMaxBytes + 1)), /2 MB/], [file('broken.wav', new Uint8Array([1, 2, 3])), /Cannot read/],
    [file('long.wav', wav(61)), /60 seconds/]]) {
    await upload(audio)
    assert.match(api.customSoundError, message)
    assert.equal(api.customSoundLoading, false)
    assert.deepEqual(readCustomAlertSound(), record, 'Rejected uploads preserve the previous saved clip')
    assert.equal(api.customSoundName, 'My chime.wav')
    assert.equal(api.soundId, 'custom')
  }
  const storageDescriptor = Object.getOwnPropertyDescriptor(dom, 'localStorage')
  const storage = dom.localStorage
  Object.defineProperty(dom, 'localStorage', { configurable: true, value: {
    getItem: storage.getItem.bind(storage), setItem(key, value) { if (key === customAlertSoundKey) throw Error('Quota exceeded'); storage.setItem(key, value) },
  } })
  try {
    await upload(file('Replacement.wav', wav(.5)))
    assert.match(api.customSoundError, /Cannot save/)
    assert.deepEqual(readCustomAlertSound(), record)
    await command(() => api.previewSound())
    assert.equal(latestFile().buffer.duration, .25, 'A failed save also preserves the active decoded sound')
  } finally { Object.defineProperty(dom, 'localStorage', storageDescriptor) }
  await upload(file('Replacement.wav', wav(.5)))
  assert.equal(api.customSoundName, 'Replacement.wav')
  assert.equal(api.customSoundError, '')
  await command(() => api.setSound(true, 1))
  await command(() => api.previewSound())
  assert.equal(latestFile().buffer.duration, .5)
  assert.equal(latestFile().stops[0], 21)
  // A fresh context exercises the same gesture restrictions as built-in tones.
  await render('blocked-reload')
  blocked = true
  await command(() => api.previewSound())
  assert.equal(api.soundBlocked, true)
  blocked = false
  await command(() => api.enableSound())
  await command(() => api.previewSound())
  assert.equal(api.soundBlocked, false)
  dom.localStorage.removeItem(customAlertSoundKey)
  await command(() => dom.dispatchEvent(new dom.StorageEvent('storage', { key: customAlertSoundKey })))
  assert.equal(api.customSoundName, null)
  assert.match(api.customSoundError, /missing/)
  const beforeMissing = sources.length
  await command(() => api.previewSound())
  assert.equal(sources.length, beforeMissing, 'Missing custom audio never silently plays a different preset')
  dom.localStorage.setItem(customAlertSoundKey, JSON.stringify(record))
  await command(() => dom.dispatchEvent(new dom.StorageEvent('storage', { key: customAlertSoundKey })))
  await command(() => api.previewSound())
  assert.equal(api.customSoundName, 'My chime.wav')
  assert.equal(latestFile().buffer.duration, .25, 'Another tab can restore or replace the saved audio')

  let finishDecode
  deferredDecode = buffer => new Promise(resolve => { finishDecode = () => resolve(buffer) })
  let pending
  await command(() => { pending = api.uploadCustomSound(file('Obsolete.wav')) })
  assert.equal(api.customSoundLoading, true)
  assert.equal(host.querySelector('[aria-label="Upload custom alert sound"]').disabled, true)
  assert.equal([...host.querySelectorAll('button')].find(node => node.textContent === 'Preview').disabled, true)
  await render('new-session')
  await command(async () => { finishDecode(); await pending })
  assert.equal(api.customSoundName, 'My chime.wav')
  assert.deepEqual(readCustomAlertSound(), record, 'An obsolete upload cannot save after unmount or remount')
  await command(() => { pending = api.uploadCustomSound(file('Canceled.wav')) })
  await command(() => api.setSound(false, 1, 'bell'))
  await command(async () => { finishDecode(); await pending })
  assert.equal(api.soundId, 'bell', 'A later preset choice cancels a pending upload')
  assert.deepEqual(readCustomAlertSound(), record)
  await command(() => api.setSound(false, 1, 'custom'))
  const beforeCanceledPreview = sources.length
  await command(() => { pending = api.previewSound() })
  await command(() => api.setSound(false, 1, 'bell'))
  await command(async () => { finishDecode(); await pending })
  assert.equal(sources.length, beforeCanceledPreview, 'An obsolete preview cannot play after changing the sound')
  deferredDecode = null
  await command(() => api.setSound(false, 1, 'custom'))
  await command(() => api.previewSound())
  const last = latestFile()
  await React.act(async () => root.render(null))
  assert.ok(last.stops.includes(undefined), 'Unmount stops custom playback')
  assert.ok(contexts.every(context => context.state === 'closed'), 'Every audio context is disposed')
  console.log('✓ Custom alert audio: native picker, validation, local byte persistence, reload, preview/trigger timing, mute, replacement, quota failure, cross-tab sync, stale uploads and cleanup')
} finally {
  await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
