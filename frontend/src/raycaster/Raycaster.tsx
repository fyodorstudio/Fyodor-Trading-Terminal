import { relativeContextVersion } from '../scoring-system/context/relative/eur-policy'
import { ContextRibbon } from './ribbon/ContextRibbon'
import { buildRibbonTimeline } from './ribbon/ribbon-timeline'
import { useRelativePreferences } from '../pair-context/storage/relative-preferences'
import { useEurContextTimeline } from '../pair-context/runtime/useEurContextTimeline'
import { relativeContext, eurContextAt } from '../scoring-system/context/relative/relative-context'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import { memo, useEffect, useMemo } from 'react'
import type { ChartTimeframe } from '../market-data/contracts/ChartTimeframe'
import type { TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { useUsdContextTimeline } from '../usd-context/runtime/useUsdContextTimeline'
import { contextAt } from '../scoring-system/context/usd/context-lookup'
import { useRaycasterHover } from './chart/useRaycasterHover'
import { candleContextCutoff } from './chart/candle-cutoff'
import { RaycasterBox, type RaycasterView } from './ui/RaycasterBox'
import { useCalendarNow } from '../inspector/useCalendarNow'
import { useRaycasterFamilies } from './storage/raycaster-family-settings'
import { timeframeSeconds } from '../inspector/inspector-data'
import { contextSourceFamilies } from '../scoring-system/context/usd/policy'
import type { OhlcBar } from '../market-data/contracts/OhlcBar'
import type { InspectorMarker } from '../inspector/inspector-data'
import type { ComboSnapshot, ComboSource, RoofComboGroup } from '../scoring-system/relationships/contracts'
import type { CurrencyColors } from '../inspector/currency-colors'
import { ComboRoofs } from '../usd-context/sequences/chart/ComboRoofs'
import { useSequencePreferences } from '../usd-context/sequences/storage/sequence-preferences'
import { lookupFreshNews } from '../scoring-system/relationships/fresh-news'
import { inspectionSignature, publishInspection, toolScope, useToolsOpen } from '../fundamental-tools/runtime/inspection-session'
import { selectedRoofProjection } from './ribbon/roof-ribbon-timeline'
import { roofLabel } from '../usd-context/sequences/chart/roof-label'
import type { InspectorScoringProps } from '../inspector/scoring/scoring-contracts'

export type RaycasterProps = { boxVisible?: boolean; symbol: string; timeframe: ChartTimeframe; brokerId: string | null;
  brokerOffsetSeconds: number; clockOffsetMs: number; timeDisplay: TimeDisplayPreference; onClose: () => void;
  bars?: readonly Pick<OhlcBar, 'time'>[]; markers?: readonly InspectorMarker[]; onSelectCombo?: (combo: ComboSnapshot) => void;
  onOpenComboSource?: (source: ComboSource) => void; currencyColors?: CurrencyColors;
  selectedCombo?: ComboSnapshot | null; onClearCombo?: () => void;
  onOpenRoofGroup?: (group: RoofComboGroup) => void; activeRoofGroupCandleAt?: number;
  publication?: Omit<InspectorScoringProps, 'now'>;
  view?: RaycasterView; onViewChange?: (view: RaycasterView) => void }
function RaycasterComponent({ chartApi, seriesApi, ...props }: RaycasterProps & { chartApi: IChartApi; seriesApi: ISeriesApi<'Candlestick', Time> }) {
  const now = useCalendarNow(props.clockOffsetMs)
  const publication = useMemo(() => props.publication ? { ...props.publication, now } : undefined, [props.publication, now])
  const families = useRaycasterFamilies()
  const sourceFamilies = useMemo(() => contextSourceFamilies(families), [families])
  const history = useUsdContextTimeline(props.brokerId, sourceFamilies, now)
  const relativePreferences = useRelativePreferences()
  const relativeSupported = /^EURUSD(?:[._-].*|[a-z]*)$/i.test(props.symbol)
  const relativeEnabled = relativeSupported && relativePreferences.mode === 'relative'
  const sequencePreferences = useSequencePreferences()
  const eurHistory = useEurContextTimeline(props.brokerId, relativePreferences.families, now, relativeEnabled)
  const scope = toolScope(props.brokerId, props.symbol, props.timeframe)
  const detailsOpen = useToolsOpen(scope)
  const boxVisible = props.boxVisible !== false
  const hover = useRaycasterHover(chartApi, seriesApi, `${props.brokerId}:${props.symbol}:${props.timeframe}`, boxVisible || detailsOpen)
  const open = hover.open ?? ((boxVisible || detailsOpen) ? hover.lastOpen : null)
  const cutoff = open === null ? null : candleContextCutoff(open, props.timeframe, now, props.brokerOffsetSeconds)
  const point = history.result && cutoff !== null ? contextAt(history.result, cutoff) : null
  const eurPoint = eurHistory.result && cutoff !== null ? eurContextAt(eurHistory.result, cutoff) : null
  const combined = relativeEnabled ? relativeContext(eurPoint, point) : null
  const relationships = history.result?.relationships
  const { current: selectionCurrent, points: roofRibbonPoints } = selectedRoofProjection(history.result, props.selectedCombo)
  const selectionNotice = props.selectedCombo && !history.loading && !selectionCurrent ? 'Inputs or history changed. This roof is a captured snapshot; reopen it to refresh Roof Candy.' : null
  const fresh = relationships && cutoff !== null ? lookupFreshNews(relationships.fresh, cutoff) : null
  const message = !props.brokerId ? 'Select a connected broker with stored calendar history.' : !history.selected.length ?
    'Enable an input in Fundamental tools → Raycaster → Advanced settings.' : history.error ?? (relativeEnabled ? eurHistory.error ?? eurHistory.storage.error : null) ??
      (history.storage.error && !history.result ? history.storage.error : null)
  const usdMessage = !props.brokerId ? 'Select a connected broker with stored calendar history.' : !history.selected.length ?
    'Enable a USD input in Raycaster settings.' : history.error ?? (history.storage.error && !history.result ? history.storage.error : null)
  const partial = (relativeEnabled && (eurHistory.storage.error || eurHistory.result?.excludedTiming || Object.values(eurHistory.storage.coverage).some(c => c.missing.length > 0))) || history.storage.error || Object.values(history.storage.coverage).some(c => c.missing.length > 0) || history.result?.excludedTiming
  const ribbonPoints = useMemo(() => buildRibbonTimeline(history.result, eurHistory.result, relativeEnabled, props.symbol),
    [history.result, eurHistory.result, relativeEnabled, props.symbol])
  useEffect(() => {
    if (!detailsOpen) return
    const range = chartApi.timeScale().getVisibleRange()
    const end = now + props.brokerOffsetSeconds * 1000
    publishInspection(scope, { usd: point, eur: eurPoint, fresh, cutoff, loading: history.loading || eurHistory.loading,
      message, held: hover.open === null && open !== null,
      signature: inspectionSignature(families, relativePreferences.mode, relativePreferences.families),
      window: range ? { from: Math.min(Number(range.from) * 1000, end - 60000), to: Math.min(end, (Number(range.to) + timeframeSeconds[props.timeframe]) * 1000) } : null })
  }, [detailsOpen, scope, point, eurPoint, fresh, cutoff, history.loading, eurHistory.loading, message, hover.open, open,
    families, relativePreferences.mode, relativePreferences.families, chartApi, now, props.brokerOffsetSeconds, props.timeframe])
  useEffect(() => () => publishInspection(scope, null), [scope])
  return <>{boxVisible && <RaycasterBox symbol={props.symbol} point={point} cutoff={cutoff} loading={history.loading || eurHistory.loading} message={message}
    brokerId={props.brokerId}
    selectedCombo={props.selectedCombo} selectionNotice={selectionNotice} onClearCombo={props.onClearCombo}
    view={props.view} onViewChange={props.onViewChange}
    relative={combined} relativeUpdate={eurPoint?.update ?? null} relativeUpdateAt={eurPoint?.chartAt ?? null}
    eurPoint={eurPoint} fresh={fresh}
    publication={publication}
    notice={partial ? 'Partial or timing-excluded history' : null}
    timeDisplay={props.timeDisplay} onClose={props.onClose} />}
    {sequencePreferences.ribbon && sequencePreferences.raycasterCandy !== false && props.bars && <ContextRibbon chartApi={chartApi} bars={props.bars} timeframe={props.timeframe}
      symbol={props.symbol} brokerId={props.brokerId}
      points={ribbonPoints} now={now + props.brokerOffsetSeconds * 1000} relative={relativeEnabled} version={`${history.result?.version ?? "Context engine"}${relativeEnabled ? ` / ${relativeContextVersion}` : ""}`}
      loading={history.loading || eurHistory.loading} notice={message} partial={!!partial} />}
    {sequencePreferences.ribbon && sequencePreferences.roofCandy !== false && props.selectedCombo && props.bars && <ContextRibbon chartApi={chartApi} bars={props.bars} timeframe={props.timeframe}
      symbol={props.symbol} brokerId={props.brokerId} points={roofRibbonPoints}
      relationshipTitle={`${roofLabel(props.selectedCombo)}${props.selectedCombo.kind === 'fresh-news' ? ' · recent change' : ''}`} relative={false} version="Selected relationship presentation v1"
      now={now + props.brokerOffsetSeconds * 1000} loading={history.loading} notice={usdMessage ?? selectionNotice} partial={!!partial} />}
    {relativeSupported && sequencePreferences.roofs && relationships && !history.loading && !message && props.bars && props.markers && props.onSelectCombo &&
      <ComboRoofs chartApi={chartApi} episodes={relationships.episodes} bars={props.bars} markers={props.markers}
        onOpenGroup={props.onOpenRoofGroup} activeGroupCandleAt={props.activeRoofGroupCandleAt}
        selectedId={props.selectedCombo?.id} currencyColors={props.currencyColors}
        timeframe={props.timeframe} now={now + props.brokerOffsetSeconds * 1000} experimental={sequencePreferences.fresh} onSelect={props.onSelectCombo} />}
  </>
}
export const Raycaster = memo(RaycasterComponent)
