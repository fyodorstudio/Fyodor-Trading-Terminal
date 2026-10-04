import type { ChartTimeframe } from '../market-data/contracts/ChartTimeframe'
import type { SymbolQuote } from '../market-data/contracts/SymbolQuote'

const timeframes: ChartTimeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1']

type ChartWorkspaceHeaderProps = {
  symbol: string
  quote: SymbolQuote | null
  timeframe: ChartTimeframe
  onSelectTimeframe: (timeframe: ChartTimeframe) => void
}

export function ChartWorkspaceHeader({
  symbol,
  quote,
  timeframe,
  onSelectTimeframe,
}: ChartWorkspaceHeaderProps) {
  return (
    <div className="chart-toolbar">
      <div className="active-market">
        <div className="market-icon">{symbol.slice(0, 2)}</div>
        <div className="market-heading">
          <div className="market-title-row">
            <h1>{symbol}</h1>
            {quote && (
              <span className={quote.dailyChange >= 0 ? 'positive' : 'negative'}>
                {quote.dailyChange >= 0 ? '+' : ''}{quote.dailyChange.toFixed(2)}%
              </span>
            )}
          </div>
          <p className="market-subtitle">
            {quote?.description ?? 'Waiting for MT5 broker data'}
          </p>
        </div>
      </div>

      <div className="timeframe-selector" aria-label="Chart timeframe">
        {timeframes.map((item) => (
          <button
            key={item}
            type="button"
            className={item === timeframe ? 'active' : ''}
            aria-pressed={item === timeframe}
            onClick={() => onSelectTimeframe(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="quote-summary">
        <span><small>Bid</small>{quote ? quote.bid.toFixed(quote.precision) : '—'}</span>
        <span><small>Ask</small>{quote ? quote.ask.toFixed(quote.precision) : '—'}</span>
      </div>
    </div>
  )
}
