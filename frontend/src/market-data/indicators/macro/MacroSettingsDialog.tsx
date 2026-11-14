import { useEffect, useId, useRef, useState } from 'react'
import { macroCatalog } from './macro-catalog'
import { MacroPresetSettings } from './MacroPresetSettings'
import { readMacroPresets, writeMacroPresets } from './macro-presets'
import { MacroEventSelector } from './MacroEventSelector'
import { MacroCategorySettings } from './MacroCategorySettings'
import { MacroStyleSettings } from './MacroStyleSettings'
import { macroDefaultStyle, macroAxis, selectedMacroMetrics, selectMacroAxis, switchMacroCurrency, type MacroPreferences } from './macro-preferences'
import { majorCurrencies } from '../../../economic-calendar/forex/currencies'
import './macro-settings.css'

const tabs = ['Events', 'Layout', 'Style', 'Presets'] as const

export function MacroSettingsDialog({ preferences, onSave, onClose }: {
  preferences: MacroPreferences; onSave: (next: MacroPreferences) => void; onClose: () => void
}) {
  const [draft, setDraft] = useState(preferences), [tab, setTab] = useState<typeof tabs[number]>('Events')
  const [presets, setPresets] = useState(readMacroPresets), [error, setError] = useState('')
  const dialog = useRef<HTMLFormElement>(null), id = useId()
  useEffect(() => {
    const focus = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
      if (event.key !== 'Tab') return
      const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? [])]
        .filter(control => control.tabIndex >= 0 && !control.closest('[hidden]'))
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', keydown, true)
    return () => { window.removeEventListener('keydown', keydown, true); focus?.focus() }
  }, [onClose])
  return <div className="macro-settings-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <form ref={dialog} className="macro-settings-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
      onSubmit={event => { event.preventDefault(); try { writeMacroPresets(presets); onSave({ ...draft, enabled: preferences.enabled }); onClose() } catch { setError('Could not save presets. Export your presets before closing.'); setTab('Presets') } }}>
      <header><strong id={`${id}-title`}>MFDI · All symbols</strong><button type="button" onClick={onClose} aria-label="Close MFDI settings">×</button></header>
      <div className="macro-settings-tabs" role="tablist" aria-label="MFDI settings">
        {tabs.map(item => <button key={item} type="button" role="tab" id={`${id}-${item}`}
          aria-selected={tab === item} aria-controls={`${id}-${item}-panel`} tabIndex={tab === item ? 0 : -1}
          onKeyDown={event => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
              event.preventDefault()
              const index = tabs.indexOf(item)
              const next = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
              setTab(next); document.getElementById(`${id}-${next}`)?.focus()
            }
          }} onClick={() => setTab(item)}>{item}</button>)}
      </div>
      <div className="macro-settings-body">
        <label className="macro-setting-row">Currency setup<select aria-label="MFDI currency setup" value={draft.activeCurrency ?? draft.currencies?.[0] ?? 'USD'} onChange={event => setDraft(current => switchMacroCurrency(current, event.target.value))}>{majorCurrencies.map(currency => <option key={currency}>{currency}</option>)}</select></label>
        <section role="tabpanel" id={`${id}-Events-panel`} aria-labelledby={`${id}-Events`} hidden={tab !== 'Events'}>
          <MacroEventSelector key={draft.activeCurrency ?? 'all'} preferences={draft} onChange={setDraft} />
          <p>Selections apply to every symbol. Each currency remembers its selected events.</p>
        </section>
        <section role="tabpanel" id={`${id}-Layout-panel`} aria-labelledby={`${id}-Layout`} hidden={tab !== 'Layout'}>
          <label className="macro-setting-row">Right axis<select value={macroAxis(draft)} onChange={event => setDraft(current => selectMacroAxis(current, event.target.value))} disabled={!selectedMacroMetrics(draft).length}>
            {!selectedMacroMetrics(draft).length && <option value={draft.axisTarget}>No events selected</option>}
            {selectedMacroMetrics(draft).map(key => <option key={key} value={key}>{macroCatalog[key].controlLabel}</option>)}
          </select></label>
          <MacroCategorySettings preferences={draft} onChange={setDraft} />
          <p>Each event has its own scale. Use the chart lock to link movement and zoom, or switch to lanes to arrange events in rows.</p>
        </section>
        <section role="tabpanel" id={`${id}-Style-panel`} aria-labelledby={`${id}-Style`} hidden={tab !== 'Style'}>
          <MacroStyleSettings preferences={draft} onChange={setDraft} />
        </section>
        <section role="tabpanel" id={`${id}-Presets-panel`} aria-labelledby={`${id}-Presets`} hidden={tab !== 'Presets'}>
          <MacroPresetSettings preferences={draft} onChange={setDraft} presets={presets} onPresets={setPresets} />
        </section>
      </div>
      {error && <p className="macro-settings-error" role="alert">{error}</p>}
      <footer><button type="button" onClick={() => setDraft(current => ({ ...selectMacroAxis(current, selectedMacroMetrics(current)[0] ?? 'rate'), series: Object.fromEntries(Object.keys(current.series).map(key => [key, macroDefaultStyle(key)])) }))}>Reset defaults</button>
        <button type="button" onClick={onClose}>Cancel</button><button type="submit">OK</button></footer>
    </form>
  </div>
}
