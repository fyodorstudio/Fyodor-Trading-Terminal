import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'ResizeObserver', 'IS_REACT_ACT_ENVIRONMENT']
const previous = Object.fromEntries(keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
const observers = new Set()
class TestResizeObserver {
  targets = new Set()
  constructor(callback) { this.callback = callback; observers.add(this) }
  observe(target) { this.targets.add(target) }
  disconnect() { this.targets.clear(); observers.delete(this) }
}
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'ResizeObserver' ? TestResizeObserver : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
const render = node => React.act(async () => root.render(node))
try {
  const load = p => server.ssrLoadModule('./src/' + p)
  const { combineContext } = await load('usd-context/core/combine-context.ts')
  const { usdContextPresentation } = await load('raycaster/core/usd-context-presentation.ts')
  const { buildRibbonTimeline } = await load('raycaster/ribbon/ribbon-timeline.ts')
  const { RaycasterBox } = await load('raycaster/ui/RaycasterBox.tsx')
  const { RaycasterSettings } = await load('fundamental-tools/settings/RaycasterSettings.tsx')
  const { ContextRibbon } = await load('raycaster/ribbon/ContextRibbon.tsx')
  const { inspectionSignature } = await load('fundamental-tools/runtime/inspection-session.ts')
  const families = await load('raycaster/storage/raycaster-family-settings.ts')
  const prefs = await load('pair-context/storage/relative-preferences.ts')
  const { relativeContext } = await load('pair-context/core/relative-context.ts')
  const at = Date.UTC(2026, 0, 1), hour = 3600000
  const source = (family, total) => ({ family, total, chartAt: at, releaseAt: at, sourceId: family, sourceLabel: family.toUpperCase(),
    usdDirection: total > 0 ? 'stronger' : total < 0 ? 'weaker' : 'uncomputed', strength: 'strong', reduced: false, tie: false, coverage: 1, reason: '', explanation: '' })
  const result = (a, b) => combineContext({ cpi: source('cpi', a), nfp: source('nfp', b) }, ['cpi', 'nfp'], at)
  families.saveRaycasterFamilies(['cpi', 'nfp'])
  const scale = { getVisibleRange: () => ({ from: at / 1000, to: at / 1000 }), width: () => 300, options: () => ({ barSpacing: 300 }),
    timeToCoordinate: t => (t - at / 1000) / 3600 * 300, subscribeVisibleLogicalRangeChange() {}, unsubscribeVisibleLogicalRangeChange() {}, subscribeSizeChange() {}, unsubscribeSizeChange() {} }
  const ribbonProps = { chartApi: { timeScale: () => scale }, bars: [{ time: at / 1000 }, { time: (at + hour) / 1000 }], timeframe: 'H1', now: at + hour,
    version: 'usd-context-memory-v8', loading: false, notice: null }
  const boxProps = { symbol: 'EURUSD', cutoff: at, loading: false, message: null, timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 }, onClose() {} }
  const readings = [[result(3, -2.7), 'conflicted', 'short'], [result(-3, 2.7), 'conflicted', 'long'], [result(3, -2.8), 'balanced', null],
    [result(0, 0), 'unchanged', null], [result(null, null), 'insufficient', null], [result(2, 2), 'short', null]]
  for (const [r, tone, edge] of readings) {
    const point = { chartAt: at, result: r, latest: r.members[0], update: 'Publication' }, p = usdContextPresentation('EURUSD', r, at)
    const timeline = buildRibbonTimeline({ points: [point] }, null, false, 'EURUSD')
    const pref = prefs.readRelativePreferences(), signature = inspectionSignature(families.readRaycasterFamilies(), pref.mode, pref.families)
    const inspection = { signature, usd: point, eur: null, fresh: null, cutoff: at, loading: false, message: null, held: false, window: null }
    const before = JSON.stringify({ ...localStorage }), canonical = JSON.stringify(r)
    await render(React.createElement(React.Fragment, null,
      React.createElement(RaycasterBox, { ...boxProps, point }),
      React.createElement(RaycasterBox, { ...boxProps, point, view: 'context-detailed' }),
      React.createElement(RaycasterSettings, { inspection, symbol: 'EURUSD', supported: true, relativeSupported: true, timeDisplay: boxProps.timeDisplay }),
      React.createElement(ContextRibbon, { ...ribbonProps, points: timeline, relative: false })))
    assert.ok(container.querySelector('.raycaster-bias').getAttribute('aria-label').startsWith(p.label))
    assert.equal(container.querySelector('.raycaster-box-detailed .raycaster-bias').getAttribute('aria-label'), p.label)
    assert.equal(container.querySelector('.raycaster-bias').classList.contains(p.direction ?? 'neutral'), true)
    assert.ok(container.querySelector('[aria-label="Context-detailed calculations"]'), 'Detailed view is available without a selected combo')
    assert.equal(container.querySelector('[aria-label="Raycaster calculation notes"]').open, false)
    assert.equal(container.querySelector('.context-detailed-content [aria-label="Raycaster event inputs"]').closest('details'), null, 'Contribution calculations stay visible')
    assert.equal(container.querySelector('[aria-label="Raycaster configuration"] table'), null, 'Settings contain no calculated readings')
    assert.equal(container.querySelectorAll('.raycaster-box:not(.raycaster-box-detailed) .context-detailed-content').length, 0, 'The ordinary Context view stays compact')
    assert.equal(container.querySelectorAll('.context-input-card').length, 8, 'Every family has one complete card')
    assert.deepEqual([...container.querySelector('.context-input-calculation').querySelectorAll('dt')].map(n => n.textContent), ['Source score', 'Assigned weight', 'Age retention', 'USD vote'])
    for (const card of container.querySelectorAll('.context-input-card')) {
      assert.equal(card.querySelectorAll('.context-input-calculation dd').length, 4)
      assert.equal(card.querySelectorAll('.vote-activity-metrics dd').length, 3)
      assert.equal(card.querySelectorAll('.context-input-release').length, 1)
      assert.equal(card.querySelectorAll('details, summary').length, 0, 'Calculation values stay visible')
    }
    const segment = container.querySelector('.ribbon-segment')
    assert.ok(segment.classList.contains(tone)); assert.equal(segment.classList.contains('lead-long'), edge === 'long'); assert.equal(segment.classList.contains('lead-short'), edge === 'short')
    assert.ok(segment.getAttribute('aria-label').startsWith(p.label))
    await React.act(async () => segment.click())
    const dialog = container.querySelector('[role="dialog"]')
    assert.ok(dialog.querySelector('header strong').textContent.startsWith(p.label))
    assert.match(dialog.textContent, /USD presentation v1/)
    if (p.state !== 'insufficient') {
      const splits = [...container.querySelectorAll('.usd-support-split')].map(n => n.textContent)
      assert.equal(splits.length, 3); assert.equal(new Set(splits).size, 1, 'Compact, detailed and Candy explanation use identical shares')
      assert.match(dialog.textContent, /Net toward Long.*Separation/)
    } else assert.match(dialog.textContent, /Usable configured coverage 0\.0% \(60% required\)/)
    if (p.narrow) assert.match(dialog.querySelector('header strong').textContent, /weak evidence/)
    assert.equal(JSON.stringify(r), canonical)
    assert.equal(JSON.stringify({ ...localStorage }), before, 'Presenting/clicking does not alter preferences')
  }
  const point = { chartAt: at, result: result(3, -2.7), latest: source('cpi', 3), update: 'Original USD publication' }
  const eur = { chartAt: at, total: .5, coverage: 1, usableCoverage: 1, members: [{ slot: 'inflation', chartAt: at, contribution: .5, status: 'active', coverage: 1 }], update: 'Original EUR publication' }
  const pair = relativeContext(eur, point), timeline = buildRibbonTimeline({ points: [point] }, { points: [eur] }, true, 'EURUSD')
  await render(React.createElement(React.Fragment, null,
    React.createElement(RaycasterBox, { ...boxProps, point, relative: pair, relativeUpdate: eur.update }),
    React.createElement(ContextRibbon, { ...ribbonProps, points: timeline, relative: true })))
  assert.ok(container.querySelector('.raycaster-bias').getAttribute('aria-label').startsWith(pair.label))
  assert.match(container.querySelector('.context-ribbon-legend').textContent, /All news · EUR vs USD/)
  assert.match(container.querySelector('.context-ribbon-legend').title, /Green: Long.*Red: Short.*Amber: mixed.*Gray: not enough usable data/)
  assert.equal(container.querySelector('.ribbon-segment').classList.contains(pair.direction), true)
  await React.act(async () => container.querySelector('.ribbon-segment').click())
  assert.equal(container.querySelector('.usd-support'), null, 'USD share block and lead edges do not leak into EUR mode')
  assert.doesNotMatch(container.querySelector('[role="dialog"]').textContent, /USD presentation v1/)
  assert.equal(container.querySelector('[class*="lead-"]'), null)
  const day = 86400000, publicationAt = at + 7 * day
  const freshNfp = { ...source('nfp', -2.7), chartAt: publicationAt, releaseAt: publicationAt }
  const inputs = { cpi: source('cpi', 3), nfp: freshNfp }
  const showActivity = async (when, observations = inputs) => {
    const assessment = combineContext(observations, ['cpi', 'nfp'], when)
    await render(React.createElement(RaycasterBox, { ...boxProps, cutoff: when + hour, view: 'context-detailed', point: {
      chartAt: when, result: assessment, latest: freshNfp,
      update: 'Memory update: older votes lose influence at the broker day boundary; no new release was added.',
    } }))
    assert.doesNotMatch(container.textContent, /Latest update:|Memory update:/)
    return assessment
  }
  const aged = await showActivity(publicationAt)
  const ageRow = family => container.querySelector(`.context-input-age[data-family="${family}"]`)
  const releaseRow = family => container.querySelector(`.context-input-release[data-family="${family}"] dd`)
  assert.match(ageRow('cpi').textContent, /Vote age7 days.*Influence remaining85\.1%.*Influence lost14\.9%/)
  assert.match(ageRow('nfp').textContent, /Vote age0 days.*Influence remaining100\.0%.*Influence lost0\.0%/)
  assert.equal(releaseRow('cpi').textContent, '-')
  assert.match(releaseRow('nfp').textContent, /NFP.*Jan 08/)
  assert.equal(container.querySelector('.context-input-card[data-family="cpi"] [data-field="vote"]').textContent, aged.members.find(m => m.family === 'cpi').contribution.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' }))
  await showActivity(publicationAt + day)
  assert.ok([...container.querySelectorAll('.context-input-release dd')].every(cell => cell.textContent === '-'), 'An aging point never repeats its last publication as new')
  await showActivity(at + 45 * day)
  assert.match(ageRow('cpi').textContent, /Influence remaining0\.0%.*Influence lost100\.0%.*Expired/)
  assert.equal(container.querySelector('.context-input-card[data-family="cpi"] [data-field="retention"]').textContent, '0.0%', 'Expired retention agrees with the zero active influence')
  await showActivity(at + 46 * day, { ...inputs, cpi: { ...source('cpi', null), chartAt: at + 46 * day } })
  assert.match(ageRow('cpi').textContent, /Influence remaining-.*Influence lost-.*No usable vote/)
  const chooseView = async value => React.act(async () => {
    const select = container.querySelector('[aria-label="Raycaster view"]')
    select.value = value; select.dispatchEvent(new dom.Event('change', { bubbles: true }))
  })
  await render(React.createElement(RaycasterBox, { ...boxProps, point }))
  await chooseView('context-detailed')
  assert.ok(container.querySelector('.raycaster-box-detailed'))
  await render(React.createElement(RaycasterBox, { ...boxProps, point: { ...point }, selectedCombo: null }))
  assert.equal(container.querySelector('[aria-label="Raycaster view"]').value, 'context-detailed', 'No combo selection is required to retain the detailed view')
  await chooseView('context')
  assert.equal(container.querySelector('.context-detailed-content'), null)
  // Reproduce the old jump: a new sentence made the box taller, triggering its
  // own ResizeObserver to clamp and persist the dragged position. Only genuine
  // chart resizes should now perform that work.
  await render(React.createElement(RaycasterBox, { ...boxProps, point }))
  const frame = container.querySelector('.raycaster-box'), anchor = frame.style.transform
  assert.equal(frame.style.maxWidth, '', 'Dragged x never reduces the fixed frame width')
  assert.equal(frame.style.maxHeight, '', 'Dragged y never reduces the fixed frame height')
  let frameHeight = 300, chartHeight = 800, resizeWork = 0
  frame.getBoundingClientRect = () => ({ width: 400, height: frameHeight })
  container.getBoundingClientRect = () => ({ width: 1000, height: chartHeight })
  const storageBefore = JSON.stringify({ ...localStorage })
  const resized = target => { for (const observer of observers) if (observer.targets.has(target)) { resizeWork++; observer.callback([{ target }]) } }
  for (let i = 0; i < 20; i++) {
    const updated = { ...point, result: { ...point.result, members: point.result.members.map(m => ({ ...m, sourceLabel: `${m.family}: ${'A changing publication description '.repeat(i + 1)}` })) } }
    await render(React.createElement(RaycasterBox, { ...boxProps, point: updated }))
    frameHeight = i % 2 ? 780 : 300
    await React.act(async () => resized(frame))
    assert.equal(frame.style.transform, anchor, 'A changing reading never moves the frame')
  }
  assert.equal(resizeWork, 0, 'Content updates perform zero resize/clamp work')
  assert.equal(JSON.stringify({ ...localStorage }), storageBefore, 'Reading updates never rewrite saved placement')
  // An explicit larger view fits by moving its anchor, not squeezing its width.
  frameHeight = 560
  await React.act(async () => {
    frame.querySelector('[aria-label="Move Raycaster"]').dispatchEvent(new dom.PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 9, clientX: 0, clientY: 0 }))
    window.dispatchEvent(new dom.PointerEvent('pointermove', { pointerId: 9, clientX: 580, clientY: 0 }))
    window.dispatchEvent(new dom.PointerEvent('pointerup', { pointerId: 9 }))
  })
  assert.equal(frame.style.transform, 'translate(594px, 58px)')
  await chooseView('context-detailed')
  frame.getBoundingClientRect = () => ({ width: 700, height: frameHeight })
  frameHeight = 740
  await React.act(async () => resized(container))
  assert.equal(frame.style.transform, 'translate(300px, 58px)', 'The 700px detailed frame shifts left to fit at the right edge')
  assert.equal(frame.style.maxWidth, '')
  await chooseView('context')
  frame.getBoundingClientRect = () => ({ width: 400, height: frameHeight })
  resizeWork = 0
  chartHeight = 200; frameHeight = 192
  await React.act(async () => resized(container))
  assert.equal(resizeWork, 1)
  assert.equal(frame.style.transform, 'translate(300px, 8px)', 'A genuinely smaller chart keeps the frame reachable')
  await render(null)
  assert.equal(observers.size, 0, 'Resize observers are disconnected on unmount')
  console.log('✓ Headless USD label/evidence/share parity across box, gear and Candy; conflict edges, neutral/unavailable states, read-only preferences and original relative colors')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
