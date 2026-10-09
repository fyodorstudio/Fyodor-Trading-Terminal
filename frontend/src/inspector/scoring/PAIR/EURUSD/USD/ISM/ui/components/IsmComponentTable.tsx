import type { IsmAnalysis } from '../../../../../../../../scoring-system/PAIR/EURUSD/USD/ISM/runtime/ism-analysis'
import type { InspectorRelease } from '../../../../../../../inspector-data'
import { sectorLabel, format } from '../presentation'
import { ismCalendarSource } from '../../../../../../../../scoring-system/PAIR/EURUSD/USD/ISM/assessment/ism-publication-check'
export function IsmComponentTable({ snapshots, loading, timestamp, onOpenScatter }: { snapshots: IsmAnalysis['snapshots']; loading: boolean; timestamp: (at: number | null) => string; onOpenScatter?: (release: InspectorRelease) => void }) {
  return (
    <div className="inspector-table-scroll"><table aria-label={'ISM v3 components'}>
      <thead><tr><th>Signal</th><th>Reading</th><th>Sector weight</th><th>Context contribution</th></tr></thead>
      {snapshots.map(({ sector, source, member }) => <tbody key={sector} aria-label={`ISM ${sector} context`}>
        <tr className="inspector-ism-section-heading"><th colSpan={4} scope="rowgroup">{sectorLabel(sector)} · {sector === 'services' ? 70 : 30}% of context</th></tr>
        <tr className="inspector-ism-section-info"><td colSpan={4}>
          <p>Publication: {source ? timestamp(source.releaseAt) : 'Pending / unavailable'} · {loading ? 'Loading' : member?.status ?? 'Pending'}</p>
          {!loading && member?.issue && <p role="alert">{member.issue} <a href={ismCalendarSource} target="_blank" rel="noreferrer">Official ISM calendar</a></p>}
          {!loading && member?.status === 'unavailable' && <p>A calibrated demand component is required before this sector can vote.</p>}
          {!loading && member?.assessment && <p>{member.assessment.headlineContext}</p>}
          {source && onOpenScatter && <button type="button" onClick={() => onOpenScatter(source)}>Inspect {sectorLabel(sector)} signals</button>}
        </td></tr>
        {!loading && member?.assessment?.readings.map((row) => {
          const combined = member.readings.find((item) => item.id === `${sector}:${row.id}`)!
          return <tr key={row.id} data-ism-signal={`${sector}:${row.id}`}>
            <td title={row.description}>{row.label}</td>
            <td title={`${format(row.value)} index points · ${row.sampleCount} earlier signals`}>
              {row.points === null ? 'Unavailable' : row.points > 0 ? `Above comparison pace · ${row.size}` : row.points < 0 ? `Below comparison pace · ${row.size}` : 'At comparison pace'}
              <small>{row.state}</small>{row.reason && <small>{row.reason}</small>}
              <small>{format(row.value)} index points · N = {row.sampleCount} · {row.limits ?
                `${row.magnitudeMode === 'custom' ? 'manual override' : 'automatic'} boundaries ${row.limits.map((limit) => limit.toLocaleString(undefined, { maximumFractionDigits: 6 })).join(' / ')} index points` : 'boundaries unavailable'}</small>
            </td>
            <td>{row.weight}%</td>
            <td className={combined.contribution === null || combined.contribution === 0 ? 'inspector-score-unchanged' : combined.contribution > 0 ? 'inspector-score-positive' : 'inspector-score-negative'}>{format(combined.contribution)}</td>
          </tr>
        })}
      </tbody>)}
    </table></div>
  )
}
