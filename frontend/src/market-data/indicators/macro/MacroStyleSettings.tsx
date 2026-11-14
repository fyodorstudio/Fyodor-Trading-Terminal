import { macroCatalog } from './macro-catalog'
import { selectedMacroMetrics, type MacroMetric, type MacroPreferences, type MacroStyle } from './macro-preferences'

export function MacroStyleSettings({ preferences, onChange }: { preferences: MacroPreferences; onChange: (next: MacroPreferences) => void }) {
  const keys = selectedMacroMetrics(preferences)
  const patch = (key: MacroMetric, change: Partial<MacroStyle>) => onChange({ ...preferences,
    series: { ...preferences.series, [key]: { ...preferences.series[key], ...change } } })
  return keys.length ? <div className="macro-settings-table-scroll"><table className="macro-settings-table macro-style-table">
    <thead><tr><th scope="col">Event</th><th scope="col">Colour</th><th scope="col">Width</th><th scope="col">Dots</th><th scope="col">Numbers</th><th scope="col">Forecasts</th></tr></thead>
    <tbody>{keys.map(key => { const name = macroCatalog[key].label, style = preferences.series[key]; return <tr key={key}>
      <th scope="row">{name}</th>
      <td><label><span className="macro-setting-label">{name} colour</span><input type="color" value={style.color} onChange={event => patch(key, { color: event.target.value })} /></label></td>
      <td><label><span className="macro-setting-label">{name} line width</span><select value={style.lineWidth} onChange={event => patch(key, { lineWidth: Number(event.target.value) as MacroStyle['lineWidth'] })}>
        {[1, 2, 3, 4].map(width => <option key={width} value={width}>{width}</option>)}</select></label></td>
      <td><label><span className="macro-setting-label">Show {name} dots</span><input type="checkbox" checked={style.pointsVisible} onChange={event => patch(key, { pointsVisible: event.target.checked })} /></label></td>
      <td><label><span className="macro-setting-label">Show {name} numbers</span><input type="checkbox" checked={style.numbersVisible} onChange={event => patch(key, { numbersVisible: event.target.checked })} /></label></td>
      <td><label><span className="macro-setting-label">Show {name} forecasts</span><input type="checkbox" checked={style.forecastVisible} onChange={event => patch(key, { forecastVisible: event.target.checked })} /></label></td>
    </tr> })}</tbody>
  </table></div> : <p>Add events in the Events tab to adjust their appearance.</p>
}
