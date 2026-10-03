import { useState } from 'react'
import { bundleComparisons, bundleYoyOnlyDirection, isBundleEpisodeIncluded, type BundleEpisode,
  type BundleRule, type BundleSnapshot, type BundleTrial } from '../cpi-bundle-data'
import { downloadAuditNotes, type AuditNote } from './audit-notes'
import './arrow-result-panel.css'

type Props = {
  episode: BundleEpisode | null
  trial: BundleTrial | null
  rule: BundleRule
  note: string
  notes: AuditNote[]
  saveFailed: boolean
  onNoteChange: (text: string) => void
  onReturnLive: () => void
  isExperimental?: boolean
  bundleData?: BundleSnapshot | null
  auditBars?: { time: number | string; open: number; high: number; low: number; close: number }[] | null
}

type SimulatedTrialResult = {
  direction: number
  exitKind: number
  exitH: number
  grossR: number
  dualTouch: boolean
  openingGap: boolean
}

function simulateOhlcTrial(
  entryPrice: number,
  atr: number,
  _horizon: number,
  stopAtr: number,
  targetAtr: number,
  direction: 1 | -1,
  pathBars: { open: number; high: number; low: number; close: number }[],
): SimulatedTrialResult {
  const stopDist = stopAtr * atr
  const targetDist = targetAtr * atr
  const rrRatio = targetAtr / stopAtr
  const stopPrice = direction === 1 ? entryPrice - stopDist : entryPrice + stopDist
  const targetPrice = direction === 1 ? entryPrice + targetDist : entryPrice - targetDist

  for (let idx = 0; idx < pathBars.length; idx++) {
    const bar = pathBars[idx]
    const barNum = idx + 1

    // 1. Opening gap check
    if (direction === 1) {
      if (bar.open <= stopPrice) {
        return { direction, exitKind: 1, exitH: barNum, grossR: -1.0, dualTouch: false, openingGap: true }
      }
      if (bar.open >= targetPrice) {
        return { direction, exitKind: 0, exitH: barNum, grossR: rrRatio, dualTouch: false, openingGap: true }
      }
    } else {
      if (bar.open >= stopPrice) {
        return { direction, exitKind: 1, exitH: barNum, grossR: -1.0, dualTouch: false, openingGap: true }
      }
      if (bar.open <= targetPrice) {
        return { direction, exitKind: 0, exitH: barNum, grossR: rrRatio, dualTouch: false, openingGap: true }
      }
    }

    // 2. Intrabar touch checks
    let stopTouched = false
    let targetTouched = false
    if (direction === 1) {
      if (bar.low <= stopPrice) stopTouched = true
      if (bar.high >= targetPrice) targetTouched = true
    } else {
      if (bar.high >= stopPrice) stopTouched = true
      if (bar.low <= targetPrice) targetTouched = true
    }

    if (stopTouched && targetTouched) {
      // Conservative mode: STOP_FIRST primary proxy
      return { direction, exitKind: 1, exitH: barNum, grossR: -1.0, dualTouch: true, openingGap: false }
    }
    if (stopTouched) {
      return { direction, exitKind: 1, exitH: barNum, grossR: -1.0, dualTouch: false, openingGap: false }
    }
    if (targetTouched) {
      return { direction, exitKind: 0, exitH: barNum, grossR: rrRatio, dualTouch: false, openingGap: false }
    }
  }

  // 3. Expiry / timeout at horizon
  const finalBar = pathBars[pathBars.length - 1]
  const grossR = Number((direction * (finalBar.close - entryPrice) / stopDist).toFixed(6))
  return { direction, exitKind: 2, exitH: pathBars.length, grossR, dualTouch: false, openingGap: false }
}

function reading(value: number | null) { return value == null ? '—' : Number(value.toFixed(6)).toString() }

function formatMmConcordance(raw: string): { label: string; kind: string } {
  if (raw === 'CONCORDANT_POS') return { label: 'm/m: Both Hot (+)', kind: 'neutral' }
  if (raw === 'CONCORDANT_NEG') return { label: 'm/m: Both Cool (−)', kind: 'neutral' }
  if (raw === 'CONFLICT_HEAD_POS_CORE_NEG') return { label: 'm/m: Conflict (Head + / Core −)', kind: 'conflict' }
  if (raw === 'CONFLICT_HEAD_NEG_CORE_POS') return { label: 'm/m: Conflict (Head − / Core +)', kind: 'conflict' }
  if (raw === 'HEAD_POS_CORE_ZERO') return { label: 'm/m: Head + (Core Flat)', kind: 'neutral' }
  if (raw === 'HEAD_NEG_CORE_ZERO') return { label: 'm/m: Head − (Core Flat)', kind: 'neutral' }
  if (raw === 'HEAD_ZERO_CORE_POS') return { label: 'm/m: Core + (Head Flat)', kind: 'neutral' }
  if (raw === 'HEAD_ZERO_CORE_NEG') return { label: 'm/m: Core − (Head Flat)', kind: 'neutral' }
  if (raw === 'BOTH_ZERO') return { label: 'm/m: Both Flat (0.0)', kind: 'neutral' }
  if (raw === 'MISSING_ANCHOR') return { label: 'm/m: Missing Inputs', kind: 'conflict' }
  return { label: `m/m: ${raw.replace(/_/g, ' ').toLowerCase()}`, kind: 'neutral' }
}

function deriveYyConcordance(hYy?: { delta: number | null }, cYy?: { delta: number | null }): { label: string; kind: string } {
  const h = hYy?.delta
  const c = cYy?.delta
  if (h == null || c == null) return { label: 'y/y: Incomplete', kind: 'neutral' }
  if (h > 0 && c > 0) return { label: 'y/y: Both Hot (+)', kind: 'neutral' }
  if (h < 0 && c < 0) return { label: 'y/y: Both Cool (−)', kind: 'neutral' }
  if (h > 0 && c < 0) return { label: 'y/y: Conflict (Head + / Core −)', kind: 'conflict' }
  if (h < 0 && c > 0) return { label: 'y/y: Conflict (Head − / Core +)', kind: 'conflict' }
  if (h > 0 && c === 0) return { label: 'y/y: Head + (Core Flat)', kind: 'neutral' }
  if (h < 0 && c === 0) return { label: 'y/y: Head − (Core Flat)', kind: 'neutral' }
  if (h === 0 && c > 0) return { label: 'y/y: Core + (Head Flat)', kind: 'neutral' }
  if (h === 0 && c < 0) return { label: 'y/y: Core − (Head Flat)', kind: 'neutral' }
  if (h === 0 && c === 0) return { label: 'y/y: Both Flat (0.0)', kind: 'neutral' }
  return { label: `y/y: ${h} / ${c}`, kind: 'neutral' }
}

function deriveCrossHorizonSumAlignment(dirMm: string, dirYy: string): { label: string; kind: string } {
  if (dirMm === 'Long' && dirYy === 'Long') {
    return { label: 'Sums Aligned: Long', kind: 'aligned-long' }
  }
  if (dirMm === 'Short' && dirYy === 'Short') {
    return { label: 'Sums Aligned: Short', kind: 'aligned-short' }
  }
  if ((dirMm === 'Long' && dirYy === 'Short') || (dirMm === 'Short' && dirYy === 'Long')) {
    return { label: 'Sums: Conflicting', kind: 'conflict' }
  }
  return { label: 'Sums: Neutral / Flat', kind: 'neutral' }
}

export function CpiBundleResultPanel({ episode, trial, rule, note, notes, saveFailed, onNoteChange,
  onReturnLive, isExperimental, bundleData, auditBars }: Props) {
  const [copyStatus, setCopyStatus] = useState('')
  const [prevNote, setPrevNote] = useState(note)
  const [draftNote, setDraftNote] = useState(note)
  const [justSaved, setJustSaved] = useState(false)

  if (note !== prevNote) {
    setPrevNote(note)
    setDraftNote(note)
    setJustSaved(false)
  }

  const isDirty = draftNote !== note

  const handleSaveNote = () => {
    onNoteChange(draftNote)
    setJustSaved(true)
  }

  if (!episode) return <div className="arrow-result-empty">Select a CPI bundle episode in Criterion to inspect it.</div>
  const isIncluded = Boolean(trial && isBundleEpisodeIncluded(episode, rule))
  const isExcludedClaims = Boolean(rule.panel === 'JOBLESS_CLAIMS_CLEAN' && episode.claimsCollision)
  const yoyDirection = !trial ? bundleYoyOnlyDirection(episode) : null
  const el = episode.eligibility?.[rule.comparison]
  const levels = trial && episode.entryPrice != null && episode.atr != null
    ? (isExperimental || isIncluded
        ? {
            entry: episode.entryPrice,
            stop: episode.entryPrice - trial[1] * rule.stop * episode.atr,
            target: episode.entryPrice + trial[1] * rule.target * episode.atr,
            direction: trial[1],
          }
        : null)
    : null
  const comparison = bundleComparisons.find(([id]) => id === rule.comparison)?.[1] ?? rule.comparison
  const copyNote = async () => {
    try {
      await navigator.clipboard.writeText([
        `CPI bundle / EURUSD / ${episode.releaseText} / ${comparison}`,
        `Episode: ${episode.id}`,
        `Rule: ${rule.panel}, H${rule.horizon}, SL ${rule.stop} ATR, TP ${rule.target} ATR`,
        '', draftNote,
      ].join('\n'))
      setCopyStatus('Copied')
    } catch { setCopyStatus('Copy unavailable; use Export all') }
  }

  const headlineMm = episode.readings[0]
  const coreMm = episode.readings[1]
  const headlineYy = episode.readings[2]
  const coreYy = episode.readings[3]

  const mmSum = (headlineMm?.delta != null && coreMm?.delta != null)
    ? Number((headlineMm.delta + coreMm.delta).toFixed(4))
    : null
  const yySum = (headlineYy?.delta != null && coreYy?.delta != null)
    ? Number((headlineYy.delta + coreYy.delta).toFixed(4))
    : null

  const dirMm = mmSum == null ? 'None' : mmSum < 0 ? 'Long' : mmSum > 0 ? 'Short' : 'Flat'
  const dirYy = yySum == null ? 'None' : yySum < 0 ? 'Long' : yySum > 0 ? 'Short' : 'Flat'

  const mmConcordance = formatMmConcordance(episode.concordance)
  const yyConcordance = deriveYyConcordance(headlineYy, coreYy)
  const sumAlignment = deriveCrossHorizonSumAlignment(dirMm, dirYy)

  const formatSum = (val: number | null) => (val == null ? 'None' : `${val > 0 ? '+' : ''}${val}`)

  const journalColumn = (
    <div className="arrow-result-col arrow-result-journal">
      <header className="arrow-result-col-header">
        <div className="arrow-result-header-title">
          <span className="arrow-result-eyebrow">JOURNAL &amp; THESIS</span>
        </div>
        <span className={`arrow-result-rule-chip save-status ${saveFailed ? 'failed' : isDirty ? 'unsaved' : note.trim() ? 'saved' : 'empty'}`}>
          {saveFailed ? 'Failed to save' : isDirty ? '● Unsaved' : note.trim() ? '● Saved' : 'No note'}
        </span>
      </header>
      <div className="arrow-result-journal-subbar">
        <span className="arrow-result-journal-meta">{episode.releaseText} release</span>
        <div className="arrow-result-journal-actions">
          <button
            type="button"
            className={`save-note-btn${isDirty ? ' ready' : ''}`}
            onClick={handleSaveNote}
            disabled={!isDirty}
            title={isDirty ? 'Save note (Ctrl+Enter)' : 'Note saved'}
          >
            {isDirty ? 'Save Note' : justSaved ? 'Saved' : 'Save Note'}
          </button>
          <button type="button" onClick={copyNote} disabled={!draftNote.trim()}>Copy</button>
          <button type="button" onClick={() => downloadAuditNotes(notes)} disabled={notes.length === 0}>
            Export .md{notes.length > 0 ? ` (${notes.length})` : ''}
          </button>
          {copyStatus && <span role="status">{copyStatus}</span>}
        </div>
      </div>
      <textarea
        id="bundle-audit-note"
        className="arrow-result-note"
        value={draftNote}
        onChange={(event) => {
          setDraftNote(event.target.value)
          setJustSaved(false)
        }}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && isDirty) {
            event.preventDefault()
            handleSaveNote()
          }
        }}
        placeholder="Insert note"
      />
      <div className="arrow-result-evidence-footer">
        <div className="arrow-result-caveat-line" title="Notes survive refresh in this browser only. Export Markdown to share them with Codex later.">
          <span className="arrow-result-info-icon" aria-hidden="true">ⓘ</span>
          <span className="arrow-result-caveat-text">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'} in localStorage · Export to share with Codex
          </span>
        </div>
      </div>
    </div>
  )

  if (isExperimental) {
    const episodeIndex = bundleData && episode ? bundleData.episodes.findIndex((e) => e.id === episode.id) : -1
    const cellKeyHeadline = `CANDIDATE_1_HEADLINE_MM|${rule.horizon}|${rule.stop}:${rule.target}`
    const cellKeyCore = `CANDIDATE_2_CORE_MM_LED|${rule.horizon}|${rule.stop}:${rule.target}`

    const headlineTrial = (bundleData && episodeIndex !== -1)
      ? bundleData.trials[cellKeyHeadline]?.find((t) => t[0] === episodeIndex) ?? null
      : trial
    const coreTrial = (bundleData && episodeIndex !== -1)
      ? bundleData.trials[cellKeyCore]?.find((t) => t[0] === episodeIndex) ?? null
      : null

    const dirHeadlineMm = headlineMm?.delta != null ? (headlineMm.delta < 0 ? 'Long' : headlineMm.delta > 0 ? 'Short' : 'Flat') : 'None'
    const dirCoreMm = coreMm?.delta != null ? (coreMm.delta < 0 ? 'Long' : coreMm.delta > 0 ? 'Short' : 'Flat') : 'None'
    const dirHeadlineYy = headlineYy?.delta != null ? (headlineYy.delta < 0 ? 'Long' : headlineYy.delta > 0 ? 'Short' : 'Flat') : 'None'
    const dirCoreYy = coreYy?.delta != null ? (coreYy.delta < 0 ? 'Long' : coreYy.delta > 0 ? 'Short' : 'Flat') : 'None'

    type TrialLike = BundleTrial | SimulatedTrialResult

    const formatTrialRes = (t: TrialLike | null) => {
      if (!t) return null
      const exitKind = Array.isArray(t) ? t[2] : t.exitKind
      const exitH = Array.isArray(t) ? t[3] : t.exitH
      const grossR = Array.isArray(t) ? t[4] : t.grossR
      return {
        gross: `${grossR >= 0 ? '+' : ''}${grossR.toFixed(3)} R`,
        outcome: `${exitKind === 0 ? 'TP first' : exitKind === 1 ? 'SL first' : 'Expiry'} (H${exitH})`,
        isPositive: grossR >= 0,
      }
    }

    const simulateForDirection = (dir: string): TrialLike | null => {
      if (dir !== 'Long' && dir !== 'Short') return null
      if (!auditBars || episode.entryPrice == null || episode.atr == null) return null
      const entryIdx = auditBars.findIndex((b) => Number(b.time) === episode.entryTime)
      if (entryIdx === -1) return null
      const pathBars = auditBars.slice(entryIdx, entryIdx + rule.horizon)
      if (pathBars.length === 0) return null
      return simulateOhlcTrial(
        episode.entryPrice,
        episode.atr,
        rule.horizon,
        rule.stop,
        rule.target,
        dir === 'Long' ? 1 : -1,
        pathBars,
      )
    }

    const headlineRes = formatTrialRes(headlineTrial ?? simulateForDirection(dirHeadlineMm))
    const coreRes = formatTrialRes(coreTrial ?? simulateForDirection(dirCoreMm))
    const headlineYyRes = formatTrialRes(simulateForDirection(dirHeadlineYy))
    const coreYyRes = formatTrialRes(simulateForDirection(dirCoreYy))
    const summaryRes = formatTrialRes(trial ?? simulateForDirection(dirMm))
    const yySumRes = formatTrialRes(simulateForDirection(dirYy))

    const relParts = episode.releaseText.trim().split(/\s+/)
    const entParts = episode.entryText.trim().split(/\s+/)
    const episodeDate = relParts[0] ?? ''
    const releaseTime = relParts[1]?.slice(0, 5) ?? episode.releaseText
    const entryTime = entParts[1]?.slice(0, 5) ?? episode.entryText

    return (
      <section className="arrow-result-panel experimental-merged" aria-label="USD CPI experimental result table">
        <div className="arrow-result-col experimental-main-col">
          <header className="arrow-result-col-header experimental-header-unified">
            <div className="arrow-result-identity">
              <strong>US CPI <span>EURUSD</span></strong>
              <span className="arrow-result-direction neutral">
                ★ m/m: {dirMm} · y/y: {dirYy}
              </span>
            </div>

            <div className="experimental-header-meta">
              <div className="experimental-header-dates">
                <span className="date-tag"><b>{episodeDate}</b></span>
                <span>·</span>
                <span>Release: <b>{releaseTime}</b></span>
                <span>·</span>
                <span>Entry: <b>{entryTime}</b></span>
              </div>
              <div className="experimental-levels-pills">
                <span>ENTRY: <b>{episode.entryPrice?.toFixed(5) ?? '—'}</b></span>
                <span className="stop">NOMINAL SL: <b>{levels?.stop.toFixed(5) ?? '—'}</b> ({rule.stop} ATR)</span>
                <span className="target">NOMINAL TP: <b>{levels?.target.toFixed(5) ?? '—'}</b> ({rule.target} ATR)</span>
              </div>
            </div>
          </header>

          <div className="experimental-table-container">
            <table className="experimental-table" aria-label="Release readings, direction, and gross trade result">
              <thead>
                <tr>
                  <th className="th-series">Series</th>
                  <th className="th-num">A</th>
                  <th className="th-num">P</th>
                  <th className="th-num">A−P</th>
                  <th className="th-dir">Direction</th>
                  <th className="th-result">Gross Result (H{rule.horizon} · SL {rule.stop} · TP {rule.target})</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Headline m/m</strong></td>
                  <td className="td-num">{reading(headlineMm?.actual)}</td>
                  <td className="td-num">{reading(headlineMm?.previous)}</td>
                  <td className={`td-num ${headlineMm?.delta != null && headlineMm.delta > 0 ? 'positive' : headlineMm?.delta != null && headlineMm.delta < 0 ? 'negative' : ''}`}>
                    {headlineMm?.delta != null && headlineMm.delta > 0 ? '+' : ''}{reading(headlineMm?.delta)}
                  </td>
                  <td className="td-dir">
                    <span className={`arrow-result-direction ${dirHeadlineMm === 'Long' ? 'long' : dirHeadlineMm === 'Short' ? 'short' : 'neutral'}`}>
                      {dirHeadlineMm.toUpperCase()}
                    </span>
                  </td>
                  <td className="td-result">
                    {headlineRes ? (
                      <span className={`gross-badge ${headlineRes.isPositive ? 'positive' : 'negative'}`}>
                        <b>{headlineRes.gross}</b>
                        <span className="gross-outcome">({headlineRes.outcome})</span>
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>

                <tr>
                  <td><strong>Core m/m</strong></td>
                  <td className="td-num">{reading(coreMm?.actual)}</td>
                  <td className="td-num">{reading(coreMm?.previous)}</td>
                  <td className={`td-num ${coreMm?.delta != null && coreMm.delta > 0 ? 'positive' : coreMm?.delta != null && coreMm.delta < 0 ? 'negative' : ''}`}>
                    {coreMm?.delta != null && coreMm.delta > 0 ? '+' : ''}{reading(coreMm?.delta)}
                  </td>
                  <td className="td-dir">
                    <span className={`arrow-result-direction ${dirCoreMm === 'Long' ? 'long' : dirCoreMm === 'Short' ? 'short' : 'neutral'}`}>
                      {dirCoreMm.toUpperCase()}
                    </span>
                  </td>
                  <td className="td-result">
                    {coreRes ? (
                      <span className={`gross-badge ${coreRes.isPositive ? 'positive' : 'negative'}`}>
                        <b>{coreRes.gross}</b>
                        <span className="gross-outcome">({coreRes.outcome})</span>
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>

                <tr>
                  <td><strong>Headline y/y</strong></td>
                  <td className="td-num">{reading(headlineYy?.actual)}</td>
                  <td className="td-num">{reading(headlineYy?.previous)}</td>
                  <td className={`td-num ${headlineYy?.delta != null && headlineYy.delta > 0 ? 'positive' : headlineYy?.delta != null && headlineYy.delta < 0 ? 'negative' : ''}`}>
                    {headlineYy?.delta != null && headlineYy.delta > 0 ? '+' : ''}{reading(headlineYy?.delta)}
                  </td>
                  <td className="td-dir">
                    <span className={`arrow-result-direction ${dirHeadlineYy === 'Long' ? 'long' : dirHeadlineYy === 'Short' ? 'short' : 'neutral'}`}>
                      {dirHeadlineYy.toUpperCase()}
                    </span>
                  </td>
                  <td className="td-result">
                    {headlineYyRes ? (
                      <span className={`gross-badge ${headlineYyRes.isPositive ? 'positive' : 'negative'}`}>
                        <b>{headlineYyRes.gross}</b>
                        <span className="gross-outcome">({headlineYyRes.outcome})</span>
                      </span>
                    ) : (
                      <span className="text-muted">{dirHeadlineYy === 'Flat' ? '— (Zero Change)' : '—'}</span>
                    )}
                  </td>
                </tr>

                <tr>
                  <td><strong>Core y/y</strong></td>
                  <td className="td-num">{reading(coreYy?.actual)}</td>
                  <td className="td-num">{reading(coreYy?.previous)}</td>
                  <td className={`td-num ${coreYy?.delta != null && coreYy.delta > 0 ? 'positive' : coreYy?.delta != null && coreYy.delta < 0 ? 'negative' : ''}`}>
                    {coreYy?.delta != null && coreYy.delta > 0 ? '+' : ''}{reading(coreYy?.delta)}
                  </td>
                  <td className="td-dir">
                    <span className={`arrow-result-direction ${dirCoreYy === 'Long' ? 'long' : dirCoreYy === 'Short' ? 'short' : 'neutral'}`}>
                      {dirCoreYy.toUpperCase()}
                    </span>
                  </td>
                  <td className="td-result">
                    {coreYyRes ? (
                      <span className={`gross-badge ${coreYyRes.isPositive ? 'positive' : 'negative'}`}>
                        <b>{coreYyRes.gross}</b>
                        <span className="gross-outcome">({coreYyRes.outcome})</span>
                      </span>
                    ) : (
                      <span className="text-muted">{dirCoreYy === 'Flat' ? '— (Zero Change)' : '—'}</span>
                    )}
                  </td>
                </tr>

                <tr className="sum-row">
                  <td><strong>m/m Sum</strong></td>
                  <td className="td-num">—</td>
                  <td className="td-num">—</td>
                  <td className={`td-num ${mmSum != null && mmSum > 0 ? 'positive' : mmSum != null && mmSum < 0 ? 'negative' : ''}`}>
                    {formatSum(mmSum)}
                  </td>
                  <td className="td-dir">
                    <span className={`arrow-result-direction ${dirMm === 'Long' ? 'long' : dirMm === 'Short' ? 'short' : 'neutral'}`}>
                      {dirMm.toUpperCase()}
                    </span>
                  </td>
                  <td className="td-result">
                    {summaryRes ? (
                      <span className={`gross-badge ${summaryRes.isPositive ? 'positive' : 'negative'}`}>
                        <b>{summaryRes.gross}</b>
                        <span className="gross-outcome">({summaryRes.outcome})</span>
                      </span>
                    ) : (
                      <span className="text-muted">{el?.reason ?? '—'}</span>
                    )}
                  </td>
                </tr>

                <tr className="sum-row">
                  <td><strong>y/y Sum</strong></td>
                  <td className="td-num">—</td>
                  <td className="td-num">—</td>
                  <td className={`td-num ${yySum != null && yySum > 0 ? 'positive' : yySum != null && yySum < 0 ? 'negative' : ''}`}>
                    {formatSum(yySum)}
                  </td>
                  <td className="td-dir">
                    <span className={`arrow-result-direction ${dirYy === 'Long' ? 'long' : dirYy === 'Short' ? 'short' : 'neutral'}`}>
                      {dirYy.toUpperCase()}
                    </span>
                  </td>
                  <td className="td-result">
                    {yySumRes ? (
                      <span className={`gross-badge ${yySumRes.isPositive ? 'positive' : 'negative'}`}>
                        <b>{yySumRes.gross}</b>
                        <span className="gross-outcome">({yySumRes.outcome})</span>
                      </span>
                    ) : (
                      <span className="text-muted">{dirYy === 'Flat' ? '— (Zero Change)' : '—'}</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="arrow-result-col arrow-result-journal">
          <div className="arrow-result-col-header">
            <div className="arrow-result-header-title">
              <span className="arrow-result-eyebrow">Trader&apos;s Notebook</span>
              <strong>Audit Note</strong>
              <span
                className="arrow-result-info-icon header-info-icon"
                tabIndex={0}
                role="img"
                aria-label="Simulation and notes details"
                title={`V3 OHLC simulation · nominal lines · ${episode.id}\n${notes.length} ${notes.length === 1 ? 'note' : 'notes'} in localStorage · Export to share with Codex`}
              >
                ⓘ
              </span>
            </div>
            <div className="arrow-result-journal-actions">
              <button
                type="button"
                className={`save-note-btn${isDirty ? ' ready' : ''}`}
                onClick={handleSaveNote}
                disabled={!isDirty}
                title={isDirty ? 'Save note (Ctrl+Enter)' : 'Note saved'}
              >
                {isDirty ? 'Save Note' : justSaved ? 'Saved' : 'Save Note'}
              </button>
              <button type="button" onClick={copyNote} disabled={!draftNote.trim()}>Copy</button>
              <button type="button" onClick={() => downloadAuditNotes(notes)} disabled={notes.length === 0}>
                Export .md{notes.length > 0 ? ` (${notes.length})` : ''}
              </button>
              {copyStatus && <span role="status">{copyStatus}</span>}
            </div>
          </div>
          <div className="arrow-result-journal-subbar">
            <span className="arrow-result-journal-meta">{episode.releaseText} release</span>
          </div>
          <textarea
            id="bundle-audit-note-experimental"
            className="arrow-result-note"
            value={draftNote}
            onChange={(event) => {
              setDraftNote(event.target.value)
              setJustSaved(false)
            }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && isDirty) {
                event.preventDefault()
                handleSaveNote()
              }
            }}
            placeholder="Insert note"
          />

          <div className="arrow-result-flags-row">
            <span className="arrow-result-flags-label">FLAGS</span>
            <div className="arrow-result-flags">
              <span className={sumAlignment.kind}>{sumAlignment.label}</span>
              <span className={mmConcordance.kind}>{mmConcordance.label}</span>
              <span className={yyConcordance.kind}>{yyConcordance.label}</span>
              {episode.claimsCollision ? (
                <span>Simultaneous Jobless Claims</span>
              ) : (
                <span>No simultaneous Jobless Claims</span>
              )}
              {yoyDirection && <span>Missing Monthly CPI</span>}
              {Boolean(trial?.[5]) && <span>Same-Bar Dual Touch</span>}
              {Boolean(trial?.[6]) && <span>Opening Gap</span>}
            </div>
          </div>
        </div>
      </section>
    )
  }

  return <section className="arrow-result-panel" aria-label="CPI bundle arrow result">
    <div className="arrow-result-col arrow-result-setup">
      <header className="arrow-result-col-header">
        <div className="arrow-result-identity">
          <strong>US CPI <span>EURUSD</span></strong>
          <span className={`arrow-result-direction ${
            isIncluded ? (trial![1] > 0 ? 'long' : 'short')
            : trial && isExcludedClaims ? 'neutral excluded'
            : yoyDirection ? 'neutral context'
            : 'neutral'
          }`}>
            {isIncluded && trial
              ? (trial[1] > 0 ? '↑ LONG' : '↓ SHORT')
              : trial && isExcludedClaims
              ? `${trial[1] > 0 ? '↑ LONG' : '↓ SHORT'} (EXCLUDED)`
              : yoyDirection
              ? `${yoyDirection === 'long' ? '↑' : '↓'} YOY CONTEXT`
              : el?.category === 'ZERO_CHANGE'
              ? 'ZERO MONTHLY Δ'
              : el?.category === 'CONFLICT_REJECTED'
              ? 'CONFLICT REJECTED'
              : el?.category === 'NON_CONFLICT'
              ? 'NONCONFLICTING'
              : el?.category === 'MISSING_INPUTS'
              ? 'MISSING INPUTS'
              : el?.category === 'COVERAGE_FAILURE'
              ? 'COVERAGE FAILURE'
              : 'OUTSIDE RULE'}
          </span>
        </div>
        <button className="arrow-result-text-button" type="button" onClick={onReturnLive}>Return to live</button>
      </header>
      <div className="arrow-result-meta">{episode.releaseText} release · {episode.entryText} research entry · server clock</div>
      <div className="bundle-readings" aria-label="Four same-time CPI readings">
        <div className="bundle-reading-head"><span>Series</span><span>A</span><span>P</span><span>A−P</span></div>
        {episode.readings.map((item) => <div className="bundle-reading-row" key={item.name}>
          <strong>{item.name}</strong><span>{reading(item.actual)}</span><span>{reading(item.previous)}</span>
          <span className={item.delta != null && item.delta > 0 ? 'positive' : item.delta != null && item.delta < 0 ? 'negative' : ''}>
            {item.delta != null && item.delta > 0 ? '+' : ''}{reading(item.delta)}</span>
        </div>)}
        <div className="bundle-reading-row bundle-reading-sum">
          <strong>m/m Sum</strong>
          <span></span>
          <span></span>
          <span className={mmSum != null && mmSum > 0 ? 'positive' : mmSum != null && mmSum < 0 ? 'negative' : ''}>
            {formatSum(mmSum)}
          </span>
        </div>
        <div className="bundle-reading-row bundle-reading-sum">
          <strong>y/y Sum</strong>
          <span></span>
          <span></span>
          <span className={yySum != null && yySum > 0 ? 'positive' : yySum != null && yySum < 0 ? 'negative' : ''}>
            {formatSum(yySum)}
          </span>
        </div>
      </div>
      <div className="arrow-result-levels horizontal">
        <span><small>ENTRY</small><b>{episode.entryPrice?.toFixed(5) ?? '—'}</b></span>
        <span className="stop"><small>NOMINAL SL</small><b>{levels?.stop.toFixed(5) ?? '—'}</b></span>
        <span className="target"><small>NOMINAL TP</small><b>{levels?.target.toFixed(5) ?? '—'}</b></span>
      </div>
    </div>
    <div className="arrow-result-col arrow-result-evidence">
      <header className="arrow-result-col-header">
        <div className="arrow-result-header-title">
          <span className="arrow-result-eyebrow">INTERPRETATION ·</span>
          <strong>{comparison}</strong>
        </div>
        <span className="arrow-result-rule-chip">A−P · H{rule.horizon}</span>
      </header>
      {isIncluded && trial ? (
        <div className="arrow-result-outcome feed">
          <div className="arrow-result-outcome-top">
            <strong className="arrow-result-exit-title">
              {trial[2] === 0 ? 'TP first' : trial[2] === 1 ? 'SL first' : 'Expiry'} (H{trial[3]})
            </strong>
            <b className={`arrow-result-gross ${trial[4] >= 0 ? 'positive' : 'negative'}`}>
              {trial[4] >= 0 ? '+' : ''}{trial[4].toFixed(3)} R
            </b>
          </div>
          <div className="arrow-result-outcome-bottom">
            <span>SL {rule.stop} ATR · TP {rule.target} ATR</span>
            <span className="arrow-result-outcome-sublabel">Gross R</span>
          </div>
        </div>
      ) : trial && isExcludedClaims ? (
        <div className="arrow-result-outcome feed excluded-selection">
          <div className="arrow-result-outcome-top">
            <strong className="arrow-result-exit-title" style={{ fontSize: '11px', color: 'var(--negative)' }}>
              Excluded from current selection
            </strong>
            <b className="arrow-result-gross excluded">
              {trial[4] >= 0 ? '+' : ''}{trial[4].toFixed(3)} R
            </b>
          </div>
          <div className="arrow-result-outcome-bottom">
            <span>Historical trial: {trial[2] === 0 ? 'TP first' : trial[2] === 1 ? 'SL first' : 'Expiry'} (H{trial[3]}) · Not counted</span>
            <span className="arrow-result-outcome-sublabel">Gross historical R</span>
          </div>
        </div>
      ) : yoyDirection ? (
        <div className="arrow-result-no-trade">
          Both available y/y A−P readings {yoyDirection === 'long' ? 'cooled, suggesting EURUSD up' : 'rose, suggesting EURUSD down'} as context only.
          The selected six rules require m/m readings, which are absent here. No y/y trial, ATR stop/target, or result was calculated.
          {isExcludedClaims && ' Simultaneous Jobless Claims co-release is also excluded under the current filter setting.'}
        </div>
      ) : (
        <div className="arrow-result-no-trade">
          <strong>{el?.reason ?? 'This episode does not qualify for the selected m/m rule; no priced result was calculated.'}</strong>
          {isExcludedClaims && (
            <p className="arrow-result-no-trade-extra" style={{ margin: '6px 0 0', color: 'var(--negative)' }}>
              Simultaneous Jobless Claims co-release is also excluded under the current filter setting.
            </p>
          )}
        </div>
      )}
      <div className="arrow-result-flags-row">
        <span className="arrow-result-flags-label">FLAGS</span>
        <div className="arrow-result-flags">
          <span className={sumAlignment.kind}>{sumAlignment.label}</span>
          <span className={mmConcordance.kind}>{mmConcordance.label}</span>
          <span className={yyConcordance.kind}>{yyConcordance.label}</span>
          {episode.claimsCollision ? (
            <span className={isExcludedClaims ? 'excluded' : ''}>
              {isExcludedClaims ? 'Excluded: Simultaneous Jobless Claims' : 'Simultaneous Jobless Claims'}
            </span>
          ) : (
            <span>No simultaneous Jobless Claims</span>
          )}
          {yoyDirection && <span>Missing Monthly CPI</span>}
          {yoyDirection && <span>YoY Direction Only</span>}
          {trial && isExcludedClaims && <span className="excluded">Excluded from current selection</span>}
          {!isIncluded && !trial && el?.category && el.category !== 'ELIGIBLE' && (
            <span className="coverage-flag">
              {el.category === 'ZERO_CHANGE'
                ? 'Zero monthly A−P change'
                : el.category === 'CONFLICT_REJECTED'
                ? 'Headline/Core Conflict'
                : el.category === 'NON_CONFLICT'
                ? 'Nonconflicting Release'
                : el.category === 'MISSING_INPUTS'
                ? 'Missing Monthly Anchor'
                : 'Coverage Failure'}
            </span>
          )}
          {Boolean(trial?.[5]) && <span>Same-Bar Dual Touch</span>}
          {Boolean(trial?.[6]) && <span>Opening Gap</span>}
        </div>
      </div>
      <div className="arrow-result-evidence-footer">
        <div className="arrow-result-caveat-line" title="V3 historical exploration, not a registered setup. Four CPI readings share one release. Exported Previous may be revised; gross OHLC outcomes exclude costs. SL/TP lines are nominal, not broker fills.">
          <span className="arrow-result-info-icon" aria-hidden="true">ⓘ</span>
          <span className="arrow-result-caveat-text">V3 OHLC simulation · nominal lines · <code className="arrow-result-id">{episode.id}</code></span>
        </div>
      </div>
    </div>
    {journalColumn}
  </section>
}
