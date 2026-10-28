import { useState } from 'react'
import { dailyDirectionLabel, safeThesisLink, thesisMonths, type ThesisReviewEntry } from './thesis-model'
import { useTheses } from './useTheses'
import { downloadThesisMarkdown } from './thesis-export'
import { researchInstruments } from '../external-sources/research-instruments'

const clock=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short',hour12:true})
const timed=(value:string)=>clock.format(new Date(value))+' Jakarta'

function SavedReview({ review }: { review: ThesisReviewEntry }) {
  return <div>
    <p>Research cutoff {timed(review.as_of_utc)}; saved {timed(review.saved_utc)}. {review.provenance}. {review.note}</p>
    {review.currency_views?.map(view => <div key={view.currency}>
      <h4>{view.currency}{view.direction ? ' · '+dailyDirectionLabel(view.direction) : ''}</h4>
      <p>{view.direction?.reason || view.summary || view.news_gap}</p>
      {view.news?.map((n,i) => <p key={i}>{n.published_at ? timed(n.published_at) : n.published_on+' · hour unknown'} · {n.summary} {n.sources.map((s,j) => s.kind==='web' && safeThesisLink(s.locator) ? <a key={j} href={s.locator} target="_blank" rel="noopener noreferrer">{s.label}</a> : <span key={j}>{s.label}</span>)}</p>)}
    </div>)}
    {[...(review.entry_opportunities ?? []),...(review.commodity_opportunities ?? [])].map((item,i) => <p key={i}>{'currency' in item ? item.currency : researchInstruments[item.instrument].label} · {item.summary} · {timed(item.starts_at)} – {timed(item.ends_at)}. {item.invalidation}</p>)}
    {review.opportunity_gap && <p>{review.opportunity_gap}</p>}
    {review.limitations && <p>Coverage: {review.limitations}</p>}
  </div>
}
export function LegacyResearchArchive() {
  const [month,setMonth]=useState('2026-10')
  const {data,error}=useTheses('ALL',month)
  return <div className="thesis-legacy-archive">
    <label>Archive month <select aria-label="Thesis archive month" value={month} onChange={e=>setMonth(e.target.value)}>{thesisMonths.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
    {error && <p role="alert">{error}</p>}
    {data?.reviews?.map(review=><details key={review.id} className="thesis-details"><summary>{timed(review.as_of_utc)} · {review.versions.length} saved versions</summary>
      <SavedReview review={review} />
      <button type="button" onClick={()=>downloadThesisMarkdown(data,error,new Date(Date.parse(review.as_of_utc)+7*3600000).toISOString().slice(0,10))}>Export this earlier research date</button>
      {review.versions.slice(0,-1).reverse().map(v=><details key={v.id}><summary>Earlier version · {timed(v.saved_utc)}</summary><SavedReview review={v} /></details>)}
    </details>)}
    {data && !data.reviews?.length && <p>No earlier daily reviews in this month.</p>}
  </div>
}
