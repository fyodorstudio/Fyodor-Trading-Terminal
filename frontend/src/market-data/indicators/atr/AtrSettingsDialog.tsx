import { useEffect, useId, useRef, useState } from 'react'
import { defaultAtrPreferences, type AtrPreferences } from './atr-preferences'
import '../rsi/rsi.css'

export function AtrSettingsDialog({ preferences, onSave, onClose }: {
  preferences: AtrPreferences; onSave: (next: AtrPreferences) => void; onClose: () => void
}) {
  const [draft, setDraft] = useState(preferences)
  const [error, setError] = useState('')
  const dialog = useRef<HTMLFormElement>(null)
  const id = useId()
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
      if (event.key !== 'Tab') return
      const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? [])]
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', keydown, true)
    return () => { window.removeEventListener('keydown', keydown, true); previousFocus?.focus() }
  }, [onClose])
  return <div className="rsi-dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <form ref={dialog} className="rsi-settings-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
      onSubmit={event => {
        event.preventDefault()
        if (!Number.isInteger(draft.length) || draft.length < 1 || draft.length > 1000) {
          setError('ATR length must be a whole number from 1 to 1000.'); return
        }
        onSave({ ...draft, enabled: preferences.enabled }); onClose()
      }}>
      <header><strong id={`${id}-title`}>ATR</strong><button type="button" onClick={onClose} aria-label="Close ATR settings">×</button></header>
      <div className="rsi-settings-body">
        <fieldset><legend>Average True Range</legend>
          <label>ATR length<input aria-label="ATR length" type="number" min="1" max="1000" step="1" required value={draft.length}
            onChange={event => { setDraft({ ...draft, length: Number(event.target.value) }); setError('') }} /></label>
          <label>Line color<input type="color" aria-label="ATR color" value={draft.lineColor}
            onChange={event => setDraft({ ...draft, lineColor: event.target.value })} /></label>
          <label>Line thickness<select aria-label="ATR thickness" value={draft.lineWidth}
            onChange={event => setDraft({ ...draft, lineWidth: Number(event.target.value) as AtrPreferences['lineWidth'] })}>
            {[1, 2, 3, 4].map(width => <option key={width} value={width}>{width} px</option>)}
          </select></label>
        </fieldset>
        <p>Wilder smoothing (RMA) of true range, including price gaps. Values use price units and the chart timeframe, and update with the current candle. Settings are shared across all symbols and timeframes.</p>
        {error && <p role="alert">{error}</p>}
      </div>
      <footer><button type="button" onClick={() => { setDraft({ ...defaultAtrPreferences, enabled: preferences.enabled }); setError('') }}>Reset defaults</button>
        <button type="button" onClick={onClose}>Cancel</button><button type="submit">OK</button></footer>
    </form>
  </div>
}
