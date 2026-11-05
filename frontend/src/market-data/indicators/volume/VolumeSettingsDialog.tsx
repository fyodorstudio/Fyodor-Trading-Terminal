import { useEffect, useId, useRef, useState } from 'react'
import { defaultVolumePreferences, type VolumePreferences } from './volume-preferences'
import '../rsi/rsi.css'

export function VolumeSettingsDialog({ preferences, onSave, onClose }: {
  preferences: VolumePreferences; onSave: (next: VolumePreferences) => void; onClose: () => void
}) {
  const [draft, setDraft] = useState(preferences), [error, setError] = useState('')
  const [tab, setTab] = useState<'inputs' | 'style'>('inputs')
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
  const patch = (next: Partial<VolumePreferences>) => { setDraft(current => ({ ...current, ...next })); setError('') }
  return <div className="rsi-dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <form ref={dialog} className="rsi-settings-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
      onSubmit={event => {
        event.preventDefault()
        if (!Number.isInteger(draft.lookback) || draft.lookback < 5 || draft.lookback > 60 ||
          !Number.isInteger(draft.minimumSamples) || draft.minimumSamples < 1 || draft.minimumSamples > draft.lookback ||
          !Number.isInteger(draft.averageLength) || draft.averageLength < 1 || draft.averageLength > 200) {
          setError('Use 5–60 previous sessions, minimum samples from 1 to previous sessions, and an average length from 1 to 200.'); setTab('inputs'); return
        }
        onSave({ ...draft, enabled: preferences.enabled }); onClose()
      }}>
      <header><strong id={`${id}-title`}>Volume · Ticks</strong><button type="button" onClick={onClose} aria-label="Close Volume settings">×</button></header>
      <div className="rsi-settings-tabs" role="tablist" aria-label="Volume settings">
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
        <fieldset><legend>Activity data</legend>
          <label>Mode<select value={draft.mode} onChange={event => patch({ mode: event.target.value as VolumePreferences['mode'] })}>
            <option value="raw">Raw ticks</option><option value="relative">Relative activity</option></select></label>
          <label>Previous sessions<input aria-label="Previous sessions" type="number" min="5" max="60" required value={draft.lookback} onChange={event => patch({ lookback: Number(event.target.value) })} /></label>
          <label>Minimum samples<input aria-label="Minimum samples" type="number" min="1" max={draft.lookback} required value={draft.minimumSamples} onChange={event => patch({ minimumSamples: Number(event.target.value) })} /></label>
          <p>Sessions are automatic, including overlaps and daylight saving. Relative values compare matching candles in earlier sessions; D1 uses earlier daily bars.</p>
          <p>Missing history stays blank. Scroll left to build the baseline. Uses earlier candles only.</p>
        </fieldset>
        <fieldset><legend>Raw tick average</legend>
          <label>Average length<input aria-label="Average length" type="number" min="1" max="200" required disabled={!draft.averageVisible} value={draft.averageLength} onChange={event => patch({ averageLength: Number(event.target.value) })} /></label>
          <p>Optional average for Raw bars, enabled in Style. This does not smooth the Relative activity line.</p>
        </fieldset>
        </> : <>
        <fieldset><legend>Pane</legend>
          <label>Right axis<select value={draft.axisTarget} onChange={event => patch({ axisTarget: event.target.value as VolumePreferences['axisTarget'] })}>
            <option value="volume">Volume bars</option><option value="relative">Relative line</option></select></label>
        </fieldset>
        <fieldset><legend>Volume bars</legend>
          <label>Show volume bars<input type="checkbox" checked={draft.barsVisible} onChange={event => patch({ barsVisible: event.target.checked })} /></label>
          <label>Up candle colour<input type="color" value={draft.upColor} onChange={event => patch({ upColor: event.target.value })} /></label>
          <label>Down candle colour<input type="color" value={draft.downColor} onChange={event => patch({ downColor: event.target.value })} /></label>
        </fieldset>
        <fieldset><legend>Relative activity</legend>
          <label>Show Relative activity line<input type="checkbox" checked={draft.relativeLineVisible} onChange={event => patch({ relativeLineVisible: event.target.checked })} /></label>
          <label>Relative line colour<input type="color" value={draft.relativeLineColor} onChange={event => patch({ relativeLineColor: event.target.value })} /></label>
          <p>Exact values, with no smoothing. Choose which series the right axis resizes; the other keeps its own automatic scale. Relative bars share the × scale. The dashed 1× line marks normal activity.</p>
        </fieldset>
        <fieldset><legend>Raw tick average</legend>
          <label>Show raw tick average<input type="checkbox" checked={draft.averageVisible} onChange={event => patch({ averageVisible: event.target.checked })} /></label>
          <label>Average colour<input type="color" value={draft.averageColor} onChange={event => patch({ averageColor: event.target.value })} /></label>
        </fieldset>
        </>}
        {error && <p role="alert">{error}</p>}
      </div>
      <footer><button type="button" onClick={() => { setDraft({ ...defaultVolumePreferences, enabled: preferences.enabled }); setError('') }}>Reset defaults</button>
        <button type="button" onClick={onClose}>Cancel</button><button type="submit">OK</button></footer>
    </form>
  </div>
}
