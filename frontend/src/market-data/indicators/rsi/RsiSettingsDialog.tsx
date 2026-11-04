import { useEffect, useId, useRef, useState } from 'react'
import { defaultRsiPreferences, rsiSources, rsiSmoothingTypes, type RsiPreferences } from './rsi-preferences'
import './rsi.css'

export function RsiSettingsDialog({ preferences, onSave, onClose }: {
  preferences: RsiPreferences; onSave: (next: RsiPreferences) => void; onClose: () => void
}) {
  const [draft, setDraft] = useState(preferences)
  const [tab, setTab] = useState<'inputs' | 'style'>('inputs')
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
        .filter(control => control.tabIndex >= 0)
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', keydown, true)
    return () => { window.removeEventListener('keydown', keydown, true); previousFocus?.focus() }
  }, [onClose])
  const patch = (next: Partial<RsiPreferences>) => { setDraft(current => ({ ...current, ...next })); setError('') }
  return <div className="rsi-dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <form ref={dialog} className="rsi-settings-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
      onSubmit={event => {
        event.preventDefault()
        if (![draft.length, draft.smoothingLength].every(value => Number.isInteger(value) && value >= 1 && value <= 1000)) {
          setError('Lengths must be whole numbers from 1 to 1000.'); setTab('inputs'); return
        }
        if (![draft.upper.value, draft.middle.value, draft.lower.value, draft.fillOpacity].every(value => Number.isInteger(value) && value >= 0 && value <= 100)) {
          setError('Bands and opacity must be whole numbers from 0 to 100.'); setTab('style'); return
        }
        if (!(draft.lower.value < draft.middle.value && draft.middle.value < draft.upper.value)) {
          setError('Bands must be ordered: lower < middle < upper.'); setTab('style'); return
        }
        onSave({ ...draft, enabled: preferences.enabled }); onClose()
      }}>
      <header><strong id={`${id}-title`}>RSI</strong><button type="button" onClick={onClose} aria-label="Close RSI settings">×</button></header>
      <div className="rsi-settings-tabs" role="tablist" aria-label="RSI settings">
        {(['inputs', 'style'] as const).map(item => <button key={item} type="button" role="tab" id={`${id}-${item}`}
          aria-selected={tab === item} aria-controls={`${id}-panel`} tabIndex={tab === item ? 0 : -1}
          onKeyDown={event => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
              event.preventDefault()
              const next = event.key === 'Home' ? 'inputs' : event.key === 'End' ? 'style' : tab === 'inputs' ? 'style' : 'inputs'
              setTab(next); document.getElementById(`${id}-${next}`)?.focus()
            }
          }} onClick={() => setTab(item)}>{item === 'inputs' ? 'Inputs' : 'Style'}</button>)}
      </div>
      <div className="rsi-settings-body" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`}>
        {tab === 'inputs' ? <>
          <fieldset><legend>RSI settings</legend>
            <label><span>RSI length</span><input aria-label="RSI length" type="number" min="1" max="1000" step="1" required value={draft.length}
              onChange={event => patch({ length: Number(event.target.value) })} /></label>
            <label><span>Source</span><select value={draft.source} onChange={event => patch({ source: event.target.value as RsiPreferences['source'] })}>
              {rsiSources.map(source => <option key={source}>{source}</option>)}</select></label>
          </fieldset>
          <fieldset><legend>Smoothing</legend>
            <label><span>Type</span><select value={draft.smoothing} onChange={event => patch({ smoothing: event.target.value as RsiPreferences['smoothing'] })}>
              {rsiSmoothingTypes.map(type => <option key={type}>{type}</option>)}</select></label>
            <label><span>Smoothing length</span><input type="number" min="1" max="1000" step="1" required disabled={draft.smoothing === 'None'}
              value={draft.smoothingLength} onChange={event => patch({ smoothingLength: Number(event.target.value) })} /></label>
          </fieldset>
          <p>Uses the chart timeframe and updates with the current candle. Settings are shared across all symbols and timeframes.</p>
        </> : <>
          <fieldset><legend>Lines</legend>
            {(['line', 'average'] as const).map(kind => {
              const visible = kind === 'line' ? 'lineVisible' : 'averageVisible'
              const color = kind === 'line' ? 'lineColor' : 'averageColor'
              const width = kind === 'line' ? 'lineWidth' : 'averageWidth'
              const name = kind === 'line' ? 'RSI' : 'RSI-based MA'
              return <div className="rsi-style-row" key={kind}>
                <label><input type="checkbox" checked={draft[visible]} onChange={event => patch({ [visible]: event.target.checked })} /><span>{name}</span></label>
                <input type="color" aria-label={`${name} color`} value={draft[color]} onChange={event => patch({ [color]: event.target.value })} />
                <select aria-label={`${name} thickness`} value={draft[width]} onChange={event => patch({ [width]: Number(event.target.value) })}>
                  {[1, 2, 3, 4].map(width => <option key={width} value={width}>{width} px</option>)}
                </select>
              </div>
            })}
          </fieldset>
          <fieldset><legend>Bands</legend>
            {(['upper', 'middle', 'lower'] as const).map(key => <div className="rsi-style-row" key={key}>
              <label><input type="checkbox" checked={draft[key].visible} onChange={event => patch({ [key]: { ...draft[key], visible: event.target.checked } })} />
                <span>{key === 'upper' ? 'Upper' : key === 'middle' ? 'Middle' : 'Lower'} band</span></label>
              <input type="color" aria-label={`${key} band color`} value={draft[key].color} onChange={event => patch({ [key]: { ...draft[key], color: event.target.value } })} />
              <input type="number" aria-label={`${key} band value`} min="0" max="100" step="1" required value={draft[key].value}
                onChange={event => patch({ [key]: { ...draft[key], value: Number(event.target.value) } })} />
            </div>)}
          </fieldset>
          <fieldset><legend>Background</legend>
            <div className="rsi-style-row">
              <label><input type="checkbox" checked={draft.fillVisible} onChange={event => patch({ fillVisible: event.target.checked })} /><span>Band fill</span></label>
              <input type="color" aria-label="Band fill color" value={draft.fillColor} onChange={event => patch({ fillColor: event.target.value })} />
              <label><input type="number" aria-label="Band fill opacity" min="0" max="100" step="1" required value={draft.fillOpacity}
                onChange={event => patch({ fillOpacity: Number(event.target.value) })} /><span>%</span></label>
            </div>
          </fieldset>
        </>}
        {error && <p role="alert">{error}</p>}
      </div>
      <footer><button type="button" onClick={() => { setDraft({ ...defaultRsiPreferences, enabled: preferences.enabled }); setError('') }}>Reset defaults</button>
        <button type="button" onClick={onClose}>Cancel</button><button type="submit">OK</button></footer>
    </form>
  </div>
}
