import { useRelativePreferences } from '../pair-context/storage/relative-preferences'
import { useEurContextTimeline } from '../pair-context/runtime/useEurContextTimeline'
import { relativeContext, eurContextAt } from '../pair-context/core/relative-context'
import { RelativeContextDetails } from '../pair-context/ui/RelativeContextDetails'
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
import type { OhlcBar } from '../market-data/contracts/OhlcBar'
import type { InspectorMarker } from '../inspector/inspector-data'
import type { ComboSnapshot } from '../usd-context/sequences/core/contracts'
import { ComboRoofs } from '../usd-context/sequences/chart/ComboRoofs'
import { useSequencePreferences } from '../usd-context/sequences/storage/sequence-preferences'
import { lookupFreshNews } from '../usd-context/sequences/core/fresh-news'

export type RaycasterProps = { symbol: string; timeframe: ChartTimeframe; brokerId: string | null;
  brokerOffsetSeconds: number; clockOffsetMs: number; timeDisplay: TimeDisplayPreference; onClose: () => void;
  bars?: readonly OhlcBar[]; markers?: readonly InspectorMarker[]; onSelectCombo?: (combo: ComboSnapshot) => void }
export function Raycaster({ chartApi, seriesApi, ...props }: RaycasterProps & { chartApi: IChartApi; seriesApi: ISeriesApi<'Candlestick', Time> }) {
  const now = useCalendarNow(props.clockOffsetMs)
  const families = useRaycasterFamilies()
  const sourceFamilies = useMemo(() => contextSourceFamilies(families), [families])
  const history = useUsdContextTimeline(props.brokerId, sourceFamilies, now)
  const relativePreferences = useRelativePreferences()
  const relativeSupported = /^EURUSD(?:[._-].*|[a-z]*)$/i.test(props.symbol)
  const relativeEnabled = relativeSupported && relativePreferences.mode === 'relative'
  const sequencePreferences = useSequencePreferences()
  const eurHistory = useEurContextTimeline(props.brokerId, relativePreferences.families, now, relativeEnabled)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const hover = useRaycasterHover(chartApi, seriesApi, `${props.brokerId}:${props.symbol}:${props.timeframe}`)
  const open = hover.open ?? (detailsOpen ? hover.lastOpen : null)
  const cutoff = open === null ? null : candleContextCutoff(open, props.timeframe, now, props.brokerOffsetSeconds)
  const point = history.result && cutoff !== null ? contextAt(history.result, cutoff) : null
  const eurPoint = eurHistory.result && cutoff !== null ? eurContextAt(eurHistory.result, cutoff) : null
  const combined = relativeEnabled ? relativeContext(eurPoint, point) : null
  const relationships = history.result?.relationships
  const fresh = relationships && cutoff !== null ? lookupFreshNews(relationships.fresh, cutoff) : null
  const message = !props.brokerId ? 'Select a connected broker with stored calendar history.' : !history.selected.length ?
    'Enable an input in Raycaster’s gear popover.' : history.error ?? (relativeEnabled ? eurHistory.error ?? eurHistory.storage.error : null) ??
      (history.storage.error && !history.result ? history.storage.error : null)
  const partial = (relativeEnabled && (eurHistory.storage.error || eurHistory.result?.excludedTiming || Object.values(eurHistory.storage.coverage).some(c => c.missing.length > 0))) || history.storage.error || Object.values(history.storage.coverage).some(c => c.missing.length > 0) || history.result?.excludedTiming
  return <><RaycasterBox symbol={props.symbol} point={point} cutoff={cutoff} loading={history.loading || eurHistory.loading} message={message}
    fresh={fresh}
    relative={combined} relativeUpdate={eurPoint?.update ?? null}
    extraDetails={<RelativeContextDetails eur={eurPoint} usd={point} loading={history.loading || eurHistory.loading} supported={relativeSupported} />}
    families={families} detailsOpen={detailsOpen} onDetailsChange={setDetailsOpen} onToggleFamily={toggleRaycasterFamily}
    held={detailsOpen && hover.open === null && open !== null} notice={partial ? 'Partial or timing-excluded history' : null}
    timeDisplay={props.timeDisplay} onClose={props.onClose} />
    {relativeSupported && sequencePreferences.roofs && relationships && !history.loading && !message && props.bars && props.markers && props.onSelectCombo &&
      <ComboRoofs chartApi={chartApi} episodes={relationships.episodes} bars={props.bars} markers={props.markers}
        timeframe={props.timeframe} now={now + props.brokerOffsetSeconds * 1000} experimental={sequencePreferences.fresh} onSelect={props.onSelectCombo} />}
  </>
}
