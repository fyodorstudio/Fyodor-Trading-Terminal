import { useState } from 'react'
import { exitLabel, researchPriceLevels, trialExclusionReason, type ResearchEpisode, type ResearchRule, type ResearchTrial } from '../audit-data'
import { downloadAuditNotes, type AuditNote } from './audit-notes'
import './arrow-result-panel.css'

type Props = {
  episode: ResearchEpisode | null
  trial: ResearchTrial | null
  rule: ResearchRule
  note: string
  notes: AuditNote[]
  saveFailed: boolean
  onNoteChange: (text: string) => void
  onReturnLive: () => void
}

export function ArrowResultPanel({ episode, trial, rule, note, notes, saveFailed, onNoteChange, onReturnLive }: Props) {
  const [copyStatus, setCopyStatus] = useState('')
  if (!episode) return <div className="arrow-result-empty">Select a historical episode in Criterion to inspect it.</div>

  const levels = trial ? researchPriceLevels(episode, rule) : null
  const directionLabel = !levels ? 'NO TRADE' : levels.direction > 0 ? '↑ LONG' : '↓ SHORT'
  const collision = rule.family === 'CPI' && episode.joblessCollision
  const exclusion = trial ? trialExclusionReason(episode, trial, rule) : 'No eligible trade for this direction rule and expiry'
  const grossR = trial ? Number(trial[3]) : 0

  const copyNote = async () => {
    try {
      await navigator.clipboard.writeText([
        `${rule.family} / EURUSD / ${episode.releaseText} / ${rule.signal.toUpperCase()}`,
        `Episode: ${episode.id}`,
        `Rule: ${rule.panel}, ${rule.cohort}, H${rule.horizon}, SL ${rule.stop} ATR, TP ${rule.target} ATR`,
        '', note,
      ].join('\n'))
      setCopyStatus('Copied')
    } catch {
      setCopyStatus('Copy unavailable; use Export all')
    }
  }

  return (
    <section className="arrow-result-panel" aria-label="Historical arrow result">
      <div className="arrow-result-col arrow-result-setup">
        <header className="arrow-result-col-header">
          <span className="arrow-result-eyebrow">Historical episode</span>
          <button className="arrow-result-text-button" type="button" onClick={onReturnLive}>Return to live</button>
        </header>
        <div className="arrow-result-identity">
          <strong>{rule.family} <span>EURUSD</span></strong>
          <span className={`arrow-result-direction ${levels ? levels.direction > 0 ? 'long' : 'short' : 'neutral'}`}>
            {directionLabel}
          </span>
        </div>
        <div className="arrow-result-meta">{episode.releaseText} release · {episode.entryText} research entry · server clock</div>
        <div className="arrow-result-values">
          <span><small>ACTUAL</small><b>{episode.actual || '—'}</b></span>
          <span><small>FORECAST</small><b>{episode.forecast || '—'}</b></span>
          <span><small>PREVIOUS</small><b>{episode.previous || '—'}</b></span>
        </div>
        <div className="arrow-result-levels">
          <div><span>ENTRY</span><b>{episode.entryPrice.toFixed(5)}</b></div>
          <div className="stop"><span>NOMINAL SL</span><b>{levels ? levels.stop.toFixed(5) : '—'}</b></div>
          <div className="target"><span>NOMINAL TP</span><b>{levels ? levels.target.toFixed(5) : '—'}</b></div>
        </div>
      </div>

      <div className="arrow-result-col arrow-result-evidence">
        <header className="arrow-result-col-header"><span className="arrow-result-eyebrow">Rule &amp; observed result</span></header>
        <div className="arrow-result-rule">{rule.signal === 'af' ? 'Actual − Forecast' : 'Actual − Previous'} · SL {rule.stop} ATR · TP {rule.target} ATR · H{rule.horizon}</div>
        {trial ? <div className="arrow-result-outcome">
          <span><small>EXIT</small><b>{exitLabel(trial[1])} at H{trial[2]}</b></span>
          <span><small>GROSS RESULT</small><b className={grossR >= 0 ? 'positive' : 'negative'}>{grossR >= 0 ? '+' : ''}{grossR.toFixed(3)} R</b></span>
        </div> : <div className="arrow-result-no-trade">No priced outcome for this episode under the selected direction rule and expiry.</div>}
        <div className="arrow-result-flags">
          <span>{rule.family === 'CPI' && rule.panel !== 'FULL_PANEL' ? 'Claims co-releases excluded' : 'No EURUSD co-release exclusions'}</span>
          {exclusion && <span className="excluded">Excluded from selected summary: {exclusion}</span>}
          {collision && <span>Jobless-claims collision</span>}
          {Boolean(trial?.[4]) && <span>Same-bar dual touch · stop first</span>}
          {Boolean(trial?.[6]) && <span>Opening gap</span>}
        </div>
        <p className="arrow-result-caveat">Historical OHLC simulation, not a registered setup or live signal. Levels are nominal; gap fills can differ. Gross result excludes costs. Exported Previous is not verified point-in-time.</p>
        <code className="arrow-result-id" title={episode.id}>{episode.id}</code>
      </div>

      <div className="arrow-result-col arrow-result-journal">
        <header className="arrow-result-col-header">
          <span className="arrow-result-eyebrow">Trader Journal &amp; Thesis</span>
          <span className={`arrow-result-save-status${saveFailed ? ' failed' : ''}`}>{saveFailed ? 'Not saved — export a copy' : note.trim() ? '● Saved locally' : 'No note yet'}</span>
        </header>
        <label className="arrow-result-note-label" htmlFor="criterion-audit-note">Audit note · {rule.family} / {rule.signal.toUpperCase()} / this release</label>
        <textarea id="criterion-audit-note" className="arrow-result-note" value={note} onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Your chart observations, support/resistance zones, thesis, and reasons to keep or reject this case…" />
        <div className="arrow-result-journal-actions">
          <button type="button" onClick={copyNote} disabled={!note.trim()}>Copy this note</button>
          <button type="button" onClick={() => downloadAuditNotes(notes)} disabled={notes.length === 0}>Export all notes (.md)</button>
          <span role="status">{copyStatus}</span>
        </div>
        <p className="arrow-result-sharing">Notes survive refresh in this browser only. Export Markdown and attach it when you want Codex to read your audit.</p>
      </div>
    </section>
  )
}
