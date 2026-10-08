// Optional read-only replay against a previously captured calendar inventory.
// No price, settings, dataset or report files are written.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const [inputFile] = process.argv.slice(2)
if (!inputFile) throw Error('Usage: audit-relationship-presentation.mjs <frozen input.json>')
const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'))
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
try {
  const load = p => server.ssrLoadModule('./src/' + p + '.ts')
  const { buildContextTimeline } = await load('usd-context/core/build-context-timeline')
  const { buildRelationshipTimeline } = await load('usd-context/sequences/core/relationship-timeline')
  const { roofSupport } = await load('usd-context/sequences/core/relationship-support')
  const { prepareRoofAnchors, createRoofPlan, projectRoofPlan } = await load('usd-context/sequences/chart/roof-plan')
  const { roofBarIndex } = await load('usd-context/sequences/chart/roof-geometry')
  const { alignRoofMarkers } = await load('usd-context/sequences/chart/roof-marker-alignment')
  const { groupInspectorReleases, defaultInspectorPreferences, buildInspectorMarkers } = await load('inspector/inspector-data')
  const { groupIsmEpisodes } = await load('inspector/episodes/ism-episodes')
  const { indexMarkers, projectMarkers } = await load('inspector/chart/marker-projection')
  const start = performance.now()
  const timeline = buildContextTimeline(input.inputUSD)
  const byKind = new Map()
  for (const episode of timeline.relationships.episodes) {
    const group = byKind.get(episode.kind) ?? []
    group.push(episode); byKind.set(episode.kind, group)
  }
  const selections = [...byKind.values()].flatMap(group => [...group.slice(0, 1), ...group.slice(-3)])
  const fingerprint = () => {
    const hash = createHash('sha256')
    for (const point of timeline.points) hash.update(JSON.stringify(point))
    for (const point of timeline.relationships.fresh) hash.update(JSON.stringify(point))
    for (const selection of selections) hash.update(JSON.stringify(selection))
    return hash.digest('hex')
  }
  const original = fingerprint()
  let checks = 0, projected = 0
  const projectionStart = performance.now()
  for (const roof of selections) {
    const points = buildRelationshipTimeline(timeline, roof)
    assert.equal(points[0].at, roof.chartAt)
    assert.deepEqual(points[0].support, roofSupport(roof), 'Activation reuses canonical relationship support')
    projected += points.length
    for (const point of points) {
      assert.ok(point.at >= roof.chartAt)
      assert.ok(point.support.sources.every(s => s.chartAt <= point.at), 'No future input')
      const votes = point.support.votes
      const long = votes.reduce((n, v) => n + Math.max(0, -v.vote), 0)
      const short = votes.reduce((n, v) => n + Math.max(0, v.vote), 0)
      assert.ok(Math.abs(point.support.long - long) < 1e-10 && Math.abs(point.support.short - short) < 1e-10)
      assert.ok(votes.every(v => v.source.family !== 'fed'), 'No Fed magnitude vote')
      if (point.support.state === 'insufficient') assert.equal(point.support.direction, null)
      if (roof.kind === 'release-relationship' && point.support.state !== 'insufficient') assert.deepEqual(
        [...new Set(point.support.sources.map(s => s.family))].sort(), [...new Set(roof.sources.map(s => s.family))].sort())
      if (roof.kind === 'fresh-news') assert.ok(votes.every(v => v.source.comparable && point.at - v.source.chartAt < 7 * 86400000))
      checks++
    }
  }
  const hour = 3600000, first = Math.floor(timeline.points[0].chartAt / hour) * hour
  const last = timeline.points.at(-1).chartAt
  // Synthetic candle times exercise chart projection, without loading prices.
  const bars = Array.from({ length: Math.ceil((last - first) / hour) + 1 }, (_, i) => ({ time: (first + i * hour) / 1000 }))
  const releases = groupIsmEpisodes(groupInspectorReleases(input.inputUSD.events.filter(e => e.release_at <= input.inputUSD.asOf)))
  const markers = buildInspectorMarkers(releases, defaultInspectorPreferences(), bars, 'H1'), markerIndex = indexMarkers(markers)
  const chartSelections = [...byKind.values()].map(group => group.at(-1))
  const julyIsm = byKind.get('ism-sectors')?.find(r => r.chartAt === Date.UTC(2026, 6, 6, 17))
  if (julyIsm) chartSelections.push(julyIsm)
  let chartViews = 0
  for (const roof of chartSelections) {
    const episodes = timeline.relationships.episodes.filter(r => Math.abs(r.chartAt - roof.chartAt) < 90 * 86400000)
    const anchors = prepareRoofAnchors(episodes, bars, 'H1', markers, true, episodes.length)
    for (const spacing of [3, 6, 18]) for (const rows of [2, 6]) {
      const plan = createRoofPlan(anchors, spacing, true, rows, roof.id)
      let previous = null
      for (const shift of [0, -30, 0]) {
        const offset = 960 - roofBarIndex(bars, roof.chartAt, 'H1') * spacing + shift
        const scale = { width: () => 1600, getVisibleRange: () => ({ from: (first - offset / spacing * hour) / 1000,
          to: (first + (1600 - offset) / spacing * hour) / 1000 }), timeToCoordinate: t => (t - first / 1000) / 3600 * spacing + offset }
        const clusters = projectMarkers(scale, markerIndex)
        const view = alignRoofMarkers(projectRoofPlan(plan, offset, 1600).positioned, clusters)
        const selected = view.find(p => p.combo.id === roof.id)
        assert.ok(selected, 'Selected roof keeps its chart place across zoom/row limits')
        assert.equal(selected.labelX, selected.right, 'Label stays on its activation candle')
        assert.ok(view.every(p => p.lane < rows), 'Only rows fitting the chart are used')
        const targets = new Map(clusters.flatMap(c => c.markers.flatMap(m => [m.release.id,
          ...(m.release.ismPublications?.map(p => p.id) ?? [])].map(id => [id, c.x]))))
        for (const endpoint of selected.endpoints.filter(e => !e.activation)) for (const publication of endpoint.publications) {
          const x = targets.get(publication.source.sourceId)
          if (x !== undefined) assert.equal(endpoint.x, x, 'Connector ends at the displayed grouped symbol')
        }
        if (previous) assert.equal(selected.lane, previous.lane, 'Pan cannot repack a selected roof')
        previous = selected; chartViews++
      }
    }
  }
  assert.equal(fingerprint(), original, 'Canonical history was not changed')
  console.log(JSON.stringify({ snapshotCount: timeline.points.length, kinds: Object.fromEntries([...byKind].map(([kind, values]) => [kind, values.length])),
    selectedRoofs: selections.length, projectedStates: projected, invariantChecks: checks, chartSelections: chartSelections.length, chartViews,
    projectionMs: Math.round(performance.now() - projectionStart), totalMs: Math.round(performance.now() - start) }))
} finally { await server.close() }
