import { saveSequencePreferences, useSequencePreferences } from '../../usd-context/sequences/storage/sequence-preferences'

export function CandySettings() {
  const preferences = useSequencePreferences()
  return <div className="tool-settings-sections">
    <section><h3>Visible timelines</h3>
      <label><input type="checkbox" checked={preferences.raycasterCandy !== false} onChange={event => saveSequencePreferences({ ...preferences, raycasterCandy: event.target.checked })} /> Raycaster Candy · All news</label>
      <label><input type="checkbox" checked={preferences.roofCandy !== false} onChange={event => saveSequencePreferences({ ...preferences, roofCandy: event.target.checked })} /> Roof Candy · Selected relationship history</label>
      <p>The toolbar Candy button shows or hides the enabled timelines together. These choices are saved.</p>
      <p>Raycaster and Candy both share the context view and inputs. Change inputs in the Raycaster tab. Selecting a combo chooses the Roof Candy relationship.</p>
    </section>
  </div>
}
