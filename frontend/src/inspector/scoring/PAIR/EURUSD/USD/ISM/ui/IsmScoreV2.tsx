import { useMemo } from 'react'
import type { InspectorRelease } from '../../../../../../inspector-data'
import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import { formatAppTimestamp, type TimeDisplayPreference } from '../../../../../../../appearance/time-display/time-display-preference'
import { useStoredCalendar } from '../../../../../../useStoredCalendar'
import { useCalendarNow } from '../../../../../../useCalendarNow'
import { ismSourceRelease } from '../../../../../../episodes/ism-episodes'
import { signalHistoryStart } from '../../../../../shared/core/historical-release-signals'
import { ismServicesSignalSettings, ismManufacturingSignalSettings } from '../../../../../shared/core/signal-magnitude-settings'
import { assessIsmScoreV2, ismV2SeriesIds, supportsIsmV2 } from '../assessment/ism-score-v2'
import { ismCalendarSource } from '../assessment/ism-publication-check'

const scope = { currency: 'USD' as const, eventIds: ismV2SeriesIds }
const sectors = ['manufacturing', 'services'] as const
const sectorLabel = (sector: typeof sectors[number]) => sector === 'manufacturing' ? 'Manufacturing' : 'Services'
const format = (value: number | null) => value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })
export function IsmScoreV2({ release, brokerId, events = [], timeDisplay = { mode: 'utc', utcOffsetMinutes: 0 }, onOpenScatter, now: suppliedNow }: {
  release: InspectorRelease | null; brokerId?: string | null; events?: EconomicCalendarEvent[]
  timeDisplay?: TimeDisplayPreference; onOpenScatter?: (release: InspectorRelease) => void; now?: number
}) {
  const calendarNow = useCalendarNow(), now = suppliedNow ?? calendarNow
  const publications = release?.ismPublications
  const at = publications?.[publications.length - 1]?.releaseAt ?? release?.releaseAt ?? null
  const range = useMemo(() => at === null ? null : ({ from: signalHistoryStart - 2 * 86400000, to: at + 2 * 86400000 }), [at])
  const storage = useStoredCalendar(brokerId, range, !!range, scope)
  const services = ismServicesSignalSettings.useSettings(), manufacturing = ismManufacturingSignalSettings.useSettings()
  const inventory = brokerId ? storage.events : events
  const snapshots = useMemo(() => {
    const base = ismSourceRelease(release, null, now), settings = { services, manufacturing }
    const seed = base && base.releaseAt !== null && base.releaseAt <= now ? assessIsmScoreV2(base, inventory, settings) : null
    return sectors.map((sector) => {
      const source = publications?.find((item) => item.familyId === `ism-${sector}`) ??
        (!publications && release?.familyId === `ism-${sector}` ? release : seed?.[sector].release) ?? null
      const assessment = source && (source.releaseAt === null || source.releaseAt <= now) ? assessIsmScoreV2(source, inventory, settings) : null
      return { sector, source, assessment, member: assessment?.[sector] ?? null }
    })
  }, [release, publications, now, inventory, services, manufacturing])
  if (!supportsIsmV2(release)) return null
  const loading = storage.loading
  const timestamp = (value: number | null) => value === null ? 'Time unavailable' : formatAppTimestamp(value, timeDisplay)
  const latest = snapshots[1].assessment ?? snapshots[0].assessment
  return <div className="inspector-detail-overview inspector-scoring-view inspector-ism-v2" aria-label="ISM monthly context scoring system">
    <p aria-label="ISM context identity">{latest?.contextId ?? 'Reference month unavailable'} · Scoring system v2 · Experimental</p>
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
    {storage.error && <p role="alert">ISM history: {storage.error}</p>}
    <div className="inspector-table-scroll"><table aria-label="ISM v2 components">
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
    <p>Positive USD score → EURUSD Short · Negative → EURUSD Long. These are snapshots of the same monthly context at different publication times. The table shows each sector's inputs at its own release; the Services snapshot combines both sectors. Missing components receive no redistributed weight.</p>
    <p>Services leads with 70%; Manufacturing has 30%. Services keeps its v1 weights. Manufacturing uses orders 50%, employment 35%, prices paid 15%. Components compare their latest index with max(50, preceding three-month average), using supplied Revised Previous for the nearest month. Below-50 rebounds remain declines. Weights and the floor are prototype interpretation choices.</p>
    <p>Demand, labor and prices are three evidence groups across both sectors. Related orders/activity readings do not count as separate confirmations. Sector disagreement or opposing demand/employment votes cap evidence at moderate; narrow leads, missing components and ties give weak evidence. Headline composites do not vote. Manufacturing production, inventories and supplier deliveries are unavailable and are not inferred.</p>
    <p>One chart symbol groups the reference month's two publications at the first publication. Both outputs retain their real timestamps and use only observations available at each release. No older sector month is carried into the current group. Before a report arrives its output stays pending. January 2015 history and the 24-earlier-observation gate still apply.</p>
    <p>Scatter Plot → Scoring signal exposes each source component. Services uses the same saved boundaries in v1 and v2; Manufacturing has independent boundaries. Previews stay on the chart until applied. Known timing discrepancies exclude a sector; no broker dates are silently corrected. Official date checks cover 2026 plus a weekend check, not every historical timestamp. Historical comparisons retain provider values and may contain revisions or timing errors; this is a reconstruction from stored data.</p>
    <p>No forecasts, market prices, NFP, CPI or Fed decisions enter this ISM context. Evidence and change size do not predict a price move.</p>
    {Object.values(storage.coverage).some((coverage) => coverage.missing.length > 0) && <p>Partial calendar coverage; context and calibration use the available observations.</p>}
  </div>
}
