import { useEffect, useMemo, useRef } from 'react'
import type { SymbolQuote } from '../../contracts/SymbolQuote'
import { priceAlertQuote } from '../../../price-alerts/price-alert-store'
import { maxTrendQuoteGapMs, trendAlertSample } from '../../../price-alerts/trend-alert'
import { trailingProfileWindow, type ProfileRow } from './volume-profile'
import { useVolumeProfile } from './useVolumeProfile'
import { profileAlertEvents, type ProfileAlert, type ProfileAlertEvent } from './volume-profile-alerts'

export function ProfileAlertMonitor({ rules, quote, generation, offset, onEvents }: {
  rules: ProfileAlert[]; quote: SymbolQuote | undefined; generation: number; offset: number
  onEvents: (events: { alert: ProfileAlert; event: ProfileAlertEvent; precision: number }[]) => void
}) {
  const { broker, symbol, fixed, lookbackMinutes } = rules[0]
  const time = quote?.tickAt
  const chartTime = quote?.tickChartTime
  const fresh = time !== undefined && chartTime !== undefined
  const end = chartTime === undefined ? 0 : Math.floor(chartTime / 60) * 60 + 60
  const range = fixed ?? (end > 0 ? trailingProfileWindow(end, lookbackMinutes) : null)
  const reading = useVolumeProfile(symbol, `${broker}:${generation}:${symbol}:alert`, generation, offset,
    fresh ? range : null, !fixed)
  const profile = reading.current && !reading.current.loading && !reading.current.incomplete ? reading.current.profile : null
  const armed = useMemo(() => new Set(rules.map(rule => rule.id)), [rules])
  const baselines = useRef(new Map<string, ProfileRow[]>())
  const lastPrice = useRef<{ at: number; price: number } | null>(null)
  useEffect(() => {
    const sample = trendAlertSample(quote, priceAlertQuote(quote), Date.now())
    if (!sample) { lastPrice.current = null; baselines.current.clear(); return }
    for (const id of baselines.current.keys()) if (!armed.has(id)) baselines.current.delete(id)
    const previous = lastPrice.current
    if (previous && sample.at < previous.at) return
    const previousPrice = previous && sample.at - previous.at <= maxTrendQuoteGapMs ? previous.price : undefined
    lastPrice.current = { at: sample.at, price: sample.bid }
    const output: { alert: ProfileAlert; event: ProfileAlertEvent; precision: number }[] = []
    for (const alert of rules) {
      const previousNodes = baselines.current.get(alert.id)
      const nodes = profile?.rows.filter(row => row.node === alert.node) ?? previousNodes
      if (nodes === undefined) continue
      baselines.current.set(alert.id, nodes)
      if (previousNodes === undefined) continue
      for (const event of profileAlertEvents(nodes, previousNodes, previousPrice, sample.bid, alert)) {
        output.push({ alert, event, precision: quote?.precision ?? 5 })
      }
    }
    if (output.length) onEvents(output)
  }, [profile, quote, rules, armed, onEvents])
  return null
}
