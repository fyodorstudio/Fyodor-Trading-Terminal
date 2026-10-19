import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

// Headless component contract, not a browser or visual audit.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root: frontend, server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, localStorage: dom.localStorage, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
let id = 0, revision = 'one', offline = false, malformed = false, hold = false
const timers = new Map(), requests = [], held = []
const downloads = [], blobs = [], revoked = []
const originalCreateUrl = URL.createObjectURL, originalRevokeUrl = URL.revokeObjectURL
const originalAnchorClick = dom.HTMLAnchorElement.prototype.click
let failDownload = false
URL.createObjectURL = blob => { blobs.push(blob); return `blob:thesis-test-${blobs.length}` }
URL.revokeObjectURL = url => revoked.push(url)
dom.HTMLAnchorElement.prototype.click = function () {
  downloads.push({ filename: this.download, href: this.href })
  if (failDownload) throw new Error('Download blocked fixture')
}
const realNow = Date.now
Date.now = () => Date.parse('2026-07-16T05:59:59Z')
dom.setTimeout = (fn, ms) => { timers.set(++id, { fn, ms }); return id }
dom.clearTimeout = key => timers.delete(key)
const allEntries = JSON.parse(fs.readFileSync(path.join(frontend, '../Market Analyst Workflow/thesis/journal.json'), 'utf8')).entries
const seed = allEntries.filter(entry => entry.as_of_utc.startsWith('2026-07'))
const octoberByRow = new Map()
for (const entry of allEntries.filter(entry => entry.as_of_utc.startsWith('2026-10') && entry.collection !== 'across')) {
  const previous = octoberByRow.get(entry.row_id)
  const prior = allEntries.find(value => value.id === entry.compared_with)
  octoberByRow.set(entry.row_id, { ...entry, versions: [...(previous?.versions ?? []), entry], comparison: prior ? { id: prior.id, as_of_utc: prior.as_of_utc, verdict: prior.verdict } : null })
}
const october = [...octoberByRow.values()].sort((a, b) => b.as_of_utc.localeCompare(a.as_of_utc))
const acrossRows = [['EURCHF', 'STRONG SELL', '2026-10-19T08:00:00Z'], ['AUDJPY', 'SELL', '2026-10-19T08:00:00Z'], ['USDCAD', 'MIXED', '2026-10-17T18:00:00Z']].map(([scope, verdict, as_of_utc], index) => {
  const entry = { ...seed[0], id: String(index + 1).repeat(32), row_id: String(index + 4).repeat(32), scope, verdict, as_of_utc,
    collection: 'across', title: 'Weekly opportunity', thesis: `Supported ${scope} mechanism.`, provenance: 'assessment' }
  return { ...entry, versions: [entry] }
})
const plan = JSON.parse(fs.readFileSync(path.join(frontend, '../Market Analyst Workflow/thesis/plan.json'), 'utf8'))
const planned = plan.days.map(day => ({ ...day, checked_utc: plan.checked_utc, events: day.events.map(event => ({
  note: '', ...event, sources: event.sources.map(source => ({ note: '', ...source })) })) }))
let past = [...seed].reverse().map(entry => ({ ...entry, versions: [entry] }))
let showReviews = false
const conditional = { ...acrossRows[0], id: '8'.repeat(32), row_id: '9'.repeat(32), scope: 'NZDCHF', verdict: 'MIXED', thesis: 'Earlier NZD selling case weakened.' }
conditional.versions = [{ ...conditional }]
const reviewEntry = { id: 'a'.repeat(32), review_id: 'b'.repeat(32), expected_version: null, scope: 'ALL',
  as_of_utc: '2026-10-19T08:00:00Z', saved_utc: '2026-10-19T09:00:00Z', horizon: 'This week', provenance: 'assessment',
  takeaway: 'EURCHF leads. Blanket NZD selling is no longer a leading opportunity.', limitations: 'One source gap remains.', note: 'Dated review fixture.',
  opportunity_ids: [acrossRows[0].id, acrossRows[1].id, conditional.id],
  backdrop: ['USD','EUR','GBP','JPY','CHF','CAD','AUD','NZD'].flatMap(currency => ['policy','inflation','labor','growth','other'].map(category => ({ currency, category, gap: '', evidence: [{ published_on: '2026-07-01', summary: `${currency} ${category} dated evidence.`, verified_utc: '2026-10-19T07:00:00Z', publication_note: '', sources: [{ kind: 'web', label: 'Official release', locator: 'https://example.com/source', note: '' }] }] }))) }
const review = { ...reviewEntry, versions: [reviewEntry], opportunities: [acrossRows[0], acrossRows[1], conditional] }
const response = route => {
  if (offline) return { ok: false, status: 503, json: async () => ({}) }
  const scope = route.searchParams.get('scope'), sourceId = route.searchParams.get('source_id')
  const month = route.searchParams.get('month')
  const base = { schema: 1, scope, month, source_id: sourceId, revision }
  return { ok: true, json: async () => route.searchParams.get('after_revision') === revision ? { ...base, unchanged: true }
    : { ...base, planned: scope === 'NZDCHF' && month === '2026-10' ? planned.filter(day => !october.some(row =>
      new Date(Date.parse(row.as_of_utc) + 7 * 3600000).toISOString().slice(0, 10) === day.date)) : [],
      reviews: showReviews && scope === 'ALL' && month === '2026-10' ? [review] : [],
      past: malformed ? [{}] : scope === 'ALL' && month === '2026-10' ? acrossRows : scope === 'NZDCHF' ? month === '2026-10' ? october : past : [] } }
}
globalThis.fetch = async (url, options = {}) => {
  const route = new URL(String(url), 'http://localhost'); requests.push({ route, options })
  if (hold) return new Promise(resolve => held.push({ resolve, route, options }))
  return response(route)
}
let copied = ''
Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { copied = value } } })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.append(container)
const root = createRoot(container)
const click = node => React.act(async () => { assert.ok(node); node.click() })
const button = text => [...container.querySelectorAll('button')].find(node => node.textContent === text)
const poll = async () => {
  const [key, timer] = [...timers].find(([, value]) => value.ms === 5000)
  timers.delete(key); await React.act(async () => timer.fn())
}
const startPoll = () => React.act(async () => {
  const [key, timer] = [...timers].find(([, value]) => value.ms === 5000)
  timers.delete(key); void timer.fn()
})
try {
  const { ThesisDock } = await server.ssrLoadModule('./src/thesis/ThesisDock.tsx')
  const { thesisPrompt, validThesisSnapshot, readThesisMonth } = await server.ssrLoadModule('./src/thesis/thesis-model.ts')
  const { thesisMarkdown } = await server.ssrLoadModule('./src/thesis/thesis-export.ts')
  assert.equal(readThesisMonth(), '2026-10', 'New preferences default to the requested October dataset')
  localStorage.setItem('fyodor.thesis.month.v1', '2026-07')
  await React.act(async () => root.render(React.createElement(ThesisDock)))
  assert.equal(container.querySelector('[aria-label="Thesis pair"]').value, 'NZDCHF')
  assert.equal(container.querySelectorAll('[aria-label="Thesis pair"] option').length, 28)
  assert.deepEqual([...container.querySelector('[aria-label="Thesis month"]').options].map(option => option.textContent), ['JUL 2026', 'OCT 2026'])
  const rows = () => [...container.querySelectorAll('[data-thesis-row]')]
  assert.equal(rows().length, 15)
  assert.ok(rows()[0].textContent.includes('Jul 15, Wed'))
  assert.ok(rows().at(-1).textContent.includes('Jul 1, Wed'))
  assert.ok(rows()[0].textContent.includes('1:00 PM'))
  assert.ok(container.querySelectorAll('a[href^="https://"]').length > 15)
  assert.ok([...container.querySelectorAll('a')].every(node => node.rel.includes('noopener')))
  assert.equal(container.querySelectorAll('table').length, 1)
  assert.equal(container.querySelector('[aria-label="Upcoming highlighted events"]'), null)
  assert.ok(!container.textContent.includes('Upcoming rows follow active pins'))
  assert.ok(!container.textContent.includes('MT5 Highlight rows need'))
  assert.equal(button('Copy release prompt'), undefined)
  assert.equal(button('Refresh'), undefined)
  const requestsBeforeExport = requests.length
  await click(button('Export Markdown'))
  assert.equal(requests.length, requestsBeforeExport, 'Export uses loaded text without new research/network calls')
  assert.equal(downloads.at(-1).filename, 'thesis-NZDCHF-2026-07.md')
  assert.ok(blobs.at(-1).type.startsWith('text/markdown'))
  let markdown = await blobs.at(-1).text()
  assert.ok(markdown.includes('## Continue with another AI'))
  assert.ok(markdown.includes('No mandatory entry-date gate'))
  assert.ok(markdown.includes('price-blind'))
  assert.ok(markdown.includes(seed[0].id))
  assert.ok(markdown.includes(seed[0].sources[0].locator))
  assert.equal(revoked.at(-1), downloads.at(-1).href)
  assert.equal(document.querySelector('a[download]'), null, 'Download anchors are removed')
  failDownload = true; await click(button('Export Markdown')); failDownload = false
  assert.ok(container.textContent.includes('Could not export Markdown'))
  assert.equal(revoked.length, blobs.length, 'Object URLs are released on download failure too')
  await click(button('Copy assessment prompt'))
  assert.ok(copied.includes('$assess-trade-now'))
  assert.ok(copied.includes('target null'))
  const originalRow = rows()[0]
  originalRow.querySelector('details').open = true
  await poll()
  assert.equal(rows()[0], originalRow)
  assert.equal(rows()[0].querySelector('details').open, true, 'Unchanged polls retain expanded details')
  const target = { kind: 'highlight', reference: 'a'.repeat(32), source_id: 'Broker', event_at: '2026-07-16T06:00:00Z', event_date: null }
  const entry = { ...seed[0], id: 'b'.repeat(32), row_id: 'c'.repeat(32), as_of_utc: '2026-07-16T06:00:01Z', saved_utc: '2026-07-16T06:00:02Z',
    title: 'Decision assessment', target, provenance: 'assessment', note: '', verdict: 'SELL', thesis: 'Fresh supported release thesis.' }
  const corrected = { ...entry, id: 'd'.repeat(32), expected_version: entry.id, verdict: 'BUY', thesis: 'Verified correction.' }
  past = [{ ...corrected, versions: [entry, corrected] }, ...past]; revision = 'two'
  await poll()
  assert.equal(rows().length, 16)
  await click(button('Export Markdown'))
  markdown = await blobs.at(-1).text()
  assert.ok(markdown.includes('Earlier version (superseded)'))
  assert.ok(markdown.includes('Fresh supported release thesis.'))
  assert.ok(markdown.includes('Verified correction.'))
  assert.equal(rows()[1], originalRow, 'Unchanged past rows survive a different release update')
  assert.ok(rows()[0].textContent.includes('Verified correction.'))
  assert.ok(rows()[0].querySelector('[aria-label="Previous thesis versions"]').textContent.includes('Fresh supported release thesis.'))
  await click(rows()[0].querySelector('button'))
  assert.ok(copied.includes(`row_id ${entry.row_id}`))
  assert.ok(copied.includes('latest expected_version'))
  offline = true; await poll()
  assert.ok(container.textContent.includes('Showing last loaded assessments'))
  assert.equal(rows().length, 16)
  await click(button('Export Markdown'))
  markdown = await blobs.at(-1).text()
  assert.ok(markdown.includes('last successfully loaded data'))
  offline = false; malformed = true; revision = 'three'; await poll()
  assert.ok(container.textContent.includes('Invalid Thesis response'))
  assert.equal(rows().length, 16)
  malformed = false; await poll()
  // Untrusted source markup is rejected, not placed in an anchor.
  const unsafe = { schema: 1, scope: 'NZDCHF', month: '2026-07', source_id: null, revision: 'unsafe',
    past: [{ ...entry, sources: [{ kind: 'web', label: 'Unsafe', locator: 'javascript:alert(1)', note: '' }], versions: [entry] }] }
  assert.equal(validThesisSnapshot(unsafe, 'NZDCHF', '2026-07', null), false)
  assert.ok(!thesisPrompt('NZDCHF', '2026-07').includes('--broker'))
  const monthSelect = container.querySelector('[aria-label="Thesis month"]')
  // An older month's late response must not overwrite newly selected October.
  hold = true
  await startPoll()
  await React.act(async () => { monthSelect.value = '2026-10'; monthSelect.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(rows().length, 0)
  assert.equal(button('Export Markdown').disabled, true, 'A month switch cannot export the previous month')
  assert.ok(held[0].options.signal.aborted)
  hold = false
  await React.act(async () => { for (const item of held.splice(0).reverse()) item.resolve(response(item.route)) })
  assert.equal(rows().length, 11)
  assert.ok(rows()[0].textContent.includes('Oct 17'))
  assert.ok(rows().at(-1).textContent.includes('Oct 1'))
  assert.equal(container.querySelectorAll('thead th').length, 8)
  const planRows = () => [...container.querySelectorAll('[data-thesis-plan]')]
  assert.equal(planRows().length, 14)
  assert.equal(planRows()[0].dataset.thesisPlan, '2026-10-18')
  assert.equal(planRows().at(-1).dataset.thesisPlan, '2026-10-31')
  assert.ok(planRows().every(row => !row.cells[1].textContent && !row.cells[2].textContent))
  assert.equal(planRows()[0].cells[3].textContent, '')
  assert.ok(planRows().find(row => row.dataset.thesisPlan === '2026-10-28').textContent.includes('8:00 AM'))
  assert.ok(planRows().find(row => row.dataset.thesisPlan === '2026-10-30').textContent.includes('12:30 AM'))
  const firstPlan = planRows()[0]
  await poll()
  assert.equal(planRows()[0], firstPlan, 'Quiet polls preserve planning row identity')
  assert.ok(rows().some(row => row.querySelector('.thesis-change').textContent.includes('Weakened')))
  assert.ok(rows().some(row => row.textContent.includes('Publication hour unverified')))
  assert.ok(!rows().some(row => row.textContent.includes('11:59 PM')), 'Unknown publication hours do not display the conservative internal cutoff as a real time')
  assert.ok(rows().some(row => row.querySelector('.thesis-change').textContent.includes('vs SELL')))
  await click(button('Copy assessment prompt'))
  assert.ok(copied.includes('--month 2026-10'))
  assert.ok(copied.includes('change/compared_with/change_reason'))
  await click(button('Export Markdown'))
  markdown = await blobs.at(-1).text()
  assert.equal(downloads.at(-1).filename, 'thesis-NZDCHF-2026-10.md')
  assert.ok(markdown.includes('14 unassessed planning days'))
  assert.ok(markdown.includes('8:00 AM Jakarta'))
  assert.ok(markdown.includes('12:30 AM Jakarta'))
  assert.ok(markdown.includes('publication hour unverified'))
  assert.ok(!markdown.includes('11:59 PM'), 'Conservative date-only cutoffs are not exported as publication hours')
  assert.ok(markdown.includes('Scheduled from this time'))
  assert.ok(markdown.includes('Exported:'))
  assert.ok(markdown.includes(october[0].sources[0].locator))
  const exportedSnapshot = { schema: 1, scope: 'NZDCHF', month: '2026-10', source_id: null, revision: 'escaping',
    past: [{ ...october[0], title: 'A | B', thesis: '<script>bad</script>\n[Injected](javascript:bad)',
      sources: [{ kind: 'web', label: 'A | B', locator: 'https://example.com/?filter=a|b', note: '' }] }], planned: [] }
  const beforeExport = JSON.stringify(exportedSnapshot)
  const escaped = thesisMarkdown(exportedSnapshot, '2026-10-17T15:00:00Z')
  assert.ok(escaped.includes('A \\| B'))
  assert.ok(escaped.includes('&lt;script&gt;'))
  assert.ok(!escaped.includes('<script>'))
  assert.ok(escaped.includes('filter=a%7Cb'), 'Source URLs cannot break Markdown table columns')
  assert.equal(JSON.stringify(exportedSnapshot), beforeExport, 'Export cannot mutate saved rows or their ordering')
  const filled = { ...october[0], id: 'e'.repeat(32), row_id: 'f'.repeat(32), as_of_utc: '2026-10-18T01:00:00Z',
    thesis: 'New assessment fixture.', versions: [] }
  filled.versions = [{ ...filled }]
  october.unshift(filled)
  revision = 'filled-day'; await poll()
  assert.equal(planRows().length, 13)
  assert.ok(!planRows().some(row => row.dataset.thesisPlan === '2026-10-18'))
  assert.ok(rows()[0].textContent.includes('New assessment fixture.'))
  const pair = container.querySelector('[aria-label="Thesis pair"]')
  hold = true
  await startPoll()
  await React.act(async () => { pair.value = 'EURUSD'; pair.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(rows().length, 0, 'Pair changes never display another pair\'s thesis')
  assert.equal(planRows().length, 0, 'Planning rows stay scoped to the requested pair')
  assert.ok(held[0].options.signal.aborted)
  hold = false
  await React.act(async () => { for (const item of held.splice(0).reverse()) item.resolve(response(item.route)) })
  assert.equal(rows().length, 0, 'Stale responses cannot restore the old pair')
  assert.ok(container.textContent.includes('No saved assessments for EURUSD'))
  await click(button('Export Markdown'))
  markdown = await blobs.at(-1).text()
  assert.ok(markdown.includes('# EURUSD thesis journal'))
  assert.ok(!markdown.includes('NZDCHF thesis journal'))
  hold = true; await startPoll()
  await click(button('Across All Currency'))
  assert.equal(rows().length, 0)
  assert.equal(button('Export Markdown').disabled, true)
  assert.ok(held[0].options.signal.aborted, 'Across toggle cancels the prior pair request')
  hold = false
  await React.act(async () => { for (const item of held.splice(0).reverse()) item.resolve(response(item.route)) })
  assert.equal(button('Across All Currency').getAttribute('aria-pressed'), 'true')
  assert.equal(container.querySelector('[aria-label="Thesis pair"]'), null)
  assert.equal(rows().length, 3)
  assert.equal(rows()[0].cells[0].rowSpan, 2)
  assert.ok(rows()[0].cells[0].textContent.includes('Oct 19'))
  assert.equal(rows()[1].cells.length, 3, 'Same-day opportunity shares the date cell')
  assert.ok(rows()[2].cells[0].textContent.includes('Oct 18'), 'Grouping uses Jakarta date across UTC midnight')
  assert.equal(planRows().length, 0)
  assert.ok(container.textContent.includes('EURCHFSTRONG SELL'))
  await click(button('Copy assessment prompt'))
  assert.ok(copied.includes('USD, EUR, GBP, JPY, CHF, CAD, AUD and NZD'))
  assert.ok(copied.includes('collection: "across"'))
  assert.ok(copied.includes('--scope ALL'))
  await click(rows()[0].querySelector('button'))
  assert.ok(copied.includes('Reassess the EURCHF opportunity'))
  assert.ok(copied.includes(acrossRows[0].row_id))
  const allSnapshot = { schema: 1, scope: 'ALL', month: '2026-10', source_id: null, revision: 'all', past: acrossRows, planned: [] }
  assert.equal(validThesisSnapshot(allSnapshot, 'ALL', '2026-10', null), true)
  assert.equal(validThesisSnapshot({ ...allSnapshot, past: october }, 'ALL', '2026-10', null), false, 'Pair-only records cannot leak into Across')
  await click(button('Export Markdown'))
  markdown = await blobs.at(-1).text()
  assert.equal(downloads.at(-1).filename, 'thesis-ALL-2026-10.md')
  assert.ok(markdown.includes('# Across All Currency thesis journal'))
  assert.ok(markdown.includes('EURCHF · STRONG SELL'))
  assert.ok(markdown.includes('collection: "across"'))
  assert.ok(!markdown.includes('Selected pair: **ALL**'))
  assert.ok(!markdown.includes('Unassessed planning days'))
  showReviews = true; revision = 'with-review'; await poll()
  const reviewNode = container.querySelector('[data-thesis-review]')
  assert.ok(reviewNode.textContent.includes('Blanket NZD selling is no longer a leading opportunity'))
  assert.equal(reviewNode.querySelectorAll('[aria-label="Entry opportunities"] [data-thesis-row]').length, 2)
  assert.equal(reviewNode.querySelectorAll('[aria-label="Conditional opportunities"] [data-thesis-row]').length, 1)
  assert.equal(reviewNode.querySelector('.thesis-conditional').open, false)
  const backdrop = reviewNode.querySelector('[data-review-backdrop]')
  assert.equal(backdrop.open, false, 'Supporting research starts collapsed')
  await React.act(async () => { backdrop.open = true })
  assert.equal(backdrop.querySelector('select').value, 'EURCHF')
  assert.equal(backdrop.querySelectorAll('thead th').length, 3)
  assert.ok(backdrop.textContent.includes('110 days earlier'), 'Evidence age uses the saved review cutoff, not today or export time')
  assert.ok(backdrop.textContent.includes('Source checked'))
  await React.act(async () => { const select = backdrop.querySelector('select'); select.value = 'ALL'; select.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(backdrop.querySelectorAll('thead th').length, 9)
  assert.equal(backdrop.querySelectorAll('tbody td').length, 40)
  await poll()
  assert.equal(container.querySelector('[data-thesis-review]'), reviewNode)
  assert.equal(container.querySelector('[data-review-backdrop]').open, true, 'Quiet polling preserves open research and currency selection')
  assert.equal(backdrop.querySelector('select').value, 'ALL')
  await click(button('Copy assessment prompt'))
  assert.ok(copied.includes('thesis context --scope ALL'))
  assert.ok(copied.includes('thesis review-append'))
  assert.ok(copied.includes('original publication dates'))
  await click(button('Export Markdown'))
  markdown = await blobs.at(-1).text()
  assert.ok(markdown.includes('Dated reviews and shared fundamental backdrop'))
  assert.ok(markdown.includes(review.takeaway))
  assert.ok(markdown.includes('USD policy dated evidence.'))
  assert.ok(markdown.includes('2026-07-01 (110 days earlier)'))
  assert.ok(markdown.includes('Exact opportunity version IDs'))
  const badReview = { ...review, backdrop: review.backdrop.slice(1) }
  assert.equal(validThesisSnapshot({ ...allSnapshot, reviews: [badReview] }, 'ALL', '2026-10', null), false)
  const oldOpportunity = acrossRows[0]
  acrossRows[0] = { ...oldOpportunity, id: 'e'.repeat(32), as_of_utc: '2026-10-20T08:00:00Z', verdict: 'BUY', thesis: 'Later fresh reassessment.', versions: [...oldOpportunity.versions, { ...oldOpportunity, id: 'e'.repeat(32) }] }
  revision = 'later-opportunity'; await poll()
  assert.ok(rows()[0].textContent.includes('Later fresh reassessment.'), 'Newer unreviewed assessments stay above earlier reviews')
  assert.ok(container.querySelector('[data-thesis-review] [aria-label="Entry opportunities"]').textContent.includes('STRONG SELL'), 'A later correction cannot silently change the frozen dated review')
  await click(button('Export Markdown'))
  markdown = await blobs.at(-1).text()
  assert.ok(markdown.includes(oldOpportunity.id))
  assert.ok(markdown.includes('Later fresh reassessment.'))
  await React.act(async () => root.render(null))
  await React.act(async () => root.render(React.createElement(ThesisDock)))
  assert.equal(button('Across All Currency').getAttribute('aria-pressed'), 'true', 'Across choice survives remount')
  await click(button('Across All Currency'))
  assert.equal(container.querySelector('[aria-label="Thesis pair"]').value, 'EURUSD', 'Toggle preserves the independent pair choice')
  assert.equal(rows().length, 0, 'Across opportunities do not leak into pair journals')
  await React.act(async () => root.render(null))
  assert.equal(timers.size, 0)
  await React.act(async () => root.render(React.createElement(ThesisDock)))
  assert.equal(container.querySelector('[aria-label="Thesis pair"]').value, 'EURUSD', 'Independent pair choice persists')
  assert.equal(container.querySelector('[aria-label="Thesis month"]').value, '2026-10', 'Month choice persists')
  assert.ok(requests.every(({ route, options }) => route.pathname === '/storage-api/theses' && !route.searchParams.has('source_id') && !options.method), 'Dock only reads compact research; no candle/raw/pin writes')
  console.log('✓ Thesis: July seed, pair/month, safe sources, saved-only table, assessment prompts, updates/history, stable polls, errors and stale-reply cleanup')
} finally {
  await React.act(async () => root.unmount())
  assert.equal(timers.size, 0)
  Date.now = realNow
  URL.createObjectURL = originalCreateUrl; URL.revokeObjectURL = originalRevokeUrl
  dom.HTMLAnchorElement.prototype.click = originalAnchorClick
  await server.close(); dom.happyDOM.abort()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
