import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root: directory, server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, localStorage: dom.localStorage, HTMLElement: dom.HTMLElement,
  Node: dom.Node, navigator: dom.navigator, IS_REACT_ACT_ENVIRONMENT: true }
const old = new Map([...Object.keys(globals), 'fetch', 'setTimeout', 'clearTimeout'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const timers = new Map(); let timerId = 0, requests = 0, malformed = false, lastSignal
const originalSetTimeout = globalThis.setTimeout, originalClearTimeout = globalThis.clearTimeout
const nativeTimers = new Set()
globalThis.setTimeout = (fn, ms, ...args) => { if (ms === 5000) { timers.set(++timerId, fn); return timerId } const id = originalSetTimeout(fn, ms, ...args); nativeTimers.add(id); return id }
globalThis.clearTimeout = id => { if (timers.has(id)) timers.delete(id); else originalClearTimeout(id) }
const payload = { version: 1, plans: [
  { id: 'research_test_audcad', symbol: 'AUDCAD', asOf: '2026-10-14T05:05:00Z', eventAt: '2026-10-15T00:30:00Z', note: 'AUDCAD buy backdrop. WAITING for jobs. SL and TP are manual.' },
  { id: 'research_test_eurusd', symbol: 'EURUSD', asOf: '2026-10-14T05:05:00Z', eventAt: '2026-10-14T12:30:00Z', note: 'EURUSD slight buy, waiting for CPI.' },
] }
let remote, applyOperations
const copy = value => JSON.parse(JSON.stringify(value))
globalThis.fetch = async (url, options = {}) => {
  assert.equal(url, '/entry-trade-api/journal', 'Journal sync does not fetch market data')
  requests++; lastSignal = options.signal
  if (options.method === 'POST') {
    const batch = JSON.parse(options.body)
    assert.equal(batch.expectedRevision, remote.revision)
    remote.arrows = applyOperations(remote.arrows, batch.operations)
    remote.revision++
  }
  return { ok: true, status: 200, json: async () => malformed ? { version: 1, arrows: [{}] } : copy(remote) }
}
const prior = { id: 'manual', symbol: 'EURUSD', time: 1791981000, direction: 'long', entryPrice: 1.1, tpPrice: 1.12,
  slPrice: 1.09, tpPips: 200, slPips: 100, rrRatio: 2, createdAt: 1791950000000, note: 'USER NOTE - preserve' }
localStorage.setItem('fyodor.registered_arrows.v1', JSON.stringify([prior]))
localStorage.setItem('trader_notebook_note_EURUSD', 'User draft note')
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
const props = element => element[Object.getOwnPropertyNames(element).find(key => key.startsWith('__reactProps$'))]
const click = element => React.act(async () => { assert.ok(element); element.click() })
const change = (id, value) => React.act(async () => props(container.querySelector(id)).onChange({ target: { value } }))
const poll = async () => { const [id, fn] = [...timers][0]; timers.delete(id); await React.act(async () => fn()) }
try {
  const { validArrow } = await server.ssrLoadModule('./src/entry-trade/storage/registered-arrow-validation.ts')
  const { useRegisteredArrows } = await server.ssrLoadModule('./src/entry-trade/storage/use-registered-arrows.ts')
  const { EntryTradePanel } = await server.ssrLoadModule('./src/entry-trade/dock/EntryTradePanel.tsx')
  const incoming = payload.plans.map(item => ({ id: item.id, symbol: item.symbol, eventAt: item.eventAt, note: item.note, createdAt: Date.parse(item.asOf),
    time: 0, direction: 'waiting', precision: 5, entryPrice: null, slPrice: null, tpPrice: null, slPips: null, tpPips: null, rrRatio: null }))
  const sync = await server.ssrLoadModule('./src/entry-trade/storage/journal-sync.ts')
  applyOperations = sync.applyJournalOperations
  remote = { version: 1, revision: 0, arrows: copy(incoming), deletedIds: [] }
  assert.ok(incoming.every(plan => validArrow(plan) && plan.direction === 'waiting' && plan.entryPrice === null && plan.slPrice === null && plan.tpPrice === null && plan.time === 0))
  function Harness() {
    const [symbol, setSymbol] = React.useState('EURUSD')
    const arrows = useRegisteredArrows(symbol, true)
    const [draft, setDraft] = React.useState({ direction: 'long', entryPrice: null, tpPrice: null, slPrice: null, showOnChart: false })
    return React.createElement(EntryTradePanel, { selectedSymbol: symbol, quotes: [], latestBarTime: 1792024200,
      plan: draft, quote: { symbol, bid: 1.1001, ask: 1.1003, precision: 5 }, registeredArrows: arrows.allArrows, selectedArrowId: arrows.selectedArrowId,
      importError: arrows.importError, saveStatus: arrows.saveStatus, onArchiveArrow: arrows.archiveArrow, onPlanChange: setDraft, onRegisterArrow: arrows.addArrow, onDeleteArrow: arrows.deleteArrow,
      onUpdateArrow: arrows.updateArrow, onSelectArrowId: id => { const item = arrows.allArrows.find(item => item.id === id); if (item) setSymbol(item.symbol); arrows.setSelectedArrowId(id) } })
  }
  await React.act(async () => root.render(React.createElement(Harness)))
  assert.equal(container.querySelectorAll('.pinned-arrow-row').length, 3)
  const stored = () => JSON.parse(localStorage.getItem('fyodor.registered_arrows.v1'))
  assert.deepEqual(stored().find(item => item.id === 'manual'), prior)
  assert.equal(localStorage.getItem('trader_notebook_note_EURUSD'), 'User draft note')
  await click(container.querySelector('[data-arrow-id="research_test_audcad"]'))
  for (const field of ['entry', 'sl', 'tp']) {
    const input = container.querySelector(`#plan-${field}`)
    assert.equal(input.value, ''); assert.equal(input.readOnly, false)
  }
  assert.ok(container.textContent.includes('7:30 AM'))
  const directionButton = label => [...container.querySelectorAll('.direction-segmented button')].find(node => node.textContent.trim() === label)
  await click(directionButton('LONG (BUY)'))
  assert.equal(stored().find(item => item.id === 'research_test_audcad').direction, 'long', 'Direction does not require completed technicals')
  assert.equal(container.querySelector('#plan-sl').value, '')
  await click(container.querySelector('.market-snap-btn'))
  assert.equal(container.querySelector('#plan-entry').value, '1.1003', 'Pinned long uses Ask')
  assert.equal(container.querySelector('#plan-tp').value, '', 'Use Market does not invent a TP')
  await click(directionButton('SHORT (SELL)')); await click(container.querySelector('.market-snap-btn'))
  assert.equal(container.querySelector('#plan-entry').value, '1.1001', 'Pinned short uses Bid')
  await click(directionButton('WAITING')); await click(container.querySelector('.market-snap-btn'))
  assert.equal(container.querySelector('#plan-entry').value, '1.1002', 'Waiting uses midpoint')
  const anchorBefore = stored().find(item => item.id === 'research_test_audcad').eventAt
  const setDate = (id, value) => React.act(async () => props(container.querySelector(id)).onChange({ target: { value } }))
  await setDate('#journal-arrow-date', '2026-10-18')
  await setDate('#journal-arrow-time', '08:15')
  await React.act(async () => props(container.querySelector('#journal-arrow-time')).onBlur())
  assert.equal(new Date(stored().find(item => item.id === 'research_test_audcad').time * 1000).toISOString(), '2026-10-18T01:15:00.000Z')
  assert.equal(stored().find(item => item.id === 'research_test_audcad').eventAt, anchorBefore, 'Arrow editing does not change the event anchor')
  assert.ok(container.querySelector('[data-arrow-id="research_test_audcad"] .pinned-date').textContent.includes('Oct 15'), 'Table date remains the event date')
  await setDate('#journal-event-title', 'Australia employment report')
  await setDate('#journal-event-time', '09:30')
  await React.act(async () => props(container.querySelector('#journal-event-time')).onBlur())
  assert.equal(stored().find(item => item.id === 'research_test_audcad').eventAt, '2026-10-15T02:30:00.000Z')
  assert.equal(stored().find(item => item.id === 'research_test_audcad').eventTitle, 'Australia employment report')
  assert.equal(stored().find(item => item.id === 'research_test_audcad').time, Date.parse('2026-10-18T01:15:00Z') / 1000)
  await click(container.querySelector('[aria-label="Sort by date"]'))
  assert.equal(container.querySelector('th[aria-sort="descending"] button').getAttribute('aria-label'), 'Sort by date')
  assert.equal(container.querySelector('.pinned-arrow-row').dataset.arrowId, 'research_test_audcad')
  await change('#plan-entry', '0.96'); await change('#plan-sl', '0.95'); await change('#plan-tp', '0.98')
  assert.equal(stored().find(item => item.id === 'research_test_audcad').direction, 'waiting')
  assert.ok(Math.abs(stored().find(item => item.id === 'research_test_audcad').rrRatio - 2) < 1e-9)
  await React.act(async () => props(container.querySelector('textarea')).onChange({ target: { value: 'User amended thesis' } }))
  await click(container.querySelector('.journal-save-row button'))
  const before = localStorage.getItem('fyodor.registered_arrows.v1')
  await poll()
  assert.equal(localStorage.getItem('fyodor.registered_arrows.v1'), before, 'Repeated import does not overwrite user levels, notes or directions')
  await React.act(async () => props(container.querySelector('textarea')).onChange({ target: { value: 'Unsaved note before archive' } }))
  assert.equal(container.querySelector('.pinned-arrow-row [aria-label="Archive arrow"]'), null, 'No archive controls on table rows')
  await click([...container.querySelectorAll('.selected-arrow-header-actions button')].find(node => node.textContent === 'Archive'))
  assert.equal(stored().find(item => item.id === 'research_test_audcad').archived, true)
  assert.equal(stored().find(item => item.id === 'research_test_audcad').note, 'Unsaved note before archive', 'Archive preserves the latest journal text')
  const archivedButton = () => [...container.querySelectorAll('.journal-table-toolbar button')].find(node => node.textContent.startsWith('Archived'))
  await click(archivedButton())
  assert.equal(container.querySelectorAll('.pinned-arrow-row').length, 1)
  await click(container.querySelector('[data-arrow-id="research_test_audcad"]'))
  await click([...container.querySelectorAll('.selected-arrow-header-actions button')].find(node => node.textContent === 'Restore'))
  assert.equal(stored().find(item => item.id === 'research_test_audcad').archived, false)
  await click([...container.querySelectorAll('.journal-table-toolbar button')].find(node => node.textContent.startsWith('Active')))
  await click(container.querySelector('[data-arrow-id="research_test_eurusd"] .pinned-delete-btn'))
  await poll(); assert.equal(stored().length, 2, 'Polling never resurrects a deleted thesis')
  malformed = true; await poll(); assert.ok(container.querySelector('[role="alert"]'))
  assert.equal(stored().length, 2, 'Malformed imports preserve saved plans')
  malformed = false; await poll(); assert.equal(container.querySelector('[role="alert"]'), null)
  await React.act(async () => root.unmount()); assert.equal(timers.size, 0); assert.ok(lastSignal.aborted)
  const reloaded = createRoot(container)
  localStorage.removeItem('fyodor.registered_arrows.v1')
  await React.act(async () => reloaded.render(React.createElement(Harness)))
  assert.equal(container.querySelectorAll('.pinned-arrow-row').length, 2, 'Repo restores entries without the browser cache')
  assert.equal(stored().find(item => item.id === 'research_test_audcad').note, 'Unsaved note before archive')
  assert.equal(stored().find(item => item.id === 'research_test_audcad').entryPrice, 0.96)
  assert.ok(container.querySelector('th[aria-sort="descending"]'), 'Date sort survives refresh')
  await React.act(async () => reloaded.unmount())
  assert.ok(requests >= 4)
  console.log('Entry Trade: repo migration/refresh, incomplete direction changes, market quote sides, date sorting, archive/restore, notes, deletion and cleanup passed.')
} finally {
  await React.act(async () => root.unmount())
  for (const id of nativeTimers) originalClearTimeout(id)
  for (const [key, descriptor] of old) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
  await server.close(); await dom.happyDOM.close()
}
