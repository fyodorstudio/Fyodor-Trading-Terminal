import { dailyDirectionLabel, directionStageLabel, reviewCurrencies, safeThesisLink, type ThesisCurrency, type ThesisSource } from './thesis-model'
import { researchAssessment, type CurrencyResearch } from './research-model'
import { researchPrompt } from './research-prompt'

const text = (s: string) => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('|','\\|').replaceAll('[','\\[').replaceAll(']','\\]').replace(/\r?\n/g,'<br>')
const links = (items: ThesisSource[]) => items.map(s => s.kind === 'web' && safeThesisLink(s.locator) ? `[${text(s.label)}](${s.locator.replaceAll('|','%7C').replaceAll('(','%28').replaceAll(')','%29')})` : text(s.label)).join(' · ')
const clock = (s: string) => new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Jakarta', dateStyle:'medium', timeStyle:'short', hour12:true }).format(new Date(s))+' Jakarta'
export function researchMarkdown(data: CurrencyResearch, error: string | null = null, selectedCurrency?: ThesisCurrency) {
  const lines = [`# Thesis research · ${data.from} – ${data.to}`, '', `Exported ${clock(new Date().toISOString())}. Original source and assessment clocks are preserved.`, '']
  if (error) lines.push(`Load error: ${text(error)}. Export uses the last loaded snapshot.`, '')
  for (const currency of selectedCurrency ? [selectedCurrency] : reviewCurrencies) {
    const a=researchAssessment(data,currency), d=a?.direction
    lines.push(`## ${currency}${d ? ' · '+dailyDirectionLabel(d) : ''}`, '')
    if (a) lines.push(`Last Assessed: ${clock(d?.verified_utc ?? a.as_of_utc)} · ${a.provenance}. Researched period: ${a.period_start} – ${a.period_end}.`, '')
    if (d?.review_status) lines.push(text(directionStageLabel(d)), '')
    if (d) lines.push(text(d.reason),'',`Horizon: ${text(d.horizon || 'See original assessment.')}. ${links(d.sources)}`,'')
    if (a?.gap) lines.push(`Coverage: ${text(a.gap)}`,'')
    const background = data.developments.filter(item => a?.background_ids.includes(item.id) || item.published_on<data.from && a?.evidence_ids.includes(item.id))
    if (background.length || d?.evidence_anchor) {
      lines.push('### Active background','')
      for (const item of background) lines.push(`- ${item.published_on} · ${text(item.title)}. ${text(item.facts)} ${links(item.sources)}`)
      if (!background.length && d?.evidence_anchor) lines.push(`- ${d.evidence_anchor.event_at ? clock(d.evidence_anchor.event_at) : d.evidence_anchor.event_date} · ${text(d.evidence_anchor.title)}. ${text(d.evidence_anchor.note)} ${links(d.evidence_anchor.sources)}`)
      lines.push('')
    }
    lines.push('| Date | Time · Jakarta | Development | Fundamental implication | Effect on existing thesis | Source |','| --- | --- | --- | --- | --- | --- |')
    for (const item of data.developments.filter(item => item.published_on>=data.from && item.published_on<=data.to)) {
      const impact=item.impacts.find(i=>i.currency===currency); if (!impact) continue
      lines.push(`| ${item.published_on} | ${item.published_at ? clock(item.published_at) : 'Hour unknown'}${item.event_at ? '<br>Event: '+clock(item.event_at) : ''} | ${text(item.title)}<br>${text(item.facts)} | ${text(impact.implication || 'Not separately recorded in older research.')} | ${text(impact.thesis_effect || 'See dated assessment.')} | ${links(item.sources)} |`)
    }
    lines.push('')
    const upcoming=[...new Map([...(d?.reassessment ? [d.reassessment] : []),...(a?.checkpoints ?? [])].map(cp=>[cp.title+':'+(cp.event_at ?? cp.event_date),cp])).values()]
    for (const cp of upcoming) lines.push(`Upcoming checkpoint: **${text(cp.title)}** · ${cp.event_at ? clock(cp.event_at) : cp.event_date+' · hour unknown'}. ${text(cp.note)} ${links(cp.sources)}`, '')
    if (d && !d.reassessment) lines.push(`Review needed: ${text(d.reassessment_gap || 'No verified checkpoint saved.')}`, '')
    lines.push('### Assessment history','')
    for (const item of data.assessments.filter(a=>a.currency===currency)) lines.push(`- ${clock(item.as_of_utc)} · ${item.direction ? dailyDirectionLabel(item.direction)+': '+text(item.direction.reason)+(item.direction.review_status ? ' · '+text(directionStageLabel(item.direction)) : '') : 'Unresolved: '+text(item.gap)} · version ${item.id}`)
    lines.push('')
  }
  const commodities=selectedCurrency ? [] : data.developments.filter(d=>d.instruments?.length && d.published_on>=data.from && d.published_on<=data.to)
  if (commodities.length) {
    lines.push('## Selective commodity research','')
    for (const d of commodities) lines.push(`- ${d.published_on} · ${d.instruments!.join(' / ')} · ${text(d.title)}. ${text(d.facts)} ${text(d.instrument_note!)} Implication: ${text(d.commodity_implication!)} Effect: ${text(d.commodity_thesis_effect!)} ${links(d.sources)}`)
    lines.push('')
  }
  lines.push('## Source provenance and development history','')
  for (const d of data.developments.filter(d => !selectedCurrency || d.impacts.some(i => i.currency === selectedCurrency))) {
    lines.push(`- ${d.key} · ${d.id}. Published ${d.published_at ? clock(d.published_at) : d.published_on+' · hour unknown'}; verified ${clock(d.verified_utc)}; recorded ${clock(d.saved_utc)}. ${text(d.timing_note)} ${links(d.sources)}`)
    for (const r of d.references) lines.push(`  - ${r.kind}: ${r.key}${r.broker ? ' · '+r.broker : ''}${r.value_ids.length ? ' · value IDs '+r.value_ids.join(', ') : ''}`)
    for (const v of d.versions ?? []) lines.push(`  - Version ${v.id} · recorded ${clock(v.saved_utc)}. ${text(v.revision_note)} ${text(v.facts)} ${links(v.sources)}`)
  }
  lines.push('', '## Continue research','',researchPrompt(data.from,data.to,selectedCurrency),'')
  return lines.join('\n')
}
export function downloadResearchMarkdown(data: CurrencyResearch, error: string | null, currency: ThesisCurrency) {
  const url=URL.createObjectURL(new Blob([researchMarkdown(data,error,currency)],{type:'text/markdown;charset=utf-8'})), anchor=document.createElement('a')
  try { anchor.href=url; anchor.download=`thesis-${currency}-${data.from}${data.to===data.from ? '' : '-'+data.to}.md`;document.body.append(anchor);anchor.click() }
  finally { anchor.remove();URL.revokeObjectURL(url) }
}
