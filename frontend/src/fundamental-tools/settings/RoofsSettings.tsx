import { saveSequencePreferences, useSequencePreferences } from '../../usd-context/sequences/storage/sequence-preferences'
import { useRaycasterFamilies } from '../../raycaster/storage/raycaster-family-settings'
import { relationshipVersion } from '../../usd-context/sequences/core/contracts'
import { relationshipPairs } from '../../usd-context/sequences/core/relationship-registry'

export function RoofsSettings({ supported }: { supported: boolean }) {
  const preferences = useSequencePreferences(), families = useRaycasterFamilies()
  return <div className="tool-settings-sections">
    <section><h3>Display</h3>
      <label>Display density <select aria-label="Roof display density" value={preferences.density ?? 'focused'}
        onChange={e => saveSequencePreferences({ ...preferences, density: e.target.value as 'focused' | 'all' })}>
        <option value="focused">Focused</option><option value="all">All roofs</option></select></label>
      <p>Focused prioritizes specialized relationships, then evidence, and removes repetition. Both modes use three levels; More keeps every omitted roof accessible. Pair annotations add no votes.</p>
      <label><input type="checkbox" checked={preferences.fresh} onChange={e => saveSequencePreferences({ ...preferences, fresh: e.target.checked })} /> Include experimental fresh-news combinations</label>
      {!supported && <p>Chart roofs are available on EURUSD. These display preferences are retained for supported pairs.</p>}
    </section>
    <section><h3>Read the shapes</h3>
      <p>The filled dot marks activation: when all required information was available. Hollow dots identify contributing releases. The line connects source releases to activation; its width is not an active duration or a holding period.</p>
      <p>Click a hollow dot for its contributing release. Click a filled dot for the activating release, or Combo details if activation is a memory update or its publication is hidden. Several releases at the point open a chooser. Click the direction box for Combo details. Release symbols stay in the bottom row.</p>
      <p>Read the combo from the exact activation time onward, not from the candle open. Availability is not a trade entry signal. Panning preserves the rows and anchors; zooming can rearrange rows.</p>
    </section>
    <section><h3>Available USD relationships · v{relationshipVersion}</h3><dl>
      <dt>Complete pair catalogue</dt><dd>28 macro pairs plus eight Fed/macro pairs. Open a direction box, then USD relationship catalogue, to inspect all pairs, unavailable inputs and any larger selected group at that activation time.</dd>
      <dt>Release support</dt><dd>Current standalone scores retain base family weights and source aging. Conflicted · Long leads or Conflicted · Short leads shows the weighted winner and opposing support. Balanced conflict means exact cancellation. A narrow lead is weak evidence; support shares are not probabilities.</dd>
      <dt>ISM sectors</dt><dd>Manufacturing and Services resolve the existing ISM vote together.</dd>
      <dt>Labor + inflation</dt><dd>Confirmed labor weakness takes priority when inflation guard conditions allow it.</dd>
      <dt>Claims + NFP</dt><dd>Persistent weekly claims can challenge an older weak or incomplete jobs report.</dd>
      <dt>Fresh news · Experimental v4</dt><dd>Comparable changes in support over seven days span at least two domains. Conflicts and exact cancellation remain explicit. Both readings use the latest release calibration, matching component membership and coverage of at least 60%. ISM compares each sector with its own preceding month, within 70/30 sector weights. Calibration drift, renewal and newly available inputs do not vote. The catalogue can inspect same-domain changes too. This is separate from accumulated context and native-unit economic change.</dd>
      <dt>Fed relationships</dt><dd>The numerical rate action is shown separately from weighted macro support. Hold supplies no direction. Basis points are not converted into magnitude points; an overall numeric winner between rate action and macro evidence is not asserted.</dd>
    </dl></section>
    <section><details><summary>All 36 registered pairs</summary><ul>{relationshipPairs.map(pair => <li key={pair.id}>{pair.label}</li>)}</ul></details></section>
    <section><h3>Inputs and scope</h3>
      <p>Roofs use enabled USD inputs in both Candy modes. Pair annotations compare available standalone support; ISM sectors resolve one family; labor policy relationships show combined USD support; fresh news shows comparable changes. Candy retains accumulated context in its selected USD-side or EUR-vs-USD mode. They answer different questions and can disagree. Fed actions are unweighted annotations; speeches and EUR publications add no Roof vote. Raycaster’s input settings determine macro calculation; Inspector filters determine visible symbols. Hidden inputs are disclosed. Raycaster/Candy conflict-label changes are deferred.</p>
      <ul>{['cpi', 'nfp', 'claims', 'pce', 'ppi', 'ism', 'retail', 'gdp'].map(f => <li key={f}>{f.toUpperCase()}: {families.some(enabled => enabled === f) ? 'Enabled' : 'Off'}</li>)}</ul>
    </section>
  </div>
}
