import { useState } from 'react'
import { validMagnitudeLimits } from '../../inspector/magnitude/magnitude-distribution'
import type { MagnitudeSettingsStore } from '../../inspector/magnitude/settings/magnitude-settings-store'

export function CalibrationEditor({ store, signal, saved, onPreview, draftOnly = false }: {
  store: MagnitudeSettingsStore; signal: { id: string; label: string; unit: string };
  saved?: readonly number[]; onPreview?: (limits: readonly [number, number, number] | null, valid: boolean) => void; draftOnly?: boolean
}) {
  const [manual, setManual] = useState(!!saved), [draft, setDraft] = useState(saved?.map(String) ?? ['', '', ''])
  const values = draft.map(v => v.trim() ? Number(v) : NaN), valid = !manual || validMagnitudeLimits(values)
  const preview = (next: string[], custom: boolean) => {
    const limits = next.map(v => v.trim() ? Number(v) : NaN)
    onPreview?.(custom && validMagnitudeLimits(limits) ? limits : null, !custom || validMagnitudeLimits(limits))
  }
  return <form className="scoring-calibration-editor" aria-label={`${signal.label} calibration`} onSubmit={e => {
    e.preventDefault(); if (!draftOnly && valid) store.save(signal.id, manual && validMagnitudeLimits(values) ? values : null)
  }}>
    <label>{signal.label}<select aria-label={`${signal.label} magnitude mode`} value={manual ? 'custom' : 'automatic'} onChange={e => {
      const custom = e.target.value === 'custom'; setManual(custom); preview(draft, custom)
    }}><option value="automatic">Automatic</option><option value="custom">Manual override</option></select></label>
    {manual && <div className="scoring-calibration-fields">{['Small', 'Medium', 'Large'].map((name, index) =>
      <label key={name}>{name} ≤ ({signal.unit})<input type="number" min="0" step="any" aria-label={`${signal.label} ${name} boundary`}
        value={draft[index]} onChange={e => { const next = draft.map((v, i) => i === index ? e.target.value : v); setDraft(next); preview(next, manual) }} /></label>)}</div>}
    {!valid && <span role="status">Use 0 &lt; Small &lt; Medium &lt; Large.</span>}
    {!draftOnly && <button type="submit" disabled={!valid}>Apply</button>}
  </form>
}
