import { saveSequencePreferences, useSequencePreferences } from '../../usd-context/sequences/storage/sequence-preferences'
import { useRaycasterFamilies } from '../../raycaster/storage/raycaster-family-settings'
import { relationshipVersion } from '../../usd-context/sequences/core/contracts'
import { relationshipPairs } from '../../usd-context/sequences/core/relationship-registry'
import { roofDisplayOptions } from '../../usd-context/sequences/core/relationship-display'
import { useState } from 'react'

export function RoofsSettings({ supported }: { supported: boolean }) {
  const preferences = useSequencePreferences(), families = useRaycasterFamilies()
  const [search, setSearch] = useState('')
  const visibleOptions = roofDisplayOptions.filter(option => `${option.label} ${option.group}`.toLowerCase().includes(search.trim().toLowerCase()))
  const enabled = (id: string) => !preferences.hiddenRoofs?.includes(id) && (id !== 'fresh-news' || preferences.fresh)
  const toggle = (id: string, checked: boolean) => {
    const hidden = new Set(preferences.hiddenRoofs ?? [])
    if (checked || id === 'fresh-news') hidden.delete(id); else hidden.add(id)
    saveSequencePreferences({ ...preferences, hiddenRoofs: [...hidden], ...(id === 'fresh-news' ? { fresh: checked } : {}) })
  }
  return <div className="tool-settings-sections">
    <section><h3>Display</h3>
      <label>Display density <select aria-label="Roof display density" value={preferences.density ?? 'focused'}
        onChange={e => saveSequencePreferences({ ...preferences, density: e.target.value as 'focused' | 'all' | 'concise' })}>
        <option value="concise">Concise</option><option value="focused">Focused</option><option value="all">All roofs</option></select></label>
      <p>Concise shows one +N Combo button for all enabled relationships that became available or updated at each visible candle. Its tick and stem point to that candle on the time axis. Click for the existing relationship list, exact update times and counts of Long/Short leads. These counts describe overlapping relationships; they are not a combined percentage. Selecting an entry opens its details and chooses its Candy relationship while keeping the chart compact.</p>
      <p>Only combos whose available-from candle is visible compete for label space. Focused prioritizes specialized relationships, then evidence, and removes crowded repetition. Rows grow to fit the chart height, beyond three when there is room. Each candle column has its own More button for hidden combos there; every entry keeps its exact time. Nearby More buttons use staggered rows. A selected combo takes display priority.</p>
      {!supported && <p>Chart roofs are available on EURUSD. These display preferences are retained for supported pairs.</p>}
    </section>
    <section><h3>Visible combinations</h3>
      <label>Search combinations <input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <p>Choose chart labels and More entries. These filters do not change scores, Raycaster inputs, the catalogue or an already selected Candy history.</p>
      <div className="roof-filter-actions"><button type="button" onClick={() => saveSequencePreferences({ ...preferences, hiddenRoofs: [], fresh: true })}>Show all combinations</button>
        <button type="button" onClick={() => saveSequencePreferences({ ...preferences, hiddenRoofs: roofDisplayOptions.filter(option => option.id !== 'fresh-news').map(option => option.id), fresh: false })}>Hide all combinations</button></div>
      {['Macro pairs', 'Fed pairs', 'Specialized relationships'].map(group => {
        const options = visibleOptions.filter(option => option.group === group)
        return options.length ? <details key={group} className="roof-combination-group" open={!!search.trim() || group === 'Specialized relationships'}><summary>{group} · {options.filter(option => enabled(option.id)).length}/{options.length} shown</summary>
          {options.map(option => <label key={option.id}><input type="checkbox" aria-label={`Show ${option.label}`} checked={enabled(option.id)} onChange={event => toggle(option.id, event.target.checked)} /> {option.label}</label>)}</details> : null
      })}
      {!visibleOptions.length && <p>No matching combinations.</p>}
    </section>
    <section><h3>Read the labels and lines</h3>
      <p>Each combo label sits above the candle where it became available, with a short stem below it. Hover or keyboard-focus a label to reveal its connecting lines and highlight the contributing release symbols. Click the label to keep that connection visible and open its combined reading. Other labels keep only their short stems. Use the ordinary bottom-row symbols for individual releases.</p>
      <p>The available-from candle determines whether a label can appear. Older source symbols may be filtered or outside loaded chart history; the label remains available, and only drawable connections appear. The full source list remains in its tooltip and details.</p>
      <p>Aging update means older news lost weight. Expiry update means an input reached its time limit. These labels have no new release below them. For monthly ISM, a grouped symbol can sit at Manufacturing while the combo becomes available later, at Services.</p>
      <p>Read from the exact time shown in the box, not the candle open. A connection shows which releases contributed; its width is not an active duration or holding period. Labels and local More buttons stay attached to their original candles. Panning and zooming reuse label rows whenever they still fit. Offscreen combos appear when you pan to their available-from candles. Selection remains open while its chart label leaves the view.</p>
      <p>Every label has the same size. A green background means Long has more weighted support; red means Short has more. The percentages show opposing support too. Amber means balanced support; gray means unchanged or insufficient evidence. Hover for the full state and evidence strength.</p>
      <p>Changes in support compares successive release interpretations. Release support combines the selected readings at their retained weights. Neither describes a price change or winning probability. Aging, expiry and rate-action annotations stay inside the box. Select a label to open its frozen snapshot in the Roofs dock. Open in Raycaster explicitly opens the selected-combo view.</p>
    </section>
    <section><h3>Selected Roof Candy</h3>
      <p>Select a combo to choose its relationship. When Candy is on and Roof Candy is enabled in Candy settings, its strip shows available history before and after that roof. Claims + Fed includes all action types. The selected label and details keep their original percentages.</p>
      <p>Blank chart clicks, panning, zooming, hiding Raycaster and opening releases keep the selection. Clear combo removes it. The toolbar Candy button shows or hides both configured strips; selecting another combo respects that switch.</p>
      <p>Generic pairs keep their selected families; a missing participant turns the strip gray. Labor-policy relationships include combined USD evidence and turn gray when their named rule is inactive. Fresh-news relationships follow comparable support changes with their seven-day limits. Fed actions stay outside macro percentages.</p>
      <p>Click a Roof Candy segment for its percentages, plain explanation and accumulated USD context at the same clock. Record Aligned, Opposed or Unclear there or in Raycaster's Selected combo view. Only compare prices after the exact reading time.</p>
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
