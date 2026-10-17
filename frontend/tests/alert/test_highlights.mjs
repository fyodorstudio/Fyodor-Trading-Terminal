import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

globalThis.__highlightSeriesWork = 0
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false },
  plugins: [{ name: 'highlight-work', enforce: 'pre', transform(code, id) {
    if (id.endsWith('/HighlightList.tsx')) return code.replace('return <div className="highlight-series">',
      'globalThis.__highlightSeriesWork++; return <div className="highlight-series">')
  } }] })
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, localStorage: dom.localStorage, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
let copiedPrompt = '', clipboardFailure = false, oldService = false
let limitationOffline = false, limitationMalformed = false
Object.defineProperty(dom.navigator, 'clipboard', { configurable: true, value: { writeText: async text => {
  if (clipboardFailure) throw new Error('Clipboard unavailable')
  copiedPrompt = text
} } })
const originalNow = Date.now
let now = Date.UTC(2026, 9, 12, 12), serial = 0, revision = 1, offline = false, malformed = false
Date.now = () => now
const intervals = new Map(), timers = new Map(), calls = [], pins = []
dom.setInterval = (fn, ms) => { intervals.set(++serial, { fn, ms }); return serial }
dom.clearInterval = id => intervals.delete(id)
dom.setTimeout = (fn, ms) => { timers.set(++serial, { fn, ms }); return serial }
dom.clearTimeout = id => timers.delete(id)
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.append(container)
const root = createRoot(container)
const at = now + 60_000, day = 86400000, display = { mode: 'utc', utcOffsetMinutes: 0 }
const { AlertDock } = await server.ssrLoadModule('./src/alert/index.ts')
const { inspectorFamilies } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
const { alertPreferencesKey, defaultAlertPreferences } = await server.ssrLoadModule('./src/alert/model/alert-preferences.ts')
const cpi = inspectorFamilies.find(family => family.id === 'us-cpi')
const cadLabor = inspectorFamilies.find(family => family.id === 'ca-labor')
const row = (id, currency, country, time) => ({ value_id: `${id}/${time}`, event_id: id, currency, country_code: country, country_name: country,
  name: `Series ${id}`, event_code: id, release_at: time, server_time_seconds: time / 1000, chart_time_seconds: time / 1000,
  period_seconds: at / 1000 - 30 * 86400, revision: 0, actual: null, forecast: .2, previous: .1, revised_previous: null,
  unit: 1, multiplier: 0, digits: 1, time_mode: 0, impact: 'none', importance: 'high', availability: 'observed' })
let rows = [row(cpi.events[0], 'USD', 'US', at), row(cpi.events[1], 'USD', 'US', at),
  row('840050014', 'USD', 'US', at + 3 * day), row(cadLabor.events[0], 'CAD', 'CA', at + 2 * day)]
function snapshot(sourceId, visibility = 'active') {
  return pins.filter(pin => pin.source_id === sourceId && (!!pin.archived_utc === (visibility === 'archived'))).map(pin => {
    const events = rows.filter(row => pin.value_ids.includes(row.value_id))
    return JSON.parse(JSON.stringify({ ...pin, events, release_at: Math.min(...events.map(row => row.release_at)),
      server_time: Math.min(...events.map(row => row.server_time_seconds)), missing_value_ids: [] }))
  }).sort((a, b) => a.release_at - b.release_at)
}
globalThis.fetch = async (url, options = {}) => {
  const route = new URL(String(url), 'http://localhost'); calls.push({ path: route.pathname, options })
  if (route.pathname === '/storage-api/highlight-limitations') {
    if (limitationOffline) return { ok: false, status: 503, json: async () => ({}) }
    const source_id = route.searchParams.get('source_id')
    return { ok: true, json: async () => limitationMalformed ? { source_id, revision: 'bad', items: [{}] } :
      route.searchParams.get('after_revision') === 'limit-1' ? { source_id, revision: 'limit-1', unchanged: true } :
      { source_id, revision: 'limit-1', items: source_id === 'Broker-A' ? [{ id: 'limit-1', source_id, key: 'rba-time', currency: 'AUD',
        kind: 'schedule-mismatch', title: 'RBA decision hour differs', description: 'Stored time differs from the official schedule.',
        action: 'Use the official decision time.', checked_utc: '2026-10-12T11:00:00Z', status: 'open',
        official_schedule: '10:30 Jakarta', stored_schedule: '11:30 Jakarta', sources: [{ kind: 'web', label: 'RBA calendar', locator: 'https://www.rba.gov.au/schedules-events/calendar/', note: '' }] }] : [] } }
  }
  if (route.pathname.startsWith('/storage-api/highlights')) {
    if (offline) return { ok: false, status: 503, json: async () => ({}) }
    if (options.method === 'POST') {
      if (/\/(archive|restore)$/.test(route.pathname)) {
        if (oldService) return { ok: false, status: 404, json: async () => ({ detail: 'Not Found' }) }
        const pin = pins.find(pin => pin.id === route.pathname.split('/').at(-2))
        pin.archived_utc = route.pathname.endsWith('/archive') ? new Date(now).toISOString() : null
        revision++
        return { ok: true, json: async () => ({ id: pin.id }) }
      }
      pins.push({ ...JSON.parse(options.body), id: `pin-${++serial}`, pinned_utc: new Date(now).toISOString() }); revision++
      return { ok: true, json: async () => ({ id: pins.at(-1).id }) }
    }
    if (options.method === 'DELETE') {
      pins.splice(pins.findIndex(pin => pin.id === route.pathname.split('/').at(-1)), 1); revision++
      return { ok: true, json: async () => ({}) }
    }
    const source_id = route.searchParams.get('source_id'), visibility = route.searchParams.get('visibility') ?? 'active', signature = `${revision}:${visibility}`
    if (malformed) return { ok: true, json: async () => ({ source_id, revision: signature, items: [{ id: 'invalid' }] }) }
    return { ok: true, json: async () => route.searchParams.get('after_revision') === signature ?
      { highlight_schema: oldService ? 1 : 2, source_id, revision: signature, unchanged: true } :
      { highlight_schema: oldService ? 1 : 2, source_id, revision: signature, items: snapshot(source_id, visibility) } }
  }
  if (route.pathname.endsWith('/health')) return { ok: true, json: async () => ({ revision, collector_error: null,
    sources: [{ id: 'Broker-A', publisher_status: 'live' }] }) }
  return { ok: true, json: async () => ({ source_id: 'Broker-A', revision, time_basis: 'chart', timestamp_convention: 'trade_server_time',
    event_ids: route.searchParams.get('event_ids')?.split(',') ?? null, events: rows,
    coverage: { USD: { missing: [] }, CAD: { missing: [] } }, next_cursor: null }) }
}
const click = async element => { assert.ok(element); await React.act(async () => element.click()) }
const button = text => [...container.querySelectorAll('button')].find(button => button.textContent === text)
let prepared
const renderAlert = async overrides => React.act(async () => root.render(React.createElement(AlertDock,
  { brokerId: 'Broker-A', timeDisplay: display, onPrepareResearch: release => { prepared = release }, ...overrides })))
async function poll() {
  const timer = [...timers].find(([, value]) => value.ms === 2000)
  assert.ok(timer); timers.delete(timer[0]); await React.act(async () => timer[1].fn())
}
try {
  localStorage.setItem(alertPreferencesKey, JSON.stringify({ ...defaultAlertPreferences(), families: ['us-cpi', 'fomc', 'ca-labor'] }))
  await renderAlert()
  assert.deepEqual([...container.querySelectorAll('[aria-label="Alert collection"] button')].map(button => button.textContent), ['Upcoming', 'Highlight'])
  assert.deepEqual([...container.querySelectorAll('[aria-label="Alert currency"] button')].map(button => button.textContent), ['All', 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'])
  assert.equal(container.querySelector('.alert-header strong'), null, 'The redundant Alert title is removed')
  assert.equal(container.querySelectorAll('.alert-row').length, 3)
  const pinButtons = [...container.querySelectorAll('.alert-pin')]
  for (const pin of pinButtons) await click(pin)
  assert.equal(pins.length, 3)
  assert.equal(pins[0].value_ids.length, 2, 'Pin keeps every series in the selected CPI package')
  await click(button('Highlight'))
  assert.equal(container.querySelectorAll('.highlight-card').length, 3)
  assert.equal(container.querySelector('[aria-label="Alert horizon"]'), null, 'Pinned releases are independent of the upcoming horizon')
  assert.equal(container.querySelector('.highlight-card').dataset.highlightId, pins[0].id, 'Soonest pin appears first')
  assert.equal(container.querySelectorAll('.highlight-series').length, 0, 'Collapsed cards avoid rendering series tables')
  const filterNetwork = calls.length
  await click(button('USD'))
  assert.equal(container.querySelectorAll('.highlight-card').length, 2)
  assert.equal(button('Highlight').getAttribute('aria-pressed'), 'true', 'Currency selection keeps Highlight open')
  await click(button('CAD'))
  assert.equal(container.querySelectorAll('.highlight-card').length, 1)
  assert.equal(container.querySelector('.highlight-card').dataset.highlightId, pins[1].id)
  await click(button('All'))
  assert.equal(container.querySelectorAll('.highlight-card').length, 3)
  assert.equal(calls.length, filterNetwork, 'Highlight currencies filter the stored snapshot without refetching')
  const captured = rows.filter(row => pins[0].value_ids.includes(row.value_id)).map(row => ({ ...row }))
  pins[0].journal = [{ id: 'research-1', highlight_id: pins[0].id, source_id: 'Broker-A', phase: 'before', scope: 'EURUSD',
    as_of_utc: '2026-10-12T11:00:00Z', saved_utc: '2026-10-12T11:01:00Z', body: 'Inflation remains elevated.\n\nRefresh both currencies.',
    direction: 'USD supportive', confidence: 'Moderate', counterevidence: 'Weak payrolls', expectations: [], sources: [
      { kind: 'web', label: 'Official release', locator: 'https://www.bls.gov/cpi/', note: 'Release vintage' }],
    release_prompt: 'Check October CPI against expectations; keep price separate.', prior_highlight_ids: [], correction_of: null,
    price_reaction: '', readings: captured, calendar_revision: 1, reading_vintage: 'Captured when saved', missing_value_ids: [] }]
  pins[0].prompts = [{ id: 'prompt-1', highlight_id: pins[0].id, source_id: 'Broker-A', scope: 'EURUSD', saved_utc: '2026-10-12T10:00:00Z',
    prepare_prompt: 'Saved preparation prompt: conditional outcomes. Do not treat forecasts as actuals.', release_prompt: 'Older saved release prompt.' }]
  pins[0].journal.unshift({ ...pins[0].journal[0], id: 'research-old', as_of_utc: '2026-10-12T09:00:00Z', saved_utc: '2026-10-12T09:01:00Z', body: 'Original context preserved.' })
  revision++; await poll()
  await click(button('EUR'))
  assert.equal(container.querySelectorAll('.highlight-card').length, 0, 'EURUSD research scope does not make a USD release an EUR event')
  assert.match(container.textContent, /No active EUR events/)
  await click(button('All'))
  const first = container.querySelector('.highlight-card'), toggle = first.querySelector('.highlight-toggle')
  const scopeSelect = first.querySelector('[aria-label^="Research scope"]')
  const selectView = async value => React.act(async () => {
    const select = first.querySelector('[aria-label^="Journal view"]'); select.value = value; select.dispatchEvent(new dom.Event('change', { bubbles: true }))
  })
  await React.act(async () => { scopeSelect.value = 'EURUSD'; scopeSelect.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(first.querySelector('[aria-label^="Prompt stage"]'), null, 'Collapsed release rows keep prompt controls in the preview')
  await click(toggle)
  assert.ok(document.getElementById(toggle.getAttribute('aria-controls')), 'Disclosure identifies the expanded reading panel')
  assert.equal(first.querySelector('option[value="documentation"]').disabled, true, 'Upcoming releases retain their preparation views')
  assert.match(first.querySelector('.highlight-content').textContent, /Before release.*USD supportive/s)
  assert.match(first.textContent, /Strongest counterevidence:.*Weak payrolls/s)
  assert.equal(first.querySelector('textarea'), null, 'Before release only renders the selected research section')
  assert.equal(first.querySelector('[aria-label="Research snapshot readings"]'), null, 'Saved evidence is separate from the narrative')
  assert.equal(first.querySelector('.highlight-prompt-actions'), null, 'Narrative views do not show prompt controls')
  const assessmentNetwork = calls.length
  await selectView('assessment')
  assert.equal(first.querySelector('[aria-label^="Prompt stage"]'), null, 'Quick assessment has a single dedicated workflow')
  await click([...first.querySelectorAll('button')].find(button => button.textContent === 'Copy Prompt'))
  assert.match(copiedPrompt, /\$assess-trade-now/)
  assert.match(copiedPrompt, new RegExp(`Highlight ${pins[0].id}, broker Broker-A`))
  assert.match(copiedPrompt, /Assess EURUSD now/)
  assert.match(copiedPrompt, /do not fetch or analyze candles\/OHLC, including saved candles/)
  assert.match(copiedPrompt, /STRONG BUY \/ BUY \/ MIXED \/ SELL \/ STRONG SELL/)
  assert.match(copiedPrompt, /UPCOMING EVENTS THAT COULD CHANGE THE THESIS.*PRIOR STALE EVENTS/s)
  assert.match(copiedPrompt, /Local datasets and saved research are optional/)
  assert.match(copiedPrompt, /pending release alone does not force waiting/)
  assert.match(copiedPrompt, /Verify material facts or disclose gaps/)
  assert.equal(first.querySelector('textarea').readOnly, true)
  clipboardFailure = true
  await click([...first.querySelectorAll('button')].find(button => button.textContent === 'Copy Prompt'))
  assert.equal(first.querySelector('[aria-label^="Journal view"]').value, 'assessment', 'Clipboard failure retains the assessment preview')
  assert.match(first.querySelector('textarea').value, /Assess EURUSD now/)
  clipboardFailure = false
  await React.act(async () => { scopeSelect.value = 'GBPUSD'; scopeSelect.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  await click([...first.querySelectorAll('button')].find(button => button.textContent === 'Copy Prompt'))
  assert.match(copiedPrompt, /Assess GBPUSD now/)
  await React.act(async () => { scopeSelect.value = 'USD'; scopeSelect.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(first.querySelector('option[value="assessment"]').disabled, true, 'Trade assessment requires a pair rather than a standalone currency')
  assert.equal(first.querySelector('textarea'), null)
  await React.act(async () => { scopeSelect.value = 'EURUSD'; scopeSelect.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(calls.length, assessmentNetwork, 'Copying or previewing assessments never fetches candles or changes stored data')
  await selectView('before')
  await selectView('after')
  assert.match(first.querySelector('.highlight-journal').textContent, /After release.*No saved interpretation/s)
  await selectView('sources')
  assert.equal(first.querySelector('a').getAttribute('rel'), 'noopener noreferrer')
  assert.equal(first.querySelector('[aria-label="Research snapshot readings"]').querySelectorAll('tbody tr').length, 2)
  await selectView('history')
  assert.match(first.querySelector('.highlight-journal').textContent, /Research history \(2 versions\)/)
  assert.match(first.querySelector('.highlight-journal').textContent, /Original context preserved/)
  await selectView('prompt')
  await React.act(async () => { const stage = first.querySelector('[aria-label^="Prompt stage"]'); stage.value = 'after'; stage.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(first.querySelector('textarea').readOnly, true, 'Research and prompt preview have no editable text controls')
  await click([...first.querySelectorAll('button')].find(button => button.textContent === 'Copy Prompt'))
  assert.match(copiedPrompt, /Highlight pin-/); assert.match(copiedPrompt, /broker Broker-A/); assert.match(copiedPrompt, /scope EURUSD/)
  assert.match(copiedPrompt, /Check October CPI against expectations/)
  assert.match(copiedPrompt, /restriction overrides any candle-measurement instructions in older saved templates/)
  assert.equal(toggle.getAttribute('aria-expanded'), 'true', 'Copy Prompt retains the open preview')
  const scopeNetwork = calls.length
  await React.act(async () => { scopeSelect.value = 'GBPUSD'; scopeSelect.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  await click([...first.querySelectorAll('button')].find(button => button.textContent === 'Copy Prompt'))
  assert.match(copiedPrompt, /scope GBPUSD/, 'Scope changes the copied analysis target')
  assert.match(first.querySelector('textarea').value, /scope GBPUSD/, 'Preview follows the chosen scope')
  assert.equal(calls.length, scopeNetwork, 'Scope does not fetch or mutate calendar observations')
  await React.act(async () => { scopeSelect.value = 'EURUSD'; scopeSelect.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  const promptStage = first.querySelector('[aria-label^="Prompt stage"]')
  await React.act(async () => { promptStage.value = 'prepare'; promptStage.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  await click([...first.querySelectorAll('button')].find(button => button.textContent === 'Copy Prompt'))
  assert.match(copiedPrompt, /Saved preparation prompt/); assert.match(copiedPrompt, /conditional outcomes/); assert.match(copiedPrompt, /Do not treat forecasts as actuals/)
  assert.match(copiedPrompt, /do not fetch or analyze candles\/OHLC/)
  await React.act(async () => { promptStage.value = 'after'; promptStage.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  await selectView('readings')
  assert.equal(first.querySelector('.highlight-prompt-actions'), null)
  assert.equal(first.querySelectorAll('tr[data-series-id]').length, 2)
  assert.match(first.textContent, /Forecast.*Previous.*Revised previous/)
  const work = globalThis.__highlightSeriesWork, network = calls.length
  assert.ok(work > 0)
  now = at + 1000
  for (let tick = 0; tick < 10; tick++) await React.act(async () => { now += 1000; for (const timer of intervals.values()) timer.fn() })
  assert.match(first.textContent, /Awaiting release data/)
  assert.equal(calls.length, network, 'Countdown ticks never fetch or regroup data')
  assert.equal(globalThis.__highlightSeriesWork, work, 'Countdown ticks do not render unchanged expanded series')
  rows = rows.map(row => row.release_at === at ? { ...row, actual: .3, revised_previous: .15, revision: 1 } : row); revision++
  await poll()
  assert.equal(container.querySelectorAll('.highlight-card').length, 3, 'Publication never removes a pin')
  assert.equal(toggle.getAttribute('aria-expanded'), 'true', 'Arrival retains expansion state')
  assert.equal(first.querySelector('[aria-label^="Journal view"]').value, 'documentation', 'Published historical releases use documentation')
  assert.equal(first.querySelector('[aria-label^="Journal view"]').querySelectorAll('option:disabled').length, 6, 'Historical preparation views are greyed out')
  assert.match(first.textContent, /Released/)
  assert.match(first.querySelector('.highlight-journal').textContent, /Only pre-release research is saved/, 'Before research is not presented as verified post-release interpretation')
  assert.equal(first.querySelector('.highlight-prompt-actions'), null)
  await selectView('assessment')
  assert.equal(first.querySelector('[aria-label^="Journal view"]').value, 'assessment', 'Publication retains access to quick live assessment')
  await click([...first.querySelectorAll('button')].find(button => button.textContent === 'Copy Prompt'))
  assert.match(copiedPrompt, /Assess EURUSD now/)
  await selectView('documentation')
  pins[0].journal.push({ ...pins[0].journal.at(-1), id: 'research-after', phase: 'after', as_of_utc: new Date(now).toISOString(), saved_utc: new Date(now).toISOString(),
    body: 'Verified release documentation.', readings: rows.filter(row => pins[0].value_ids.includes(row.value_id)).map(row => ({ ...row })) })
  revision++; await poll()
  assert.match(first.querySelector('.highlight-journal').textContent, /Verified release documentation/)
  assert.match(first.querySelector('.highlight-journal').textContent, /Documentation history \(3 versions\)/)
  assert.match(first.textContent, /0.3%/)
  await click(first.querySelector('[aria-label^="Prepare research"]'))
  assert.equal(prepared.events.length, 2, 'Research retains the whole highlighted release package after publication')
  assert.ok(prepared.events.every(event => event.actual === .3))
  rows = rows.map(row => row.value_id === pins[0].value_ids[0] ? { ...row, availability: 'not-returned-by-latest-query' } : row); revision++
  await poll()
  assert.match(first.textContent, /Readings unavailable/, 'Withdrawn observations never imply a complete verified release')
  assert.equal(first.querySelector('[aria-label^="Journal view"]').value, 'documentation', 'Saved post-release documentation survives a feed withdrawal')
  rows = rows.map(row => ({ ...row, availability: 'observed' })); revision++
  rows = rows.map(row => row.event_id === '840050014' ? { ...row, release_at: at - day, server_time_seconds: (at-day)/1000 } : row); revision++
  await poll()
  assert.equal(container.querySelector('.highlight-card').dataset.highlightId, pins[2].id, 'A corrected schedule re-sorts the same pinned occurrence')
  assert.equal(toggle.getAttribute('aria-expanded'), 'true')
  const beforeZone = calls.length
  await renderAlert({ timeDisplay: { mode: 'fixed-offset', utcOffsetMinutes: 420 } })
  assert.equal(calls.length, beforeZone, 'Display timezone never refetches highlights')
  malformed = true; await poll()
  assert.match(container.textContent, /Invalid Highlight response/)
  assert.equal(container.querySelectorAll('.highlight-card').length, 3, 'Malformed responses retain the last valid snapshot')
  malformed = false; await poll()
  pins[0].journal[0].readings = [null]; revision++; await poll()
  assert.match(container.textContent, /Invalid Highlight response/)
  assert.equal(container.querySelectorAll('.highlight-card').length, 3, 'Malformed journal snapshots retain the last valid cards')
  pins[0].journal[0].readings = captured; revision++; await poll()
  offline = true; await poll()
  assert.equal(container.querySelectorAll('.highlight-card').length, 3, 'Outages retain readings and pins')
  await React.act(async () => root.render(null)); await renderAlert()
  assert.equal(container.querySelectorAll('.highlight-card').length, 3, 'Cached pins survive a remount while storage is offline')
  offline = false
  localStorage.setItem('fyodor.highlights.Broker-B', JSON.stringify([{ source_id: 'Broker-B', events: [], value_ids: [] }]))
  await renderAlert({ brokerId: 'Broker-B' })
  assert.equal(container.querySelectorAll('.highlight-card').length, 0, 'A different broker never sees the previous broker pins')
  await renderAlert(); await poll()
  oldService = true
  await click(container.querySelector('[aria-label^="Archive highlight"]'))
  assert.match(container.textContent, /Restart calendar storage/)
  assert.equal(container.querySelectorAll('.highlight-card').length, 3, 'An old service cannot delete a pin through the new archive action')
  assert.equal(calls.filter(call => call.options.method === 'DELETE').length, 0)
  oldService = false
  const archivedId = container.querySelector('.highlight-card').dataset.highlightId
  await click(container.querySelector('[aria-label^="Archive highlight"]'))
  assert.equal(container.querySelectorAll('.highlight-card').length, 2, 'Archiving removes only the active card')
  assert.equal(pins.length, 3, 'Archived occurrences remain stored')
  await click(button('Archive'))
  assert.equal(container.querySelectorAll('.highlight-card').length, 1)
  assert.equal(container.querySelector('.highlight-card').dataset.highlightId, archivedId)
  const archiveFilterNetwork = calls.length
  await click(button('USD'))
  assert.equal(container.querySelectorAll('.highlight-card').length, 1)
  await click(button('AUD'))
  assert.equal(container.querySelectorAll('.highlight-card').length, 0)
  assert.match(container.textContent, /No archived AUD events/)
  assert.equal(button('Archive').getAttribute('aria-pressed'), 'true')
  assert.equal(calls.length, archiveFilterNetwork, 'Archive filtering does not fetch or mutate records')
  await click(button('Upcoming'))
  assert.equal(button('AUD').getAttribute('aria-pressed'), 'true', 'Currency follows the selected collection')
  assert.ok(container.querySelector('[aria-label="Alert horizon"]'))
  await click(button('Highlight'))
  assert.equal(button('Archive').getAttribute('aria-pressed'), 'true', 'Returning to Highlight retains Archive')
  await React.act(async () => root.render(null)); await renderAlert()
  assert.equal(button('Highlight').getAttribute('aria-pressed'), 'true', 'Collection survives reopening the dock')
  assert.equal(button('Archive').getAttribute('aria-pressed'), 'true', 'Archive survives reopening the dock')
  assert.equal(button('AUD').getAttribute('aria-pressed'), 'true', 'Currency survives reopening the dock')
  assert.match(container.textContent, /No archived AUD events/)
  await click(button('All'))
  assert.equal(container.querySelectorAll('.highlight-card').length, 1)
  await click(container.querySelector('[aria-label^="Restore highlight"]'))
  assert.equal(container.querySelectorAll('.highlight-card').length, 0)
  await click(button('Active'))
  assert.equal(container.querySelectorAll('.highlight-card').length, 3)
  const researchCard = [...container.querySelectorAll('.highlight-card')].find(card => card.dataset.highlightId === pins[1].id)
  clipboardFailure = true
  await click(researchCard.querySelector('.highlight-toggle'))
  await React.act(async () => { const select = researchCard.querySelector('[aria-label^="Journal view"]'); select.value = 'prompt'; select.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  await click([...researchCard.querySelectorAll('button')].find(button => button.textContent === 'Copy Prompt'))
  assert.match(researchCard.textContent, /Clipboard unavailable/)
  assert.equal(researchCard.querySelector('.highlight-toggle').getAttribute('aria-expanded'), 'true')
  assert.equal(researchCard.querySelector('[aria-label^="Journal view"]').value, 'prompt', 'Clipboard fallback opens the prompt view directly')
  assert.equal(researchCard.querySelector('textarea').readOnly, true)
  clipboardFailure = false
  assert.equal(button('Discovered Limitations'), undefined, 'Limitations no longer belong to Highlight')
  const { ExternalSourcesDock } = await server.ssrLoadModule('./src/external-sources/ExternalSourcesDock.tsx')
  localStorage.setItem('fyodor.external-sources.view.v1', 'limitations')
  const renderExternal = async (brokerId = 'Broker-A') => React.act(async () => root.render(React.createElement(ExternalSourcesDock, { brokerId, timeDisplay: display })))
  await renderExternal()
  assert.equal(container.querySelectorAll('.highlight-card').length, 0)
  assert.match(container.textContent, /RBA decision hour differs/)
  assert.match(container.textContent, /10:30 Jakarta/)
  assert.equal(container.querySelector('.highlight-limitation a').getAttribute('rel'), 'noopener noreferrer')
  const limitationNetwork = calls.length
  await click(button('USD'))
  assert.equal(container.querySelectorAll('.highlight-limitation').length, 0)
  assert.match(container.textContent, /No recorded USD limitations/)
  assert.equal(container.querySelector('[aria-label="External Source view"]').value, 'limitations')
  await click(button('AUD'))
  assert.equal(container.querySelectorAll('.highlight-limitation').length, 1)
  await click(button('All'))
  assert.equal(calls.length, limitationNetwork, 'Limitations currency selection remains local')
  for (let tick = 0; tick < 10; tick++) await React.act(async () => { now += 1000; for (const timer of intervals.values()) timer.fn() })
  assert.equal(calls.length, limitationNetwork, 'Countdowns do not fetch limitation metadata')
  limitationMalformed = true; await poll()
  assert.match(container.textContent, /Invalid limitations response/)
  assert.equal(container.querySelectorAll('.highlight-limitation').length, 1, 'Invalid metadata retains the last good records')
  limitationMalformed = false; limitationOffline = true; await poll()
  assert.equal(container.querySelectorAll('.highlight-limitation').length, 1)
  await React.act(async () => root.render(null)); await renderExternal()
  assert.equal(container.querySelector('[aria-label="External Source view"]').value, 'limitations', 'Limitations view survives offline remount')
  assert.equal(container.querySelectorAll('.highlight-limitation').length, 1, 'Limitation cache survives offline remount')
  limitationOffline = false
  await renderExternal('Broker-B')
  assert.equal(container.querySelectorAll('.highlight-limitation').length, 0, 'Limitation metadata stays broker-scoped')
  await renderAlert(); await click(button('Active'))
  await React.act(async () => root.render(null))
  assert.equal(intervals.size, 0); assert.equal(timers.size, 0)

  const { useInspector } = await server.ssrLoadModule('./src/inspector/useInspector.ts')
  pins.splice(0); revision++
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  let view
  function InspectorHarness() {
    const next = useInspector({ symbol: 'EURUSD', events: rows, bars: [{ time: at/1000, open: 1, high: 2, low: .5, close: 1 }],
      timeframe: 'H1', timeDisplay: display, clockOffsetMs: 0 })
    React.useLayoutEffect(() => { view = next }, [next])
    return React.createElement(React.Fragment, null,
      React.createElement(InspectorPanel, { view: { ...next, brokerId: 'Broker-A' }, symbol: 'EURUSD', source: null, error: null, timeDisplay: display }),
      React.createElement(AlertDock, { brokerId: 'Broker-A', timeDisplay: display }))
  }
  await React.act(async () => root.render(React.createElement(InspectorHarness)))
  await React.act(async () => view.selectRelease(view.releases.find(release => release.familyId === 'us-cpi').id))
  assert.ok(container.querySelector('.inspector-header > .inspector-pin'), 'Inspector pin is at the far-right end of the header')
  await click(container.querySelector('.inspector-pin button'))
  assert.match(container.querySelector('.inspector-pin button').textContent, /Archive/)
  assert.equal(container.querySelectorAll('.highlight-card').length, 1, 'Inspector pin immediately updates the open Highlight tab')
  await click(container.querySelector('[aria-label^="Archive highlight"]'))
  assert.equal(container.querySelector('.inspector-pin button').textContent, 'Pin', 'Removing a pin immediately updates Inspector without a polling tick')
  await React.act(async () => view.applyPreferences({ ...view.preferences, symbolGrouping: 'day' }, 'preview'))
  await React.act(async () => view.selectRelease(view.releases.find(release => release.currency === 'USD').id))
  assert.ok(container.querySelector('.inspector-pin-menu button'), 'Daily Inspector lets the user select individual releases to pin')
  await React.act(async () => root.render(null))
  assert.equal(intervals.size, 0); assert.equal(timers.size, 0)
  console.log('✓ Highlight: pin entry points, scope-specific journal/prompt, clipboard fallback, archive/restore, safe old-service failure, publication/revisions, offline persistence, broker isolation and zero countdown table/network work')
} finally {
  await React.act(async () => root.unmount()); Date.now = originalNow
  delete globalThis.__highlightSeriesWork
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
  }
}
