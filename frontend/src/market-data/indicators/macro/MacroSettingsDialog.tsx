import { useEffect, useId, useRef, useState } from 'react'
import type { MacroPreferences, MacroStyle } from './macro-preferences'
import { resetMacroAppearance } from './macro-workspace'
import './macro-settings.css'

export function MacroSettingsDialog({ preferences, onSave, onClose }: {
  preferences: MacroPreferences; onSave: (next: MacroPreferences) => void; onClose: () => void
}) {
  const [draft, setDraft] = useState(preferences)
  const dialog = useRef<HTMLFormElement>(null), id = useId()
  const widths = new Set(Object.values(draft.series).map(style => style.lineWidth))
  useEffect(() => {
    const focus = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLSelectElement>('select')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
      if (event.key !== 'Tab') return
      const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? [])]
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', keydown, true)
    return () => { window.removeEventListener('keydown', keydown, true); focus?.focus() }
  }, [onClose])
  return <div className="macro-settings-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <form ref={dialog} className="macro-settings-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
      onSubmit={event => { event.preventDefault(); onSave({ ...draft, enabled: preferences.enabled }); onClose() }}>
      <header><strong id={`${id}-title`}>MFDI · Appearance</strong><button type="button" onClick={onClose} aria-label="Close MFDI settings">×</button></header>
      <div className="macro-settings-body">
        <p>Appearance applies across all currency tabs. Manage events, categories and their order in Series.</p>
        <label className="macro-setting-row">Value placement<select aria-label="MFDI value markers" value={draft.numberPlacement === 'above' ? 'above' : 'inside'}
          onChange={event => setDraft(current => ({ ...current, numberPlacement: event.target.value as 'inside' | 'above' }))}>
          <option value="inside">Inside rectangle</option><option value="above">Above marker</option>
        </select></label>
        <label className="macro-setting-row">Show value readout<input type="checkbox" aria-label="Show MFDI value readout" checked={draft.showReadout ?? false}
          onChange={event => setDraft(current => ({ ...current, showReadout: event.target.checked }))} /></label>
        <label className="macro-setting-row">Line width · all currencies<select aria-label="MFDI line width" value={widths.size === 1 ? [...widths][0] : 'mixed'}
          onChange={event => { const lineWidth = Number(event.target.value) as MacroStyle['lineWidth']; setDraft(current => ({ ...current, series: Object.fromEntries(Object.entries(current.series).map(([key, style]) => [key, { ...style, lineWidth }])) })) }}>
          <option value="mixed" disabled>Mixed</option>{[1, 2, 3, 4].map(width => <option key={width} value={width}>{width}</option>)}
        </select></label>
      </div>
      <footer><button type="button" onClick={() => setDraft(resetMacroAppearance)}>Reset appearance · all currencies</button>
        <button type="button" onClick={onClose}>Cancel</button><button type="submit">OK</button></footer>
    </form>
  </div>
}
