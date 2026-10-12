import type { InspectorRelease } from '../../economic-calendar/releases/release'
import type { InspectorPreferences } from '../preferences/inspector-preferences'
import type { EventSymbol } from '../../economic-calendar/presentation/event-symbols'
import type { ChartTimeframe } from '../../market-data/contracts/ChartTimeframe'
import type { OhlcBar } from '../../market-data/contracts/OhlcBar'
import { episodePublications } from '../episodes/display-episodes'

export const timeframeSeconds: Record<ChartTimeframe, number> = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400 }
export type InspectorMarker = { release: InspectorRelease; symbol: EventSymbol; time: number;
  projection?: { anchorTime: number; barsAhead: number } }
export function buildInspectorMarkers(groups: InspectorRelease[], preferences: InspectorPreferences, bars: readonly Pick<OhlcBar, 'time'>[], timeframe: ChartTimeframe): InspectorMarker[] {
  if (!preferences.showSymbols || !bars.length) return []
  return groups.flatMap((release) => {
    if (release.chartTime === null || !Number.isFinite(release.chartTime)) return []
    const timestamp = release.chartTime
    const duration = timeframeSeconds[timeframe]
    const lastTime = Number(bars[bars.length - 1].time)
    if (release.daily) {
      const end = release.daily.endChartTime
      if (end === null) return []
      let lo = 0, hi = bars.length
      while (lo < hi) { const mid = (lo + hi) >>> 1; if (Number(bars[mid].time) < timestamp) lo = mid + 1; else hi = mid }
      const time = lo < bars.length ? Number(bars[lo].time) : null
      if (time !== null && time < end) return [{ release, time, symbol: 'star' }]
      // Daily placement uses the first candle slot in the selected display day.
      // A missing historical session does not borrow another day's candle.
      if (timestamp > lastTime) {
        const barsAhead = Math.max(1, Math.ceil((timestamp - lastTime) / duration)), projected = lastTime + barsAhead * duration
        if (projected < end) return [{ release, symbol: 'star', time: projected, projection: { anchorTime: lastTime, barsAhead } }]
      }
      return []
    }
    const selectedFamily = episodePublications(release)?.find(member => preferences.families.includes(member.familyId))?.familyId ?? release.familyId
    const symbol = preferences.symbols[selectedFamily] ?? 'star'
    // There is no future candle to anchor to. Project timeframe slots into the
    // blank chart area without inserting price data or snapping to the last bar.
    // Rebuilding against incoming bars replaces this with a real candle anchor.
    if (timestamp >= lastTime + duration) {
      const barsAhead = Math.floor((timestamp - lastTime) / duration)
      return [{ release, symbol, time: lastTime + barsAhead * duration, projection: { anchorTime: lastTime, barsAhead } }]
    }
    let lo = 0, hi = bars.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1
      if (Number(bars[mid].time) <= timestamp) lo = mid + 1
      else hi = mid - 1
    }
    if (release.timingUncertain) {
      const firstOnDay = hi >= 0 && Number(bars[hi].time) === timestamp ? hi : lo
      const time = firstOnDay < bars.length ? Number(bars[firstOnDay].time) : null
      // A date-only symbol represents the day, including sessions opening
      // after midnight. It never implies this candle's precise release hour.
      return time !== null && time >= timestamp && time < timestamp + 86400 ? [{ release, time, symbol }] : []
    }
    const time = hi >= 0 ? Number(bars[hi].time) : null
    // Historical gaps still require a containing candle, never a nearby bar.
    if (time === null || timestamp >= time + duration) return []
    return [{ release, time, symbol }]
  })
}
