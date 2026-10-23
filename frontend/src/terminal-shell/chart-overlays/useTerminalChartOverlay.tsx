import { useCallback, type ComponentProps } from 'react'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import { InspectorChartMarkers } from '../../inspector'
import { ChartInspectionDismiss } from './ChartInspectionDismiss'
import { ResearchRangeOverlay } from '../../research/ResearchRangeOverlay'
import type { OhlcBar } from '../../market-data/contracts/OhlcBar'
import type { ChartTimeframe } from '../../market-data/contracts/ChartTimeframe'
import { CalendarLayers } from './CalendarLayers'
import { PlannedTradePriceLines } from '../../entry-trade/chart-levels/PlannedTradePriceLines'

type TradeProps = Omit<ComponentProps<typeof PlannedTradePriceLines>, 'chartApi' | 'seriesApi'>
type MarkerProps = Omit<ComponentProps<typeof InspectorChartMarkers>, 'chartApi'>
export function useTerminalChartOverlay({ arrows, selectedArrowId, draftPlan, onSelectArrow, onPriceChange, onTimeChange, precision, dragEnabled, scopeKey, markers, currencyColors, timeDisplay, onSelectRelease, supported, onClearInspection,
  researchActive, bars, timeframe, onResearchRange, onCancelResearch, symbol, onSelectExternal, eventIconsVisible }:
  TradeProps & MarkerProps & { supported: boolean; onClearInspection?: () => void; researchActive: boolean; bars: OhlcBar[];
    timeframe: ChartTimeframe; onResearchRange: (from: number, to: number) => void; onCancelResearch: () => void;
    symbol: string; onSelectExternal: (key: string | null) => void; eventIconsVisible: boolean }) {
  return useCallback((chartApi: IChartApi, seriesApi: ISeriesApi<'Candlestick', Time>) => <>
    <PlannedTradePriceLines chartApi={chartApi} seriesApi={seriesApi} arrows={arrows} selectedArrowId={selectedArrowId}
      draftPlan={draftPlan} onSelectArrow={onSelectArrow} onPriceChange={onPriceChange} onTimeChange={onTimeChange}
      precision={precision} dragEnabled={dragEnabled} scopeKey={scopeKey} bars={bars} timeframe={timeframe} />
    {eventIconsVisible && <CalendarLayers chartApi={chartApi} supported={supported} markers={markers} currencyColors={currencyColors}
      timeDisplay={timeDisplay} onSelectRelease={onSelectRelease} symbol={symbol} bars={bars} timeframe={timeframe} onSelectExternal={onSelectExternal} />}
    <ChartInspectionDismiss chartApi={chartApi} onClear={onClearInspection} />
    {researchActive && <ResearchRangeOverlay chartApi={chartApi} seriesApi={seriesApi} bars={bars} timeframe={timeframe}
      onSelect={onResearchRange} onCancel={onCancelResearch} />}
  </>, [supported, markers, currencyColors, timeDisplay, onSelectRelease, onClearInspection,
    researchActive, bars, timeframe, onResearchRange, onCancelResearch, symbol, onSelectExternal, eventIconsVisible,
    arrows, selectedArrowId, draftPlan, onSelectArrow, onPriceChange, onTimeChange, precision, dragEnabled, scopeKey])
}
