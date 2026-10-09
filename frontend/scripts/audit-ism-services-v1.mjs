import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const [calendarPath, outputPrefix] = process.argv.slice(2)
if (!calendarPath || !outputPrefix) throw new Error('Usage: node scripts/audit-ism-services-v1.mjs <calendar.json> <output-prefix>')
const calendar = JSON.parse(fs.readFileSync(path.resolve(calendarPath), 'utf8').replace(/^\uFEFF/, ''))
if (!Array.isArray(calendar.events)) throw new Error('Calendar snapshot must contain an events array.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root, server: { middlewareMode: true } })
try {
  const { assessIsmServicesScore, ismServicesScoreVersion } = await server.ssrLoadModule('./src/scoring-system/PAIR/EURUSD/USD/ISM/sectors/services/ism-services-score.ts')
  const { prepareScoringSignalHistory, scoringSignalBinding, scoringSignalModel } = await server.ssrLoadModule('./src/scatter-plot/inspection/scoring-signal-model.ts')
  const binding = scoringSignalBinding('ism-services')
  const history = prepareScoringSignalHistory(calendar.events, Date.now(), binding)
  const chart = Object.fromEntries(binding.signals.map((signal) => [signal.id,
    new Map(scoringSignalModel(history, binding, signal.id, null).points.map((point) => [point.releaseId, point.signal]))]))
  const rows = history.map(({ release }) => {
    const assessment = assessIsmServicesScore(release, calendar.events)
    for (const row of assessment.readings) {
      const plotted = chart[row.id].get(release.id)
      if (row.value === null) assert.equal(plotted, undefined, 'Missing inputs are not plotted as zeros')
      else for (const key of ['value', 'points', 'limits', 'sampleCount', 'reason', 'inputs'])
        assert.deepEqual(plotted?.[key], row[key], `${release.releaseAt}/${row.id}/${key} scorer-chart parity`)
    }
    return { date: new Date(release.releaseAt).toISOString().slice(0, 10), releaseAt: release.releaseAt, assessment }
  })
  const bands = [['2015–2019', (row) => row.date < '2020'], ['2020–2024', (row) => row.date >= '2020' && row.date < '2025'],
    ['2025 onward', (row) => row.date >= '2025']]
  const coverage = bands.map(([period, filter]) => {
    const selected = rows.filter(filter), count = (label) => selected.filter((row) => row.assessment.label === label).length
    return { period, total: selected.length, long: count('EURUSD Long'), short: count('EURUSD Short'), uncomputed: count('Uncomputed'),
      reduced: selected.filter((row) => row.assessment.reduced).length }
  })
  const fmt = (value) => value === null ? '—' : Number(value.toFixed(3))
  const lines = [
    '# USD ISM Services v1 implementation audit', '',
    `Source: ${calendar.source_id ?? 'snapshot'} · revision: ${calendar.revision ?? 'unknown'} · policy: ${ismServicesScoreVersion}`, '',
    'This audits implementation and coverage, not price-prediction accuracy. No forecast, price input, other release or Fed decision enters scoring. Rules and weights were set before the chronological audit; no parameter search is performed.', '',
    'New orders has weight 35; business activity 25; employment 25; prices paid 15. Each actual index is compared with the higher of 50 and its preceding three-month mean, incorporating supplied Revised Previous for the nearest month. A rebound below 50 remains adverse. At least one calibrated demand component is required. Ties follow table order; missing weights are not redistributed.', '',
    'Orders and activity share the demand evidence group; employment and prices have separate groups. Headline composite is non-voting context; supplier deliveries is unavailable and is not inferred. Prices Paid is a diffusion index, not a CPI inflation rate. Weights and the 50 comparison floor are prototype interpretation policies, not official ISM formulas or fitted estimates. Magnitudes use each component’s strictly earlier history and retain tied quantiles. Stored revisions may overwrite original vintages.', '',
    'All plotted component values, points, boundaries, calibration counts, reasons and input labels matched the scorer in this snapshot.', '',
    '## Chronological coverage', '', '| Period | Releases | Long | Short | Uncomputed | Reduced data |', '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...coverage.map((row) => `| ${row.period} | ${row.total} | ${row.long} | ${row.short} | ${row.uncomputed} | ${row.reduced} |`), '',
    '## Recent outputs', '', '| Date | Bias | Evidence | Change size | USD total | Explanation |', '| --- | --- | --- | --- | ---: | --- |',
    ...rows.filter((row) => row.date >= '2025').map(({ date, assessment: a }) =>
      `| ${date} | ${a.label} | ${a.strength ?? '—'} | ${a.changeSize ?? '—'} | ${fmt(a.total)} | ${a.explanation} |`), '',
  ]
  fs.writeFileSync(path.resolve(`${outputPrefix}.json`), JSON.stringify({ source: calendar.source_id, revision: calendar.revision,
    version: ismServicesScoreVersion, coverage, rows }, null, 2) + '\n')
  fs.writeFileSync(path.resolve(`${outputPrefix}.md`), lines.join('\n'))
  console.log(JSON.stringify({ releases: rows.length, coverage, chartParity: 'passed', report: `${outputPrefix}.md` }, null, 2))
} finally { await server.close() }
