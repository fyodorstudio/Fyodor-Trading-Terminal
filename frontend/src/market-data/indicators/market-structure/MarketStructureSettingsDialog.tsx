import { useEffect, useId, useRef, useState } from 'react'
import {
  confirmationCloseOptions, defaultMarketStructurePreferences, failureWindowOptions, lineWidths, maxAtrBufferPercent, swingStrengthLimits,
  marketStructureMarkerKinds, marketStructureMarkerLabels,
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
  const [tab, setTab] = useState<'inputs' | 'style'>('inputs')
  const [inputError, setInputError] = useState('')
  const dialog = useRef<HTMLFormElement>(null)
  const titleId = useId()
  const swingHelpId = useId()
  const bufferHelpId = useId()
  const confirmationHelpId = useId()
  const failureHelpId = useId()

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
      const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? [])]
        .filter(control => control.tabIndex >= 0)
      if (!controls.length) return
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
          if (!Number.isInteger(strength) || strength < swingStrengthLimits.min || strength > swingStrengthLimits.max ||
            !Number.isInteger(buffer) || buffer < 0 || buffer > maxAtrBufferPercent) {
            setInputError(`Enter a whole-number swing strength from ${swingStrengthLimits.min} to ${swingStrengthLimits.max} and an ATR buffer from 0 to ${maxAtrBufferPercent}%.`)
            setTab('inputs')
            return
          }
          onSave({ ...draft, enabled: preferences.enabled })
          onClose()
        }}>
        <header>
          <strong id={titleId}>Market Structure</strong>
          <button type="button" onClick={onClose} aria-label="Close Market Structure settings">×</button>
        </header>
        <div className="rsi-settings-tabs" role="tablist" aria-label="Market Structure settings">
          {(['inputs', 'style'] as const).map(item => (
            <button key={item} type="button" role="tab" id={`${titleId}-${item}`} aria-selected={tab === item}
              aria-controls={`${titleId}-panel`} tabIndex={tab === item ? 0 : -1}
              onClick={() => setTab(item)}
              onKeyDown={event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                event.preventDefault()
                const next = event.key === 'Home' ? 'inputs' : event.key === 'End' ? 'style' : item === 'inputs' ? 'style' : 'inputs'
                setTab(next)
                document.getElementById(`${titleId}-${next}`)?.focus()
              }}>{item === 'inputs' ? 'Inputs' : 'Style'}</button>
          ))}
        </div>
        <div className="rsi-settings-body market-structure-settings" role="tabpanel" id={`${titleId}-panel`} aria-labelledby={`${titleId}-${tab}`}>
          {tab === 'inputs' ? <>
          <fieldset>
            <legend>Detection</legend>
            <label>Swing strength
              <input type="number" min={swingStrengthLimits.min} max={swingStrengthLimits.max} step={1} required
                aria-describedby={swingHelpId} value={draft.swingStrength || ''}
                onChange={event => { setDraft({ ...draft, swingStrength: Number(event.target.value) }); setInputError('') }} />
            </label>
            <p id={swingHelpId}>Closed candles required on each side of a swing.</p>
            <label>ATR buffer (%)
              <input type="number" aria-describedby={bufferHelpId} min={0} max={maxAtrBufferPercent} step={1} required
                value={Number.isNaN(draft.atrBufferPercent) ? '' : draft.atrBufferPercent}
                onChange={event => { setDraft({ ...draft, atrBufferPercent: event.target.valueAsNumber }); setInputError('') }} />
            </label>
            <p id={bufferHelpId}>How far the first close must clear the level, as a percentage of the previous candle’s 14-period ATR.</p>
            <label>Closes beyond the level
              <select aria-describedby={confirmationHelpId} value={draft.confirmationCloses}
                onChange={event => setDraft({ ...draft, confirmationCloses: Number(event.target.value) })}>
                {confirmationCloseOptions.map(count => <option key={count} value={count}>{count} in a row</option>)}
              </select>
            </label>
            <p id={confirmationHelpId}>Consecutive closes needed to confirm a breakout.</p>
            <label>Failure window
              <select aria-describedby={failureHelpId} value={draft.failureWindow}
                onChange={event => setDraft({ ...draft, failureWindow: Number(event.target.value) })}>
                {failureWindowOptions.map(count => <option key={count} value={count}>
                  {count === 0 ? 'Off' : `${count} ${count === 1 ? 'candle' : 'candles'}`}
                </option>)}
              </select>
            </label>
            <p id={failureHelpId}>A close back through the level within this many candles after confirmation marks the breakout as failed.</p>
          </fieldset>
          {inputError && <p role="alert">{inputError}</p>}
          </> : <>
          <fieldset>
            <legend>Visibility</legend>
            <label>
              <span className="market-structure-line-setting"><span className="market-structure-line-sample dashed" aria-hidden="true" />Dashed lines</span>
              <input type="checkbox" aria-describedby={`${titleId}-dashed`} checked={draft.showDashedLines}
                onChange={event => setDraft({ ...draft, showDashedLines: event.target.checked })} />
            </label>
            <p id={`${titleId}-dashed`}>Levels without a confirmed breakout, including active swings, sweeps, and early failures.</p>
            <label>Show untouched levels
              <input type="checkbox" checked={draft.showUnbroken} disabled={!draft.showDashedLines}
                onChange={event => setDraft({ ...draft, showUnbroken: event.target.checked })} />
            </label>
            <label>
              <span className="market-structure-line-setting"><span className="market-structure-line-sample" aria-hidden="true" />Solid lines</span>
              <input type="checkbox" aria-describedby={`${titleId}-solid`} checked={draft.showSolidLines}
                onChange={event => setDraft({ ...draft, showSolidLines: event.target.checked })} />
            </label>
            <p id={`${titleId}-solid`}>Levels where a breakout reached confirmation, including breakouts that later failed.</p>
            <label>Auto Trendlines
              <input type="checkbox" aria-describedby={`${titleId}-trendlines`} checked={draft.showAutoTrendlines}
                onChange={event => {
                  const showAutoTrendlines = event.target.checked
                  const restoreCategories = showAutoTrendlines && !draft.showMajorTrendlines && !draft.showMinorTrendlines
                  setDraft({
                    ...draft, showAutoTrendlines,
                    showMajorTrendlines: restoreCategories || draft.showMajorTrendlines,
                    showMinorTrendlines: restoreCategories || draft.showMinorTrendlines,
                  })
                }} />
            </label>
            <p id={`${titleId}-trendlines`}>Draw rising support and falling resistance. Use M and m in the chart toolbar to filter major and minor lines.</p>
            <label>Show historical trendlines
              <input type="checkbox" aria-describedby={`${titleId}-trendline-history`}
                checked={draft.showHistoricalTrendlines} disabled={!draft.showAutoTrendlines}
                onChange={event => setDraft({ ...draft, showHistoricalTrendlines: event.target.checked })} />
            </label>
            <p id={`${titleId}-trendline-history`}>Keep earlier trendlines on the chart after they break or are replaced.</p>
            <label>Show signal markers
              <input type="checkbox" checked={draft.showMarkers}
                onChange={event => setDraft({ ...draft, showMarkers: event.target.checked })} />
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
          <fieldset>
            <legend>Marker colors</legend>
            {marketStructureMarkerKinds.map(kind => (
              <label key={kind}>{marketStructureMarkerLabels[kind]}
                <input type="color" value={draft.markerColors[kind]}
                  onChange={event => setDraft({ ...draft, markerColors: { ...draft.markerColors, [kind]: event.target.value } })} />
              </label>
            ))}
          </fieldset>
          </>}
        </div>
        <footer>
          <button type="button" onClick={() => { setDraft({ ...defaultMarketStructurePreferences, enabled: preferences.enabled }); setInputError('') }}>Reset defaults</button>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit">OK</button>
        </footer>
      </form>
    </div>
  )
}
