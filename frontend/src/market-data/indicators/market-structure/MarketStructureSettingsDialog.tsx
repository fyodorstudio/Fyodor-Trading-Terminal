import { useEffect, useId, useRef, useState } from 'react'
import {
  defaultMarketStructurePreferences, lineWidths, swingStrengthLimits, type MarketStructurePreferences,
} from './market-structure-preferences'
import '../rsi/rsi.css'

export function MarketStructureSettingsDialog({ preferences, onSave, onClose }: {
  preferences: MarketStructurePreferences
  onSave: (next: MarketStructurePreferences) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(preferences)
  const dialog = useRef<HTMLFormElement>(null)
  const titleId = useId()
  const descriptionId = useId()

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
      const controls = dialog.current?.querySelectorAll<HTMLElement>('button, input, select')
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
          onSave({ ...draft, enabled: preferences.enabled })
          onClose()
        }}>
        <header>
          <strong id={titleId}>Market Structure</strong>
          <button type="button" onClick={onClose} aria-label="Close Market Structure settings">×</button>
        </header>
        <div className="rsi-settings-body">
          <fieldset>
            <legend>Swing detection</legend>
            <label>Swing strength
              <input type="number" min={swingStrengthLimits.min} max={swingStrengthLimits.max} step={1} required
                aria-describedby={descriptionId} value={draft.swingStrength || ''}
                onChange={event => setDraft({ ...draft, swingStrength: Number(event.target.value) })} />
            </label>
            <label>Confirm break by
              <select value={draft.breakBy} onChange={event => setDraft({ ...draft, breakBy: event.target.value === 'wick' ? 'wick' : 'close' })}>
                <option value="close">Candle close</option>
                <option value="wick">Candle wick</option>
              </select>
            </label>
            <label>Show unbroken levels
              <input type="checkbox" checked={draft.showUnbroken}
                onChange={event => setDraft({ ...draft, showUnbroken: event.target.checked })} />
            </label>
            <p id={descriptionId}>Swing strength is the number of candles required on each side of a swing. Breaks are checked against the latest confirmed swing high and low after each candle closes.</p>
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
