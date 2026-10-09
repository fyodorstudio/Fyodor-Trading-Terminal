import { formatAppTimestamp, type TimeDisplayPreference } from '../../../appearance/time-display/time-display-preference'
import { contextPairLabel } from '../../../scoring-system/context/usd/usd-pair'
import type { ComboSnapshot, ComboSource } from '../../../scoring-system/relationships/contracts'
import './combo-release-table.css'

export function ComboReleaseTable({ combo, symbol, timeDisplay, onOpenRelease }: {
  combo: ComboSnapshot; symbol: string; timeDisplay: TimeDisplayPreference; onOpenRelease: (source: ComboSource) => void
}) {
  return <table className="combo-release-table" aria-label={`Releases in ${combo.title}`}>
    <thead><tr><th scope="col">Release</th><th scope="col">Published</th><th scope="col">Standalone interpretation</th><th scope="col">Role</th></tr></thead>
    <tbody>{combo.sources.map(source => <tr key={source.sourceId}>
      <td><button type="button" onClick={() => onOpenRelease(source)}>{source.sourceLabel}</button></td>
      <td>{formatAppTimestamp(source.releaseAt, timeDisplay)}</td>
      <td>{contextPairLabel(symbol, source.usdDirection)}{source.strength && <small>{source.strength} evidence</small>}</td>
      <td>{source.chartAt === combo.chartAt ? 'Activation update' : 'Earlier context'}<small>{source.role ?? 'Participating context vote'}</small></td>
    </tr>)}</tbody>
  </table>
}
