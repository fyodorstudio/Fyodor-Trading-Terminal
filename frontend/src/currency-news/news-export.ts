import { newsTime, storyDate, type NewsCurrency, type NewsFeed } from './news-model'

const prose = (value: string) => value.replace(/([\\`*_{}[\]<>#|])/g, '\\$1')
export function newsMarkdown(data: NewsFeed, scope: NewsCurrency | 'ALL', date: string) {
  const lines = [`# Currency News — ${date}`, '', 'Display times: Jakarta · AM/PM.', '']
  if (data.updated_at) lines.push(`Last updated: ${newsTime(data.updated_at)}`, '')
  for (const story of data.stories.filter(s => scope === 'ALL' || s.implications.some(i => i.currency === scope))) {
    lines.push(`## ${storyDate(story)} — ${prose(story.summary)}`, '', `Currencies: ${story.implications.map(i => i.currency).join(' · ')}`, '')
    if (!story.published_at) lines.push(`Assessed: ${newsTime(story.assessed_at)} (used for ordering and age)`, '')
    for (const s of story.sources) lines.push(`- [${prose(s.label)}](<${s.url.replaceAll('<', '%3C').replaceAll('>', '%3E')}>)`)
    lines.push('', '### Implication', '')
    for (const i of story.implications.filter(i => scope === 'ALL' || i.currency === scope)) {
      lines.push(`**${i.currency} · ${i.bias === 'conditional' ? 'Scenarios' : i.bias}**`, '')
      if (i.bullish_if) lines.push(`Bullish if ${prose(i.bullish_if)}`, '')
      if (i.bearish_if) lines.push(`Bearish if ${prose(i.bearish_if)}`, '')
      lines.push(prose(i.reason), '')
      if (i.coverage_note) lines.push(prose(i.coverage_note), '')
      if (i.timing_note) lines.push(prose(i.timing_note), '')
      lines.push(`Assessment ID: ${i.selected_run ?? i.versions[0].run_id}`, '')
    }
  }
  if (!data.stories.some(s => scope === 'ALL' || s.implications.some(i => i.currency === scope))) {
    lines.push('No news fundamentals saved for this date.', '', '### Implication', '')
    for (const c of data.coverage.filter(c => scope === 'ALL' || c.currency === scope)) lines.push(`${c.currency}: ${prose(c.note || 'No stories saved.')}`, '')
  }
  return lines.join('\n')
}

export function downloadNews(data: NewsFeed, scope: NewsCurrency | 'ALL', date: string) {
  const url = URL.createObjectURL(new Blob([newsMarkdown(data, scope, date)], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url; link.download = `currency-news-${scope.toLowerCase()}-${date}.md`
  document.body.append(link)
  try { link.click() } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) }
}
