import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost:5173' }), timers = new Map(), frames = new Map(), observers = new Set()
let sequence = 0, copied = '', failure = 0, clipboardFailure = false, deferRead = false, deferred = null, historyReads = 0, writes = 0
const empty = () => ({ schema: 1, source_id: 'Pepperstone-Demo', revision: 0, rows: [] })
let saved = empty()
class ResizeObserver { constructor(fn) { this.fn = fn; observers.add(this) } observe() {} disconnect() { observers.delete(this) } }
const globals = { window: dom, document: dom.document, localStorage: dom.localStorage, navigator: dom.navigator,
  HTMLElement: dom.HTMLElement, Node: dom.Node, ResizeObserver, IS_REACT_ACT_ENVIRONMENT: true, __copyFormats: 0 }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
Object.defineProperty(dom.navigator, 'clipboard', { configurable: true, value: { writeText: async value => {
  if (clipboardFailure) throw new Error('Clipboard denied')
  copied = value
} } })
const originalNow = Date.now
Date.now = () => Date.parse('2026-11-12T12:00:00Z')
dom.setTimeout = (fn, ms) => { timers.set(++sequence, { fn, ms }); return sequence }
dom.clearTimeout = id => timers.delete(id)
dom.requestAnimationFrame = fn => { frames.set(++sequence, fn); return sequence }
dom.cancelAnimationFrame = id => frames.delete(id)
const stamp = date => Date.parse(`${date}T00:00:00Z`) / 1000
const bar = (date, close) => ({ time: stamp(date), open: close, high: close, low: close, close })
const response = (body, status = 200) => ({ ok: status === 200, status, json: async () => structuredClone(body) })
globalThis.fetch = async (url, options = {}) => {
  if (String(url).startsWith('/storage-api/cross-asset/wildcards')) {
    if (options.method === 'POST') {
      writes++
      if (failure) { const status = failure; failure = 0; return response({}, status) }
      const body = JSON.parse(options.body)
      if (body.expected_revision !== saved.revision) return response({}, 409)
      saved = { ...saved, revision: saved.revision + 1, rows: body.rows }
    } else if (deferRead) {
      deferRead = false
      return new Promise(resolve => { deferred = { resolve, signal: options.signal } })
    }
    return response(saved)
  }
  assert.equal(url, '/storage-api/cross-asset/history')
  historyReads++
  const body = JSON.parse(options.body)
  return response({ schema: 1, source_id: 'Pepperstone-Demo', generation: body.generation, year: body.year, today: '2026-11-12',
    observed_at: Date.now() / 1000, revision: 'a'.repeat(64), pending: 0,
    symbols: Object.fromEntries(body.symbols.map(symbol => [symbol, { availability: 'available', checked_at: Date.now() / 1000,
      bars: [bar('2026-10-30', 100), bar('2026-11-05', 100), bar('2026-11-06', symbol === 'US500' ? 102 : 99),
        bar('2026-11-12', symbol === 'US500' ? 103 : 98)] }])) })
}
localStorage.setItem('fyodor.cross-asset.v1:Pepperstone-Demo', JSON.stringify({ rows: ['symbol:US500', 'symbol:XAUUSD'] }))
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false },
  plugins: [{ name: 'copy-format-work', enforce: 'pre', transform(code, id) {
    if (id.endsWith('/heatmap-export.ts')) return code.replace('  const groups =', '  globalThis.__copyFormats++; const groups =')
  } }] })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host)
const root = createRoot(host)
const props = node => {
  const value = node[Object.getOwnPropertyNames(node).find(key => key.startsWith('__reactProps$'))]
  assert.ok(value, `${node.outerHTML} ${Object.getOwnPropertyNames(node).join(',')}`)
  return value
}
const click = node => React.act(async () => { assert.ok(node, 'Control exists'); node.click() })
const change = (node, value) => React.act(async () => {
  assert.ok(node)
  if (node.tagName === 'SELECT') { node.value = value; node.dispatchEvent(new dom.Event('change', { bubbles: true })) }
  else props(node).onChange({ target: { value } })
})
const button = label => [...host.querySelectorAll('button')].find(node => node.textContent === label)
const field = label => host.querySelector(`[aria-label="${label}"]`)
const flush = () => React.act(async () => { for (const [id, fn] of [...frames]) { frames.delete(id); fn() } })
try {
  const { heatmapChangesText, heatmapResearchPrompt } = await server.ssrLoadModule('./src/cross-asset/heatmap-export.ts')
  const { wildcardNotes, wildcardsMarkdown, validWildcardSnapshot } = await server.ssrLoadModule('./src/cross-asset/wildcards-model.ts')
  const { CrossAssetDock } = await server.ssrLoadModule('./src/cross-asset/CrossAssetDock.tsx')
  const rows = [{ id: 'one', label: 'A', group: 'Metals', points: new Map([['2026-11-06', { value: -1, relative: 99 }]]) },
    { id: 'two', label: 'B', group: 'Metals', points: new Map([['2026-11-06', { value: 2 }]]) },
    { id: 'three', label: 'C', group: 'Energy', points: new Map([['2026-11-06', { value: 0 }]]) },
    { id: 'missing', label: 'Missing', group: 'Other', points: new Map() }]
  assert.equal(heatmapChangesText(rows, '2026-11-06', 'daily', ['Energy', 'Metals']), '2026-11-06 · Daily\n\nEnergy\nC 0.00%\n\nMetals\nB +2.00%\nA -1.00%')
  assert.equal(heatmapChangesText(rows, '2026-11-02', 'weekly', []), '')
  const weeklyText = heatmapChangesText([{ ...rows[0], points: new Map([['2025-12-29', { value: 1 }]]) }], '2025-12-29', 'weekly', [])
  assert.ok(weeklyText.startsWith('2025-12-29 – 2026-01-04 · Weekly'))
  const weeklyPrompt = heatmapResearchPrompt(weeklyText, 'weekly', 'Pepperstone-Demo', Date.now())
  assert.ok(weeklyPrompt.includes('previous week’s final available close'))
  assert.ok(weeklyPrompt.includes('Copied 2026-11-12T12:00:00.000Z (UTC)'))
  assert.ok(weeklyPrompt.endsWith(weeklyText), 'Research context preserves weekly changes exactly, including year boundaries')
  assert.equal(heatmapResearchPrompt('', 'daily', 'Pepperstone-Demo', Date.now()), '')
  const multiRows = [{ ...rows[0], points: new Map([['2026-11-05', { value: 3 }], ['2026-11-06', { value: -1 }]]) }]
  const multiText = heatmapChangesText(multiRows, ['2026-11-06', '2026-11-07', '2026-11-05', '2026-11-06'], 'daily', [])
  assert.equal(multiText, '2026-11-05 · Daily\n\nMetals\nA +3.00%\n\n2026-11-06 · Daily\n\nMetals\nA -1.00%')
  const partialText = heatmapChangesText(multiRows, ['2026-11-05', '2026-11-06'], 'daily', [], '2026-11-06')
  assert.ok(partialText.includes('2026-11-05 · Daily\n'))
  assert.ok(partialText.includes('2026-11-06 · Daily · In progress (day to date)'))
  assert.equal(partialText.match(/In progress/g).length, 1, 'Only the unfinished day is marked in mixed ranges')
  const crossYearRow = { ...rows[0], points: new Map([['2025-12-29', { value: 1 }]]) }
  assert.ok(heatmapChangesText([crossYearRow], '2025-12-29', 'weekly', [], '2026-01-01').includes('2025-12-29 – 2026-01-04 · Weekly · In progress (week to date)'))
  assert.ok(!heatmapChangesText([crossYearRow], '2025-12-29', 'weekly', [], '2026-01-05').includes('In progress'), 'Past weeks stay completed after broker rollover')
  assert.ok(heatmapChangesText(multiRows, '2026-11-06', 'daily', [], '2026-11-06').includes('In progress'), 'Period status uses supplied broker date, independently of the copy clock')
  assert.equal(heatmapChangesText(multiRows, [], 'daily', []), '')
  const yearCrossing = { id: 'a'.repeat(32), title: 'Story', archived: true, notes: { '2026-01-02': 'January', '2025-12-29': 'December', '2026-01-05': 'Next week' } }
  assert.deepEqual(wildcardNotes(yearCrossing, '2025-12-29', 'weekly').map(([day]) => day), ['2025-12-29', '2026-01-02'])
  assert.deepEqual(wildcardNotes(yearCrossing, '2026-01-02', 'daily'), [['2026-01-02', 'January']])
  assert.ok(wildcardsMarkdown([yearCrossing]).includes('Story (archived)'))
  assert.equal(validWildcardSnapshot({ ...empty(), rows: [yearCrossing] }, 'Pepperstone-Demo'), true)
  for (const mutate of [body => body.source_id = 'Other', body => body.rows.push(body.rows[0]), body => body.rows[0].notes['2026-02-30'] = 'Invalid', body => body.revision = -1]) {
    const body = structuredClone({ ...empty(), rows: [yearCrossing] }); mutate(body)
    assert.equal(validWildcardSnapshot(body, 'Pepperstone-Demo'), false)
  }
  const quotes = ['US500', 'XAUUSD'].map(symbol => ({ symbol, description: symbol, bid: 1, ask: 1, precision: 2 }))
  const render = overrides => React.act(async () => root.render(React.createElement(CrossAssetDock, { symbols: quotes, broker: 'Pepperstone-Demo', generation: 2, ...overrides })))
  await render()
  await click(button('Copy Details Only'))
  assert.ok(copied.startsWith('2026-11-12 · Daily · In progress (day to date)'))
  await click(button('Copy Research Prompt'))
  assert.ok(copied.includes('provisional day/week-to-date changes to the latest available reading, not final closing returns'))
  assert.ok(copied.includes('Copy time is the export time, not the last market update'))
  assert.ok(copied.includes('2026-11-12 · Daily · In progress (day to date)'))
  await click(button('Copy range'))
  await change(field('Copy from date'), '2026-11-06')
  await click(button('Copy Research Prompt'))
  assert.ok(copied.includes('2026-11-06 · Daily\n'))
  assert.ok(copied.includes('2026-11-12 · Daily · In progress (day to date)'))
  await click(button('Single date'))
  await click(button('Weekly'))
  await click(button('Copy Research Prompt'))
  assert.ok(copied.includes('2026-11-09 – 2026-11-15 · Weekly · In progress (week to date)'))
  await click(button('Daily'))
  await change(field('Heatmap date'), '2026-11-06')
  await click(button('Copy Details Only'))
  assert.ok(copied.includes('US500 +2.00%'))
  assert.ok(copied.includes('XAUUSD -1.00%'))
  assert.ok(!/Wildcards|unavailable|volatility|research|7 counterparts/i.test(copied), 'Clipboard contains only dated changes')
  const singleDetails = copied, readsBeforePrompt = historyReads
  await click(button('Copy Research Prompt'))
  assert.ok(copied.startsWith('Research current opportunities as of when you run this prompt'))
  assert.ok(copied.includes('repricing may still be unfolding, including moves already underway'))
  assert.ok(copied.includes('buy/sell bias'))
  assert.ok(copied.includes('Reuters and Bloomberg'))
  assert.ok(copied.includes('without invoking repository research workflows'))
  assert.ok(copied.includes('Daily changes compare each broker D1 close'))
  assert.ok(copied.includes('equal-weight geometric returns'))
  assert.ok(copied.includes('distinct from broker USDX/EURX/JPYX'))
  assert.ok(copied.endsWith(singleDetails), 'Research button appends exactly the details-only selection')
  assert.ok(!/invalidation|confidence score|scenario tree/.test(copied), 'Research prompt stays focused without mandatory assessment sections')
  assert.equal(historyReads, readsBeforePrompt, 'Copying a prompt does no history fetching')
  assert.equal(writes, 0, 'Copying a prompt saves no notes')
  assert.ok(host.querySelector('.heatmap-copy-status').textContent.includes('Research prompt copied'))
  clipboardFailure = true
  await click(button('Copy Research Prompt'))
  assert.ok(host.querySelector('.heatmap-copy-status').textContent.includes('Clipboard unavailable'))
  clipboardFailure = false
  await click(button('Copy Details Only'))
  assert.equal(copied, singleDetails, 'Switching back to details omits the prompt and method definitions')
  await change(field('Ranking group'), 'Metals')
  await click(button('Copy Details Only'))
  assert.ok(copied.includes('US500 +2.00%'), 'Copy includes all selected instruments regardless of ranking filter')
  const readsBeforeRange = historyReads
  const formatsBeforeRange = globalThis.__copyFormats
  await click(button('Copy range'))
  await change(field('Copy from date'), '2026-11-05')
  await change(field('Copy through date'), '2026-11-07')
  assert.equal(globalThis.__copyFormats, formatsBeforeRange, 'Changing a range never formats the full export before Copy is clicked')
  assert.ok(host.querySelector('[data-heatmap-date="2026-11-05"]').classList.contains('copy-selected'))
  await click(button('Copy Details Only'))
  assert.ok(copied.indexOf('2026-11-05 · Daily') < copied.indexOf('2026-11-06 · Daily'))
  assert.ok(!copied.includes('2026-11-07'), 'No-readings days are omitted, not reported as zero')
  assert.ok(copied.includes('US500 0.00%'), 'True unchanged readings are retained')
  const rangeDetails = copied
  await click(button('Copy Research Prompt'))
  assert.ok(copied.endsWith(rangeDetails), 'Research export honors multiple dates and ranking-independent instrument selection')
  await change(field('Copy from date'), '2026-11-08')
  assert.equal(button('Copy Details Only').disabled, true, 'Reversed ranges cannot be copied')
  assert.equal(button('Copy Research Prompt').disabled, true, 'Reversed ranges cannot be copied into a research prompt')
  assert.ok(host.querySelector('[role="alert"]').textContent.includes('From must be'))
  await change(field('Copy from date'), '2026-11-05')
  await change(field('Copy through date'), '2027-01-01')
  assert.equal(field('Copy through date').value, '2026-11-07', 'Range inputs cannot claim unavailable years')
  await click(button('Single date'))
  assert.equal(field('Copy from date'), null)
  const shiftClick = node => React.act(async () => node.dispatchEvent(new dom.MouseEvent('click', { bubbles: true, shiftKey: true })))
  await shiftClick(host.querySelector('[data-heatmap-date="2026-11-05"]'))
  assert.equal(field('Copy from date').value, '2026-11-05')
  assert.equal(field('Copy through date').value, '2026-11-06')
  await shiftClick(host.querySelector('[data-heatmap-date="2026-11-07"]'))
  assert.equal(field('Copy from date').value, '2026-11-06', 'Repeated Shift-click keeps the initial anchor')
  assert.equal(field('Copy through date').value, '2026-11-07')
  await click(host.querySelector('[data-heatmap-date="2026-11-06"]'))
  assert.equal(field('Copy from date'), null, 'Ordinary date click returns to single-date copy')
  await click(button('Copy range'))
  await click(button('Weekly'))
  assert.equal(field('Copy from date'), null, 'Period changes reset the copy range')
  await click(button('Copy range'))
  await change(field('Copy from date'), '2026-10-29')
  assert.equal(field('Copy from date').value, '2026-10-26', 'Weekly dates normalize to Monday')
  await click(button('Copy Details Only'))
  assert.ok(copied.includes('2026-11-02 – 2026-11-08 · Weekly'))
  const selectedWeeklyDetails = copied
  await click(button('Copy Research Prompt'))
  assert.ok(copied.includes('Weekly changes compare each Monday–Sunday week'))
  assert.ok(!copied.includes('Daily changes compare'))
  assert.ok(copied.endsWith(selectedWeeklyDetails))
  assert.equal(historyReads, readsBeforeRange, 'Selecting and copying dates does no history fetching')
  await click(button('Daily'))
  await change(field('Heatmap date'), '2026-11-11')
  assert.equal(button('Copy Details Only').disabled, true)
  assert.equal(button('Copy Research Prompt').disabled, true, 'No-reading dates cannot produce a misleading data-free prompt')
  await change(field('Heatmap date'), '2026-11-06')
  await click(button('+ Add wildcard'))
  await change(field('Wildcard title'), 'Iran developments')
  await change(field('Wildcard details'), 'First paragraph.\n\nSecond paragraph.\nhttps://example.com/source')
  await click(button('Cancel'))
  assert.equal(writes, 0, 'Cancel creates no saved row')
  await click(button('+ Add wildcard'))
  await change(field('Wildcard title'), 'Iran developments')
  await change(field('Wildcard details'), 'First paragraph.\n\nSecond paragraph.\nhttps://example.com/source')
  failure = 503
  await click(button('Save'))
  assert.ok(field('Wildcard details').value.includes('\n\nSecond paragraph.'), 'Failed save retains paragraphs in draft')
  assert.ok(host.querySelector('[role="alert"]').textContent.includes('draft is retained'))
  await click(button('Save'))
  assert.equal(host.querySelector('[role="dialog"]'), null)
  const id = saved.rows[0].id
  assert.equal(saved.rows[0].notes['2026-11-06'], 'First paragraph.\n\nSecond paragraph.\nhttps://example.com/source')
  let cell = host.querySelector(`[data-wildcard-cell="${id}:2026-11-06"]`)
  assert.ok(cell.textContent.includes('▤'))
  assert.ok(cell.title.includes('Second paragraph.'))
  await click(cell)
  assert.equal(field('Wildcard title'), null, 'Editing a note does not rename its story')
  await change(field('Wildcard note date'), '2026-11-05')
  await change(field('Wildcard details'), 'Earlier development')
  await click(button('Save'))
  assert.equal(saved.rows[0].notes['2026-11-05'], 'Earlier development')
  assert.ok(saved.rows[0].notes['2026-11-06'].includes('Second paragraph.'))
  await click(button('Weekly'))
  cell = host.querySelector(`[data-wildcard-cell="${id}:2026-11-02"]`)
  assert.equal(cell.textContent, '▤ 2')
  await click(cell)
  assert.equal(field('Wildcard note date').value, '2026-11-05', 'Weekly editor opens earliest dated note')
  await click(button('2026-11-06'))
  assert.ok(field('Wildcard details').value.includes('Second paragraph.'))
  await click(button('Copy note'))
  assert.ok(copied.startsWith('Iran developments\n2026-11-06\n\nFirst paragraph.'))
  await change(field('Wildcard details'), 'Changed draft')
  saved = { ...saved, revision: saved.revision + 1 }
  await click(button('Save'))
  assert.ok(host.querySelector('[role="alert"]').textContent.includes('changed elsewhere'))
  assert.equal(field('Wildcard details').value, 'Changed draft')
  await click(button('Cancel'))
  await click(button('Reload Wildcards'))
  await click(button('Manage Wildcards'))
  await change(field('Rename wildcard Iran developments'), 'Energy developments')
  await click(button('Archive'))
  await click(button('Save'))
  assert.equal(saved.rows[0].title, 'Energy developments')
  assert.equal(saved.rows[0].archived, true)
  assert.equal(host.querySelector(`[data-wildcard-cell="${id}:2026-11-02"]`), null)
  await click(button('Manage Wildcards'))
  await click(button('Restore'))
  await click(button('Cancel'))
  assert.equal(saved.rows[0].archived, true, 'Cancel discards manager drafts')
  await click(button('Manage Wildcards'))
  await click(button('Restore'))
  await click(button('Save'))
  assert.ok(host.querySelector(`[data-wildcard-cell="${id}:2026-11-02"]`))
  await click(button('+ Add wildcard'))
  await change(field('Wildcard title'), 'Tariff negotiations')
  await change(field('Wildcard details'), 'Another story')
  await click(button('Save'))
  await click(button('Manage Wildcards'))
  await click(field('Move wildcard Tariff negotiations up'))
  await click(button('Save'))
  assert.equal(saved.rows[0].title, 'Tariff negotiations')
  await click(button('Manage Wildcards'))
  await click(field('Delete wildcard Energy developments'))
  assert.ok(host.querySelector('.wildcard-delete').textContent.includes('all 2 dated notes'))
  await click(button('Keep row'))
  await click(field('Delete wildcard Energy developments'))
  await click(button('Delete row and all its notes'))
  await click(button('Cancel'))
  assert.equal(saved.rows.length, 2, 'Confirmed deletion is still a draft until Save')
  await click(button('Manage Wildcards'))
  await click(field('Delete wildcard Energy developments'))
  await click(button('Delete row and all its notes'))
  await click(button('Save'))
  assert.equal(saved.rows.length, 1)
  const readsBefore = historyReads
  await render({ active: false })
  await render()
  assert.equal(historyReads, readsBefore, 'Notes and their edits never reload instrument history')
  assert.ok(host.textContent.includes('Tariff negotiations'))
  // A reload/connection change must abort stale reads and preserve the new scope.
  deferRead = true
  await click(button('Reload Wildcards'))
  const stale = deferred
  await render({ generation: 3 })
  assert.equal(stale.signal.aborted, true)
  await React.act(async () => stale.resolve(response({ ...empty(), rows: [yearCrossing] })))
  assert.ok(!host.textContent.includes('Story'))
  await click(button('Daily'))
  await change(field('Heatmap date'), '2026-11-02')
  await click(host.querySelector(`[data-wildcard-cell="${saved.rows[0].id}:2026-11-02"]`))
  await change(field('Wildcard details'), '')
  await click(button('Save'))
  assert.equal(saved.rows[0].notes['2026-11-02'], undefined, 'Blank details remove just that dated note')
  deferRead = true
  await click(button('Reload Wildcards'))
  const lastRead = deferred
  await React.act(async () => root.unmount())
  assert.equal(lastRead.signal.aborted, true)
  await React.act(async () => lastRead.resolve(response(saved)))
  await flush()
  assert.equal(observers.size, 0)
  assert.equal(timers.size, 0)
  assert.equal(frames.size, 0)
  console.log('✓ Cross-asset Wildcards: changes-only copy, dated paragraphs, weekly notes, drafts, failures/conflicts, row lifecycle, persistence and cancellation')
} finally {
  Date.now = originalNow
  await server.close(); dom.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
