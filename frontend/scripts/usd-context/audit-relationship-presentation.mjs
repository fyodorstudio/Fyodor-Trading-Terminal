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
  assert.equal(fingerprint(), original, 'Canonical history was not changed')
  console.log(JSON.stringify({ snapshotCount: timeline.points.length, kinds: Object.fromEntries([...byKind].map(([kind, values]) => [kind, values.length])),
    selectedRoofs: selections.length, projectedStates: projected, invariantChecks: checks,
    projectionMs: Math.round(performance.now() - projectionStart), totalMs: Math.round(performance.now() - start) }))
} finally { await server.close() }
