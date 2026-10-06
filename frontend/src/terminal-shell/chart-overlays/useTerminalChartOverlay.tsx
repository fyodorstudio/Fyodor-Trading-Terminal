import { useCallback, type ComponentProps } from 'react'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import { PlannedTradePriceLines } from '../../trader-notebook/chart-levels/PlannedTradePriceLines'
import { InspectorChartMarkers } from '../../inspector'
import { Raycaster, type RaycasterProps } from '../../raycaster/Raycaster'

type TradeProps = Omit<ComponentProps<typeof PlannedTradePriceLines>, 'chartApi' | 'seriesApi'>
type MarkerProps = Omit<ComponentProps<typeof InspectorChartMarkers>, 'chartApi'>
export function useTerminalChartOverlay({ arrows, selectedArrowId, draftPlan, onSelectArrow, markers, currencyColors,
  timeDisplay, onSelectRelease, supported, raycaster }: TradeProps & MarkerProps & { supported: boolean; raycaster?: RaycasterProps | null }) {
  return useCallback((chartApi: IChartApi, seriesApi: ISeriesApi<'Candlestick', Time>) => <>
    <PlannedTradePriceLines chartApi={chartApi} seriesApi={seriesApi} arrows={arrows} selectedArrowId={selectedArrowId}
      draftPlan={draftPlan} onSelectArrow={onSelectArrow} />
    {supported && <InspectorChartMarkers chartApi={chartApi} markers={markers} currencyColors={currencyColors}
      timeDisplay={timeDisplay} onSelectRelease={onSelectRelease} />}
    {raycaster && <Raycaster chartApi={chartApi} seriesApi={seriesApi} {...raycaster} />}
  </>, [arrows, selectedArrowId, draftPlan, onSelectArrow, supported, markers, currencyColors, timeDisplay, onSelectRelease, raycaster])
}
