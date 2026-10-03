import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

export async function testReleaseSummaries({ viteServer, rootDir, manifest }) {
  const { releaseSummary, signedChange } = await viteServer.ssrLoadModule('./src/criterion/timeline/timeline-release-summary.ts')
  const { groupTimelineEvents } = await viteServer.ssrLoadModule('./src/criterion/timeline/timeline-event-view.ts')
  const load = (id) => JSON.parse(fs.readFileSync(path.join(rootDir, 'public/criterion/cpi_event_timeline_episodes', manifest.episodes[id].file), 'utf8'))
  const feb = load('CPI_TIMELINE_20250212_163000')
  const groups = groupTimelineEvents(feb.surroundingBlocks, feb.releaseTimestamp)
  const find = (country, time, id) => groups.find((group) => group.countryCode === country && group.releaseTimeText === time && group.block.rows.some((row) => row.eventId === id)).block
  const euro = find('EU', '2025.02.03 13:00:00', '999030011')
  assert.equal(euro.rows.length, 8, 'Fixture contains alternate definitions and index levels')
  const euroLines = releaseSummary(euro)
  assert.deepEqual(euroLines.map((line) => line.sum), [-2.2, 0.1])
  assert.deepEqual(euroLines.map((line) => line.assessment), ['Both lower', 'Headline higher · core unchanged'])
  assert.deepEqual(euroLines[0].values.map((value) => value.delta), [-0.7, -1.5], 'Only canonical headline/core definitions enter the sum')

  const pce = find('US', '2025.01.31 16:30:00', '840010003')
  assert.deepEqual(releaseSummary(pce).map((line) => line.sum), [0.3, 0.2], 'Monthly PCE, not quarterly GDP/PCE')
  const ppi = find('US', '2025.02.13 16:30:00', '840030001')
  assert.notEqual(ppi.rows.find((row) => row.eventId === '840030001').revisedPrevious, null)
  assert.deepEqual(releaseSummary(ppi).map((line) => line.sum), [0.5, 0.3], 'Use exported Previous, not Revised Previous')
  const german = find('DE', '2025.01.31 16:00:00', '276010020')
  assert.deepEqual(releaseSummary(german).map((line) => line.values[0].delta), [-0.6, -0.3, -0.9, 0])
  assert.ok(releaseSummary(german).every((line) => !('sum' in line)), 'CPI and HICP are not a headline/core pair')
  const ecb = groups.find((group) => group.block.rows.some((row) => row.eventId === '999010006')).block
  assert.deepEqual(releaseSummary(ecb).map((line) => [line.label, line.values[0].delta, line.assessment]), [['ECB deposit rate', -25, 'Cut']])
  const fed = groups.find((group) => group.block.rows.some((row) => row.eventId === '840050014')).block
  assert.deepEqual(releaseSummary(fed).map((line) => [line.values[0].delta, line.assessment]), [[0, 'Hold']])
  const conference = groups.find((group) => group.block.rows.some((row) => row.eventId === '999010003')).block
  assert.equal(releaseSummary(conference)[0].values.length, 0, 'Press conference guidance has no invented numeric score')
  assert.match(releaseSummary(conference)[0].assessment, /No numerical/)
  assert.equal(releaseSummary({ ...ecb, rows: ecb.rows.filter((row) => row.eventId !== '999010006') })[0].assessment, 'Incomplete', 'Do not substitute or add ECB rates')
  assert.deepEqual(releaseSummary({ ...euro, countryCode: 'US', currency: 'USD' }), [], 'Foreign catalog IDs cannot masquerade as domestic inflation')

  const mutate = (update) => ({ ...euro, rows: euro.rows.map((row) => row.eventId === '999030010' ? { ...row, ...update } : row) })
  for (const update of [{ actual: null }, { previous: '' }, { delta: 'bad' }, { delta: '0' },
    { unit: 'CALENDAR_UNIT_POINTS' }, { multiplier: 'CALENDAR_MULTIPLIER_THOUSANDS' },
    { countryCode: 'DE' }, { periodServerText: '2024.12.01 00:00:00' }, { periodServerText: null }, { isDerived: true }]) {
    const line = releaseSummary(mutate(update))[0]
    assert.equal(line.sum, null, `Invalid pair does not become a sum: ${JSON.stringify(update)}`)
    assert.equal(line.assessment, 'Incomplete')
  }
  const duplicated = { ...euro, rows: [...euro.rows, { ...euro.rows.find((row) => row.eventId === '999030010'), valueId: 'another-vintage' }] }
  assert.match(releaseSummary(duplicated)[0].reason, /Multiple readings/)
  const mixed = mutate({ actual: '0.6', previous: '0.5', delta: '0.1' })
  assert.equal(releaseSummary(mixed)[0].sum, -0.6)
  assert.equal(releaseSummary(mixed)[0].assessment, 'Mixed', 'A nonzero sum cannot hide component disagreement')
  const cancelling = mutate({ actual: '1.2', previous: '0.5', delta: '0.7' })
  assert.equal(releaseSummary(cancelling)[0].sum, 0)
  assert.equal(releaseSummary(cancelling)[0].assessment, 'Mixed', 'Opposite changes cancelling to zero are not unchanged')
  const zero = { ...euro, rows: euro.rows.map((row) => ({ ...row, actual: row.previous, delta: '0' })) }
  assert.equal(releaseSummary(zero)[0].assessment, 'Both unchanged')
  assert.equal(releaseSummary(zero)[0].sum, 0)
  assert.equal(signedChange(0.3), '+0.3')
  assert.equal(signedChange(-0), '0')

  let pairCount = 0, ambiguousCount = 0, missingCount = 0
  for (const id of Object.keys(manifest.episodes)) {
    const payload = load(id)
    const before = JSON.stringify(payload)
    const lines = releaseSummary(payload.cpiBlock)
    for (const [index, series] of ['m/m Sum', 'y/y Sum'].entries()) {
      const published = payload.cpiBlock.rows.find((row) => row.series === series)
      assert.ok(published, `${id}: published sum exists`)
      assert.equal(lines[index].sum, published.delta == null || String(published.delta).trim() === '' ? null : Number(published.delta), `${id}: matches pinned ${series}`)
    }
    for (const group of groupTimelineEvents(payload.surroundingBlocks, payload.releaseTimestamp)) {
      for (const line of releaseSummary(group.block)) {
        if (!('sum' in line)) continue
        if (line.sum !== null) {
          // Independent arithmetic on the source deltas; published payloads
          // include negative/flat/mixed, missing and revised-value cases.
          assert.equal(line.sum, Number(line.values.reduce((sum, value) => sum + value.delta, 0).toFixed(6)))
          pairCount++
        } else {
          assert.equal(line.assessment, 'Incomplete')
          if (/Multiple readings/.test(line.reason)) ambiguousCount++
          else {
            assert.match(line.reason, /Required reading is missing/)
            missingCount++
          }
        }
      }
    }
    assert.equal(JSON.stringify(payload), before, `${id}: no published readings or outcomes were mutated`)
  }
  assert.equal(pairCount, 954, 'Complete pairs in the pinned surrounding inventory')
  assert.equal(missingCount, 58, 'Older euro-area releases lack the canonical monthly core reading')
  assert.equal(ambiguousCount, 2, 'The April 2019 PCE release has two reference months, separately flagged for m/m and y/y')
  const december = releaseSummary(load('CPI_TIMELINE_20251218_163000').cpiBlock)
  assert.equal(december[0].sum, null)
  assert.equal(december[0].assessment, 'Incomplete')
  assert.notEqual(december[1].sum, null, 'Missing monthly data does not erase the annual context')
  console.log(`  ✓ Release summaries: all 140 anchor sums match publication; ${pairCount} surrounding pairs, ${missingCount} missing pairs and ${ambiguousCount} ambiguous pairs checked; policy rates, units, duplicates and missing data verified`)
}
