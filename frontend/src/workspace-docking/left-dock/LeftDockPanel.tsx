import { memo } from 'react'
import type { SymbolQuote } from '../../market-data/contracts/SymbolQuote'
import { MarketWatchPanel } from '../../market-data/market-watch/MarketWatchPanel'
import type { FeedStatus } from '../../market-data/mt5-feed/use-mt5-market-data'
import type { MarketWatchDock } from './useMarketWatchDock'
import './left-dock-panel.css'
import { PriceAlertsDock } from '../../price-alerts/PriceAlertsDock'
import type { PriceAlertsController } from '../../price-alerts/usePriceAlerts'
import { CurrencySummary } from '../../thesis/CurrencySummary'

type LeftDockPanelProps = {
  marketWatch: MarketWatchDock
  symbols: SymbolQuote[]
  selectedSymbol: string
  marketWatchStatus: FeedStatus
  marketWatchError: string | null
  onSelectSymbol: (symbol: string) => void
  brokerId?: string | null
  activeTab: 'market-watch' | 'price-alerts'
  onSelectTab: (tab: 'market-watch' | 'price-alerts') => void
  priceAlerts: PriceAlertsController
  onCreatePriceAlert: () => void
}

function LeftDockPanelComponent({ marketWatch, symbols, selectedSymbol, marketWatchStatus,
  marketWatchError, onSelectSymbol, brokerId, activeTab, onSelectTab, priceAlerts, onCreatePriceAlert }: LeftDockPanelProps) {
  const { collapsed, contentId, toggle } = marketWatch
  return <aside className={`left-dock${collapsed ? ' collapsed' : ''}`} hidden={collapsed} aria-label="Market Watch and Price Alerts dock">
    <header className="left-dock-tabs">
      <button type="button" className={activeTab === 'market-watch' ? 'active' : ''} onClick={() => onSelectTab('market-watch')} aria-pressed={activeTab === 'market-watch'}>
        Market Watch <span>{symbols.length}</span>
      </button>
      <button type="button" className={activeTab === 'price-alerts' ? 'active' : ''} onClick={() => onSelectTab('price-alerts')} aria-pressed={activeTab === 'price-alerts'}>
        Price Alerts <span>{priceAlerts.brokerAlerts.filter(alert => alert.status === 'armed').length}</span>
      </button>
      <button type="button" className="left-dock-collapse" onClick={toggle} aria-expanded={!collapsed} aria-controls={contentId}
        aria-label="Hide left panel" title="Hide left panel">
        <svg aria-hidden="true" width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="3" width="16" height="14" rx="2" /><path d="M7 3v14M10 10h5" />
        </svg>
      </button>
    </header>
    <div id={contentId} className="left-dock-content" hidden={collapsed}>
      <div hidden={activeTab !== 'market-watch'}><MarketWatchPanel symbols={symbols} selectedSymbol={selectedSymbol} brokerId={brokerId}
        status={marketWatchStatus} error={marketWatchError} onSelect={onSelectSymbol} visible={!collapsed && activeTab === 'market-watch'} /></div>
      <div hidden={activeTab !== 'price-alerts'}><PriceAlertsDock controller={priceAlerts} onSelectSymbol={onSelectSymbol} onCreate={onCreatePriceAlert} brokerId={brokerId ?? null} /></div>
    </div>
    {!collapsed && <CurrencySummary />}
  </aside>
}
export const LeftDockPanel = memo(LeftDockPanelComponent)
