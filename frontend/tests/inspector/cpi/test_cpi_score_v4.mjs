import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { history, latestRows, families, settings } from '../../usd-context/fixtures.mjs'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'), server: { middlewareMode: true, hmr: false } })
try {
  const { buildContextTimeline } = await server.ssrLoadModule('./src/scoring-system/context/usd/build-context-timeline.ts')
  const { compareCpiPublication } = await server.ssrLoadModule('./src/scoring-system/context/usd/publication-comparison.ts')
  const { contextAt } = await server.ssrLoadModule('./src/scoring-system/context/usd/context-lookup.ts')
  const { calculateCpiRelease } = await server.ssrLoadModule('./src/scoring-system/PAIR/EURUSD/USD/CPI/runtime/cpi-release-analysis.ts')
  const { assessCpiScoreV3 } = await server.ssrLoadModule('./src/scoring-system/PAIR/EURUSD/USD/CPI/assessment/cpi-score-v3.ts')
  const { groupInspectorReleases } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const events = [...history, ...latestRows], now = Date.UTC(2018, 7, 1)
  const release = groupInspectorReleases(latestRows).find(r => r.familyId === 'us-cpi')
  const timeline = buildContextTimeline({ events, families, settings, asOf: now })
  const comparison = compareCpiPublication(timeline, release, now)
  assert.deepEqual(calculateCpiRelease({ release, events, settings: {} }), assessCpiScoreV3(release, events), 'V4 preserves the standalone interpreter exactly')
  assert.equal(comparison.at, release.chartTime * 1000)
  assert.deepEqual(comparison.after, contextAt(timeline, comparison.at), 'Inspector uses the exact same context lookup as Raycaster')
  assert.deepEqual(comparison.before, contextAt(timeline, comparison.at - 1))
  const source = comparison.after.result.members.find(m => m.family === 'cpi')
  const prior = comparison.before.result.members.find(m => m.family === 'cpi')
  assert.equal(source.sourceId, release.id)
  assert.equal(comparison.voteChange, Math.round((source.contribution - prior.contribution) * 1e12) / 1e12)
  assert.match(comparison.explanation, /replaces the previous CPI vote/)
  const truncated = buildContextTimeline({ events: events.filter(e => e.release_at <= release.releaseAt), families, settings, asOf: release.releaseAt })
  assert.deepEqual(compareCpiPublication(truncated, release, now), comparison, 'Future removal preserves both before and after snapshots')
  for (const member of comparison.after.result.members) assert.ok(member.releaseAt <= release.releaseAt)
  const withoutCpi = buildContextTimeline({ events, families: families.filter(f => f !== 'us-cpi'), settings, asOf: now })
  const excluded = compareCpiPublication(withoutCpi, release, now)
  assert.equal(excluded.voteChange, 0); assert.match(excluded.explanation, /CPI is Off/)
  assert.deepEqual(excluded.before, excluded.after, 'A disabled CPI publication cannot manufacture a context update')
  for (const patch of [{ timingUncertain: true }, { chartTime: null }, { releaseAt: now + 1 }]) {
    const invalid = compareCpiPublication(timeline, { ...release, ...patch }, now)
    assert.equal(invalid.after, null); assert.equal(invalid.voteChange, null)
  }
  const noisy = buildContextTimeline({ events: events.map(e => ({ ...e, forecast: -999 })), families, settings, asOf: now })
  assert.deepEqual(compareCpiPublication(noisy, release, now), comparison)
  const brokenEvents = release.events.map(e => ({ ...e, actual: null, actual_raw_scaled_1e6: null }))
  const brokenRelease = { ...release, events: brokenEvents }
  const brokenTimeline = buildContextTimeline({ events: events.filter(e => e.release_at !== release.releaseAt).concat(brokenEvents), families, settings, asOf: now })
  const broken = compareCpiPublication(brokenTimeline, brokenRelease, now)
  assert.match(broken.explanation, /no usable context vote/)
  assert.equal(broken.after.result.members.find(m => m.family === 'cpi').status, 'unavailable')
  assert.ok(Math.abs(broken.voteChange + prior.contribution) < 1e-12, 'An uncomputed new CPI release replaces the old vote, within the score rounding precision')
  console.log('✓ CPI v4 standalone invariance, exact Raycaster parity, before/after replacement, disabled/uncomputed/timing gates and future/forecast exclusion')
} finally { await server.close() }
