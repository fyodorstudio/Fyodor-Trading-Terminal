import { emptyWorkflow, type TradeWorkflow } from './workflow-model'
import { NotebookContextCapture, type CaptureScope } from './NotebookContextCapture'
import './trade-workflow.css'
import { useDisplayClock } from '../../appearance/time-display/useDisplayClock'

const fields = [
  ['thesis', 'Trade thesis', 'Why does this setup make sense?'],
  ['priceInvalidation', 'Price invalidation', 'What observable price condition defeats the setup?'],
  ['fundamentalInvalidation', 'Fundamental invalidation', 'Which combined context change, mode and evidence would defeat the thesis?'],
  ['riskLimit', 'Risk limit', 'Your maximum loss / exposure'],
  ['reviewHorizon', 'Review horizon', 'When will you reassess or stop waiting?'],
  ['exitRule', 'Exit rule / action', 'What will you do if invalidation occurs? Keep price and risk exits explicit.'],
] as const
export function TradeWorkflowEditor({ workflow, onChange, readOnly, symbol, scope }: {
  workflow?: TradeWorkflow; onChange: (workflow: TradeWorkflow) => void; readOnly: boolean; symbol: string; scope?: CaptureScope
}) {
  const value = workflow ?? emptyWorkflow
  const clock = useDisplayClock()
  return <section className="trade-workflow" aria-label="Trade thesis and invalidation">
    <header><h3>{readOnly ? 'Pinned workflow snapshot' : 'Trade workflow · Saved automatically'}</h3>
      {!readOnly && <button type="button" onClick={() => onChange({ ...emptyWorkflow })}>Clear workflow</button>}</header>
    <p><strong>Invalidation:</strong> What observable condition would make my reason for this trade no longer hold?</p>
    <div className="trade-workflow-fields">{fields.map(([key, label, placeholder]) => <label key={key}>{label}
      <textarea rows={2} readOnly={readOnly} value={value[key]} placeholder={readOnly ? 'Not recorded' : placeholder}
        onChange={e => onChange({ ...value, [key]: e.target.value })} />
    </label>)}</div>
    <label>Fundamental review trigger <select disabled={readOnly} value={value.reviewTrigger}
      onChange={e => onChange({ ...value, reviewTrigger: e.target.value as TradeWorkflow['reviewTrigger'] })}>
      <option value="manual">My written rule</option><option value="opposing-publication">New publication changes combined direction against trade · any evidence</option>
      <option value="opposing-moderate">New publication changes combined direction against trade · Moderate or stronger</option>
    </select></label>
    <p>These are paper-test review rules, not validated exit strategies. Aging, expiry and changed settings are separate from new publications. An opposing standalone release alone does not trigger these combined-context rules. All execution remains manual.</p>
    <h3>Context recorded for this plan</h3>
    {value.context ? <div className="notebook-context-record"><strong>{value.context.label} · {value.context.evidence} evidence</strong>
      <small>Recorded at {clock.utc(value.context.recordedAt)} ({clock.zone}) · {value.context.mode === 'relative' ? 'EUR vs USD' : 'USD side'}</small>
      <small>{value.context.symbol} · {value.context.broker} · {value.context.version}{value.context.partial ? ' · Partial history' : ''}</small>
      <p>Inputs: {value.context.inputs.join(', ')}</p><p>{value.context.update}</p>
    </div> : <p>No context recorded. Older pinned setups keep their original data.</p>}
    {!readOnly && scope && <NotebookContextCapture key={`${symbol}:${scope.brokerId}`} symbol={symbol} scope={scope} onRecord={context => onChange({ ...value, context })} />}
    <small>Pin Arrow preserves this workflow and its context record. A pinned setup is not a broker trade.</small>
  </section>
}
