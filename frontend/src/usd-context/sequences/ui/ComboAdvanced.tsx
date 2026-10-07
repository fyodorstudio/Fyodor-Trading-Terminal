import type { ComboSnapshot } from '../core/contracts'
import { contextResultLabel } from '../../core/usd-pair'
import { contextVersion } from '../../core/policy'
import { ContextInputTable } from '../../ui/ContextInputTable'
import type { TimeDisplayPreference } from '../../../appearance/time-display/time-display-preference'

export function ComboAdvanced({ combo, symbol, timeDisplay }: { combo: ComboSnapshot; symbol: string; timeDisplay: TimeDisplayPreference }) {
  const before = combo.before, after = combo.after
  const delta = before?.total != null && after.total != null ? after.total - before.total : null
  return <section className="combo-card" aria-label="Advanced calculation details">
    <h3>Calculation details · {contextVersion}</h3>
    <p>Captured with the inputs/settings used when this roof was opened. Reopen after changing settings.</p>
    <p>{combo.explanation}</p>
    <h3>Accumulated context before → after</h3>
    <p>{contextResultLabel(symbol, before)} ({before?.total?.toFixed(3) ?? '—'})
      {' → '}{contextResultLabel(symbol, after)} ({after.total?.toFixed(3) ?? '—'})
      {delta !== null && ` · USD change ${delta > 0 ? '+' : ''}${delta.toFixed(3)}`}</p>
    <table aria-label="Source calculation effects"><thead><tr><th>Source</th><th>Role</th><th>Effect</th></tr></thead><tbody>
      {combo.sources.map(source => <tr key={source.sourceId}><td>{source.sourceLabel}</td><td>{source.role ?? 'Participating context vote'}</td>
        <td>{source.change !== undefined && <span>Change in interpreted support: {source.change.toFixed(3)}</span>}
          {source.participants && <small>Seven-day sector changes are carried within one ISM budget. Incoming sector change for this replacement: {source.scoreChange?.toFixed(3)}. Earlier sector changes are not charged twice.</small>}
          {source.replacementChange !== undefined && <><small>Replacement at base family weight: {source.replacementChange.toFixed(3)}</small>
            <small>Calibration effect: {source.calibrationChange?.toFixed(3)} · Memory renewal: {source.memoryRenewal?.toFixed(3)} · Changed coverage / availability / non-comparable residual: {source.availabilityChange?.toFixed(3)}</small></>}
          {combo.kind === 'ism-sectors' && source.contribution !== undefined && <span>Within ISM: {source.contribution.toFixed(3)}</span>}</td></tr>)}
    </tbody></table>
    {combo.checks.length > 0 && <><h3>Qualifying conditions</h3><ul>{combo.checks.map(check => <li key={check.label}>
      <strong>{check.label}: {check.state === 'pass' ? 'Met' : check.state === 'fail' ? 'Not met' : 'Unavailable'}.</strong> {check.detail}</li>)}</ul></>}
    <h3>Contributions after this update</h3>
    <ContextInputTable families={[...new Set([...after.members.map(m => m.family), ...after.missing])]} result={after} symbol={symbol} loading={false}
      unavailable={false} cutoff={combo.chartAt} timeDisplay={timeDisplay} summaryLabel={contextResultLabel(symbol, after)}
      tableLabel="Combo context contributions" />
    <p>Same-time releases form one update. Older Claims confirmations do not add votes; ISM sectors resolve one family vote. No later publications or prices enter this snapshot.</p>
  </section>
}
