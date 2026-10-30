import { memo, useId, useState } from 'react'
import { dailyDirectionLabel, directionStageLabel, safeThesisLink, thesisDay, type ThesisCurrency, type ThesisSource } from './thesis-model'
import { researchAssessment, researchFacts, type CurrencyResearch, type ResearchDevelopment } from './research-model'
import { LazyDetails } from './LazyDetails'

const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', year: 'numeric' })
const hour = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', minute: '2-digit', hour12: true })
const full = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', year: 'numeric', hour12: true, hour: 'numeric', minute: '2-digit' })
const dated = (value: string) => day.format(new Date(value.length === 10 ? value+'T00:00:00+07:00' : value))
const sourceName = (source: ThesisSource) => source.label.match(/^(Reuters|Dow Jones|Trading Economics|Statistics Canada|Stats NZ|TreasuryDirect|NYFed|ECB|BoJ|BoE|RBA|RBNZ|SNB|BLS|INSEE|KOF|AP)\b/)?.[0] ?? source.label
function Links({ sources, compact = false }: { sources: ThesisSource[]; compact?: boolean }) {
  return <span className="thesis-sources">{sources.map((s,i) => s.kind === 'web' && safeThesisLink(s.locator)
    ? <a key={i} href={s.locator} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={[s.label,s.note].filter(Boolean).join(' · ')}>{compact ? sourceName(s) : s.label}</a>
    : <span key={i} title={s.locator}>{s.label} (local evidence)</span>)}</span>
}
function Description({ text }: { text: string }) {
  if (text.length <= 360) return <p className="research-description">{text}</p>
  const first = text.slice(0,360)
  const ends = [...first.matchAll(/[.!?](?=\s|$)/g)]
  const sentence = ends.at(-1)?.index
  const boundary = sentence !== undefined && sentence >= 80 ? sentence+1 : first.lastIndexOf(' ')
  const excerpt = text.slice(0,boundary > 0 ? boundary : 360)
  return <><p className="research-description">{excerpt}{sentence !== undefined && boundary === sentence+1 ? '' : '…'}</p>
    <LazyDetails summary="Full description">{() => <p className="research-description">{text}</p>}</LazyDetails></>
}
function LedgerColumns() {
  return <colgroup><col className="research-time-column" /><col className="research-event-column" /><col className="research-effect-column" /><col className="research-description-column" /><col className="research-source-column" /></colgroup>
}
function LedgerHead() {
  return <thead><tr>{['Time · Jakarta','Event','Effect','Description','Source'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
}
const DevelopmentRow = memo(function DevelopmentRow({ item, currency }: { item: ResearchDevelopment; currency: string }) {
  const impact = item.impacts.find(i => i.currency === currency) ?? { implication:item.commodity_implication,thesis_effect:item.commodity_thesis_effect }
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  return <><tr data-thesis-development={item.id}>
    <td className="research-time"><time dateTime={item.published_at ?? item.published_on}>{dated(item.published_on)}</time>
      <span>{item.published_at ? hour.format(new Date(item.published_at)) : 'Hour unknown'}</span>
      {item.event_at && <small>Event: {full.format(new Date(item.event_at))}</small>}</td>
    <th scope="row" className="research-event">{item.instruments?.length ? item.instruments.join(' / ')+' · ' : ''}{item.title}</th>
    <td><p>{impact.implication || 'Not separately recorded.'}</p>
      {impact.thesis_effect && <LazyDetails summary="Effect on thesis">{() => <p>{impact.thesis_effect}</p>}</LazyDetails>}</td>
    <td><Description text={researchFacts(item)} />{item.instrument_note && <p>{item.instrument_note}</p>}</td>
    <td className="research-source"><Links sources={item.sources} compact /><button type="button" className="research-detail-toggle" aria-expanded={expanded} aria-controls={expanded ? detailsId : undefined} onClick={() => setExpanded(!expanded)}>Details & history</button></td>
  </tr>{expanded && <tr className="research-expanded-row" id={detailsId}><td colSpan={5}>
      <p>Verified {full.format(new Date(item.verified_utc))} Jakarta.</p>
      <p>Recorded {full.format(new Date(item.saved_utc))} Jakarta.</p>
      {item.timing_note && <p>{item.timing_note}</p>}
      {item.references.map(r => <p key={r.kind+':'+r.key}>{r.kind === 'external' ? 'External Source' : r.broker} · {r.key}{r.value_ids.length ? ` · value IDs ${r.value_ids.join(', ')}` : ''}</p>)}
      {!!item.versions?.length && item.versions.length > 1 && <LazyDetails summary={`Development history · ${item.versions.length} versions`}>
        {() => <table className="thesis-history-table" aria-label={`${item.title} versions`}><thead><tr><th scope="col">Recorded · Jakarta</th><th scope="col">Description</th><th scope="col">Source</th></tr></thead><tbody>
          {item.versions!.map(v => <tr key={v.id}><td>{full.format(new Date(v.saved_utc))}<p>{v.revision_note || 'Initial record'}</p></td><td><p>{v.facts}</p></td><td><Links sources={v.sources} compact /></td></tr>)}
        </tbody></table>}
      </LazyDetails>}
    </td></tr>}</>
})
function DevelopmentLedger({ items, currency, background = false }: { items: ResearchDevelopment[]; currency: string; background?: boolean }) {
  const [requestedPage, setPage] = useState(0)
  const pageSize = 20, pages = Math.max(1,Math.ceil(items.length/pageSize)), page = Math.min(requestedPage,pages-1)
  const label = background ? 'background entries' : 'developments'
  return <>
    {items.length > pageSize && <nav className="thesis-pagination" aria-label={`${currency} ${label} pages`}>
      <button type="button" disabled={!page} onClick={() => setPage(page-1)}>Previous {label}</button>
      <span>{page*pageSize+1}–{Math.min((page+1)*pageSize,items.length)} of {items.length} {label}</span>
      <button type="button" disabled={page+1===pages} onClick={() => setPage(page+1)}>Next {label}</button>
    </nav>}
    <table className="thesis-currency-table" aria-label={`${currency} ${background ? 'active background' : 'developments'}`}>
      <LedgerColumns /><LedgerHead /><tbody>{items.slice(page*pageSize,(page+1)*pageSize).map(item => <DevelopmentRow key={item.id} item={item} currency={currency} />)}</tbody>
    </table>
  </>
}

export const ThesisCurrencyTable = memo(function ThesisCurrencyTable({ data, currency }: { data: CurrencyResearch; currency: ThesisCurrency }) {
  const future = data.from > thesisDay(new Date().toISOString())
  const assessment = future ? undefined : researchAssessment(data,currency)
  const direction = assessment?.direction
  const entries = future ? [] : data.developments.filter(d => d.published_on >= data.from && d.published_on <= data.to && d.impacts.some(i => i.currency === currency))
  const entryIds = new Set(entries.map(d => d.id))
  const background = data.developments.filter(d => !entryIds.has(d.id) && (assessment?.background_ids.includes(d.id) || d.published_on < data.from && assessment?.evidence_ids.includes(d.id)))
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
      {direction ? <>{direction.review_status && <p className="thesis-notice">{directionStageLabel(direction)}</p>}
        <div className="thesis-assessment-reason"><Description text={direction.reason} /></div>
        <LazyDetails className="thesis-details" summary="Assessment details">{() => <>
          <p>Horizon: {direction.horizon || 'See the original assessment.'}</p>
          {direction.basis !== 'standalone' && <p>Older comparison; needs a standalone assessment before use as a broad currency verdict.</p>}
          <Links sources={direction.sources} />
          {assessment && <p>Researched period: {dated(assessment.period_start)} – {dated(assessment.period_end)}.{assessment.gap && ` Coverage: ${assessment.gap}`}</p>}
        </>}</LazyDetails>
      </> : <p>{assessment?.gap || (future ? 'Future dates stay unassessed.' : 'No saved assessment for this currency by this date.')}</p>}
      {pending && <p className="thesis-notice">Newer saved evidence has not yet been incorporated into this assessment.</p>}
      <h4>Developments</h4>
      {entries.length ? <DevelopmentLedger key={`${currency}:${data.from}:${data.to}`} items={entries} currency={currency} /> : <p className="thesis-notice">No verified developments saved in this interval. This is not proof that no news occurred.</p>}
      {(background.length > 0 || !entries.length && direction?.evidence_anchor) && <div className="thesis-active-background"><h4>Active background</h4>
        {background.length ? <DevelopmentLedger key={`background:${currency}:${data.from}:${data.to}`} items={background} currency={currency} background /> : direction?.evidence_anchor && <table className="thesis-currency-table" aria-label={`${currency} evidence anchor`}>
          <LedgerColumns /><LedgerHead /><tbody><tr>
            <td>{direction.evidence_anchor.event_at ? <><time dateTime={direction.evidence_anchor.event_at}>{full.format(new Date(direction.evidence_anchor.event_at))}</time><small>Evidence event</small></> : <>{dated(direction.evidence_anchor.event_date!)}<small>Hour unknown</small></>}</td>
            <th scope="row">{direction.evidence_anchor.title}</th><td>See assessment</td><td><Description text={direction.evidence_anchor.note} /></td><td><Links sources={direction.evidence_anchor.sources} compact /></td>
          </tr></tbody></table>}
      </div>}
      {(direction || upcoming.length > 0) && <div className="thesis-upcoming-checkpoint"><h4>Upcoming checkpoints</h4>
        {upcoming.length > 0 && <table className="thesis-checkpoint-table" aria-label={`${currency} upcoming checkpoints`}><colgroup><col className="research-time-column" /><col className="research-event-column" /><col /><col className="research-source-column" /></colgroup>
          <thead><tr>{['Time · Jakarta','Event','What to reassess','Source'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>
            {upcoming.map(cp => <tr key={cp.title+':'+(cp.event_at ?? cp.event_date)}><td>{cp.event_at ? full.format(new Date(cp.event_at)) : cp.event_date ? <>{dated(cp.event_date)}<small>Hour unknown</small></> : 'Schedule unverified'}</td><th scope="row">{cp.title}</th><td><Description text={cp.note} /></td><td className="research-source"><Links sources={cp.sources} compact /></td></tr>)}
          </tbody></table>}
        {direction && !direction.reassessment && <p>{direction.reassessment_gap || 'No verified checkpoint saved.'}</p>}
      </div>}
      {changes.length > 1 && <LazyDetails className="thesis-details" summary={`Assessment history · ${changes.length} recorded views`}>
        {() => <table className="thesis-history-table" aria-label={`${currency} assessment history`}><thead><tr>{['Time · Jakarta','Verdict','Reason','Source'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>
          {changes.map(a => <tr key={a.id}><td>{full.format(new Date(a.as_of_utc))}</td><th scope="row">{dailyDirectionLabel(a.direction!)}</th><td>{a.direction!.review_status && <p>{directionStageLabel(a.direction!)}</p>}<p>{a.direction!.reason}</p></td><td><Links sources={a.direction!.sources} compact /></td></tr>)}
        </tbody></table>}
      </LazyDetails>}
    </section>
  </div>
})
