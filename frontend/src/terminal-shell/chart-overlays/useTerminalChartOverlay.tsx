import { useCallback, type ComponentProps } from 'react'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import { PlannedTradePriceLines } from '../../trader-notebook/chart-levels/PlannedTradePriceLines'
import { InspectorChartMarkers } from '../../inspector'

type TradeProps = Omit<ComponentProps<typeof PlannedTradePriceLines>, 'chartApi' | 'seriesApi'>
type MarkerProps = Omit<ComponentProps<typeof InspectorChartMarkers>, 'chartApi'>
export function useTerminalChartOverlay({ arrows, selectedArrowId, draftPlan, onSelectArrow, markers, currencyColors,
  timeDisplay, onSelectRelease, supported }: TradeProps & MarkerProps & { supported: boolean }) {
  return useCallback((chartApi: IChartApi, seriesApi: ISeriesApi<'Candlestick', Time>) => <>
    <PlannedTradePriceLines chartApi={chartApi} seriesApi={seriesApi} arrows={arrows} selectedArrowId={selectedArrowId}
      draftPlan={draftPlan} onSelectArrow={onSelectArrow} />
    {supported && <InspectorChartMarkers chartApi={chartApi} markers={markers} currencyColors={currencyColors}
      timeDisplay={timeDisplay} onSelectRelease={onSelectRelease} />}
  </>, [arrows, selectedArrowId, draftPlan, onSelectArrow, supported, markers, currencyColors, timeDisplay, onSelectRelease])
}
