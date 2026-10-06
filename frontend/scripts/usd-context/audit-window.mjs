import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const [snapshot, from, through, prefix] = process.argv.slice(2)
if (!snapshot || !from || !through || !prefix) {
  throw new Error('Usage: node scripts/usd-context/audit-window.mjs <snapshot.json> <YYYY-MM-DD> <YYYY-MM-DD> <output-prefix>')
}
const start = Date.parse(from + 'T00:00:00Z')
const end = Date.parse(through + 'T23:59:59.999Z')
assert.ok(Number.isFinite(start) && Number.isFinite(end) && start <= end, 'Valid ordered UTC dates required')
const data = JSON.parse(fs.readFileSync(path.resolve(snapshot), 'utf8'))
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const server = await createServer({ root, server: { middlewareMode: true, hmr: false } })
let report
try {
  const load = p => server.ssrLoadModule('./src/usd-context/core/' + p + '.ts')
  const { buildContextTimeline } = await load('build-context-timeline')
  const { contextAt } = await load('context-lookup')
  const { contextPriority, contextSourceFamilies } = await load('policy')
  const events = data.events.filter(e => e.release_at <= end)
  const input = { events, families: contextSourceFamilies(contextPriority), asOf: end,
    settings: { cpi: {}, nfp: {}, services: {}, manufacturing: {}, claims: {}, retail: {}, pce: {}, ppi: {}, gdp: {} } }
  const timeline = buildContextTimeline(input)
  const selected = timeline.points.filter(p => p.chartAt >= start && p.chartAt <= end)
  const entering = contextAt(timeline, start - 1)
  const rows = (entering ? [entering, ...selected] : selected).map(p => ({
    chartAt: p.chartAt, chartDate: new Date(p.chartAt).toISOString(), update: p.update,
    direction: p.result.direction, strength: p.result.strength, total: p.result.total,
    missing: p.result.missing, reason: p.result.reason, policy: p.result.policy,
    members: p.result.members.map(m => ({ family: m.family, sourceId: m.sourceId,
      publication: new Date(m.releaseAt).toISOString(), chartPublication: new Date(m.chartAt).toISOString(),
      ageDays: +(Math.max(0, p.chartAt - m.chartAt) / 86400000).toFixed(3),
      direction: m.usdDirection, strength: m.strength, reduced: m.reduced, total: m.total,
      weight: p.result.policy.weights[m.family], contribution: m.contribution, status: m.status,
      explanation: m.explanation, reason: m.reason })),
  }))
  // Representative replay: the final stored inventory must not affect publication-time results.
  const publications = selected.filter(p => p.latest?.chartAt === p.chartAt)
  const count = Math.min(6, publications.length)
  const sample = Array.from({ length: count }, (_, i) => publications[count === 1 ? 0 :
    Math.round(i * (publications.length - 1) / (count - 1))])
  const replayed = new Set()
  for (const p of sample) {
    const cutoff = p.latest.releaseAt
    if (replayed.has(cutoff)) continue
    const replay = buildContextTimeline({ ...input, asOf: cutoff, events: events.filter(e => e.release_at <= cutoff) })
    assert.deepEqual(contextAt(replay, p.chartAt), p, p.latest.sourceId + ' future removal')
    replayed.add(cutoff)
  }
  report = { source: data.source_id, revision: data.revision ?? null, version: timeline.version,
    scope: 'All eight enabled families; automatic magnitudes. Live saved filters and manual overrides are not captured.',
    from, through, excludedTiming: timeline.excludedTiming, replayChecks: replayed.size, rows }
} finally { await server.close() }
fs.writeFileSync(path.resolve(prefix + '.json'), JSON.stringify(report, null, 2) + '\n')
const pairBias = d => d === 'stronger' ? 'Short' : d === 'weaker' ? 'Long' : 'Uncomputed'
const lines = ['# USD context window replay', '', report.scope,
  'Chart dates use the stored broker clock. Publication dates use UTC. No forecast or price enters this replay; later revisions retained in the snapshot remain a limitation.', '',
  `Source: ${report.source}; revision ${report.revision}; ${report.version}. Future-removal checks: ${report.replayChecks}. Excluded timing: ${report.excludedTiming}.`, '',
  '| Broker chart time | EURUSD bias | Evidence | USD total | Policy |',
  '| --- | --- | --- | ---: | --- |',
  ...report.rows.map(r => `| ${r.chartDate.slice(0,16).replace('T',' ')} | ${pairBias(r.direction)} | ${r.strength} | ${r.total} | ${r.policy.mode} |`), '']
for (const r of report.rows) {
  lines.push(`## ${r.chartDate}: ${pairBias(r.direction)} / ${r.strength}`, '', r.update, '',
    '| Input | UTC publication | Source bias | Evidence | Source total | Weight | USD contribution | Status |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | --- |',
    ...r.members.map(m => `| ${m.family} | ${m.publication.slice(0,16).replace('T',' ')} | ${pairBias(m.direction)} | ${m.strength} | ${m.total} | ${m.weight}% | ${m.contribution} | ${m.status} |`), '', r.reason, '')
}
fs.writeFileSync(path.resolve(prefix + '.md'), lines.join('\n'))
console.log(JSON.stringify({ ...report, rows: report.rows.map(r => ({ ...r, policy: r.policy.mode,
  members: r.members.map(m => ({ family: m.family, publication: m.publication.slice(0,10),
    total: m.total, contribution: m.contribution, status: m.status })) })) }, null, 2))
