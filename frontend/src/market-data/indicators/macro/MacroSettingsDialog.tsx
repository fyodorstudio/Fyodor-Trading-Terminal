import { useEffect, useId, useRef, useState } from 'react'
import { macroCatalog } from './macro-catalog'
import { MacroEventSelector } from './MacroEventSelector'
import { MacroCategorySettings } from './MacroCategorySettings'
import { macroDefaultStyle, macroAxis, selectedMacroMetrics, selectMacroAxis, type MacroMetric, type MacroPreferences, type MacroStyle } from './macro-preferences'
import '../rsi/rsi.css'
import './macro.css'

export function MacroSettingsDialog({ preferences, onSave, onClose, symbol = 'USDX' }: {
  preferences: MacroPreferences; symbol?: string; onSave: (next: MacroPreferences) => void; onClose: () => void
}) {
  const [draft, setDraft] = useState(preferences), [tab, setTab] = useState<'inputs' | 'style'>('inputs')
  const dialog = useRef<HTMLFormElement>(null), id = useId()
  useEffect(() => {
    const focus = document.activeElement as HTMLElement | null
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
    return () => { window.removeEventListener('keydown', keydown, true); focus?.focus() }
  }, [onClose])
  const patchStyle = (key: MacroMetric, patch: Partial<MacroStyle>) => setDraft(current => ({ ...current,
    series: { ...current.series, [key]: { ...current.series[key], ...patch } } }))
  return <div className="rsi-dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <form ref={dialog} className="rsi-settings-dialog macro-settings-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
      onSubmit={event => { event.preventDefault(); onSave({ ...draft, enabled: preferences.enabled }); onClose() }}>
      <header><strong id={`${id}-title`}>MFDI · {symbol}</strong><button type="button" onClick={onClose} aria-label="Close MFDI settings">×</button></header>
      <div className="rsi-settings-tabs" role="tablist" aria-label="MFDI settings">
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
          <MacroEventSelector preferences={draft} onChange={setDraft} />
          <MacroCategorySettings preferences={draft} onChange={setDraft} />
          <label>Right axis<select value={macroAxis(draft)} onChange={event => setDraft(current => selectMacroAxis(current, event.target.value))} disabled={!selectedMacroMetrics(draft).length}>
            {!selectedMacroMetrics(draft).length && <option value={draft.axisTarget}>No events selected</option>}
            {selectedMacroMetrics(draft).map(key => <option key={key} value={key}>{macroCatalog[key].controlLabel}</option>)}
          </select></label>
          <p>Event selections are remembered by currency. Ticking a currency restores its saved events. Each chart symbol remembers which currencies are enabled.</p>
          <p>Each event uses an independent scale. The lock links movement and zoom; the three-line button switches to straight category lanes. Values, arrows, hover and release selection remain available.</p>
        </> : <>
          {selectedMacroMetrics(draft).map(key => <fieldset key={key}><legend>{macroCatalog[key].label} · Line</legend>
            <label>{macroCatalog[key].label} colour<input type="color" value={draft.series[key].color} onChange={event => patchStyle(key, { color: event.target.value })} /></label>
              <label>{macroCatalog[key].label} line width<select value={draft.series[key].lineWidth} onChange={event => patchStyle(key, { lineWidth: Number(event.target.value) as MacroStyle['lineWidth'] })}>
                {[1, 2, 3, 4].map(width => <option key={width} value={width}>{width}</option>)}</select></label>
              <label>Show {macroCatalog[key].label} dots<input type="checkbox" checked={draft.series[key].pointsVisible} onChange={event => patchStyle(key, { pointsVisible: event.target.checked })} /></label>
              <label>Show {macroCatalog[key].label} numbers<input type="checkbox" checked={draft.series[key].numbersVisible} onChange={event => patchStyle(key, { numbersVisible: event.target.checked })} /></label>
              <label>Show {macroCatalog[key].label} forecasts<input type="checkbox" checked={draft.series[key].forecastVisible} onChange={event => patchStyle(key, { forecastVisible: event.target.checked })} /></label>
          </fieldset>)}
        </>}
      </div>
      <footer><button type="button" onClick={() => setDraft(current => ({ ...current, axisTarget: selectedMacroMetrics(current)[0] ?? 'rate', series: Object.fromEntries(Object.keys(current.series).map(key => [key, macroDefaultStyle(key)])) }))}>Reset defaults</button>
        <button type="button" onClick={onClose}>Cancel</button><button type="submit">OK</button></footer>
    </form>
  </div>
}
