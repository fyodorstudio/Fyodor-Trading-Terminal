import { memo, type ComponentProps } from 'react'
import type { IChartApi } from 'lightweight-charts'
import { InspectorChartMarkers } from '../../inspector'
type MarkerProps = Omit<ComponentProps<typeof InspectorChartMarkers>, 'chartApi'>
export const CalendarLayers = memo(function CalendarLayers({ chartApi, supported, ...markers }: MarkerProps & { chartApi: IChartApi; supported: boolean }) {
  return supported ? <InspectorChartMarkers chartApi={chartApi} {...markers} /> : null
})
