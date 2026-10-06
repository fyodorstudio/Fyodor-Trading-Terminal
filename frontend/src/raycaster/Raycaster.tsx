import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import type { ChartTimeframe } from '../market-data/contracts/ChartTimeframe'
import type { TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { useUsdContextTimeline } from '../usd-context/runtime/useUsdContextTimeline'
import { contextAt } from '../usd-context/core/context-lookup'
import { useRaycasterHover } from './chart/useRaycasterHover'
import { candleContextCutoff } from './chart/candle-cutoff'
import { RaycasterBox } from './ui/RaycasterBox'
import { useCalendarNow } from '../inspector/useCalendarNow'

export type RaycasterProps = { symbol: string; timeframe: ChartTimeframe; brokerId: string | null;
  brokerOffsetSeconds: number; clockOffsetMs: number; families: readonly string[]; timeDisplay: TimeDisplayPreference; onClose: () => void }
export function Raycaster({ chartApi, seriesApi, ...props }: RaycasterProps & { chartApi: IChartApi; seriesApi: ISeriesApi<'Candlestick', Time> }) {
  const now = useCalendarNow(props.clockOffsetMs)
  const history = useUsdContextTimeline(props.brokerId, props.families, now)
  const open = useRaycasterHover(chartApi, seriesApi)
  const cutoff = open === null ? null : candleContextCutoff(open, props.timeframe, now, props.brokerOffsetSeconds)
  const point = history.result && cutoff !== null ? contextAt(history.result, cutoff) : null
  const message = !props.brokerId ? 'Select a connected broker with stored calendar history.' : !history.selected.length ?
    'Enable CPI, NFP or ISM in Inspector filters.' : history.error ??
      (history.storage.error && !history.result ? history.storage.error : null)
  const partial = history.storage.error || Object.values(history.storage.coverage).some(c => c.missing.length > 0) || history.result?.excludedTiming
  return <RaycasterBox symbol={props.symbol} point={point} cutoff={cutoff} loading={history.loading} message={message}
    notice={partial ? 'Partial or timing-excluded history' : null} timeDisplay={props.timeDisplay} onClose={props.onClose} />
}
