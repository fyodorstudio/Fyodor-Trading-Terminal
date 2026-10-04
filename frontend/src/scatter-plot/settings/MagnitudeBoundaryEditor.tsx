import { useState } from 'react'
import { validMagnitudeLimits, type MagnitudeLimits } from '../../inspector/magnitude/magnitude-distribution'
import './magnitude-boundary-editor.css'

export function MagnitudeBoundaryEditor({ limits, custom, unit, onApply, onReset }: {
  limits: readonly number[] | null; custom: boolean; unit: string
  onApply: (limits: MagnitudeLimits) => void; onReset: () => void
}) {
  const signature = JSON.stringify(limits)
  const [state, setState] = useState(() => ({ signature, draft: limits?.map(String) ?? ['', '', ''], dirty: false }))
  // Polling may change an automatic baseline. Refresh an untouched suggestion,
  // but preserve the user's in-progress edit until Apply or a scope change.
  if (state.signature !== signature && !state.dirty) setState({ signature, draft: limits?.map(String) ?? ['', '', ''], dirty: false })
  const draft = state.signature !== signature && !state.dirty ? limits?.map(String) ?? ['', '', ''] : state.draft
  const parsed = draft.map((value) => value.trim() ? Number(value) : NaN)
  const valid = validMagnitudeLimits(parsed)
  const saved = valid && custom && limits?.every((limit, index) => limit === parsed[index])
  return <form className="scatter-magnitude-boundaries" aria-label="Magnitude boundaries" onSubmit={(event) => {
    event.preventDefault()
    if (valid) onApply(parsed)
  }}>
    <fieldset>
      <legend>Magnitude{unit ? ` (${unit})` : ''}</legend>
      <span className="scatter-magnitude-source">{custom ? 'Custom' : 'P95 · not configured'}</span>
      {(['Small', 'Medium', 'Large'] as const).map((label, index) => <label key={label}>
        {label} ≤<input type="number" min="0" step="any" required aria-label={`${label} upper boundary`}
          value={draft[index]} onChange={(event) => setState((previous) => ({ signature,
            draft: previous.draft.map((value, at) => at === index ? event.target.value : value), dirty: true }))} />
      </label>)}
      <p>Mirrored at ± each boundary. Extreme: |Δ| &gt; Large.</p>
      {!valid && <p role="status">Use 0 &lt; Small &lt; Medium &lt; Large.</p>}
      <div className="scatter-magnitude-boundary-actions">
        <button type="submit" disabled={!valid || saved}>{saved ? 'Applied' : 'Apply boundaries'}</button>
        {custom && <button type="button" onClick={onReset}>Reset to P95</button>}
      </div>
    </fieldset>
  </form>
}
