import { useState } from 'react'
import { exitLabel, researchPriceLevels, trialExclusionReason, type ResearchEpisode, type ResearchRule, type ResearchTrial } from '../audit-data'
import { downloadAuditNotes, type AuditNote } from './audit-notes'
import './arrow-result-panel.css'

export type BaselineResultPanelProps = {
  episode: ResearchEpisode | null
  trial: ResearchTrial | null
  rule: ResearchRule
  note: string
  notes: AuditNote[]
  saveFailed: boolean
  onNoteChange: (text: string) => void
  onReturnLive: () => void
}

export function BaselineResultPanel({ episode, trial, rule, note, notes, saveFailed, onNoteChange, onReturnLive }: BaselineResultPanelProps) {
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
        '', draftNote,
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
          <div className="arrow-result-identity">
            <strong>{rule.family} <span>EURUSD</span></strong>
            <span className={`arrow-result-direction ${levels ? levels.direction > 0 ? 'long' : 'short' : 'neutral'}`}>
              {directionLabel}
            </span>
          </div>
          <button className="arrow-result-text-button" type="button" onClick={onReturnLive}>Return to live</button>
        </header>
        <div className="arrow-result-meta">{episode.releaseText} release · {episode.entryText} research entry · server clock</div>
        <div className="arrow-result-values">
          <span><small>ACTUAL</small><b>{episode.actual || '—'}</b></span>
          <span><small>FORECAST</small><b>{episode.forecast || '—'}</b></span>
          <span><small>PREVIOUS</small><b>{episode.previous || '—'}</b></span>
        </div>
        <div className="arrow-result-levels horizontal">
          <span><small>ENTRY</small><b>{episode.entryPrice.toFixed(5)}</b></span>
          <span className="stop"><small>NOMINAL SL</small><b>{levels ? levels.stop.toFixed(5) : '—'}</b></span>
          <span className="target"><small>NOMINAL TP</small><b>{levels ? levels.target.toFixed(5) : '—'}</b></span>
        </div>
      </div>

      <div className="arrow-result-col arrow-result-evidence">
        <header className="arrow-result-col-header">
          <div className="arrow-result-header-title">
            <span className="arrow-result-eyebrow">INTERPRETATION ·</span>
            <strong>{rule.signal === 'af' ? 'Actual − Forecast' : 'Actual − Previous'}</strong>
          </div>
          <span className="arrow-result-rule-chip">{rule.signal === 'af' ? 'A−F' : 'A−P'} · H{rule.horizon}</span>
        </header>
        {trial ? (
          <div className="arrow-result-outcome feed">
            <div className="arrow-result-outcome-top">
              <strong className="arrow-result-exit-title">
                {exitLabel(trial[1])} (H{trial[2]})
              </strong>
              <b className={`arrow-result-gross ${grossR >= 0 ? 'positive' : 'negative'}`}>
                {grossR >= 0 ? '+' : ''}{grossR.toFixed(3)} R
              </b>
            </div>
            <div className="arrow-result-outcome-bottom">
              <span>SL {rule.stop} ATR · TP {rule.target} ATR</span>
              <span className="arrow-result-outcome-sublabel">Gross R</span>
            </div>
          </div>
        ) : (
          <div className="arrow-result-no-trade">No priced outcome for this episode under the selected direction rule and expiry.</div>
        )}
        <div className="arrow-result-flags-row">
          <span className="arrow-result-flags-label">FLAGS</span>
          <div className="arrow-result-flags">
            <span>{rule.family === 'CPI' && rule.panel !== 'FULL_PANEL' ? 'Claims Excluded' : 'All Claims'}</span>
            {exclusion && <span className="excluded">{exclusion}</span>}
            {collision && <span>Claims Collision</span>}
            {Boolean(trial?.[4]) && <span>Same-Bar Dual Touch</span>}
            {Boolean(trial?.[6]) && <span>Opening Gap</span>}
          </div>
        </div>
        <div className="arrow-result-evidence-footer">
          <div className="arrow-result-caveat-line" title="Historical OHLC simulation, not a registered setup or live signal. Levels are nominal; gap fills can differ. Gross result excludes costs. Exported Previous is not verified point-in-time.">
            <span className="arrow-result-info-icon" aria-hidden="true">ⓘ</span>
            <span className="arrow-result-caveat-text">Historical OHLC sim · nominal fills · <code className="arrow-result-id">{episode.id}</code></span>
          </div>
        </div>
      </div>

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
          id="criterion-audit-note"
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
          <div className="arrow-result-caveat-line" title="Notes survive refresh in this browser only. Export Markdown and attach it when you want Codex to read your audit.">
            <span className="arrow-result-info-icon" aria-hidden="true">ⓘ</span>
            <span className="arrow-result-caveat-text">
              {notes.length} {notes.length === 1 ? 'note' : 'notes'} in localStorage · Export to share with Codex
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
