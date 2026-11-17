import { formatHeatmapOHLC, heatmapDate, orderHeatmapGroups, heatmapFields, type HeatmapField, type HeatmapMode, type HeatmapRow } from './heatmap-model'

const copiedTimeFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', year: 'numeric', month: 'short', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
const rankingCopyTime = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', minute: '2-digit', hour12: true })
const rankingCopyDate = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' })

export function heatmapDetailsText(changes: string, copiedAt: number) {
  return changes ? `Copied at ${copiedTimeFormatter.format(copiedAt)} WIB (Asia/Jakarta, UTC+07:00)\n\n${changes}` : ''
}

export function heatmapResearchPrompt(changes: string, mode: HeatmapMode, broker: string | null, copiedAt: number, eventWindow = false) {
  if (!changes) return ''
  const copiedTime = copiedTimeFormatter.format(copiedAt)
  const focus = 'These are the market moves shown in my selected heatmap readings. Keep your response focused on summarizing what is happening and identifying potential trade entries where repricing may still be incomplete. I mainly trade currencies, but consider every instrument in my selected heatmap as a potential trading opportunity, including commodities, metals, and stock indices. Use cross-asset movements as evidence of possible capital rotation and rank opportunities across all selected asset classes. Prioritize FX when opportunities are comparable, but recommend non-FX trades when their catalysts, incomplete repricing, and risk/reward are more compelling. Identify the most likely winners and losers today and over the next few days across the selected markets, explain the supporting evidence, and distinguish observed moves from hypotheses. For potential entries, explain the catalyst, why repricing may be incomplete, the confirmation needed, the risk/reward rationale, and what would invalidate the setup. If the evidence does not support an opportunity, say so.'
  const context = 'Price moves suggest possible rotation; they do not directly measure capital flows. Respect the selected period: historical readings are not necessarily ongoing moves and require current confirmation before suggesting an opportunity today. Do not invent current prices, catalysts, or precise entry levels that the available evidence cannot establish.'
  if (eventWindow) return ['Explain the market moves in this selected event window.', focus, context, `Event-window context · ${broker ?? 'Broker'} · Copied ${copiedTime} WIB.`, changes].join('\n\n')
  const returns = mode === 'weekly' ? 'Weekly changes compare each Monday–Sunday week’s final available close with the previous week’s final available close.'
    : 'Daily changes compare each broker D1 close with its previous available close, including opening gaps.'
  return ['Explain the market moves in this heatmap.', focus, context, `Heatmap context · ${broker ?? 'Broker'} · Copied ${copiedTime} WIB (Asia/Jakarta, UTC+07:00)`,
    `${returns} O/H/L/C are percentage changes relative to that same previous close. In progress periods contain partial readings. Dates label broker sessions.`,
    'Currency baskets use equal-weight geometric returns against the other seven currencies. They are distinct from broker USDX/EURX/JPYX. Basket O/H/L is unavailable; C is the net return.',
    changes].join('\n\n')
}

export function heatmapChangesText(rows: HeatmapRow[], dates: string | readonly string[], mode: HeatmapMode, groupOrder: string[], brokerToday?: string, fields: readonly HeatmapField[] = heatmapFields) {
  const groups = orderHeatmapGroups(rows.map(row => row.group), groupOrder).map(group => ({ group, rows: rows.filter(row => row.group === group) }))
  return [...new Set(typeof dates === 'string' ? [dates] : dates)].sort().flatMap(day => {
    const end = mode === 'weekly' ? heatmapDate(Date.parse(day) + 6 * 86400_000) : day
    const inProgress = brokerToday && day <= brokerToday && end >= brokerToday
    const heading = (mode === 'weekly' ? `${day} – ${end} · Weekly` : `${day} · Daily`)
      + (inProgress ? ` · In progress (${mode === 'weekly' ? 'week' : 'day'} to date)` : '')
    const sections = groups.flatMap(group => {
      const entries = group.rows.map(row => ({ label: row.label, value: row.points.get(day)?.value, point: row.points.get(day) }))
        .filter((entry): entry is typeof entry & { value: number } => entry.value != null && Number.isFinite(entry.value))
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
      return entries.length ? [`${group.group}\n${entries.map(entry => `${entry.label} ${formatHeatmapOHLC(entry.point, fields)}${entry.point?.reason ? ' · ' + entry.point.reason : ''}`).join('\n')}`] : []
    })
    return sections.length ? [[heading, ...sections].join('\n\n')] : []
  }).join('\n\n')
}

export function heatmapRankingText(rows: HeatmapRow[], selected: string, fields: readonly HeatmapField[], heading: string, unusual = false, copiedAt = Date.now()) {
  const entries = rows.flatMap(row => {
    const point = row.points.get(selected)
    return point?.value == null ? [] : [`${row.label} · ${row.group} · ${formatHeatmapOHLC(point, fields)}${unusual ? ` · Unusual ${point.relative == null ? '—' : point.relative.toFixed(2) + '×'}` : ''}${point.reason ? ' · ' + point.reason : ''}`]
  })
  return entries.length ? [`This heatmap is copied at ${rankingCopyTime.format(copiedAt)} ${rankingCopyDate.format(copiedAt)} UTC+7`, heading,
    'Displayed ranking order. H/L are extremes; C is the net return. Missing entries omitted.', ...entries].join('\n') : ''
}
