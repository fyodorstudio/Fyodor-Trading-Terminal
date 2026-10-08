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
      <p>Focused prioritizes specialized relationships, then evidence, and removes repetition. Rows grow to fit the available chart height, beyond three when there is room. More keeps hidden combinations accessible. A selected combo takes priority when zoom changes the available space.</p>
      <label><input type="checkbox" checked={preferences.fresh} onChange={e => saveSequencePreferences({ ...preferences, fresh: e.target.checked })} /> Include experimental fresh-news combinations</label>
      {!supported && <p>Chart roofs are available on EURUSD. These display preferences are retained for supported pairs.</p>}
    </section>
    <section><h3>Read the labels and lines</h3>
      <p>Each combo label sits above the candle where it became available. Connecting lines identify its contributing release symbols; their width is not an active duration or a holding period. Click the combo label for its combined reading. Use the ordinary bottom-row symbols for individual releases.</p>
      <p>Aging update means older news lost weight. Expiry update means an input reached its time limit. These labels have no new release below them. For monthly ISM, a grouped symbol can sit at Manufacturing while the combo becomes available later, at Services.</p>
      <p>Read from the exact time shown in the box, not the candle open. Panning keeps the same rows; zooming can change rows while labels stay attached to their original candles. Selecting a label highlights its connector.</p>
      <p>Green Long and red Short boxes show each side’s share of weighted support. Conflict stays explicit. Select a direction box to show its frozen snapshot beside accumulated context in the draggable Raycaster box.</p>
    </section>
    <section><h3>Selected Roof Candy</h3>
      <p>Select a combo label to show Selected combo Candy at the top of the chart. It begins when the combo became available and follows newer releases of the same inputs. All news Candy combines all enabled news and appears below it. The label and box keep the original percentages.</p>
      <p>Clicking blank chart space, panning and zooming keep the selection. Use × in the box to close it, or Show/Hide Roof Candy to hide its strip. Opening an individual release closes the combo. A different combo shows its own strip automatically.</p>
      <p>Generic pairs keep their selected families; a missing participant turns the strip gray. Labor-policy relationships include combined USD evidence and turn gray when their named rule is inactive. Fresh-news relationships follow comparable support changes with their seven-day limits. Fed actions stay outside macro percentages.</p>
      <p>Click a Roof Candy segment for its percentages, plain explanation and accumulated USD context at the same clock. Record Aligned, Opposed or Unclear there or in Combo details. Only compare prices after the exact reading time.</p>
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
      <p>Roofs use enabled USD inputs in both Candy modes. Pair annotations compare available standalone support; ISM sectors resolve one family; labor policy relationships show combined USD support; fresh news shows comparable changes. Candy retains accumulated context in its selected USD-side or EUR-vs-USD mode. They answer different questions and can disagree. Fed actions are unweighted annotations; speeches and EUR publications add no Roof vote. Raycaster’s input settings determine macro calculation; Inspector filters determine visible symbols. Hidden inputs are disclosed. USD-side Raycaster/Candy disclose conflicted leads separately from Roof support changes.</p>
      <ul>{['cpi', 'nfp', 'claims', 'pce', 'ppi', 'ism', 'retail', 'gdp'].map(f => <li key={f}>{f.toUpperCase()}: {families.some(enabled => enabled === f) ? 'Enabled' : 'Off'}</li>)}</ul>
    </section>
  </div>
}
