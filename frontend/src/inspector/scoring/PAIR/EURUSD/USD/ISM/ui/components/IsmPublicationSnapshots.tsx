import type { IsmAnalysis } from '../../runtime/ism-analysis'
import { sectorLabel, format } from '../presentation'
export function IsmPublicationSnapshots({ snapshots, loading, timestamp }: { snapshots: IsmAnalysis['snapshots']; loading: boolean; timestamp: (at: number | null) => string }) {
  return (
    <div className="inspector-ism-v2-outputs" aria-label="ISM publication biases">
      {snapshots.map(({ sector, source, assessment }) => <section className="inspector-ism-v2-output" key={sector} aria-label={`ISM ${sector} publication bias`}>
        <h4>At {sectorLabel(sector)} release</h4>
        <p>{source ? timestamp(source.releaseAt) : 'Publication pending / unavailable'}</p>
        <div className="inspector-ism-v2-summary">
          <strong className={`inspector-majority inspector-direction-${loading ? 'uncomputed' : assessment?.direction ?? 'uncomputed'}`} aria-label={`ISM ${sectorLabel(sector)} release pair direction`}>
            {loading ? 'Uncomputed' : assessment?.label ?? 'Pending'}
          </strong>
          {!loading && assessment?.strength && <span>{assessment.strength} evidence</span>}
          {!loading && assessment?.direction !== 'uncomputed' && assessment?.changeSize && <span>{assessment.changeSize}</span>}
        </div>
        <p>{sector === 'manufacturing' ? 'Manufacturing-time context; later Services data is excluded.' : 'Services-time context; includes the earlier same-month Manufacturing report.'}</p>
        <p>{loading ? 'Loading both ISM histories…' : assessment?.explanation ?? 'No published assessment is available yet.'}</p>
        {!loading && assessment && <>
          <p>{assessment.strengthReason}</p>
          <p>USD score {format(assessment.total)} · {assessment.readings.filter((row) => row.points !== null).length} of 7 components vote.</p>
          {assessment.tieBreak && <p>Tie-break: {assessment.tieBreak.label} · weak evidence</p>}
          {sector === 'services' && <p aria-label="ISM context update">{assessment.update}</p>}
        </>}
      </section>)}
    </div>
  )
}
