import type { UTCTimestamp } from 'lightweight-charts'
import type { ChartTimeframe } from '../contracts/ChartTimeframe'
import type { DrawingToolId } from './drawing-tool'

export type ChartDrawingPoint = {
  time: UTCTimestamp
  price: number
}

export type ChartDrawingRecord = {
  id: string
  symbol: string
  // Creation timeframe; visibility is shared across the symbol's timeframes.
  timeframe: ChartTimeframe
  tool: DrawingToolId
  points: ChartDrawingPoint[]
  createdAt: number
  text?: string
}
