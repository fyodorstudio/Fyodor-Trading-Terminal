import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']
const previous = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.appendChild(container)
const root = createRoot(container)
try {
  const { exportWorkspace, parseWorkspaceSnapshot, restoreWorkspace, workspaceMaxBytes } = await server.ssrLoadModule('./src/workspace-portability/workspace-snapshot.ts')
  const { WorkspaceTransfer } = await server.ssrLoadModule('./src/workspace-portability/WorkspaceTransfer.tsx')
  const { nfpMagnitudeFamily, cpiMagnitudeFamily } = await server.ssrLoadModule('./src/inspector/magnitude/magnitude-families.ts')
  const { defaultInspectorPreferences, inspectorStorageKey } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { defaultScatterAppearance, scatterAppearanceKey } = await server.ssrLoadModule('./src/scatter-plot/settings/scatter-plot-appearance.ts')
  localStorage.setItem('unrelated-site-secret', 'preserved')
  localStorage.setItem('fyodor.source-clock.verified', 'true')
  localStorage.setItem(inspectorStorageKey, JSON.stringify({ ...defaultInspectorPreferences(), showHistograms: false, detailView: 'scoring' }))
  localStorage.setItem('fyodor.color-theme', 'dark')
  localStorage.setItem('trader_notebook_note_EURUSD', 'My saved note\nsecond line')
  localStorage.setItem('trader_plan_EURUSD', JSON.stringify({ direction: 'short', entryPrice: 1.1, tpPrice: null, slPrice: 1.2, showOnChart: true }))
  localStorage.setItem(scatterAppearanceKey, JSON.stringify({ ...defaultScatterAppearance, magnitudeColors: ['#123456', '#abcdef', '#654321'] }))
  nfpMagnitudeFamily.settings.save(nfpMagnitudeFamily.seriesIds[0], [100, 150, 320])
  cpiMagnitudeFamily.settings.save(cpiMagnitudeFamily.seriesIds[0], [.1, .2, .4])
  const original = exportWorkspace()
  assert.equal(original.entries['unrelated-site-secret'], undefined)
  assert.equal(original.entries['fyodor.source-clock.verified'], undefined, 'Machine clock verification never travels')
  const parsed = parseWorkspaceSnapshot(JSON.stringify(original))
  localStorage.setItem('fyodor.color-theme', 'light')
  localStorage.setItem('trader_notebook_note_GBPUSD', 'extra')
  nfpMagnitudeFamily.settings.save(nfpMagnitudeFamily.seriesIds[0], null)
  restoreWorkspace(parsed)
  assert.deepEqual(exportWorkspace().entries, original.entries, 'Fresh workspace restores exactly, including magnitude modes and notes')
  assert.deepEqual(nfpMagnitudeFamily.settings.read()[nfpMagnitudeFamily.seriesIds[0]], [100, 150, 320])
  assert.equal(localStorage.getItem('unrelated-site-secret'), 'preserved')
  assert.equal(localStorage.getItem('trader_notebook_note_GBPUSD'), null, 'Absent saved keys reset to defaults')
  for (const value of [{ ...original, entries: { [inspectorStorageKey]: JSON.stringify({ ...defaultInspectorPreferences(), detailView: 'both' }) } }, { ...original, entries: { [inspectorStorageKey]: JSON.stringify({ ...defaultInspectorPreferences(), showHistograms: 'invalid' }) } }, { ...original, version: 2 }, { ...original, entries: { malicious: '1' } }, { ...original, entries: { [nfpMagnitudeFamily.settings.key]: '{"840030016":[1,1,2]}' } }, { ...original, entries: { 'fyodor.chart-drawings.v1': '[{"points":[{"price":"bad"}]}]' } }]) {
    assert.throws(() => parseWorkspaceSnapshot(JSON.stringify(value)))
    assert.deepEqual(exportWorkspace().entries, original.entries)
  }
  assert.throws(() => parseWorkspaceSnapshot(' '.repeat(workspaceMaxBytes + 1)))
  let once = false
  const failingStorage = {
    get length() { return localStorage.length }, key: (index) => localStorage.key(index),
    getItem: (key) => localStorage.getItem(key), removeItem: (key) => localStorage.removeItem(key),
    setItem(key, value) {
      if (!once) { once = true; throw new Error('Quota exceeded') }
      localStorage.setItem(key, value)
    },
  }
  assert.throws(() => restoreWorkspace(original, failingStorage), /previous settings were restored/)
  assert.deepEqual(exportWorkspace().entries, original.entries, 'Failed import rolls back all owned keys')
  let reloaded = 0
  await React.act(async () => root.render(React.createElement(WorkspaceTransfer, { onReload: () => reloaded++ })))
  const input = container.querySelector('[aria-label="Import workspace"]')
  const file = new dom.File([JSON.stringify(original)], 'workspace.json', { type: 'application/json' })
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  await React.act(async () => { input.dispatchEvent(new dom.Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 20)) })
  assert.equal(reloaded, 0, 'Choosing a file only previews it')
  const restore = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Restore and reload')
  assert.ok(restore)
  await React.act(async () => restore.click())
  assert.equal(reloaded, 1)
  console.log('✓ Versioned workspace roundtrip, per-family cutoffs, palette, notebook, validation, safe key scope, failed-write rollback and mounted import preview/reload')
} finally {
  await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key] }
}
