import { saveSequencePreferences, useSequencePreferences } from '../../usd-context/sequences/storage/sequence-preferences'
import { useRaycasterFamilies } from '../../raycaster/storage/raycaster-family-settings'

export function RoofsSettings({ supported }: { supported: boolean }) {
  const preferences = useSequencePreferences(), families = useRaycasterFamilies()
  return <div className="tool-settings-sections">
    <section><h3>Display</h3>
      <label>Display density <select aria-label="Roof display density" value={preferences.density ?? 'focused'}
        onChange={e => saveSequencePreferences({ ...preferences, density: e.target.value as 'focused' | 'all' })}>
        <option value="focused">Focused</option><option value="all">All roofs</option></select></label>
      <p>Focused prioritizes evidence and removes repetition. Both modes use three levels; More keeps every omitted roof accessible.</p>
      <label><input type="checkbox" checked={preferences.fresh} onChange={e => saveSequencePreferences({ ...preferences, fresh: e.target.checked })} /> Include experimental fresh-news combinations</label>
      {!supported && <p>Chart roofs are available on EURUSD. These display preferences are retained for supported pairs.</p>}
    </section>
    <section><h3>Read the shapes</h3>
      <p>The endpoint tagged Starts marks activation: when all required information was available. Update marks a memory change without a new publication. The line connects source releases to activation; its width is not an active duration or a holding period.</p>
      <p>Click a symbol for its release, or a counted symbol to choose among nearby releases. Click the direction box for Combo details. Panning preserves the rows and anchors. Zooming can rearrange rows and symbol clusters.</p>
    </section>
    <section><h3>Available USD relationships</h3><dl>
      <dt>ISM sectors</dt><dd>Manufacturing and Services resolve the existing ISM vote together.</dd>
      <dt>Labor + inflation</dt><dd>Confirmed labor weakness takes priority when inflation guard conditions allow it.</dd>
      <dt>Claims + NFP</dt><dd>Persistent weekly claims can challenge an older weak or incomplete jobs report.</dd>
      <dt>Fresh news · Experimental</dt><dd>Replacement effects over seven days align across at least two economic domains. This has Weak evidence and is separate from accumulated context.</dd>
    </dl></section>
    <section><h3>Inputs and scope</h3>
      <p>Roofs use enabled USD inputs. Fed decisions, speeches and EUR publications add no roof vote. Raycaster’s input settings determine calculation; Inspector filters determine visible symbols. Hidden inputs are disclosed.</p>
      <ul>{['cpi', 'nfp', 'claims', 'pce', 'ppi', 'ism', 'retail', 'gdp'].map(f => <li key={f}>{f.toUpperCase()}: {families.some(enabled => enabled === f) ? 'Enabled' : 'Off'}</li>)}</ul>
    </section>
  </div>
}
