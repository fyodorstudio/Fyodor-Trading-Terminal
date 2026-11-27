import { useEffect, useId, useRef, useState } from 'react'
import { defaultVolumeProfilePreferences, profileModeOptions, type VolumeProfilePreferences } from './volume-profile-preferences'
import { VolumeProfilePreloadControls } from './VolumeProfilePreloadControls'
import './volume-profile.css'
import '../rsi/rsi.css'

const colorOptions = [['bars', 'Profile bars'], ['POC', 'Point of control'], ['HVN', 'High-volume nodes'], ['LVN', 'Low-volume nodes']] as const

export function VolumeProfileSettingsDialog({ preferences, symbol, connected, brokerOffset, onSave, onClose }: {
  preferences: VolumeProfilePreferences; onSave: (value: VolumeProfilePreferences) => void; onClose: () => void
  symbol: string; connected: boolean; brokerOffset: number
}) {
  const [draft, setDraft] = useState(preferences)
  const [tab, setTab] = useState<'inputs' | 'style'>('inputs')
  const dialog = useRef<HTMLFormElement>(null), id = useId()
  useEffect(() => {
    const focus = document.activeElement as HTMLElement | null
    dialog.current?.querySelector('button')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
      if (event.key !== 'Tab') return
      const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button, input, select') ?? [])]
        .filter(control => control.tabIndex >= 0)
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', keydown, true)
    return () => { window.removeEventListener('keydown', keydown, true); focus?.focus() }
  }, [onClose])
  const patch = (values: Partial<VolumeProfilePreferences>) => setDraft(current => ({ ...current, ...values }))
  return <div className="rsi-dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <form ref={dialog} className="rsi-settings-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
      onSubmit={event => { event.preventDefault(); onSave(draft); onClose() }}>
      <header><strong id={`${id}-title`}>Volume Profile</strong><button type="button" onClick={onClose} aria-label="Close Volume Profile settings">×</button></header>
      <div className="rsi-settings-tabs" role="tablist" aria-label="Volume Profile settings">
        {(['inputs', 'style'] as const).map(item => <button key={item} type="button" role="tab" id={`${id}-${item}`}
          aria-selected={tab === item} aria-controls={`${id}-panel`} tabIndex={tab === item ? 0 : -1}
          onClick={() => setTab(item)} onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const next = event.key === 'Home' ? 'inputs' : event.key === 'End' ? 'style' : item === 'inputs' ? 'style' : 'inputs'
            setTab(next); document.getElementById(`${id}-${next}`)?.focus()
          }}>{item === 'inputs' ? 'Inputs' : 'Style'}</button>)}
      </div>
      <div className="rsi-settings-body" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`}>
        {tab === 'inputs' ? <><fieldset><legend>Profile data</legend>
          <label>Range<select value={draft.mode} onChange={event => patch({ mode: event.target.value as VolumeProfilePreferences['mode'] })}>
            {profileModeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          {draft.mode === 'visible' && <label>Lookback in minutes<input type="number" min="1" step="1" required
            value={draft.lookbackMinutes || ''} onChange={event => patch({ lookbackMinutes: Number(event.target.value) })} /></label>}
          <p>Uses exact tick prices where MT5 provides history.</p>
        </fieldset><VolumeProfilePreloadControls symbol={symbol} connected={connected} brokerOffset={brokerOffset} />
        </> : <fieldset><legend>Histogram</legend>
          <label>Placement<select value={draft.side} onChange={event => patch({ side: event.target.value as VolumeProfilePreferences['side'] })}>
            <option value="left">Left</option><option value="right">Right</option>
          </select></label>
          {colorOptions.map(([key, label]) => <label key={key}>{label}<input type="color" value={draft.colors[key]}
            onChange={event => patch({ colors: { ...draft.colors, [key]: event.target.value } })} /></label>)}
        </fieldset>}
      </div>
      <footer><button type="button" onClick={() => setDraft(defaultVolumeProfilePreferences)}>Reset defaults</button>
        <button type="button" onClick={onClose}>Cancel</button><button type="submit">OK</button></footer>
    </form>
  </div>
}
