import { saveSequencePreferences, useSequencePreferences } from '../../usd-context/sequences/storage/sequence-preferences'

export function CandySettings() {
  const preferences = useSequencePreferences()
  return <div className="tool-settings-sections">
    <section><h3>Visible timelines</h3>
      <label><input type="checkbox" checked={preferences.raycasterCandy !== false} onChange={event => saveSequencePreferences({ ...preferences, raycasterCandy: event.target.checked })} /> Raycaster Candy · All news</label>
      <label><input type="checkbox" checked={preferences.roofCandy !== false} onChange={event => saveSequencePreferences({ ...preferences, roofCandy: event.target.checked })} /> Roof Candy · Selected relationship history</label>
      <p>Candy toggles both enabled timelines. Inputs are shared with Raycaster; a selected combo sets the relationship history.</p>
    </section>
  </div>
}
