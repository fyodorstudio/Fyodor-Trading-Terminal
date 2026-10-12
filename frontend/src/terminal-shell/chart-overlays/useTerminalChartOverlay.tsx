import { useCallback, type ComponentProps } from 'react'
import type { IChartApi } from 'lightweight-charts'
import { InspectorChartMarkers } from '../../inspector'
import { ChartInspectionDismiss } from './ChartInspectionDismiss'

type MarkerProps = Omit<ComponentProps<typeof InspectorChartMarkers>, 'chartApi'>
export function useTerminalChartOverlay({ markers, currencyColors, timeDisplay, onSelectRelease, supported, onClearInspection }:
  MarkerProps & { supported: boolean; onClearInspection?: () => void }) {
  return useCallback((chartApi: IChartApi) => <>
    {supported && <InspectorChartMarkers chartApi={chartApi} markers={markers} currencyColors={currencyColors}
      timeDisplay={timeDisplay} onSelectRelease={onSelectRelease} />}
    <ChartInspectionDismiss chartApi={chartApi} onClear={onClearInspection} />
  </>, [supported, markers, currencyColors, timeDisplay, onSelectRelease, onClearInspection])
}
