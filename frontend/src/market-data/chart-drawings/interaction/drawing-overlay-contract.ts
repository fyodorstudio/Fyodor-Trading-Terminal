import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import type { ChartTimeframe } from '../../contracts/ChartTimeframe'
import { type DrawingHandleKind } from '../ChartDrawingSelectionHandles'
import type { ChartDrawingPoint, ChartDrawingRecord } from '../chart-drawing-record'
import { type DrawingToolId } from '../drawing-tool'
import { type DrawingTimeline } from '../drawing-coordinates'
export type ChartDrawingOverlayProps = {
  chartApi: IChartApi
  seriesApi: ISeriesApi<'Candlestick', Time>
  activeTool: DrawingToolId | null
  drawings: ChartDrawingRecord[]
  selectedDrawingId: string | null
  bars?: DrawingTimeline
  timeframe?: ChartTimeframe
  symbol?: string
  precision?: number
  onSelectDrawing: (drawingId: string | null) => void
  onCreateDrawing: (tool: DrawingToolId, points: ChartDrawingPoint[]) => string
  onUpdateDrawingPoint: (drawingId: string, pointIndex: number, point: ChartDrawingPoint, persist: boolean) => void
  onUpdateDrawingPoints?: (drawingId: string, points: ChartDrawingPoint[], persist: boolean) => void
  onUpdatePositionWidth: (drawingId: string, time: ChartDrawingPoint['time'], persist: boolean) => void
  onUpdateDrawingText?: (drawingId: string, text: string) => void
  onDeleteSelectedDrawing?: () => void
  onDeleteDrawing?: (drawingId: string) => void
  onExitDrawingMode: () => void
}

export type EditingHandle = {
  drawingId: string
  pointIndex: number
  kind: DrawingHandleKind
  startPoint?: ChartDrawingPoint
  initialPoints?: ChartDrawingPoint[]
  startLogical?: number
  initialLogicals?: (number | null)[]
  originalPoints?: ChartDrawingPoint[]
  startX: number
  startY: number
  moved: boolean
  captureTarget: Element
  pointerId: number
  tool: DrawingToolId
}
