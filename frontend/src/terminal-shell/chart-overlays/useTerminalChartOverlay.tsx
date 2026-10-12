import { useCallback, type ComponentProps } from 'react'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import { InspectorChartMarkers } from '../../inspector'
import { ChartInspectionDismiss } from './ChartInspectionDismiss'
import { ResearchRangeOverlay } from '../../research/ResearchRangeOverlay'
import type { OhlcBar } from '../../market-data/contracts/OhlcBar'
import type { ChartTimeframe } from '../../market-data/contracts/ChartTimeframe'

type MarkerProps = Omit<ComponentProps<typeof InspectorChartMarkers>, 'chartApi'>
export function useTerminalChartOverlay({ markers, currencyColors, timeDisplay, onSelectRelease, supported, onClearInspection,
  researchActive, bars, timeframe, onResearchRange, onCancelResearch }:
  MarkerProps & { supported: boolean; onClearInspection?: () => void; researchActive: boolean; bars: OhlcBar[];
    timeframe: ChartTimeframe; onResearchRange: (from: number, to: number) => void; onCancelResearch: () => void }) {
  return useCallback((chartApi: IChartApi, seriesApi: ISeriesApi<'Candlestick', Time>) => <>
    {supported && !researchActive && <InspectorChartMarkers chartApi={chartApi} markers={markers} currencyColors={currencyColors}
      timeDisplay={timeDisplay} onSelectRelease={onSelectRelease} />}
    <ChartInspectionDismiss chartApi={chartApi} onClear={onClearInspection} />
    {researchActive && <ResearchRangeOverlay chartApi={chartApi} seriesApi={seriesApi} bars={bars} timeframe={timeframe}
      onSelect={onResearchRange} onCancel={onCancelResearch} />}
  </>, [supported, markers, currencyColors, timeDisplay, onSelectRelease, onClearInspection,
    researchActive, bars, timeframe, onResearchRange, onCancelResearch])
}
