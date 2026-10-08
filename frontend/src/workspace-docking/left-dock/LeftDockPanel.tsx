import { memo } from 'react'
import type { SymbolQuote } from '../../market-data/contracts/SymbolQuote'
import { MarketWatchPanel } from '../../market-data/market-watch/MarketWatchPanel'
import type { FeedStatus } from '../../market-data/mt5-feed/use-mt5-market-data'
import type { MarketWatchDock } from './useMarketWatchDock'
import './left-dock-panel.css'

type LeftDockPanelProps = {
  marketWatch: MarketWatchDock
  symbols: SymbolQuote[]
  selectedSymbol: string
  marketWatchStatus: FeedStatus
  marketWatchError: string | null
  onSelectSymbol: (symbol: string) => void
}

function LeftDockPanelComponent({ marketWatch, symbols, selectedSymbol, marketWatchStatus,
  marketWatchError, onSelectSymbol }: LeftDockPanelProps) {
  const { collapsed, contentId, toggle } = marketWatch
  return <aside className={`left-dock${collapsed ? ' collapsed' : ''}`} hidden={collapsed} aria-label="Market Watch dock">
    <header className="left-dock-tabs">
      <button type="button" className="active" onClick={toggle} aria-expanded={!collapsed} aria-controls={contentId}
        aria-label="Collapse Market Watch" title="Collapse Market Watch">
        Market Watch <span>{symbols.length}</span><i aria-hidden="true">‹</i>
      </button>
    </header>
    <div id={contentId} className="left-dock-content" hidden={collapsed}>
      <MarketWatchPanel symbols={symbols} selectedSymbol={selectedSymbol}
        status={marketWatchStatus} error={marketWatchError} onSelect={onSelectSymbol} visible={!collapsed} />
    </div>
  </aside>
}
export const LeftDockPanel = memo(LeftDockPanelComponent)
