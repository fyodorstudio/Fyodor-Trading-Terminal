import { saveSequencePreferences, useSequencePreferences } from '../storage/sequence-preferences'

export function SequenceControls({ supported }: { supported: boolean }) {
  const preferences = useSequencePreferences()
  return <section className="raycaster-section" aria-label="Combo roof controls">
    <h3>Chart relationships</h3>
    <label><input type="checkbox" checked={preferences.roofs} disabled={!supported}
      onChange={e => saveSequencePreferences({ ...preferences, roofs: e.target.checked })} /> Show clickable combo roofs</label>
    <label><input type="checkbox" checked={preferences.fresh}
      onChange={e => saveSequencePreferences({ ...preferences, fresh: e.target.checked })} /> Include experimental fresh-news sequences</label>
    <p>Roofs connect participating USD publications. Click one to open Combo details in Inspector. They use these context inputs; hidden Inspector markers are disclosed in the roof. Their dated USD snapshots remain separate from the optional EUR/USD relative view.</p>
    {!supported && <p>Chart roofs are available on EURUSD. The fresh-news comparison still follows this pair’s USD direction.</p>}
  </section>
}
