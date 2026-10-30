import { memo, useState } from 'react'
import { dailyDirectionLabel, directionStageLabel, safeThesisLink, thesisDay, type ThesisCurrency, type ThesisSource } from './thesis-model'
import { researchAssessment, type CurrencyResearch, type ResearchDevelopment } from './research-model'
import { LazyDetails } from './LazyDetails'

const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', year: 'numeric' })
const hour = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', minute: '2-digit', hour12: true })
const full = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
const dated = (value: string) => day.format(new Date(value.length === 10 ? value+'T00:00:00+07:00' : value))
function Links({ sources }: { sources: ThesisSource[] }) {
  return <span className="thesis-sources">{sources.map((s,i) => s.kind === 'web' && safeThesisLink(s.locator)
    ? <a key={i} href={s.locator} target="_blank" rel="noopener noreferrer" title={s.note || undefined}>{s.label}</a>
    : <span key={i} title={s.locator}>{s.label} (local evidence)</span>)}</span>
}
const DevelopmentRow = memo(function DevelopmentRow({ item, currency }: { item: ResearchDevelopment; currency: string }) {
  const impact = item.impacts.find(i => i.currency === currency) ?? { implication:item.commodity_implication,thesis_effect:item.commodity_thesis_effect }
  return <tr data-thesis-development={item.id}>
    <td>{dated(item.published_on)}</td>
    <td>{item.published_at ? hour.format(new Date(item.published_at)) : 'Hour unknown'}
      {item.event_at && <small>Event: {full.format(new Date(item.event_at))}</small>}
      {item.timing_note && <details><summary>Timing</summary><p>{item.timing_note}</p></details>}</td>
    <td>{!item.legacy && <strong>{item.instruments?.length ? item.instruments.join(' / ')+' · ' : ''}{item.title}</strong>}<p>{item.facts}</p>{item.instrument_note && <p>{item.instrument_note}</p>}
      {!!item.versions?.length && item.versions.length > 1 && <LazyDetails summary={`Development history · ${item.versions.length} versions`}>
        {() => item.versions!.map(v => <div key={v.id}><p>{full.format(new Date(v.saved_utc))} · {v.revision_note || 'Initial record'}</p><p>{v.facts}</p><Links sources={v.sources} /></div>)}
      </LazyDetails>}</td>
    <td>{impact.implication || 'Not separately recorded in this older research.'}</td>
    <td>{impact.thesis_effect || 'See the dated assessment; no event-by-event verdict was saved.'}</td>
    <td><Links sources={item.sources} /><LazyDetails summary="Source details">{() => <>
      <p>Verified {full.format(new Date(item.verified_utc))} Jakarta.</p>
      <p>Recorded {full.format(new Date(item.saved_utc))} Jakarta.</p>
      {item.references.map(r => <p key={r.kind+':'+r.key}>{r.kind === 'external' ? 'External Source' : r.broker} · {r.key}{r.value_ids.length ? ` · value IDs ${r.value_ids.join(', ')}` : ''}</p>)}
    </>}</LazyDetails></td>
  </tr>
})

export const ThesisCurrencyTable = memo(function ThesisCurrencyTable({ data, currency }: { data: CurrencyResearch; currency: ThesisCurrency }) {
  const [requestedPage, setPage] = useState(0)
  const future = data.from > thesisDay(new Date().toISOString())
  const assessment = future ? undefined : researchAssessment(data, currency)
  const direction = assessment?.direction
  const entries = future ? [] : data.developments.filter(d => d.published_on >= data.from && d.published_on <= data.to && d.impacts.some(i => i.currency === currency))
  const pageSize = 20, pages = Math.max(1, Math.ceil(entries.length / pageSize)), page = Math.min(requestedPage, pages - 1)
  const background = data.developments.filter(d => assessment?.background_ids.includes(d.id) || d.published_on < data.from && assessment?.evidence_ids.includes(d.id))
  const upcoming = [...new Map([...(direction?.reassessment ? [direction.reassessment] : []),...(assessment?.checkpoints ?? [])]
    .map(cp => [cp.title+':'+(cp.event_at ?? cp.event_date),cp])).values()]
  const pending = direction && entries.some(d => !assessment?.evidence_ids.includes(d.id) && Date.parse(d.verified_utc)>Date.parse(direction.verified_utc))
  const changes = data.assessments.filter(a => a.currency === currency && a.direction && thesisDay(a.as_of_utc) >= data.from)
    .sort((a,b) => Date.parse(a.as_of_utc)-Date.parse(b.as_of_utc))
    .filter((a,i,all) => !i || a.direction!.verdict !== all[i-1].direction!.verdict || a.direction!.intensity !== all[i-1].direction!.intensity || a.direction!.basis !== all[i-1].direction!.basis)
  return <div className="thesis-currency-research">
    <p className="thesis-currency-cutoff">Research · {dated(data.from)}{data.to !== data.from && ` – ${dated(data.to)}`} · Jakarta</p>
    <section key={currency} className="thesis-currency-section" data-thesis-currency={currency} aria-label={`${currency} fundamental research`}>
        <div className="thesis-currency-heading"><h3>{currency}{direction && ` · ${dailyDirectionLabel(direction)}`}</h3>
          {assessment && <p>Last Assessed: {full.format(new Date(direction?.verified_utc ?? assessment.as_of_utc))} Jakarta{assessment.provenance === 'reconstruction' && ' · Historical reconstruction'}</p>}
        </div>
        {direction ? <>{direction.review_status && <p className="thesis-notice">{directionStageLabel(direction)}</p>}<p className="thesis-prose">{direction.reason}</p><p>Horizon: {direction.horizon || 'See the original assessment.'}</p>
          {direction.basis !== 'standalone' && <p className="thesis-notice">Older comparison; needs a standalone assessment before use as a broad currency verdict.</p>}
          <p><Links sources={direction.sources} /></p>
        </> : <p>{assessment?.gap || (future ? 'Future dates stay unassessed.' : 'No saved assessment for this currency by this date.')}</p>}
        {assessment && <p className="thesis-research-coverage">Researched period: {dated(assessment.period_start)} – {dated(assessment.period_end)}.{assessment.gap && ` Coverage: ${assessment.gap}`}</p>}
        {pending && <p className="thesis-notice">Review needed: newer saved evidence has not yet been incorporated into this assessment.</p>}
        {(background.length > 0 || direction?.evidence_anchor) && <div className="thesis-active-background"><h4>Active background</h4>
          {background.map(d => <p key={d.id}><strong>{dated(d.published_on)} · {d.title}</strong> {d.facts} <Links sources={d.sources} /></p>)}
          {!background.length && direction?.evidence_anchor && <p>{direction.evidence_anchor.event_at ? full.format(new Date(direction.evidence_anchor.event_at)) : dated(direction.evidence_anchor.event_date!)} · {direction.evidence_anchor.title}. {direction.evidence_anchor.note} <Links sources={direction.evidence_anchor.sources} /></p>}
        </div>}
        {entries.length > pageSize && <nav className="thesis-pagination" aria-label={`${currency} development pages`}>
          <button type="button" disabled={!page} onClick={() => setPage(page - 1)}>Previous developments</button>
          <span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, entries.length)} of {entries.length} developments</span>
          <button type="button" disabled={page + 1 === pages} onClick={() => setPage(page + 1)}>Next developments</button>
        </nav>}
        {entries.length ? <table className="thesis-currency-table" aria-label={`${currency} developments`}>
          <colgroup><col className="research-date-column" /><col className="research-time-column" /><col className="research-development-column" /><col /><col /><col className="research-source-column" /></colgroup>
          <thead><tr>{['Date','Time · Jakarta','Development','Fundamental implication','Effect on existing thesis','Source'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{entries.slice(page * pageSize, (page + 1) * pageSize).map(d => <DevelopmentRow key={d.id} item={d} currency={currency} />)}</tbody>
        </table> : <p className="thesis-notice">No verified developments saved in this interval. This is not proof that no news occurred.</p>}
        {(direction || upcoming.length > 0) && <div className="thesis-upcoming-checkpoint"><h4>Upcoming checkpoints</h4>
          {upcoming.map(cp => <p key={cp.title+':'+(cp.event_at ?? cp.event_date)}><strong>{cp.title}</strong> · {cp.event_at ? full.format(new Date(cp.event_at))+' Jakarta' : cp.event_date ? dated(cp.event_date)+' · hour unknown' : 'Schedule unverified'}. {cp.note} <Links sources={cp.sources} /></p>)}
          {direction && !direction.reassessment && <p>Review needed: {direction.reassessment_gap || 'No verified checkpoint saved.'}</p>}
        </div>}
        {changes.length > 1 && <LazyDetails className="thesis-details" summary={`Assessment history · ${changes.length} recorded views`}>
          {() => changes.map(a => <div key={a.id}><strong>{full.format(new Date(a.as_of_utc))} Jakarta · {dailyDirectionLabel(a.direction!)}</strong>{a.direction!.review_status && <p>{directionStageLabel(a.direction!)}</p>}<p>{a.direction!.reason}</p><Links sources={a.direction!.sources} /></div>)}
        </LazyDetails>}
      </section>
  </div>
})
