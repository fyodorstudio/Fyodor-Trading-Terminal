import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { Window } from 'happy-dom'
import ts from 'typescript'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = path.join(rootDir, 'src')
const server = await createServer({ root: rootDir, server: { middlewareMode: true } })
const dom = new Window({ url: 'http://localhost:5173' })
const globalKeys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']
const previous = Object.fromEntries(globalKeys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of globalKeys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const container = dom.document.createElement('div')
dom.document.body.appendChild(container)
const root = createRoot(container)
const utc = { mode: 'utc', utcOffsetMinutes: 0 }
const noop = () => {}

try {
  // Follow production imports, including types and re-exports. A future experiment
  // must be able to use Inspector without copying either retired UI subsystem.
  const visited = new Set()
  function inspectGraph(filename, inspectorOnly = false) {
    filename = path.resolve(filename)
    if (visited.has(filename)) return
    visited.add(filename)
    assert.ok(!/[\\/](redundant|criterion|economic-calendar)[\\/]/.test(filename), filename)
    const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true)
    function walk(node) {
      const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier
        : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : null
      if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith('.')) {
        const base = path.resolve(path.dirname(filename), specifier.text)
        const resolved = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]
          .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
        assert.ok(resolved, `Unresolved production dependency: ${filename} -> ${specifier.text}`)
        if (inspectorOnly && !resolved.includes(`${path.sep}inspector${path.sep}`)) {
          const relative = path.relative(sourceDir, resolved).replaceAll('\\', '/')
          assert.ok(relative.startsWith('appearance/time-display/') || relative.startsWith('market-data/contracts/')
            || relative === 'system-connectivity/bridge-status/bridge-contract.ts', `Unexpected Inspector coupling: ${relative}`)
        }
        if (/\.tsx?$/.test(resolved)) inspectGraph(resolved, inspectorOnly)
      }
      ts.forEachChild(node, walk)
    }
    walk(source)
  }
  inspectGraph(path.join(sourceDir, 'inspector/index.ts'), true)
  visited.clear()
  inspectGraph(path.join(sourceDir, 'terminal-shell/FyodorTerminalShell.tsx'))
  console.log('✓ Inspector dependency boundary and active Terminal import graph')

  const { FyodorTerminalShell } = await server.ssrLoadModule('./src/terminal-shell/FyodorTerminalShell.tsx')
  const { ActivityLogProvider } = await server.ssrLoadModule('./src/system-observability/activity-log/activity-log-store.tsx')
  const shellHtml = renderToStaticMarkup(React.createElement(ActivityLogProvider, null, React.createElement(FyodorTerminalShell)))
  const shell = dom.document.createElement('div'); shell.innerHTML = shellHtml
  const shellButtons = [...shell.querySelectorAll('button')].map((button) => button.textContent.trim())
  assert.ok(shellButtons.includes('Inspector'))
  assert.ok(!shellButtons.some((label) => /Criterion|Calendar|Arrow Result|Return to live/.test(label)))
  assert.ok(shell.querySelector('.chart-workspace'))
  assert.ok(shell.querySelector('.floating-drawing-toolbar, .drawing-toolbar'))
  console.log('✓ Production shell renders live chart, drawings and surviving navigation')

  const { LeftDockPanel } = await server.ssrLoadModule('./src/workspace-docking/left-dock/LeftDockPanel.tsx')
  const { BottomDockPanel } = await server.ssrLoadModule('./src/workspace-docking/bottom-dock/BottomDockPanel.tsx')
  const { TerminalStatusBar } = await server.ssrLoadModule('./src/terminal-shell/TerminalStatusBar.tsx')
  const { useInspector, InspectorPanel } = await server.ssrLoadModule('./src/inspector/index.ts')
  const { ScatterPlotDock } = await server.ssrLoadModule('./src/scatter-plot/index.ts')
  const quotes = ['EURUSD', 'GBPUSD'].map((symbol) => ({ symbol, description: symbol, bid: 1.1, ask: 1.1001, dailyChange: 0, precision: 5 }))
  const bars = []
  function Navigation() {
    const [symbol, setSymbol] = React.useState('EURUSD')
    const [dock, setDock] = React.useState(null)
    const inspector = useInspector({ symbol, bars, timeframe: 'H4', timeDisplay: utc, clockOffsetMs: 0, brokerId: null })
    return React.createElement(React.Fragment, null,
      React.createElement(LeftDockPanel, { symbols: quotes, selectedSymbol: symbol, marketWatchStatus: 'live',
        marketWatchError: null, onSelectSymbol: setSymbol }),
      React.createElement(TerminalStatusBar, { sourceState: 'live', sourceLabel: 'MT5 broker source', sourceSymbolCount: 2,
        selectedSymbol: symbol, timeframe: 'H4', barCount: 0, activityCount: 0, bottomDockWindow: dock,
        settingsOpen: false, timeDisplay: utc, onToggleBottomDock: (next) => setDock((current) => current === next ? null : next),
        onThemeChanged: noop, onToggleSettings: noop }),
      dock && React.createElement(BottomDockPanel, { activeWindow: dock, activityCount: 0, selectedSymbol: symbol,
        onSelectWindow: setDock, onClose: () => setDock(null) }, dock === 'inspector'
        ? React.createElement(InspectorPanel, { view: inspector, symbol, source: null, error: null, timeDisplay: utc })
        : dock === 'scatter-plot' ? React.createElement(ScatterPlotDock, { brokerId: null }) : React.createElement('p', null, dock)))
  }
  await React.act(async () => root.render(React.createElement(Navigation)))
  const findButton = (selector, label) => [...container.querySelectorAll(selector)].find((button) => button.textContent.trim() === label)
  const click = async (button) => { assert.ok(button); await React.act(async () => button.click()) }
  await click(findButton('.status-actions button', 'Inspector'))
  assert.ok(container.querySelector('.inspector-panel'))
  assert.deepEqual([...container.querySelectorAll('.bottom-dock-tabs button')].slice(0, -1)
    .map((button) => button.textContent.trim()), ['Notebook EURUSD', 'Activity 0', 'Inspector', 'Scatter Plot'])
  const gbp = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('GBPUSD'))
  await click(gbp)
  assert.match(container.querySelector('.inspector-panel').textContent, /currently supports EURUSD/)
  await click(container.querySelector('[aria-label="Close bottom dock"]'))
  assert.equal(container.querySelector('.bottom-dock'), null)
  await click(findButton('.status-actions button', 'Inspector'))
  assert.ok(container.querySelector('.inspector-panel'))
  await click(findButton('.status-actions button', 'Inspector'))
  assert.equal(container.querySelector('.bottom-dock'), null)
  await click(findButton('.status-actions button', 'Scatter Plot'))
  assert.ok(container.querySelector('[aria-label="Scatter Plot"]'))
  assert.equal(container.querySelector('[aria-label="Scatter Plot Pair"]').value, 'EURUSD')
  assert.equal(container.querySelector('[aria-label="Scatter Plot Base/Quote"]').value, 'USD/QUOTE')
  await click(findButton('.bottom-dock-tabs button', 'Inspector'))
  assert.ok(container.querySelector('.inspector-panel'))
  assert.equal(container.querySelector('[aria-label="Scatter Plot"]'), null)
  await click(findButton('.bottom-dock-tabs button', 'Scatter Plot'))
  assert.ok(container.querySelector('[aria-label="Scatter Plot"]'))
  await click(findButton('.status-actions button', 'Scatter Plot'))
  assert.equal(container.querySelector('.bottom-dock'), null)
  console.log('✓ Mounted navigation opens/closes Inspector and retains EURUSD-only support')
  console.log('✓ Scatter Plot opens from the status bar and dock tab with fixed EURUSD/USD Quote scope')

  // Mount the actual Notebook overlay against the chart library API boundary.
  await React.act(async () => root.unmount())
  const overlayRoot = createRoot(container)
  const { PlannedTradePriceLines } = await server.ssrLoadModule('./src/trader-notebook/chart-levels/PlannedTradePriceLines.tsx')
  const clicks = new Set(); const primitives = new Set(); const lines = new Set()
  const chartApi = { subscribeClick: (handler) => clicks.add(handler), unsubscribeClick: (handler) => clicks.delete(handler) }
  const seriesApi = { attachPrimitive: (primitive) => primitives.add(primitive), detachPrimitive: (primitive) => primitives.delete(primitive),
    createPriceLine: (options) => { lines.add(options); return options }, removePriceLine: (line) => lines.delete(line) }
  const arrow = { id: 'manual', time: 1700000000, direction: 'short', entryPrice: 1.1, tpPrice: 1.09, slPrice: 1.11, rrRatio: 1 }
  const draftPlan = { direction: 'long', entryPrice: 1.2, tpPrice: 1.21, slPrice: 1.19, showOnChart: true }
  let selected = null
  const props = { chartApi, seriesApi, arrows: [arrow], selectedArrowId: null, draftPlan, onSelectArrow: (next) => { selected = next.id } }
  try {
    await React.act(async () => overlayRoot.render(React.createElement(PlannedTradePriceLines, props)))
    assert.equal(primitives.size, 1)
    assert.deepEqual([...lines].map((line) => line.price), [1.2, 1.21, 1.19])
    for (const handler of clicks) handler({ hoveredObjectId: 'manual' })
    assert.equal(selected, 'manual')
    await React.act(async () => overlayRoot.render(React.createElement(PlannedTradePriceLines, { ...props, selectedArrowId: 'manual' })))
    assert.deepEqual([...lines].map((line) => line.price), [1.1, 1.09, 1.11])
    assert.match([...lines][0].title, /SHORT/)
  } finally {
    await React.act(async () => overlayRoot.unmount())
  }
  assert.equal(lines.size, 0); assert.equal(clicks.size, 0); assert.equal(primitives.size, 0)
  console.log('✓ Mounted Notebook markers, selection, draft/registered levels and cleanup')
} finally {
  await React.act(async () => root.unmount())
  await server.close()
  await dom.happyDOM.abort()
  dom.close()
  for (const key of globalKeys) {
    if (previous[key]) Object.defineProperty(globalThis, key, previous[key])
    else delete globalThis[key]
  }
}
