import { useEffect, useId, useRef, useState } from 'react'
import { macroMetrics } from './macro-data'
import { defaultMacroPreferences, macroAxes, macroAxis, macroGroups, selectMacroAxis, type MacroMetric, type MacroPreferences, type MacroStyle } from './macro-preferences'
import '../rsi/rsi.css'

export function MacroSettingsDialog({ preferences, onSave, onClose }: {
  preferences: MacroPreferences; onSave: (next: MacroPreferences) => void; onClose: () => void
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
    <form ref={dialog} className="rsi-settings-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
      onSubmit={event => { event.preventDefault(); onSave({ ...draft, enabled: preferences.enabled }); onClose() }}>
      <header><strong id={`${id}-title`}>MFDI</strong><button type="button" onClick={onClose} aria-label="Close MFDI settings">×</button></header>
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
          <p>Macro Factor Data Inspector · USDX / USD</p>
          <label>Right axis<select value={macroAxis(draft)} onChange={event => setDraft(current => selectMacroAxis(current, event.target.value as MacroPreferences['axisTarget']))}>
            {macroAxes.map(axis => <option key={axis.id} value={axis.id}>{axis.label}</option>)}</select></label>
          {macroGroups.map(group => <fieldset key={group.id}><legend>{group.label}</legend>
            {group.metrics.map(key => <label key={key}>Show {macroMetrics[key].label}<input type="checkbox" checked={draft.series[key].visible}
              onChange={event => patchStyle(key, { visible: event.target.checked })} /></label>)}
          </fieldset>)}
          <p>Released actuals from stored MT5 history, with saved official Fed values where available. Payrolls are in thousands; other values are percentages. Inflation uses monthly changes. Fed rate is the target upper bound.</p>
          <p>Each series has its own eye button in the pane. Click its label to select its right axis; a hidden series is revealed. Fed Rate, Payrolls, Unemployment and Inflation use independent scales; both CPI lines share Inflation. Each scale holds its zoom and position across date scrolling, history loading and axis changes. Use Fit axis or double-click the right axis to fit the selected scale again.</p>
          <p>Release dates align to their containing candle. Monthly lines join released points; only the policy rate is held between releases. The readout carries the latest known actual and shows its release date. No smoothing or composite score.</p>
          <p>Hover a Fed release dot for Investing.com consensus, Trading Economics survey consensus and saved CME FedWatch probabilities. A short dashed connector shows Investing.com's forecast; a Beat outlines the actual dot. Miss and In line are labelled in the tooltip. Historical backfills retain their retrieval clocks; missing evidence stays Unavailable. Forecasts never resize your axes.</p>
          <p>Click a plotted release dot to open its exact package in Inspector. Dashed vertical lines in empty future space show verified upcoming schedules for visible series, with one line per same-time package.</p>
          <p>History uses latest stored vintages. Missing actuals and unverified clocks stay blank. Scroll left to load more release points.</p>
        </> : <>
          {(Object.keys(macroMetrics) as MacroMetric[]).map(key => <fieldset key={key}><legend>{macroMetrics[key].label} · Line</legend>
            <label>{macroMetrics[key].label} colour<input type="color" value={draft.series[key].color} onChange={event => patchStyle(key, { color: event.target.value })} /></label>
              <label>{macroMetrics[key].label} line width<select value={draft.series[key].lineWidth} onChange={event => patchStyle(key, { lineWidth: Number(event.target.value) as MacroStyle['lineWidth'] })}>
                {[1, 2, 3, 4].map(width => <option key={width} value={width}>{width}</option>)}</select></label>
              <label>Show {macroMetrics[key].label} dots<input type="checkbox" checked={draft.series[key].pointsVisible} onChange={event => patchStyle(key, { pointsVisible: event.target.checked })} /></label>
          </fieldset>)}
        </>}
      </div>
      <footer><button type="button" onClick={() => setDraft({ ...defaultMacroPreferences, enabled: preferences.enabled })}>Reset defaults</button>
        <button type="button" onClick={onClose}>Cancel</button><button type="submit">OK</button></footer>
    </form>
  </div>
}
