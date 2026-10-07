export function RaycasterNotes({ relative = false }: { relative?: boolean }) {
  return <section className="raycaster-section" aria-label="Raycaster calculation notes">
    <h3>Calculation and evidence</h3>
    <ol>
      <li>Read each enabled standalone scorer using its applied Scatter Plot magnitude settings.</li>
      <li>Apply its assigned policy weight and age retention, then add the signed USD votes. Missing component weights are already reflected in the source score; do not multiply coverage again.</li>
      <li>Positive supports USD; negative weakens USD. EURUSD maps weaker USD to Long; USD-base pairs reverse that mapping.</li>
    </ol>
    <h4>How long information remains influential</h4>
    <table aria-label="Context memory policy"><thead><tr><th>Input</th><th>Half remains after</th><th>Expires after</th></tr></thead><tbody>
      <tr><td>Claims</td><td>7 days</td><td>14 days</td></tr>
      <tr><td>Monthly families</td><td>30 days</td><td>45 days</td></tr>
      <tr><td>GDP</td><td>90 days</td><td>120 days</td></tr>
    </tbody></table>
    <p>A new family publication replaces its old vote, even if uncomputed. Aging follows broker day boundaries. Off, missing and expired weight is not redistributed.</p>
    <h4>What evidence strength means</h4>
    <ul><li><strong>Weak:</strong> missing components, cancellation or a narrow weighted lead.</li>
      <li><strong>Moderate:</strong> broader support with qualified or opposing evidence.</li>
      <li><strong>Strong:</strong> strong agreeing CPI and NFP, broad agreement and no active Weak family. Opposing Claims and NFP cap combined evidence at Moderate.</li></ul>
    <p>Evidence is not a probability or multiplier. Coverage qualifies usability and evidence strength separately; overlapping Claims reports and ISM sectors do not add independent votes.</p>
    <h4>Timing and limits</h4>
    <p>Uses information known by the candle’s end, capped at current time. Forecasts are excluded. Stored readings can contain provider revisions; Fed speech/statement text has no numerical vote.</p>
    <p>{relative ? 'EUR-vs-USD retains its existing coverage and agreement gates. Mixed evidence does not assert a direction; the USD conflict presentation is deferred for this mode.' :
      'USD presentation v1 shows Conflicted · Long/Short leads from existing retained contributions. Narrow leads are Weak. Balanced conflict and unchanged evidence assert no lead; insufficient coverage cannot establish a direction.'} These are declared interpretation rules, not a prediction of price or Fed guidance.</p>
  </section>
}
