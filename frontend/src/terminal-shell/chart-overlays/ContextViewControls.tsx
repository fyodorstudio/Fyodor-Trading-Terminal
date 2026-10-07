import { useCallback, useState } from 'react'
import { saveSequencePreferences, useSequencePreferences } from '../../usd-context/sequences/storage/sequence-preferences'
import { RoofGuide } from '../../usd-context/sequences/ui/RoofGuide'

export function ContextViewControls({ symbol, supported }: { symbol: string; supported: boolean }) {
  const preferences = useSequencePreferences(), [guide, setGuide] = useState(false)
  const close = useCallback(() => setGuide(false), [])
  const relativeSupported = /^EURUSD(?:[._-].*|[a-z]*)$/i.test(symbol)
  return <div className="context-view-controls">
    <button type="button" className={`chart-drawing-toggle${relativeSupported && preferences.roofs ? ' active' : ''}`} disabled={!relativeSupported}
      aria-pressed={relativeSupported && preferences.roofs} aria-label={preferences.roofs ? 'Hide roofs' : 'Show roofs'}
      onClick={() => saveSequencePreferences({ ...preferences, roofs: !preferences.roofs })}>Roofs</button>
    <button type="button" className={`chart-drawing-toggle${supported && preferences.ribbon ? ' active' : ''}`} disabled={!supported}
      aria-pressed={supported && !!preferences.ribbon} aria-label={preferences.ribbon ? 'Hide context ribbon' : 'Show context ribbon'}
      onClick={() => saveSequencePreferences({ ...preferences, ribbon: !preferences.ribbon })}>Candy</button>
    <button type="button" className="chart-drawing-toggle" aria-label="Roof and ribbon settings" aria-expanded={guide} onClick={() => setGuide(!guide)}>⚙</button>
    {guide && <RoofGuide onClose={close} relativeSupported={relativeSupported} />}
  </div>
}
