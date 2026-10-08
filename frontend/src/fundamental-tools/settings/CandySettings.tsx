import { saveSequencePreferences, useSequencePreferences } from '../../usd-context/sequences/storage/sequence-preferences'

export function CandySettings() {
  const preferences = useSequencePreferences()
  return <div className="tool-settings-sections">
    <section><h3>Visible timelines</h3>
      <label><input type="checkbox" checked={preferences.raycasterCandy !== false} onChange={event => saveSequencePreferences({ ...preferences, raycasterCandy: event.target.checked })} /> Raycaster Candy · All news</label>
      <label><input type="checkbox" checked={preferences.roofCandy !== false} onChange={event => saveSequencePreferences({ ...preferences, roofCandy: event.target.checked })} /> Roof Candy · Selected relationship history</label>
      <p>The toolbar Candy button shows or hides the enabled timelines together. Selecting a combo chooses the Roof Candy relationship and respects that button. These choices are saved.</p>
    </section>
    <section><h3>Context timeline</h3><p>Candy visualizes Raycaster’s combined context over time. Both share the context mode and inputs. Change inputs in the Raycaster tab’s Advanced settings.</p></section>
    <section><h3>Color legend</h3>
      <div className="candy-color-key" aria-label="Candy direction legend"><span className="long">Aligned Long</span><span className="short">Aligned Short</span><span className="mixed">Conflict / No lead</span><span className="unavailable">Insufficient</span></div>
      <p>USD presentation v1: green/red means aligned Long/Short family support. Conflicts stay amber; a green/red bottom edge identifies the weighted Long/Short lead. Amber without a lead edge means balanced conflict or unchanged support. Gray means insufficient context. Hover or click for the exact state, support split and leading contributors.</p>
      <p>USD-side mode requires at least 60% usable configured coverage. A conflicted lead below one third of gross support stays Weak. Missing components do not imply agreement; source scores already reflect missing component weights. Age retention remains separate.</p>
      <p>EUR-vs-USD keeps its existing presentation: green Long, red Short, amber Mixed, gray Insufficient. Its direction still requires one-third net/gross agreement and usable evidence in both legs. The new USD lead edges are not applied to this mode; EUR scoring audit and extension are deferred.</p>
      <p>Pale / medium / deep directional shades show Weak / Moderate / Strong evidence. These are declared prototype safeguards, not winning probabilities or proof of price alignment.</p>
    </section>
    <section><h3>Time and updates</h3><p>A segment lasts until the next context update. Hover for its exact time in the selected display clock and responsible update; click for sources. Publications, memory aging and expiry are identified separately.</p>
      <p>Candy retains exact update boundaries; the Raycaster box reads through the hovered candle’s end. Roof relationships remain USD-only even when Candy compares EUR with USD.</p></section>
    <section><h3>Two Candy strips</h3><p>All news combines every enabled news input. Roof Candy shows the selected relationship across available history, including before the clicked roof. Each segment uses releases known then. Claims + Fed includes holds, cuts and increases. Gray means insufficient evidence; click a segment to see why.</p>
      <p>Both strips stay at the top of the chart. Selection remains while you click, pan, zoom, hide Raycaster or inspect individual releases. Clear combo removes the relationship; the toolbar Candy button hides both configured strips without clearing it.</p>
      <p>The original label percentages do not change. Roof Candy follows the same relationship through earlier and later inputs. The strips can disagree because they combine different inputs; fresh combinations describe changes rather than accumulated support.</p></section>
    <section><h3>Manual outside-event strip</h3><p>The thin gray strip beside All news Candy shows your manually selected outside-event windows. Use Manage outside events below to create or edit notes even with Candy hidden. Enable Candy and its Raycaster timeline to see the highlights on the chart.</p>
      <p>These notes change no score and establish no cause or measured impact duration. Historical notes retain their actual recording instant, shown in the selected display clock.</p></section>
  </div>
}
