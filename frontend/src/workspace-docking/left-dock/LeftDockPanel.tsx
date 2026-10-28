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
  const { collapsed, contentId } = marketWatch
  return <aside className={`left-dock${collapsed ? ' collapsed' : ''}`} hidden={collapsed} aria-label="Market Watch and Price Alerts dock">
    <header className="left-dock-tabs">
      <button type="button" className={activeTab === 'market-watch' ? 'active' : ''} onClick={() => onSelectTab('market-watch')} aria-pressed={activeTab === 'market-watch'}>
        Market Watch <span>{symbols.length}</span>
      </button>
      <button type="button" className={activeTab === 'price-alerts' ? 'active' : ''} onClick={() => onSelectTab('price-alerts')} aria-pressed={activeTab === 'price-alerts'}>
        Price Alerts <span>{priceAlerts.brokerAlerts.filter(alert => alert.status === 'armed').length}</span>
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
