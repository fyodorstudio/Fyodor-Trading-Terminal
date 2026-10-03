import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { Window } from 'happy-dom'

export async function testMountedTimeline({ viteServer, rootDir, manifest, useCpiEventTimeline,
  CpiEventTimelineCriterionPanel, TimelineResultPanel }) {
  const dom = new Window({ url: 'http://localhost:3000' })
  const globals = ['window', 'document', 'HTMLElement', 'HTMLDivElement', 'HTMLButtonElement',
    'HTMLTextAreaElement', 'Node', 'navigator', 'DOMException', 'IS_REACT_ACT_ENVIRONMENT', 'fetch', 'localStorage']
  const previous = Object.fromEntries(globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
  for (const name of globals.slice(0, 9)) Object.defineProperty(globalThis, name,
    { configurable: true, writable: true, value: name === 'window' ? dom : name === 'document' ? dom.document : dom[name] })
  globalThis.localStorage = dom.localStorage
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const { createRoot } = await import('react-dom/client')
  const { act, StrictMode, useState, useEffect } = React
  const roots = new Set()
  const publicDir = path.join(rootDir, 'public', 'criterion')
  const indexText = fs.readFileSync(path.join(publicDir, 'cpi_event_timeline_index.json'), 'utf8')
  const levelsText = fs.readFileSync(path.join(publicDir, 'cpi_event_timeline_trade_levels.json'), 'utf8')
  const epA = 'CPI_TIMELINE_20251218_163000'
  const epB = 'CPI_TIMELINE_20260714_153000'
  const episodeText = (id) => fs.readFileSync(path.join(publicDir, 'cpi_event_timeline_episodes', manifest.episodes[id].file), 'utf8')
  const response = (text, status = 200) => ({ ok: status === 200, status, text: async () => text })
  const deferred = () => {
    let resolve, reject
    const promise = new Promise((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
  }
  let router = null
  const requests = []
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, signal: options.signal })
    const custom = router?.(url, options)
    if (custom !== undefined) return custom
    if (url === manifest.indexPath) return response(indexText)
    if (url === manifest.tradeLevelsPath) return response(levelsText)
    const id = Object.keys(manifest.episodes).find((id) => url.endsWith(manifest.episodes[id].file))
    if (id) return response(episodeText(id))
    throw new Error(`Unexpected URL: ${url}`)
  }
  // Hashing uses asynchronous WebCrypto. Wait for the asserted observable state,
  // yielding to its completion, rather than assuming it completes after N ms.
  async function until(predicate, description) {
    const deadline = Date.now() + 5000
    while (!predicate()) {
      assert.ok(Date.now() < deadline, `Timed out: ${description}`)
      await act(async () => { await new Promise(setImmediate) })
    }
  }
  function reactProps(element) {
    return element[Object.keys(element).find((key) => key.startsWith('__reactProps$'))]
  }
  async function edit(container, text) {
    const element = container.querySelector('#criterion-audit-note')
    assert.ok(element, 'Production journal is mounted')
    // Invoke the mounted textarea's actual React handler. Happy DOM does not
    // reliably implement React's native textarea change-event plugin.
    await act(async () => reactProps(element).onChange({ target: { value: text } }))
  }
  async function unmount(app) { await act(async () => app.root.unmount()); roots.delete(app.root) }
  function mount(props = {}, strict = false) {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    roots.add(root)
    const app = { container, root, state: null }
    function ProductionApp({ enabled = true, initialNotes = [], saveOk = true }) {
      const [notes, setNotes] = useState(initialNotes)
      const timeline = useCpiEventTimeline({ enabled, auditNotes: notes,
        onSaveAuditNotes: (next) => { if (!saveOk) return false; setNotes(next); return true } })
      useEffect(() => { app.state = { ...timeline, notes, setNotes } }, [timeline, notes])
      return React.createElement(React.Fragment, null,
        React.createElement(CpiEventTimelineCriterionPanel, { index: timeline.timelineIndex,
          isLoading: timeline.timelineIndexLoading, error: timeline.timelineIndexError,
          onRetry: timeline.handleRetryTimelineIndex, onSelectEpisode: timeline.selectTimelineEpisode }),
        React.createElement(TimelineResultPanel, { episodePayload: timeline.timelineEpisodePayload,
          isLoading: timeline.timelineEpisodeLoading, error: timeline.timelineEpisodeError,
          onRetry: timeline.handleRetryTimelineEpisode, note: timeline.currentTimelineNote?.text ?? '',
          notes: timeline.currentTimelineNotes, onNoteChange: timeline.saveTimelineNote }))
    }
    app.render = async (next = props) => act(async () => root.render(strict ?
      React.createElement(StrictMode, null, React.createElement(ProductionApp, next)) : React.createElement(ProductionApp, next)))
    app.select = async (id) => {
      await act(async () => app.state.selectTimelineEpisode(id))
      await until(() => app.state.timelineEpisodePayload?.episodeId === id, `load ${id}`)
    }
    return app
  }
  try {
    console.log('\n[Test 8] Mounted production hook, cancellation, retries and journal...')
    const pendingIndex = [], pendingLevels = []
    router = (url, options) => {
      if (url !== manifest.indexPath && url !== manifest.tradeLevelsPath) return
      const request = { ...deferred(), signal: options.signal }
      ;(url === manifest.indexPath ? pendingIndex : pendingLevels).push(request)
      return request.promise // Deliberately ignores abort; production must reject stale completions.
    }
    const strict = mount({}, true)
    await strict.render()
    assert.equal(pendingIndex.length, 2)
    assert.equal(pendingIndex[0].signal.aborted, true)
    assert.equal(pendingLevels[0].signal.aborted, true)
    assert.equal(strict.state.timelineIndexLoading, true)
    await strict.render({ enabled: false })
    assert.equal(pendingIndex[1].signal.aborted, true)
    await strict.render({ enabled: true })
    assert.equal(pendingIndex.length, 3)
    await act(async () => {
      pendingIndex[2].resolve(response(indexText)); pendingLevels[2].resolve(response(levelsText))
    })
    await until(() => strict.state.timelineIndex !== null, 'StrictMode index and levels')
    assert.equal(strict.state.timelineIndex.totalEpisodes, 140)
    assert.equal(strict.state.timelineIndexLoading, false)
    const count = requests.length
    await strict.render({ enabled: false }); await strict.render({ enabled: true })
    assert.equal(requests.length, count, 'Completed index is reused on reopening')
    await act(async () => {
      for (const req of pendingIndex.slice(0, 2)) req.resolve(response('invalid old response'))
      for (const req of pendingLevels.slice(0, 2)) req.resolve(response('invalid old response'))
    })
    assert.equal(strict.state.timelineIndexError, null)
    await unmount(strict)

    let failIndex = true
    router = (url) => url === manifest.indexPath && failIndex ? response('', 503) : undefined
    const retry = mount()
    await retry.render()
    await until(() => retry.state.timelineIndexError !== null, 'index error')
    assert.equal(retry.state.timelineIndexLoading, false)
    assert.match(retry.container.textContent, /HTTP 503/)
    failIndex = false
    await act(async () => retry.state.handleRetryTimelineIndex())
    await until(() => retry.state.timelineIndex !== null, 'index retry')
    await unmount(retry)

    router = null
    const app = mount()
    await app.render()
    await until(() => app.state.timelineIndex !== null, 'index ready')
    const lateA = deferred(), currentB = deferred()
    router = (url) => url.endsWith(manifest.episodes[epA].file) ? lateA.promise :
      url.endsWith(manifest.episodes[epB].file) ? currentB.promise : undefined
    await act(async () => app.state.selectTimelineEpisode(epA))
    await act(async () => app.state.selectTimelineEpisode(epB))
    assert.equal(app.state.timelineEpisodePayload, null)
    assert.equal(app.state.selectedTimelineLevels, null)
    assert.equal(app.state.saveTimelineNote('cannot save while loading'), false)
    await act(async () => currentB.resolve(response(episodeText(epB))))
    await until(() => app.state.timelineEpisodePayload?.episodeId === epB, 'current B')
    assert.equal(app.state.selectedTimelineLevels.entryPrice, 1.14452)
    await act(async () => lateA.resolve(response(episodeText(epA))))
    assert.equal(app.state.timelineEpisodePayload.episodeId, epB)
    assert.equal(app.state.selectedTimelineLevels.entryPrice, 1.14452)
    const cpiEntry = app.state.timelineEpisodePayload.cpiBlock.entryTimestamp
    const ppiBlock = app.state.timelineEpisodePayload.surroundingBlocks.find((block) =>
      block.releaseTimeText === '2026.07.15 15:30:00' && block.rows.some((row) => row.eventId === '840030001'))
    const ppiRow = ppiBlock.rows.find((row) => row.eventId === '840030001')
    await act(async () => app.state.handleSelectTimelineRow(ppiBlock, ppiRow,
      `${ppiBlock.id}:${ppiRow.series}:${ppiBlock.rows.indexOf(ppiRow)}`))
    assert.equal(app.state.selectedTimelineLevels.entryPrice, 1.14279, 'PPI uses its own reviewed entry')
    assert.match(app.state.timelineLevels.label, /PPI/, 'Price lines identify the inspected event')
    assert.equal(app.state.timelineArrows[0].time, cpiEntry, 'CPI arrow stays at CPI when inspecting PPI')

    router = (url) => url.endsWith(manifest.episodes[epA].file) ? response('wrong checksum') : undefined
    await act(async () => app.state.selectTimelineEpisode(epA))
    await until(() => app.state.timelineEpisodeError !== null, 'episode checksum error')
    assert.match(app.state.timelineEpisodeError, /SHA-256 mismatch/)
    assert.equal(app.state.timelineEpisodeLoading, false)
    router = null
    await act(async () => app.state.handleRetryTimelineEpisode())
    await until(() => app.state.timelineEpisodePayload?.episodeId === epA, 'episode retry')
    await app.select(epA) // Re-selecting an already selected episode must not stick in Loading.
    assert.equal(app.state.selectedTimelineLevels, null, 'Missing monthly CPI receives no levels')
    const annualBlock = app.state.timelineEpisodePayload.cpiBlock
    const annualRow = annualBlock.rows.find((row) => row.series === 'Headline y/y')
    await act(async () => app.state.handleSelectTimelineRow(annualBlock, annualRow,
      `${annualBlock.id}:${annualRow.series}:${annualBlock.rows.indexOf(annualRow)}`))
    assert.equal(app.state.selectedTimelineLevels.entryPrice, 1.17341)

    await edit(app.container, 'Unsaved A')
    await app.select(epB)
    assert.equal(app.container.querySelector('textarea').value, '')
    await app.select(epA)
    assert.equal(app.container.querySelector('textarea').value, 'Unsaved A')
    await app.select(epB)
    await edit(app.container, 'Saved B')
    await act(async () => app.container.querySelector('.save-note-btn').click())
    assert.equal(app.state.notes.length, 1)
    assert.equal(app.state.notes[0].episodeId, epB)
    assert.equal(app.state.notes[0].text, 'Saved B')
    await app.select(epA)
    assert.equal(app.container.querySelector('textarea').value, 'Unsaved A')
    await app.render({ saveOk: false })
    await act(async () => app.container.querySelector('.save-note-btn').click())
    assert.equal(app.container.querySelector('textarea').value, 'Unsaved A', 'Failed save retains draft')
    assert.equal(app.container.querySelector('.save-note-btn').disabled, false)
    assert.equal(app.state.notes.length, 1)
    await app.render({ saveOk: true })
    const older = { ...app.state.notes[0], viewerSha256: 'older-research', text: 'Older snapshot B' }
    await act(async () => app.state.setNotes([...app.state.notes, older]))
    await app.select(epB)
    assert.equal(app.container.querySelector('textarea').value, 'Saved B', 'Research identities are isolated')
    await edit(app.container, 'Updated B')
    await act(async () => app.container.querySelector('.save-note-btn').click())
    assert.equal(app.state.notes.find((note) => note.viewerSha256 === 'older-research').text, 'Older snapshot B')
    const notes = await viteServer.ssrLoadModule('./src/criterion/arrow-result/audit-notes.ts')
    assert.equal(notes.writeAuditNotes(app.state.notes), true)
    assert.deepEqual(notes.readAuditNotes(), app.state.notes)
    assert.match(notes.exportAuditNotesMarkdown(notes.readAuditNotes()), /Older snapshot B/)
    await unmount(app)
    console.log('  ✓ Production loading, StrictMode, ignored aborts, retries, notes and persistence')

    await testAnnotations({ viteServer, rootDir, dom, createRoot, act, until, roots, reactProps, episodeText, epA, epB })
  } finally {
    for (const root of roots) await act(async () => root.unmount())
    await dom.happyDOM.abort()
    for (const [name, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  }
}

async function testAnnotations({ viteServer, rootDir, createRoot, act, roots, episodeText, epA, epB }) {
  console.log('\n[Test 9] Production event grouping, windows, symbols and chart overlay...')
  const { groupTimelineEvents, buildEventMarkers, eventsInWindow, containingEventBar } =
    await viteServer.ssrLoadModule('./src/criterion/timeline/timeline-event-view.ts')
  const { useTimelineEventAnnotations } = await viteServer.ssrLoadModule('./src/criterion/timeline/useTimelineEventAnnotations.ts')
  const { TimelineResultPanel } = await viteServer.ssrLoadModule('./src/criterion/arrow-result/TimelineResultPanel.tsx')
  const { sixEventFamilies, curatedFamilyForBlock } = await viteServer.ssrLoadModule('./src/criterion/timeline/timeline-event-families.ts')
  const { TimelineEventMarkers } = await viteServer.ssrLoadModule('./src/criterion/timeline/TimelineEventMarkers.tsx')
  const spanish = JSON.parse(episodeText('CPI_TIMELINE_20250312_153000'))
  const grouped = groupTimelineEvents(spanish.surroundingBlocks, spanish.releaseTimestamp)
  const spainCpi = grouped.find((group) => group.family === 'CPI' && group.countryCode === 'ES' &&
    group.releaseTimeText === '2025.02.27 11:00:00')
  assert.ok(spainCpi)
  assert.ok(spainCpi.block.rows.some((row) => /m\/m/.test(row.series)))
  assert.ok(spainCpi.block.rows.some((row) => /y\/y/.test(row.series)))
  assert.equal(grouped.reduce((n, group) => n + group.block.rows.length, 0),
    spanish.surroundingBlocks.reduce((n, block) => n + block.rows.length, 0), 'Grouping preserves every reading')
  for (const group of grouped) for (const row of group.block.rows) {
    const source = group.sources.get(row.selectionKey)
    assert.equal(row.actual, source.row.actual)
    assert.equal(row.grossResult, source.row.grossResult)
    assert.equal(row.eventId, source.row.eventId)
  }
  const countryProbe = JSON.parse(episodeText('CPI_TIMELINE_20200610_153000'))
  const tradeGroups = groupTimelineEvents(countryProbe.surroundingBlocks, countryProbe.releaseTimestamp)
    .filter((group) => group.releaseTimeText === '2020.06.18 11:00:00' && /Trade Balance/.test(group.family))
  assert.ok(tradeGroups.some((group) => group.countryCode === 'ES' && group.timingUncertain))
  assert.ok(tradeGroups.some((group) => group.countryCode === 'IT' && !group.timingUncertain))
  const fakeBars = [{ time: 10000 }, { time: 13600 }, { time: 200000 }]
  assert.equal(containingEventBar(17200, fakeBars), null, 'Missing candle is not snapped forward')
  assert.equal(containingEventBar(13599, fakeBars), 10000)
  assert.equal(containingEventBar(203600, fakeBars), null, 'Final close is exclusive')
  const probes = [10000, 203599, 203600].map((releaseTimestamp) => ({ ...spainCpi, releaseTimestamp }))
  assert.equal(eventsInWindow(probes, fakeBars).length, 2)
  const uncertain = { ...spainCpi, id: 'uncertain', releaseTimestamp: 11000, timingUncertain: true }
  assert.equal(buildEventMarkers([uncertain], { uncertain: 'sun' }, fakeBars).length, 0)

  const data = JSON.parse(fs.readFileSync(path.join(rootDir, 'public', 'criterion', 'eurusd_cpi_nfp_v2.json'), 'utf8'))
  const payloadB = JSON.parse(episodeText(epB)), payloadA = JSON.parse(episodeText(epA))
  const sourcePayroll = payloadB.surroundingBlocks.find((block) => block.rows.some((row) => row.eventId === '840030016'))
  const sourceWages = payloadB.surroundingBlocks.find((block) => block.rows.some((row) => row.eventId === '840030018'))
  const jobs = groupTimelineEvents(payloadB.surroundingBlocks, payloadB.releaseTimestamp).find((group) => group.familyId === 'jobs')
  assert.ok(jobs.block.rows.some((row) => row.eventId === '840030016'))
  assert.ok(jobs.block.rows.some((row) => row.eventId === '840030015'))
  assert.ok(jobs.block.rows.some((row) => row.eventId === '840030018'))
  assert.equal(jobs.sources.get(jobs.block.rows.find((row) => row.eventId === '840030018').selectionKey).block, sourceWages)
  assert.equal(curatedFamilyForBlock({ ...sourcePayroll, countryCode: 'ES', currency: 'EUR' }), undefined,
    'US family IDs cannot produce an NFP + EUR filter')
  const sourceProbe = (eventId) => ({ ...sourcePayroll, eventId, rows: [{ series: 'Source probe', eventId }] })
  assert.equal(curatedFamilyForBlock(sourceProbe('840030021')), undefined, 'JOLTS is not the payroll release')
  assert.equal(curatedFamilyForBlock(sourceProbe('840020027')), undefined, 'Retail inventories are not retail sales')
  assert.equal(curatedFamilyForBlock(sourceProbe('840010009')), 'gdp', 'Quarterly PCE belongs to GDP')
  assert.equal(curatedFamilyForBlock(sourceProbe('840010001')), 'pce', 'Monthly PCE remains separate')
  assert.equal(curatedFamilyForBlock(sourceProbe('840050004')), 'fomc', 'FOMC minutes remain discoverable')
  const fomc = groupTimelineEvents([
    { ...sourceProbe('840050014'), id: 'rate', releaseTimestamp: 10000 },
    { ...sourceProbe('840050018'), id: 'conference', releaseTimestamp: 11800 },
    { ...sourceProbe('840050004'), id: 'minutes', releaseTimestamp: 200000 },
  ], payloadB.releaseTimestamp)
  assert.deepEqual(fomc.map((group) => group.releaseTimestamp), [10000, 11800, 200000])
  assert.ok(fomc.every((group) => group.block.rows.every((row) => !row.grossResult)), 'Grouping never prices policy context')
  let view, selection = null
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.add(root)
  const listeners = new Set()
  const scale = { width: () => 3000, timeToCoordinate: () => 200,
    subscribeVisibleLogicalRangeChange: (callback) => listeners.add(callback),
    unsubscribeVisibleLogicalRangeChange: (callback) => listeners.delete(callback),
    subscribeSizeChange: (callback) => listeners.add(callback),
    unsubscribeSizeChange: (callback) => listeners.delete(callback) }
  const chartApi = { timeScale: () => scale }
  function AnnotationApp({ payload }) {
    const [priorBars, setPrior] = React.useState(240)
    const current = useTimelineEventAnnotations(payload, data, priorBars)
    React.useEffect(() => { view = current }, [current])
    return React.createElement(React.Fragment, null,
      React.createElement(TimelineResultPanel, { key: payload.episodeId, eventView: current, episodePayload: payload,
        priorBars, onPriorChange: setPrior, onReturnLive: () => {},
        onSelectRow: (block, row, key) => { selection = { block, row, key } } }),
      React.createElement(TimelineEventMarkers, { chartApi, markers: current.markers, onSelectGroup: current.setFocusedGroupId }))
  }
  async function render(payload) { await act(async () => root.render(React.createElement(AnnotationApp, { payload }))) }
  await render(payloadB)
  const ppi = view.groups.find((group) => group.family === 'PPI' && group.countryCode === 'US' &&
    group.releaseTimeText === '2026.07.15 15:30:00')
  assert.ok(ppi)
  assert.equal(view.auditBars.length, 480)
  assert.equal(view.markers.length, 0, 'Chart starts uncluttered')
  assert.deepEqual(view.watchlist, sixEventFamilies)
  assert.ok(view.groups.length < view.windowGroups.length)
  assert.ok(view.groups.every((group) => group.countryCode === 'US' && group.currency === 'USD'))
  const header = container.querySelector('.timeline-compact-header')
  assert.ok(header.querySelector('[role="tablist"]'), 'Title and sub-tabs share one header')
  assert.match(header.textContent, /CPI & Event Timeline/)
  assert.equal(container.querySelectorAll('.timeline-dock-header').length, 1, 'No duplicate header')
  assert.equal(container.querySelector('.timeline-anchor-page .timeline-block-header'), null, 'Anchor does not repeat its banner')
  assert.equal(container.querySelectorAll('.timeline-anchor-page tbody tr').length, 6, 'All four readings and both sums remain visible')
  assert.equal(container.querySelector('.timeline-event-browse-controls'), null, 'No browse toolbar on the CPI tab')
  assert.equal(container.querySelector('[role="tab"][aria-selected="true"]').dataset.eventTab, 'anchor')
  assert.equal(container.querySelectorAll('[data-event-group]').length, 0, 'CPI opens without a month-long event list')
  async function clickTab(tab) { await act(async () => container.querySelector(`[data-event-tab="${tab}"]`).click()) }
  async function search(text) {
    const input = container.querySelector('[type="search"]')
    const props = input[Object.keys(input).find((key) => key.startsWith('__reactProps$'))]
    await act(async () => props.onChange({ target: { value: text } }))
  }
  const openFamilies = async () => {
    await act(async () => container.querySelector('[aria-label="Event families"]').click())
    return document.querySelector('[role="dialog"][aria-label="Event families"]')
  }
  const menuButton = (menu, text) => [...menu.querySelectorAll('button')].find((button) => button.textContent === text)
  let menu = await openFamilies()
  assert.ok(menu, 'Family menu is mounted outside the dock')
  assert.equal(container.contains(menu), false, 'Short dock overflow cannot clip the portal')
  await act(async () => menu.querySelector('[aria-label="US Jobs report / NFP"]').click())
  assert.deepEqual(view.watchlist, sixEventFamilies, 'Editing a draft does not change applied filters')
  await act(async () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(document.querySelector('[role="dialog"][aria-label="Event families"]'), null)
  assert.deepEqual(view.watchlist, sixEventFamilies, 'Escape discards uncommitted family changes')
  menu = await openFamilies()
  await act(async () => menuButton(menu, 'All events').click())
  await act(async () => menuButton(menu, 'Apply').click())
  assert.equal(view.watchlist, null)
  assert.equal(view.groups.length, view.windowGroups.length)
  assert.equal(view.markers.length, 0, 'Apply does not mark releases')
  await clickTab('before')
  assert.ok(container.querySelectorAll('[data-event-group]').length <= 8, 'Only one bounded page is mounted')
  const nearestBeforeDate = view.groups.filter((group) => group.section === 'before').map((group) => group.releaseTimeText.slice(0, 10)).sort().at(-1)
  assert.equal(container.querySelector('[aria-label="Event date"]').value, nearestBeforeDate, 'Before starts nearest CPI')
  await act(async () => {
    const select = container.querySelector('[aria-label="Event date"]')
    select.value = 'ALL'
    select.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  const firstPageId = container.querySelector('[data-event-group]').dataset.eventGroup
  await act(async () => container.querySelector('[aria-label="Next event page"]').click())
  assert.notEqual(container.querySelector('[data-event-group]').dataset.eventGroup, firstPageId)
  assert.ok(container.querySelectorAll('[data-event-group]').length <= 8)
  await clickTab('after')
  const nearestAfterDate = view.groups.filter((group) => group.section === 'after').map((group) => group.releaseTimeText.slice(0, 10)).sort()[0]
  assert.equal(container.querySelector('[aria-label="Event date"]').value, nearestAfterDate, 'After starts nearest CPI')
  await search('PPI US 2026.07.15')
  assert.equal(container.querySelector('[aria-label="Event date"]').disabled, true, 'Search spans all dates in the tab')
  let releaseControl = [...container.querySelectorAll('[data-event-group]')].find((node) => node.dataset.eventGroup === ppi.id)
  assert.ok(releaseControl, 'Search reaches a later release without scrolling across dates')
  await act(async () => {
    const select = releaseControl.querySelector('select')
    select.value = 'sun'
    select.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  await act(async () => releaseControl.querySelector('input').click())
  assert.equal(view.markers.length, 1)
  assert.equal(view.markers[0].group.releaseTimestamp, ppi.releaseTimestamp)
  assert.equal(view.markers[0].time, ppi.releaseTimestamp - 1800, '15:30 release uses its containing 15:00 H1 candle')
  assert.equal(view.markers[0].symbol, 'sun')
  const symbol = container.querySelector('.timeline-chart-symbol')
  assert.match(symbol.title, /2026\.07\.15 15:30:00/)
  await act(async () => symbol.click())
  assert.equal(view.focusedGroupId, ppi.id)
  assert.equal(container.querySelector('[aria-label="Event date"]').value, '2026.07.15')
  assert.equal(container.querySelector('[type="search"]').value, '', 'Chart click clears list search')
  releaseControl = [...container.querySelectorAll('[data-event-group]')].find((node) => node.dataset.eventGroup === ppi.id)
  assert.equal(releaseControl.querySelector('details').open, true)
  const sourceRow = ppi.block.rows.find((row) => row.valueId)
  const rowNodes = [...releaseControl.querySelectorAll('tbody tr')]
  const rowIndex = ppi.block.rows.indexOf(sourceRow)
  await act(async () => rowNodes[rowIndex].click())
  assert.equal(selection.key, sourceRow.selectionKey)
  assert.equal(selection.row, ppi.sources.get(sourceRow.selectionKey).row)

  await render(payloadA)
  assert.equal(view.markers.length, 0, 'Episode selections do not leak')
  await render(payloadB)
  assert.equal(view.markers.length, 1, 'Episode selections restore')
  assert.equal(container.querySelector('[role="tab"][aria-selected="true"]').dataset.eventTab, 'anchor', 'New episode starts with CPI')
  await clickTab('before')
  assert.equal(view.markers.length, 1, 'Browsing another tab does not hide selected symbols')
  await search('does-not-exist')
  assert.equal(container.querySelectorAll('[data-event-group]').length, 0)
  assert.equal(view.markers.length, 1, 'List search does not change chart annotations')
  await act(async () => container.querySelector('.timeline-chart-symbol').click())
  assert.equal(container.querySelector('[role="tab"][aria-selected="true"]').dataset.eventTab, 'after')
  assert.ok([...container.querySelectorAll('[data-event-group]')].some((node) => node.dataset.eventGroup === ppi.id),
    'Chart click finds target tab/day/page even from an empty search')
  const second = view.groups.find((group) => group.id !== ppi.id && !group.timingUncertain &&
    containingEventBar(group.releaseTimestamp, view.auditBars) !== null)
  await act(async () => view.setEventSymbol(second.id, second.family, 'cloud', true))
  await clickTab('selected')
  assert.equal(container.querySelectorAll('[data-event-group]').length, 2, 'On chart lists selected releases together')
  assert.equal(container.querySelectorAll('.timeline-chart-symbol').length, 1, 'Nearby markers cluster')
  await act(async () => container.querySelector('.timeline-chart-symbol').click())
  assert.equal(container.querySelectorAll('.timeline-symbol-popup button').length, 3, 'Both releases remain accessible')
  await act(async () => view.setAfterBars(60))
  assert.equal(view.auditBars.length, 300)
  assert.ok(view.groups.every((group) => group.releaseTimestamp < Number(view.auditBars.at(-1).time) + 3600))
  const markersBeforeFilter = view.markers.map((marker) => marker.group.id)
  await act(async () => view.applyFamilies(['ppi'], {}))
  assert.ok(view.groups.every((group) => group.family === 'PPI'))
  assert.deepEqual(view.markers.map((marker) => marker.group.id), markersBeforeFilter, 'Applying a watchlist keeps existing chart symbols')
  await clickTab('selected')
  assert.equal(container.querySelectorAll('[data-event-group]').length, view.selectedGroups.length,
    'On chart includes marked releases outside the watchlist')
  await act(async () => view.setFocusedGroupId(second.id))
  assert.equal(container.querySelector('[role="tab"][aria-selected="true"]').dataset.eventTab, 'selected',
    'A filtered-out chart event opens On chart')
  assert.ok([...container.querySelectorAll('[data-event-group]')].some((node) => node.dataset.eventGroup === second.id))
  menu = await openFamilies()
  const ppiSymbol = menu.querySelector('[aria-label="Family symbol for US PPI"]')
  await act(async () => { ppiSymbol.value = 'snowflake'; ppiSymbol.dispatchEvent(new window.Event('change', { bubbles: true })) })
  await act(async () => menuButton(menu, 'Apply & mark releases').click())
  assert.equal(view.selected[ppi.id], 'snowflake', 'Bulk mark uses the chosen family symbol')
  assert.ok(view.selected[second.id], 'Bulk mark preserves unrelated selected releases')
  assert.ok(view.markers.every((marker) => !marker.group.timingUncertain && containingEventBar(marker.group.releaseTimestamp, view.auditBars) !== null))
  await act(async () => root.unmount())
  roots.delete(root)
  assert.equal(listeners.size, 0, 'Overlay subscriptions are cleaned up')
  const root2 = createRoot(container)
  roots.add(root2)
  await act(async () => root2.render(React.createElement(AnnotationApp, { payload: payloadB })))
  assert.equal(view.selected[ppi.id], 'snowflake', 'Symbol choices survive remount/storage reload')
  assert.deepEqual(view.watchlist, ['ppi'], 'Watchlist survives remount/storage reload')
  // Existing preferences used separate payroll/wage group IDs. They must map
  // onto the combined report, and explicit unchecking must clear every alias.
  const storageKey = [...Array(localStorage.length)].map((_, i) => localStorage.key(i)).find((key) => key.startsWith('fyodor_timeline_symbols_v1:'))
  const saved = JSON.parse(localStorage.getItem(storageKey))
  saved.episodes[epB][jobs.legacyIds[0]] = 'moon'
  saved.families['Nonfarm Payrolls'] = 'umbrella'
  delete saved.families.jobs
  delete saved.watchlist // Legacy preferences did not contain a family picker.
  localStorage.setItem(storageKey, JSON.stringify(saved))
  await act(async () => root2.unmount())
  roots.delete(root2)
  const root3 = createRoot(container)
  roots.add(root3)
  await act(async () => root3.render(React.createElement(AnnotationApp, { payload: payloadB })))
  assert.deepEqual(view.watchlist, sixEventFamilies)
  assert.equal(view.selected[jobs.id], 'moon', 'Legacy chart selection survives family regrouping')
  assert.equal(view.familySymbols.jobs, 'umbrella', 'Legacy family symbol default survives regrouping')
  await act(async () => view.setEventSymbol(jobs.id, jobs.family, 'moon', false))
  assert.equal(view.selected[jobs.id], undefined, 'Unmark clears legacy aliases instead of reappearing')
  console.log('  ✓ Bounded tabs/date navigation, cross-date search, chart jumps, source readings and persisted symbols')
}
