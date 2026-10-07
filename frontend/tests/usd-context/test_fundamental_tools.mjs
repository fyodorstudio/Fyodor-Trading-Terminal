import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT', 'Worker', 'fetch']
const previous = Object.fromEntries(keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
for (const key of keys.slice(0, 7)) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
let jobs = 0, requests = 0, chartRenders = 0, toggles = 0
globalThis.Worker = class { constructor() { jobs++ } }
globalThis.fetch = async () => { requests++; throw new Error('Settings must not fetch history') }
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
const ChartBoundary = React.memo(() => { chartRenders++; return React.createElement('div', { 'aria-label': 'Unrelated chart boundary' }) })
try {
  const load = p => server.ssrLoadModule('./src/' + p)
  const { ChartWorkspaceHeader } = await load('terminal-shell/ChartWorkspaceHeader.tsx')
  const sequence = await load('usd-context/sequences/storage/sequence-preferences.ts')
  const notes = await load('external-events/storage/external-event-store.ts')
  const workspace = await load('workspace-portability/workspace-snapshot.ts')
  const session = await load('fundamental-tools/runtime/inspection-session.ts')
  sequence.saveSequencePreferences({ roofs: false, fresh: true, ribbon: false })
  const props = { symbol: 'EURUSD', quote: null, timeframe: 'H1', onSelectTimeframe() {}, drawingToolbarVisible: true,
    onToggleDrawingToolbar() {}, raycasterVisible: false, raycasterSupported: true, onToggleRaycaster: () => toggles++,
    brokerId: 'A', brokerOffsetSeconds: 10800, clockOffsetMs: Date.UTC(2026, 4, 28, 12) - Date.now(), timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 } }
  const render = next => React.act(async () => root.render(React.createElement(React.Fragment, null,
    React.createElement(ChartWorkspaceHeader, next ?? props), React.createElement(ChartBoundary))))
  const click = element => React.act(async () => element.click())
  const gear = () => host.querySelector('[aria-label="Fundamental tools settings"]')
  const panel = () => host.querySelector('[aria-label="Fundamental tools settings"][role="dialog"]')
  const tab = name => [...host.querySelectorAll('[role="tab"]')].find(b => b.textContent === name)
  await render()
  const group = host.querySelector('[aria-label="Fundamental tools"]'), buttons = [...group.children].filter(e => e.tagName === 'BUTTON')
  assert.equal(buttons.length, 4)
  assert.ok(buttons.every(b => b.querySelector('svg') && b.textContent === ''), 'Four matching SVG controls, no emoji or text buttons')
  assert.equal(host.querySelector('.chart-toolbar-center [aria-label="Fundamental tools"]'), null)
  assert.ok(host.querySelector('.chart-toolbar-center [aria-label="Hide drawing toolbar"]'))
  assert.equal(group.closest('.chart-toolbar-right').lastElementChild.className, 'quote-summary')
  await click(host.querySelector('[aria-label="Show Raycaster"]')); assert.equal(toggles, 1)
  await click(gear())
  assert.ok(panel()); assert.equal(document.activeElement, panel())
  assert.deepEqual(sequence.readSequencePreferences(), { roofs: false, fresh: true, ribbon: false }, 'Opening settings changes no view visibility')
  assert.equal(jobs, 0); assert.equal(requests, 0)
  assert.deepEqual([...panel().querySelectorAll('[role="tab"]')].map(b => b.textContent), ['Raycaster', 'Roofs', 'Candy'])
  await React.act(async () => tab('Raycaster').dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
  assert.equal(tab('Roofs').getAttribute('aria-selected'), 'true'); assert.equal(document.activeElement, tab('Roofs'))
  assert.match(panel().textContent, /filled dot.*width is not an active duration/)
  const density = panel().querySelector('[aria-label="Roof display density"]')
  await React.act(async () => { density.value = 'all'; density.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(sequence.readSequencePreferences().density, 'all')
  assert.equal(host.querySelector('.combo-roof-density'), null)
  const snapshot = workspace.exportWorkspace()
  assert.equal(JSON.parse(snapshot.entries[sequence.sequencePreferencesKey]).density, 'all')
  assert.throws(() => workspace.parseWorkspaceSnapshot(JSON.stringify({ ...snapshot, entries: { [sequence.sequencePreferencesKey]: '{"roofs":true,"fresh":true,"density":"invalid"}' } })), /Invalid/)
  await click(tab('Candy')); assert.match(panel().textContent, /same|Both share/)
  const mode = panel().querySelector('[aria-label="Shared Raycaster and Candy context view"]')
  await React.act(async () => { mode.value = 'relative'; mode.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(jobs, 0); assert.equal(requests, 0, 'Shared controls with hidden views do not start calculation jobs')
  const signature = 'test', inspection = { usd: null, eur: null, fresh: null, cutoff: null, loading: false, message: null, held: false, signature,
    window: { from: Date.UTC(2026, 4, 1), to: Date.UTC(2026, 4, 2) } }
  await React.act(async () => session.publishInspection(session.toolScope('A', 'EURUSD', 'H1'), inspection))
  await click([...panel().querySelectorAll('button')].find(b => b.textContent === 'Manage outside events'))
  assert.equal(panel().querySelectorAll('[role="dialog"]').length, 0, 'The editor is embedded in the one gear popover')
  const editor = panel().querySelector('[aria-label="Manual outside events"]'), inputs = editor.querySelectorAll('input')
  assert.equal(inputs[1].value, '2026-05-01T00:00', 'Annotation defaults use the captured chart window when available')
  const setValue = (element, value) => React.act(async () => { Object.getOwnPropertyDescriptor(element.constructor.prototype, 'value').set.call(element, value); element.dispatchEvent(new dom.Event('input', { bubbles: true })) })
  await setValue(inputs[0], 'Manual outside example')
  await React.act(async () => editor.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(notes.readExternalEvents()[0].symbol, 'EURUSD'); assert.equal(notes.readExternalEvents()[0].brokerId, 'A')
  assert.equal(notes.readExternalEvents()[0].from, inspection.window.from)
  assert.match(editor.querySelector('[role="status"]').textContent, /Saved locally/)
  assert.equal(sequence.readSequencePreferences().ribbon, false, 'Manual editing works with Candy hidden and leaves it hidden')
  await click(editor.querySelector('[aria-label="Back to tool settings"]'))
  assert.equal(tab('Candy').getAttribute('aria-selected'), 'true')
  await React.act(async () => panel().dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(panel(), null); assert.equal(document.activeElement, gear())
  await click(gear()); await click(tab('Roofs'))
  assert.equal(panel().querySelector('[aria-label="Roof display density"]').value, 'all')
  await React.act(async () => document.body.dispatchEvent(new dom.PointerEvent('pointerdown', { bubbles: true })))
  assert.equal(panel(), null)
  await click(gear()); await render({ ...props, symbol: 'USDJPY' }); assert.equal(panel(), null)
  await render(); assert.equal(panel(), null, 'Returning to a former scope cannot revive its popover')
  await click(gear()); await render({ ...props, brokerId: 'B' }); assert.equal(panel(), null)
  await render({ ...props, brokerId: null }); await click(gear())
  assert.equal([...panel().querySelectorAll('button')].find(b => b.textContent === 'Manage outside events').disabled, true)
  await render({ ...props, timeframe: 'M15' }); assert.equal(panel(), null)
  assert.equal(chartRenders, 1, 'Popover interactions and session readings never rerender the chart boundary')
  assert.equal(jobs, 0); assert.equal(requests, 0)
  console.log('✓ Right-side outlined SVG tools, one accessible tabbed settings popover, hidden-view annotations, saved density, scope/focus isolation and no chart renders or calculation jobs')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
