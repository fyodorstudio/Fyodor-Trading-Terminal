import type { SymbolQuote } from '../../market-data/contracts/SymbolQuote'
import { MarketWatchPanel } from '../../market-data/market-watch/MarketWatchPanel'
import type { FeedStatus } from '../../market-data/mt5-feed/use-mt5-market-data'
import './left-dock-panel.css'

type LeftDockPanelProps = {
  symbols: SymbolQuote[]
  selectedSymbol: string
  marketWatchStatus: FeedStatus
  marketWatchError: string | null
  onSelectSymbol: (symbol: string) => void
}

export function LeftDockPanel({ symbols, selectedSymbol, marketWatchStatus,
  marketWatchError, onSelectSymbol }: LeftDockPanelProps) {
  return <aside className="left-dock" aria-label="Market Watch dock">
    <header className="left-dock-tabs">
      <button type="button" className="active">Market Watch <span>{symbols.length}</span></button>
    </header>
    <div className="left-dock-content">
      <MarketWatchPanel symbols={symbols} selectedSymbol={selectedSymbol}
        status={marketWatchStatus} error={marketWatchError} onSelect={onSelectSymbol} />
    </div>
  </aside>
}
