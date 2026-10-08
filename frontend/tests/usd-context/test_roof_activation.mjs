import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
try {
  const load = p => server.ssrLoadModule('./src/' + p + '.ts')
  const { describeComboActivation } = await load('usd-context/sequences/core/combo-activation')
  const { buildContextRelationships } = await load('usd-context/sequences/core/build-relationships')
  const { combineContext } = await load('usd-context/core/combine-context')
  const { alignRoofMarkers } = await load('usd-context/sequences/chart/roof-marker-alignment')
  const { indexMarkers, projectMarkers } = await load('inspector/chart/marker-projection')
  const at = Date.UTC(2026, 9, 1), day = 86400000
  const source = (family, total, chartAt) => ({ family, total, chartAt, releaseAt: chartAt - 10800000, sourceId: family + '/' + chartAt,
    sourceLabel: family.toUpperCase(), usdDirection: total < 0 ? 'weaker' : 'stronger', strength: 'moderate', coverage: 1,
    reduced: false, tie: false, reason: '', explanation: '', changeSize: null, comparisonBasis: family, calibrationBasis: 'fixed' })
  const families = ['ppi', 'ism', 'claims', 'nfp']
  const old = families.map(f => source(f, 0, at - day))
  const first = [source('ppi', -1, at), ...old.slice(1)]
  const next = [first[0], ...families.slice(1).map(f => source(f, -1, at + day))]
  const combine = (sources, t) => combineContext(Object.fromEntries(sources.map(s => [s.family, s])), families, t)
  const points = [at, at + day, at + 7 * day].map((t, i) => ({ chartAt: t, result: combine(i ? next : first, t), latest: i ? next[1] : first[0], update: i === 2 ? 'Memory update' : 'Publication' }))
  const before = new Map([[at, combine(old, at - 1)], [at + day, combine(first, at + day - 1)]])
  const original = JSON.stringify([points, [...before]])
  const relationships = buildContextRelationships(points, before, new Map())
  const fresh = relationships.episodes.filter(c => c.kind === 'fresh-news')
  assert.equal(fresh.length, 2)
  assert.equal(fresh[0].activation.kind, 'publication')
  assert.equal(fresh[1].activation.kind, 'expiry', 'The phantom endpoint is an eligibility update, not a new release')
  assert.deepEqual(fresh[1].activation.removed.map(s => [s.sourceLabel, s.reason]), [['PPI', 'fresh-window']])
  assert.equal(fresh[1].after, points[2].result, 'Metadata never rescores or replaces accumulated output')
  assert.equal(JSON.stringify([points, [...before]]), original)
  assert.deepEqual(describeComboActivation('weekly-labor', next.slice(1), at + 2 * day, undefined, points[1].result, points[2].result), { kind: 'aging', removed: [] })
  const hardExpiry = { ...points[2].result, members: points[2].result.members.map(s => s.family === 'ppi' ? { ...s, status: 'expired' } : s) }
  assert.equal(describeComboActivation('weekly-labor', next.slice(1), at + 2 * day, undefined, points[1].result, hardExpiry).removed[0].reason, 'assessment-expiry')
  const simultaneous = describeComboActivation('fresh-news', [source('claims', -1, at + 7 * day)], at + 7 * day, relationships.fresh[1], points[1].result, points[2].result)
  assert.equal(simultaneous.kind, 'publication', 'A publication remains a publication even with simultaneous roll-off')
  const sector = { ...first[0], family: 'ism', participants: [first[0], next[1]] }
  const droppedSector = describeComboActivation('fresh-news', next.slice(1), at + 7 * day, { members: [sector] }, undefined, points[2].result)
  assert.deepEqual(droppedSector.removed.map(s => s.sourceId), [first[0].sourceId], 'Individual ISM participants disclose their own window roll-off')

  const markers = [0, 1, 3].map(i => ({ time: at / 1000 + i * 3600, release: { id: 'release-' + i }, symbol: 'cloud' }))
  let offset = 10
  const scale = { getVisibleRange: () => ({ from: at / 1000, to: at / 1000 + 3 * 3600 }), width: () => 500,
    timeToCoordinate: t => offset + (t - at / 1000) / 3600 * 12 }
  const clusters = projectMarkers(scale, indexMarkers(markers))
  assert.equal(clusters[0].markers.length, 2)
  const earlier = { x: 22, activation: false, publications: [{ source: { sourceId: 'release-1' }, symbol: 'cloud' }] }
  const activation = { x: 46, activation: true, publications: [{ source: { sourceId: 'release-3' }, symbol: 'cloud' }] }
  const roof = { combo: fresh[0], left: 22, right: 46, labelX: 34, lane: 1, hidden: 0, endpoints: [earlier, activation] }
  const preserved = JSON.stringify(roof)
  const aligned = alignRoofMarkers([roof], clusters)[0]
  assert.equal(aligned.endpoints[0].x, 10, 'Hollow input aligns to the cloud-count box, rather than its second concealed candle')
  assert.equal(aligned.right, 46, 'Publication activation is never moved to an older clustered release')
  assert.equal(aligned.labelX, 46, 'The combo label stays above its activation candle while grouped inputs move')
  assert.equal(JSON.stringify(roof), preserved)
  const grouped = alignRoofMarkers([{ ...roof, endpoints: [
    { x: 10, activation: false, publications: [{ source: { sourceId: 'release-0' }, symbol: 'cloud' }] }, earlier, activation,
  ] }], clusters)[0]
  assert.equal(grouped.endpoints.length, 2, 'One hollow point represents earlier inputs sharing a grouped symbol box')
  assert.deepEqual(grouped.endpoints[0].publications.map(p => p.source.sourceId), ['release-0', 'release-1'], 'Both publications remain named in the combined reading')
  offset -= 5
  const shiftedRoof = { ...roof, left: 17, right: 41, labelX: 29, endpoints: roof.endpoints.map(e => ({ ...e, x: e.x - 5 })) }
  const shifted = alignRoofMarkers([shiftedRoof], projectMarkers(scale, indexMarkers(markers)))[0]
  assert.equal(shifted.labelX, aligned.labelX - 5)
  assert.equal(shifted.lane, aligned.lane)
  const crowdedActivation = { ...roof, right: 22, endpoints: [earlier, { ...activation, x: 22, publications: [{ source: { sourceId: 'release-1' }, symbol: 'cloud' }] }] }
  assert.equal(alignRoofMarkers([crowdedActivation], clusters)[0].right, 22, 'The final circle preserves its candle even when its release belongs to an older symbol cluster')
  console.log('✓ Publication/aging/expiry provenance, named seven-day and sector roll-off, simultaneous releases, immutable scores, grouped symbol alignment, activation labels and stable pan lanes')
} finally { await server.close() }
