import type { ComboSnapshot, ComboSource } from '../core/contracts'
import { contextPairLabel } from '../../core/usd-pair'
import { ContextInputTable } from '../../ui/ContextInputTable'
import { formatAppTimestamp, type TimeDisplayPreference } from '../../../appearance/time-display/time-display-preference'
import { contextVersion } from '../../core/policy'
import './combo-inspector.css'

export function ComboInspector({ combo, timeDisplay, symbol, onClose, onOpenRelease }: {
  combo: ComboSnapshot; timeDisplay: TimeDisplayPreference; symbol: string;
  onClose: () => void; onOpenRelease: (source: ComboSource) => void
}) {
  const before = combo.before, after = combo.after
  const delta = before?.total != null && after.total != null ? after.total - before.total : null
  return <section className="combo-inspector" aria-label="Combo details">
    <header><strong>Combo details · {combo.title}</strong><button type="button" onClick={onClose}>Return to releases</button></header>
    <div className="combo-inspector-scroll">
      <p><strong>{contextPairLabel(symbol, combo.direction)} · {combo.strength ?? 'weak'} evidence</strong>
        {combo.experimental && ' · Experimental fresh-news interpretation'}</p>
      <p>{combo.explanation}</p>
      <p>Known by {formatAppTimestamp(combo.chartAt, { mode: 'utc', utcOffsetMinutes: 0 })} broker time.
        {' '}Captured from {contextVersion} with the inputs/settings used when this roof was opened. Reopen a roof after changing settings.</p>
      <h3>Participating publications</h3>
      <table><thead><tr><th>Release</th><th>Published</th><th>Standalone bias</th><th>Role / effect</th></tr></thead><tbody>
        {combo.sources.map(source => <tr key={source.sourceId}><td><button type="button" onClick={() => onOpenRelease(source)}>{source.sourceLabel}</button></td>
          <td>{formatAppTimestamp(source.releaseAt, timeDisplay)}</td>
          <td>{contextPairLabel(symbol, source.usdDirection)}{source.strength && ` · ${source.strength}`}</td>
          <td>{source.role ?? 'Participating context vote'}{source.change !== undefined && <small>Replacement change: {source.change.toFixed(3)}</small>}
            {combo.kind === 'ism-sectors' && source.contribution !== undefined && <small>Within ISM: {source.contribution.toFixed(3)}</small>}</td></tr>)}
      </tbody></table>
      <h3>Accumulated context before → after</h3>
      <p>{contextPairLabel(symbol, before?.direction ?? 'uncomputed')} ({before?.total?.toFixed(3) ?? '—'})
        {' → '}{contextPairLabel(symbol, after.direction)} ({after.total?.toFixed(3) ?? '—'})
        {delta !== null && ` · USD change ${delta > 0 ? '+' : ''}${delta.toFixed(3)}`}</p>
      {combo.experimental && <p>The roof’s fresh-news direction describes recent replacement effects. The accumulated result above keeps older eligible evidence and can disagree.</p>}
      {combo.checks.length > 0 && <><h3>Qualifying conditions</h3><ul>{combo.checks.map(check => <li key={check.label}>
        <strong>{check.label}: {check.state === 'pass' ? 'Met' : check.state === 'fail' ? 'Not met' : 'Unavailable'}.</strong> {check.detail}</li>)}</ul></>}
      <h3>Contributions after this update</h3>
      <ContextInputTable families={[...new Set([...after.members.map(m => m.family), ...after.missing])]} result={after} symbol={symbol} loading={false}
        unavailable={false} cutoff={combo.chartAt} timeDisplay={timeDisplay} summaryLabel={contextPairLabel(symbol, after.direction)}
        tableLabel="Combo context contributions" />
      <p>Same-time releases form one update. Older Claims confirmations do not add votes; ISM sectors resolve one family vote. No later publications or prices enter this snapshot. This roof identifies a numerical relationship, not historically proven volatility.</p>
    </div>
  </section>
}
