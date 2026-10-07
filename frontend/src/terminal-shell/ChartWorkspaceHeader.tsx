import { ContextViewControls } from './chart-overlays/ContextViewControls'
import type { ChartTimeframe } from '../market-data/contracts/ChartTimeframe'
import type { SymbolQuote } from '../market-data/contracts/SymbolQuote'
import type { TimeDisplayPreference } from '../appearance/time-display/time-display-preference'

const timeframes: ChartTimeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1']

type ChartWorkspaceHeaderProps = {
  symbol: string
  quote: SymbolQuote | null
  timeframe: ChartTimeframe
  onSelectTimeframe: (timeframe: ChartTimeframe) => void
  drawingToolbarVisible?: boolean
  onToggleDrawingToolbar?: () => void
  raycasterVisible?: boolean
  raycasterSupported?: boolean
  onToggleRaycaster?: () => void
  brokerId?: string | null
  brokerOffsetSeconds?: number
  clockOffsetMs?: number
  timeDisplay?: TimeDisplayPreference
}

function PaintbrushIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
      <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" />
    </svg>
  )
}

export function ChartWorkspaceHeader({
  symbol,
  quote,
  timeframe,
  onSelectTimeframe,
  drawingToolbarVisible = true,
  onToggleDrawingToolbar,
  raycasterVisible = false,
  raycasterSupported = false,
  onToggleRaycaster,
  brokerId, brokerOffsetSeconds, clockOffsetMs, timeDisplay,
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

      <div className="chart-toolbar-center">
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
        {onToggleDrawingToolbar && (
          <button
            type="button"
            className={`chart-drawing-toggle${drawingToolbarVisible ? ' active' : ''}`}
            aria-pressed={drawingToolbarVisible}
            aria-label={drawingToolbarVisible ? 'Hide drawing toolbar' : 'Show drawing toolbar'}
            title={drawingToolbarVisible ? 'Hide drawing toolbar' : 'Show drawing toolbar'}
            onClick={onToggleDrawingToolbar}
          >
            <PaintbrushIcon />
          </button>
        )}
      </div>

      <div className="chart-toolbar-right">
        <ContextViewControls symbol={symbol} supported={raycasterSupported} raycasterVisible={raycasterVisible} onToggleRaycaster={onToggleRaycaster}
          brokerId={brokerId} timeframe={timeframe} brokerOffsetSeconds={brokerOffsetSeconds} clockOffsetMs={clockOffsetMs} timeDisplay={timeDisplay} />
      <div className="quote-summary">
        <span><small>Bid</small>{quote ? quote.bid.toFixed(quote.precision) : '—'}</span>
        <span><small>Ask</small>{quote ? quote.ask.toFixed(quote.precision) : '—'}</span>
      </div>
      </div>
    </div>
  )
}
