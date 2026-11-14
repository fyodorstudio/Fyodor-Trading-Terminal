import { memo, useEffect, useRef } from 'react'
import { LedgerDetail } from '../currency-ledger/LedgerDetail'
import { chartEventCurrencies } from '../economic-calendar/forex/chart-event-scope'
import './currency-details.css'
export const CurrencyDetailPanel = memo(function CurrencyDetailPanel({ brokerId, symbol, onClose }: {
  brokerId: string | null; symbol: string; onClose: () => void
}) {
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, element = panel.current
    element?.querySelector('button')?.focus()
    return () => { if (element?.contains(document.activeElement)) previous?.focus() }
  }, [])
  return <aside ref={panel} id="currency-detail-panel" className="currency-detail-panel" aria-labelledby="currency-detail-title" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}>
    <header><span>{symbol}</span><h2 id="currency-detail-title">Detail</h2><button type="button" aria-label="Close Detail" onClick={onClose}>×</button></header>
    <div className="detail-body">{!chartEventCurrencies(symbol).length ? <p>No currency Detail scope for {symbol}.</p> : !brokerId ? <p>Connect a broker to view Detail.</p> : <LedgerDetail />}</div>
  </aside>
})
