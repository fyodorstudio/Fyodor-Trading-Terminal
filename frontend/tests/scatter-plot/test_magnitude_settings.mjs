import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const server = await createServer({ root: rootDir, server: { middlewareMode: true } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']
const previous = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.appendChild(container)
const root = createRoot(container)

try {
  const { createMagnitudeSettingsStore, magnitudeSettingsKey, magnitudeConfiguration } = await server.ssrLoadModule('./src/inspector/magnitude/settings/magnitude-settings-store.ts')
  const { MagnitudeBoundaryEditor } = await server.ssrLoadModule('./src/scatter-plot/settings/MagnitudeBoundaryEditor.tsx')
  const scope = { pair: 'EURUSD', currency: 'USD', side: 'QUOTE', family: 'NFP' }
  const first = createMagnitudeSettingsStore(scope, ['shared-id', 'other'])
  assert.equal(magnitudeConfiguration(first.read(), 'shared-id').mode, 'undefined')
  localStorage.setItem(first.key, JSON.stringify({ 'shared-id': 'p95', other: [1, 2, 3] }))
  assert.deepEqual(first.read(), { other: [1, 2, 3] }, 'Legacy P95 becomes Undefined; manual values survive')
  assert.throws(() => first.save('shared-id', 'p95'), RangeError, 'Automatic mode is removed')
  first.save('other', null)
  assert.equal(first.key, 'fyodor.scatter-plot.EURUSD.USD.QUOTE.NFP.magnitude.v1', 'Existing saved settings retain their key')
  const others = [{ ...scope, pair: 'GBPUSD' }, { ...scope, currency: 'EUR' },
    { ...scope, side: 'BASE' }, { ...scope, family: 'CPI' }].map((value) => createMagnitudeSettingsStore(value, ['shared-id']))
  assert.equal(new Set([first, ...others].map((store) => store.key)).size, 5)
  assert.notEqual(magnitudeSettingsKey({ ...scope, pair: 'A.B', currency: 'C' }),
    magnitudeSettingsKey({ ...scope, pair: 'A', currency: 'B.C' }), 'Scope separators cannot collide')
  first.save('shared-id', [1, 4, 10])
  for (const store of others) assert.deepEqual(store.read(), {}, 'The same series ID in another scope cannot inherit boundaries')
  others[0].save('shared-id', [2, 5, 15])
  assert.deepEqual(first.read()['shared-id'], [1, 4, 10])
  const snapshot = first.read()
  assert.ok(Object.isFrozen(snapshot)); assert.ok(Object.isFrozen(snapshot['shared-id']))
  assert.throws(() => { snapshot['shared-id'][0] = 100 }, TypeError, 'Consumers cannot corrupt shared boundaries')
  assert.equal(first.read(), snapshot, 'Unchanged snapshots keep stable React identity')
  assert.throws(() => first.save('unsupported', [1, 2, 3]), RangeError)
  assert.throws(() => first.save('shared-id', [1, 1, 2]), RangeError)
  let changed = 0
  const unsubscribe = first.subscribe(() => changed++)
  first.save('shared-id', [1, 4, 10]); first.save('other', null)
  assert.equal(changed, 0, 'Identical saves and empty resets do not publish redundant updates')
  first.save('other', [2, 3, 5]); assert.equal(changed, 1)
  dom.dispatchEvent(new dom.StorageEvent('storage', { key: others[0].key }))
  assert.equal(changed, 1, 'Storage events from another scope are ignored')
  localStorage.setItem(first.key, JSON.stringify({ 'shared-id': [3, 6, 12], other: [0, 0, 0], unsupported: [1, 2, 3] }))
  dom.dispatchEvent(new dom.StorageEvent('storage', { key: first.key }))
  assert.equal(changed, 2)
  assert.deepEqual(first.read(), { 'shared-id': [3, 6, 12] }, 'External settings are validated before use')
  localStorage.removeItem(first.key)
  dom.dispatchEvent(new dom.StorageEvent('storage', { key: null }))
  assert.deepEqual(first.read(), {}, 'Clearing external storage removes saved boundaries')
  assert.equal(changed, 3)
  unsubscribe(); first.save('shared-id', [1, 2, 3]); assert.equal(changed, 3, 'Unsubscription removes listeners')

  const session = createMagnitudeSettingsStore({ ...scope, family: 'storage-failure-test' }, ['x'])
  const storage = Object.getPrototypeOf(dom.localStorage)
  const descriptors = Object.fromEntries(['getItem', 'setItem'].map((method) => [method, Object.getOwnPropertyDescriptor(storage, method)]))
  try {
    Object.defineProperty(storage, 'setItem', { configurable: true, value: () => { throw new Error('Storage unavailable') } })
    session.save('x', [1, 2, 4])
    assert.deepEqual(session.read(), { x: [1, 2, 4] }, 'Failed persistence still retains the shared session snapshot')
    Object.defineProperty(storage, 'getItem', { configurable: true, value: () => { throw new Error('Storage unavailable') } })
    assert.deepEqual(session.read(), { x: [1, 2, 4] })
    session.save('x', null); assert.deepEqual(session.read(), {})
  } finally {
    for (const method of ['getItem', 'setItem']) {
      Object.defineProperty(storage, method, descriptors[method])
    }
  }
  console.log('✓ Scope/series isolation, existing settings compatibility, immutable snapshots, cross-window validation, no-op saves, cleanup and unavailable storage')

  let applied = null
  const render = (limits, key = 'same') => React.act(async () => root.render(React.createElement(MagnitudeBoundaryEditor,
    { key, limits, mode: 'custom', custom: false, unit: 'k', onApply: (value) => { applied = value }, onReset: () => {} })))
  const input = (size) => container.querySelector(`[aria-label="${size} upper boundary"]`)
  const change = (size, value) => React.act(async () => {
    const element = input(size)
    Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, 'value').set.call(element, String(value))
    element.dispatchEvent(new dom.Event('input', { bubbles: true }))
    element.dispatchEvent(new dom.Event('change', { bubbles: true }))
  })
  await render([1, 2, 4]); await render([2, 5, 8])
  assert.deepEqual(['Small', 'Medium', 'Large'].map((size) => input(size).value), ['2', '5', '8'], 'Untouched suggestions refresh with their baseline')
  await change('Small', 3); await render([2, 6, 9])
  assert.deepEqual(['Small', 'Medium', 'Large'].map((size) => input(size).value), ['3', '5', '8'], 'Polling preserves an in-progress draft')
  await React.act(async () => container.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.deepEqual(applied, [3, 5, 8])
  await render([10, 20, 30], 'new-broker')
  assert.equal(input('Small').value, '10', 'A changed selection scope starts its own draft')
  await change('Medium', 10)
  assert.ok([...container.querySelectorAll('button')].find((button) => button.textContent === 'Freeze').disabled)
  applied = null
  await React.act(async () => container.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(applied, null, 'Invalid drafts cannot apply even through programmatic submit')
  await React.act(async () => root.render(React.createElement(MagnitudeBoundaryEditor,
    { key: 'frozen', limits: [1, 2, 4], mode: 'custom', custom: true, unit: 'k', onApply: (value) => { applied = value }, onReset: () => {} })))
  assert.ok(input('Small').disabled, 'Saved manual configuration opens frozen')
  applied = null
  await React.act(async () => container.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(applied, null, 'Frozen configuration rejects programmatic edits')
  const toggle = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Unfreeze')
  await React.act(async () => toggle.click())
  // Model the browser's post-click default action after React updates the node.
  // Reusing an ordinary button as a submit button must not refreeze the draft.
  if (toggle.type === 'submit') await React.act(async () => toggle.form.requestSubmit(toggle))
  assert.equal(toggle.type, 'button', 'Unfreeze never becomes a submit button during the click')
  assert.equal(input('Small').disabled, false)
  await change('Small', .5)
  assert.equal(applied, null, 'Unfreezing/drafting never changes the saved classification')
  await React.act(async () => container.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.deepEqual(applied, [.5, 2, 4])
  assert.ok(input('Small').disabled, 'Freeze locks all manual inputs again')
  for (const value of [.6, .7]) {
    await React.act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Unfreeze').click())
    assert.equal(input('Small').disabled, false, 'Every Unfreeze cycle unlocks the numeric inputs')
    await change('Small', value)
    await React.act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Freeze').click())
    assert.deepEqual(applied, [value, 2, 4])
    assert.ok(input('Small').disabled)
    assert.equal([...container.querySelectorAll('button')].find((button) => button.textContent === 'Unfreeze').disabled, false)
  }
  console.log('✓ Untouched baseline refresh, in-progress draft preservation, scope reset and invalid-submit protection')
} finally {
  await React.act(async () => root.unmount())
  await server.close()
  await dom.happyDOM.abort(); dom.close()
  for (const key of keys) {
    if (previous[key]) Object.defineProperty(globalThis, key, previous[key])
    else delete globalThis[key]
  }
}
