export type SymbolQuote = {
  symbol: string
  description: string
  bid: number
  ask: number
  dailyChange: number | null
  dailyHigh?: number | null
  dailyLow?: number | null
  precision: number
}
