import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const [calendarPath, outputPrefix] = process.argv.slice(2)
if (!calendarPath || !outputPrefix) throw new Error('Usage: node scripts/audit-nfp-v2.mjs <calendar.json> <output-prefix>')
const calendar = JSON.parse(fs.readFileSync(path.resolve(calendarPath), 'utf8').replace(/^\uFEFF/, ''))
if (!Array.isArray(calendar.events)) throw new Error('Calendar snapshot must contain an events array.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root, server: { middlewareMode: true } })
try {
  const { groupInspectorReleases } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { assessNfpScoreV2, supportsNfpV2, nfpScoreV2Version } = await server.ssrLoadModule('./src/scoring-system/PAIR/EURUSD/USD/NFP/assessment/nfp-score-v2.ts')
  const rows = groupInspectorReleases(calendar.events).filter(supportsNfpV2)
    .sort((a, b) => a.releaseAt - b.releaseAt).map((release) => ({ date: new Date(release.releaseAt).toISOString().slice(0, 10),
      releaseAt: release.releaseAt, assessment: assessNfpScoreV2(release, calendar.events),
      readings: release.events.map((e) => ({ id: e.event_id, actual: e.actual, previous: e.previous, revisedPrevious: e.revised_previous,
        period: new Date(e.period_seconds * 1000).toISOString().slice(0, 10), revision: e.revision })) }))
  const bands = [['2015–2019', (r) => r.date < '2020'], ['2020–2024', (r) => r.date >= '2020' && r.date < '2025'],
    ['2025 onward', (r) => r.date >= '2025']]
  const coverage = bands.map(([period, filter]) => {
    const selected = rows.filter(filter), count = (label) => selected.filter((r) => r.assessment.label === label).length
    return { period, total: selected.length, long: count('EURUSD Long'), short: count('EURUSD Short'), uncomputed: count('Uncomputed'),
      reduced: selected.filter((r) => r.assessment.reduced).length }
  })
  const fmt = (n) => n === null ? '—' : Number(n.toFixed(3))
  const lines = [
    '# USD NFP v2 implementation audit', '',
    `Source: ${calendar.source_id ?? 'snapshot'} · revision: ${calendar.revision ?? 'unknown'} · policy: ${nfpScoreV2Version}`, '',
    'Each assessment uses only strictly earlier publications for calibration. No forecast, CPI, Fed decision or price input enters the scorer. Rules were fixed before this audit; no parameter search was performed.', '',
    'Weights: hiring 40, inverse unemployment 30, wage pace 15, preceding-month payroll revision 10, hours 5. Hiring compares actual job change with max(0, preceding three-month mean). Wage pace compares monthly growth with its preceding three-month mean. Unemployment, revision and hours use supplied comparison fields.', '',
    'When unemployment and participation both fall, unemployment weight halves to 15. Missing participation leaves the weight intact with a caution and caps evidence at moderate. Supporting payroll composition and annual wages do not vote. The provider supplies only the preceding-month payroll revision, not the full two-month BLS revision.', '',
    'Related hiring, revision and hours signals share an employment group for evidence confirmation. Strength, change size and data limitations are separate descriptions. They are not statistical confidence or price forecasts.', '',
    '## Chronological coverage', '',
    '| Period | Releases | Long | Short | Uncomputed | Reduced data |', '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...coverage.map((r) => `| ${r.period} | ${r.total} | ${r.long} | ${r.short} | ${r.uncomputed} | ${r.reduced} |`), '',
    'The early history includes the 24-observation calibration warm-up. Stored old rows may contain overwritten revisions; this is a behavior/coverage audit, not a guaranteed point-in-time backtest or price-accuracy measurement.', '',
    '## Recent releases', '',
    '| Date | Bias | Evidence | Change size | Data | USD score | Explanation |', '| --- | --- | --- | --- | --- | ---: | --- |',
    ...rows.filter((r) => r.date >= '2025-01-01').map(({ date, assessment: a }) =>
      `| ${date} | ${a.label} | ${a.strength ?? '—'} | ${a.changeSize ?? '—'} | ${a.reduced ? 'reduced' : 'full'} | ${fmt(a.total)} | ${a.explanation} ${a.strengthReason} |`), '',
    'The companion JSON retains every component, exclusion, threshold, sample count, participation adjustment and supporting observation for manual auditing.', '',
  ]
  const destination = path.resolve(outputPrefix)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(`${destination}.json`, JSON.stringify({ source: calendar.source_id, revision: calendar.revision, version: nfpScoreV2Version, coverage, rows }, null, 2))
  fs.writeFileSync(`${destination}.md`, lines.join('\n'))
  console.log(lines.slice(lines.indexOf('## Chronological coverage')).join('\n'))
  console.log(`Reports: ${destination}.md and .json`)
} finally { await server.close() }
