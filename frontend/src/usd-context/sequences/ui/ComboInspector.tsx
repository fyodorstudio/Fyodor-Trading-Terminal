import { removalReason } from '../core/combo-activation'
import { useId, useState } from 'react'
import { relationshipVersion, type ComboSnapshot, type ComboSource } from '../core/contracts'
import { roofResultLabel, roofSupport } from '../core/relationship-support'
import { ComboSupportSummary } from './ComboSupportSummary'
import { RelationshipCatalogue } from './RelationshipCatalogue'
import { contextPairLabel, contextResultLabel } from '../../core/usd-pair'
import { formatAppTimestamp, type TimeDisplayPreference } from '../../../appearance/time-display/time-display-preference'
import { contextVersion } from '../../core/policy'
import { comboSummary } from './combo-summary'
import { ComboAdvanced } from './ComboAdvanced'
import { roofDisplayVersion } from '../chart/roof-symbols'
import './combo-inspector.css'
import { useDisplayClock } from '../../../appearance/time-display/useDisplayClock'

export function ComboInspector({ combo, timeDisplay, symbol, collapsed = false, onToggleCollapsed, onClose, onOpenRelease }: {
  combo: ComboSnapshot; timeDisplay: TimeDisplayPreference; symbol: string;
  collapsed?: boolean; onToggleCollapsed?: () => void;
  onClose: () => void; onOpenRelease: (source: ComboSource) => void
}) {
  const [advanced, setAdvanced] = useState(false), advancedId = useId(), bodyId = useId()
  const summary = comboSummary(combo), bias = roofResultLabel(combo)
  const clock = useDisplayClock()
  const support = roofSupport(combo)
  const fed = combo.sources.find(s => s.family === 'fed')
  const after = combo.after, before = combo.before
  return <section className={`combo-inspector${collapsed ? ' collapsed' : ''}`} aria-label="Combo details">
    <header><strong className="combo-title">Combo details · {combo.title}</strong>
      <div className={`combo-result ${support.state} ${support.direction ?? ''}`} aria-label="Roof interpretation">
        <strong className={`combo-bias ${support.direction ?? ''} ${support.state}`}>{bias}</strong>
        <span>{support.narrow ? 'weak evidence · narrow lead' : support.qualified ? 'weak evidence · limited inputs' : combo.strength ? `${combo.strength} evidence` : 'evidence ungraded'}</span>
      </div>
      <div className="combo-header-actions">{onToggleCollapsed && <button type="button" aria-expanded={!collapsed} aria-controls={bodyId}
        onClick={onToggleCollapsed}>{collapsed ? 'Expand' : 'Collapse'}</button>}
        <button type="button" onClick={onClose}>Return to releases</button></div>
    </header>
    <ComboSupportSummary support={support} compact={collapsed} />
    <div className="combo-inspector-scroll" id={bodyId} hidden={collapsed}>
      <div className="combo-edition"><p className="combo-meaning">{summary.meaning}</p>
        <small>Snapshot at {clock.chart(combo.chartAt)} ({clock.zone}) · USD inputs</small></div>
      {fed && <section className="combo-card" aria-label="Numerical Fed action"><h3>Fed action · separate from macro support</h3>
        <p>{fed.policyAction?.action ?? 'Unavailable'}{fed.policyAction?.delta != null && ` · ${fed.policyAction.delta} bp`}. {fed.role}</p>
        <p>The weighted support above covers macro inputs only. An opposing action exposes conflict; no overall numeric winner is asserted. Statements, projections and speeches are outside this dataset interpretation.</p></section>}
      <div className="combo-overview">
        <section className="combo-card" aria-label="Why this direction"><h3>Why this direction?</h3><p>{summary.why}</p></section>
        <section className="combo-card" aria-label="Activation and changes"><h3>What changed?</h3>
          <p><strong>Available from {clock.chart(combo.chartAt)} ({clock.zone}).</strong></p>
          <p>{summary.cause.kind === 'publication' ? 'Activated by' : 'Update cause'}: {summary.activation}.</p><p>{summary.changed}</p>
          {summary.cause.removed.map(s => <p key={s.sourceId}>{removalReason(s.reason)}: <strong>{s.sourceLabel}</strong> · {clock.utc(s.releaseAt)} ({clock.zone}).</p>)}
          {summary.cause.kind !== 'publication' && <p>No new participating publication. This snapshot reassesses the remaining evidence.</p>}
          <small>The combo label sits above its available-from candle. Hidden combos are under More at that same column. Hover, keyboard-focus or select a label to reveal its connections and highlight contributing release symbols. Aging and expiry labels have no new participating release. Use the exact time shown above, not the candle open.</small>
        </section>
        <section className="combo-card" aria-label="Accumulated context comparison"><h3>Combined context at activation</h3>
          <p>{contextResultLabel(symbol, before)}{' → '}{contextResultLabel(symbol, after)}
            {after.strength && ` · ${after.strength} context evidence`}</p>
          {combo.experimental && <p>The roof describes recent changes; this combined result also includes older eligible evidence. They can disagree.</p>}
        </section>
      </div>
      <section className="combo-card" aria-label="Participating publications"><h3>Which releases are involved?</h3>
        <table><thead><tr><th>Release</th><th>Published</th><th>Standalone interpretation</th><th>Role</th></tr></thead><tbody>
          {combo.sources.map(source => <tr key={source.sourceId}><td><button type="button" onClick={() => onOpenRelease(source)}>{source.sourceLabel}</button></td>
            <td>{formatAppTimestamp(source.releaseAt, timeDisplay)}</td>
            <td>{contextPairLabel(symbol, source.usdDirection)}{source.strength && <small>{source.strength} evidence</small>}</td>
            <td>{summary.updates.includes(source) ? 'Activation update' : 'Earlier context'}<small>{source.role ?? 'Participating context vote'}</small></td></tr>)}
        </tbody></table>
      </section>
      <RelationshipCatalogue combo={combo} />
      <div className="combo-advanced-control"><button type="button" aria-expanded={advanced} aria-controls={advancedId} onClick={() => setAdvanced(!advanced)}>
        {advanced ? 'Hide advanced calculations' : 'Advanced calculations'}</button></div>
      {advanced && <div id={advancedId}><p className="combo-calculations">Net {support.net.toFixed(3)} · Separation {(support.separation * 100).toFixed(1)}%</p>
        <small className="combo-version">{contextVersion} · Relationship roofs v{relationshipVersion} · USD inputs only · Display v{roofDisplayVersion}. Snapshot captured when opened; reopen after changing inputs.</small><ComboAdvanced combo={combo} symbol={symbol} timeDisplay={timeDisplay} /></div>}
      <p className="combo-footnote">The percentages describe weighted evidence, not the probability of a price move. Record price reactions in Raycaster.</p>
    </div>
  </section>
}
