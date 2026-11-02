import { dailyDirectionLabel, directionStageLabel, reviewCurrencies, safeThesisLink, thesisDay, type ThesisCurrency, type ThesisSource } from './thesis-model'
import { researchAssessment, researchFacts, researchTimeline, type CurrencyResearch, type ResearchTimelineEntry } from './research-model'
import { researchPrompt } from './research-prompt'
import { excursionHeading, excursionLines } from './excursion-model'

const text = (s: string) => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('|','\\|').replaceAll('[','\\[').replaceAll(']','\\]').replace(/\r?\n/g,'<br>')
const links = (items: ThesisSource[]) => items.map(s => s.kind === 'web' && safeThesisLink(s.locator) ? `[${text(s.label)}](${s.locator.replaceAll('|','%7C').replaceAll('(','%28').replaceAll(')','%29')})` : text(s.label)).join(' · ')
const clock = (s: string) => new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Jakarta', dateStyle:'medium', timeStyle:'short', hour12:true }).format(new Date(s))+' Jakarta'
function ledger(rows: ResearchTimelineEntry[], currency: string) {
  const lines = ['| Time · Jakarta | Evidence and interpretation |','| --- | --- |']
  for (const row of rows) {
    if (row.kind === 'development') {
      const d=row.item, impact=d.impacts.find(i=>i.currency===currency)!
      const body=[`**${row.background ? 'Active background · ' : ''}${text(d.title)}**`,text(researchFacts(d)),text(impact.implication),
        impact.thesis_effect !== impact.implication ? text(impact.thesis_effect) : '',d.instrument_note ? text(d.instrument_note) : '',
        d.event_at ? 'Event: '+clock(d.event_at) : '',text(d.timing_note),links(d.sources)].filter(Boolean).join('<br><br>')
      lines.push(`| ${row.at ? clock(row.at) : row.date+' · Hour unknown'} | ${body} |`)
    } else if (row.kind === 'assessment') {
      const a=row.item, d=a.direction!
      lines.push(`| ${clock(a.as_of_utc)} | **Assessment · ${dailyDirectionLabel(d)}**${a.provenance === 'reconstruction' ? ' · Historical reconstruction' : ''}<br><br>${text(d.reason)}<br>${links(d.sources)} |`)
    } else {
      lines.push(`| ${row.at ? clock(row.at) : row.date+' · Hour unknown'} | **Evidence event · ${text(row.item.title)}**<br><br>${text(row.item.note)} ${links(row.item.sources)} |`)
    }
  }
  return lines
}
export function researchMarkdown(data: CurrencyResearch, error: string | null = null, selectedCurrency?: ThesisCurrency) {
  const lines = [`# Thesis research · ${data.from} – ${data.to}`, '', `Exported ${clock(new Date().toISOString())}. Original source and assessment clocks are preserved.`, '']
  if (error) lines.push(`Load error: ${text(error)}. Export uses the last loaded snapshot.`, '')
  for (const currency of selectedCurrency ? [selectedCurrency] : reviewCurrencies) {
    const future=data.from > thesisDay(new Date().toISOString())
    const a=future ? undefined : researchAssessment(data,currency), d=a?.direction
    lines.push(`## ${currency}${d ? ' · '+dailyDirectionLabel(d) : ''}`, '')
    if (a) lines.push(`Last Assessed: ${clock(d?.verified_utc ?? a.as_of_utc)} · ${a.provenance}. Researched period: ${a.period_start} – ${a.period_end}.`, '')
    if (d) lines.push(excursionHeading(a?.excursion), ...excursionLines(a?.excursion), '')
    if (d?.review_status) lines.push(text(directionStageLabel(d)), '')
    if (d) lines.push(text(d.reason),'',`Horizon: ${text(d.horizon || 'See original assessment.')}. ${links(d.sources)}`,'')
    if (a?.gap) lines.push(`Coverage: ${text(a.gap)}`,'')
    const rows=researchTimeline(data,currency)
    lines.push('### Evidence timeline','',...ledger(rows,currency),'')
    if (future) lines.push('Future dates stay unassessed.','')
    if (d?.reassessment) {
      const cp=d.reassessment
      lines.push(`Next anchor: **${text(cp.title)}** · ${cp.event_at ? clock(cp.event_at) : cp.event_date+' · Hour unknown'}. ${text(cp.note)} ${links(cp.sources)}`,'')
    }
    const upcoming=[...new Map((a?.checkpoints ?? []).filter(cp=>cp.title !== d?.reassessment?.title
      || (cp.event_at ?? cp.event_date) !== (d.reassessment.event_at ?? d.reassessment.event_date)).map(cp=>[cp.title+':'+(cp.event_at ?? cp.event_date),cp])).values()]
    if (d && !d.reassessment) lines.push(`Anchor gap: ${text(d.reassessment_gap || 'No verified anchor saved.')}`, '')
    lines.push('### Assessment history','')
    for (const item of data.assessments.filter(a=>a.currency===currency)) lines.push(`- ${clock(item.as_of_utc)} · ${item.direction ? dailyDirectionLabel(item.direction)+': '+text(item.direction.reason)+(item.direction.review_status ? ' · '+text(directionStageLabel(item.direction)) : '') : 'Unresolved: '+text(item.gap)} · version ${item.id}`, excursionHeading(item.excursion), ...excursionLines(item.excursion))
    for (const cp of upcoming) lines.push(`Additional saved checkpoint: **${text(cp.title)}** · ${cp.event_at ? clock(cp.event_at) : cp.event_date+' · hour unknown'}. ${text(cp.note)} ${links(cp.sources)}`, '')
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
