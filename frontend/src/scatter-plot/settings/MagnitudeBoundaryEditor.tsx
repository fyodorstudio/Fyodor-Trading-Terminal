import { useId, useState } from 'react'
import { validMagnitudeLimits, type MagnitudeLimits } from '../../inspector/magnitude/magnitude-distribution'
import type { MagnitudeMode } from '../../inspector/magnitude/settings/magnitude-settings-store'
import './magnitude-boundary-editor.css'

export function MagnitudeBoundaryEditor({ limits, custom, unit, onApply, onReset, mode = custom ? 'custom' : 'undefined', onModeChange, bandColors, onBandColorChange, onPreview }: {
  limits: readonly number[] | null; custom: boolean; unit: string
  onApply: (limits: MagnitudeLimits) => void; onReset: () => void
  mode?: MagnitudeMode; onModeChange?: (mode: 'undefined') => void
  bandColors?: readonly string[]; onBandColorChange?: (index: number, color: string) => void
  onPreview?: (limits: MagnitudeLimits) => void
}) {
  const inputId = useId()
  const signature = JSON.stringify(limits)
  const [state, setState] = useState(() => ({ signature, draft: limits?.map(String) ?? ['', '', ''], dirty: false }))
  const [requestedMode, setRequestedMode] = useState(mode)
  const [editing, setEditing] = useState(!custom)
  // Refresh untouched saved values, preserving an in-progress edit until Freeze
  // or a scope change. Preview values never replace these saved props.
  if (state.signature !== signature && !state.dirty) setState({ signature, draft: limits?.map(String) ?? ['', '', ''], dirty: false })
  const draft = state.signature !== signature && !state.dirty ? limits?.map(String) ?? ['', '', ''] : state.draft
  const parsed = draft.map((value) => value.trim() ? Number(value) : NaN)
  const valid = validMagnitudeLimits(parsed)
  const freeze = () => {
    if (editing && valid && requestedMode === 'custom') { onApply(parsed); setEditing(false) }
  }
  return <form className="scatter-magnitude-boundaries" aria-label="Magnitude boundaries" onSubmit={(event) => {
    event.preventDefault()
    freeze()
  }}>
    <fieldset>
      <legend>Magnitude{unit ? ` (${unit})` : ''}</legend>
      {onModeChange && <label>Mode<select aria-label="Magnitude mode" value={requestedMode} onChange={(event) => {
        const next = event.target.value as MagnitudeMode
        setRequestedMode(next)
        if (next !== 'custom') onModeChange(next)
        else setEditing(true)
      }}><option value="undefined">Undefined</option><option value="custom">Manual boundaries</option></select></label>}
      <span className="scatter-magnitude-source">{requestedMode === 'undefined' ? 'Undefined' : editing ? onPreview ? 'Editing · unsaved preview' : 'Editing' : 'Frozen'}</span>
      {requestedMode === 'undefined' ? <p>Histogram and size are empty until a magnitude mode is configured.</p> : <>
      {(['Small', 'Medium', 'Large'] as const).map((label, index) => <div key={label}
        className={`scatter-magnitude-boundary-row${bandColors && onBandColorChange ? ' has-band-colors' : ''}`}>
        <label htmlFor={`${inputId}-${index}`}>{label} ≤</label>
        {bandColors && onBandColorChange && <input type="color" aria-label={`${label} band color`}
          title={`${label} band and boundary color on both sides of zero`} value={bandColors[index]}
          onChange={(event) => onBandColorChange(index, event.target.value)} />}
        <input id={`${inputId}-${index}`} type="number" min="0" step="any" required aria-label={`${label} upper boundary`}
          disabled={!editing || requestedMode !== 'custom'}
          value={draft[index]} onChange={(event) => {
            if (!editing || requestedMode !== 'custom') return
            const next = draft.map((value, at) => at === index ? event.target.value : value)
            setState({ signature, draft: next, dirty: true })
            const values = next.map((value) => value.trim() ? Number(value) : NaN)
            if (validMagnitudeLimits(values)) onPreview?.(values)
          }} />
      </div>)}
      <p>Mirrored at ± each boundary. Extreme: |Δ| &gt; Large.</p>
      {!valid && <p role="status">Use 0 &lt; Small &lt; Medium &lt; Large.</p>}
      <div className="scatter-magnitude-boundary-actions">
        {requestedMode === 'custom' && <button type="button" disabled={editing && !valid}
          onClick={() => { if (editing) freeze(); else setEditing(true) }}>{editing ? 'Freeze' : 'Unfreeze'}</button>}
        <button type="button" onClick={onReset}>Set Undefined</button>
      </div>
      </>}
    </fieldset>
  </form>
}
