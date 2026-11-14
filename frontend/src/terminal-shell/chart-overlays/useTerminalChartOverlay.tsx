import { useCallback, type ComponentProps } from 'react'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import { InspectorChartMarkers } from '../../inspector'
import { ChartInspectionDismiss } from './ChartInspectionDismiss'
import type { OhlcBar } from '../../market-data/contracts/OhlcBar'
import type { ChartTimeframe } from '../../market-data/contracts/ChartTimeframe'
import { CalendarLayers } from './CalendarLayers'
import { PlannedTradePriceLines } from '../../entry-trade/chart-levels/PlannedTradePriceLines'
import { PriceAlertLines } from '../../price-alerts/PriceAlertLines'
import type { PriceAlert } from '../../price-alerts/price-alert-store'

type TradeProps = Omit<ComponentProps<typeof PlannedTradePriceLines>, 'chartApi' | 'seriesApi'>
type MarkerProps = Omit<ComponentProps<typeof InspectorChartMarkers>, 'chartApi'>
export function useTerminalChartOverlay({ arrows, selectedArrowId, draftPlan, onSelectArrow, onPriceChange, onTimeChange, precision, dragEnabled, scopeKey, markers, currencyColors, timeDisplay, onSelectRelease, supported, onClearInspection,
  bars, timeframe, symbol, eventIconsVisible, priceAlerts, onAlertPriceChange, onAlertDragChange, onDeleteAlert, selectedAlertId }:
  TradeProps & MarkerProps & { supported: boolean; onClearInspection?: () => void; bars: OhlcBar[];
    timeframe: ChartTimeframe;
    symbol: string; eventIconsVisible: boolean; priceAlerts: PriceAlert[]; selectedAlertId: string | null;
    onAlertPriceChange: (id: string, price: number) => void; onAlertDragChange: (id: string | null) => void; onDeleteAlert: (id: string) => void }) {
  return useCallback((chartApi: IChartApi, seriesApi: ISeriesApi<'Candlestick', Time>) => <>
    <PriceAlertLines key={scopeKey} chartApi={chartApi} seriesApi={seriesApi} alerts={priceAlerts} symbol={symbol}
      dragEnabled={dragEnabled} onPriceChange={onAlertPriceChange} onDragChange={onAlertDragChange} onDeleteAlert={onDeleteAlert} selectedAlertId={selectedAlertId} />
    <PlannedTradePriceLines chartApi={chartApi} seriesApi={seriesApi} arrows={arrows} selectedArrowId={selectedArrowId}
      draftPlan={draftPlan} onSelectArrow={onSelectArrow} onPriceChange={onPriceChange} onTimeChange={onTimeChange}
      precision={precision} dragEnabled={dragEnabled} scopeKey={scopeKey} bars={bars} timeframe={timeframe} />
    {eventIconsVisible && <CalendarLayers chartApi={chartApi} supported={supported} markers={markers} currencyColors={currencyColors}
      timeDisplay={timeDisplay} onSelectRelease={onSelectRelease} />}
    <ChartInspectionDismiss chartApi={chartApi} onClear={onClearInspection} />

  </>, [supported, markers, currencyColors, timeDisplay, onSelectRelease, onClearInspection,
    bars, timeframe, symbol, eventIconsVisible,
    arrows, selectedArrowId, draftPlan, onSelectArrow, onPriceChange, onTimeChange, precision, dragEnabled, scopeKey, priceAlerts, onAlertPriceChange, onAlertDragChange, onDeleteAlert, selectedAlertId])
}
