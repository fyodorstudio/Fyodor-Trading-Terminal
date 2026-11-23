export type SymbolQuote = {
  symbol: string
  description: string
  synthetic?: boolean
  indexLevel?: number
  indexExpiresAt?: number
  bid: number
  ask: number
  dailyChange: number | null
  dailyHigh?: number | null
  dailyLow?: number | null
  precision: number
}
