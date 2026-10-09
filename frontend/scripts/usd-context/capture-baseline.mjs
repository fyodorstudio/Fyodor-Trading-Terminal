import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const [snapshot, output] = process.argv.slice(2)
if (!snapshot || !output) throw new Error('Usage: node scripts/usd-context/capture-baseline.mjs <calendar.json> <baseline.json>')
const data = JSON.parse(fs.readFileSync(path.resolve(snapshot), 'utf8'))
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const server = await createServer({ root, server: { middlewareMode: true, hmr: false } })
try {
  const { buildContextTimeline } = await server.ssrLoadModule('./src/scoring-system/context/usd/build-context-timeline.ts')
  const { contextPriority, contextSourceFamilies } = await server.ssrLoadModule('./src/scoring-system/context/usd/policy.ts')
  const asOf = Date.UTC(2026, 9, 7)
  const timeline = buildContextTimeline({ events: data.events, asOf, families: contextSourceFamilies(contextPriority),
    settings: { cpi: {}, nfp: {}, services: {}, manufacturing: {}, retail: {}, claims: {}, pce: {}, ppi: {}, gdp: {} } })
  fs.writeFileSync(path.resolve(output), JSON.stringify({ source: data.source_id, revision: data.revision,
    scope: 'All eight sources, automatic magnitudes', asOf, timeline }) + '\n')
  console.log(`${timeline.version}: ${timeline.points.length} baseline snapshots captured`)
} finally { await server.close() }
