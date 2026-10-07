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
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'ResizeObserver' ? class { observe() {} disconnect() {} } : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
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
      React.createElement(RaycasterSettings, { inspection, symbol: 'EURUSD', supported: true, relativeSupported: true, timeDisplay: boxProps.timeDisplay }),
      React.createElement(ContextRibbon, { ...ribbonProps, points: timeline, relative: false })))
    assert.ok(container.querySelector('.raycaster-bias').textContent.startsWith(p.label))
    assert.equal(container.querySelector('.raycaster-section > strong').textContent, p.label)
    const segment = container.querySelector('.ribbon-segment')
    assert.ok(segment.classList.contains(tone)); assert.equal(segment.classList.contains('lead-long'), edge === 'long'); assert.equal(segment.classList.contains('lead-short'), edge === 'short')
    assert.ok(segment.getAttribute('aria-label').startsWith(p.label))
    await React.act(async () => segment.click())
    const dialog = container.querySelector('[role="dialog"]')
    assert.ok(dialog.querySelector('header strong').textContent.startsWith(p.label))
    assert.match(dialog.textContent, /USD presentation v1/)
    if (p.state !== 'insufficient') {
      const splits = [...container.querySelectorAll('.usd-support-split')].map(n => n.textContent)
      assert.equal(splits.length, 3); assert.equal(new Set(splits).size, 1, 'Box, gear and Candy explanation use identical shares')
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
  assert.ok(container.querySelector('.raycaster-bias').textContent.startsWith(pair.label))
  assert.match(container.querySelector('.context-ribbon-legend').textContent, /Green Long \/ Red Short \/ Amber Mixed \/ Gray Insufficient/)
  assert.equal(container.querySelector('.ribbon-segment').classList.contains(pair.direction), true)
  await React.act(async () => container.querySelector('.ribbon-segment').click())
  assert.equal(container.querySelector('.usd-support'), null, 'USD share block and lead edges do not leak into EUR mode')
  assert.doesNotMatch(container.querySelector('[role="dialog"]').textContent, /USD presentation v1/)
  assert.equal(container.querySelector('[class*="lead-"]'), null)
  console.log('✓ Headless USD label/evidence/share parity across box, gear and Candy; conflict edges, neutral/unavailable states, read-only preferences and original relative colors')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
