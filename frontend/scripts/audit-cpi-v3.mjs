import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

// Read-only with respect to the app and services. Inputs are exported snapshots;
// outputs are a separate JSON/Markdown report, never scorer parameters.
const [calendarPath, outputPrefix, priceAuditPath] = process.argv.slice(2)
if (!calendarPath || !outputPrefix) throw new Error('Usage: node scripts/audit-cpi-v3.mjs <calendar.json> <output-prefix> [price-audit.json]')
const read = (file) => JSON.parse(fs.readFileSync(path.resolve(file), 'utf8').replace(/^\uFEFF/, ''))
const calendar = read(calendarPath)
if (!Array.isArray(calendar.events)) throw new Error('Calendar snapshot must contain an events array.')
const prices = priceAuditPath ? read(priceAuditPath).rows : []
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root, server: { middlewareMode: true } })
try {
  const { groupInspectorReleases } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { assessCpiScoreV2 } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/CPI/assessment/cpi-score-v2.ts')
  const { assessCpiScoreV3, supportsCpiV3, cpiScoreV3Version } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/CPI/assessment/cpi-score-v3.ts')
  const rows = groupInspectorReleases(calendar.events).filter(supportsCpiV3)
    .sort((a, b) => a.releaseAt - b.releaseAt).map((release) => {
      const v2 = assessCpiScoreV2(release, calendar.events), v3 = assessCpiScoreV3(release, calendar.events)
      const fresh = v3.readings[0].points
      return { date: new Date(release.releaseAt).toISOString().slice(0, 10), releaseAt: release.releaseAt,
        v2: { label: v2.label, total: v2.total }, v3,
        coreOnly: fresh === null || fresh === 0 ? 'Uncomputed' : fresh > 0 ? 'EURUSD Short' : 'EURUSD Long',
        price: prices.find((r) => r.releaseAt === release.releaseAt)?.price ?? null }
    })
  const bands = [
    ['2015–2019', (r) => r.date < '2020'], ['2020–2024', (r) => r.date >= '2020' && r.date < '2025'],
    ['2025 onward', (r) => r.date >= '2025'],
  ]
  const models = ['v2', 'v3', 'coreOnly']
  const bias = (row, model) => model === 'coreOnly' ? row.coreOnly : row[model].label
  const coverage = bands.flatMap(([period, filter]) => models.map((model) => {
    const selected = rows.filter(filter)
    const count = (label) => selected.filter((r) => bias(r, model) === label).length
    return { period, model, total: selected.length, long: count('EURUSD Long'), short: count('EURUSD Short'), uncomputed: count('Uncomputed') }
  }))
  // All comparisons use the same price-present releases for all baselines.
  const comparisons = [15, 60, 240].map((minutes) => {
    const selected = rows.filter((r) => Number.isFinite(r.price?.returnsPips?.[minutes]) && r.price.returnsPips[minutes] !== 0)
    const counts = Object.fromEntries([...models, 'alwaysLong'].map((model) => {
      const eligible = model === 'alwaysLong' ? selected : selected.filter((r) => bias(r, model) !== 'Uncomputed')
      const correct = eligible.filter((r) => (model === 'alwaysLong' || bias(r, model) === 'EURUSD Long') === (r.price.returnsPips[minutes] > 0)).length
      return [model, { agreeing: correct, eligible: eligible.length, total: selected.length }]
    }))
    return { minutes, counts }
  })
  const fmt = (n) => n === null || n === undefined ? '—' : Number(n.toFixed(3))
  const lines = [
    '# CPI v3 implementation audit', '',
    `Source: ${calendar.source_id ?? 'snapshot'} · stored revision: ${calendar.revision ?? 'unknown'} · policy: ${cpiScoreV3Version}`, '',
    'Rules were fixed before running this comparison. Each release calibrates on strictly earlier publications only; no forecasts or price outcomes enter scores. Stored vintages can include overwritten revisions, so this is not a guaranteed point-in-time backtest.', '',
    'Fresh core compares the latest month with the preceding three-month average. Other v2 components and 35/35/20/10 weights are retained. Missing components do not vote; at least one calibrated core component is required. Unchanged evidence remains Uncomputed.', '',
    '## Chronological coverage', '', '| Period | Model | Releases | Long | Short | Uncomputed |', '| --- | --- | ---: | ---: | ---: | ---: |',
    ...coverage.map((r) => `| ${r.period} | ${r.model} | ${r.total} | ${r.long} | ${r.short} | ${r.uncomputed} |`), '',
    'coreOnly uses just the sign of the calibrated fresh-core component. Coverage is assessed across all stored history, including the calibration warm-up; this table is not accuracy.', '',
    '## Previously discussed releases', '',
    '| Date | V2 | V3 | Evidence | Data | V3 USD score | +15m pips | +60m pips | +240m pips |',
    '| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: |',
    ...rows.filter((r) => r.date >= '2025-05-01').map((r) => `| ${r.date} | ${r.v2.label} | ${r.v3.label} | ${r.v3.strength ?? '—'} | ${r.v3.reduced ? 'reduced' : 'full'} | ${fmt(r.v3.total)} | ${fmt(r.price?.returnsPips?.[15])} | ${fmt(r.price?.returnsPips?.[60])} | ${fmt(r.price?.returnsPips?.[240])} |`), '',
    '## Price diagnostics', '',
    'Primary diagnostic: baseline immediately before release → +60 minutes, rather than the containing H1 candle (which can contain pre-release trading). +15m and +240m are secondary. Returns reuse the supplied broker-clock/M15 audit; missing windows stay missing. Unadjusted prices exclude spread/slippage. Timing differences from manual observations remain unresolved.', '',
    'These 16 manually selected releases are development observations. Price direction agreement cannot establish causality or general predictive accuracy. The always-Long baseline exposes upward selection; models can have different eligible counts because Uncomputed is excluded.', '',
    '| Window | V2 agreement / eligible | V3 agreement / eligible | Fresh-core agreement / eligible | Always Long agreement / eligible |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...comparisons.map((r) => `| +${r.minutes}m | ${[...models, 'alwaysLong'].map((m) => `${r.counts[m].agreeing}/${r.counts[m].eligible}`).join(' | ')} |`), '',
    'All component values, thresholds, exclusions and sample counts are retained in the companion JSON. No optimization or tuning against these prices was performed.', '',
  ]
  const destination = path.resolve(outputPrefix)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(`${destination}.json`, JSON.stringify({ source: calendar.source_id, revision: calendar.revision, version: cpiScoreV3Version, coverage, comparisons, rows }, null, 2))
  fs.writeFileSync(`${destination}.md`, lines.join('\n'))
  console.log(lines.slice(lines.indexOf('## Previously discussed releases')).join('\n'))
  console.log(`Reports: ${destination}.md and .json`)
} finally { await server.close() }
