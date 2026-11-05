import { useEffect, useId, useRef, useState } from 'react'
import { defaultVolumePreferences, type VolumePreferences } from './volume-preferences'
import '../rsi/rsi.css'

export function VolumeSettingsDialog({ preferences, onSave, onClose }: {
  preferences: VolumePreferences; onSave: (next: VolumePreferences) => void; onClose: () => void
}) {
  const [draft, setDraft] = useState(preferences), [error, setError] = useState('')
  const dialog = useRef<HTMLFormElement>(null), id = useId()
  useEffect(() => {
    const focus = document.activeElement as HTMLElement | null
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
          setError('Use 5–60 previous sessions, minimum samples from 1 to previous sessions, and an average length from 1 to 200.'); return
        }
        onSave({ ...draft, enabled: preferences.enabled }); onClose()
      }}>
      <header><strong id={`${id}-title`}>Volume · Ticks</strong><button type="button" onClick={onClose} aria-label="Close Volume settings">×</button></header>
      <div className="rsi-settings-body">
        <fieldset><legend>Activity display</legend>
          <label>Mode<select value={draft.mode} onChange={event => patch({ mode: event.target.value as VolumePreferences['mode'] })}>
            <option value="raw">Raw ticks</option><option value="relative">Relative activity</option></select></label>
          <p>Sessions are automatic: hover a candle to see its session or overlap; move away to see the current session. Uses the same regional hours as the header, with daylight saving.</p>
          <label>Previous sessions<input type="number" min="5" max="60" required value={draft.lookback} onChange={event => patch({ lookback: Number(event.target.value) })} /></label>
          <label>Minimum samples<input type="number" min="1" max={draft.lookback} required value={draft.minimumSamples} onChange={event => patch({ minimumSamples: Number(event.target.value) })} /></label>
          <p>Relative bars compare activity with matching candles in up to {draft.lookback} earlier occurrences of the same session or overlap. Matching uses the same time into that session period. D1 compares earlier daily bars.</p>
          <p>At least {draft.minimumSamples} prior samples are needed. Missing history stays blank. Scroll left or use Load older in the pane to build the baseline; no future candles enter it.</p>
        </fieldset>
        <fieldset><legend>Style</legend>
          <label>Up candle colour<input type="color" value={draft.upColor} onChange={event => patch({ upColor: event.target.value })} /></label>
          <label>Down candle colour<input type="color" value={draft.downColor} onChange={event => patch({ downColor: event.target.value })} /></label>
          <label>Show raw tick average<input type="checkbox" checked={draft.averageVisible} onChange={event => patch({ averageVisible: event.target.checked })} /></label>
          <label>Average length<input type="number" min="1" max="200" required value={draft.averageLength} onChange={event => patch({ averageLength: Number(event.target.value) })} /></label>
          <label>Average colour<input type="color" value={draft.averageColor} onChange={event => patch({ averageColor: event.target.value })} /></label>
          <p>Bar colours follow candle direction. They do not measure buy or sell volume. Relative mode shows a 1× normal-activity line.</p>
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </div>
      <footer><button type="button" onClick={() => { setDraft({ ...defaultVolumePreferences, enabled: preferences.enabled }); setError('') }}>Reset defaults</button>
        <button type="button" onClick={onClose}>Cancel</button><button type="submit">OK</button></footer>
    </form>
  </div>
}
