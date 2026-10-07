export function CandySettings() {
  return <div className="tool-settings-sections">
    <section><h3>Context timeline</h3><p>Candy visualizes Raycaster’s combined context over time. Both share the context mode and inputs. Change inputs in the Raycaster tab’s Advanced settings.</p></section>
    <section><h3>Color legend</h3>
      <div className="candy-color-key" aria-label="Candy direction legend"><span className="long">Long</span><span className="short">Short</span><span className="unavailable">Unavailable</span></div>
      <p>Green means pair Long; red means pair Short. Pale / medium / deep shades show Weak / Moderate / Strong evidence. Gray means unavailable, not neutral. Evidence describes rule agreement, not winning probability.</p>
    </section>
    <section><h3>Time and updates</h3><p>A segment lasts until the next context update. Hover for its exact time and responsible update; click for sources. Publications, memory aging and expiry are identified separately.</p>
      <p>Candy retains exact update boundaries; the Raycaster box reads through the hovered candle’s end. Roof relationships remain USD-only even when Candy compares EUR with USD.</p></section>
    <section><h3>Manual outside-event strip</h3><p>The thin gray strip above Candy shows your manually selected outside-event windows. Use Manage outside events below to create or edit notes even with Candy hidden. Enable Candy to see the highlights on the chart.</p>
      <p>These notes change no score and establish no cause or measured impact duration. Historical notes retain their actual UTC recording date.</p></section>
  </div>
}
