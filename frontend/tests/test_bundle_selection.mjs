import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

async function runTests() {
  console.log('--- Starting USD CPI Bundle Production Behavior & Component Tests ---')
  const viteServer = await createServer({
    root: rootDir,
    server: { middlewareMode: true },
  })

  try {
    const bundleDataModule = await viteServer.ssrLoadModule('./src/criterion/cpi-bundle-data.ts')
    const resultPanelModule = await viteServer.ssrLoadModule('./src/criterion/arrow-result/CpiBundleResultPanel.tsx')
    const criterionPanelModule = await viteServer.ssrLoadModule('./src/criterion/criterion-dock/CriterionPanel.tsx')
    const notesModule = await viteServer.ssrLoadModule('./src/criterion/arrow-result/audit-notes.ts')
    const timelineTableModule = await viteServer.ssrLoadModule('./src/criterion/timeline/CpiEventTimelineTable.tsx')
    const timelineResultPanelModule = await viteServer.ssrLoadModule('./src/criterion/arrow-result/TimelineResultPanel.tsx')

    const {
      getBundleCellTrials,
      getBundleEpisodeInclusion,
      deriveBundleChartArrows,
      deriveBundlePriceLevels,
      deriveNextBundleSelection,
      validateBundleSelection,
    } = bundleDataModule

    const { CpiBundleResultPanel } = resultPanelModule
    const { CriterionPanel } = criterionPanelModule
    const { auditNoteKey } = notesModule
    const { CpiEventTimelineTable } = timelineTableModule
    const { TimelineResultPanel } = timelineResultPanelModule

    const snapshotPath = path.resolve(rootDir, 'public/criterion/eurusd_cpi_bundle_v3.json')
    const snapshotRaw = fs.readFileSync(snapshotPath, 'utf-8')
    const snapshot = JSON.parse(snapshotRaw)

    console.log(`Loaded snapshot with ${snapshot.episodes.length} episodes and ${Object.keys(snapshot.trials).length} trial cells.`)

    // ---------------------------------------------------------------------------------
    // TEST 1: Reproduction & Historical Execution Flags on Excluded Trials (Finding 1)
    // ---------------------------------------------------------------------------------
    console.log('\n[Test 1] Historical execution flags on excluded historical trials (reproduction 2018.05.10)...')
    const ep2018Index = snapshot.episodes.findIndex((e) => e.releaseText.startsWith('2018.05.10'))
    assert.notEqual(ep2018Index, -1, '2018.05.10 episode must exist in snapshot')
    const ep2018 = snapshot.episodes[ep2018Index]
    assert.equal(ep2018.claimsCollision, true, '2018.05.10 must be a Jobless Claims collision')

    const fullRule = {
      comparison: 'CANDIDATE_1_HEADLINE_MM',
      panel: 'FULL_PANEL',
      horizon: 60,
      stop: 1,
      target: 1,
    }
    const cleanRule = {
      ...fullRule,
      panel: 'JOBLESS_CLAIMS_CLEAN',
    }

    const fullInclusion = getBundleEpisodeInclusion(snapshot, ep2018Index, fullRule)
    assert.equal(fullInclusion.isEligible, true)
    assert.equal(fullInclusion.isIncluded, true)
    assert.notEqual(fullInclusion.trial, null)
    assert.equal(fullInclusion.trial[5], true, '2018.05.10 trial must have dualTouch=true')

    const cleanInclusion = getBundleEpisodeInclusion(snapshot, ep2018Index, cleanRule)
    assert.equal(cleanInclusion.isEligible, true)
    assert.equal(cleanInclusion.isClaimsExcluded, true)
    assert.equal(cleanInclusion.isIncluded, false)
    assert.notEqual(cleanInclusion.trial, null, 'Historical trial data must be preserved on excluded episode')
    assert.equal(cleanInclusion.trial[5], true, 'Historical trial dualTouch must remain true')

    // Render CpiBundleResultPanel with cleanRule (excluded by Claims)
    const cleanMarkup = renderToStaticMarkup(
      React.createElement(CpiBundleResultPanel, {
        episode: ep2018,
        trial: cleanInclusion.trial,
        rule: cleanRule,
        note: '',
        notes: [],
        saveFailed: false,
        onNoteChange: () => {},
        onReturnLive: () => {},
      })
    )

    // Verify finding 1: Same-Bar Dual Touch must be displayed even though isIncluded is false
    assert.match(
      cleanMarkup,
      /Same-Bar Dual Touch/,
      'FAIL: CpiBundleResultPanel must render "Same-Bar Dual Touch" for excluded historical trial'
    )

    // Verify outcome is labeled "Gross historical R"
    assert.match(
      cleanMarkup,
      /Gross historical R/,
      'FAIL: CpiBundleResultPanel must label excluded outcome as "Gross historical R"'
    )

    // Verify explicit exclusion title
    assert.match(
      cleanMarkup,
      /Excluded from current selection/,
      'FAIL: CpiBundleResultPanel must display "Excluded from current selection"'
    )

    // Verify nominal SL / TP levels are removed (display '—')
    assert.match(
      cleanMarkup,
      /<small>NOMINAL SL<\/small><b>—<\/b>/,
      'FAIL: Excluded historical trial must not display nominal SL line price'
    )
    assert.match(
      cleanMarkup,
      /<small>NOMINAL TP<\/small><b>—<\/b>/,
      'FAIL: Excluded historical trial must not display nominal TP line price'
    )
    console.log('  ✓ 2018.05.10 renders Same-Bar Dual Touch and Gross historical R while explicitly excluded')

    // ---------------------------------------------------------------------------------
    // TEST 2: Production Selection & Arrow Derivations (Finding 2)
    // ---------------------------------------------------------------------------------
    console.log('\n[Test 2] Selected priced Claims episode becoming excluded...')
    const dummyAuditBars = [
      { time: 1525900000 },
      { time: ep2018.entryTime },
      { time: 1526100000 },
    ]

    // 2a. Under FULL_PANEL: has arrow and nominal levels
    const fullValidated = validateBundleSelection(snapshot, fullRule)
    const fullSelection = { episode: ep2018, trial: fullInclusion.trial }
    const fullArrows = deriveBundleChartArrows(snapshot, fullRule, dummyAuditBars, fullSelection, fullValidated.trials)
    const fullLevels = deriveBundlePriceLevels(snapshot, fullRule, fullSelection)

    assert.equal(
      fullArrows.some((a) => a.id === `bundle:${ep2018.id}`),
      true,
      'Full panel must plot trade arrow for 2018.05.10'
    )
    assert.notEqual(fullLevels, null, 'Full panel must derive nominal price levels for 2018.05.10')

    // 2b. Switching to JOBLESS_CLAIMS_CLEAN:
    const nextSelection = deriveNextBundleSelection(snapshot, cleanRule, fullSelection)
    assert.equal(nextSelection.episode.id, ep2018.id, 'Selected episode must be preserved on filter change')
    assert.notEqual(nextSelection.trial, null, 'Historical trial reference must remain accessible')

    const cleanValidated = validateBundleSelection(snapshot, cleanRule)
    const cleanArrows = deriveBundleChartArrows(snapshot, cleanRule, dummyAuditBars, nextSelection, cleanValidated.trials)
    const cleanLevels = deriveBundlePriceLevels(snapshot, cleanRule, nextSelection)

    assert.equal(
      cleanArrows.some((a) => a.id === `bundle:${ep2018.id}`),
      false,
      'Trade arrow MUST be removed for excluded episode under clean panel'
    )
    assert.equal(
      cleanLevels,
      null,
      'SL/TP nominal overlay levels MUST be null for excluded episode under clean panel'
    )

    // Note key preservation
    const noteKeyBefore = auditNoteKey(snapshot.sourceSha256, 'CPI_BUNDLE', fullRule.comparison, ep2018.id)
    const noteKeyAfter = auditNoteKey(snapshot.sourceSha256, 'CPI_BUNDLE', cleanRule.comparison, nextSelection.episode.id)
    assert.equal(noteKeyBefore, noteKeyAfter, 'Saved-note identity key must be strictly preserved across Claims filter changes')
    console.log('  ✓ Arrow and SL/TP overlays cleanly removed; note key preserved')

    // 2c. Anti-regression check: fail if excluded arrow append is restored
    console.log('\n[Test 2c] Anti-regression: verify test fails if excluded-selected arrow append is simulated...')
    const buggyArrowAppend = [...cleanArrows]
    if (nextSelection.trial && !buggyArrowAppend.some((a) => a.id === `bundle:${nextSelection.episode.id}`)) {
      buggyArrowAppend.push({
        id: `bundle:${nextSelection.episode.id}`,
        time: nextSelection.episode.entryTime,
        entryPrice: nextSelection.episode.entryPrice,
        direction: nextSelection.trial[1] > 0 ? 'long' : 'short',
      })
    }
    assert.equal(
      buggyArrowAppend.some((a) => a.id === `bundle:${ep2018.id}`),
      true,
      'Sanity check: buggy arrow append would have included the excluded episode'
    )
    // Production function does NOT append it:
    assert.equal(
      cleanArrows.some((a) => a.id === `bundle:${ep2018.id}`),
      false,
      'Production deriveBundleChartArrows strictly excludes the excluded selected episode'
    )
    console.log('  ✓ Exclusion guard prevents excluded selected episode arrow append')

    // ---------------------------------------------------------------------------------
    // TEST 3: Interpretation Changes & Restoration (Finding 2)
    // ---------------------------------------------------------------------------------
    console.log('\n[Test 3] Interpretation changes making episode ineligible and restoration...')
    // Switch to CANDIDATE_3_CONCORDANT_MM (2018.05.10 headline/core conflict, so ineligible)
    const concordantRule = {
      ...fullRule,
      comparison: 'CANDIDATE_3_CONCORDANT_MM',
    }
    const ineligibleSelection = deriveNextBundleSelection(snapshot, concordantRule, fullSelection)
    assert.equal(ineligibleSelection.episode.id, ep2018.id, 'Episode inspection preserved')
    assert.equal(ineligibleSelection.trial, null, 'Trial must be null under ineligible interpretation')

    const concordantValidated = validateBundleSelection(snapshot, concordantRule)
    const concordantArrows = deriveBundleChartArrows(snapshot, concordantRule, dummyAuditBars, ineligibleSelection, concordantValidated.trials)
    const concordantLevels = deriveBundlePriceLevels(snapshot, concordantRule, ineligibleSelection)

    assert.equal(concordantArrows.some((a) => a.id === `bundle:${ep2018.id}`), false)
    assert.equal(concordantLevels, null)

    // Render result panel for ineligible selection
    const ineligibleMarkup = renderToStaticMarkup(
      React.createElement(CpiBundleResultPanel, {
        episode: ineligibleSelection.episode,
        trial: ineligibleSelection.trial,
        rule: concordantRule,
        note: '',
        notes: [],
        saveFailed: false,
        onNoteChange: () => {},
        onReturnLive: () => {},
      })
    )
    assert.match(ineligibleMarkup, /Headline\/core conflict rejected by this interpretation/)
    assert.match(ineligibleMarkup, /CONFLICT REJECTED/)

    // Switch back to CANDIDATE_1_HEADLINE_MM:
    const restoredSelection = deriveNextBundleSelection(snapshot, fullRule, ineligibleSelection)
    assert.equal(restoredSelection.episode.id, ep2018.id)
    assert.notEqual(restoredSelection.trial, null, 'Trial must be restored when rule becomes eligible again')
    assert.equal(restoredSelection.trial[0], ep2018Index)

    const restoredLevels = deriveBundlePriceLevels(snapshot, fullRule, restoredSelection)
    assert.notEqual(restoredLevels, null, 'Levels must be restored when rule becomes eligible again')
    console.log('  ✓ Ineligibility clears trial/levels; switching back restores them')

    // ---------------------------------------------------------------------------------
    // TEST 4: YoY Context Episode Invariants (Finding 2)
    // ---------------------------------------------------------------------------------
    console.log('\n[Test 4] YoY context episode (2025-12-18) invariants...')
    const yoyIndex = snapshot.episodes.findIndex((e) => e.releaseText.startsWith('2025.12.18'))
    assert.notEqual(yoyIndex, -1)
    const yoyEpisode = snapshot.episodes[yoyIndex]

    const yoyInclusion = getBundleEpisodeInclusion(snapshot, yoyIndex, fullRule)
    assert.equal(yoyInclusion.isEligible, false)
    assert.equal(yoyInclusion.trial, null)
    assert.equal(yoyInclusion.isIncluded, false)

    const yoySelection = deriveNextBundleSelection(snapshot, fullRule, { episode: yoyEpisode, trial: null })
    assert.equal(yoySelection.trial, null)

    const yoyLevels = deriveBundlePriceLevels(snapshot, fullRule, yoySelection)
    assert.equal(yoyLevels, null, 'YoY context must NEVER have price levels')

    const yoyAuditBars = [
      { time: 1766000000 },
      { time: yoyEpisode.entryTime },
      { time: 1766100000 },
    ]
    const yoyArrows = deriveBundleChartArrows(snapshot, fullRule, yoyAuditBars, yoySelection, fullValidated.trials)
    const yoyArrow = yoyArrows.find((a) => a.id === `bundle:${yoyEpisode.id}`)
    assert.notEqual(yoyArrow, undefined, 'Selected YoY episode should produce context arrow')
    assert.equal(yoyArrow.contextOnly, true, 'YoY arrow must be strictly contextOnly=true')

    const yoyMarkup = renderToStaticMarkup(
      React.createElement(CpiBundleResultPanel, {
        episode: yoyEpisode,
        trial: null,
        rule: fullRule,
        note: '',
        notes: [],
        saveFailed: false,
        onNoteChange: () => {},
        onReturnLive: () => {},
      })
    )
    assert.match(yoyMarkup, /YOY CONTEXT/, 'Must render YOY CONTEXT badge')
    assert.match(yoyMarkup, /No y\/y trial, ATR stop\/target, or result was calculated/)
    assert.doesNotMatch(yoyMarkup, /Gross R/)
    console.log('  ✓ 2025-12-18 YoY context never receives trade results, barriers, or nominal levels')

    // ---------------------------------------------------------------------------------
    // TEST 5: Unified Inclusion & Disagreement Detection (Finding 2)
    // ---------------------------------------------------------------------------------
    console.log('\n[Test 5] Unified inclusion and metadata/trial disagreement detection...')
    // 5a. Verify all 139 episodes across all 6 comparisons
    const comparisons = [
      'CANDIDATE_1_HEADLINE_MM',
      'CANDIDATE_2_CORE_MM_LED',
      'CANDIDATE_3_CONCORDANT_MM',
      'CANDIDATE_4_CONFLICT_FILTERED_HEADLINE',
      'CONFLICT_SUBSTUDY_A_HEADLINE',
      'CONFLICT_SUBSTUDY_B_CORE',
    ]

    for (const comp of comparisons) {
      for (const panel of ['FULL_PANEL', 'JOBLESS_CLAIMS_CLEAN']) {
        const rule = { comparison: comp, panel, horizon: 60, stop: 2, target: 2 }
        const validated = validateBundleSelection(snapshot, rule)
        let includedCount = 0
        for (let i = 0; i < snapshot.episodes.length; i++) {
          const inc = getBundleEpisodeInclusion(snapshot, i, rule)
          if (inc.isIncluded) includedCount++
        }
        assert.equal(
          includedCount,
          validated.summary.bundles,
          `Inclusion count must match validated summary bundles for ${comp} ${panel}`
        )
      }
    }

    // 5b. Disagreement detection: corrupt snapshot and ensure getBundleEpisodeInclusion throws
    const corruptSnapshot1 = JSON.parse(JSON.stringify(snapshot))
    // Artificially make an ineligible episode eligible in metadata
    corruptSnapshot1.episodes[yoyIndex].eligibility.CANDIDATE_1_HEADLINE_MM.eligible = true
    assert.throws(
      () => getBundleEpisodeInclusion(corruptSnapshot1, yoyIndex, fullRule),
      /marked eligible under CANDIDATE_1_HEADLINE_MM but has no priced trial/,
      'Must detect metadata eligible but missing trial'
    )

    const corruptSnapshot2 = JSON.parse(JSON.stringify(snapshot))
    // Artificially make an eligible episode ineligible in metadata while leaving trial
    corruptSnapshot2.episodes[ep2018Index].eligibility.CANDIDATE_1_HEADLINE_MM.eligible = false
    assert.throws(
      () => getBundleEpisodeInclusion(corruptSnapshot2, ep2018Index, fullRule),
      /marked ineligible under CANDIDATE_1_HEADLINE_MM but has a priced trial/,
      'Must detect metadata ineligible but trial present'
    )
    console.log('  ✓ Disagreement detection throws fail-closed error immediately on any discrepancy')

    // ---------------------------------------------------------------------------------
    // TEST 6: Complete Raw Trial Array Validation & Deduplication (Required Fix)
    // ---------------------------------------------------------------------------------
    console.log('\n[Test 6] Raw trial array validation, bounds checking, and deduplication...')

    const testCellKey = 'CANDIDATE_1_HEADLINE_MM|60|1:1'
    const testFullRule = {
      comparison: 'CANDIDATE_1_HEADLINE_MM',
      panel: 'FULL_PANEL',
      horizon: 60,
      stop: 1,
      target: 1,
    }
    const testCleanRule = {
      ...testFullRule,
      panel: 'JOBLESS_CLAIMS_CLEAN',
    }

    // 6a. Duplicate included trial must be rejected
    const dupIncludedSnapshot = JSON.parse(JSON.stringify(snapshot))
    const rawCellTrials = dupIncludedSnapshot.trials[testCellKey]
    rawCellTrials.push([...rawCellTrials[0]])
    assert.throws(
      () => validateBundleSelection(dupIncludedSnapshot, testFullRule),
      /contains duplicate trial for episode index/,
      'Must reject duplicate included trial in validateBundleSelection'
    )
    assert.throws(
      () => getBundleCellTrials(dupIncludedSnapshot, testFullRule),
      /contains duplicate trial for episode index/,
      'Must reject duplicate included trial in getBundleCellTrials'
    )
    console.log('  ✓ Duplicate included trial rejected fail-closed')

    // 6b. Duplicate Claims-excluded trial must be rejected before Claims filtering
    const dupClaimsSnapshot = JSON.parse(JSON.stringify(snapshot))
    const rawCellTrialsClean = dupClaimsSnapshot.trials[testCellKey]
    const claimsTrial = rawCellTrialsClean.find((t) => t[0] === ep2018Index)
    assert.notEqual(claimsTrial, undefined)
    rawCellTrialsClean.push([...claimsTrial])
    assert.throws(
      () => validateBundleSelection(dupClaimsSnapshot, testCleanRule),
      /contains duplicate trial for episode index 40/,
      'Must reject duplicate Claims-excluded trial even when panel is JOBLESS_CLAIMS_CLEAN'
    )
    assert.throws(
      () => getBundleCellTrials(dupClaimsSnapshot, testCleanRule),
      /contains duplicate trial for episode index 40/,
      'Must reject duplicate Claims-excluded trial in getBundleCellTrials'
    )
    console.log('  ✓ Duplicate Claims-excluded trial rejected fail-closed before Claims filtering')

    // 6c. Out-of-range, negative, and fractional episode indices
    const outOfRangeSnapshot = JSON.parse(JSON.stringify(snapshot))
    outOfRangeSnapshot.trials[testCellKey].push([snapshot.episodes.length + 10, -1, 1, 1, -1.0, false, false])
    assert.throws(
      () => validateBundleSelection(outOfRangeSnapshot, testFullRule),
      /has invalid episode index: 149/,
      'Must reject out-of-range episode index in trial array'
    )
    assert.throws(
      () => getBundleEpisodeInclusion(snapshot, snapshot.episodes.length + 10, testFullRule),
      /out of range/,
      'Must reject out-of-range index in getBundleEpisodeInclusion'
    )

    const negativeSnapshot = JSON.parse(JSON.stringify(snapshot))
    negativeSnapshot.trials[testCellKey].push([-1, -1, 1, 1, -1.0, false, false])
    assert.throws(
      () => validateBundleSelection(negativeSnapshot, testFullRule),
      /has invalid episode index: -1/,
      'Must reject negative episode index in trial array'
    )
    assert.throws(
      () => getBundleEpisodeInclusion(snapshot, -1, testFullRule),
      /out of range/,
      'Must reject negative index in getBundleEpisodeInclusion'
    )

    const fractionalSnapshot = JSON.parse(JSON.stringify(snapshot))
    fractionalSnapshot.trials[testCellKey].push([1.5, -1, 1, 1, -1.0, false, false])
    assert.throws(
      () => validateBundleSelection(fractionalSnapshot, testFullRule),
      /has invalid episode index: 1.5/,
      'Must reject fractional episode index in trial array'
    )
    assert.throws(
      () => getBundleEpisodeInclusion(snapshot, 1.5, testFullRule),
      /out of range/,
      'Must reject fractional index in getBundleEpisodeInclusion'
    )
    console.log('  ✓ Out-of-range, negative, and fractional episode indices rejected')

    // 6d. Unmodified valid data continuing to reconcile across all 1,872 summaries
    let reconciledCount = 0
    for (const summaryKey of Object.keys(snapshot.summaries)) {
      const [panel, comparison, horizonStr, stRatio] = summaryKey.split('|')
      const [stopStr, targetStr] = stRatio.split(':')
      const rule = {
        comparison,
        panel,
        horizon: Number(horizonStr),
        stop: Number(stopStr),
        target: Number(targetStr),
      }
      const validated = validateBundleSelection(snapshot, rule)
      assert.notEqual(validated.summary, null)
      reconciledCount++
    }
    assert.equal(reconciledCount, 1872, 'All 1,872 production summaries must reconcile')
    console.log(`  ✓ All ${reconciledCount} production selections reconciled with zero errors`)

    // ---------------------------------------------------------------------------------
    // TEST 7: Study Selector Options & Experimental Standby Rendering
    // ---------------------------------------------------------------------------------
    // ---------------------------------------------------------------------------------
    // TEST 7: Director's New Direction: "CPI & Event Timeline" Pending View & Table Structure
    // ---------------------------------------------------------------------------------
    console.log('\n[Test 7] CriterionPanel study selector and CPI & Event Timeline pending render...')
    const timelineMarkup = renderToStaticMarkup(
      React.createElement(CriterionPanel, {
        study: 'timeline',
        onStudyChange: () => {},
      })
    )

    // Verify selector contains "CPI & Event Timeline" and only that active choice
    assert.match(timelineMarkup, /<option value="timeline"[^>]*>CPI &amp; Event Timeline<\/option>/)
    assert.doesNotMatch(timelineMarkup, /CPI \/ NFP baseline V2/)
    assert.doesNotMatch(timelineMarkup, /USD CPI bundle V3/)
    assert.doesNotMatch(timelineMarkup, /USD CPI EXPERIMENTAL/)

    // Verify genuine pending state
    assert.match(timelineMarkup, /Research pending — no audited results published\./)
    assert.doesNotMatch(timelineMarkup, /Bundle interpretation/)
    assert.doesNotMatch(timelineMarkup, /Co-release filter/)
    assert.doesNotMatch(timelineMarkup, /Matching only/)
    assert.doesNotMatch(timelineMarkup, /role="listitem"/) // Zero fabricated episode list items

    console.log('  ✓ Selector contains single active choice: "CPI & Event Timeline"')
    console.log('  ✓ Selector strictly omits the three old choices')
    console.log('  ✓ Displays genuine pending state: "Research pending — no audited results published."')

    // Test TimelineResultPanel in pending state
    const resultPanelMarkup = renderToStaticMarkup(
      React.createElement(TimelineResultPanel, {
        blocks: null,
        onReturnLive: () => {},
      })
    )
    assert.match(resultPanelMarkup, /CPI &amp; Event Timeline/)
    assert.match(resultPanelMarkup, /Research pending — no audited results published\./)
    console.log('  ✓ TimelineResultPanel renders pending state without fabricated results')

    // Test CpiEventTimelineTable prepared structure with simulated release blocks
    // Test CpiEventTimelineTable prepared structure with simulated release blocks across all 4 relationships
    const sampleBlocks = [
      {
        id: 'block-before-cpi',
        family: 'German ZEW Economic Sentiment',
        currency: 'EUR',
        releaseTimestamp: 1784030000,
        releaseTimeText: '2026.07.14 12:00:00',
        relationship: 'before',
        rows: [
          { series: 'ZEW Index', actual: 41.5, previous: 47.5, delta: -6.0, direction: 'CONTEXT_ONLY', grossResult: null },
        ],
      },
      {
        id: 'block-cpi-20260714',
        family: 'Consumer Price Index',
        currency: 'USD',
        releaseTimestamp: 1784043000,
        releaseTimeText: '2026.07.14 15:30:00',
        entryTimestamp: 1784044800,
        entryTimeText: '2026.07.14 16:00:00',
        relationship: 'simultaneous',
        rows: [
          { series: 'Headline m/m', actual: -0.4, previous: 0.5, delta: -0.9, direction: 'Long', grossResult: null },
          { series: 'Core m/m', actual: 0.0, previous: 0.2, delta: -0.2, direction: 'Long', grossResult: null },
          { series: 'Headline y/y', actual: 3.5, previous: 4.2, delta: -0.7, direction: 'Long', grossResult: null },
          { series: 'Core y/y', actual: 2.6, previous: 2.9, delta: -0.3, direction: 'Long', grossResult: null },
          { series: 'm/m Sum', actual: null, previous: null, delta: -1.1, direction: 'Long', grossResult: null, isSumRow: true },
          { series: 'y/y Sum', actual: null, previous: null, delta: -1.0, direction: 'Long', grossResult: null, isSumRow: true },
          { series: 'Precision Check Series', actual: 1.002, previous: 1.010, delta: -0.008, direction: 'Long', grossResult: null },
        ],
      },
      {
        id: 'block-pre-entry-hpi',
        family: 'House Price Index',
        currency: 'USD',
        releaseTimestamp: 1784043900,
        releaseTimeText: '2026.07.14 15:45:00',
        entryTimestamp: 1784044800,
        entryTimeText: '2026.07.14 16:00:00',
        relationship: 'after_release_before_entry',
        timingUncertain: true,
        rows: [
          { series: 'HPI m/m', actual: 0.3, previous: 0.2, delta: 0.1, direction: 'CONTEXT_ONLY', grossResult: null },
        ],
      },
      {
        id: 'block-ppi-20260715',
        family: 'Producer Price Index',
        currency: 'USD',
        releaseTimestamp: 1784129400,
        releaseTimeText: '2026.07.15 15:30:00',
        entryTimestamp: 1784131200,
        entryTimeText: '2026.07.15 16:00:00',
        relationship: 'after_entry',
        rows: [
          { series: 'PPI m/m', actual: -0.3, previous: 1.1, revisedPrevious: 0.6, delta: -1.4, direction: 'CONTEXT_ONLY', grossResult: null },
        ],
      },
    ]

    const tableMarkup = renderToStaticMarkup(
      React.createElement(CpiEventTimelineTable, {
        blocks: sampleBlocks,
        horizon: 240,
        stop: 1,
        target: 1,
      })
    )
    assert.match(tableMarkup, /<th[^>]*>Series<\/th>/)
    assert.match(tableMarkup, /<th[^>]*>A<\/th>/)
    assert.match(tableMarkup, /<th[^>]*>P<\/th>/)
    assert.match(tableMarkup, /<th[^>]*>A−P<\/th>/)
    assert.match(tableMarkup, /<th[^>]*>Direction<\/th>/)
    // Parameterized header reflects actual supplied horizon/SL/TP
    assert.match(tableMarkup, /<th[^>]*>Gross Result \(H240 · SL 1 · TP 1\)<\/th>/)
    // All 4 relationship badges
    assert.match(tableMarkup, /BEFORE CPI/)
    assert.match(tableMarkup, /SIMULTANEOUS/)
    assert.match(tableMarkup, /AFTER CPI \(PRE-ENTRY, TENTATIVE\)/)
    assert.match(tableMarkup, /AFTER CPI ENTRY/)
    assert.match(tableMarkup, /TIME UNCERTAIN/)
    // Families and constituent series
    assert.match(tableMarkup, /Consumer Price Index/)
    assert.match(tableMarkup, /Producer Price Index/)
    assert.match(tableMarkup, /Headline m\/m/)
    assert.match(tableMarkup, /Core m\/m/)
    assert.match(tableMarkup, /Headline y\/y/)
    assert.match(tableMarkup, /Core y\/y/)
    assert.match(tableMarkup, /m\/m Sum/)
    assert.match(tableMarkup, /y\/y Sum/)
    // Precision: exact -0.008 delta must remain visible
    assert.match(tableMarkup, /-0\.008/)
    // Revised Previous disclosure (Rev: 0.6 alongside 1.1)
    assert.match(tableMarkup, /Rev: 0\.6/)
    console.log('  ✓ CpiEventTimelineTable renders prepared table structure: Series | A | P | A−P | Direction | Gross Result')
    console.log('  ✓ Supports all 4 timing relationships (Before, Simultaneous, Pre-Entry, After Entry) & uncertainty badge')
    console.log('  ✓ Preserves precision: exact -0.008 delta visible without truncation')
    console.log('  ✓ Discloses exported Previous and Revised Previous (Rev: 0.6)')
    console.log('  ✓ Gross Result header reflects parameterized settings: Gross Result (H240 · SL 1 · TP 1)')

    // Preserved Historical Check: CpiBundleResultPanel direct render on historical snapshot
    const ep0 = snapshot.episodes[0]
    const ep0Trial = snapshot.trials['CANDIDATE_1_HEADLINE_MM|60|1:1']?.find((t) => t[0] === 0)
    assert.ok(ep0Trial, 'Episode 0 trial must exist')
    const ep0ResultMarkup = renderToStaticMarkup(
      React.createElement(CpiBundleResultPanel, {
        episode: ep0,
        trial: ep0Trial,
        rule: { comparison: 'CANDIDATE_1_HEADLINE_MM', panel: 'FULL_PANEL', horizon: 60, stop: 1, target: 1 },
        note: '',
        notes: [],
        saveFailed: false,
        onNoteChange: () => {},
        onReturnLive: () => {},
        isExperimental: true,
        bundleData: snapshot,
      })
    )
    assert.match(ep0ResultMarkup, /★ m\/m: Long · y\/y: Long/)
    assert.match(ep0ResultMarkup, /experimental-table/)
    assert.match(ep0ResultMarkup, /-1\.000 R/)
    console.log('  ✓ Preserved historical CpiBundleResultPanel renders without error')

    console.log('\n--- ALL PRODUCTION FRONTEND TESTS PASSED SUCCESSFULLY ---')
  } finally {
    await viteServer.close()
  }
}

runTests().catch((err) => {
  console.error('Test failed with error:', err)
  process.exit(1)
})
