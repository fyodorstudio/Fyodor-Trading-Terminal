export type TradeDirection = 'long' | 'short' | 'waiting'
export type TradePriceField = 'entryPrice' | 'tpPrice' | 'slPrice'

export type RegisteredTradeArrow = {
  id: string
  symbol: string
  time: number // candle bar time in seconds
  direction: TradeDirection
  eventAt?: string | null // UTC event anchor, independent of the chart arrow
  eventTitle?: string
  archived?: boolean
  targetRr?: number | null
  precision?: number
  entryPrice: number | null
  tpPrice: number | null
  slPrice: number | null
  tpPips: number | null
  slPips: number | null
  rrRatio: number | null
  note: string
  createdAt: number
}

export type PlannedTradeState = {
  eventAt?: string | null
  eventTitle?: string
  arrowTime?: number // independent chart-clock seconds; 0 is unset
  targetRr?: number | null
  direction: TradeDirection
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
