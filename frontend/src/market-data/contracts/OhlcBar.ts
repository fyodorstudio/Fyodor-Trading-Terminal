import type { CandlestickData, UTCTimestamp } from 'lightweight-charts'

export type OhlcBar = CandlestickData<UTCTimestamp> & { tickVolume?: number }
