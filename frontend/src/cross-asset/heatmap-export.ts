import { formatHeatmapOHLC, heatmapDate, orderHeatmapGroups, heatmapFields, type HeatmapField, type HeatmapMode, type HeatmapRow } from './heatmap-model'

const researchInstructions = [
  'Research current opportunities as of when you run this prompt in FX only: USD, EUR, GBP, AUD, NZD, CAD, CHF and JPY, and their pairs/crosses. Research all eight currencies; other assets in the heatmap are macro context only. Focus on fresh catalysts whose repricing may still be unfolding, including moves already underway.',
  'Browse fresh original sources and reputable timestamped reporting (such as Reuters and Bloomberg) on every assessment. Look beyond scheduled releases and the heatmap’s biggest movers: investigate policymaker remarks, economic surprises, changing rate expectations, elections and unscheduled geopolitical/policy headlines. Identify what changed versus expectations, including news that changes how an upcoming release should be interpreted. When drivers conflict, explain which currently dominates and why.',
  'State the assessment date/time and use Asia/Jakarta (UTC+07:00), AM/PM for assessment and verified catalyst times. Give up to three strongest supported ideas, each with a currency/pair and buy/sell bias, then two short explanations: What happened (material new information, verified time where available and decisive source link); Why it matters now (changed expectations, evidence of the reaction and what may still be insufficiently reflected in prices, and why). Separate evidence from interpretation. Do not invent times, prices or remaining repricing amounts. If direction is supported but further repricing is unclear, say so; if no opportunity is supported, say WAIT. Keep the answer concise. Mention conflicting news or upcoming releases only when material to the conclusion.',
  'Whenever I paste another heatmap snapshot in this conversation, treat it as a request to browse fresh sources and update this assessment. If it is labelled event-window market behaviour, investigate that dated reaction and reversals instead: distinguish what was knowable before/after the catalyst, and do not treat historical returns as a current entry opportunity. Prioritize material changes since the preceding assessment, briefly retaining still-relevant conclusions and revising superseded ones. Use only assessments available in this conversation. Use this prompt directly without invoking repository research workflows.',
].join('\n\n')

export function heatmapResearchPrompt(changes: string, mode: HeatmapMode, broker: string | null, copiedAt: number, eventWindow = false) {
  if (!changes) return ''
  const copiedTime = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(copiedAt)
  if (eventWindow) return ['Investigate what happened during this selected event window. Browse original sources and reputable timestamped reporting to verify catalysts, their publication times and which driver dominated competing news. Explain the reaction and reversals concisely, separating evidence from interpretation and distinguishing what was knowable before and after each catalyst. Use Jakarta (WIB), AM/PM. Do not invent prices, timing or remaining repricing. Do not treat a historical reaction as an entry opportunity now; only assess current entries if I ask. For subsequent labelled event-window snapshots, update the same dated investigation with fresh source checks. Use this prompt directly without invoking repository research workflows.', `Event-window context · ${broker ?? 'Broker'} · Copied ${copiedTime} WIB. Copy time is not a price-update timestamp.`, changes].join('\n\n')
  const returns = mode === 'weekly' ? 'Weekly changes compare each Monday–Sunday week’s final available close with the previous week’s final available close.'
    : 'Daily changes compare each broker D1 close with its previous available close, including opening gaps.'
  return [researchInstructions, `Heatmap context · ${broker ?? 'Broker'} · Copied ${copiedTime} WIB (Asia/Jakarta, UTC+07:00)`,
    `${returns} Headings marked In progress show provisional day/week-to-date changes to the latest available reading, not final closing returns. Dates are broker session labels; markets have different closing hours. Copy time is the export time, not the last market update. Missing readings are omitted, not zero.`,
    'The export contains only the selected instruments and periods, which may be historical. It does not establish current prices or the latest market-update time. O/H/L/C are opening/highest/lowest/closing price changes versus the same previous close. C is net return (latest reading while in progress). H/L are extremes reached, not current returns or intraday chronology. Weekly O is the first available opening and H/L covers the whole week.',
    'Currency baskets are custom equal-weight geometric returns of each currency against the other seven among EUR, GBP, AUD, NZD, USD, CAD, CHF and JPY, requiring all seven with matching comparison dates. They are distinct from broker USDX/EURX/JPYX. Basket O/H/L is unavailable: only net C is calculated from the seven pair endpoints.',
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
