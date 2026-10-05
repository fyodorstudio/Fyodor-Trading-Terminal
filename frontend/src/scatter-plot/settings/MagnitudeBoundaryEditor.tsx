import { useId, useState } from 'react'
import { validMagnitudeLimits, type MagnitudeLimits } from '../../inspector/magnitude/magnitude-distribution'
import type { MagnitudeMode } from '../../inspector/magnitude/settings/magnitude-settings-store'
import './magnitude-boundary-editor.css'

export function MagnitudeBoundaryEditor({ limits, custom, unit, onApply, onReset, mode = custom ? 'custom' : 'undefined', onModeChange, bandColors, onBandColorChange }: {
  limits: readonly number[] | null; custom: boolean; unit: string
  onApply: (limits: MagnitudeLimits) => void; onReset: () => void
  mode?: MagnitudeMode; onModeChange?: (mode: 'undefined') => void
  bandColors?: readonly string[]; onBandColorChange?: (index: number, color: string) => void
}) {
  const inputId = useId()
  const signature = JSON.stringify(limits)
  const [state, setState] = useState(() => ({ signature, draft: limits?.map(String) ?? ['', '', ''], dirty: false }))
  const [requestedMode, setRequestedMode] = useState(mode)
  const [editing, setEditing] = useState(!custom)
  // Polling may change an automatic baseline. Refresh an untouched suggestion,
  // but preserve the user's in-progress edit until Apply or a scope change.
  if (state.signature !== signature && !state.dirty) setState({ signature, draft: limits?.map(String) ?? ['', '', ''], dirty: false })
  const draft = state.signature !== signature && !state.dirty ? limits?.map(String) ?? ['', '', ''] : state.draft
  const parsed = draft.map((value) => value.trim() ? Number(value) : NaN)
  const valid = validMagnitudeLimits(parsed)
  return <form className="scatter-magnitude-boundaries" aria-label="Magnitude boundaries" onSubmit={(event) => {
    event.preventDefault()
    if (editing && valid && requestedMode === 'custom') { onApply(parsed); setEditing(false) }
  }}>
    <fieldset>
      <legend>Magnitude{unit ? ` (${unit})` : ''}</legend>
      {onModeChange && <label>Mode<select aria-label="Magnitude mode" value={requestedMode} onChange={(event) => {
        const next = event.target.value as MagnitudeMode
        setRequestedMode(next)
        if (next !== 'custom') onModeChange(next)
        else setEditing(true)
      }}><option value="undefined">Undefined</option><option value="custom">Manual boundaries</option></select></label>}
      <span className="scatter-magnitude-source">{mode === 'undefined' ? 'Undefined' : editing ? 'Editing · frozen values stay active' : 'Frozen'}</span>
      {requestedMode === 'undefined' ? <p>Histogram and size are empty until a magnitude mode is configured.</p> : <>
      {(['Small', 'Medium', 'Large'] as const).map((label, index) => <div key={label}
        className={`scatter-magnitude-boundary-row${bandColors && onBandColorChange ? ' has-band-colors' : ''}`}>
        <label htmlFor={`${inputId}-${index}`}>{label} ≤</label>
        {bandColors && onBandColorChange && <input type="color" aria-label={`${label} band color`}
          title={`${label} band and boundary color on both sides of zero`} value={bandColors[index]}
          onChange={(event) => onBandColorChange(index, event.target.value)} />}
        <input id={`${inputId}-${index}`} type="number" min="0" step="any" required aria-label={`${label} upper boundary`}
          disabled={!editing || requestedMode !== 'custom'}
          value={draft[index]} onChange={(event) => setState((previous) => ({ signature,
            draft: previous.draft.map((value, at) => at === index ? event.target.value : value), dirty: true }))} />
      </div>)}
      <p>Mirrored at ± each boundary. Extreme: |Δ| &gt; Large.</p>
      {!valid && <p role="status">Use 0 &lt; Small &lt; Medium &lt; Large.</p>}
      <div className="scatter-magnitude-boundary-actions">
        {requestedMode === 'custom' && (editing ? <button type="submit" disabled={!valid}>Freeze</button> :
          <button type="button" onClick={() => setEditing(true)}>Unfreeze</button>)}
        <button type="button" onClick={onReset}>Set Undefined</button>
      </div>
      </>}
    </fieldset>
  </form>
}
