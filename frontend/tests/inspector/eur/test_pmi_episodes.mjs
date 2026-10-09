import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT', 'Worker']
const previous = Object.fromEntries(keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
globalThis.Worker = undefined
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
try {
  const load = p => server.ssrLoadModule('./src/' + p)
  const { groupInspectorReleases, defaultInspectorPreferences, filterInspectorReleases, buildInspectorMarkers } = await load('inspector/inspector-data.ts')
  const { groupPmiEpisodes, pmiSourceRelease } = await load('inspector/episodes/pmi-episodes.ts')
  const { inspectorFilterRows } = await load('inspector/filters/inspector-filter-rows.ts')
  const { PmiReadingsTable } = await load('inspector/readings/PmiReadingsTable.tsx')
  const { InspectorScoringView } = await load('inspector/scoring/InspectorScoringView.tsx')
  const { ContextDetailed } = await load('raycaster/ui/ContextDetailed.tsx')
  const { inspectorScoringBinding } = await load('inspector/scoring/scoring-registry.ts')
  const { assessEurScore } = await load('scoring-system/PAIR/EURUSD/EUR/assessment/eur-score.ts')
  const { useInspector } = await load('inspector/useInspector.ts')
  const rows = Array.from({ length: 48 }, (_, month) => [['FR', '250', 15], ['DE', '276', 30], ['EU', '999', 60]].flatMap(([country, prefix, minute]) =>
    [1, 2, 3].map(series => {
      const at = Date.UTC(2015, month, 24, 8, minute)
      const id = `${prefix}50000${series}`
      return { value_id: `${id}/${month}`, event_id: id, name: `${country} PMI ${series}`, event_code: id, currency: 'EUR',
        country_code: country, country_name: country, unit: 0, multiplier: 0, digits: 1, time_mode: 0, revision: 1,
        importance: 'high', impact: 'none', actual: 51 + month % 7 * .3 + series * .1, previous: 51, forecast: null, revised_previous: null,
        period_seconds: Date.UTC(2015, month, 1) / 1000, release_at: at, server_time_seconds: at / 1000, chart_time_seconds: at / 1000 }
    }))) .flat()
  const raw = groupInspectorReleases(rows), latest = raw.slice(-3), grouped = groupPmiEpisodes(raw), episode = grouped.at(-1)
  assert.equal(raw.length, 144); assert.equal(grouped.length, 48)
  assert.equal(episode.label, 'Euro-area PMI · France / Germany / Euro area')
  assert.deepEqual(episode.pmiPublications.map(r => r.country), ['FR', 'DE', 'EU'])
  assert.equal(episode.events.length, 9); assert.equal(episode.chartTime, latest[0].chartTime, 'One marker anchors the publication round at its first report')
  assert.deepEqual(episode.pmiPublications, latest, 'Original series, IDs and clocks stay intact')
  assert.equal(pmiSourceRelease(episode, null, latest[1].releaseAt).country, 'DE')
  assert.equal(pmiSourceRelease(episode, null, latest[2].releaseAt - 1).country, 'DE', 'Later aggregate is not used before publication')
  assert.equal(pmiSourceRelease(episode, null, latest[2].releaseAt).country, 'EU')
  const finalRows = latest.flatMap(r => r.events.map(e => ({ ...e, value_id: e.value_id + '/final', revision: 2,
    release_at: e.release_at + 86400000, server_time_seconds: e.server_time_seconds + 86400, chart_time_seconds: e.chart_time_seconds + 86400 })))
  assert.equal(groupPmiEpisodes(groupInspectorReleases([...latest.flatMap(r => r.events), ...finalRows])).length, 2, 'Flash and later finals form separate publication rounds')
  const duplicate = { ...latest[0], id: 'reissued', releaseAt: latest[0].releaseAt + 60000, chartTime: latest[0].chartTime + 60,
    events: latest[0].events.map(e => ({ ...e, release_at: e.release_at + 60000 })) }
  assert.equal(groupPmiEpisodes([...latest, duplicate]).length, 4, 'Ambiguous reissues remain separate')
  const missingPeriod = { ...latest[0], events: latest[0].events.map(e => ({ ...e, period_seconds: 0 })) }
  assert.ok(groupPmiEpisodes([missingPeriod, ...latest.slice(1)]).includes(missingPeriod), 'Unknown reference periods are not guessed')
  const uncertain = { ...latest[0], timingUncertain: true }
  assert.ok(groupPmiEpisodes([uncertain, ...latest.slice(1)]).includes(uncertain))
  const beforeGrouping = latest.map(r => assessEurScore(r, rows))
  assert.deepEqual(episode.pmiPublications.map(r => assessEurScore(r, rows)), beforeGrouping, 'Grouping cannot change scores/calibration')
  assert.deepEqual(groupPmiEpisodes(raw.filter(r => r.releaseAt <= latest[1].releaseAt)).at(-1).pmiPublications, latest.slice(0, 2), 'Removing future publications keeps the earlier round intact')
  const prefs = defaultInspectorPreferences(), filter = inspectorFilterRows.find(r => r.id === 'euro-pmi')
  assert.deepEqual(filter.ids, ['euro-pmi', 'german-pmi', 'french-pmi'])
  assert.ok(!inspectorFilterRows.some(r => r.id === 'french-pmi' || r.id === 'german-pmi'))
  const range = { from: latest[1].releaseAt, to: latest[1].releaseAt + 1 }
  const narrow = { ...prefs, families: ['german-pmi'], symbols: { ...prefs.symbols, 'german-pmi': 'cloud' } }
  assert.deepEqual(filterInspectorReleases([episode], narrow, range), [episode], 'Date and legacy family filters match original members')
  const bars = [8, 9].map(hour => ({ time: Date.UTC(2018, 11, 24, hour) / 1000, open: 1, high: 1, low: 1, close: 1 }))
  const markers = buildInspectorMarkers([episode], narrow, bars, 'H1')
  assert.equal(markers.length, 1); assert.equal(markers[0].symbol, 'cloud')
  const timeDisplay = { mode: 'utc', utcOffsetMinutes: 0 }
  const render = (Component, props) => React.act(async () => root.render(React.createElement(Component, props)))
  await render(PmiReadingsTable, { release: episode, view: { preferences: prefs, brokerTime: true, brokerId: null }, timeDisplay })
  assert.equal(host.querySelectorAll('table').length, 1)
  assert.equal(host.querySelectorAll('tbody').length, 3)
  assert.equal(host.querySelectorAll('tbody tr').length, 12, 'Three section headers and nine series share one table')
  assert.deepEqual([...host.querySelectorAll('th[scope="rowgroup"]')].map(th => th.textContent.split(' · ')[0]), ['France', 'Germany', 'Euro area'])
  let opened
  const scoringProps = { release: episode, events: rows, now: latest[2].releaseAt, timeDisplay,
    binding: inspectorScoringBinding('EURUSD', latest[2]), onOpenScatter: r => { opened = r } }
  await render(InspectorScoringView, scoringProps)
  assert.equal(host.querySelectorAll('[aria-label="EUR release interpretation"]').length, 3)
  const sections = ['France', 'Germany', 'Euro area'].map(name => host.querySelector(`[aria-label="${name} PMI scoring"]`))
  assert.deepEqual(sections.map(section => section.querySelector('.inspector-majority').textContent), beforeGrouping.map(score => score.label))
  await React.act(async () => sections[1].querySelector('button').click()); assert.equal(opened.id, latest[1].id, 'Scatter gets the original German publication')
  await render(InspectorScoringView, { ...scoringProps, now: latest[1].releaseAt })
  assert.equal(host.querySelector('[aria-label="Euro area PMI scoring"] .inspector-majority').textContent, 'Uncomputed', 'Grouped standalone view cannot expose a future score')
  assert.equal(host.querySelectorAll('.publication-context-cutoff').length, 0, 'Inspector keeps only the grouped standalone interpreters')
  await render(ContextDetailed, { point: null, symbol: 'EURUSD', cutoff: null, loading: false, message: null,
    label: 'Uncomputed', presentation: null, relative: false, timeDisplay,
    publication: { ...scoringProps, now: latest[1].releaseAt } })
  assert.match(host.querySelector('.publication-context-cutoff').textContent, /08:30/, 'Context cutoff uses Germany while the aggregate is pending')
  assert.match(host.querySelector('.raycaster-publication').textContent, /France and Germany supply earlier proxies/, 'Grouped publication replacement details survive the move to Raycaster')
  const workers = []
  globalThis.Worker = class {
    jobs = []; constructor() { workers.push(this) }
    postMessage(job) { this.jobs.push(job) }
    terminate() {}
  }
  await React.act(async () => root.render(null))
  await render(InspectorScoringView, scoringProps)
  const eurWorkers = workers.filter(worker => worker.jobs[0]?.input.release)
  assert.equal(eurWorkers.length, 3, 'Each original interpreter has its own scoped job')
  await React.act(async () => eurWorkers.forEach(worker => {
    const job = worker.jobs[0]
    worker.onmessage({ data: { id: job.id, result: assessEurScore(job.input.release, job.input.events, job.input.settings) } })
  }))
  for (let tick = 1; tick <= 5; tick++) await render(InspectorScoringView, { ...scoringProps, now: scoringProps.now + tick * 3000 })
  assert.ok(eurWorkers.every(worker => worker.jobs.length === 1), 'Clock-only renders do not rescore the three PMI publications')
  globalThis.Worker = undefined
  let view
  const clockOffsetMs = latest[2].releaseAt - Date.now()
  function InspectorHarness() {
    const inspector = useInspector({ events: rows, symbol: 'EURUSD', bars, timeframe: 'H1', timeDisplay, clockOffsetMs })
    React.useEffect(() => { view = inspector }, [inspector])
    return null
  }
  await render(InspectorHarness, {})
  await React.act(async () => { view.selectCustomRange('2018-12-24', '2018-12-24'); view.selectRelease(latest[1].id) })
  assert.equal(view.selectedRelease.id, episode.id, 'Selecting an original member resolves the grouped Inspector entry')
  assert.equal(view.markers.length, 1); assert.equal(view.allReleases.length, 144, 'Raw scoring and Scatter inventory remains ungrouped')
  console.log('✓ One PMI round/marker/filter, shared sectioned table, original standalone/Scatter outputs, flash/final separation, conservative grouping and exact publication cutoffs')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key] }
}
