import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']
const previous = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.appendChild(container)
const root = createRoot(container)
try {
  const modulePath = './src/scatter-plot/settings/scatter-plot-appearance.ts'
  const { normalizeScatterAppearance, defaultScatterAppearance: defaults, scatterAppearanceKey: key,
    readScatterAppearance, saveScatterAppearance, useScatterAppearance, withMagnitudeBandColor } = await server.ssrLoadModule(modulePath)
  const automatic = defaults.levels.map((level) => ({ ...level, color: '#123456' }))
  assert.deepEqual(normalizeScatterAppearance({ levels: automatic }).magnitudeColors, ['#123456', '#123456', '#123456'])
  const custom = defaults.customLevels.map((level, index) => ({ ...level, color: ['#112233', '#445566', '#778899'][index] }))
  const migrated = normalizeScatterAppearance({ levels: automatic, customLevels: custom })
  assert.deepEqual(migrated.magnitudeColors, ['#112233', '#445566', '#778899'], 'Edited legacy Custom colors win a conflicting split palette')
  assert.deepEqual(migrated.levels.map((level) => level.color), migrated.magnitudeColors)
  assert.deepEqual(migrated.customLevels.map((level) => level.color), migrated.magnitudeColors)
  assert.deepEqual(normalizeScatterAppearance({ levels: automatic, customLevels: defaults.customLevels }).magnitudeColors,
    ['#123456', '#123456', '#123456'], 'An untouched Custom palette preserves edited P95 colors')
  const malformed = normalizeScatterAppearance({ magnitudeColors: ['invalid', '#abcdef', 42] })
  assert.deepEqual(malformed.magnitudeColors, [defaults.magnitudeColors[0], '#abcdef', defaults.magnitudeColors[2]])
  const snapshot = readScatterAppearance()
  assert.equal(readScatterAppearance(), snapshot, 'Unchanged shared snapshots retain React identity')
  for (const value of [snapshot, snapshot.grid, snapshot.levels, snapshot.levels[0], snapshot.customLevels, snapshot.magnitudeColors]) assert.ok(Object.isFrozen(value))
  assert.throws(() => { snapshot.customLevels[0].color = '#000000' }, TypeError)

  let renders = 0
  function Reader({ name }) {
    const appearance = useScatterAppearance()
    React.useEffect(() => { renders++ }, [appearance])
    return React.createElement('output', { 'data-reader': name }, appearance.magnitudeColors.join(','))
  }
  await React.act(async () => root.render(React.createElement(React.Fragment, null,
    React.createElement(Reader, { name: 'NFP' }), React.createElement(Reader, { name: 'CPI' }))))
  await React.act(async () => saveScatterAppearance(withMagnitudeBandColor(readScatterAppearance(), 1, '#aabbcc', true)))
  for (const output of container.querySelectorAll('output')) assert.match(output.textContent, /#aabbcc/)
  const saved = JSON.parse(localStorage.getItem(key))
  assert.equal(saved.magnitudeColors[1], '#aabbcc')
  assert.equal(saved.levels[1].color, '#aabbcc'); assert.equal(saved.customLevels[1].color, '#aabbcc')
  const freshModule = await server.ssrLoadModule(`${modulePath}?fresh-read`)
  assert.deepEqual(freshModule.readScatterAppearance().magnitudeColors, saved.magnitudeColors, 'A fresh module restores saved colors after reload')
  const beforeNoop = renders
  await React.act(async () => saveScatterAppearance(readScatterAppearance()))
  assert.equal(renders, beforeNoop, 'Identical saves cause no subscription update')
  const external = withMagnitudeBandColor(readScatterAppearance(), 0, '#f0e0d0', false)
  await React.act(async () => {
    localStorage.setItem(key, JSON.stringify(external))
    dom.dispatchEvent(new dom.StorageEvent('storage', { key }))
  })
  for (const output of container.querySelectorAll('output')) assert.match(output.textContent, /#f0e0d0/)
  const beforeUnrelated = renders
  await React.act(async () => dom.dispatchEvent(new dom.StorageEvent('storage', { key: 'unrelated' })))
  assert.equal(renders, beforeUnrelated)
  await React.act(async () => { localStorage.removeItem(key); dom.dispatchEvent(new dom.StorageEvent('storage', { key: null })) })
  assert.deepEqual(readScatterAppearance(), defaults)

  const prototype = Object.getPrototypeOf(dom.localStorage)
  const descriptors = Object.fromEntries(['getItem', 'setItem'].map((method) => [method, Object.getOwnPropertyDescriptor(prototype, method)]))
  try {
    Object.defineProperty(prototype, 'setItem', { configurable: true, value: () => { throw new Error('Unavailable') } })
    await React.act(async () => saveScatterAppearance(withMagnitudeBandColor(readScatterAppearance(), 2, '#c0ffee', true)))
    assert.equal(readScatterAppearance().magnitudeColors[2], '#c0ffee')
    for (const output of container.querySelectorAll('output')) assert.match(output.textContent, /#c0ffee/, 'Failed persistence still updates all mounted readers')
    Object.defineProperty(prototype, 'getItem', { configurable: true, value: () => { throw new Error('Unavailable') } })
    assert.equal(readScatterAppearance().magnitudeColors[2], '#c0ffee')
  } finally { for (const method of ['getItem', 'setItem']) Object.defineProperty(prototype, method, descriptors[method]) }
  await React.act(async () => root.render(null))
  const unmountedRenders = renders
  await React.act(async () => saveScatterAppearance(defaults))
  assert.equal(renders, unmountedRenders, 'Unmounted subscribers no longer receive updates')
  console.log('✓ Shared Custom/P95 palette migration, immutable snapshots, fresh reload persistence, mounted/cross-window sync, no-op saves, unavailable storage and cleanup')
} finally {
  await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
}
