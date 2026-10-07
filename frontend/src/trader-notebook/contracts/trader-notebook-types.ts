import type { TradeWorkflow } from '../workflow/workflow-model'
export type RegisteredTradeArrow = {
  id: string
  symbol: string
  time: number // candle bar time in seconds
  workflow?: TradeWorkflow
  direction: 'long' | 'short'
  entryPrice: number
  tpPrice: number
  slPrice: number
  tpPips: number
  slPips: number
  rrRatio: number
  note: string
  createdAt: number
}

export type PlannedTradeState = {
  workflow?: TradeWorkflow
  direction: 'long' | 'short'
  entryPrice: number | null
  tpPrice: number | null
  slPrice: number | null
  showOnChart: boolean
}

export function getPipMultiplier(symbol: string, precision: number): number {
  if (symbol.toUpperCase().includes('XAU')) return 10
  if (symbol.toUpperCase().includes('BTC')) return 1
  return precision === 3 || precision === 2 ? 100 : 10000
}
