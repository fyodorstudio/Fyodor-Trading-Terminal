import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

// Production component/hook contract; no browser or visual inspection.
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { localStorage: dom.localStorage, window: dom, document: dom.document, navigator: dom.navigator, HTMLElement: dom.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
let now = Date.parse('2026-10-26T17:00:00Z'), sequence = 0, offline = false, malformed = false, hold = false
const realNow = Date.now; Date.now = () => now
const timers = new Map(), intervals = new Map(), requests = [], held = []
dom.setTimeout = (fn, ms) => { timers.set(++sequence, { fn, ms }); return sequence }
dom.clearTimeout = id => timers.delete(id)
dom.setInterval = (fn, ms) => { intervals.set(++sequence, { fn, ms }); return sequence }
dom.clearInterval = id => intervals.delete(id)
const anchor = { title: 'Supporting release', event_at: '2026-10-26T14:00:00Z', event_date: null, note: 'Original release time, not review time.', sources: [{ kind: 'web', label: 'Release', locator: 'https://www.federalreserve.gov/', note: '' }] }
const checkpoint = { title: 'Fed rate decision', event_at: '2026-10-28T16:00:00Z', event_date: null,
  note: 'Guidance can change the rate path.', verified_utc: '2026-10-26T16:00:00Z',
  sources: [{ kind: 'web', label: 'Official schedule', locator: 'https://www.federalreserve.gov/', note: '' }] }
let snapshot = { schema: 1, revision: 'one', review_id: 'a'.repeat(32), as_of_utc: '2026-10-26T16:00:00Z',
  rows: ['USD','EUR','GBP','JPY','CHF','CAD','AUD','NZD'].map((currency, index) => ({ currency,
    verdict: index ? 'POTENTIAL WEAKENING' : 'POTENTIAL STRENGTHENING', verified_utc: '2026-10-26T16:00:00Z',
    ...(index === 0 || index === 5 ? { basis: 'standalone', intensity: 'moderate', horizon: 'Current session through the next material review.' } : {}),
    evidence_anchor: index ? null : anchor, reassessment: index ? null : checkpoint, reassessment_gap: '' })) }
function response(url) {
  return offline ? { ok: false, status: 503 } : { ok: true, json: async () => malformed ? { ...snapshot, rows: snapshot.rows.slice(1) }
    : url.includes(`after_revision=${snapshot.revision}`) ? { schema: 1, revision: snapshot.revision, unchanged: true } : structuredClone(snapshot) }
}
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url, options })
  return hold ? new Promise(resolve => held.push({ resolve, url, options })) : response(url)
}
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.append(container)
const root = createRoot(container)
const poll = async () => {
  const [id, timer] = [...timers].find(([, timer]) => timer.ms === 5000)
  timers.delete(id); await React.act(async () => timer.fn())
}
try {
  const { CurrencySummary } = await server.ssrLoadModule('./src/thesis/CurrencySummary.tsx')
  const { validCurrencySummary, currencyUntil, currencyStaleness, currencyAssessmentStatus } = await server.ssrLoadModule('./src/thesis/currency-summary-model.ts')
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const gapSummary = JSON.parse(execFileSync(path.join(repo, 'bridge/.venv/Scripts/python.exe'), ['-c', `
import json
from storage.tests.test_thesis_research import ResearchTests
from storage.thesis_research import ResearchRequest, append_research
from storage.thesis_summary import currency_summary
fixture=ResearchTests();fixture.setUp()
try:
    request=fixture.request()
    request['assessments'][0]['direction'].update(review_status='provisional',stage_note='Statement only; conference Q&A pending.')
    request['developments'][0]['published_at']='2026-07-22T09:00:00Z'
    append_research(ResearchRequest(**request),fixture.path)
    newer=fixture.development('later-guidance')
    newer.update(published_at='2026-07-22T10:30:00Z',verified_utc='2026-07-22T11:00:00Z')
    newer['impacts'].append(dict(currency='NZD',implication='Unresolved guidance.',thesis_effect='Review needed.'))
    request.update(as_of_utc='2026-07-22T11:00:00Z',currencies=['CHF','NZD'],developments=[newer],assessments=[
        dict(currency='CHF',gap='Later guidance is unresolved.',evidence_keys=['later-guidance']),
        dict(currency='NZD',gap='First assessment is unresolved.',evidence_keys=['later-guidance'])])
    append_research(ResearchRequest(**request),fixture.path)
    print(json.dumps(currency_summary(fixture.path)))
finally:
    fixture.doCleanups();fixture.tearDown()
`], { cwd: repo, encoding: 'utf8' }))
  assert.equal(validCurrencySummary(gapSummary), true, 'Production writer/projection gaps must be accepted by the left-panel validator')
  assert.equal(gapSummary.rows.find(row=>row.currency==='CHF').review_status,'provisional','Production stage metadata survives a later unresolved review')
  assert.equal(gapSummary.rows.find(row => row.currency === 'CHF').evidence_anchor.event_at, '2026-07-22T09:00:00Z')
  assert.equal(gapSummary.rows.find(row => row.currency === 'NZD').evidence_anchor, null)
  assert.equal(validCurrencySummary(snapshot), true)
  const originalSnapshot = structuredClone(snapshot)
  const staged = structuredClone(snapshot)
  Object.assign(staged.rows[0], { review_status:'provisional', stage_note:'Statement only; conference Q&A pending.' })
  assert.equal(validCurrencySummary(staged), true)
  assert.equal(currencyAssessmentStatus(staged.rows[0], now).label, 'Provisional')
  for (const fields of [{review_status:'invalid',stage_note:'Statement'}, {review_status:'complete',stage_note:' '},
    {review_status:'provisional'}, {stage_note:'Statement only'}, {review_status:null,stage_note:null}]) {
    const invalid=structuredClone(snapshot);Object.assign(invalid.rows[0],fields)
    assert.equal(validCurrencySummary(invalid),false,'Malformed review stages must not be displayed as complete assessments')
  }
  const focused = { ...structuredClone(snapshot), as_of_utc: '2026-10-29T12:36:00Z' }
  Object.assign(focused.rows[7], { verified_utc: focused.as_of_utc, reassessment: { ...checkpoint, event_at: '2026-10-29T13:15:00Z' } })
  assert.equal(validCurrencySummary(focused), true, 'A focused refresh preserves another currency\'s elapsed checkpoint')
  const expiredAtAssessment = structuredClone(focused)
  expiredAtAssessment.rows[0].verified_utc = focused.as_of_utc
  assert.equal(validCurrencySummary(expiredAtAssessment), false, 'A freshly assessed row still needs a future checkpoint')
  const dateOnlyFocused = structuredClone(focused)
  dateOnlyFocused.rows[0].reassessment = { ...checkpoint, event_at: null, event_date: '2026-10-28' }
  assert.equal(validCurrencySummary(dateOnlyFocused), true, 'Unresearched date-only deadlines also retain their original assessment clock')
  assert.equal(currencyStaleness(snapshot.rows[0].verified_utc, now), '1h 0m ago')
  assert.equal(currencyStaleness(null, now), 'Unknown')
  assert.equal(currencyStaleness('2026-10-26T16:00:00Z', Date.parse('2026-10-28T16:00:00Z')), '2d 0h ago')
  assert.equal(currencyStaleness('2026-10-27T00:00:00Z', now), 'Unknown')
  assert.equal(currencyStaleness('not a timestamp', now), 'Unknown')
  for (const fields of [{ intensity: 'extreme' }, { intensity: null }, { horizon: ' ' }, { basis: 'EURUSD' }]) {
    const invalid = structuredClone(snapshot); Object.assign(invalid.rows[0], fields)
    assert.equal(validCurrencySummary(invalid), false, 'Standalone labels require explicit qualitative pressure and horizon')
  }
  const future = structuredClone(snapshot); future.rows[0].evidence_anchor.event_at = '2026-10-27T00:00:00Z'
  assert.equal(validCurrencySummary(future), false)
  const both = structuredClone(snapshot); both.rows[0].evidence_anchor.event_date = '2026-10-26'
  assert.equal(validCurrencySummary(both), false)
  const unsafe = structuredClone(snapshot); unsafe.rows[0].reassessment.sources[0].locator = 'javascript:alert(1)'
  assert.equal(validCurrencySummary(unsafe), false)
  assert.equal(validCurrencySummary({ ...snapshot, rows: snapshot.rows.map(() => snapshot.rows[0]) }), false)
  assert.equal(currencyUntil(checkpoint, now).label, '1d 23h')
  assert.deepEqual(currencyUntil(null, now, 'Conference Q&A is unresolved.'), { label: 'Source gap', due: true })
  assert.deepEqual(currencyUntil(null, now, ' '), { label: '—', due: false })
  assert.equal(currencyUntil(checkpoint, now, 'A gap must not hide a saved deadline.').label, '1d 23h')
  const unknownHour = { ...checkpoint, event_at: null, event_date: '2026-10-28' }
  assert.equal(currencyUntil(unknownHour, now).due, false)
  assert.match(currencyUntil(unknownHour, Date.parse('2026-10-27T17:00:00Z')).label, /Today · untimed/)
  assert.equal(currencyAssessmentStatus({...staged.rows[0],reassessment:unknownHour},Date.parse('2026-10-27T17:00:00Z')).label,'Checkpoint passed',
    'Unknown hours become unresolved at the Jakarta date boundary without inventing a time')
  await React.act(async () => root.render(React.createElement(CurrencySummary)))
  assert.equal(container.querySelectorAll('[data-currency-summary]').length, 8)
  assert.doesNotMatch(container.textContent, /Previous assessment|Review needed|Review due/i)
  assert.deepEqual([...container.querySelectorAll('thead th')].map(node => node.textContent), ['Evidence age','CUR','VERDICT','Checkpoint'])
  const usd = () => container.querySelector('[data-currency-summary="USD"]')
  assert.match(usd().textContent, /Moderate strengthening.*1d 23h/)
  assert.match(usd().querySelector('td:nth-of-type(2)').title, /Standalone fundamental pressure.*Current session/)
  assert.match(container.querySelector('[data-currency-summary="EUR"]').textContent, /Legacy view.*—/, 'Legacy relative labels are not silently graded as standalone')
  assert.equal(requests[0].url, '/storage-api/theses/summary', 'Independent of chart, monthly selector and bottom dock')
  assert.match(usd().querySelector('td').textContent, /3h 0m ago/)
  assert.match(usd().querySelector('td').title, /Fundamentals assessed.*Oct 26, 2026.*11:00 PM/)
  assert.equal(usd().querySelector('td:last-child').textContent, '1d 23h')
  assert.match(usd().querySelector('td:last-child').title, /Fed rate decision/)
  const heading=container.querySelector('h2 button')
  const content=document.getElementById(heading.getAttribute('aria-controls'))
  assert.equal(heading.getAttribute('aria-expanded'),'true')
  const beforeCollapse=requests.length
  await React.act(async()=>heading.click())
  assert.equal(content.hidden,true)
  assert.equal(heading.getAttribute('aria-expanded'),'false')
  assert.equal(localStorage.getItem('fyodor.fundamentals.collapsed.v1'),'true')
  assert.equal(requests.length,beforeCollapse,'Collapse never invokes research')
  await React.act(async()=>root.render(null))
  await React.act(async()=>root.render(React.createElement(CurrencySummary)))
  assert.equal(container.querySelector('h2 button').getAttribute('aria-expanded'),'false','Collapse survives remount')
  await React.act(async()=>container.querySelector('h2 button').click())
  assert.equal(container.querySelector('h2 button').getAttribute('aria-expanded'),'true')
  const row = usd(); await poll()
  assert.equal(usd(), row, 'Unchanged polling retains rendered rows')
  assert.ok(requests.at(-1).url.includes('after_revision=one'))
  snapshot = { ...staged, revision:'statement-stage' }; await poll()
  assert.match(usd().textContent,/Moderate strengthening \*/)
  assert.match(usd().querySelector('td:nth-of-type(2)').title,/conference Q&A pending/)
  now = Date.parse(checkpoint.event_at)
  await React.act(async()=>[...intervals.values()][0].fn())
  assert.match(usd().textContent,/Moderate strengthening \*.*Passed/,
    'At the deadline the marker and checkpoint qualify the unchanged verdict without a repeated status block')
  assert.equal(snapshot.rows[0].verified_utc,originalSnapshot.rows[0].verified_utc)
  now=Date.parse('2026-10-26T17:00:00Z')
  await React.act(async()=>[...intervals.values()][0].fn())
  snapshot = { ...originalSnapshot, revision:'resolved-stage', rows:originalSnapshot.rows.map(r=>r.currency==='USD'
    ? {...r,review_status:'complete',stage_note:'Conference and contrary path reporting reviewed.'} : r) }
  await poll()
  assert.equal(usd().querySelector('.currency-assessment-marker')?.textContent,undefined,'A completed fresh review clears the provisional label')
  snapshot = { ...snapshot, revision: 'gap', rows: snapshot.rows.map(row => row.currency === 'CAD'
    ? { ...row, evidence_anchor: { ...anchor, event_at: null, event_date: '2026-10-26' }, reassessment_gap: 'Conference Q&A is unresolved.' } : row) }
  await poll()
  const cad = container.querySelector('[data-currency-summary="CAD"]')
  assert.match(cad.textContent, /~1d ago.*Moderate weakening \*.*Source gap/)
  assert.equal(cad.className, 'currency-review-due')
  assert.match(cad.querySelector('td').title, /Fundamentals assessed.*11:00 PM/)
  assert.match(cad.querySelector('td:last-child').title, /Conference Q&A is unresolved/)
  const beforeExpiryTick=requests.length
  now = Date.parse(checkpoint.event_at)
  await React.act(async () => [...intervals.values()][0].fn())
  assert.match(usd().textContent, /Moderate strengthening \*.*Passed/, 'An elapsed checkpoint never reverses the verdict')
  assert.equal(usd().className, 'currency-review-due')
  assert.equal(requests.length, beforeExpiryTick, 'Countdown does not fetch or invoke research')
  snapshot = { ...snapshot, revision: 'two', as_of_utc: '2026-10-28T16:00:00Z', rows: snapshot.rows.map((row, index) => index ? row
    : { ...row, verdict: 'POTENTIAL WEAKENING', reassessment: { ...checkpoint, title: 'Fed press conference', event_at: '2026-10-28T16:30:00Z' } }) }
  await poll()
  assert.match(usd().textContent, /Moderate weakening.*30m/)
  assert.equal(usd().querySelector('td').textContent, '2d 2h ago', 'A new global header never makes underlying evidence newer')
  snapshot = { ...snapshot, revision: 'reassessed', rows: snapshot.rows.map(row => row.currency === 'USD'
    ? { ...row, intensity: 'slight', verified_utc: '2026-10-28T16:00:00Z' } : row) }
  await poll()
  assert.match(usd().textContent, /2d 2h ago.*Slight weakening.*30m/, 'A fresh assessment never redates old evidence')
  assert.deepEqual(snapshot.rows[0].evidence_anchor, anchor, 'Supporting evidence keeps its original source time')
  snapshot = { ...snapshot, revision: 'focused-refresh', as_of_utc: '2026-10-29T12:36:00Z', rows: snapshot.rows.map(row => row.currency === 'EUR'
    ? { ...row, basis: 'standalone', intensity: 'slight', horizon: 'Earlier unchanged assessment.', reassessment: checkpoint } : row) }
  await poll()
  assert.match(usd().textContent, /Slight weakening.*30m/)
  assert.match(container.querySelector('[data-currency-summary="EUR"]').textContent, /Slight weakening \*.*Passed/, 'A different currency refresh must not invalidate the panel or renew an elapsed checkpoint')
  assert.equal(container.querySelector('[data-currency-summary="EUR"] .currency-assessment-marker').getAttribute('aria-label'),'Checkpoint passed')
  assert.equal(container.querySelector('[role="alert"]'), null)
  offline = true; await poll()
  assert.match(container.querySelector('[role="alert"]').textContent, /refresh failed.*last loaded snapshot/i)
  assert.match(usd().textContent, /weakening/)
  offline = false; malformed = true; await poll()
  assert.match(container.querySelector('[role="alert"]').textContent, /Invalid/)
  assert.equal(container.querySelectorAll('[data-currency-summary]').length, 8)
  malformed = false; await poll(); assert.equal(container.querySelector('[role="alert"]'), null)
  snapshot = gapSummary; await poll()
  assert.equal(container.querySelector('[role="alert"]'), null)
  assert.equal(container.querySelectorAll('[data-currency-summary]').length, 8, 'A pending research gap must not blank the entire panel')
  assert.match(container.querySelector('[data-currency-summary="CHF"]').textContent, /Slight weakening \*.*Source gap/)
  assert.equal(container.querySelector('[data-currency-summary="CHF"] .currency-assessment-marker').getAttribute('aria-label'),'Source gap',
    'New unassessed guidance cannot make the retained verdict look freshly endorsed')
  assert.match(container.querySelector('[data-currency-summary="NZD"]').textContent, /Not assessed.*Source gap/)
  hold = true
  const [timerId, timer] = [...timers][0]; timers.delete(timerId)
  await React.act(async () => { void timer.fn() })
  await React.act(async () => root.render(null))
  assert.equal(held[0].options.signal.aborted, true)
  await React.act(async () => held[0].resolve(response(held[0].url)))
  assert.equal(timers.size, 0); assert.equal(intervals.size, 0)
  hold = false
  snapshot = { schema: 1, revision: 'empty', review_id: null, as_of_utc: null, rows: snapshot.rows.map(row => ({ ...row, verdict: null, verified_utc: null, evidence_anchor: null, reassessment: null, basis: null, intensity: null, horizon: '' })) }
  await React.act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(CurrencySummary))))
  assert.match(container.textContent, /No current Thesis saved/)
  assert.equal(container.querySelectorAll('[data-currency-summary]').length, 8)
  assert.match(usd().textContent, /Not assessed/)
  console.log('✓ Currency summary: latest saved direction, explicit checkpoint countdown, expiry without reversal, refresh/correction, unknown hours, failures and cleanup')
} finally {
  await React.act(async () => root.unmount())
  assert.equal(timers.size, 0); assert.equal(intervals.size, 0)
  Date.now = realNow
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
