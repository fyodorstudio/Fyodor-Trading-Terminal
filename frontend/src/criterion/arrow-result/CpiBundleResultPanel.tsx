import { useState } from 'react'
import { bundleComparisons, bundleExclusion, bundlePriceLevels, bundleYoyOnlyDirection, type BundleEpisode,
  type BundleRule, type BundleTrial } from '../cpi-bundle-data'
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
}

function reading(value: number | null) { return value == null ? '—' : Number(value.toFixed(6)).toString() }
function formatFlag(text: string) {
  return text.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

export function CpiBundleResultPanel({ episode, trial, rule, note, notes, saveFailed, onNoteChange,
  onReturnLive }: Props) {
  const [copyStatus, setCopyStatus] = useState('')
  if (!episode) return <div className="arrow-result-empty">Select a CPI bundle episode in Criterion to inspect it.</div>
  const levels = trial ? bundlePriceLevels(episode, trial, rule) : null
  const yoyDirection = !trial ? bundleYoyOnlyDirection(episode) : null
  const exclusion = trial ? bundleExclusion(episode, rule) : null
  const comparison = bundleComparisons.find(([id]) => id === rule.comparison)?.[1] ?? rule.comparison
  const copyNote = async () => {
    try {
      await navigator.clipboard.writeText([
        `CPI bundle / EURUSD / ${episode.releaseText} / ${comparison}`,
        `Episode: ${episode.id}`,
        `Rule: ${rule.panel}, H${rule.horizon}, SL ${rule.stop} ATR, TP ${rule.target} ATR`,
        '', note,
      ].join('\n'))
      setCopyStatus('Copied')
    } catch { setCopyStatus('Copy unavailable; use Export all') }
  }

  return <section className="arrow-result-panel" aria-label="CPI bundle arrow result">
    <div className="arrow-result-col arrow-result-setup">
      <header className="arrow-result-col-header">
        <div className="arrow-result-identity">
          <strong>US CPI <span>EURUSD</span></strong>
          <span className={`arrow-result-direction ${!trial ? 'neutral' : trial[1] > 0 ? 'long' : 'short'}`}>
            {trial ? trial[1] > 0 ? '↑ LONG' : '↓ SHORT'
              : yoyDirection ? `${yoyDirection === 'long' ? '↑' : '↓'} YOY CONTEXT` : 'OUTSIDE RULE'}
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
      {trial ? (
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
      ) : yoyDirection ? (
        <div className="arrow-result-no-trade">Both available y/y A−P readings {yoyDirection === 'long' ? 'cooled, suggesting EURUSD up' : 'rose, suggesting EURUSD down'} as context only.
          The selected six rules require m/m readings, which are absent here. No y/y trial, ATR stop/target, or result was calculated.</div>
      ) : (
        <div className="arrow-result-no-trade">This episode does not qualify for the selected m/m rule; no priced result was calculated.</div>
      )}
      <div className="arrow-result-flags-row">
        <span className="arrow-result-flags-label">FLAGS</span>
        <div className="arrow-result-flags">
          <span>{formatFlag(episode.concordance)}</span>
          {episode.claimsCollision && <span>Claims Collision</span>}
          {!episode.claimsCollision && <span>Clean Release</span>}
          {yoyDirection && <span>Missing Monthly CPI</span>}
          {yoyDirection && <span>YoY Direction Only</span>}
          {exclusion && <span className="excluded">{exclusion}</span>}
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
    <div className="arrow-result-col arrow-result-journal">
      <header className="arrow-result-col-header"><span className="arrow-result-eyebrow">Trader Journal &amp; Thesis</span>
        <span className={`arrow-result-save-status${saveFailed ? ' failed' : ''}`}>
          {saveFailed ? 'Not saved — export a copy' : note.trim() ? '● Saved locally' : 'No note yet'}</span></header>
      <label className="arrow-result-note-label" htmlFor="bundle-audit-note">Audit note · {comparison} / this release</label>
      <textarea id="bundle-audit-note" className="arrow-result-note" value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        placeholder="What does the EURUSD chart show? Note zones, competing events, and reasons to keep or reject this case…" />
      <div className="arrow-result-journal-actions">
        <button type="button" onClick={copyNote} disabled={!note.trim()}>Copy this note</button>
        <button type="button" onClick={() => downloadAuditNotes(notes)} disabled={notes.length === 0}>Export all notes (.md)</button>
        <span role="status">{copyStatus}</span>
      </div>
      <p className="arrow-result-sharing">Notes survive refresh in this browser only. Export Markdown to share them with Codex later.</p>
    </div>
  </section>
}
