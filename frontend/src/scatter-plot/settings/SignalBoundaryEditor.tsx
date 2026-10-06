import { useId, useState } from 'react'
import { validMagnitudeLimits, type MagnitudeLimits } from '../../inspector/magnitude/magnitude-distribution'
import './magnitude-boundary-editor.css'

export function SignalBoundaryEditor({ limits, manual, unit, onPreview, onApply, onAutomatic }: {
  limits: MagnitudeLimits | null; manual: boolean; unit: string
  onPreview: (limits: MagnitudeLimits | null) => void; onApply: (limits: MagnitudeLimits) => void; onAutomatic: () => void
}) {
  const id = useId()
  const [editing, setEditing] = useState(manual)
  const [draft, setDraft] = useState(() => limits?.map(String) ?? ['', '', ''])
  const values = draft.map((value) => value.trim() ? Number(value) : NaN)
  const valid = validMagnitudeLimits(values)
  const automatic = () => { setEditing(false); setDraft(limits?.map(String) ?? ['', '', '']); onPreview(null); onAutomatic() }
  return <form className="scatter-magnitude-boundaries" aria-label="Scoring signal boundaries" onSubmit={(event) => {
    event.preventDefault(); if (editing && valid) onApply(values)
  }}><fieldset>
    <legend>Signal magnitude ({unit})</legend>
    <label>Mode<select aria-label="Signal magnitude mode" value={editing ? 'custom' : 'automatic'} onChange={(event) => {
      const next = event.target.value === 'custom'
      setEditing(next); onPreview(null)
      if (!next) automatic()
    }}><option value="automatic">Automatic</option><option value="custom">Manual override</option></select></label>
    <span className="scatter-magnitude-source">{editing ? manual ? 'Saved override · edit then Apply' : 'Editing · unsaved' : 'Earlier-history quantiles'}</span>
    {(['Small', 'Medium', 'Large'] as const).map((label, index) => <div className="scatter-magnitude-boundary-row" key={label}>
      <label htmlFor={`${id}-${index}`}>{label} ≤</label>
      <input id={`${id}-${index}`} aria-label={`${label} signal upper boundary`} type="number" step="any" min="0" disabled={!editing}
        value={draft[index]} onChange={(event) => {
          const next = draft.map((value, at) => at === index ? event.target.value : value)
          setDraft(next)
          const parsed = next.map((value) => value.trim() ? Number(value) : NaN)
          onPreview(validMagnitudeLimits(parsed) ? parsed : null)
        }} />
    </div>)}
    {editing ? <>
      {!valid && <p role="status">Use 0 &lt; Small &lt; Medium &lt; Large.</p>}
      <p>Preview changes the chart only. Apply updates this component in the Inspector and across historical releases.</p>
      <div className="scatter-magnitude-boundary-actions"><button type="submit" disabled={!valid}>Apply to scorer</button>
        <button type="button" onClick={automatic}>Use automatic</button></div>
    </> : <p>33⅓% / 66⅔% / 90% of earlier nonzero absolute signals. Tied boundaries can leave a bucket empty. At least 24 usable earlier signals are required to score.</p>}
  </fieldset></form>
}
