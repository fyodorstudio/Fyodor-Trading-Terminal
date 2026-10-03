import type { ChartTimeframe } from '../market-data/contracts/ChartTimeframe'
import type { SymbolQuote } from '../market-data/contracts/SymbolQuote'

const timeframes: ChartTimeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1']

type ChartWorkspaceHeaderProps = {
  symbol: string
  quote: SymbolQuote | null
  timeframe: ChartTimeframe
  onSelectTimeframe: (timeframe: ChartTimeframe) => void
  researchAudit?: boolean
  auditDetails?: string | null
  auditStatus?: string | null
  auditError?: string | null
  onReturnLive?: () => void
}

export function ChartWorkspaceHeader({
  symbol,
  quote,
  timeframe,
  onSelectTimeframe,
  researchAudit = false,
  auditDetails,
  auditStatus,
  auditError,
  onReturnLive,
}: ChartWorkspaceHeaderProps) {
  return (
    <div className="chart-toolbar">
      <div className="active-market">
        <div className="market-icon">{symbol.slice(0, 2)}</div>
        <div className="market-heading">
          <div className="market-title-row">
            <h1>{symbol}</h1>
            {!researchAudit && quote && (
              <span className={quote.dailyChange >= 0 ? 'positive' : 'negative'}>
                {quote.dailyChange >= 0 ? '+' : ''}{quote.dailyChange.toFixed(2)}%
              </span>
            )}
            {researchAudit && (
              <span className="research-header-badge">NOT LIVE</span>
            )}
          </div>
          <p className="market-subtitle">
            {researchAudit ? (
              <>
                <span className="research-subtitle-details">{auditDetails ?? 'Pinned historical research candles · not live'}</span>
                {auditStatus && <span className="research-subtitle-status"> · {auditStatus}</span>}
                {auditError && <span className="research-subtitle-error" role="alert"> · {auditError}</span>}
              </>
            ) : (
              quote?.description ?? 'Waiting for MT5 broker data'
            )}
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
            disabled={researchAudit && item !== 'H1'}
            onClick={() => onSelectTimeframe(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {!researchAudit ? (
        <div className="quote-summary">
          <span><small>Bid</small>{quote ? quote.bid.toFixed(quote.precision) : '—'}</span>
          <span><small>Ask</small>{quote ? quote.ask.toFixed(quote.precision) : '—'}</span>
        </div>
      ) : (
        <div className="research-header-actions">
          {onReturnLive && (
            <button type="button" className="research-return-btn" onClick={onReturnLive}>
              Return to live
            </button>
          )}
        </div>
      )}
    </div>
  )
}
