import { useId, useState } from 'react'
import type { SymbolQuote } from '../../market-data/contracts/SymbolQuote'
import { MarketWatchPanel } from '../../market-data/market-watch/MarketWatchPanel'
import type { FeedStatus } from '../../market-data/mt5-feed/use-mt5-market-data'
import './left-dock-panel.css'

export const marketWatchCollapsedKey = 'fyodor.market-watch.collapsed.v1'
function readCollapsed() {
  try { return localStorage.getItem(marketWatchCollapsedKey) === 'true' } catch { return false }
}

type LeftDockPanelProps = {
  symbols: SymbolQuote[]
  selectedSymbol: string
  marketWatchStatus: FeedStatus
  marketWatchError: string | null
  onSelectSymbol: (symbol: string) => void
}

export function LeftDockPanel({ symbols, selectedSymbol, marketWatchStatus,
  marketWatchError, onSelectSymbol }: LeftDockPanelProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const contentId = useId()
  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(marketWatchCollapsedKey, String(next)) } catch { /* Retain the session preference. */ }
  }
  return <aside className={`left-dock${collapsed ? ' collapsed' : ''}`} aria-label="Market Watch dock">
    <header className="left-dock-tabs">
      <button type="button" className="active" onClick={toggle} aria-expanded={!collapsed} aria-controls={contentId}
        aria-label={collapsed ? 'Show Market Watch' : 'Collapse Market Watch'} title={collapsed ? 'Show Market Watch' : 'Collapse Market Watch'}>
        {collapsed ? <i aria-hidden="true">›</i> : <>Market Watch <span>{symbols.length}</span><i aria-hidden="true">‹</i></>}
      </button>
    </header>
    <div id={contentId} className="left-dock-content" hidden={collapsed}>
      <MarketWatchPanel symbols={symbols} selectedSymbol={selectedSymbol}
        status={marketWatchStatus} error={marketWatchError} onSelect={onSelectSymbol} />
    </div>
  </aside>
}
