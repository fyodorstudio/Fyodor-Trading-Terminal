import { useMemo } from 'react'
import type { InspectorRelease } from '../../../../../../inspector-data'
import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import { formatAppTimestamp, type TimeDisplayPreference } from '../../../../../../../appearance/time-display/time-display-preference'
import { useStoredCalendar } from '../../../../../../useStoredCalendar'
import { signalHistoryStart } from '../../../../../shared/core/historical-release-signals'
import { ismServicesSignalSettings, ismManufacturingSignalSettings } from '../../../../../shared/core/signal-magnitude-settings'
import { assessIsmScoreV2, ismV2SeriesIds } from '../assessment/ism-score-v2'
import { ismCalendarSource } from '../assessment/ism-publication-check'

const scope = { currency: 'USD' as const, eventIds: ismV2SeriesIds }
const format = (value: number | null) => value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })
export function IsmScoreV2({ release, brokerId, events = [], timeDisplay = { mode: 'utc', utcOffsetMinutes: 0 }, onOpenScatter }: {
  release: InspectorRelease | null; brokerId?: string | null; events?: EconomicCalendarEvent[]
  timeDisplay?: TimeDisplayPreference; onOpenScatter?: (release: InspectorRelease) => void
}) {
  const at = release?.releaseAt ?? null
  const range = useMemo(() => at === null ? null : ({ from: signalHistoryStart - 2 * 86400000, to: at + 2 * 86400000 }), [at])
  const storage = useStoredCalendar(brokerId, range, !!range, scope)
  const services = ismServicesSignalSettings.useSettings(), manufacturing = ismManufacturingSignalSettings.useSettings()
  const inventory = brokerId ? storage.events : events
  const assessment = useMemo(() => assessIsmScoreV2(release, inventory, { services, manufacturing }), [release, inventory, services, manufacturing])
  if (!assessment) return null
  const loading = storage.loading, direction = loading ? 'uncomputed' : assessment.direction
  const timestamp = (value: number | null) => value === null ? 'Time unavailable' : formatAppTimestamp(value, timeDisplay)
  return <div className="inspector-detail-overview inspector-scoring-view inspector-ism-v2" aria-label="ISM monthly context scoring system">
    <div className="inspector-ism-v2-summary">
      <strong className={`inspector-majority inspector-direction-${direction}`} aria-label="ISM v2 pair direction">{loading ? 'Uncomputed' : assessment.label}</strong>
      {!loading && assessment.strength && <span aria-label="ISM v2 evidence strength">{assessment.strength} evidence</span>}
      {!loading && assessment.direction !== 'uncomputed' && assessment.changeSize && <span>{assessment.changeSize}</span>}
      <span>{loading ? 'Loading both ISM histories…' : assessment.explanation}</span>
      <small>Scoring system v2 · Experimental</small>
    </div>
    <p aria-label="ISM context identity">{assessment.contextId ?? 'Reference month unavailable'} · As of {timestamp(assessment.asOf)}</p>
    {!loading && <p aria-label="ISM context update">{assessment.update}</p>}
    {!loading && <p aria-label="ISM v2 evidence explanation">{assessment.strengthReason}</p>}
    {storage.error && <p role="alert">ISM history: {storage.error}</p>}
    {!loading && assessment.reduced && <p>Incomplete context: {assessment.readings.filter((row) => row.points !== null).length} of 7 components vote. Pending, excluded or unavailable components receive no redistributed weight.</p>}
    {[assessment.manufacturing, assessment.services].map((member) => <section key={member.sector} aria-label={`ISM ${member.sector} context`}>
      <h4>{member.sector === 'services' ? 'Services' : 'Manufacturing'} · {member.weight}% of context</h4>
      <p>Publication: {member.release ? timestamp(member.release.releaseAt) : 'Pending / unavailable at this time'} · {loading ? 'Loading' : member.status}</p>
      {!loading && member.issue && <p role="alert">{member.issue} <a href={ismCalendarSource} target="_blank" rel="noreferrer">Official ISM calendar</a></p>}
      {!loading && member.status === 'unavailable' && <p>A calibrated demand component is required before this sector can vote.</p>}
      {!loading && member.assessment && <>
        <p>{member.assessment.headlineContext}</p>
        <div className="inspector-table-scroll"><table aria-label={`ISM ${member.sector} v2 components`}>
          <thead><tr><th>Signal</th><th>Reading</th><th>Sector weight</th><th>Context contribution</th></tr></thead>
          <tbody>{member.assessment.readings.map((row) => {
            const combined = member.readings.find((item) => item.id === `${member.sector}:${row.id}`)!
            return <tr key={row.id}>
              <td title={row.description}>{row.label}</td>
              <td title={`${format(row.value)} index points · ${row.sampleCount} earlier signals`}>
                {row.points === null ? 'Unavailable' : row.points > 0 ? `Above comparison pace · ${row.size}` : row.points < 0 ? `Below comparison pace · ${row.size}` : 'At comparison pace'}
                <small>{row.state}</small>{row.reason && <small>{row.reason}</small>}
              </td>
              <td>{row.weight}%</td>
              <td className={combined.contribution === null || combined.contribution === 0 ? 'inspector-score-unchanged' : combined.contribution > 0 ? 'inspector-score-positive' : 'inspector-score-negative'}>{format(combined.contribution)}</td>
            </tr>
          })}</tbody>
        </table></div>
        <ul>{member.assessment.readings.map((row) => <li key={row.id}>{row.label}: {format(row.value)} index points · N = {row.sampleCount} ·
          {row.limits ? ` ${row.magnitudeMode === 'custom' ? 'manual override' : 'automatic'} boundaries ${row.limits.map((limit) => limit.toLocaleString(undefined, { maximumFractionDigits: 6 })).join(' / ')} index points` : ' boundaries unavailable'}</li>)}</ul>
      </>}
      {member.release && onOpenScatter && <button type="button" onClick={() => onOpenScatter(member.release!)}>Inspect {member.sector === 'services' ? 'Services' : 'Manufacturing'} signals</button>}
    </section>)}
    <p>Combined USD score {loading ? '—' : format(assessment.total)} · Positive → EURUSD Short · Negative → EURUSD Long</p>
    {!loading && assessment.tieBreak && <p>Tie-break: {assessment.tieBreak.label} · weak evidence</p>}
    <p>Services leads with 70%; Manufacturing has 30%. Services keeps its v1 weights. Manufacturing uses orders 50%, employment 35%, prices paid 15%. Components compare their latest index with max(50, preceding three-month average), using supplied Revised Previous for the nearest month. Below-50 rebounds remain declines. Weights and the floor are prototype interpretation choices.</p>
    <p>Demand, labor and prices are three evidence groups across both sectors. Related orders/activity readings do not count as separate confirmations. Sector disagreement or opposing demand/employment votes cap evidence at moderate; narrow leads, missing components and ties give weak evidence. Headline composites do not vote. Manufacturing production, inventories and supplier deliveries are unavailable and are not inferred.</p>
    <p>One chart symbol groups the reference month's Manufacturing and Services publications at the first publication. Their real timestamps remain separate in the readings. Choose Scoring publication to inspect either update: this view uses only observations available at that publication, and carries no older sector month into the current group. Before the other report arrives, its section stays pending. January 2015 history and the 24-earlier-observation gate still apply.</p>
    <p>Scatter Plot → Scoring signal exposes each source component. Services uses the same saved boundaries in v1 and v2; Manufacturing has independent boundaries. Previews stay on the chart until applied. Known timing discrepancies exclude a sector; no broker dates are silently corrected. Official date checks cover 2026 plus a weekend check, not every historical timestamp. Historical comparisons retain provider values and may contain revisions or timing errors; this is a reconstruction from stored data.</p>
    <p>No forecasts, market prices, NFP, CPI or Fed decisions enter this ISM context. Evidence and change size do not predict a price move.</p>
    {Object.values(storage.coverage).some((coverage) => coverage.missing.length > 0) && <p>Partial calendar coverage; context and calibration use the available observations.</p>}
  </div>
}
