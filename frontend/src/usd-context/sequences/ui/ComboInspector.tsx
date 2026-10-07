import { useId, useState } from 'react'
import type { ComboSnapshot, ComboSource } from '../core/contracts'
import { contextPairLabel, contextResultLabel } from '../../core/usd-pair'
import { formatAppTimestamp, type TimeDisplayPreference } from '../../../appearance/time-display/time-display-preference'
import { contextVersion } from '../../core/policy'
import { comboSummary } from './combo-summary'
import { ComboAdvanced } from './ComboAdvanced'
import { RoofAuditControls } from './RoofAuditControls'
import { roofDisplayVersion } from '../chart/roof-symbols'
import './combo-inspector.css'

export function ComboInspector({ combo, timeDisplay, symbol, broker = null, onClose, onOpenRelease }: {
  combo: ComboSnapshot; timeDisplay: TimeDisplayPreference; symbol: string; broker?: string | null;
  onClose: () => void; onOpenRelease: (source: ComboSource) => void
}) {
  const [advanced, setAdvanced] = useState(false), advancedId = useId()
  const summary = comboSummary(combo), bias = contextResultLabel(symbol, combo)
  const after = combo.after, before = combo.before
  return <section className="combo-inspector" aria-label="Combo details">
    <header><strong>Combo details · {combo.title}</strong><button type="button" onClick={onClose}>Return to releases</button></header>
    <div className="combo-inspector-scroll">
      <div className="combo-result" aria-label="Roof interpretation">
        <strong className={`combo-bias ${bias.endsWith(' Long') ? 'long' : bias.endsWith(' Short') ? 'short' : ''}`}>{bias}</strong>
        <span>{combo.strength ? `${combo.strength} evidence` : 'Direction withheld'}</span>
        {combo.experimental && <small>Experimental</small>}
      </div>
      <p className="combo-meaning">{summary.meaning}</p>
      <small className="combo-version">{contextVersion} · Relationship roofs v3 · USD inputs only · Display v{roofDisplayVersion}. Snapshot captured when opened; reopen after changing inputs.</small>
      <div className="combo-overview">
        <section className="combo-card" aria-label="Why this direction"><h3>Why this direction?</h3><p>{summary.why}</p></section>
        <section className="combo-card" aria-label="Activation and changes"><h3>What changed?</h3>
          <p><strong>Available from {formatAppTimestamp(combo.chartAt, { mode: 'utc', utcOffsetMinutes: 0 })} broker time.</strong></p>
          <p>Activated by: {summary.activation}.</p><p>{summary.changed}</p>
          <small>The filled dot marks availability within its chart candle. Use the exact activation time, not the candle open. A memory update can activate a combo without a new publication. Hollow dots identify earlier inputs; they do not backdate the result or mark a trade entry.</small>
        </section>
      </div>
      <section className="combo-card" aria-label="Accumulated context comparison"><h3>Combined context at activation</h3>
        <p>{contextResultLabel(symbol, before)}{' → '}{contextResultLabel(symbol, after)}
          {after.strength && ` · ${after.strength} context evidence`}</p>
        {combo.experimental && <p>The roof describes recent changes; this combined result also includes older eligible evidence. They can disagree.</p>}
      </section>
      <section className="combo-card" aria-label="Participating publications"><h3>Which releases are involved?</h3>
        <table><thead><tr><th>Release</th><th>Published</th><th>Standalone interpretation</th><th>Role</th></tr></thead><tbody>
          {combo.sources.map(source => <tr key={source.sourceId}><td><button type="button" onClick={() => onOpenRelease(source)}>{source.sourceLabel}</button></td>
            <td>{formatAppTimestamp(source.releaseAt, timeDisplay)}</td>
            <td>{contextPairLabel(symbol, source.usdDirection)}{source.strength && <small>{source.strength} evidence</small>}</td>
            <td>{summary.updates.includes(source) ? 'Activation update' : 'Earlier context'}<small>{source.role ?? 'Participating context vote'}</small></td></tr>)}
        </tbody></table>
      </section>
      <RoofAuditControls key={`${broker}/${symbol}/${combo.id}`} combo={combo} symbol={symbol} broker={broker} />
      <div className="combo-advanced-control"><button type="button" aria-expanded={advanced} aria-controls={advancedId} onClick={() => setAdvanced(!advanced)}>
        {advanced ? 'Hide advanced calculations' : 'Advanced calculations'}</button></div>
      {advanced && <div id={advancedId}><ComboAdvanced combo={combo} symbol={symbol} timeDisplay={timeDisplay} /></div>}
      <p className="combo-footnote">This is a dataset interpretation, not a prediction of candle direction or volatility. Your audit records what price did; it does not change the rules.</p>
    </div>
  </section>
}
