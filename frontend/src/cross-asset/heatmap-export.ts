import { formatHeatmapChange, heatmapDate, orderHeatmapGroups, type HeatmapMode, type HeatmapRow } from './heatmap-model'

export function heatmapResearchPrompt(changes: string, mode: HeatmapMode, broker: string | null, copiedAt: number) {
  if (!changes) return ''
  const instructions = 'Research current opportunities as of when you run this prompt across the markets in the pasted heatmap. Focus on fresh catalysts whose repricing may still be unfolding, including moves already underway. Browse current reporting (such as Reuters and Bloomberg) and original sources. Give me the strongest supported directional ideas: affected market, buy/sell bias, and a short explanation of the catalyst and why further adjustment may remain from current prices. Cite the decisive source. Prioritize your best few ideas; don’t force an opportunity. Keep the answer direct and concise. Use this prompt directly without invoking repository research workflows.'
  const returns = mode === 'weekly' ? 'Weekly changes compare each Monday–Sunday week’s final available close with the previous week’s final available close.'
    : 'Daily changes compare each broker D1 close with its previous available close, including opening gaps.'
  return [instructions, `Heatmap context · ${broker ?? 'Broker'} · Copied ${new Date(copiedAt).toISOString()} (UTC)`,
    `${returns} Headings marked In progress show provisional day/week-to-date changes to the latest available reading, not final closing returns. Dates are broker session labels; markets have different closing hours. Copy time is the export time, not the last market update. Missing readings are omitted, not zero.`,
    'Currency baskets are custom equal-weight geometric returns of each currency against the other seven among EUR, GBP, AUD, NZD, USD, CAD, CHF and JPY, requiring all seven with matching comparison dates. They are distinct from broker USDX/EURX/JPYX.',
    changes].join('\n\n')
}

export function heatmapChangesText(rows: HeatmapRow[], dates: string | readonly string[], mode: HeatmapMode, groupOrder: string[], brokerToday?: string) {
  const groups = orderHeatmapGroups(rows.map(row => row.group), groupOrder).map(group => ({ group, rows: rows.filter(row => row.group === group) }))
  return [...new Set(typeof dates === 'string' ? [dates] : dates)].sort().flatMap(day => {
    const end = mode === 'weekly' ? heatmapDate(Date.parse(day) + 6 * 86400_000) : day
    const inProgress = brokerToday && day <= brokerToday && end >= brokerToday
    const heading = (mode === 'weekly' ? `${day} – ${end} · Weekly` : `${day} · Daily`)
      + (inProgress ? ` · In progress (${mode === 'weekly' ? 'week' : 'day'} to date)` : '')
    const sections = groups.flatMap(group => {
      const entries = group.rows.map(row => ({ label: row.label, value: row.points.get(day)?.value }))
        .filter((entry): entry is { label: string; value: number } => entry.value != null && Number.isFinite(entry.value))
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
      return entries.length ? [`${group.group}\n${entries.map(entry => `${entry.label} ${formatHeatmapChange(entry.value)}`).join('\n')}`] : []
    })
    return sections.length ? [[heading, ...sections].join('\n\n')] : []
  }).join('\n\n')
}
