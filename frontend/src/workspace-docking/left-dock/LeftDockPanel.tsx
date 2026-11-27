import { memo, type ReactNode } from 'react'
import type { SymbolQuote } from '../../market-data/contracts/SymbolQuote'
import type { ChartTimeframe } from '../../market-data/contracts/ChartTimeframe'
import { MarketWatchPanel } from '../../market-data/market-watch/MarketWatchPanel'
import type { FeedStatus } from '../../market-data/mt5-feed/use-mt5-market-data'
import type { MarketWatchDock } from './useMarketWatchDock'
import './left-dock-panel.css'
import { PriceAlertsDock } from '../../price-alerts/PriceAlertsDock'
import type { PriceAlertsController } from '../../price-alerts/usePriceAlerts'

export type LeftDockTab = 'market-watch' | 'price-alerts' | 'vp-alerts'

type LeftDockPanelProps = {
  marketWatch: MarketWatchDock
  symbols: SymbolQuote[]
  selectedSymbol: string
  marketWatchStatus: FeedStatus
  marketWatchError: string | null
  onSelectSymbol: (symbol: string, timeframe?: ChartTimeframe) => void
  brokerId?: string | null
  generation?: number
  activeTab: LeftDockTab
  onSelectTab: (tab: LeftDockTab) => void
  priceAlerts: PriceAlertsController
  onCreatePriceAlert: () => void
  vpAlerts: ReactNode
  armedVpAlerts: number
}

function LeftDockPanelComponent({ marketWatch, symbols, selectedSymbol, marketWatchStatus,
  marketWatchError, onSelectSymbol, brokerId, generation, activeTab, onSelectTab, priceAlerts, onCreatePriceAlert,
  vpAlerts, armedVpAlerts }: LeftDockPanelProps) {
  const { collapsed, contentId } = marketWatch
  return <aside className={`left-dock${collapsed ? ' collapsed' : ''}`} hidden={collapsed} aria-label="Market Watch and alerts dock">
    <header className="left-dock-tabs">
      <button type="button" className={activeTab === 'market-watch' ? 'active' : ''} onClick={() => onSelectTab('market-watch')} aria-pressed={activeTab === 'market-watch'}>
        Market Watch <span>{symbols.length}</span>
      </button>
      <button type="button" className={activeTab === 'price-alerts' ? 'active' : ''} onClick={() => onSelectTab('price-alerts')} aria-pressed={activeTab === 'price-alerts'}>
        Price Alerts <span>{priceAlerts.brokerAlerts.filter(alert => alert.status === 'armed').length}</span>
      </button>
      <button type="button" className={activeTab === 'vp-alerts' ? 'active' : ''} onClick={() => onSelectTab('vp-alerts')} aria-pressed={activeTab === 'vp-alerts'}>
        VP Alerts <span>{armedVpAlerts}</span>
      </button>
    </header>
    <div id={contentId} className="left-dock-content" hidden={collapsed}>
      <div hidden={activeTab !== 'market-watch'}><MarketWatchPanel symbols={symbols} selectedSymbol={selectedSymbol} brokerId={brokerId} generation={generation}
        status={marketWatchStatus} error={marketWatchError} onSelect={onSelectSymbol} searchRequest={marketWatch.searchRequest} visible={!collapsed && activeTab === 'market-watch'} /></div>
      <div hidden={activeTab !== 'price-alerts'}><PriceAlertsDock controller={priceAlerts} onSelectSymbol={onSelectSymbol} onCreate={onCreatePriceAlert} brokerId={brokerId ?? null} /></div>
      {activeTab === 'vp-alerts' && <div className="left-dock-vp-alerts">{vpAlerts}</div>}
    </div>
  </aside>
}
export const LeftDockPanel = memo(LeftDockPanelComponent)
