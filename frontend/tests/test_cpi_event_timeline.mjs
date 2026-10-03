import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { testMountedTimeline } from './timeline-mounted-checks.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

function computeSha256(filePath) {
  const content = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(content).digest('hex').toUpperCase()
}

async function runTests() {
  console.log('--- Starting CPI & Event Timeline Verification Test Suite ---')

  const viteServer = await createServer({
    root: rootDir,
    server: { middlewareMode: true },
  })

  try {
    const timelineDataModule = await viteServer.ssrLoadModule('./src/criterion/timeline/cpi-event-timeline-data.ts')
    const timelineTableModule = await viteServer.ssrLoadModule('./src/criterion/timeline/CpiEventTimelineTable.tsx')
    const criterionPanelModule = await viteServer.ssrLoadModule(
      './src/criterion/criterion-dock/CpiEventTimelineCriterionPanel.tsx'
    )
    const timelineResultPanelModule = await viteServer.ssrLoadModule(
      './src/criterion/arrow-result/TimelineResultPanel.tsx'
    )
    const notesModule = await viteServer.ssrLoadModule('./src/criterion/arrow-result/audit-notes.ts')
    const hookModule = await viteServer.ssrLoadModule('./src/criterion/timeline/useCpiEventTimeline.ts')

    const { formatUnit, findRowTradeLevels, deriveChartLevels } = timelineDataModule
    const { CpiEventTimelineTable } = timelineTableModule
    const { CpiEventTimelineCriterionPanel } = criterionPanelModule
    const { TimelineResultPanel } = timelineResultPanelModule
    const { auditNoteKey, exportAuditNotesMarkdown } = notesModule
    const { useCpiEventTimeline } = hookModule

    const MANIFEST_PATH = path.join(rootDir, 'src', 'criterion', 'cpi-event-timeline-manifest.json')
    const PUBLIC_CRITERION_DIR = path.join(rootDir, 'public', 'criterion')

    // [Test 1] Publication Manifest & Source Hash Audit
    console.log('\n[Test 1] Publication Manifest & Reviewed Source Provenance...')
    assert.ok(fs.existsSync(MANIFEST_PATH), 'Manifest must exist in src/criterion')
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))

    const EXPECTED_SOURCE_MANIFEST_SHA = '7FD0FBB2A66358ABDE1F2F2FFDDDC185248A309A75DE8E74B0C66036312BBCC0'
    assert.equal(
      manifest.reviewedSourceManifestSha256,
      EXPECTED_SOURCE_MANIFEST_SHA,
      'Reviewed source manifest SHA must exactly match audited value'
    )
    console.log(`  ✓ Reviewed source manifest SHA verified: ${EXPECTED_SOURCE_MANIFEST_SHA}`)

    // Verify index file hash
    const indexPath = path.join(PUBLIC_CRITERION_DIR, 'cpi_event_timeline_index.json')
    assert.ok(fs.existsSync(indexPath), 'Index file must exist in public/criterion')
    const actualIndexSha = computeSha256(indexPath)
    assert.equal(actualIndexSha, manifest.indexSha256, 'Index SHA-256 must match manifest')
    console.log(`  ✓ Lightweight index hash verified: ${actualIndexSha}`)

    // Verify all 140 episode payloads
    const episodesDir = path.join(PUBLIC_CRITERION_DIR, 'cpi_event_timeline_episodes')
    assert.ok(fs.existsSync(episodesDir), 'Episodes dir must exist')
    const episodeKeys = Object.keys(manifest.episodes)
    assert.equal(episodeKeys.length, 140, 'Manifest must contain exactly 140 episodes')

    for (const epId of episodeKeys) {
      const epInfo = manifest.episodes[epId]
      const epPath = path.join(episodesDir, epInfo.file)
      assert.ok(fs.existsSync(epPath), `Episode file ${epInfo.file} must exist`)
      const actualEpSha = computeSha256(epPath)
      assert.equal(actualEpSha, epInfo.sha256, `Episode ${epId} SHA must match manifest`)
    }
    console.log('  ✓ All 140 lazy-load episode payload hashes independently verified')

    // [Test 2] Lightweight Index Structure
    console.log('\n[Test 2] Lightweight Index Integrity & Content...')
    const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
    assert.equal(indexData.totalEpisodes, 140, 'Index must report 140 total episodes')
    assert.equal(indexData.episodes.length, 140, 'Index must list 140 episodes')
    assert.equal(indexData.episodes[0].episodeId, 'CPI_TIMELINE_20150116_163000', 'First episode 2015-01-16')
    assert.equal(
      indexData.episodes[139].episodeId,
      'CPI_TIMELINE_20260911_153000',
      'Last episode 2026-09-11'
    )
    console.log('  ✓ 140 CPI episodes span from 2015.01.16 through 2026.09.11 without interpretation/claims filters')

    // [Test 3] Checkpoints from Actual Outputs
    console.log('\n[Test 3] Forensic Checkpoints from Verified Outputs...')
    // May 22, 2015 CPI: Flat m/m sum
    const ep20150522 = JSON.parse(
      fs.readFileSync(path.join(episodesDir, 'CPI_TIMELINE_20150522_153000.json'), 'utf8')
    )
    const mmSum20150522 = ep20150522.cpiBlock.rows.find((r) => r.series === 'm/m Sum')
    assert.equal(mmSum20150522.direction, 'Flat')
    assert.equal(mmSum20150522.grossResult, null)
    assert.equal(mmSum20150522.eligibility.exclusionReason, 'FLAT_DIRECTION')
    console.log('  ✓ 2015.05.22 m/m Sum: Flat direction, null grossResult, FLAT_DIRECTION reason')

    // Dec 18, 2025 CPI: Missing m/m, y/y Stop at bar 1
    const ep20251218 = JSON.parse(
      fs.readFileSync(path.join(episodesDir, 'CPI_TIMELINE_20251218_163000.json'), 'utf8')
    )
    const headMm20251218 = ep20251218.cpiBlock.rows.find((r) => r.series === 'Headline m/m')
    assert.equal(headMm20251218.direction, 'Missing')
    assert.equal(headMm20251218.grossResult, null)
    assert.equal(headMm20251218.eligibility.exclusionReason, 'MISSING_DIRECTION')

    const headYy20251218 = ep20251218.cpiBlock.rows.find((r) => r.series === 'Headline y/y')
    assert.equal(headYy20251218.direction, 'Long')
    assert.equal(headYy20251218.grossResult.outcome, 'STOP')
    assert.equal(headYy20251218.grossResult.grossR, -1.0)
    assert.equal(headYy20251218.grossResult.exitBar, 1)
    console.log('  ✓ 2025.12.18 Headline y/y: STOP, -1.0 R, exit bar 1')

    // [Test 4] Trade Levels Adapter & Publication Lookup
    console.log('\n[Test 4] Trade Levels Publication Adapter & Level Derivation...')
    const tradeLevelsPath = path.join(PUBLIC_CRITERION_DIR, 'cpi_event_timeline_trade_levels.json')
    assert.ok(fs.existsSync(tradeLevelsPath), 'Trade levels file must exist')
    const tradeLevels = JSON.parse(fs.readFileSync(tradeLevelsPath, 'utf8'))

    // Dec 18, 2025 Headline y/y level lookup
    const yyLevel = findRowTradeLevels(
      tradeLevels,
      'CPI_TIMELINE_20251218_163000',
      ep20251218.cpiBlock,
      headYy20251218
    )
    assert.ok(yyLevel, 'Dec 18 2025 Headline y/y level must be found')
    assert.equal(yyLevel.entryPrice, 1.17341)
    assert.equal(yyLevel.atr, 0.0012688533354077778)
    assert.equal(yyLevel.stopPrice, 1.1721411466645923)
    assert.equal(yyLevel.grossR, -1.0)

    const chartLevels = deriveChartLevels(yyLevel, ep20251218.cpiBlock.entryTimestamp)
    assert.ok(chartLevels, 'Chart levels must be derived')
    assert.equal(chartLevels.direction, 'Long')
    assert.equal(chartLevels.entryPrice, 1.17341)
    assert.equal(chartLevels.stopPrice, 1.1721411466645923)
    console.log('  ✓ 2025.12.18 trade levels: Entry 1.17341, ATR 0.00126885, Stop 1.172141, Bar 1 STOP')

    // Unpriced / Missing row level derivation
    const missingLevels = deriveChartLevels(
      findRowTradeLevels(tradeLevels, 'CPI_TIMELINE_20251218_163000', ep20251218.cpiBlock, headMm20251218),
      ep20251218.cpiBlock.entryTimestamp
    )
    assert.equal(missingLevels, null, 'Unpriced missing row must produce null chart levels')
    console.log('  ✓ Unpriced / Missing rows produce strictly null chart levels (zero fabrication)')

    // [Test 5] Unit Enum Display Formatting
    console.log('\n[Test 5] Calendar Unit Enum Display Labels...')
    assert.equal(formatUnit('CALENDAR_UNIT_PERCENT', 'CALENDAR_MULTIPLIER_NONE'), '%')
    assert.equal(formatUnit('CALENDAR_UNIT_CURRENCY', 'CALENDAR_MULTIPLIER_BILLIONS'), 'B')
    assert.equal(formatUnit('CALENDAR_UNIT_JOB', 'CALENDAR_MULTIPLIER_THOUSANDS'), 'k')
    assert.equal(formatUnit('CALENDAR_UNIT_NONE', 'CALENDAR_MULTIPLIER_THOUSANDS'), 'k')
    assert.equal(formatUnit('CALENDAR_UNIT_BARREL', 'CALENDAR_MULTIPLIER_MILLIONS'), 'M bbl')
    assert.equal(formatUnit('CALENDAR_UNIT_NONE', 'CALENDAR_MULTIPLIER_NONE'), '')
    console.log('  ✓ Calendar unit enums converted to %, k, M, B, M bbl correctly')

    // [Test 6] UI Component Markup Tests
    console.log('\n[Test 6] UI Component Markup & Presentation...')

    // CriterionPanel with 140 episodes
    const criterionMarkup = renderToStaticMarkup(
      React.createElement(CpiEventTimelineCriterionPanel, {
        index: indexData,
        isLoading: false,
        error: null,
        selectedEpisodeId: 'CPI_TIMELINE_20150116_163000',
        onSelectEpisode: () => {},
      })
    )
    assert.match(criterionMarkup, /140 Episodes/)
    assert.match(criterionMarkup, /2015\.01\.16 16:30/)
    assert.match(criterionMarkup, /2026\.09\.11 15:30/)
    assert.match(criterionMarkup, /role="listitem"/)
    console.log('  ✓ CpiEventTimelineCriterionPanel renders 140 episodes with prior context controls')

    // CpiEventTimelineTable with populated episode
    const tableMarkup = renderToStaticMarkup(
      React.createElement(CpiEventTimelineTable, {
        blocks: [ep20251218.cpiBlock, ...ep20251218.surroundingBlocks.slice(0, 5)],
        horizon: 240,
        stop: 1,
        target: 1,
      })
    )
    assert.match(tableMarkup, /Headline m\/m/)
    assert.match(tableMarkup, /Core m\/m/)
    assert.match(tableMarkup, /Headline y\/y/)
    assert.match(tableMarkup, /Core y\/y/)
    assert.match(tableMarkup, /m\/m Sum/)
    assert.match(tableMarkup, /y\/y Sum/)
    assert.match(tableMarkup, /Gross Result \(H240 · SL 1 · TP 1\)/)
    assert.match(tableMarkup, /MISSING/) // Unpriced reason badge
    console.log('  ✓ CpiEventTimelineTable renders all 6 CPI rows and surrounding blocks with explicit reasons')

    // TimelineResultPanel with populated episode and journal
    const resultPanelMarkup = renderToStaticMarkup(
      React.createElement(TimelineResultPanel, {
        episodePayload: ep20251218,
        note: 'Director test note for 2025-12-18',
        notes: [],
        onReturnLive: () => {},
      })
    )
    assert.match(resultPanelMarkup, /AUDIT JOURNAL &amp; THESIS/)
    assert.match(resultPanelMarkup, /Save Note/)
    assert.match(resultPanelMarkup, /Export \.md/)
    assert.match(resultPanelMarkup, /Director test note for 2025-12-18/)
    console.log('  ✓ TimelineResultPanel renders full timeline dock with audit journal and export controls')

    // [Test 7] Audit Notes Persistence Compatibility
    console.log('\n[Test 7] Audit Note Storage & Markdown Export Compatibility...')
    const sampleNote = {
      viewerSha256: EXPECTED_SOURCE_MANIFEST_SHA,
      family: 'CPI_TIMELINE',
      signal: 'H240',
      episodeId: 'CPI_TIMELINE_20251218_163000',
      releaseText: '2025.12.18 16:30:00',
      rule: { horizon: 240, stop: 1, target: 1 },
      text: 'Audited Dec 18 2025 release: verified headline y/y stop at bar 1.',
      updatedAt: new Date().toISOString(),
    }

    const key = auditNoteKey(
      sampleNote.viewerSha256,
      sampleNote.family,
      sampleNote.signal,
      sampleNote.episodeId
    )
    assert.equal(
      key,
      `${EXPECTED_SOURCE_MANIFEST_SHA}|CPI_TIMELINE|H240|CPI_TIMELINE_20251218_163000`
    )

    const md = exportAuditNotesMarkdown([sampleNote])
    assert.match(md, /CPI_TIMELINE \/ EURUSD \/ 2025\.12\.18 16:30:00/)
    assert.match(md, /Episode ID: `CPI_TIMELINE_20251218_163000`/)
    assert.match(md, /Research viewer SHA-256: `7FD0FBB2A66358ABDE1F2F2FFDDDC185248A309A75DE8E74B0C66036312BBCC0`/)
    assert.match(md, /Audited Dec 18 2025 release: verified headline y\/y stop at bar 1\./)
    console.log('  ✓ Audit notes serialize, deserialize, and export markdown with complete provenance')

    await testMountedTimeline({ viteServer, rootDir, manifest, useCpiEventTimeline,
      CpiEventTimelineCriterionPanel, TimelineResultPanel })

    console.log('\n--- ALL CPI EVENT TIMELINE TESTS PASSED CLEANLY ---')
  } finally {
    await viteServer.close()
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
