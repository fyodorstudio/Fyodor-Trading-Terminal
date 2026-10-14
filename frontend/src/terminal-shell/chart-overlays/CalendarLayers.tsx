import { memo, useState, type ComponentProps } from 'react'
import type { IChartApi } from 'lightweight-charts'
import { InspectorChartMarkers } from '../../inspector'
import { ExternalChartMarkers } from '../../external-sources/ExternalChartMarkers'
import type { ChartTimeframe } from '../../market-data/contracts/ChartTimeframe'
import type { OhlcBar } from '../../market-data/contracts/OhlcBar'

type MarkerProps = Omit<ComponentProps<typeof InspectorChartMarkers>, 'chartApi'>
export const CalendarLayers = memo(function CalendarLayers({ chartApi, markers, currencyColors, timeDisplay, onSelectRelease, supported,
  symbol, bars, timeframe, onSelectExternal }: MarkerProps & { chartApi: IChartApi; supported: boolean; symbol: string; bars: OhlcBar[];
    timeframe: ChartTimeframe; onSelectExternal: (key: string | null) => void }) {
  const [rows, setRows] = useState(1)
  return <>
    {supported && <InspectorChartMarkers chartApi={chartApi} markers={markers} currencyColors={currencyColors}
      timeDisplay={timeDisplay} onSelectRelease={onSelectRelease} onStackRows={setRows} />}
    {supported && <ExternalChartMarkers chartApi={chartApi} symbol={symbol} bars={bars} timeframe={timeframe}
      brokerRows={rows} onSelect={onSelectExternal} />}
  </>
})
