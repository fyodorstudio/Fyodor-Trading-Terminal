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
  const { FundamentalSettingsPanel } = await load('fundamental-tools/ui/FundamentalSettingsPanel.tsx')
  const { fundamentalSettingsEvent } = await load('fundamental-tools/runtime/settings-navigation.ts')
  const sequence = await load('usd-context/sequences/storage/sequence-preferences.ts')
  const notes = await load('external-events/storage/external-event-store.ts')
  const workspace = await load('workspace-portability/workspace-snapshot.ts')
  const session = await load('fundamental-tools/runtime/inspection-session.ts')
  const catalog = await load('scoring-system/scoring-signal-bindings.ts')
  sequence.saveSequencePreferences({ roofs: false, fresh: true, ribbon: false })
  const props = { symbol: 'EURUSD', quote: null, timeframe: 'H1', onSelectTimeframe() {}, drawingToolbarVisible: true,
    onToggleDrawingToolbar() {}, raycasterVisible: false, raycasterSupported: true, onToggleRaycaster: () => toggles++,
    brokerId: 'A', brokerOffsetSeconds: 10800, clockOffsetMs: Date.UTC(2026, 4, 28, 12) - Date.now(), timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 } }
  function Harness(next) {
    const [open, setOpen] = React.useState(false), [family, setFamily] = React.useState('claims')
    React.useEffect(() => {
      const request = e => { if (e.detail?.family) setFamily(e.detail.family); setOpen(true) }
      window.addEventListener(fundamentalSettingsEvent, request)
      return () => window.removeEventListener(fundamentalSettingsEvent, request)
    }, [])
    return React.createElement(React.Fragment, null,
      React.createElement(ChartWorkspaceHeader, { ...next, fundamentalSettingsActive: open }),
      open && React.createElement(FundamentalSettingsPanel, { ...next, family, onFamilyChange: setFamily }),
      React.createElement('button', { onClick: () => setOpen(false) }, 'Close dock'))
  }
  const render = next => React.act(async () => root.render(React.createElement(React.Fragment, null,
    React.createElement(Harness, next ?? props), React.createElement(ChartBoundary))))
  const click = element => React.act(async () => element.click())
  const gear = () => host.querySelector('[aria-label="Fundamental tools settings"]')
  const panel = () => host.querySelector('[aria-label="Fundamental Settings"]')
  const tab = name => [...host.querySelectorAll('[role="tab"]')].find(b => b.textContent === name)
  const change = (element, value) => React.act(async () => { element.value = value; element.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  await render()
  const group = host.querySelector('[aria-label="Fundamental tools"]'), buttons = [...group.children].filter(e => e.tagName === 'BUTTON')
  assert.equal(buttons.length, 4); assert.ok(buttons.every(b => b.querySelector('svg') && b.textContent === ''))
  await click(host.querySelector('[aria-label="Show Raycaster"]')); assert.equal(toggles, 1)
  await click(gear()); assert.ok(panel()); assert.equal(host.querySelector('[role="dialog"]'), null)
  assert.equal(gear().getAttribute('aria-expanded'), 'true')
  assert.deepEqual(sequence.readSequencePreferences(), { roofs: false, fresh: true, ribbon: false })
  assert.equal(jobs, 0); assert.equal(requests, 0, 'Methodology opens without fetching or scoring history')
  assert.deepEqual([...panel().querySelectorAll('[role="tab"]')].map(b => b.textContent), ['Scoring System', 'Raycaster', 'Roofs', 'Candy'])
  const family = panel().querySelector('[aria-label="Scoring family"]')
  assert.equal(family.options.length, 10)
  await change(family, 'pce')
  const binding = catalog.scoringSignalBinding('pce')
  const rows = panel().querySelectorAll('[aria-label="Scoring rules"] tbody tr')
  assert.deepEqual([...rows].map(r => Number(r.lastElementChild.textContent.replace('%',''))), binding.signals.map(s => s.weight))
  assert.ok(panel().textContent.includes(binding.signals[0].description))
  const calibration = panel().querySelector('[aria-label="Latest core pace calibration"]')
  await change(calibration.querySelector('select'), 'custom')
  for (const [i,input] of [...calibration.querySelectorAll('input')].entries()) await React.act(async () => {
    Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value').set.call(input, String(i+1))
    input.dispatchEvent(new dom.Event('input',{bubbles:true}))
  })
  assert.equal(binding.settings.read()['core-pace'], undefined, 'Draft changes remain unapplied')
  await React.act(async () => calibration.dispatchEvent(new dom.Event('submit',{bubbles:true,cancelable:true})))
  assert.deepEqual(binding.settings.read()['core-pace'],[1,2,3])
  const snapshot = workspace.exportWorkspace()
  assert.deepEqual(JSON.parse(snapshot.entries[binding.settings.key])['core-pace'],[1,2,3])
  await React.act(async () => tab('Scoring System').dispatchEvent(new dom.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})))
  assert.equal(tab('Raycaster').getAttribute('aria-selected'),'true'); assert.equal(document.activeElement,tab('Raycaster'))
  await click(tab('Roofs'))
  const density = panel().querySelector('[aria-label="Roof display density"]')
  await change(density,'all'); assert.equal(sequence.readSequencePreferences().density,'all')
  assert.equal(panel().querySelectorAll('.roof-combination-group input').length,40)
  await click(panel().querySelector('[aria-label="Show Jobless Claims + Fed"]'))
  assert.deepEqual(sequence.readSequencePreferences().hiddenRoofs,['claims+fed'])
  await click([...panel().querySelectorAll('button')].find(b=>b.textContent==='Hide all combinations'))
  assert.equal(sequence.readSequencePreferences().hiddenRoofs.length,39); assert.equal(sequence.readSequencePreferences().fresh,false)
  await click([...panel().querySelectorAll('button')].find(b=>b.textContent==='Show all combinations'))
  assert.deepEqual(sequence.readSequencePreferences().hiddenRoofs,[])
  await click(tab('Candy'))
  const candyChoices=[...panel().querySelectorAll('h3')].find(h=>h.textContent==='Visible timelines').parentElement.querySelectorAll('input')
  await click(candyChoices[0]); await click(candyChoices[1])
  assert.equal(sequence.readSequencePreferences().raycasterCandy,false); assert.equal(sequence.readSequencePreferences().roofCandy,false)
  assert.equal(sequence.readSequencePreferences().ribbon,false)
  const inspection={usd:null,eur:null,fresh:null,cutoff:null,loading:false,message:null,held:false,signature:'test',window:{from:Date.UTC(2026,4,1),to:Date.UTC(2026,4,2)}}
  await React.act(async()=>session.publishInspection(session.toolScope('A','EURUSD','H1'),inspection))
  await click([...panel().querySelectorAll('button')].find(b=>b.textContent==='Manage outside events'))
  const editor=panel().querySelector('[aria-label="Manual outside events"]'),inputs=editor.querySelectorAll('input')
  assert.equal(inputs[1].value,'2026-05-01T00:00')
  await React.act(async()=>{Object.getOwnPropertyDescriptor(inputs[0].constructor.prototype,'value').set.call(inputs[0],'Manual outside example');inputs[0].dispatchEvent(new dom.Event('input',{bubbles:true}))})
  await React.act(async()=>editor.querySelector('form').dispatchEvent(new dom.Event('submit',{bubbles:true,cancelable:true})))
  assert.equal(notes.readExternalEvents()[0].from,inspection.window.from)
  assert.equal(notes.readExternalEvents()[0].brokerId,'A')
  await click(editor.querySelector('[aria-label="Back to tool settings"]'))
  await click([...panel().querySelectorAll('button')].find(b=>b.textContent==='Manage outside events'))
  await click(panel().querySelector('.external-event-list button'))
  await render({...props,brokerId:'B'})
  assert.equal(panel().querySelector('[aria-label="Manual outside events"]'),null,'A broker change closes the old note draft')
  assert.equal(notes.readExternalEvents()[0].brokerId,'A','Changing scope cannot move the saved note to another broker')
  await render(props)
  assert.equal(panel().querySelector('[aria-label="Manual outside events"]'),null,'Returning to the old scope does not revive its editor')
  await click([...host.querySelectorAll('button')].find(b=>b.textContent==='Close dock'))
  assert.equal(panel(),null)
  await click(gear()); await change(panel().querySelector('[aria-label="Scoring family"]'),'pce')
  assert.equal(panel().querySelector('[aria-label="Latest core pace magnitude mode"]').value,'custom')
  await render({...props,brokerId:null}); await click(tab('Roofs'))
  assert.equal([...panel().querySelectorAll('button')].find(b=>b.textContent==='Manage outside events').disabled,true)
  assert.equal(jobs,0);assert.equal(requests,0);assert.equal(chartRenders,1)
  console.log('PASS: gear dock navigation, canonical methods, explicit Apply/portability, Roofs/Candy controls, outside events and no chart work')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
