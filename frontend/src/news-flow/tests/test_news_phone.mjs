import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost:5173' }), requests = [], timers = new Map()
let timerId = 0
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
dom.setTimeout = (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId }
dom.clearTimeout = id => timers.delete(id)
globalThis.fetch = (url, options = {}) => new Promise(resolve => requests.push({ url, ...options, resolve, answered: false }))
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'), server: { middlewareMode: true, hmr: false }, appType: 'custom' })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host)
const root = createRoot(host)
const control = label => document.querySelector(`[aria-label="${label}"]`)
const pending = part => requests.findLast(request => !request.answered && !request.signal?.aborted && request.url.includes(part))
async function click(label) { await React.act(async () => { assert.ok(control(label), label); control(label).click() }) }
async function change(label, value) {
  await React.act(async () => {
    const input = control(label), proto = input.tagName === 'SELECT' ? dom.HTMLSelectElement.prototype : dom.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value)
    input.dispatchEvent(new dom.Event('input', { bubbles: true })); input.dispatchEvent(new dom.Event('change', { bubbles: true }))
  })
}
async function reply(request, body, status = 200) {
  assert.ok(request)
  request.answered = true
  await React.act(async () => request.resolve({ ok: status < 400, status, json: async () => body }))
}
try {
  const { NewsAlarmButton } = await server.ssrLoadModule('./src/news-flow/NewsAlarm.tsx')
  dom.localStorage.setItem('fyodor.news-flow.v1', JSON.stringify({ presetVersion: 3, marketRelevance: false, include: 'oil', exclude: 'India', hiddenSources: ['sports'] }))
  await React.act(async () => root.render(React.createElement(NewsAlarmButton)))
  await click('Headline alarms')
  const phone = { mode: 'off', max_age_seconds: 86400, unified_alerts: true, error: '', last_sent: null, connection: { server: 'http://192.168.1.10:8004',
    reader: 'http://192.168.1.10:8005/news', topic: 'private-topic', reader_password: 'private-password' } }
  await reply(pending('/notifications'), phone)
  assert.equal(control('Phone reader password'), null, 'Credentials are concealed until requested')
  assert.equal(control('ntfy server').value, phone.connection.server)
  await React.act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Show reader login').click())
  assert.equal(control('Phone reader password').value, 'private-password')
  assert.equal(control('Phone reader password').readOnly, true)
  assert.equal(control('Phone news trigger'),null,'Phone has no separate trigger')
  await change('News alert trigger', 'included')
  assert.equal(pending('/notifications/settings'), undefined, 'Trigger edits stay draft until Save')
  await click('Save news alert settings')
  const save = pending('/notifications/settings')
  assert.equal(save.method, 'PUT')
  assert.deepEqual(JSON.parse(save.body), { mode: 'included', max_age_seconds: 86400 })
  await reply(save, { ...phone, mode: 'included' })
  assert.equal(control('News alert trigger').value, 'included')
  await change('News publication age unit','hours')
  await change('News publication age amount','6')
  await click('Save news alert settings')
  const ageSave=pending('/notifications/settings')
  assert.deepEqual(JSON.parse(ageSave.body),{mode:'included',max_age_seconds:21600})
  await reply(ageSave,{...phone,mode:'included',max_age_seconds:21600})
  assert.equal(control('News publication age amount').value,'6')
  assert.equal(control('News publication age unit').value,'hours')
  await change('News alert trigger', 'priority')
  await click('Save news alert settings')
  const prioritySave = pending('/notifications/settings')
  assert.deepEqual(JSON.parse(prioritySave.body), { mode: 'priority', max_age_seconds: 21600 })
  await reply(prioritySave, { ...phone, mode: 'priority', max_age_seconds: 21600 })
  assert.equal(control('News alert trigger').value, 'priority', 'Priority 1 is accepted and persisted by the shared profile')
  await change('News alert sound', 'pulse')
  assert.notEqual((await server.ssrLoadModule('./src/news-flow/model.ts')).readNewsSettings().sound, 'pulse', 'Sound is drafted with the shared settings')
  await change('News publication age amount', '0')
  assert.equal(control('Save news alert settings').disabled, true, 'Invalid age cannot save any settings')
  await change('News publication age amount', '12')
  await change('News alert trigger', 'all')
  await click('Save news alert settings')
  const failedSave = pending('/notifications/settings')
  await reply(failedSave, {}, 503)
  assert.equal(control('News alert trigger').value, 'all', 'Failed save preserves the draft')
  assert.match(host.textContent, /Could not save/)
  assert.notEqual((await server.ssrLoadModule('./src/news-flow/model.ts')).readNewsSettings().sound, 'pulse', 'Failed shared save cannot apply local sound')
  await click('Save news alert settings')
  const combinedSave = pending('/notifications/settings')
  assert.deepEqual(JSON.parse(combinedSave.body), { mode: 'all', max_age_seconds: 43200 })
  await reply(combinedSave, { ...phone, mode: 'all', max_age_seconds: 43200 })
  assert.equal((await server.ssrLoadModule('./src/news-flow/model.ts')).readNewsSettings().sound, 'pulse')
  assert.match(host.textContent, /Settings saved/)
  assert.equal(control('Save news alert settings').disabled, true)
  assert.deepEqual([...control('News alert trigger').options].map(option => option.textContent), ['Off', 'Priority 1 only', 'Priority 1 + Priority 2', 'All new headlines'])
  await React.act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Send test notification').click())
  const test = pending('/notifications/test')
  assert.equal(test.method, 'POST')
  await reply(test, { sent: true })
  assert.match(host.textContent, /does not confirm phone receipt/)
  await React.act(async () => control('News alert trigger').dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(control('Headline alarms').getAttribute('aria-expanded'), 'false')
  assert.equal(document.activeElement, control('Headline alarms'))
  await React.act(async () => root.render(null))

  const { MobileNews } = await server.ssrLoadModule('./src/news-flow/mobile/MobileNews.tsx')
  const before = requests.length
  await React.act(async () => root.render(React.createElement(MobileNews)))
  await reply(pending('/phone-profile'), { include: 'Japan', exclude: '', hidden: [], filter_policy: '{"other_markets":false}' })
  const source = { id: 'reuters', name: 'Reuters', url: 'https://news.google.com/rss/search?q=site:reuters.com', error: '', last_success: 1 }
  await reply(pending('/sources'), { sources: [source] })
  const now = Date.now(), headline = { id: 'yen', source_id: 'reuters', source_name: 'Reuters', publisher: 'Reuters', title: 'Japanese Yen intervention warning',
    summary: '', url: 'https://example.com/yen', first_seen: now, published_at: now - 300000, timeline_at: now - 300000 }
  await reply(pending('/items'), { items: [headline], total: 1 })
  assert.match(host.textContent, /Japanese Yen intervention warning/)
  assert.equal(host.querySelector('article a').href, headline.url)
  assert.equal(host.querySelector('article').style.borderLeftColor, '#ef4444', 'Shared keyword profile classifies the phone reader')
  assert.equal(host.querySelector('time').dateTime, new Date(headline.published_at).toISOString())
  assert.equal(control('Headline alarms'), null, 'Phone view cannot alter desktop alarms')
  assert.equal([...host.querySelectorAll('button')].some(button => /Wildcard|Star headline/.test(button.getAttribute('aria-label') || '')), false)
  await change('Phone news date', '2026-11-09')
  let query = new URL(pending('/items').url, 'http://localhost').searchParams
  assert.equal(JSON.parse(query.get('filter_policy')).other_markets, false, 'Phone reading uses the shared automatic filters')
  assert.equal(Number(query.get('start')), new Date(2026, 10, 9).getTime())
  assert.equal(Number(query.get('end')), new Date(2026, 10, 10).getTime())
  assert.equal(control('News sort order').value, 'newest-collected')
  const originalStart=query.get('start'), originalEnd=query.get('end')
  await change('News sort order','oldest-published')
  query=new URL(pending('/items').url,'http://localhost').searchParams
  assert.equal(query.get('sort_by'),'published'); assert.equal(query.get('order'),'oldest')
  assert.equal(query.get('start'),originalStart); assert.equal(query.get('end'),originalEnd)
  await click('Show Excluded headlines')
  query=new URL(pending('/items').url,'http://localhost').searchParams
  assert.equal(query.get('mode'),'relevant', 'Phone can read Priority 1 and 2 together')
  await click('Show Priority 2 headlines')
  query=new URL(pending('/items').url,'http://localhost').searchParams
  assert.equal(query.get('mode'),'priority')
  const priority={...headline,relevance:{included:true,tier:'priority',reason:'Included · Japan',keyword:'Japan',priority_reason:'Reported currency intervention'}}
  await reply(pending('/items'),{items:[priority],total:1})
  assert.equal(host.querySelector('article').dataset.newsCategory,'priority')
  assert.match(host.textContent,/Priority 1 · Reported currency intervention/)
  assert.ok(requests.slice(before).every(request => !request.method || request.method === 'GET'), 'Phone browsing only reads the API')
  assert.equal(pending('/history'), undefined, 'Phone dates do not initiate external historical searches')
  await React.act(async () => root.render(null))
  assert.ok(requests.slice(before).every(request => request.answered || request.signal.aborted), 'Phone reader cancels in-flight requests on unmount')
  console.log('✓ News phone: bell setup, concealed login, persisted triggers, test acknowledgements, Escape, read-only mobile filtering/date scopes and cleanup')
} finally {
  await React.act(async () => root.unmount())
  await server.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
  await dom.happyDOM.abort()
}
