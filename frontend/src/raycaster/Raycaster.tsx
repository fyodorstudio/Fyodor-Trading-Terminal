import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import { useMemo, useState } from 'react'
import type { ChartTimeframe } from '../market-data/contracts/ChartTimeframe'
import type { TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { useUsdContextTimeline } from '../usd-context/runtime/useUsdContextTimeline'
import { contextAt } from '../usd-context/core/context-lookup'
import { useRaycasterHover } from './chart/useRaycasterHover'
import { candleContextCutoff } from './chart/candle-cutoff'
import { RaycasterBox } from './ui/RaycasterBox'
import { useCalendarNow } from '../inspector/useCalendarNow'
import { useRaycasterFamilies, toggleRaycasterFamily } from './storage/raycaster-family-settings'
import { contextSourceFamilies } from '../usd-context/core/policy'

export type RaycasterProps = { symbol: string; timeframe: ChartTimeframe; brokerId: string | null;
  brokerOffsetSeconds: number; clockOffsetMs: number; timeDisplay: TimeDisplayPreference; onClose: () => void }
export function Raycaster({ chartApi, seriesApi, ...props }: RaycasterProps & { chartApi: IChartApi; seriesApi: ISeriesApi<'Candlestick', Time> }) {
  const now = useCalendarNow(props.clockOffsetMs)
  const families = useRaycasterFamilies()
  const sourceFamilies = useMemo(() => contextSourceFamilies(families), [families])
  const history = useUsdContextTimeline(props.brokerId, sourceFamilies, now)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const hover = useRaycasterHover(chartApi, seriesApi, `${props.brokerId}:${props.symbol}:${props.timeframe}`)
  const open = hover.open ?? (detailsOpen ? hover.lastOpen : null)
  const cutoff = open === null ? null : candleContextCutoff(open, props.timeframe, now, props.brokerOffsetSeconds)
  const point = history.result && cutoff !== null ? contextAt(history.result, cutoff) : null
  const message = !props.brokerId ? 'Select a connected broker with stored calendar history.' : !history.selected.length ?
    'Enable an input in Raycaster’s gear popover.' : history.error ??
      (history.storage.error && !history.result ? history.storage.error : null)
  const partial = history.storage.error || Object.values(history.storage.coverage).some(c => c.missing.length > 0) || history.result?.excludedTiming
  return <RaycasterBox symbol={props.symbol} point={point} cutoff={cutoff} loading={history.loading} message={message}
    families={families} detailsOpen={detailsOpen} onDetailsChange={setDetailsOpen} onToggleFamily={toggleRaycasterFamily}
    held={detailsOpen && hover.open === null && open !== null} notice={partial ? 'Partial or timing-excluded history' : null}
    timeDisplay={props.timeDisplay} onClose={props.onClose} />
}
