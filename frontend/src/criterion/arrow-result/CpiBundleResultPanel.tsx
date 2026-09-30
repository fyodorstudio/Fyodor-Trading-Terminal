import { useState } from 'react'
import { bundleComparisons, bundleExclusion, bundlePriceLevels, type BundleEpisode,
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

export function CpiBundleResultPanel({ episode, trial, rule, note, notes, saveFailed, onNoteChange,
  onReturnLive }: Props) {
  const [copyStatus, setCopyStatus] = useState('')
  if (!episode) return <div className="arrow-result-empty">Select a CPI bundle episode in Criterion to inspect it.</div>
  const levels = trial ? bundlePriceLevels(episode, trial, rule) : null
  const exclusion = trial ? bundleExclusion(episode, rule) : 'Not eligible for this interpretation'
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
      <header className="arrow-result-col-header"><span className="arrow-result-eyebrow">Historical CPI bundle</span>
        <button className="arrow-result-text-button" type="button" onClick={onReturnLive}>Return to live</button></header>
      <div className="arrow-result-identity"><strong>US CPI <span>EURUSD</span></strong>
        <span className={`arrow-result-direction ${!trial ? 'neutral' : trial[1] > 0 ? 'long' : 'short'}`}>
          {!trial ? 'NO TRADE' : trial[1] > 0 ? '↑ LONG' : '↓ SHORT'}</span></div>
      <div className="arrow-result-meta">{episode.releaseText} release · {episode.entryText} research entry · server clock</div>
      <div className="bundle-readings" aria-label="Four same-time CPI readings">
        <div className="bundle-reading-head"><span>Series</span><span>A</span><span>P</span><span>A−P</span></div>
        {episode.readings.map((item) => <div className="bundle-reading-row" key={item.name}>
          <strong>{item.name}</strong><span>{reading(item.actual)}</span><span>{reading(item.previous)}</span>
          <span className={item.delta != null && item.delta > 0 ? 'positive' : item.delta != null && item.delta < 0 ? 'negative' : ''}>
            {item.delta != null && item.delta > 0 ? '+' : ''}{reading(item.delta)}</span>
        </div>)}
      </div>
      <div className="arrow-result-levels">
        <div><span>ENTRY</span><b>{episode.entryPrice?.toFixed(5) ?? '—'}</b></div>
        <div className="stop"><span>NOMINAL SL</span><b>{levels?.stop.toFixed(5) ?? '—'}</b></div>
        <div className="target"><span>NOMINAL TP</span><b>{levels?.target.toFixed(5) ?? '—'}</b></div>
      </div>
    </div>
    <div className="arrow-result-col arrow-result-evidence">
      <header className="arrow-result-col-header"><span className="arrow-result-eyebrow">Interpretation &amp; result</span></header>
      <div className="arrow-result-rule">{comparison} · A−P · SL {rule.stop} ATR · TP {rule.target} ATR · H{rule.horizon}</div>
      {trial ? <div className="arrow-result-outcome">
        <span><small>EXIT</small><b>{trial[2] === 0 ? 'TP first' : trial[2] === 1 ? 'SL first' : 'Expiry'} at H{trial[3]}</b></span>
        <span><small>GROSS RESULT</small><b className={trial[4] >= 0 ? 'positive' : 'negative'}>
          {trial[4] >= 0 ? '+' : ''}{trial[4].toFixed(3)} R</b></span>
      </div> : <div className="arrow-result-no-trade">No priced outcome for this episode under the selected interpretation.</div>}
      <div className="arrow-result-flags">
        <span>{episode.concordance.replaceAll('_', ' ')}</span>
        {episode.claimsCollision && <span>Jobless Claims co-release</span>}
        {exclusion && <span className="excluded">Excluded from selected summary: {exclusion}</span>}
        {Boolean(trial?.[5]) && <span>Same-bar dual touch · stop first</span>}
        {Boolean(trial?.[6]) && <span>Opening gap</span>}
      </div>
      <p className="arrow-result-caveat">V3 historical exploration, not a registered setup. Four CPI readings share one release. Exported Previous may be revised; gross OHLC outcomes exclude costs. SL/TP lines are nominal, not broker fills.</p>
      <code className="arrow-result-id">{episode.id}</code>
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
