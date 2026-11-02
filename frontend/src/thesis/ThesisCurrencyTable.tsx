import { memo, useState } from 'react'
import { dailyDirectionLabel, directionStageLabel, safeThesisLink, thesisDay, type ThesisCurrency, type ThesisSource } from './thesis-model'
import { researchAssessment, researchFacts, researchTimeline, type CurrencyResearch, type ResearchDevelopment, type ResearchTimelineEntry } from './research-model'
import { CheckpointBell } from './CheckpointBell'

const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', year: 'numeric' })
const hour = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', minute: '2-digit', hour12: true })
const full = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', year: 'numeric', hour12: true, hour: 'numeric', minute: '2-digit' })
const dated = (value: string) => day.format(new Date(value.length === 10 ? value+'T00:00:00+07:00' : value))
const sourceName = (source: ThesisSource) => source.label.match(/^(Reuters|Dow Jones|Trading Economics|Statistics Canada|Stats NZ|TreasuryDirect|NYFed|ECB|BoJ|BoE|RBA|RBNZ|SNB|BLS|INSEE|KOF|AP)\b/)?.[0] ?? source.label
function Links({ sources }: { sources: ThesisSource[] }) {
  return <span className="thesis-sources">{sources.map((s,i) => s.kind === 'web' && safeThesisLink(s.locator)
    ? <a key={i} href={s.locator} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={[s.label,s.note].filter(Boolean).join(' · ')}>{sourceName(s)}</a>
    : <span key={i} title={s.locator}>{s.label} (local evidence)</span>)}</span>
}
function Time({ date, at }: { date: string; at: string | null }) {
  return <td className="research-time"><time dateTime={at ?? date}>{dated(date)}</time><span>{at ? hour.format(new Date(at)) : 'Hour unknown'}</span></td>
}
const DevelopmentRow = memo(function DevelopmentRow({ item, currency, background }: { item: ResearchDevelopment; currency: string; background: boolean }) {
  const impact = item.impacts.find(i => i.currency === currency)
  return <tr data-thesis-development={item.id}>
    <Time date={item.published_on} at={item.published_at} />
    <td>
      <p className="research-event"><strong>{background && 'Active background · '}{item.instruments?.length ? item.instruments.join(' / ')+' · ' : ''}{item.title}</strong></p>
      <p className="research-description">{researchFacts(item)}</p>
      {impact?.implication && <p>{impact.implication}</p>}
      {impact?.thesis_effect && impact.thesis_effect !== impact.implication && <p>{impact.thesis_effect}</p>}
      {item.instrument_note && <p>{item.instrument_note}</p>}
      {item.event_at && <p>Event: {full.format(new Date(item.event_at))} Jakarta.</p>}
      {item.timing_note && <p>{item.timing_note}</p>}
      <Links sources={item.sources} />
    </td>
  </tr>
})
const AssessmentRow = memo(function AssessmentRow({ item }: { item: Extract<ResearchTimelineEntry, {kind:'assessment'}>['item'] }) {
  return <tr data-thesis-assessment={item.id}>
    <Time date={thesisDay(item.as_of_utc)} at={item.as_of_utc} />
    <td><p><strong>Assessment · {dailyDirectionLabel(item.direction!)}</strong>{item.provenance === 'reconstruction' && ' · Historical reconstruction'}</p>
      <p>{item.direction!.reason}</p>
      {item.direction!.review_status === 'provisional' && <p>{directionStageLabel(item.direction!)}</p>}
      {item.gap && <p>{item.gap}</p>}
      <Links sources={item.direction!.sources} />
    </td>
  </tr>
})
const AnchorRow = memo(function AnchorRow({ item, date, at }: Extract<ResearchTimelineEntry, {kind:'anchor'}>) {
  return <tr><Time date={date} at={at} />
    <td><p><strong>Evidence event · {item.title}</strong></p><p>{item.note}</p><Links sources={item.sources} /></td>
  </tr>
})
function EvidenceTimeline({ rows, currency }: { rows: ResearchTimelineEntry[]; currency: string }) {
  const [requestedPage, setPage] = useState(0)
  const pageSize = 20, pages = Math.max(1,Math.ceil(rows.length/pageSize)), page = Math.min(requestedPage,pages-1)
  return <>
    {rows.length > pageSize && <nav className="thesis-pagination" aria-label={currency+' evidence pages'}>
      <button type="button" disabled={!page} onClick={() => setPage(page-1)}>Previous evidence</button>
      <span>{page*pageSize+1}–{Math.min((page+1)*pageSize,rows.length)} of {rows.length}</span>
      <button type="button" disabled={page+1===pages} onClick={() => setPage(page+1)}>Next evidence</button>
    </nav>}
    <table className="thesis-evidence-table" aria-label={currency+' evidence timeline'}>
      <colgroup><col className="research-time-column" /><col /></colgroup>
      <thead><tr><th scope="col">Time · Jakarta</th><th scope="col">Evidence and interpretation</th></tr></thead>
      <tbody>{rows.slice(page*pageSize,(page+1)*pageSize).map(row => row.kind === 'development'
        ? <DevelopmentRow key={'development:'+row.item.id} item={row.item} currency={currency} background={row.background} />
        : row.kind === 'assessment' ? <AssessmentRow key={'assessment:'+row.item.id} item={row.item} />
        : <AnchorRow key="evidence-anchor" {...row} />)}</tbody>
    </table>
  </>
}

export const ThesisCurrencyTable = memo(function ThesisCurrencyTable({ data, currency }: { data: CurrencyResearch; currency: ThesisCurrency }) {
  const future = data.from > thesisDay(new Date().toISOString())
  const assessment = future ? undefined : researchAssessment(data,currency)
  const direction = assessment?.direction
  const rows = future ? [] : researchTimeline(data,currency)
  const checkpoint = direction?.reassessment
  const pending = direction && data.developments.some(d => d.published_on >= data.from && d.published_on <= data.to
    && d.impacts.some(i => i.currency === currency) && !assessment?.evidence_ids.includes(d.id) && Date.parse(d.verified_utc)>Date.parse(direction.verified_utc))
  return <div className="thesis-currency-research">
    <section key={currency} className="thesis-currency-section" data-thesis-currency={currency} aria-label={currency+' fundamental research'}>
      <div className="thesis-currency-heading"><h3>{currency}{direction && ' · '+dailyDirectionLabel(direction)}</h3>
        {assessment && <p>Last Assessed: {full.format(new Date(direction?.verified_utc ?? assessment.as_of_utc))} Jakarta{assessment.provenance === 'reconstruction' && ' · Historical reconstruction'}</p>}
      </div>
      {direction ? <div className="thesis-current-assessment" aria-label={currency+' current assessment'}>
        <p>{direction.reason}</p>
        {direction.horizon && <p>{direction.horizon}</p>}
        {direction.review_status === 'provisional' && <p>{directionStageLabel(direction)}</p>}
        {direction.basis !== 'standalone' && <p>Older comparison; a standalone assessment is needed before use as a broad currency verdict.</p>}
        {assessment?.gap && <p className="thesis-notice">{assessment.gap}</p>}
        <Links sources={direction.sources} />
      </div> : <p>{assessment?.gap || (future ? 'Future dates stay unassessed.' : 'No saved assessment for this currency by this date.')}</p>}
      {pending && <p className="thesis-notice">Newer saved evidence has not yet been incorporated into this assessment.</p>}
      {direction && <div className="thesis-next-anchor" aria-label={currency+' next anchor'}>
        <h4>Next anchor {checkpoint && <CheckpointBell currency={currency} at={checkpoint.event_at} />}</h4>
        {checkpoint ? <><p><strong>{checkpoint.event_at ? full.format(new Date(checkpoint.event_at)) : dated(checkpoint.event_date!)+' · Hour unknown'} · {checkpoint.title}</strong></p>
          <p>{checkpoint.note}</p><Links sources={checkpoint.sources} /></> : <p>{direction.reassessment_gap || 'No verified anchor saved.'}</p>}
      </div>}
      {rows.length > 0 && <EvidenceTimeline key={currency+':'+data.from+':'+data.to} rows={rows} currency={currency} />}
      {!future && !rows.length && <p className="thesis-notice">No evidence saved in this interval.</p>}
    </section>
  </div>
})
