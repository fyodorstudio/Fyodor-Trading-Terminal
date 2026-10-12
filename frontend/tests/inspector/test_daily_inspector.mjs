import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

globalThis.__dailyWork = 0
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
  server: { middlewareMode: true, hmr: false }, plugins: [{ name: 'daily-work', enforce: 'pre', transform(code, id) {
    if (id.endsWith('/releases/group-days.ts')) return code.replace('  if (!range) return []', '  globalThis.__dailyWork += 1; if (!range) return []')
  } }] })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']
const previous = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host)
const root = createRoot(host), originalNow = Date.now
const utc = { mode: 'utc', utcOffsetMinutes: 0 }, jakarta = { mode: 'fixed-offset', utcOffsetMinutes: 420 }
const day = 86400000, at = Date.UTC(2026, 9, 13), range = { from: at, to: at + 2 * day }
const clock = { brokerId: null, brokerOffsetSeconds: 0 }
Date.now = () => at - day
const frames = new Map(), listeners = new Set(), sizeListeners = new Set(), clicks = new Set()
let sequence = 0, visible = { from: at / 1000 - 2 * 86400, to: at / 1000 + 4 * 86400 }
dom.requestAnimationFrame = fn => { frames.set(++sequence, fn); return sequence }
dom.cancelAnimationFrame = id => frames.delete(id)
const bars = Array.from({ length: 7 * 24 }, (_, i) => ({ time: at / 1000 - 2 * 86400 + i * 3600, open: 1, high: 2, low: .5, close: 1.5 }))
const scale = { width: () => 900, getVisibleRange: () => visible,
  timeToCoordinate: time => (time - visible.from) / (visible.to - visible.from) * 900,
  timeToIndex: time => bars.findIndex(bar => bar.time === time), logicalToCoordinate: i => i * 5,
  subscribeVisibleLogicalRangeChange: fn => listeners.add(fn), unsubscribeVisibleLogicalRangeChange: fn => listeners.delete(fn),
  subscribeSizeChange: fn => sizeListeners.add(fn), unsubscribeSizeChange: fn => sizeListeners.delete(fn) }
const chartApi = { timeScale: () => scale, subscribeClick: fn => clicks.add(fn), unsubscribeClick: fn => clicks.delete(fn) }
const change = async (selector, value) => React.act(async () => {
  const node = document.querySelector(selector); assert.ok(node, selector)
  const props = node[Object.getOwnPropertyNames(node).find(key => key.startsWith('__reactProps$'))]
  if (props) props.onChange({ target: { value } })
  else { node.value = value; node.dispatchEvent(new dom.Event('change', { bubbles: true })) }
})
const button = async text => React.act(async () => [...document.querySelectorAll('dialog button')].find(node => node.textContent === text).click())
try {
  const data = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { groupInspectorDays } = await server.ssrLoadModule('./src/inspector/releases/group-days.ts')
  const { majorForexPairs, forexPairCurrencies } = await server.ssrLoadModule('./src/economic-calendar/forex/pairs.ts')
  const { useInspector } = await server.ssrLoadModule('./src/inspector/useInspector.ts')
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const { InspectorChartMarkers } = await server.ssrLoadModule('./src/inspector/InspectorChartMarkers.tsx')
  const { exportWorkspace, parseWorkspaceSnapshot } = await server.ssrLoadModule('./src/workspace-portability/workspace-snapshot.ts')
  const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/major-calendar-catalog.json', import.meta.url), 'utf8'))
  const event = (id, hour, extra = {}) => {
    const meta = fixture.find(row => row.event_id === id), release_at = at + hour * 3600000
    return { value_id: `${id}/${hour}`, event_id: id, name: meta?.event_name ?? '', currency: meta?.country_currency ?? 'USD',
      country_code: meta?.country_code ?? 'US', country_name: meta?.country_code ?? 'US', event_code: id,
      server_time_seconds: release_at / 1000, chart_time_seconds: release_at / 1000, release_at, period_seconds: at / 1000 - 30 * 86400,
      revision: 0, unit: +(meta?.unit_code ?? 1), multiplier: +(meta?.multiplier_code ?? 0), digits: +(meta?.digits ?? 1),
      time_mode: 0, importance: 'high', impact: 'none', actual: .3, previous: .1, revised_previous: null, forecast: null, ...extra }
  }
  const all = fixture.map(row => event(row.event_id, 12))
  const publications = data.groupInspectorReleases(all, false)
  for (const pair of majorForexPairs) {
    const preferences = { ...data.defaultInspectorPreferences(pair), symbolGrouping: 'day' }
    const days = groupInspectorDays(publications, preferences.families, range, utc, clock)
    assert.equal(days.length, 2, `${pair}: one daily selection for each currency`)
    const expected = all.filter(row => forexPairCurrencies(pair).includes(row.currency))
    assert.deepEqual(new Set(days.flatMap(release => release.events.map(row => row.value_id))), new Set(expected.map(row => row.value_id)),
      `${pair}: all 1,051 applicable catalog types survive daily grouping`)
    for (const grouped of days) {
      const sections = grouped.daily.sections
      assert.equal(new Set(sections.map(section => section.id)).size, sections.length, 'One section for each filter category')
      assert.deepEqual(new Set(sections.flatMap(section => section.publications.flatMap(publication => publication.events.map(row => row.value_id)))),
        new Set(grouped.events.map(row => row.value_id)), `${pair}: every source row survives family sectioning`)
      for (const section of sections) {
        assert.equal(section.label, data.inspectorCategories.find(category => category.id === section.id).label)
        assert.ok(section.publications.every(publication => data.inspectorFamilies.find(f => f.id === publication.familyId).category === section.id))
      }
      const speechSources = expected.filter(row => row.currency === grouped.currency && /speech(?:es)?|testimony|hearings?/i.test(row.name))
      for (const source of speechSources) {
        const section = sections.find(section => section.publications.some(publication => publication.events.some(row => row.value_id === source.value_id)))
        const family = data.inspectorFamilies.find(family => family.events.includes(source.event_id))
        assert.equal(section.id, family.category, `${source.name}: its filter category includes this source type`)
      }
      for (const family of data.inspectorPairFamilies(pair).filter(family => family.currency === grouped.currency && family.events.length)) {
        const familySources = expected.filter(row => family.events.includes(row.event_id) && !/speech(?:es)?|testimony|hearings?/i.test(row.name))
        if (familySources.length) assert.equal(sections.filter(section => section.publications.some(publication => publication.events.some(row =>
          familySources.some(source => source.value_id === row.value_id)))).length, 1, `${pair}: all ${family.label} variants share a section`)
      }
    }
    const markers = data.buildInspectorMarkers(days, preferences, bars, 'H1')
    assert.equal(markers.length, 2)
    assert.equal(markers.reduce((n, marker) => n + marker.release.events.length, 0), expected.length)
  }
  const jobs = data.inspectorFamilies.find(f => f.id === 'jobs').events.slice(0, 10).map(id => event(id, 12))
  const cpi = data.inspectorFamilies.find(f => f.id === 'us-cpi').events.map(id => event(id, 13, { forecast: .2, revised_previous: .2, revision: 1 }))
  const sample = [...jobs, ...cpi, event('840050028', 14, { actual: null, previous: null }), event('840120001', 15),
    event('840220005', 16), event('840220006', 16), event('999030010', 13), event('840030005', 36, { actual: null }), event('840030006', 36, { actual: null })]
  const defaults = { ...data.defaultInspectorPreferences(), symbolGrouping: 'day' }
  const italianRows = ['380010001', '380010002', '380010025', '380010026'].map(id => event(id, 16))
  const italian = groupInspectorDays(data.groupInspectorReleases(italianRows, false), defaults.families, range, utc, clock)[0]
  assert.equal(italian.daily.sections.length, 1, 'All CPI and FOI monthly/annual series share the Inflation section')
  assert.equal(italian.daily.sections[0].label, 'Inflation')
  assert.equal(italian.daily.sections[0].publications.flatMap(publication => publication.events).length, 4)
  assert.equal(italian.daily.sections[0].releaseCount, 2)
  assert.equal(italian.label, '2 releases · 4 series')
  const raw = data.groupInspectorReleases(sample, false)
  const daily = groupInspectorDays(raw, defaults.families, range, utc, clock)
  const usd = daily.find(release => release.id === 'day/USD/2026-10-13')
  assert.equal(usd.daily.publications.length, 6); assert.equal(usd.events.length, 24)
  assert.equal(usd.daily.publications.find(release => release.familyId === 'jobs').events.length, 10)
  assert.equal(usd.daily.publications.find(release => release.familyId === 'us-cpi').events.length, 10, 'All ten CPI series share their publication section')
  const excluded = groupInspectorDays(raw, defaults.families.filter(id => id !== 'us-cpi'), range, utc, clock)
  assert.ok(excluded.every(release => release.events.every(row => !cpi.some(c => c.value_id === row.value_id))))
  assert.equal(groupInspectorDays(raw, [], range, utc, clock).length, 0)
  const midnight = [event('840030005', 23), event('840030006', 24.25), event('840030007', 23, { value_id: 'date-only', time_mode: 1, release_at: null, chart_time_seconds: null })]
  const shifted = groupInspectorDays(data.groupInspectorReleases(midnight, false), defaults.families, range, jakarta, clock)
  assert.equal(shifted.find(d => d.daily.date === '2026-10-14').events.length, 2)
  assert.equal(shifted.find(d => d.daily.date === '2026-10-13').events[0].value_id, 'date-only')
  const policy = [event('840050014', 23.75), event('840050002', 24.25, { actual: null, previous: null })]
  const policyDays = groupInspectorDays(data.groupInspectorReleases(policy, false), defaults.families, range, utc, clock)
  assert.equal(data.groupInspectorReleases(policy).length, 1, 'Legacy policy episode spans midnight')
  assert.equal(policyDays.length, 2, 'Daily tables retain original publication days')
  const native = groupInspectorDays(raw, defaults.families, range, jakarta, { brokerId: 'Elev8-Demo2', brokerOffsetSeconds: 10800 })
  assert.equal(native.find(d => d.daily.date === '2026-10-13').chartTime, at / 1000 - 4 * 3600)
  for (const [start, hours] of [[Date.UTC(2026, 2, 29), 25], [Date.UTC(2026, 9, 25), 23]]) {
    const row = event('840030005', 12, { release_at: start + 12 * 3600000 })
    const grouped = groupInspectorDays(data.groupInspectorReleases([row], false), defaults.families, { from: start, to: start + day }, utc,
      { brokerId: 'Elev8-Demo2', brokerOffsetSeconds: 10800 })[0]
    assert.equal(grouped.daily.endChartTime - grouped.chartTime, hours * 3600, 'Daily chart windows honor broker clock transitions')
  }
  const fresh = event('9876543210123456789', 12, { name: 'A newly added source series' })
  assert.equal(groupInspectorDays(data.groupInspectorReleases([fresh], false), defaults.families, range, utc, clock)[0].events[0], fresh)
  const future = data.buildInspectorMarkers([usd], defaults, [{ time: at / 1000 - 86400 }], 'D1')
  assert.equal(future.length, 1); assert.equal(future[0].projection.barsAhead, 1)
  const absentDay = data.buildInspectorMarkers([usd], defaults, [{ time: at / 1000 - 86400 }, { time: at / 1000 + 86400 }], 'H1')
  assert.equal(absentDay.length, 0, 'No borrowing another day’s historical candle')
  assert.equal(data.buildInspectorMarkers(daily, { ...defaults, showSymbols: false }, bars, 'H1').length, 0)

  let view
  function Harness({ symbol = 'EURUSD', rows = sample, display = utc, detailOpen = true }) {
    const next = useInspector({ events: rows, symbol, bars, timeframe: 'H1', timeDisplay: display, clockOffsetMs: 0, detailOpen })
    React.useLayoutEffect(() => { view = next }, [next])
    return React.createElement(React.Fragment, null,
      React.createElement(InspectorChartMarkers, { chartApi, markers: next.markers, timeDisplay: display, onSelectRelease: next.selectRelease }),
      detailOpen && React.createElement(InspectorPanel, { view: next, symbol, timeDisplay: display, source: null, error: null }))
  }
  const render = props => React.act(async () => root.render(React.createElement(Harness, props)))
  await render({})
  assert.equal(view.preferences.symbolGrouping, 'release')
  await React.act(async () => document.querySelector('[data-inspector-filter-trigger]').click())
  await change('[aria-label="Group Inspector symbols"]', 'day')
  assert.equal(document.querySelectorAll('.inspector-day-symbol').length, 3, 'Two currencies on Oct 13 and USD on Oct 14')
  assert.equal(localStorage.getItem(data.inspectorStorageKey), null, 'Preview remains unsaved')
  await button('Cancel'); assert.equal(view.preferences.symbolGrouping, 'release')
  await React.act(async () => document.querySelector('[data-inspector-filter-trigger]').click())
  await change('[aria-label="Group Inspector symbols"]', 'day'); await button('Save')
  assert.equal(JSON.parse(localStorage.getItem(data.inspectorStorageKey)).symbolGrouping, 'day')
  const usdButton = [...document.querySelectorAll('.inspector-day-symbol')].find(node => node.title.includes('USD') && node.title.includes('24 series'))
  assert.ok(usdButton); assert.equal(usdButton.textContent, '24')
  await React.act(async () => usdButton.click())
  assert.equal(document.querySelector('.inspector-marker-popup'), null, 'Daily selection opens directly')
  assert.equal(view.selectedRelease.id, usd.id)
  assert.equal(host.querySelector('.inspector-pair-toggle').title, '3 daily entries')
  assert.equal(host.querySelectorAll('table').length, 1)
  assert.equal(host.querySelectorAll('tbody').length, usd.daily.sections.length)
  assert.equal(host.querySelectorAll('tr[data-series-id]').length, 24)
  assert.equal(host.querySelector('thead th').textContent, 'Series')
  const actualNames = [...host.querySelectorAll('th[scope="row"] strong')].map(node => node.textContent)
  assert.deepEqual(actualNames, usd.daily.sections.flatMap(section => section.publications.flatMap(publication => publication.events.map(event => event.name))))
  assert.ok(host.querySelector('table').textContent.includes('Revision 1'))
  assert.equal(host.querySelector('[aria-label="Inspector view"]').value, 'table')
  assert.ok(host.querySelector('[aria-label="Inspector view"] option[value="scatter"]').disabled)
  assert.equal(host.querySelector('.inspector-histogram-btn'), null)
  assert.ok(view.publicationMarkers.every(marker => !marker.release.daily), 'Relationship overlays retain original publication markers')
  assert.deepEqual([...host.querySelectorAll('thead th')].map(node => node.textContent), ['Series', 'Time', 'Actual', 'Previous', 'Forecast', 'A−P'])
  for (const body of host.querySelectorAll('tbody')) {
    let span = 0
    for (const row of body.querySelectorAll('tr[data-series-id]')) {
      const time = row.querySelector('.inspector-day-time')
      assert.equal(row.children.length + Number(!time && span > 0), 6, 'Shared time spans keep every numeric column aligned')
      if (time) span = time.rowSpan
      span--
    }
  }
  const prepared = view.releases, markers = view.markers, work = globalThis.__dailyWork, select = view.selectRelease
  for (let i = 0; i < 20; i++) listeners.forEach(fn => fn())
  assert.equal(frames.size, 1)
  await React.act(async () => { for (const [id, fn] of frames) { frames.delete(id); fn() } })
  assert.equal(globalThis.__dailyWork, work, 'Panning does zero daily regrouping work')
  visible = { from: at / 1000 + 3 * 3600, to: at / 1000 + 7 * 3600 }
  listeners.forEach(fn => fn())
  await React.act(async () => { for (const [id, fn] of frames) { frames.delete(id); fn() } })
  assert.equal(document.querySelectorAll('.inspector-day-symbol').length, 2, 'Intraday view keeps both currency icons after midnight leaves the viewport')
  assert.equal(document.querySelector('.inspector-day-cluster').style.left, '24px', 'Daily symbols stay inside the viewport edge')
  assert.equal(globalThis.__dailyWork, work)
  visible = { from: at / 1000 - 2 * 86400, to: at / 1000 + 4 * 86400 }
  listeners.forEach(fn => fn())
  await React.act(async () => { for (const [id, fn] of frames) { frames.delete(id); fn() } })
  await render({ rows: [...sample] })
  assert.equal(view.releases, prepared); assert.equal(view.markers, markers); assert.equal(view.selectRelease, select)
  const corrected = sample.map(row => row.value_id === cpi[0].value_id ? { ...row, actual: .8, revision: 2 } : row)
  await render({ rows: corrected })
  assert.equal(view.selectedRelease.id, usd.id)
  assert.ok(host.querySelector('table').textContent.includes('0.8%'))
  assert.ok(host.querySelector('table').textContent.includes('Revision 2'))
  assert.equal(view.selectedRelease.events.length, 24)
  await React.act(async () => view.applyPreferences({ ...view.preferences, families: view.preferences.families.filter(id => id !== 'us-cpi') }))
  assert.equal(host.querySelectorAll('tr[data-series-id]').length, 14)
  assert.ok(document.querySelector('.inspector-day-symbol[title*="14 series"]'))
  await React.act(async () => view.applyPreferences({ ...view.preferences, symbolGrouping: 'release' }))
  assert.ok(view.selectedRelease && !view.selectedRelease.daily, 'Switching back selects an original publication')
  await React.act(async () => view.applyPreferences({ ...view.preferences, symbolGrouping: 'day', families: defaults.families }))
  assert.ok(view.selectedRelease.daily, 'Switching to daily restores the selected currency/day')
  await React.act(async () => view.applyPreferences({ ...view.preferences, families: view.preferences.families.filter(id => !data.inspectorFamilies.find(f => f.id === id && f.currency === 'USD')) }))
  assert.equal(view.selectedRelease, null, 'Removing the currency clears stale day details')
  await render({ symbol: 'GBPUSD' }); assert.equal(view.preferences.symbolGrouping, 'release', 'Each pair has independent grouping')
  await render({}); assert.equal(view.preferences.symbolGrouping, 'day')
  const workspace = exportWorkspace(), parsed = parseWorkspaceSnapshot(JSON.stringify(workspace))
  assert.equal(JSON.parse(parsed.entries[data.inspectorStorageKey]).symbolGrouping, 'day')
  const invalid = { ...workspace, entries: { ...workspace.entries, [data.inspectorStorageKey]: JSON.stringify({ ...view.preferences, symbolGrouping: 'week' }) } }
  assert.throws(() => parseWorkspaceSnapshot(JSON.stringify(invalid)), /Invalid workspace setting/)
  localStorage.setItem(data.gbpInspectorStorageKey, JSON.stringify({ ...data.defaultInspectorPreferences('GBPUSD'), symbolGrouping: undefined }))
  assert.equal(data.readInspectorPreferences('GBPUSD').symbolGrouping, 'release', 'Legacy settings retain current behavior')
  const spoken = [event('840050028', 12, { actual: null, previous: null }), event('840260001', 14, { actual: null, previous: null }),
    event('840050028', 18, { actual: null, previous: null }), event('840220020', 14, { actual: null, previous: null }),
    event('840050021', 12, { actual: null, previous: null }), ...italianRows, event('250010001', 16), event('250010002', 16),
    event('380010001', 18, { value_id: 'italian-later', revision: 2, period_seconds: at / 1000 - 60 * 86400 }),
    event('840030005', 15), event('840030006', 15), event('840030007', 15, { time_mode: 1, release_at: null, chart_time_seconds: null }),
    event('9876543210123456789', 14, { name: 'Fed Imaginary Speech' }), event('9876543210123456788', 14, { name: 'Unclassified source' })]
  await render({ rows: spoken })
  await React.act(async () => view.applyPreferences(defaults))
  const speeches = view.releases.find(release => release.currency === 'USD')
  const fed = speeches.daily.sections.find(section => section.label === 'Monetary policy')
  assert.equal(fed.publications.length, 5, 'All speeches/testimony, including repeated appearances, share their existing category')
  assert.equal(fed.releaseCount, 5, 'Concurrent different speakers remain separate releases')
  assert.ok(fed.publications.some(publication => publication.events.some(row => row.event_id === '840220020')))
  assert.equal(speeches.daily.sections.find(section => section.id === 'other').releaseCount, 2, 'Unknown source identities are never guessed or merged')
  assert.ok(!fed.publications.some(publication => publication.events.some(row => row.event_id === '9876543210123456789')))
  await React.act(async () => view.selectRelease(speeches.id))
  assert.equal(host.querySelectorAll('table').length, 1)
  assert.equal(host.querySelectorAll('tbody').length, speeches.daily.sections.length)
  assert.equal(host.querySelectorAll('tr[data-series-id]').length, spoken.filter(row => row.currency === 'USD').length)
  assert.deepEqual([...host.querySelectorAll('thead th')].map(node => node.textContent), ['Series', 'Time', 'Actual', 'Previous', 'A−P'])
  const fedBody = [...host.querySelectorAll('tbody')].find(body => body.querySelector('strong').textContent === 'Monetary policy')
  assert.equal(fedBody.querySelectorAll('tr[data-series-id]').length, 5)
  assert.deepEqual([...fedBody.querySelectorAll('.inspector-day-time')].map(node => node.textContent), ['12:00', '14:00', '18:00'])
  assert.equal(fedBody.querySelector('.inspector-day-time').rowSpan, 2, 'Simultaneous series share an aligned time cell')
  assert.ok(host.querySelector('.inspector-day-time').textContent)
  assert.ok(host.querySelector('table').textContent.includes('Date only'))
  await React.act(async () => view.applyPreferences({ ...defaults, families: defaults.families.filter(id => id !== data.inspectorFamilies.find(f => f.events.includes('840260001')).id) }))
  assert.equal(host.querySelectorAll('tr[data-series-id]').length, spoken.filter(row => row.currency === 'USD').length - 1, 'Original family filters still control speech rows')
  await React.act(async () => view.selectRelease(view.releases.find(release => release.currency === 'EUR').id))
  assert.equal(host.querySelectorAll('tbody').length, 1, 'All national inflation readings share the Inflation section')
  const italyBody = host.querySelector('tbody')
  assert.equal(italyBody.querySelectorAll('tr[data-series-id]').length, 7, 'Every national CPI/FOI row remains present')
  assert.deepEqual([...host.querySelectorAll('thead th')].map(node => node.textContent), ['Series', 'Country', 'Time', 'Actual', 'Previous', 'A−P'])
  assert.equal([...italyBody.querySelectorAll('tr[data-series-id] td[title]')].filter(node => node.textContent === 'IT').length, 5)
  assert.equal([...italyBody.querySelectorAll('tr[data-series-id] td[title]')].filter(node => node.textContent === 'FR').length, 2)
  assert.ok(italyBody.textContent.includes('Revision 2'))
  assert.deepEqual([...italyBody.querySelectorAll('.inspector-day-time')].map(node => node.textContent), ['16:00', '18:00'])
  const marketRows = [...['840100001', '840100002'].map(id => event(id, 0)),
    ...fixture.filter(row => row.country_currency === 'USD' && row.event_name.startsWith('CFTC ')).slice(0, 11).map(row => event(row.event_id, 2.5))]
  await render({ rows: marketRows })
  await React.act(async () => view.applyPreferences(defaults))
  await React.act(async () => view.selectRelease(view.releases.find(release => release.currency === 'USD').id))
  assert.deepEqual([...host.querySelectorAll('.inspector-day-section strong')].map(node => node.textContent), ['Growth / activity', 'Financial markets'])
  assert.equal(host.querySelectorAll('tr[data-series-id]').length, 13)
  const markets = host.querySelector('tbody[data-category-section="markets"]')
  assert.equal(markets.querySelectorAll('tr[data-series-id]').length, 11, 'All eleven financial-market rows share one category heading')
  assert.equal(markets.querySelectorAll('.inspector-day-time').length, 1)
  assert.equal(markets.querySelector('.inspector-day-time').rowSpan, 11)
  assert.equal(markets.querySelector('.inspector-day-time').textContent, '02:30')
  assert.equal(host.querySelectorAll('.inspector-day-section').length, 2, 'Individual release names are not repeated as headings')
  await React.act(async () => view.selectRelease(null)); assert.equal(view.selectedRelease, null)
  console.log('✓ Daily Inspector: all 1,051 catalog types/28 pairs, filter-category sections, separate currency icons, source-country/time labels, all series rows, preview/Save/Cancel, corrections, counts, portability and zero regrouping on pan')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  assert.equal(listeners.size, 0); assert.equal(sizeListeners.size, 0); assert.equal(frames.size, 0); assert.equal(clicks.size, 0)
  Date.now = originalNow; delete globalThis.__dailyWork
  for (const [key, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
  }
}
