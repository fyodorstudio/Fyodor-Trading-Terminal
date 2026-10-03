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
    console.log('\n[Test 7] CriterionPanel study selector and USD CPI EXPERIMENTAL unfiltered render...')
    const loadingMarkup = renderToStaticMarkup(
      React.createElement(CriterionPanel, {
        study: 'experimental',
        onStudyChange: () => {},
        priorContextBars: 240,
        onPriorContextChange: () => {},
        baselineData: null,
        baselineError: null,
        baselineRule: {
          family: 'CPI', signal: 'af', panel: 'ALL', cohort: 'ALL_ELIGIBLE', horizon: 60, stop: 1, target: 1,
        },
        baselineSummary: null,
        selectedResearchEpisodeId: null,
        savedAuditNotes: [],
        onBaselineRuleChange: () => {},
        onSelectResearchEpisode: () => {},
        bundleData: null,
        bundleError: null,
        bundleRule: {
          comparison: 'CANDIDATE_1_HEADLINE_MM', panel: 'FULL_PANEL', horizon: 60, stop: 1, target: 1,
        },
        bundleSummary: null,
        selectedBundleEpisodeId: null,
        bundleNotes: [],
        onBundleRuleChange: () => {},
        onSelectBundleEpisode: () => {},
      })
    )
    assert.match(loadingMarkup, /<option value="experimental"[^>]*>USD CPI EXPERIMENTAL<\/option>/)
    assert.match(loadingMarkup, /Loading pinned CPI bundle episodes…/)

    const populatedMarkup = renderToStaticMarkup(
      React.createElement(CriterionPanel, {
        study: 'experimental',
        onStudyChange: () => {},
        priorContextBars: 240,
        onPriorContextChange: () => {},
        baselineData: null,
        baselineError: null,
        baselineRule: {
          family: 'CPI', signal: 'af', panel: 'ALL', cohort: 'ALL_ELIGIBLE', horizon: 60, stop: 1, target: 1,
        },
        baselineSummary: null,
        selectedResearchEpisodeId: null,
        savedAuditNotes: [],
        onBaselineRuleChange: () => {},
        onSelectResearchEpisode: () => {},
        bundleData: snapshot,
        bundleError: null,
        bundleRule: {
          comparison: 'CANDIDATE_1_HEADLINE_MM', panel: 'FULL_PANEL', horizon: 60, stop: 1, target: 1,
        },
        bundleSummary: null,
        selectedBundleEpisodeId: null,
        bundleNotes: [],
        onBundleRuleChange: () => {},
        onSelectBundleEpisode: () => {},
      })
    )
    assert.match(populatedMarkup, /139 total · unfiltered/)
    assert.match(populatedMarkup, /Prior context/)
    assert.match(populatedMarkup, /Expiry/)
    assert.match(populatedMarkup, /SL ATR/)
    assert.match(populatedMarkup, /TP ATR/)
    assert.doesNotMatch(populatedMarkup, /Bundle interpretation/)
    assert.doesNotMatch(populatedMarkup, /Co-release filter/)
    assert.doesNotMatch(populatedMarkup, /Matching only/)
    const episodeButtonMatches = populatedMarkup.match(/role="listitem"/g)
    assert.equal(episodeButtonMatches?.length, 139, 'Must render exactly 139 episode buttons')
    assert.match(populatedMarkup, /★ m\/m: None · y\/y: Long/) // 2025.12.18 episode where monthly readings are missing
    console.log('  ✓ Selector contains USD CPI EXPERIMENTAL')
    console.log('  ✓ Preserves SL/TP, Expiry, and Prior context controls')
    console.log('  ✓ Omits Bundle interpretation and Co-release filter')
    console.log('  ✓ Exactly 139 unfiltered episodes rendered')
    console.log('  ✓ Direction formatted with star and separate m/m and y/y Long/Short')

    // Also test CpiBundleResultPanel in experimental mode for 2025.12.18 (no trial)
    const yoyEp = snapshot.episodes.find((ep) => ep.releaseText.startsWith('2025.12.18'))
    assert.ok(yoyEp, '2025.12.18 episode must exist')
    const expResultMarkup = renderToStaticMarkup(
      React.createElement(CpiBundleResultPanel, {
        episode: yoyEp,
        trial: null,
        rule: { comparison: 'CANDIDATE_1_HEADLINE_MM', panel: 'FULL_PANEL', horizon: 60, stop: 1, target: 1 },
        note: '',
        notes: [],
        saveFailed: false,
        onNoteChange: () => {},
        onReturnLive: () => {},
        isExperimental: true,
      })
    )
    assert.match(expResultMarkup, /★ m\/m: None · y\/y: Long/)
    assert.match(expResultMarkup, /experimental-table/)
    assert.match(expResultMarkup, /m\/m Sum/)
    assert.match(expResultMarkup, /y\/y Sum/)
    assert.match(expResultMarkup, /Missing required monthly readings/)
    console.log('  ✓ CpiBundleResultPanel renders star direction badge and merged table without trade when trial is absent')

    // Test CpiBundleResultPanel in experimental mode for episode 0 (with trial)
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
    assert.match(ep0ResultMarkup, /m\/m Sum/)
    assert.match(ep0ResultMarkup, /y\/y Sum/)
    console.log('  ✓ CpiBundleResultPanel renders merged table with gross trade results and delta sums when trial is present')

    console.log('\n--- ALL PRODUCTION FRONTEND TESTS PASSED SUCCESSFULLY ---')
  } finally {
    await viteServer.close()
  }
}

runTests().catch((err) => {
  console.error('Test failed with error:', err)
  process.exit(1)
})
