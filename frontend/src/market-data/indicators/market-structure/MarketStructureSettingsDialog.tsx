import { useEffect, useId, useRef, useState } from 'react'
import {
  confirmationCloseOptions, defaultMarketStructurePreferences, lineWidths, maxAtrBufferPercent, swingStrengthLimits,
  type MarketStructurePreferences,
} from './market-structure-preferences'
import '../rsi/rsi.css'
import './market-structure.css'

export function MarketStructureSettingsDialog({ preferences, onSave, onClose }: {
  preferences: MarketStructurePreferences
  onSave: (next: MarketStructurePreferences) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(preferences)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const dialog = useRef<HTMLFormElement>(null)
  const titleId = useId()
  const swingHelpId = useId()
  const bufferHelpId = useId()
  const confirmationHelpId = useId()
  const advancedId = useId()

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    dialog.current?.querySelector('button')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
      if (event.key !== 'Tab') return
      const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')
      if (!controls?.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', keydown, true)
    return () => {
      window.removeEventListener('keydown', keydown, true)
      previousFocus?.focus()
    }
  }, [onClose])

  return (
    <div className="rsi-dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <form ref={dialog} className="rsi-settings-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}
        onSubmit={event => {
          event.preventDefault()
          const buffer = draft.atrBufferPercent
          const strength = draft.swingStrength
          onSave({
            ...draft,
            swingStrength: Number.isInteger(strength) && strength >= swingStrengthLimits.min && strength <= swingStrengthLimits.max
              ? strength : preferences.swingStrength,
            atrBufferPercent: Number.isInteger(buffer) && buffer >= 0 && buffer <= maxAtrBufferPercent
              ? buffer : preferences.atrBufferPercent,
            enabled: preferences.enabled,
          })
          onClose()
        }}>
        <header>
          <strong id={titleId}>Market Structure</strong>
          <button type="button" onClick={onClose} aria-label="Close Market Structure settings">×</button>
        </header>
        <div className="rsi-settings-body market-structure-settings">
          <fieldset>
            <legend>Visibility</legend>
            <label>Show signal labels
              <input type="checkbox" checked={draft.showLabels}
                onChange={event => setDraft({ ...draft, showLabels: event.target.checked })} />
            </label>
            <label>Show unbroken levels
              <input type="checkbox" checked={draft.showUnbroken}
                onChange={event => setDraft({ ...draft, showUnbroken: event.target.checked })} />
            </label>
          </fieldset>
          <fieldset>
            <legend>Appearance</legend>
            <label>Swing high color
              <input type="color" value={draft.highColor} onChange={event => setDraft({ ...draft, highColor: event.target.value })} />
            </label>
            <label>Swing low color
              <input type="color" value={draft.lowColor} onChange={event => setDraft({ ...draft, lowColor: event.target.value })} />
            </label>
            <label>Line thickness
              <select value={draft.lineWidth} onChange={event => setDraft({ ...draft, lineWidth: Number(event.target.value) })}>
                {lineWidths.map(width => <option key={width} value={width}>{width} px</option>)}
              </select>
            </label>
          </fieldset>
          <button type="button" aria-expanded={advancedOpen} aria-controls={advancedId}
            onClick={() => setAdvancedOpen(open => !open)}>Advanced</button>
          <div id={advancedId} hidden={!advancedOpen}>
            {advancedOpen && <fieldset>
              <legend>Detection</legend>
              <label>Swing strength
                <input type="number" min={swingStrengthLimits.min} max={swingStrengthLimits.max} step={1} required
                  aria-describedby={swingHelpId} value={draft.swingStrength || ''}
                  onChange={event => setDraft({ ...draft, swingStrength: Number(event.target.value) })} />
              </label>
              <p id={swingHelpId}>Closed candles required on each side of a swing.</p>
              <label>Closes beyond the level
                <select aria-describedby={confirmationHelpId} value={draft.confirmationCloses}
                  onChange={event => setDraft({ ...draft, confirmationCloses: Number(event.target.value) })}>
                  {confirmationCloseOptions.map(count => <option key={count} value={count}>{count} in a row</option>)}
                </select>
              </label>
              <p id={confirmationHelpId}>Consecutive closes needed to confirm a breakout.</p>
              <label>ATR buffer (%)
                <input type="number" aria-describedby={bufferHelpId} min={0} max={maxAtrBufferPercent} step={1} required
                  value={Number.isNaN(draft.atrBufferPercent) ? '' : draft.atrBufferPercent}
                  onChange={event => setDraft({ ...draft, atrBufferPercent: event.target.valueAsNumber })} />
              </label>
              <p id={bufferHelpId}>How far the first close must clear the level, as a percentage of the previous candle’s 14-period ATR. Set to 0 to disable the buffer.</p>
            </fieldset>}
          </div>
        </div>
        <footer>
          <button type="button" onClick={() => setDraft({ ...defaultMarketStructurePreferences, enabled: preferences.enabled })}>Reset defaults</button>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit">OK</button>
        </footer>
      </form>
    </div>
  )
}
