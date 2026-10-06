import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const [input, output] = process.argv.slice(2)
if (!input || !output) throw new Error('Usage: node scripts/audit-ism-v2.mjs <calendar.json> <output-prefix>')
const calendar = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8').replace(/^\uFEFF/, ''))
if (!Array.isArray(calendar.events)) throw new Error('Snapshot requires an events array.')
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true } })
try {
  const { assessIsmScoreV2, ismScoreV2Version, supportsIsmV2 } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/ISM/assessment/ism-score-v2.ts')
  const { assessIsmServicesScore } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/ISM/sectors/services/ism-services-score.ts')
  const { groupInspectorReleases } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { observedReading } = await server.ssrLoadModule('./src/inspector/scoring/shared/core/historical-release-signals.ts')
  const { prepareScoringSignalHistory, scoringSignalBinding, scoringSignalModel } = await server.ssrLoadModule('./src/scatter-plot/inspection/scoring-signal-model.ts')
  const chart = Object.fromEntries(['services', 'manufacturing'].map((sector) => {
    const binding = scoringSignalBinding(`ism-${sector}`)
    const history = prepareScoringSignalHistory(calendar.events, Date.now(), binding)
    return [sector, Object.fromEntries(binding.signals.map((signal) => [signal.id,
      new Map(scoringSignalModel(history, binding, signal.id, null).points.map((point) => [point.releaseId, point.signal]))]))]
  }))
  const releases = groupInspectorReleases(calendar.events.filter((e) => observedReading(e) && e.release_at <= Date.now()))
    .filter(supportsIsmV2).sort((a, b) => a.releaseAt - b.releaseAt)
  const rows = releases.map((release) => {
    const a = assessIsmScoreV2(release, calendar.events)
    // Removing every later publication must leave the complete context unchanged.
    assert.deepEqual(assessIsmScoreV2(release, calendar.events.filter((e) => e.release_at <= release.releaseAt)), a)
    for (const member of [a.services, a.manufacturing]) {
      if (!member.assessment) continue
      assert.ok(member.release.releaseAt <= release.releaseAt)
      for (const row of member.assessment.readings) {
        const plotted = chart[member.sector][row.id].get(member.release.id)
        if (row.value === null) assert.equal(plotted, undefined)
        else for (const key of ['value', 'points', 'limits', 'sampleCount', 'reason', 'inputs'])
          assert.deepEqual(plotted?.[key], row[key], `${release.releaseAt}/${member.sector}/${row.id}/${key}`)
      }
    }
    assert.equal(a.total, a.readings.some((r) => r.points !== null) ? a.readings.reduce((sum, r) => sum + (r.points ?? 0) * r.weight, 0) / 10000 : null)
    const v1 = release.familyId === 'ism-services' ? assessIsmServicesScore(release, calendar.events) : null
    return { date: new Date(release.releaseAt).toISOString().slice(0, 10), family: release.familyId, releaseAt: release.releaseAt,
      v1: v1 && { label: v1.label, total: v1.total, strength: v1.strength }, assessment: a }
  })
  const periods = [['2015–2019', (r) => r.date < '2020'], ['2020–2024', (r) => r.date >= '2020' && r.date < '2025'], ['2025 onward', (r) => r.date >= '2025']]
  const coverage = periods.map(([period, filter]) => {
    const selected = rows.filter(filter)
    return { period, updates: selected.length, long: selected.filter((r) => r.assessment.direction === 'long').length,
      short: selected.filter((r) => r.assessment.direction === 'short').length, uncomputed: selected.filter((r) => r.assessment.direction === 'uncomputed').length,
      reduced: selected.filter((r) => r.assessment.reduced).length,
      timingExcluded: selected.filter((r) => [r.assessment.services, r.assessment.manufacturing].some((m) => m.status === 'excluded')).length }
  })
  const fmt = (value) => value === null ? '—' : Number(value.toFixed(3))
  const text = ['# ISM v2 implementation audit', '',
    `Source: ${calendar.source_id ?? 'snapshot'} · revision: ${calendar.revision ?? 'unknown'} · policy: ${ismScoreV2Version}`, '',
    'Rules were fixed before this audit. This checks chronological coverage, source-component chart parity and deterministic calculations, not price accuracy. No parameter search or forecast/price input is used.', '',
    'Services 70%, Manufacturing 30%. Services retains v1 component weights 35/25/25/15. Manufacturing uses orders/employment/prices 50/35/15. Same-reference-month publications only; missing weights are not redistributed. Source timestamps and chart markers remain distinct. Official 2026 date mismatches and weekend publications exclude the sector. Earlier comparisons retain stored provider values, guarded by both source and known official availability bounds. These checks do not reconstruct original data vintages or verify every historical publication time.', '',
    'Both sectors share demand/labor/prices evidence groups. Opposing sector totals or demand/employment votes cap strength at moderate. Incomplete data, narrow leads and ties carry weak evidence. Headline composites add no vote. Priorities and the 50 comparison floor are prototype interpretations.', '',
    'Every assessed sector component matched its source chart. Removing future publications left every selected context unchanged. Integer weighted totals matched all contexts.', '',
    '| Period | Updates | Long | Short | Uncomputed | Incomplete | Timing excluded |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...coverage.map((r) => `| ${r.period} | ${r.updates} | ${r.long} | ${r.short} | ${r.uncomputed} | ${r.reduced} | ${r.timingExcluded} |`), '',
    '## Recent Services updates compared with v1', '', '| Date | v1 | v2 context | Evidence | USD total | Timing issue |', '| --- | --- | --- | --- | ---: | --- |',
    ...rows.filter((r) => r.date >= '2025' && r.v1).map((r) => `| ${r.date} | ${r.v1.label} | ${r.assessment.label} | ${r.assessment.strength ?? '—'} | ${fmt(r.assessment.total)} | ${[r.assessment.services, r.assessment.manufacturing].map((m) => m.issue).filter(Boolean).join(' ') || '—'} |`), '',
  ]
  fs.writeFileSync(path.resolve(`${output}.json`), JSON.stringify({ source: calendar.source_id, revision: calendar.revision, version: ismScoreV2Version, coverage, rows }, null, 2) + '\n')
  fs.writeFileSync(path.resolve(`${output}.md`), text.join('\n'))
  console.log(JSON.stringify({ updates: rows.length, months: new Set(rows.map((r) => r.assessment.contextId)).size, coverage,
    sourceChartParity: 'passed', futureRemoval: 'passed', report: `${output}.md` }, null, 2))
} finally { await server.close() }
