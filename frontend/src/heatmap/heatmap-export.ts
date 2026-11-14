import { formatHeatmapOHLC, heatmapDate, orderHeatmapGroups, heatmapFields, type HeatmapField, type HeatmapMode, type HeatmapRow } from './heatmap-model'

export function heatmapResearchPrompt(changes: string, mode: HeatmapMode, broker: string | null, copiedAt: number, eventWindow = false) {
  if (!changes) return ''
  const copiedTime = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(copiedAt)
  if (eventWindow) return ['Explain the market moves in this selected event window.', `Event-window context · ${broker ?? 'Broker'} · Copied ${copiedTime} WIB.`, changes].join('\n\n')
  const returns = mode === 'weekly' ? 'Weekly changes compare each Monday–Sunday week’s final available close with the previous week’s final available close.'
    : 'Daily changes compare each broker D1 close with its previous available close, including opening gaps.'
  return ['Explain the market moves in this heatmap.', `Heatmap context · ${broker ?? 'Broker'} · Copied ${copiedTime} WIB (Asia/Jakarta, UTC+07:00)`,
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
      return entries.length ? [`${group.group}\n${entries.map(entry => `${entry.label} ${formatHeatmapOHLC(entry.point, fields)}`).join('\n')}`] : []
    })
    return sections.length ? [[heading, ...sections].join('\n\n')] : []
  }).join('\n\n')
}

export function heatmapRankingText(rows: HeatmapRow[], selected: string, fields: readonly HeatmapField[], heading: string) {
  const entries = rows.flatMap(row => {
    const point = row.points.get(selected)
    return point?.value == null ? [] : [`${row.label} · ${row.group} · ${formatHeatmapOHLC(point, fields)} · Baseline ${point.from ?? 'unavailable'} · Through ${point.through ?? 'unavailable'}${point.reason ? ' · ' + point.reason : ''}`]
  })
  return entries.length ? [heading, 'Displayed ranking order. O/H/L/C use each instrument’s stated baseline; H/L are extremes, C is the net return. Timestamped endpoints are UTC; date-only endpoints are broker sessions. Missing entries omitted.', ...entries].join('\n') : ''
}
