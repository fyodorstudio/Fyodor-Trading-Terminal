import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

// Headless legacy-currency archive contract; fixtures do not depend on deleted pair records.
const server=await createServer({root:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),server:{middlewareMode:true,hmr:false}})
const dom=new Window({url:'http://localhost:5173'})
const globals={window:dom,document:dom.document,HTMLElement:dom.HTMLElement,Node:dom.Node,navigator:dom.navigator,localStorage:dom.localStorage,IS_REACT_ACT_ENVIRONMENT:true}
const previous=new Map([...Object.keys(globals),'fetch'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
for(const [k,v] of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v})
const timers=new Map();let sequence=0
const requests=[],downloads=[],blobs=[],revoked=[]
dom.setTimeout=(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence};dom.clearTimeout=id=>timers.delete(id)
const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL,originalClick=dom.HTMLAnchorElement.prototype.click
URL.createObjectURL=blob=>{blobs.push(blob);return `blob:archive-${blobs.length}`};URL.revokeObjectURL=url=>revoked.push(url)
dom.HTMLAnchorElement.prototype.click=function(){downloads.push({name:this.download,href:this.href})}
const reviewEntry = { id: 'a'.repeat(32), review_id: 'b'.repeat(32), expected_version: null, scope: 'ALL',
  as_of_utc: '2026-10-19T08:00:00Z', saved_utc: '2026-10-19T09:00:00Z', horizon: 'This week', provenance: 'assessment',
  takeaway: 'Saved currency research.', limitations: 'One source gap remains.', note: 'Dated review fixture.',
  opportunity_ids: [],
  backdrop: ['USD','EUR','GBP','JPY','CHF','CAD','AUD','NZD'].flatMap(currency => ['policy','inflation','labor','growth','other'].map(category => ({ currency, category, gap: '', evidence: [{ published_on: '2026-07-01', summary: `${currency} ${category} dated evidence.`, verified_utc: '2026-10-19T07:00:00Z', publication_note: '', sources: [{ kind: 'web', label: 'Official release', locator: 'https://example.com/source', note: '' }] }] }))),
  planning_as_of_utc: '2026-10-19T08:30:00Z',
  currency_views: ['USD','EUR','GBP','JPY','CHF','CAD','AUD','NZD'].map(currency => ({ currency, bias: `${currency} bias.`, summary: `${currency} concise backdrop.`, counterweight: `${currency} strongest counterweight.`, sources: [{ kind: 'web', label: 'Official', locator: 'https://example.com/source', note: '' }], checkpoints: [
    { title: `${currency} release`, event_at: '2026-10-20T06:00:00Z', event_date: null, verified_utc: '2026-10-19T08:00:00Z', sources: [{ kind: 'web', label: 'Schedule', locator: 'https://example.com/schedule', note: '' }], note: 'Persistence supports; cooling challenges.' },
    { title: 'Unknown hour', event_at: null, event_date: '2026-10-21', verified_utc: '2026-10-19T08:00:00Z', sources: [{ kind: 'web', label: 'Schedule', locator: 'https://example.com/schedule', note: '' }], note: '' },
  ] })) }
const review = { ...reviewEntry, versions: [{...reviewEntry,id:'d'.repeat(32)},reviewEntry], opportunities: [] }

const snapshot=(month)=>({schema:1,scope:'ALL',month,source_id:null,revision:'archive',past:[],planned:[],reviews:[review]})
globalThis.fetch=async(url,options={})=>{requests.push({url,options});const params=new URL(url,'http://localhost').searchParams;return {ok:true,json:async()=>snapshot(params.get('month'))}}
const {createRoot}=await import('react-dom/client')
const container=document.createElement('div');document.body.append(container);const root=createRoot(container)
const toggle=async(details,open=true)=>React.act(async()=>{details.open=open;details.dispatchEvent(new dom.Event('toggle'))})
try {
  const {LegacyResearchArchive}=await server.ssrLoadModule('./src/thesis/LegacyResearchArchive.tsx')
  const {validThesisSnapshot,readThesisCurrency,readThesisMonth,thesisDays}=await server.ssrLoadModule('./src/thesis/thesis-model.ts')
  const {currencyDirectionTimeline,newsSourceTime}=await server.ssrLoadModule('./src/thesis/currency-timeline.ts')
  const timedReview = (at, verdict, saved = at) => ({ ...reviewEntry, format: 'daily_news', as_of_utc: at, saved_utc: saved,
    currency_views: [{ currency: 'JPY', checkpoints: [], direction: { verdict, reason: 'Verified changed mechanism.', verified_utc: at, sources: [] } }] })
  const early = timedReview('2026-10-26T01:00:00Z', 'POTENTIAL STRENGTHENING')
  const unchanged = timedReview('2026-10-26T02:00:00Z', 'POTENTIAL STRENGTHENING')
  const later = timedReview('2026-10-26T12:00:00Z', 'POTENTIAL WEAKENING')
  const future = timedReview('2026-10-26T13:00:00Z', 'POTENTIAL STRENGTHENING')
  assert.deepEqual(currencyDirectionTimeline([future, later, unchanged, early], later, 'JPY').map(item => item.at), [early.as_of_utc, later.as_of_utc])
  assert.deepEqual(currencyDirectionTimeline([early, unchanged], unchanged, 'JPY'), [], 'Unchanged assessments add no reversal history')
  const graded = (base, intensity) => ({ ...base, currency_views: base.currency_views.map(view => ({ ...view,
    direction: { ...view.direction, basis: 'standalone', intensity, horizon: 'Current session through the next checkpoint.' } })) })
  const slight = graded(early, 'slight'), moderate = graded(unchanged, 'moderate')
  assert.deepEqual(currencyDirectionTimeline([slight, moderate], moderate, 'JPY').map(item => item.direction.intensity),
    ['slight', 'moderate'], 'A pressure change is visible even when both verdicts are strengthening')
  assert.deepEqual(currencyDirectionTimeline([early, slight], slight, 'JPY'), [], 'Same-cutoff correction replaces the older basis')
  const correctedCutoff = timedReview('2026-10-26T08:00:00+07:00', 'POTENTIAL WEAKENING', '2026-10-26T03:00:00Z')
  assert.deepEqual(currencyDirectionTimeline([early, correctedCutoff, later], later, 'JPY'), [], 'Correction at the same instant replaces the earlier interpretation')
  assert.deepEqual(currencyDirectionTimeline([early, { ...later, provenance: 'reconstruction' }], { ...later, provenance: 'reconstruction' }, 'JPY'), [])
  assert.match(newsSourceTime({ published_at: null, verified_utc: '2026-10-26T12:00:00Z' }), /Publication hour unverified.*7:00 PM Jakarta/)
  assert.equal(validThesisSnapshot(snapshot('2026-10'),'ALL','2026-10',null),true)
  assert.equal(readThesisMonth(),'2026-10')
  assert.equal(readThesisCurrency(),'EUR')
  localStorage.setItem('fyodor.thesis.currency.v1','ALL');assert.equal(readThesisCurrency(),'EUR','Retired All preference cannot select multiple currencies')
  assert.equal(thesisDays('2028-02'),29)
  await React.act(async()=>root.render(React.createElement(LegacyResearchArchive,{currency:'CHF'})))
  const detail=container.querySelector('.thesis-details')
  assert.ok(detail)
  assert.ok(!container.textContent.includes('CHF concise backdrop.'),'Snapshot bodies stay unmounted until expanded')
  await toggle(detail)
  assert.match(container.textContent,/CHF concise backdrop/)
  assert.ok(!container.textContent.includes('USD concise backdrop.'),'Archive shows only the selected currency')
  assert.match(container.textContent,/CHF policy dated evidence/)
  const exportButton=container.querySelector('button')
  const count=requests.length
  await React.act(async()=>exportButton.click())
  assert.equal(requests.length,count,'Export performs no research or fetch')
  assert.equal(downloads[0].name,'thesis-CHF-2026-10-19.md')
  const markdown=await blobs[0].text()
  assert.match(markdown,/CHF concise backdrop/);assert.ok(!markdown.includes('USD concise backdrop.'))
  assert.match(markdown,/--scope CHF/)
  assert.equal(downloads[0].href,revoked[0]);assert.equal(document.querySelector('a[download]'),null)
  await React.act(async()=>root.render(React.createElement(LegacyResearchArchive,{currency:'USD'})))
  assert.ok(!container.textContent.includes('CHF concise backdrop.'))
  await toggle(container.querySelector('.thesis-details'))
  assert.match(container.textContent,/USD concise backdrop/);assert.ok(!container.textContent.includes('CHF concise backdrop.'))
  console.log('✓ Thesis archive: selected currency, lazy snapshots, retained histories, scoped export, timing utilities and cleanup')
} finally {
  await React.act(async()=>root.unmount());assert.equal(timers.size,0)
  URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;dom.HTMLAnchorElement.prototype.click=originalClick
  await server.close();await dom.happyDOM.close()
  for(const [k,d] of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}
}
