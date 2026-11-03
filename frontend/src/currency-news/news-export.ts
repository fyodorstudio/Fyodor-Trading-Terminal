import { newsTime, type NewsCurrency, type NewsItem, type NewsSnapshot } from './news-model'

const prose = (value: string) => value.replace(/([\\`*_{}[\]<>#|])/g, '\\$1')
const sourceLines = (item: NewsItem) => item.sources.map(s => `- [${prose(s.label)}](<${s.url.replaceAll('<', '%3C').replaceAll('>', '%3E')}>)`).join('\n')
function itemText(item: NewsItem) {
  return `${item.published_at ? `${newsTime(item.published_at)} · ${item.published_at}` : 'Publication time unknown'} — ${prose(item.summary)}${item.timing_note ? `\n\n${prose(item.timing_note)}` : ''}\n\n${sourceLines(item)}`
}
export function newsMarkdown(data: NewsSnapshot, scope: NewsCurrency | 'ALL', historyDate: string | null) {
  const lines = [`# Currency News — ${historyDate ? `saved history · ${historyDate}` : 'latest saved results'}`, '', 'Display times: Jakarta · AM/PM. Original source, check and save clocks are retained below.', '']
  for (const row of data.rows.filter(r => scope === 'ALL' || scope === r.currency)) {
    lines.push(`## ${row.currency}`, '')
    const s = row.snapshot
    if (!s) { lines.push(historyDate ? 'Not researched in this refresh.' : 'Not refreshed yet.', ''); continue }
    lines.push(`Saved: ${newsTime(s.saved_at)} · ${s.saved_at}`, `Checked: ${newsTime(s.checked_at)} · ${s.checked_at}`, `Publication lookback: ${s.window_hours} hours`, `Refresh ID: ${s.run_id}`, '', `Coverage: ${s.coverage}${s.coverage_note ? ` — ${prose(s.coverage_note)}` : ''}`, '', `Implication: ${s.implication.replaceAll('_', ' ')}`, '', prose(s.reason), '', '### Verified information', '')
    lines.push(s.items.length ? s.items.map(itemText).join('\n\n') : s.coverage === 'unavailable' ? 'News coverage unavailable.' : 'No qualifying news verified within this window.', '')
    if (s.background.length) lines.push('### Older background', '', s.background.map(itemText).join('\n\n'), '')
  }
  return lines.join('\n')
}

export function downloadNews(data: NewsSnapshot, scope: NewsCurrency | 'ALL', historyDate: string | null) {
  const url = URL.createObjectURL(new Blob([newsMarkdown(data, scope, historyDate)], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url; link.download = `currency-news-${scope.toLowerCase()}-${historyDate ?? 'latest'}.md`
  document.body.append(link)
  try { link.click() } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) }
}
