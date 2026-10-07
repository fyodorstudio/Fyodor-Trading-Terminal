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
            // Inspector consumes shared currency engines, never Raycaster's UI/runtime.
            || relative.startsWith('usd-context/') || relative.startsWith('pair-context/')
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
  const { useMarketWatchDock, marketWatchCollapsedKey } = await server.ssrLoadModule('./src/workspace-docking/left-dock/useMarketWatchDock.ts')
  const { ChartWorkspaceHeader } = await server.ssrLoadModule('./src/terminal-shell/ChartWorkspaceHeader.tsx')
  const { BottomDockPanel } = await server.ssrLoadModule('./src/workspace-docking/bottom-dock/BottomDockPanel.tsx')
  const { TerminalStatusBar } = await server.ssrLoadModule('./src/terminal-shell/TerminalStatusBar.tsx')
  const { useInspector, InspectorPanel } = await server.ssrLoadModule('./src/inspector/index.ts')
  const { ScatterPlotDock } = await server.ssrLoadModule('./src/scatter-plot/index.ts')
  const { AlertDock } = await server.ssrLoadModule('./src/alert/index.ts')
  const quotes = ['EURUSD', 'GBPUSD'].map((symbol) => ({ symbol, description: symbol, bid: 1.1, ask: 1.1001, dailyChange: 0, precision: 5 }))
  const bars = []
  function Navigation() {
    const [symbol, setSymbol] = React.useState('EURUSD')
    const [dock, setDock] = React.useState(null)
    const marketWatch = useMarketWatchDock()
    const inspector = useInspector({ symbol, bars, timeframe: 'H4', timeDisplay: utc, clockOffsetMs: 0, brokerId: null })
    return React.createElement('main', { className: `terminal-workspace${marketWatch.collapsed ? ' market-watch-collapsed' : ''}` },
      React.createElement(LeftDockPanel, { marketWatch, symbols: quotes, selectedSymbol: symbol, marketWatchStatus: 'live',
        marketWatchError: null, onSelectSymbol: setSymbol }),
      React.createElement(ChartWorkspaceHeader, { marketWatch, symbol, quote: quotes.find((quote) => quote.symbol === symbol),
        timeframe: 'H4', onSelectTimeframe: noop }),
      React.createElement(TerminalStatusBar, { sourceState: 'live', sourceLabel: 'MT5 broker source', sourceSymbolCount: 2,
        selectedSymbol: symbol, timeframe: 'H4', barCount: 0, activityCount: 0, bottomDockWindow: dock,
        settingsOpen: false, timeDisplay: utc, onToggleBottomDock: (next) => setDock((current) => current === next ? null : next),
        onToggleSettings: noop }),
      dock && React.createElement(BottomDockPanel, null, dock === 'inspector'
        ? React.createElement(InspectorPanel, { view: inspector, symbol, source: null, error: null, timeDisplay: utc })
        : dock === 'scatter-plot' ? React.createElement(ScatterPlotDock, { brokerId: null })
        : dock === 'alert' ? React.createElement(AlertDock, { brokerId: null, preferences: inspector.preferences, timeDisplay: utc })
        : React.createElement('p', null, dock)))
  }
  await React.act(async () => root.render(React.createElement(Navigation)))
  const findButton = (selector, label) => [...container.querySelectorAll(selector)].find((button) => button.textContent.trim() === label)
  const click = async (button) => { assert.ok(button); await React.act(async () => button.click()) }
  const marketSearch = container.querySelector('[aria-label="Search symbols"]')
  const searchProps = marketSearch[Object.getOwnPropertyNames(marketSearch).find((key) => key.startsWith('__reactProps$'))]
  await React.act(async () => searchProps.onChange({ target: { value: 'EUR' } }))
  const marketToggle = () => container.querySelector('.active-market .market-watch-toggle')
  assert.ok(marketToggle().parentElement.querySelector('.market-icon'))
  assert.ok(marketToggle().parentElement.querySelector('h1'))
  assert.equal(marketToggle().getAttribute('aria-controls'), container.querySelector('.left-dock-content').id)
  await click(marketToggle())
  assert.ok(container.querySelector('.left-dock.collapsed'))
  assert.equal(container.querySelector('.left-dock').hidden, true, 'Collapse hides the entire sidebar, including its rail')
  assert.ok(container.querySelector('.terminal-workspace.market-watch-collapsed'))
  assert.equal(container.querySelector('.left-dock-content').hidden, true)
  assert.equal(container.querySelector('[aria-label="Show Market Watch"]').getAttribute('aria-expanded'), 'false')
  assert.equal(localStorage.getItem(marketWatchCollapsedKey), 'true')
  await click(marketToggle())
  assert.equal(container.querySelector('.left-dock').hidden, false)
  assert.equal(container.querySelector('.terminal-workspace.market-watch-collapsed'), null)
  assert.equal(container.querySelector('.left-dock-content').hidden, false)
  assert.equal(container.querySelector('[aria-label="Search symbols"]').value, 'EUR', 'Collapse keeps search and category state mounted')
  assert.equal(marketToggle().getAttribute('aria-expanded'), 'true')
  assert.equal(localStorage.getItem(marketWatchCollapsedKey), 'false')
  await React.act(async () => searchProps.onChange({ target: { value: '' } }))
  await click(container.querySelector('.left-dock-tabs button'))
  assert.equal(marketToggle().getAttribute('aria-expanded'), 'false', 'The sidebar collapse button shares state with the symbol trigger')
  await click(marketToggle())
  console.log('✓ Symbol header toggles the entire Market Watch sidebar, with accessible state and retained search')
  await click(findButton('.status-actions button', 'Inspector'))
  assert.ok(container.querySelector('.inspector-panel'))
  assert.equal(container.querySelector('.bottom-dock > header'), null, 'Bottom buttons are the only dock navigation')
  assert.equal(container.querySelector('[aria-label="Close bottom dock"]'), null)
  const gbp = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('GBPUSD'))
  await click(gbp)
  assert.match(container.querySelector('.inspector-panel').textContent, /currently supports EURUSD/)
  await click(findButton('.status-actions button', 'Inspector'))
  assert.equal(container.querySelector('.bottom-dock'), null)
  await click(findButton('.status-actions button', 'Inspector'))
  assert.ok(container.querySelector('.inspector-panel'))
  await click(findButton('.status-actions button', 'Inspector'))
  assert.equal(container.querySelector('.bottom-dock'), null)
  await click(findButton('.status-actions button', 'Scatter Plot'))
  assert.ok(container.querySelector('[aria-label="Scatter Plot"]'))
  assert.equal(container.querySelector('[aria-label="Scatter Plot Pair"]').value, 'EURUSD')
  assert.equal(container.querySelector('[aria-label="Scatter Plot Base/Quote"]').value, 'USD/QUOTE')
  await click(findButton('.status-actions button', 'Inspector'))
  assert.ok(container.querySelector('.inspector-panel'))
  assert.equal(container.querySelector('[aria-label="Scatter Plot"]'), null)
  await click(findButton('.status-actions button', 'Scatter Plot'))
  assert.ok(container.querySelector('[aria-label="Scatter Plot"]'))
  await click(findButton('.status-actions button', 'Scatter Plot'))
  assert.equal(container.querySelector('.bottom-dock'), null)
  console.log('✓ Mounted navigation opens/closes Inspector and retains EURUSD-only support')
  console.log('✓ Scatter Plot opens from the status bar with fixed EURUSD/USD Quote scope')
  await click(findButton('.status-actions button', 'Alert'))
  assert.ok(container.querySelector('[aria-label="Alert"]'))
  await click(findButton('.status-actions button', 'Inspector'))
  assert.equal(container.querySelector('[aria-label="Alert"]'), null)
  await click(findButton('.status-actions button', 'Alert'))
  assert.ok(container.querySelector('[aria-label="Alert"]'))
  await click(findButton('.status-actions button', 'Alert'))
  assert.equal(container.querySelector('.bottom-dock'), null)
  console.log('✓ Alert opens/closes from status bars')

  localStorage.setItem(marketWatchCollapsedKey, 'true')
  await React.act(async () => root.render(React.createElement(Navigation, { key: 'restored' })))
  assert.ok(container.querySelector('.left-dock.collapsed'), 'A fresh mount restores the saved collapsed state')
  assert.equal(container.querySelector('.left-dock').hidden, true)
  assert.equal(marketToggle().getAttribute('aria-expanded'), 'false')
  await click(marketToggle())
  assert.equal(container.querySelector('.left-dock-content').hidden, false)
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage unavailable') } })
  try {
    await click(marketToggle())
    assert.equal(container.querySelector('.left-dock-content').hidden, true, 'Storage failures never prevent session collapse')
    await click(marketToggle())
  } finally { Object.defineProperty(globalThis, 'localStorage', storageDescriptor) }

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
  const { ChartInspectionDismiss } = await server.ssrLoadModule('./src/terminal-shell/chart-overlays/ChartInspectionDismiss.tsx')
  const dismissRoot = createRoot(container)
  let cleared = 0
  try {
    await React.act(async () => dismissRoot.render(React.createElement(ChartInspectionDismiss, { chartApi })))
    assert.equal(clicks.size, 0, 'No click subscription without an active inspection')
    await React.act(async () => dismissRoot.render(React.createElement(ChartInspectionDismiss, { chartApi, onClear: () => cleared++ })))
    assert.equal(clicks.size, 1)
    await React.act(async () => { for (const handler of clicks) handler({ point: { x: 50, y: 50 }, hoveredObjectId: 'manual' }) })
    assert.equal(cleared, 0, 'Clicking a Notebook arrow does not clear release inspection')
    await React.act(async () => { for (const handler of clicks) handler({ point: { x: 50, y: 50 } }) })
    assert.equal(cleared, 1, 'A blank chart click clears inspection')
    await React.act(async () => dismissRoot.render(React.createElement(ChartInspectionDismiss, { chartApi })))
    assert.equal(clicks.size, 0, 'Deselecting or entering drawing mode detaches the inspection listener')
  } finally { await React.act(async () => dismissRoot.unmount()) }
  console.log('✓ Blank chart deselection, object-hit preservation and listener lifecycle')
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
