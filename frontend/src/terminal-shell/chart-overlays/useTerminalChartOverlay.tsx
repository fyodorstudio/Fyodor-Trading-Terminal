import { useCallback, type ComponentProps } from 'react'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import { InspectorChartMarkers } from '../../inspector'
import { ChartInspectionDismiss } from './ChartInspectionDismiss'
import { ResearchRangeOverlay } from '../../research/ResearchRangeOverlay'
import type { OhlcBar } from '../../market-data/contracts/OhlcBar'
import type { ChartTimeframe } from '../../market-data/contracts/ChartTimeframe'
import { CalendarLayers } from './CalendarLayers'

type MarkerProps = Omit<ComponentProps<typeof InspectorChartMarkers>, 'chartApi'>
export function useTerminalChartOverlay({ markers, currencyColors, timeDisplay, onSelectRelease, supported, onClearInspection,
  researchActive, bars, timeframe, onResearchRange, onCancelResearch, symbol, onSelectExternal }:
  MarkerProps & { supported: boolean; onClearInspection?: () => void; researchActive: boolean; bars: OhlcBar[];
    timeframe: ChartTimeframe; onResearchRange: (from: number, to: number) => void; onCancelResearch: () => void;
    symbol: string; onSelectExternal: (key: string | null) => void }) {
  return useCallback((chartApi: IChartApi, seriesApi: ISeriesApi<'Candlestick', Time>) => <>
    <CalendarLayers chartApi={chartApi} supported={supported} markers={markers} currencyColors={currencyColors}
      timeDisplay={timeDisplay} onSelectRelease={onSelectRelease} symbol={symbol} bars={bars} timeframe={timeframe} onSelectExternal={onSelectExternal} />
    <ChartInspectionDismiss chartApi={chartApi} onClear={onClearInspection} />
    {researchActive && <ResearchRangeOverlay chartApi={chartApi} seriesApi={seriesApi} bars={bars} timeframe={timeframe}
      onSelect={onResearchRange} onCancel={onCancelResearch} />}
  </>, [supported, markers, currencyColors, timeDisplay, onSelectRelease, onClearInspection,
    researchActive, bars, timeframe, onResearchRange, onCancelResearch, symbol, onSelectExternal])
}
