import { removalReason } from '../../../scoring-system/relationships/combo-activation'
import { useId, useState } from 'react'
import { relationshipVersion, type ComboSnapshot, type ComboSource } from '../../../scoring-system/relationships/contracts'
import { roofResultLabel, roofSupport } from '../../../scoring-system/relationships/relationship-support'
import { ComboSupportSummary } from './ComboSupportSummary'
import { RelationshipCatalogue } from './RelationshipCatalogue'
import { contextResultLabel } from '../../../scoring-system/context/usd/usd-pair'
import type { TimeDisplayPreference } from '../../../appearance/time-display/time-display-preference'
import { contextVersion } from '../../../scoring-system/context/usd/policy'
import { comboSummary } from './combo-summary'
import { ComboAdvanced } from './ComboAdvanced'
import { roofDisplayVersion } from '../chart/roof-symbols'
import './combo-inspector.css'
import { useDisplayClock } from '../../../appearance/time-display/useDisplayClock'
import { roofEvidenceLabel } from './roof-evidence-label'
import { ComboReleaseTable } from './ComboReleaseTable'

export function ComboInspector({ combo, timeDisplay, symbol, onOpenRelease, onOpenRaycaster, onBackToOverview, overviewCount }: {
  combo: ComboSnapshot; timeDisplay: TimeDisplayPreference; symbol: string;
  onOpenRaycaster?: () => void;
  onBackToOverview?: () => void; overviewCount?: number;
  onOpenRelease: (source: ComboSource) => void
}) {
  const [advanced, setAdvanced] = useState(false), advancedId = useId()
  const summary = comboSummary(combo), bias = roofResultLabel(combo)
  const clock = useDisplayClock()
  const support = roofSupport(combo)
  const fed = combo.sources.find(s => s.family === 'fed')
  const after = combo.after, before = combo.before
  return <section className="combo-inspector" aria-label="Combo details">
    <header><strong className="combo-title">Combo details · {combo.title}</strong>
      <div className={`combo-result ${support.state} ${support.direction ?? ''}`} aria-label="Roof interpretation">
        <strong className={`combo-bias ${support.direction ?? ''} ${support.state}`}>{bias}</strong>
        <span>{roofEvidenceLabel(combo, support)}</span>
      </div>
      <div className="combo-header-actions">
        {onBackToOverview && <button type="button" onClick={onBackToOverview}>← All {overviewCount} combinations</button>}
        {onOpenRaycaster && <button type="button" onClick={onOpenRaycaster}>Open in Raycaster</button>}
      </div>
    </header>
    <ComboSupportSummary support={support} />
    <div className="combo-inspector-scroll">
      {fed && <section className="combo-card" aria-label="Numerical Fed action"><h3>Fed action · separate from macro support</h3>
        <p>{fed.policyAction?.action ?? 'Unavailable'}{fed.policyAction?.delta != null && ` · ${fed.policyAction.delta} bp`}. {fed.role}</p>
        </section>}
      <div className="combo-overview">
        <section className="combo-card" aria-label="Why this direction"><h3>Why this direction?</h3><p>{summary.why}</p></section>
        <section className="combo-card" aria-label="Activation and changes"><h3>What changed?</h3>
          <p><strong>Available from {clock.chart(combo.chartAt)} ({clock.zone}).</strong></p>
          <p>{summary.cause.kind === 'publication' ? 'Activated by' : 'Update cause'}: {summary.activation}.</p><p>{summary.changed}</p>
          {summary.cause.removed.map(s => <p key={s.sourceId}>{removalReason(s.reason)}: <strong>{s.sourceLabel}</strong> · {clock.utc(s.releaseAt)} ({clock.zone}).</p>)}
        </section>
        <section className="combo-card" aria-label="Accumulated context comparison"><h3>Combined context at activation</h3>
          <p>{contextResultLabel(symbol, before)}{' → '}{contextResultLabel(symbol, after)}
            {after.strength && ` · ${after.strength} context evidence`}</p>
          {combo.experimental && <p>The roof describes recent changes; this combined result also includes older eligible evidence. They can disagree.</p>}
        </section>
      </div>
      <section className="combo-card" aria-label="Participating publications"><h3>Which releases are involved?</h3>
        <ComboReleaseTable combo={combo} symbol={symbol} timeDisplay={timeDisplay} onOpenRelease={onOpenRelease} />
      </section>
      <RelationshipCatalogue combo={combo} />
      <div className="combo-advanced-control"><button type="button" aria-expanded={advanced} aria-controls={advancedId} onClick={() => setAdvanced(!advanced)}>
        {advanced ? 'Hide advanced calculations' : 'Advanced calculations'}</button></div>
      {advanced && <div id={advancedId}><p>{summary.meaning}</p><p className="combo-calculations">Net {support.net.toFixed(3)} · Separation {(support.separation * 100).toFixed(1)}%</p>
        <small className="combo-version">{contextVersion} · Relationship roofs v{relationshipVersion} · USD inputs only · Display v{roofDisplayVersion}. Snapshot captured when opened; reopen after changing inputs.</small><ComboAdvanced combo={combo} symbol={symbol} timeDisplay={timeDisplay} /></div>}
    </div>
  </section>
}
